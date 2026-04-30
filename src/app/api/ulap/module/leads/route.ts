
/**
 * API Route: ULAP Module - Leads List
 * GET /api/ulap/module/leads - Fetch leads for the status tab
 *
 * Returns leads submitted by the authenticated user based on source_type
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// Status mappings for progress calculation
const STATUS_PROGRESS: Record<string, number> = {
  PHASE_1_SUBMITTED: 10,
  NEW: 15,
  NEW_UNASSIGNED: 15,
  ASSIGNED: 20,
  CONTACTED: 30,
  DOC_COLLECTION: 40,
  DOC_COLLECTION_PENDING: 40,
  DOC_VERIFIED: 50,
  BANK_LOGIN: 60,
  BANK_PROCESSING: 70,
  SANCTIONED: 85,
  DISBURSED: 100,
  COMPLETED: 100,
  REJECTED: 0,
  DROPPED: 0,
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '20')
    const sourceType = searchParams.get('source_type')
    const sourceUserId = searchParams.get('source_user_id')
    const status = searchParams.get('status')
    const loanType = searchParams.get('loan_type')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Build query
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .eq('lead_generator_id', user.id) // Only show leads created by this user

    // Filter by source type if provided
    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    // Filter by status
    if (status) {
      query = query.eq('lead_status', status)
    }

    // Filter by loan type
    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    // Filter by date range
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Search filter
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_mobile.ilike.%${search}%,lead_number.ilike.%${search}%`)
    }

    // Apply pagination
    const offset = (page - 1) * pageSize
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    const { data: leads, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching leads', error)
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      )
    }

    // Transform leads for the frontend
    const transformedLeads = (leads || []).map((lead) => {
      // Calculate progress percentage
      const progressPercentage = STATUS_PROGRESS[lead.lead_status?.toUpperCase()] || 0

      return {
        id: lead.id,
        lead_id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        customer_mobile: lead.customer_mobile,
        loan_type: lead.loan_type || 'Not Specified',
        loan_type_display: formatLoanType(lead.loan_type),
        loan_amount: lead.loan_amount,
        lead_status: lead.lead_status,
        lead_status_display: formatStatus(lead.lead_status),
        form_status: lead.form_status,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        phase2_completed: lead.application_phase >= 2,
        assigned_bde_name: lead.assigned_bde_name,
        progress_percentage: progressPercentage,
      }
    })

    // Calculate total pages
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({
      leads: transformedLeads,
      total: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    })
  } catch (error) {
    apiLogger.error('Error in ULAP module leads API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Format loan type for display
function formatLoanType(loanType: string | null): string {
  if (!loanType) return 'Not Specified'

  const displayNames: Record<string, string> = {
    HOME_LOAN: 'Home Loan',
    PERSONAL_LOAN: 'Personal Loan',
    BUSINESS_LOAN: 'Business Loan',
    VEHICLE_LOAN: 'Vehicle Loan',
    EDUCATION_LOAN: 'Education Loan',
    GOLD_LOAN: 'Gold Loan',
    LAP: 'Loan Against Property',
    OTHER: 'Other',
  }

  return displayNames[loanType] || loanType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// Format status for display
function formatStatus(status: string | null): string {
  if (!status) return 'Unknown'

  const displayNames: Record<string, string> = {
    PHASE_1_SUBMITTED: 'Phase 1 Submitted',
    NEW: 'New',
    NEW_UNASSIGNED: 'Pending Assignment',
    ASSIGNED: 'Assigned',
    CONTACTED: 'Contacted',
    DOC_COLLECTION: 'Document Collection',
    DOC_COLLECTION_PENDING: 'Docs Pending',
    DOC_VERIFIED: 'Docs Verified',
    BANK_LOGIN: 'Bank Login',
    BANK_PROCESSING: 'Processing',
    SANCTIONED: 'Sanctioned',
    DISBURSED: 'Disbursed',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    DROPPED: 'Dropped',
  }

  return displayNames[status] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
