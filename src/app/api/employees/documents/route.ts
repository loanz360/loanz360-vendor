
// =====================================================
// EMPLOYEE DOCUMENTS API
// GET: List employee documents
// DELETE: Delete document
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET: List all employee documents
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const verificationStatus = searchParams.get('verification_status')
    const currentOnly = searchParams.get('current_only') === 'true'

    // Build query
    let query = supabase
      .from('employee_documents')
      .select(`
        *,
        document_type:employee_document_types(*)
      `)
      .eq('employee_id', employee.id)

    if (category) {
      query = query.eq('document_type.category', category)
    }

    if (verificationStatus) {
      query = query.eq('verification_status', verificationStatus)
    }

    if (currentOnly) {
      query = query.eq('is_current', true)
    }

    query = query.order('created_at', { ascending: false })

    const { data: documents, error: docsError } = await query

    if (docsError) {
      apiLogger.error('Documents fetch error', docsError)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Get document type requirements
    const { data: documentTypes } = await supabase
      .from('employee_document_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Group documents by category
    const documentsByCategory = documents.reduce((acc: any, doc: any) => {
      const cat = doc.document_type?.category || 'OTHER'
      if (!acc[cat]) {
        acc[cat] = []
      }
      acc[cat].push(doc)
      return acc
    }, {})

    // Calculate completion stats
    const mandatoryTypes = documentTypes?.filter(dt => dt.is_mandatory) || []
    const uploadedMandatory = mandatoryTypes.filter(mt =>
      documents.some(doc => doc.document_type_id === mt.id && doc.is_current)
    )

    const completionPercentage = mandatoryTypes.length > 0
      ? Math.round((uploadedMandatory.length / mandatoryTypes.length) * 100)
      : 100

    // Find documents expiring soon
    const expiringDocs = documents.filter(doc => {
      if (!doc.expiry_date || !doc.is_current) return false
      const daysUntilExpiry = Math.ceil(
        (new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysUntilExpiry > 0 && daysUntilExpiry <= 90
    })

    return NextResponse.json({
      success: true,
      data: {
        documents,
        documentsByCategory,
        documentTypes,
        stats: {
          total: documents.length,
          current: documents.filter(d => d.is_current).length,
          pending: documents.filter(d => d.verification_status === 'PENDING').length,
          verified: documents.filter(d => d.verification_status === 'VERIFIED').length,
          rejected: documents.filter(d => d.verification_status === 'REJECTED').length,
          mandatory: mandatoryTypes.length,
          uploaded_mandatory: uploadedMandatory.length,
          completion_percentage: completionPercentage,
          expiring_soon: expiringDocs.length
        },
        expiringDocuments: expiringDocs
      }
    })
  } catch (error) {
    apiLogger.error('Documents GET Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Delete document
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { error: 'document id is required' },
        { status: 400 }
      )
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Verify document belongs to employee
    const { data: document } = await supabase
      .from('employee_documents')
      .select('id, employee_id, verification_status')
      .eq('id', documentId)
      .eq('employee_id', employee.id)
      .maybeSingle()

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 }
      )
    }

    // Don't allow deletion of verified documents
    if (document.verification_status === 'VERIFIED') {
      return NextResponse.json(
        { error: 'Cannot delete verified documents. Please contact HR.' },
        { status: 400 }
      )
    }

    // Soft delete (mark as inactive)
    const { error: deleteError } = await supabase
      .from('employee_documents')
      .update({ is_active: false, is_current: false })
      .eq('id', documentId)

    if (deleteError) {
      apiLogger.error('Delete error', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Documents DELETE Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
