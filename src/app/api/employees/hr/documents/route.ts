import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// HR DOCUMENTS API
// GET: List documents with stats + form data
// POST: Upload file + create document record
// DELETE: Remove document
// PATCH: Verify/reject/auto-verify document
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { z } from 'zod'
import {
  getDocumentVerificationService,
  VERIFIABLE_DOC_TYPES,
} from '@/lib/services/employee-document-verification'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface DocumentRecord {
  uploaded_by: string | null
  verified_by: string | null
  verification_status: string
  document_type?: { category?: string; type_code?: string; type_name?: string } | null
  [key: string]: unknown
}

interface UserRecord {
  user_id: string
  full_name: string
}

async function verifyHRAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { checkHRAccessByUserId } = await import('@/lib/auth/hr-access')
  return checkHRAccessByUserId(supabase, userId)
}

// GET: List all documents
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyHRAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status')
    const categoryFilter = searchParams.get('category')
    const includeFormData = searchParams.get('include_form_data') === 'true'

    // Fetch documents with joins using adminClient to bypass RLS (HR needs to see all employee docs)
    let query = adminClient
      .from('employee_documents')
      .select(`
        *,
        employee:employees(
          id,
          full_name,
          work_email,
          department
        ),
        document_type:employee_document_types(
          id,
          type_code,
          type_name,
          category,
          is_mandatory
        )
      `)
      .eq('is_current', true)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('verification_status', statusFilter.toUpperCase())
    }

    if (categoryFilter) {
      // Filter by document type category (post-query since it's nested)
    }

    const { data: documents, error: docsError } = await query

    if (docsError) {
      apiLogger.error('HR Documents fetch error', docsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Post-filter by category if specified
    let filteredDocs = documents || []
    if (categoryFilter) {
      filteredDocs = filteredDocs.filter((d: DocumentRecord) =>
        d.document_type?.category?.toUpperCase() === categoryFilter.toUpperCase()
      )
    }

    // Batch fetch uploader and verifier names
    const uploaderIds = [...new Set(filteredDocs.map((d: DocumentRecord) => d.uploaded_by).filter(Boolean))]
    const verifierIds = [...new Set(filteredDocs.map((d: DocumentRecord) => d.verified_by).filter(Boolean))]
    const allUserIds = [...new Set([...uploaderIds, ...verifierIds])]

    let nameMap: Record<string, string> = {}
    if (allUserIds.length > 0) {
      const { data: users } = await adminClient
        .from('employees')
        .select('user_id, full_name')
        .in('user_id', allUserIds)

      if (users) {
        nameMap = Object.fromEntries(
          users.map((u: UserRecord) => [u.user_id, u.full_name])
        )
      }
    }

    // Generate signed URLs for document files (15 min expiry)
    const docsWithFileUrl = filteredDocs.filter((d: DocumentRecord) => d.file_url)
    const filePaths = docsWithFileUrl.map((d: DocumentRecord) => String(d.file_url))
    let signedUrlMap: Record<string, string> = {}
    if (filePaths.length > 0) {
      try {
        const { data: signedUrls } = await adminClient.storage
          .from('employee-documents')
          .createSignedUrls(filePaths, 15 * 60) // 15 minutes
        if (signedUrls) {
          for (const item of signedUrls) {
            if (item.signedUrl && item.path) {
              signedUrlMap[item.path] = item.signedUrl
            }
          }
        }
      } catch (signErr) {
        apiLogger.warn('Failed to generate signed URLs for documents', { error: signErr })
      }
    }

    // Enrich documents with names and signed URLs
    const enrichedDocs = filteredDocs.map((doc: DocumentRecord) => ({
      ...doc,
      uploaded_by_name: doc.uploaded_by ? (nameMap[doc.uploaded_by] || 'Unknown') : 'System',
      verified_by_name: doc.verified_by ? (nameMap[doc.verified_by] || 'Unknown') : null,
      signed_url: doc.file_url ? (signedUrlMap[String(doc.file_url)] || null) : null,
    }))

    // Compute stats from all documents (not filtered)
    const allDocs = documents || []
    const stats = {
      totalDocuments: allDocs.length,
      pendingVerification: allDocs.filter((d: DocumentRecord) => d.verification_status === 'PENDING').length,
      verified: allDocs.filter((d: DocumentRecord) => d.verification_status === 'VERIFIED').length,
      rejected: allDocs.filter((d: DocumentRecord) => d.verification_status === 'REJECTED').length,
      expired: allDocs.filter((d: DocumentRecord) => d.verification_status === 'EXPIRED').length
    }

    // Get unique categories for filter dropdown
    const categorySet = new Set(allDocs.map((d: DocumentRecord) => d.document_type?.category).filter(Boolean))
    const categories = Array.from(categorySet).map(cat => ({
      name: cat as string,
      count: allDocs.filter((d: DocumentRecord) => d.document_type?.category === cat).length
    }))

    // Optionally include form data for upload modal
    let formData = undefined
    if (includeFormData) {
      const [typesResult, employeesResult] = await Promise.all([
        adminClient
          .from('employee_document_types')
          .select('id, type_code, type_name, category, is_mandatory, allowed_file_types, max_file_size_mb')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        adminClient
          .from('employees')
          .select('id, full_name, work_email, department')
          .eq('employee_status', 'ACTIVE')
          .order('full_name', { ascending: true })
      ])

      formData = {
        document_types: typesResult.data || [],
        employees: employeesResult.data || []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        documents: enrichedDocs,
        stats,
        categories,
        ...(formData ? { formData } : {})
      }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Documents GET Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// POST: Upload document
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyHRAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const employee_id = formData.get('employee_id') as string
    const document_type_id = formData.get('document_type_id') as string
    const document_number = formData.get('document_number') as string | null
    const expiry_date = formData.get('expiry_date') as string | null

    if (!file || !employee_id || !document_type_id) {
      return NextResponse.json({
        success: false, error: 'file, employee_id, and document_type_id are required'
      }, { status: 400 })
    }

    // Validate employee_id is a valid UUID to prevent path traversal
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(employee_id)) {
      return NextResponse.json({ success: false, error: 'Invalid employee ID format' }, { status: 400 })
    }

    // Sanitize document_type_id to prevent directory traversal
    const safeDocTypeId = String(document_type_id).replace(/[^a-zA-Z0-9_-]/g, '')

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Validate file type - whitelist allowed extensions and MIME types
    const ALLOWED_FILE_TYPES: Record<string, string[]> = {
      'pdf': ['application/pdf'],
      'jpg': ['image/jpeg'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'webp': ['image/webp'],
      'gif': ['image/gif'],
      'doc': ['application/msword'],
      'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      'xls': ['application/vnd.ms-excel'],
      'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      'csv': ['text/csv', 'application/csv'],
      'txt': ['text/plain'],
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!fileExt || !ALLOWED_FILE_TYPES[fileExt]) {
      return NextResponse.json(
        { success: false, error: `File type '.${fileExt}' is not allowed. Allowed types: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}` },
        { status: 400 }
      )
    }

    const allowedMimeTypes = ALLOWED_FILE_TYPES[fileExt]
    if (file.type && !allowedMimeTypes.includes(file.type) && file.type !== 'application/octet-stream') {
      return NextResponse.json(
        { success: false, error: `File MIME type '${file.type}' does not match extension '.${fileExt}'. Please upload a valid file.` },
        { status: 400 }
      )
    }
    const timestamp = Date.now()
    const storagePath = `${employee_id}/${safeDocTypeId}_${timestamp}.${fileExt}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await adminClient.storage
      .from('employee-documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      apiLogger.error('Storage upload error', uploadError)
      return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 })
    }

    // Generate signed URL (15 min expiry) instead of public URL for security
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from('employee-documents')
      .createSignedUrl(storagePath, 15 * 60) // 15 minutes in seconds

    const fileUrl = signedUrlData?.signedUrl || storagePath
    if (signedUrlError) {
      apiLogger.warn('Failed to create signed URL, storing path only', { error: signedUrlError })
    }

    // Insert document record using adminClient to bypass RLS
    const { data: doc, error: insertError } = await adminClient
      .from('employee_documents')
      .insert({
        employee_id,
        document_type_id,
        document_number: document_number || null,
        file_name: file.name,
        file_url: storagePath, // Store the path, not the signed URL (signed URLs expire)
        file_size_kb: Math.round(file.size / 1024),
        file_type: fileExt,
        uploaded_by: user.id,
        verification_status: 'PENDING',
        expiry_date: expiry_date || null,
        version: 1,
        is_current: true,
        is_active: true
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Document insert error', insertError)
      // Try to clean up the uploaded file
      try {
        await adminClient.storage.from('employee-documents').remove([storagePath])
      } catch (cleanupErr) {
        apiLogger.warn('Failed to cleanup orphaned file', { path: storagePath, error: cleanupErr })
      }
      return NextResponse.json({ success: false, error: 'Failed to save document record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { ...doc, signed_url: fileUrl },
      message: 'Document uploaded successfully'
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Documents POST Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// Zod schema for PATCH body validation
const patchDocumentSchema = z.object({
  action: z.enum(['VERIFY', 'REJECT', 'AUTO_VERIFY']),
  document_id: z.string().uuid(),
  rejection_reason: z.string().max(1000).optional(),
  verification_notes: z.string().max(1000).optional(),
  document_number: z.string().max(100).optional(),
  employee_name: z.string().max(200).optional(),
  date_of_birth: z.string().optional(),
  father_name: z.string().max(200).optional(),
})

// PATCH: Verify or reject document
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyHRAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate PATCH body with Zod
    const parsed = patchDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten()
      }, { status: 400 })
    }

    const { action, document_id, rejection_reason, verification_notes } = parsed.data

    if (action === 'VERIFY') {
      const { data: updated, error: updateError } = await adminClient
        .from('employee_documents')
        .update({
          verification_status: 'VERIFIED',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_notes: verification_notes || null
        })
        .eq('id', document_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to verify document' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Document verified successfully'
      })
    } else if (action === 'REJECT') {
      if (!rejection_reason?.trim()) {
        return NextResponse.json({ success: false, error: 'Rejection reason required' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await adminClient
        .from('employee_documents')
        .update({
          verification_status: 'REJECTED',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          rejection_reason
        })
        .eq('id', document_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to reject document' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Document rejected'
      })
    } else if (action === 'AUTO_VERIFY') {
      // Trigger DigiLocker auto-verification
      const { document_number, employee_name, date_of_birth, father_name } = parsed.data

      // Fetch document with type info using adminClient
      const { data: docWithType, error: fetchError } = await adminClient
        .from('employee_documents')
        .select(`
          id, employee_id, document_number,
          document_type:employee_document_types(type_code, type_name)
        `)
        .eq('id', document_id)
        .eq('is_active', true)
        .maybeSingle()

      if (fetchError || !docWithType) {
        return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
      }

      const typeCode = (docWithType as unknown as { document_type?: { type_code?: string } }).document_type?.type_code
      const service = getDocumentVerificationService()

      if (!typeCode || !service.isVerifiable(typeCode)) {
        return NextResponse.json({
          success: false, error: `Document type ${typeCode || 'unknown'} does not support auto-verification`,
          supported_types: VERIFIABLE_DOC_TYPES
        }, { status: 400 })
      }

      const docNumber = document_number || docWithType.document_number
      if (!docNumber) {
        return NextResponse.json({
          success: false, error: 'document_number is required for auto-verification'
        }, { status: 400 })
      }

      // Fetch employee name if not provided
      let empName = employee_name
      if (!empName) {
        const { data: emp } = await adminClient
          .from('employees')
          .select('full_name')
          .eq('id', docWithType.employee_id)
          .maybeSingle()
        empName = emp?.full_name
      }

      // Run verification
      const result = await service.verifyDocument({
        documentId: document_id,
        employeeId: docWithType.employee_id,
        documentTypeCode: typeCode,
        documentNumber: docNumber,
        employeeName: empName,
        dateOfBirth: date_of_birth,
        fatherName: father_name,
        initiatedBy: user.id,
      })

      // Log verification attempt
      await adminClient.from('employee_document_verification_log').insert({
        document_id,
        employee_id: docWithType.employee_id,
        verification_type: result.method,
        document_type_code: typeCode,
        document_number_masked: result.maskedNumber || '***',
        request_payload: { document_type: typeCode, employee_name: empName },
        response_payload: {
          verified: result.verified,
          confidence: result.confidence,
          extractedData: result.extractedData,
          discrepancies: result.discrepancies,
        },
        status: result.success ? (result.verified ? 'SUCCESS' : 'FAILED') : 'ERROR',
        confidence_score: result.confidence,
        discrepancies: result.discrepancies || null,
        provider: result.provider,
        latency_ms: result.latencyMs,
        initiated_by: user.id,
        initiated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: result.error || null,
      })

      // Update document based on result
      const updateData: Record<string, unknown> = {
        verification_method: result.method,
        verification_provider: result.provider,
        verification_confidence: result.confidence,
        verification_response: result.extractedData,
        extracted_data: result.extractedData,
        document_number: docNumber,
      }

      if (result.verified && result.autoApproved) {
        updateData.verification_status = 'VERIFIED'
        updateData.verified_by = user.id
        updateData.verified_at = new Date().toISOString()
        updateData.verification_notes = `Auto-verified via ${result.provider} (confidence: ${result.confidence}%)`
      } else if (result.verified) {
        updateData.verification_notes = `Verified with discrepancies - manual review needed (confidence: ${result.confidence}%)`
      } else {
        updateData.verification_notes = `Auto-verification failed: ${result.error}`
      }

      await adminClient.from('employee_documents').update(updateData).eq('id', document_id)

      return NextResponse.json({
        success: true,
        data: {
          verified: result.verified,
          auto_approved: result.autoApproved,
          confidence: result.confidence,
          method: result.method,
          masked_number: result.maskedNumber,
          extracted_data: result.extractedData,
          discrepancies: result.discrepancies,
          message: result.autoApproved
            ? 'Document auto-verified and approved'
            : result.verified
              ? 'Verified with discrepancies - manual review recommended'
              : `Verification failed: ${result.error}`,
        },
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action. Use VERIFY, REJECT, or AUTO_VERIFY' }, { status: 400 })
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Documents PATCH Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// DELETE: Remove document
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyHRAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json({ success: false, error: 'Document id required' }, { status: 400 })
    }

    // Soft delete (mark as inactive) using adminClient
    const { data: deleted, error: deleteError } = await adminClient
      .from('employee_documents')
      .update({ is_active: false })
      .eq('id', documentId)
      .select('id, file_url')
      .maybeSingle()

    if (deleteError) {
      return NextResponse.json({ success: false, error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: deleted,
      message: 'Document deleted'
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Documents DELETE Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
