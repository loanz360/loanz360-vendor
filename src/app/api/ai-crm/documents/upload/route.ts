import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


// Set body size limit to 25MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
}

export const maxDuration = 60 // 1 minute max execution time

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
 * UPLOAD Document to Lead/Deal
 *
 * Max 25MB per file
 * Files stored in Supabase Storage with public URLs
 * Document metadata stored in JSONB array
 *
 * POST /api/ai-crm/documents/upload
 * Body: FormData {
 *   entity_type: 'lead' | 'deal'
 *   entity_id: string
 *   file: File
 * }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
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

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const entity_type = formData.get('entity_type') as string
    const entity_id = formData.get('entity_id') as string

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 25MB' },
        { status: 400 }
      )
    }

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { success: false, error: 'Missing entity_type or entity_id' },
        { status: 400 }
      )
    }

    if (!['lead', 'deal'].includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type. Must be: lead or deal' },
        { status: 400 }
      )
    }

    // Map entity type to table name
    const tableMap: Record<string, string> = {
      lead: 'crm_leads',
      deal: 'crm_deals',
    }

    const tableName = tableMap[entity_type]

    // Fetch current entity to get existing documents
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

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueFilename = `${entity_type}/${entity_id}/${timestamp}_${sanitizedFilename}`

    // Convert File to ArrayBuffer then to Buffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('crm-documents') // Make sure this bucket exists in Supabase
      .upload(uniqueFilename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      apiLogger.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('crm-documents')
      .getPublicUrl(uniqueFilename)

    // Create document metadata
    const document: Document = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      url: urlData.publicUrl,
      uploaded_at: new Date().toISOString(),
      uploaded_by: user.id,
      uploaded_by_name: user.user_metadata?.full_name || 'Unknown',
    }

    // Append to existing documents array
    const existingDocuments = (entity.documents as Document[]) || []
    const updatedDocuments = [...existingDocuments, document]

    // Update entity with new documents array
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        documents: updatedDocuments,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)

    if (updateError) {
      apiLogger.error('Error updating documents:', updateError)
      // Rollback: Delete uploaded file
      await supabase.storage.from('crm-documents').remove([uniqueFilename])
      return NextResponse.json(
        { success: false, error: 'Failed to save document metadata' },
        { status: 500 }
      )
    }

    // Fire-and-forget: trigger OCR processing
    const docKey = formData.get('doc_key') as string | null
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const cookieHeader = request.headers.get('cookie') || ''
    fetch(`${baseUrl}/api/ai-crm/cro/document-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        entity_type,
        entity_id,
        document_id: document.id,
        doc_key: docKey || undefined,
      }),
    }).catch(() => { /* Non-critical side effect */ })

    return NextResponse.json({
      success: true,
      data: {
        document,
        total_documents: updatedDocuments.length,
        total_size: updatedDocuments.reduce((sum, doc) => sum + doc.size, 0),
      },
      message: 'Document uploaded successfully',
    })
  } catch (error) {
    apiLogger.error('Error in upload-document API:', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
