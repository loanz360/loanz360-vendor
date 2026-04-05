export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BADocument, BADocumentUploadResponse } from '@/types/ba-profile'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partners/ba/profile/documents
 * Fetches all documents for the BA partner
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner ID
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (!partner) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const documentType = searchParams.get('type')
    const latestOnly = searchParams.get('latest') !== 'false'

    // Build query
    let query = supabase
      .from('partner_documents')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    if (latestOnly) {
      query = query.eq('is_latest', true)
    }

    const { data: documents, error } = await query

    if (error) {
      apiLogger.error('Error fetching documents', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    const formattedDocs: BADocument[] = (documents || []).map(doc => ({
      id: doc.id,
      document_type: doc.document_type,
      document_name: doc.document_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      uploaded_at: doc.created_at,
      uploaded_by: doc.uploaded_by,
      verification_status: doc.verification_status,
      verified_at: doc.verified_at,
      verified_by: doc.verified_by,
      rejection_reason: doc.rejection_reason,
      expiry_date: doc.expiry_date,
      is_expired: doc.expiry_date ? new Date(doc.expiry_date) < new Date() : false,
      version: doc.version,
      is_latest: doc.is_latest,
      previous_version_id: doc.previous_version_id,
      remarks: doc.remarks,
    }))

    return NextResponse.json({
      success: true,
      data: formattedDocs,
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/ba/profile/documents', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/ba/profile/documents
 * Upload a new document
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('document_type') as string
    const documentName = formData.get('document_name') as string
    const expiryDate = formData.get('expiry_date') as string | null

    if (!file || !documentType) {
      return NextResponse.json(
        { success: false, error: 'File and document type are required' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
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

    // Get or create partner record
    let { data: partner } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (!partner) {
      // Create partner record if not exists
      const { data: newPartner, error: createError } = await supabase
        .from('partners')
        .insert({
          user_id: user.id,
          partner_type: 'BUSINESS_ASSOCIATE',
          work_email: user.email,
        })
        .select('id, partner_id')
        .maybeSingle()

      if (createError) {
        apiLogger.error('Error creating partner', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create partner profile' },
          { status: 500 }
        )
      }
      partner = newPartner
    }

    // Mark previous versions as not latest
    await supabase
      .from('partner_documents')
      .update({ is_latest: false })
      .eq('partner_id', partner.id)
      .eq('document_type', documentType)
      .eq('is_latest', true)

    // Get current version number
    const { data: existingDocs } = await supabase
      .from('partner_documents')
      .select('version')
      .eq('partner_id', partner.id)
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1)

    const newVersion = existingDocs && existingDocs.length > 0 ? existingDocs[0].version + 1 : 1
    const previousVersionId = existingDocs && existingDocs.length > 0 ? existingDocs[0].version : null

    // Generate unique file name
    const fileExt = file.name.split('.').pop()
    const fileName = `${partner.partner_id}_${documentType}_v${newVersion}_${Date.now()}.${fileExt}`
    const filePath = `partners/${partner.partner_id}/documents/${fileName}`

    // Upload file to storage
    const fileBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('partner-documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
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
      .getPublicUrl(filePath)

    // Create document record
    const { data: document, error: docError } = await supabase
      .from('partner_documents')
      .insert({
        partner_id: partner.id,
        document_type: documentType,
        document_name: documentName || documentType.replace(/_/g, ' '),
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: 'SELF',
        verification_status: 'PENDING',
        expiry_date: expiryDate || null,
        version: newVersion,
        is_latest: true,
        previous_version_id: previousVersionId?.toString() || null,
      })
      .select()
      .maybeSingle()

    if (docError) {
      apiLogger.error('Error creating document record', docError)
      return NextResponse.json(
        { success: false, error: 'Failed to save document record' },
        { status: 500 }
      )
    }

    // Log audit entry
    await supabase.from('partner_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'DOCUMENT_UPLOAD',
      action_description: `Uploaded ${documentType} document`,
      changed_by: 'SELF',
      source: 'WEB',
      approval_status: 'AUTO_APPROVED',
      metadata: { document_type: documentType, file_name: fileName },
      created_at: new Date().toISOString(),
    })

    const response: BADocumentUploadResponse = {
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        document_type: document.document_type,
        document_name: document.document_name,
        file_name: document.file_name,
        file_url: document.file_url,
        file_size: document.file_size,
        mime_type: document.mime_type,
        uploaded_at: document.created_at,
        uploaded_by: document.uploaded_by,
        verification_status: document.verification_status,
        verified_at: document.verified_at,
        verified_by: document.verified_by,
        rejection_reason: document.rejection_reason,
        expiry_date: document.expiry_date,
        is_expired: false,
        version: document.version,
        is_latest: document.is_latest,
        previous_version_id: document.previous_version_id,
        remarks: document.remarks,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in POST /api/partners/ba/profile/documents', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/ba/profile/documents
 * Delete a document
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Get partner
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Verify document belongs to this partner
    const { data: document } = await supabase
      .from('partner_documents')
      .select('*')
      .eq('id', documentId)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Don't allow deletion of verified documents
    if (document.verification_status === 'VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete verified documents' },
        { status: 400 }
      )
    }

    // Delete from storage
    const filePath = document.file_url.split('/partner-documents/')[1]
    if (filePath) {
      await supabase.storage.from('partner-documents').remove([filePath])
    }

    // Delete record
    const { error: deleteError } = await supabase
      .from('partner_documents')
      .delete()
      .eq('id', documentId)

    if (deleteError) {
      apiLogger.error('Error deleting document', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    // If this was the latest, mark previous version as latest
    if (document.is_latest && document.previous_version_id) {
      await supabase
        .from('partner_documents')
        .update({ is_latest: true })
        .eq('id', document.previous_version_id)
    }

    // Log audit entry
    await supabase.from('partner_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'DOCUMENT_DELETE',
      action_description: `Deleted ${document.document_type} document`,
      changed_by: 'SELF',
      source: 'WEB',
      approval_status: 'AUTO_APPROVED',
      metadata: { document_type: document.document_type, file_name: document.file_name },
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/partners/ba/profile/documents', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
