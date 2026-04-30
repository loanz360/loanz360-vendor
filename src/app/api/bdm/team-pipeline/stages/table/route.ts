
/**
 * BDM Team Pipeline - Table View API
 * GET /api/bdm/team-pipeline/stages/table
 *
 * Returns leads in table format with sorting, filtering, and pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds, getBDEsByIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)
    const bdeIdsParam = searchParams.get('bdeIds')?.split(',').filter(Boolean)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filters
    const searchQuery = searchParams.get('search') || ''
    const filterStatus = searchParams.get('status')?.split(',').filter(Boolean) || []
    const filterPriority = searchParams.get('priority')?.split(',').filter(Boolean) || []
    const filterBankIds = searchParams.get('bankIds')?.split(',').filter(Boolean) || []
    const filterLoanTypes = searchParams.get('loanTypes')?.split(',').filter(Boolean) || []

    // 3. Get BDEs under this BDM
    const allBDEIds = await getBDEIds(bdmId)
    const bdeIds = bdeIdsParam && bdeIdsParam.length > 0 ? bdeIdsParam : allBDEIds

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          leads: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      })
    }

    // 4. Get BDE details for mapping
    const bdes = await getBDEsByIds(bdeIds)
    const bdeMap = new Map(bdes.map(bde => [bde.id, bde]))

    // 5. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 6. Build base query (for count)
    let countQuery = supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('assigned_to', bdeIds)

    // Apply filters to count query
    if (searchQuery) {
      countQuery = countQuery.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,customer_email.ilike.%${searchQuery}%`)
    }
    if (filterStatus.length > 0) {
      countQuery = countQuery.in('status', filterStatus)
    }
    if (filterPriority.length > 0) {
      countQuery = countQuery.in('priority', filterPriority)
    }
    if (filterBankIds.length > 0) {
      countQuery = countQuery.in('bank_id', filterBankIds)
    }
    if (filterLoanTypes.length > 0) {
      countQuery = countQuery.in('loan_type', filterLoanTypes)
    }

    // 7. Get total count
    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      apiLogger.error('[Table API] Error counting leads', countError)
      throw new Error(`Failed to count leads: ${countError.message}`)
    }

    const total = totalCount || 0
    const totalPages = Math.ceil(total / limit)

    // 8. Build data query with pagination and sorting
    let dataQuery = supabase
      .from('leads')
      .select(`
        id,
        customer_name,
        customer_phone,
        customer_email,
        loan_type,
        loan_amount,
        status,
        priority,
        assigned_to,
        bank_id,
        bank_name,
        days_in_current_stage,
        last_activity_at,
        created_at,
        updated_at,
        notes_count,
        documents_count,
        expected_disbursement_date
      `)
      .in('assigned_to', bdeIds)
      .range(offset, offset + limit - 1)

    // Apply filters
    if (searchQuery) {
      dataQuery = dataQuery.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,customer_email.ilike.%${searchQuery}%`)
    }
    if (filterStatus.length > 0) {
      dataQuery = dataQuery.in('status', filterStatus)
    }
    if (filterPriority.length > 0) {
      dataQuery = dataQuery.in('priority', filterPriority)
    }
    if (filterBankIds.length > 0) {
      dataQuery = dataQuery.in('bank_id', filterBankIds)
    }
    if (filterLoanTypes.length > 0) {
      dataQuery = dataQuery.in('loan_type', filterLoanTypes)
    }

    // Apply sorting
    const isAscending = sortOrder === 'asc'
    dataQuery = dataQuery.order(sortBy, { ascending: isAscending })

    const { data: leads, error: dataError } = await dataQuery

    if (dataError) {
      apiLogger.error('[Table API] Error fetching leads', dataError)
      throw new Error(`Failed to fetch leads: ${dataError.message}`)
    }

    // 9. Transform leads for table display
    const tableRows = leads?.map(lead => {
      const bde = bdeMap.get(lead.assigned_to)

      return {
        id: lead.id,
        customerName: lead.customer_name,
        customerPhone: lead.customer_phone,
        customerEmail: lead.customer_email,
        loanType: lead.loan_type,
        loanTypeLabel: getLoanTypeLabel(lead.loan_type),
        loanAmount: lead.loan_amount,
        formattedAmount: formatCurrency(lead.loan_amount || 0),
        status: lead.status,
        statusLabel: getStatusLabel(lead.status),
        statusColor: getStatusColor(lead.status),
        priority: lead.priority,
        priorityLabel: getPriorityLabel(lead.priority),
        priorityColor: getPriorityColor(lead.priority),
        assignedTo: lead.assigned_to,
        bdeName: bde?.full_name || 'Unassigned',
        bdeEmail: bde?.email || null,
        bdeAvatar: bde?.avatar_url || null,
        bankId: lead.bank_id,
        bankName: lead.bank_name || 'Not specified',
        daysInStage: lead.days_in_current_stage || 0,
        lastActivityAt: lead.last_activity_at,
        lastActivityFormatted: lead.last_activity_at ? formatRelativeTime(lead.last_activity_at) : 'No activity',
        createdAt: lead.created_at,
        createdAtFormatted: formatDate(lead.created_at),
        updatedAt: lead.updated_at,
        updatedAtFormatted: formatRelativeTime(lead.updated_at),
        notesCount: lead.notes_count || 0,
        documentsCount: lead.documents_count || 0,
        expectedDisbursementDate: lead.expected_disbursement_date,
        expectedDisbursementFormatted: lead.expected_disbursement_date ? formatDate(lead.expected_disbursement_date) : null,
        isStale: (lead.days_in_current_stage || 0) > 7,
        isUrgent: lead.priority === 'CRITICAL' || lead.priority === 'HIGH',
        hasRecentActivity: lead.last_activity_at ? isWithinDays(lead.last_activity_at, 2) : false,
      }
    }) || []

    // 10. Calculate summary statistics
    const summary = {
      totalLeads: total,
      displayedLeads: tableRows.length,
      totalValue: tableRows.reduce((sum, row) => sum + (row.loanAmount || 0), 0),
      avgLoanAmount: tableRows.length > 0 ? tableRows.reduce((sum, row) => sum + (row.loanAmount || 0), 0) / tableRows.length : 0,
      criticalCount: tableRows.filter(row => row.priority === 'CRITICAL').length,
      highCount: tableRows.filter(row => row.priority === 'HIGH').length,
      staleCount: tableRows.filter(row => row.isStale).length,
      urgentCount: tableRows.filter(row => row.isUrgent).length,
    }

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        leads: tableRows,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
          bdeIds,
          search: searchQuery,
          status: filterStatus,
          priority: filterPriority,
          bankIds: filterBankIds,
          loanTypes: filterLoanTypes,
          sortBy,
          sortOrder,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Table API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch table data',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

function getLoanTypeLabel(loanType: string): string {
  const labels: Record<string, string> = {
    HOME_LOAN: 'Home Loan',
    PERSONAL_LOAN: 'Personal Loan',
    BUSINESS_LOAN: 'Business Loan',
    CAR_LOAN: 'Car Loan',
    EDUCATION_LOAN: 'Education Loan',
    GOLD_LOAN: 'Gold Loan',
    LAP: 'Loan Against Property',
  }
  return labels[loanType] || loanType
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'New Lead',
    CONTACTED: 'Contacted',
    DOCUMENTS_PENDING: 'Documents Pending',
    DOCUMENTS_SUBMITTED: 'Documents Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    DISBURSED: 'Disbursed',
    REJECTED: 'Rejected',
    ON_HOLD: 'On Hold',
    CANCELLED: 'Cancelled',
  }
  return labels[status] || status
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: '#3B82F6',
    CONTACTED: '#6366F1',
    DOCUMENTS_PENDING: '#8B5CF6',
    DOCUMENTS_SUBMITTED: '#A855F7',
    UNDER_REVIEW: '#D946EF',
    APPROVED: '#10B981',
    DISBURSED: '#059669',
    REJECTED: '#EF4444',
    ON_HOLD: '#F59E0B',
    CANCELLED: '#6B7280',
  }
  return colors[status] || '#3B82F6'
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  }
  return labels[priority] || 'Medium'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    CRITICAL: '#DC2626',
    HIGH: '#F59E0B',
    MEDIUM: '#3B82F6',
    LOW: '#6B7280',
  }
  return colors[priority] || '#3B82F6'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`

  return formatDate(dateString)
}

function isWithinDays(dateString: string, days: number): boolean {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / 86400000
  return diffDays <= days
}
