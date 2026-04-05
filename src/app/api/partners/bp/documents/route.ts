export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BPDocument, DocumentType } from '@/types/bp-profile'

/** Row shape returned from the partner_documents table */
interface DocumentRow {
  id: string
  document_type: string
  document_name: string | null
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string
  created_at: string
  uploaded_by: string
  verification_status: string | null
  verified_at: string | null
  verified_by: string | null
  admin_comments: string | null
  rejection_reason: string | null
  expiry_date: string | null
  version: number | null
  is_latest: boolean | null
}

/**
 * GET /api/partners/bp/documents
 * Fetches all documents for the current BP
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const documentType = searchParams.get('type')
    const status = searchParams.get('status')

    // Fetch partner to verify they are a BP
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('partner_documents')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    if (status) {
      query = query.eq('verification_status', status)
    }

    const { data: documents, error: docsError } = await query

    if (docsError) {
      apiLogger.error('Error fetching documents', docsError)

      // If table doesn't exist, return empty array
      if (docsError.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: [],
          message: 'Documents table not yet configured'
        })
      }

      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Format documents
    const formattedDocs: BPDocument[] = (documents || []).map((doc: DocumentRow) => ({
      id: doc.id,
      document_type: doc.document_type,
      document_name: doc.document_name || doc.document_type,
      file_name: doc.file_name,
      file_url: doc.file_url,
      file_size: doc.file_size || 0,
      mime_type: doc.mime_type,
      uploaded_at: doc.created_at,
      uploaded_by: doc.uploaded_by === user.id ? 'SELF' : doc.uploaded_by,
      verification_status: doc.verification_status || 'NOT_SUBMITTED',
      verified_at: doc.verified_at,
      verified_by: doc.verified_by,
      admin_comments: doc.admin_comments,
      rejection_reason: doc.rejection_reason,
      expiry_date: doc.expiry_date,
      is_expired: doc.expiry_date ? new Date(doc.expiry_date) < new Date() : false,
      version: doc.version || 1,
      is_latest: doc.is_latest ?? true
    }))

    return NextResponse.json({
      success: true,
      data: formattedDocs
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/bp/documents', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/bp/documents
 * Upload a new document for the current BP
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('document_type') as string
    const documentName = formData.get('document_name') as string | null
    const expiryDate = formData.get('expiry_date') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Document type is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPG, PNG, PDF' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Fetch partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Generate unique file name
    const fileExtension = file.name.split('.').pop()
    const timestamp = Date.now()
    const fileName = `bp/${partner.partner_id}/${documentType}/${timestamp}.${fileExtension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('partner-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      apiLogger.error('Error uploading file', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('partner-documents')
      .getPublicUrl(fileName)

    const fileUrl = urlData.publicUrl

    // Mark previous versions as not latest
    await supabase
      .from('partner_documents')
      .update({ is_latest: false })
      .eq('partner_id', partner.id)
      .eq('document_type', documentType)

    // Get next version number
    const { data: existingDocs } = await supabase
      .from('partner_documents')
      .select('version')
      .eq('partner_id', partner.id)
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = existingDocs && existingDocs.length > 0
      ? (existingDocs[0].version || 0) + 1
      : 1

    // Create document record
    const { data: docRecord, error: docError } = await supabase
      .from('partner_documents')
      .insert({
        partner_id: partner.id,
        document_type: documentType,
        document_name: documentName || documentType,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        verification_status: 'PENDING',
        uploaded_by: user.id,
        expiry_date: expiryDate,
        version: nextVersion,
        is_latest: true,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (docError) {
      apiLogger.error('Error creating document record', docError)

      // If table doesn't exist, still return success for file upload
      if (docError.code === '42P01') {
        return NextResponse.json({
          success: true,
          message: 'File uploaded successfully (document tracking not available)',
          file_url: fileUrl
        })
      }

      return NextResponse.json(
        { success: false, error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    // Log audit entry
    await logDocumentAudit(supabase, partner.id, 'DOCUMENT_UPLOAD', documentType, user.id)

    // Format response
    const document: BPDocument = {
      id: docRecord.id,
      document_type: docRecord.document_type,
      document_name: docRecord.document_name,
      file_name: docRecord.file_name,
      file_url: docRecord.file_url,
      file_size: docRecord.file_size,
      mime_type: docRecord.mime_type,
      uploaded_at: docRecord.created_at,
      uploaded_by: 'SELF',
      verification_status: 'PENDING',
      verified_at: null,
      verified_by: null,
      admin_comments: null,
      rejection_reason: null,
      expiry_date: docRecord.expiry_date,
      is_expired: false,
      version: docRecord.version,
      is_latest: true
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded successfully',
      document
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/partners/bp/documents', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/bp/documents
 * Delete a document (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { document_id } = body

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Fetch partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Verify document belongs to this partner
    const { data: document, error: docError } = await supabase
      .from('partner_documents')
      .select('id, document_type, verification_status')
      .eq('id', document_id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Cannot delete verified documents
    if (document.verification_status === 'VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete verified documents. Contact admin for assistance.' },
        { status: 400 }
      )
    }

    // Soft delete the document
    const { error: deleteError } = await supabase
      .from('partner_documents')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        is_latest: false
      })
      .eq('id', document_id)

    if (deleteError) {
      apiLogger.error('Error deleting document', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    // Log audit entry
    await logDocumentAudit(supabase, partner.id, 'DOCUMENT_DELETE', document.document_type, user.id)

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in DELETE /api/partners/bp/documents', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper to log document audit
async function logDocumentAudit(
  supabase: SupabaseClient,
  partnerId: string,
  action: string,
  documentType: string,
  userId: string
): Promise<void> {
  try {
    await supabase.from('partner_audit_logs').insert({
      partner_id: partnerId,
      action_type: action,
      action_description: `${action === 'DOCUMENT_UPLOAD' ? 'Uploaded' : 'Deleted'} ${documentType} document`,
      field_name: documentType,
      changed_by: userId,
      source: 'WEB',
      created_at: new Date().toISOString()
    })
  } catch (error: unknown) {
    apiLogger.error('Error logging document audit', error instanceof Error ? error : undefined)
  }
}
