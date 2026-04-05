export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToS3, generatePresignedUrl, deleteFromS3 } from '@/lib/aws/s3-client'
import { fetchCreditBureauData } from '@/lib/credit-bureau/credit-bureau-service'
import { apiLogger } from '@/lib/utils/logger'

// Map document types to categories for INSERT
const DOCUMENT_TYPE_CATEGORY_MAP: Record<string, string> = {
  'PAN': 'IDENTITY', 'PAN_CARD': 'IDENTITY', 'AADHAR_FRONT': 'IDENTITY', 'AADHAR_BACK': 'IDENTITY',
  'AADHAAR': 'IDENTITY', 'PASSPORT': 'IDENTITY', 'VOTER_ID': 'IDENTITY', 'DRIVING_LICENSE': 'IDENTITY',
  'ELECTRICITY_BILL': 'ADDRESS', 'UTILITY_BILL': 'ADDRESS', 'RENT_AGREEMENT': 'ADDRESS', 'ADDRESS_PROOF': 'ADDRESS',
  'SALARY_SLIP': 'INCOME', 'ITR': 'INCOME', 'FORM_16': 'INCOME', 'INCOME_PROOF': 'INCOME',
  'BANK_STATEMENT': 'BANK', 'CANCELLED_CHEQUE': 'BANK',
  'PROPERTY_DEED': 'PROPERTY', 'ENCUMBRANCE_CERTIFICATE': 'PROPERTY', 'PROPERTY_TAX': 'PROPERTY',
}

// GET - List all documents for the authenticated customer
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch customer documents with optional filtering
    const url = new URL(request.url)
    const documentType = url.searchParams.get('type')
    const status = url.searchParams.get('status')

    let query = supabase
      .from('customer_documents')
      .select('*')
      .eq('customer_id', user.id)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false })

    if (documentType) {
      query = query.eq('document_type', documentType)
    }

    if (status) {
      query = query.eq('verification_status', status)
    }

    const { data: documents, error } = await query

    if (error) {
      apiLogger.error('Error fetching customer documents', error, 'userId:', user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Generate presigned URLs for viewing documents
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        let view_url: string | null = null
        if (doc.s3_key) {
          try {
            const presignedResult = await generatePresignedUrl({
              key: doc.s3_key,
              expiresIn: 3600, // 1 hour
              operation: 'get',
            })
            view_url = presignedResult.success ? presignedResult.url : null
          } catch {
            // Presigned URL generation failed — continue without it
          }
        }
        return {
          id: doc.id,
          document_type: doc.document_type,
          document_category: doc.document_category,
          document_name: doc.file_name,
          original_file_name: doc.file_name,
          file_size_bytes: doc.file_size_bytes,
          mime_type: doc.file_type,
          verification_status: doc.verification_status,
          rejection_reason: doc.rejection_reason,
          created_at: doc.uploaded_at,
          view_url,
          s3_key: doc.s3_key,
        }
      })
    )

    return NextResponse.json({
      success: true,
      documents: documentsWithUrls,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/documents', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Upload a new document
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
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
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.',
        },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Generate S3 key
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `customers/${user.id}/documents/${documentType}/${timestamp}-${randomStr}-${sanitizedFileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: buffer,
      contentType: file.type,
      metadata: {
        customerId: user.id,
        documentType: documentType,
        originalFileName: file.name,
      },
      tags: {
        customer: user.id,
        type: documentType,
      },
    })

    if (!uploadResult.success) {
      apiLogger.error('S3 upload failed', uploadResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Derive category from document type
    const documentCategory = DOCUMENT_TYPE_CATEGORY_MAP[documentType] || 'IDENTITY'

    // Save document record to database
    const { data: document, error: dbError } = await supabase
      .from('customer_documents')
      .insert({
        customer_id: user.id,
        document_type: documentType,
        document_category: documentCategory,
        file_name: documentName || file.name,
        file_type: file.type,
        s3_bucket: uploadResult.bucket,
        s3_key: uploadResult.s3Key,
        file_size_bytes: file.size,
        verification_status: 'PENDING',
      })
      .select()
      .maybeSingle()

    if (dbError) {
      apiLogger.error('Database error saving document', dbError)
      // Try to cleanup S3 file on failure
      await deleteFromS3(s3Key)
      return NextResponse.json(
        { success: false, error: 'Failed to save document record' },
        { status: 500 }
      )
    }

    // Generate presigned URL for immediate viewing
    const presignedResult = await generatePresignedUrl({
      key: s3Key,
      expiresIn: 3600,
      operation: 'get',
    })

    // If PAN card was uploaded, trigger credit bureau fetch in background
    if (documentType === 'PAN') {
      // Run in background - don't await, let it complete asynchronously
      fetchCreditBureauData(user.id, 'PAN_UPLOAD', false)
        .then(result => {
          if (result.success) {
          } else {
            apiLogger.error('Credit bureau fetch failed', result.error)
          }
        })
        .catch(error => {
          apiLogger.error('Credit bureau fetch error', error)
        })
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        document_type: document.document_type,
        document_category: document.document_category,
        document_name: document.file_name,
        original_file_name: document.file_name,
        file_size_bytes: document.file_size_bytes,
        mime_type: document.file_type,
        verification_status: document.verification_status,
        rejection_reason: document.rejection_reason,
        created_at: document.uploaded_at,
        view_url: presignedResult.success ? presignedResult.url : null,
        s3_key: document.s3_key,
      },
      credit_bureau_triggered: documentType === 'PAN',
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/documents', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a document
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const documentId = url.searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Fetch the document to get S3 key and verify ownership
    const { data: document, error: fetchError } = await supabase
      .from('customer_documents')
      .select('*')
      .eq('id', documentId)
      .eq('customer_id', user.id)
      .maybeSingle()

    if (fetchError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of verified documents
    if (document.verification_status === 'VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete verified documents' },
        { status: 400 }
      )
    }

    // Delete from S3
    if (document.s3_key) {
      const deleteResult = await deleteFromS3(document.s3_key)
      if (!deleteResult.success) {
        // Continue with database deletion even if S3 fails
      }
    }

    // Soft-delete from database
    const { error: deleteError } = await supabase
      .from('customer_documents')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', documentId)
      .eq('customer_id', user.id)

    if (deleteError) {
      apiLogger.error('Database error deleting document', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete document' },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/customers/documents', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
