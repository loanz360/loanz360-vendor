export const dynamic = 'force-dynamic'

/**
 * POST /api/employees/documents/verify
 *
 * Auto-verify an employee document via DigiLocker.
 * Supports: PAN, Aadhaar, Driving License, Voter ID, Passport.
 *
 * Body: {
 *   document_id: UUID,
 *   document_number: string (required if not already stored),
 *   employee_name?: string (for cross-check),
 *   date_of_birth?: string (YYYY-MM-DD),
 *   father_name?: string
 * }
 *
 * GET /api/employees/documents/verify?document_id=UUID
 * Check verification status of a document
 *
 * GET /api/employees/documents/verify?action=supported_types
 * List document types that support auto-verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import {
  getDocumentVerificationService,
  VERIFIABLE_DOC_TYPES,
} from '@/lib/services/employee-document-verification'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const runtime = 'nodejs'

// GET: Check verification status or list supported types
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    // Return supported document types
    if (action === 'supported_types') {
      return NextResponse.json({
        success: true,
        data: {
          supported_types: VERIFIABLE_DOC_TYPES,
          provider: 'DigiLocker',
          environment: process.env.DIGILOCKER_ENVIRONMENT || 'sandbox',
        },
      })
    }

    // Check status of a specific document
    const documentId = searchParams.get('document_id')
    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'document_id query parameter required' },
        { status: 400 }
      )
    }

    // Fetch document with verification details
    const { data: doc, error: docError } = await supabase
      .from('employee_documents')
      .select(
        `
        id, document_number, verification_status, verification_method,
        verification_provider, verification_confidence, verification_notes,
        extracted_data, verification_response, verified_at, verified_by,
        document_type:employee_document_types(type_code, type_name, category)
      `
      )
      .eq('id', documentId)
      .maybeSingle()

    if (docError || !doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    // Fetch verification logs
    const { data: logs } = await supabase
      .from('employee_document_verification_log')
      .select('*')
      .eq('document_id', documentId)
      .order('initiated_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      data: {
        document: doc,
        verification_logs: logs || [],
        is_verifiable: (doc as any).document_type?.type_code
          ? VERIFIABLE_DOC_TYPES.includes((doc as any).document_type.type_code)
          : false,
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/employees/documents/verify:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Trigger auto-verification via DigiLocker
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has HR or admin access (employees can also trigger for their own docs)
    const { data: currentEmployee } = await supabase
      .from('employees')
      .select('id, sub_role, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHR = currentEmployee?.sub_role &&
      ['HR_EXECUTIVE', 'HR_MANAGER', 'SUPER_ADMIN', 'ADMIN'].includes(currentEmployee.sub_role)

    const body = await request.json()
    const { document_id, document_number, employee_name, date_of_birth, father_name } = body

    if (!document_id) {
      return NextResponse.json(
        { success: false, error: 'document_id is required' },
        { status: 400 }
      )
    }

    // Fetch the document with its type
    const { data: doc, error: docError } = await supabase
      .from('employee_documents')
      .select(
        `
        id, employee_id, document_number, verification_status,
        document_type:employee_document_types(id, type_code, type_name, category)
      `
      )
      .eq('id', document_id)
      .eq('is_active', true)
      .maybeSingle()

    if (docError || !doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    // Authorization: HR can verify any doc, employees can only verify their own
    if (!isHR) {
      const { data: empRecord } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', doc.employee_id)
        .maybeSingle()

      if (!empRecord) {
        return NextResponse.json(
          { success: false, error: 'You can only verify your own documents' },
          { status: 403 }
        )
      }
    }

    const typeCode = (doc as any).document_type?.type_code
    if (!typeCode) {
      return NextResponse.json(
        { success: false, error: 'Could not determine document type' },
        { status: 400 }
      )
    }

    // Check if type is verifiable
    const service = getDocumentVerificationService()
    if (!service.isVerifiable(typeCode)) {
      return NextResponse.json(
        {
          success: false,
          error: `Document type ${typeCode} does not support auto-verification`,
          data: { supported_types: VERIFIABLE_DOC_TYPES },
        },
        { status: 400 }
      )
    }

    // Get document number from request or stored value
    const docNumber = document_number || doc.document_number
    if (!docNumber) {
      return NextResponse.json(
        { success: false, error: 'document_number is required for verification' },
        { status: 400 }
      )
    }

    // Already verified? Return early
    if (doc.verification_status === 'VERIFIED') {
      return NextResponse.json({
        success: true,
        message: 'Document is already verified',
        data: { verification_status: 'VERIFIED', already_verified: true },
      })
    }

    // Fetch employee name for cross-check if not provided
    let empName = employee_name
    if (!empName) {
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', doc.employee_id)
        .maybeSingle()
      empName = emp?.full_name
    }

    // Update document number if it wasn't stored
    if (!doc.document_number && document_number) {
      await supabase
        .from('employee_documents')
        .update({ document_number })
        .eq('id', document_id)
    }

    // Perform verification
    const result = await service.verifyDocument({
      documentId: document_id,
      employeeId: doc.employee_id,
      documentTypeCode: typeCode,
      documentNumber: docNumber,
      employeeName: empName,
      dateOfBirth: date_of_birth,
      fatherName: father_name,
      initiatedBy: user.id,
    })

    // Use admin client for writes to bypass RLS
    const adminSupabase = createSupabaseAdmin()

    // Log the verification attempt
    await adminSupabase.from('employee_document_verification_log').insert({
      document_id,
      employee_id: doc.employee_id,
      verification_type: result.method,
      document_type_code: typeCode,
      document_number_masked: result.maskedNumber || '***',
      request_payload: {
        document_type: typeCode,
        employee_name: empName,
        has_dob: !!date_of_birth,
        has_father_name: !!father_name,
      },
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

    // Update the document based on result
    if (result.verified && result.autoApproved) {
      // Auto-approve: verified with high confidence and no name mismatches
      await adminSupabase
        .from('employee_documents')
        .update({
          verification_status: 'VERIFIED',
          verification_method: result.method,
          verification_provider: result.provider,
          verification_confidence: result.confidence,
          verification_response: result.extractedData,
          extracted_data: result.extractedData,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_notes: `Auto-verified via ${result.provider} (confidence: ${result.confidence}%)`,
          document_number: docNumber,
        })
        .eq('id', document_id)

      logger.info(
        `Document ${document_id} auto-verified via ${result.provider} for employee ${doc.employee_id}`
      )
    } else if (result.verified && !result.autoApproved) {
      // Verified but with discrepancies - needs manual review
      await adminSupabase
        .from('employee_documents')
        .update({
          verification_method: result.method,
          verification_provider: result.provider,
          verification_confidence: result.confidence,
          verification_response: result.extractedData,
          extracted_data: result.extractedData,
          verification_notes: `Verified but has discrepancies - manual review needed (confidence: ${result.confidence}%)`,
          document_number: docNumber,
        })
        .eq('id', document_id)

      logger.info(
        `Document ${document_id} verified with discrepancies, needs manual review for employee ${doc.employee_id}`
      )
    } else {
      // Verification failed
      await adminSupabase
        .from('employee_documents')
        .update({
          verification_method: result.method,
          verification_provider: result.provider,
          verification_confidence: 0,
          verification_response: { error: result.error },
          verification_notes: `Auto-verification failed: ${result.error}`,
          document_number: docNumber,
        })
        .eq('id', document_id)
    }

    return NextResponse.json({
      success: true,
      data: {
        verified: result.verified,
        auto_approved: result.autoApproved,
        confidence: result.confidence,
        method: result.method,
        provider: result.provider,
        masked_number: result.maskedNumber,
        extracted_data: result.extractedData,
        discrepancies: result.discrepancies,
        verification_status: result.autoApproved
          ? 'VERIFIED'
          : result.verified
            ? 'PENDING' // Needs manual review despite verification
            : 'PENDING', // Failed verification, stays pending
        message: result.autoApproved
          ? 'Document verified and auto-approved'
          : result.verified
            ? 'Document verified but has discrepancies - awaiting manual review'
            : `Verification failed: ${result.error}`,
      },
    })
  } catch (error) {
    logger.error('Error in POST /api/employees/documents/verify:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
