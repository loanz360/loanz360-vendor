export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const supabase = await createClient()
    const userId = auth.userId
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('type') || 'INDIVIDUAL'
    const category = searchParams.get('category')

    // Verify user has access to this profile (IDOR protection)
    if (profileType === 'INDIVIDUAL') {
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
    } else if (profileType === 'ENTITY') {
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individualProfile) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      const { data: membership } = await supabase
        .from('entity_members')
        .select('id')
        .eq('entity_id', profileId)
        .eq('individual_id', individualProfile.id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Build query
    let query = supabase
      .from('profile_documents')
      .select('*')
      .eq('profile_id', profileId)
      .eq('profile_type', profileType)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Filter by document type/category if provided
    if (category) {
      // Get document types for this category
      const { data: categoryData } = await supabase
        .from('document_categories')
        .select('document_types')
        .eq('key', category)
        .maybeSingle()

      if (categoryData?.document_types) {
        query = query.in('document_type', categoryData.document_types)
      }
    }

    const { data: documents, error } = await query

    if (error) {
      apiLogger.error('Error fetching documents', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: documents || []
    })
  } catch (error) {
    apiLogger.error('Error in documents API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const supabase = await createClient()
    const userId = auth.userId

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const profile_type = formData.get('profile_type') as string
    const document_type = formData.get('document_type') as string
    const document_name = formData.get('document_name') as string
    const document_number = formData.get('document_number') as string | null
    const description = formData.get('description') as string | null
    const issue_date = formData.get('issue_date') as string | null
    const expiry_date = formData.get('expiry_date') as string | null
    const tags = formData.get('tags') as string | null

    // Validate required fields
    if (!file || !profile_type || !document_type || !document_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Verify user has access to this profile
    if (profile_type === 'INDIVIDUAL') {
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
    } else if (profile_type === 'ENTITY') {
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individualProfile) {
        return NextResponse.json(
          { success: false, error: 'Individual profile not found' },
          { status: 404 }
        )
      }

      const { data: membership } = await supabase
        .from('entity_members')
        .select('id, can_sign_documents')
        .eq('entity_id', profileId)
        .eq('individual_id', individualProfile.id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!membership || !membership.can_sign_documents) {
        return NextResponse.json(
          { success: false, error: 'Access denied. You need document signing permission.' },
          { status: 403 }
        )
      }
    }

    // Generate unique file path
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${profile_type.toLowerCase()}/${profileId}/${timestamp}_${sanitizedFileName}`

    // Convert File to ArrayBuffer for upload
    const fileBuffer = await file.arrayBuffer()
    const fileUint8Array = new Uint8Array(fileBuffer)

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-documents')
      .upload(storagePath, fileUint8Array, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      apiLogger.error('Error uploading file to storage', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Get public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('profile-documents')
      .getPublicUrl(storagePath)

    const file_path = publicUrlData.publicUrl

    // Insert document record
    const { data: document, error } = await supabase
      .from('profile_documents')
      .insert({
        profile_id: profileId,
        profile_type,
        document_type,
        document_name,
        document_number,
        file_name: file.name,
        file_path,
        file_size: file.size,
        file_type: file.type,
        description,
        issue_date,
        expiry_date,
        tags: tags ? JSON.parse(tags) : null,
        uploaded_by: userId,
        status: 'ACTIVE',
        verification_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (error) {
      // If document record creation fails, delete the uploaded file
      await supabase.storage
        .from('profile-documents')
        .remove([storagePath])

      apiLogger.error('Error creating document', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('profile_activity_log').insert({
      profile_id: profileId,
      profile_type,
      activity_type: 'DOCUMENT_UPLOADED',
      activity_category: 'DOCUMENT',
      title: `Uploaded ${document_name}`,
      description: `Document ${document_name} of type ${document_type} was uploaded`,
      performed_by: userId,
      metadata: {
        document_id: document.id,
        document_type,
        file_name: file.name
      }
    })

    return NextResponse.json({
      success: true,
      document
    })
  } catch (error) {
    apiLogger.error('Error in documents POST API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
