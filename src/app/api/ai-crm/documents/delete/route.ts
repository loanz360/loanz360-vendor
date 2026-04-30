import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


interface Document {
  id: string
  name: string
  type: string
  size: number
  url: string
  uploaded_at: string
  uploaded_by: string
  uploaded_by_name: string
}

/**
 * DELETE Document from Lead/Deal
 *
 * Deletes file from Supabase Storage and removes metadata from JSONB array
 *
 * DELETE /api/ai-crm/documents/delete
 * Body: {
 *   entity_type: 'lead' | 'deal'
 *   entity_id: string
 *   document_id: string
 * }
 */
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { entity_type, entity_id, document_id } = body

    // Validate inputs
    if (!entity_type || !entity_id || !document_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['lead', 'deal'].includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type' },
        { status: 400 }
      )
    }

    // Map entity type to table name
    const tableMap: Record<string, string> = {
      lead: 'crm_leads',
      deal: 'crm_deals',
    }

    const tableName = tableMap[entity_type]

    // Fetch current entity
    const { data: entity, error: fetchError } = await supabase
      .from(tableName)
      .select('documents')
      .eq('id', entity_id)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json(
        { success: false, error: `${entity_type} not found` },
        { status: 404 }
      )
    }

    const documents = (entity.documents as Document[]) || []

    // Find the document to delete
    const documentToDelete = documents.find((doc) => doc.id === document_id)

    if (!documentToDelete) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Extract filename from URL
    const urlParts = documentToDelete.url.split('/')
    const filename = urlParts.slice(-3).join('/') // entity_type/entity_id/timestamp_filename

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('crm-documents')
      .remove([filename])

    if (deleteError) {
      apiLogger.error('Error deleting file from storage', deleteError)
      // Continue anyway - metadata will be removed
    }

    // Remove from documents array
    const updatedDocuments = documents.filter((doc) => doc.id !== document_id)

    // Update entity
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        documents: updatedDocuments,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)

    if (updateError) {
      apiLogger.error('Error updating documents', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        deleted_document_id: document_id,
        deleted_document_name: documentToDelete.name,
        remaining_documents: updatedDocuments.length,
        total_size: updatedDocuments.reduce((sum, doc) => sum + doc.size, 0),
      },
      message: 'Document deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Error in delete-document API', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
