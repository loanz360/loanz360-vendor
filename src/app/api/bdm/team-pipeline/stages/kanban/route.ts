
/**
 * BDM Team Pipeline - Kanban Board API
 * GET /api/bdm/team-pipeline/stages/kanban
 *
 * Returns leads grouped by pipeline stage for Kanban board visualization
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds, getBDEsByIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

const STAGE_COLUMNS = [
  { status: 'NEW', label: 'New Leads', color: '#3B82F6', order: 1 },
  { status: 'CONTACTED', label: 'Contacted', color: '#6366F1', order: 3 },
  { status: 'DOCUMENTS_PENDING', label: 'Documents Pending', color: '#8B5CF6', order: 4 },
  { status: 'DOCUMENTS_SUBMITTED', label: 'Documents Submitted', color: '#A855F7', order: 5 },
  { status: 'UNDER_REVIEW', label: 'Under Review', color: '#D946EF', order: 6 },
  { status: 'APPROVED', label: 'Approved', color: '#10B981', order: 7 },
  { status: 'DISBURSED', label: 'Disbursed', color: '#059669', order: 8 },
  { status: 'REJECTED', label: 'Rejected', color: '#EF4444', order: 10 },
] as const

type LeadStatus = typeof STAGE_COLUMNS[number]['status']

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
    const searchQuery = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'priority' // priority, amount, days_in_stage, customer_name
    const filterPriority = searchParams.get('priority')?.split(',').filter(Boolean) || []
    const filterBankIds = searchParams.get('bankIds')?.split(',').filter(Boolean) || []

    // 3. Get BDEs under this BDM
    const allBDEIds = await getBDEIds(bdmId)
    const bdeIds = bdeIdsParam && bdeIdsParam.length > 0 ? bdeIdsParam : allBDEIds

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          columns: STAGE_COLUMNS.map(col => ({ ...col, leads: [], count: 0, totalValue: 0 })),
          totalLeads: 0,
          totalValue: 0,
        },
      })
    }

    // 4. Get BDE details for mapping
    const bdes = await getBDEsByIds(bdeIds)
    const bdeMap = new Map(bdes.map(bde => [bde.id, bde]))

    // 5. Get date range (for filtering by created_at or updated_at if needed)
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 6. Build query for leads
    let query = supabase
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
        documents_count
      `)
      .in('assigned_to', bdeIds)
      .order('priority', { ascending: false })

    // Apply search filter if provided
    if (searchQuery) {
      query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,customer_email.ilike.%${searchQuery}%`)
    }

    // Apply priority filter if provided
    if (filterPriority.length > 0) {
      query = query.in('priority', filterPriority)
    }

    // Apply bank filter if provided
    if (filterBankIds.length > 0) {
      query = query.in('bank_id', filterBankIds)
    }

    const { data: leads, error } = await query

    if (error) {
      apiLogger.error('[Kanban API] Error fetching leads', error)
      throw new Error(`Failed to fetch leads: ${error.message}`)
    }

    // 7. Group leads by stage
    const leadsByStage = new Map<LeadStatus, any[]>()
    STAGE_COLUMNS.forEach(col => {
      leadsByStage.set(col.status, [])
    })

    leads?.forEach(lead => {
      const stageLeads = leadsByStage.get(lead.status as LeadStatus)
      if (stageLeads) {
        const bde = bdeMap.get(lead.assigned_to)

        // Build lead card data
        const leadCard = {
          id: lead.id,
          customerName: lead.customer_name,
          customerPhone: lead.customer_phone,
          customerEmail: lead.customer_email,
          loanType: lead.loan_type,
          loanAmount: lead.loan_amount,
          formattedAmount: formatCurrency(lead.loan_amount || 0),
          status: lead.status,
          priority: lead.priority,
          priorityLabel: getPriorityLabel(lead.priority),
          priorityColor: getPriorityColor(lead.priority),
          assignedTo: lead.assigned_to,
          bdeName: bde?.full_name || 'Unassigned',
          bdeAvatar: bde?.avatar_url || null,
          bankId: lead.bank_id,
          bankName: lead.bank_name,
          daysInStage: lead.days_in_current_stage || 0,
          lastActivityAt: lead.last_activity_at,
          createdAt: lead.created_at,
          updatedAt: lead.updated_at,
          notesCount: lead.notes_count || 0,
          documentsCount: lead.documents_count || 0,
          isStale: lead.days_in_current_stage > 7,
          isUrgent: lead.priority === 'CRITICAL' || lead.priority === 'HIGH',
        }

        stageLeads.push(leadCard)
      }
    })

    // 8. Sort leads within each stage
    leadsByStage.forEach((stageLeads, status) => {
      stageLeads.sort((a, b) => {
        switch (sortBy) {
          case 'priority':
            return getPriorityWeight(b.priority) - getPriorityWeight(a.priority)
          case 'amount':
            return (b.loanAmount || 0) - (a.loanAmount || 0)
          case 'days_in_stage':
            return b.daysInStage - a.daysInStage
          case 'customer_name':
            return a.customerName.localeCompare(b.customerName)
          default:
            return 0
        }
      })
    })

    // 9. Build response with stage columns
    const columns = STAGE_COLUMNS.map(col => {
      const stageLeads = leadsByStage.get(col.status) || []
      const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.loanAmount || 0), 0)

      return {
        status: col.status,
        label: col.label,
        color: col.color,
        order: col.order,
        leads: stageLeads,
        count: stageLeads.length,
        totalValue,
        formattedTotalValue: formatCurrency(totalValue),
        criticalCount: stageLeads.filter(l => l.priority === 'CRITICAL').length,
        highCount: stageLeads.filter(l => l.priority === 'HIGH').length,
        staleCount: stageLeads.filter(l => l.isStale).length,
      }
    })

    // 10. Calculate totals
    const totalLeads = leads?.length || 0
    const totalValue = leads?.reduce((sum, lead) => sum + (lead.loan_amount || 0), 0) || 0

    // 11. Get stage statistics
    const stageStats = {
      newLeads: columns.find(c => c.status === 'NEW')?.count || 0,
      inProgress: columns.filter(c => ['CONTACTED', 'DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).reduce((sum, c) => sum + c.count, 0),
      approved: columns.find(c => c.status === 'APPROVED')?.count || 0,
      disbursed: columns.find(c => c.status === 'DISBURSED')?.count || 0,
      rejected: columns.find(c => c.status === 'REJECTED')?.count || 0,
    }

    // 12. Return response
    return NextResponse.json({
      success: true,
      data: {
        columns,
        totalLeads,
        totalValue,
        formattedTotalValue: formatCurrency(totalValue),
        stageStats,
        filters: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
          bdeIds,
          search: searchQuery,
          priority: filterPriority,
          bankIds: filterBankIds,
          sortBy,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Kanban API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch kanban data',
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

function getPriorityWeight(priority: string): number {
  const weights: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  }
  return weights[priority] || 2
}
