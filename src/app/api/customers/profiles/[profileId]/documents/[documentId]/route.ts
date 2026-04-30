
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; documentId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId, documentId } = await params
    const supabase = await createClient()
    const userId = auth.userId

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('profile_documents')
      .select('*, profile_type')
      .eq('id', documentId)
      .eq('profile_id', profileId)
      .maybeSingle()

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Verify user has access to delete AND document belongs to the profile
    // SECURITY: Re-validate document ownership to prevent IDOR attacks
    if (document.profile_type === 'INDIVIDUAL') {
      const { data: profile } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!profile) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      // Verify the document actually belongs to this individual's profile
      const { data: docOwnership } = await supabase
        .from('profile_documents')
        .select('id')
        .eq('id', documentId)
        .eq('profile_id', profileId)
        .eq('profile_type', 'INDIVIDUAL')
        .maybeSingle()

      if (!docOwnership) {
        return NextResponse.json(
          { success: false, error: 'Document not found for this profile' },
          { status: 404 }
        )
      }
    } else if (document.profile_type === 'ENTITY') {
      const { data: individual } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individual) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      const { data: membership } = await supabase
        .from('entity_members')
        .select('id, can_sign_documents')
        .eq('entity_id', profileId)
        .eq('individual_id', individual.id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!membership || !membership.can_sign_documents) {
        return NextResponse.json(
          { success: false, error: 'Access denied. You need document signing permission.' },
          { status: 403 }
        )
      }

      // Verify the document actually belongs to this entity's profile
      const { data: docOwnership } = await supabase
        .from('profile_documents')
        .select('id')
        .eq('id', documentId)
        .eq('profile_id', profileId)
        .eq('profile_type', 'ENTITY')
        .maybeSingle()

      if (!docOwnership) {
        return NextResponse.json(
          { success: false, error: 'Document not found for this profile' },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid profile type' },
        { status: 400 }
      )
    }

    // Soft delete the document (include profile_id filter to prevent IDOR)
    const { error: deleteError } = await supabase
      .from('profile_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId)
      .eq('profile_id', profileId)

    if (deleteError) {
      apiLogger.error('Error deleting document', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    // Delete from storage
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from('profile-documents')
        .remove([document.file_path])

      if (storageError) {
        apiLogger.error('Error deleting file from storage', storageError)
        // Continue anyway, document record is already soft deleted
      }
    }

    // Log activity
    await supabase.from('profile_activity_log').insert({
      profile_id: profileId,
      profile_type: document.profile_type,
      activity_type: 'DOCUMENT_DELETED',
      activity_category: 'DOCUMENT',
      title: `Deleted ${document.document_name}`,
      description: `Document ${document.document_name} was deleted`,
      performed_by: userId,
      metadata: {
        document_id: documentId,
        document_type: document.document_type,
        file_name: document.file_name
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error in document DELETE API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
