
/**
 * Unified CRM Leads API
 * Queries the single `leads` table for all lead data
 * Returns normalized lead data for the Super Admin unified CRM view
 *
 * The `leads` table is the single source of truth for:
 * - ULAP submissions (Phase 1 + Phase 2)
 * - Partner-submitted leads
 * - BDE-assigned leads in pipeline
 * - CAM processing leads
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import type {
  NormalizedLead,
  UnifiedCRMLeadsResponse,
  UnifiedCRMStats,
} from '@/types/unified-crm.types'
import {
  getSourceDisplay,
  getStatusDisplay,
} from '@/types/unified-crm.types'
import { apiLogger } from '@/lib/utils/logger'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'

/**
 * Normalize a lead record to NormalizedLead format
 */
function normalizeLead(lead: Record<string, unknown>): NormalizedLead {
  const sourceType = (lead.source_type as string) || 'UNKNOWN'
  const status = (lead.lead_status as string) || 'NEW'

  return {
    id: lead.id as string,
    lead_number: (lead.lead_number as string) || `UL-${(lead.id as string).slice(0, 8)}`,
    data_source: 'leads',
    original_id: lead.id as string,
    original_table: 'leads',

    // Customer Info
    customer_name: (lead.customer_name as string) || 'Unknown',
    customer_mobile: (lead.customer_mobile as string) || '',
    customer_email: lead.customer_email as string | null,
    customer_city: lead.customer_city as string | null,
    customer_state: lead.customer_state as string | null,

    // Loan Details
    loan_type: (lead.loan_type as string) || 'Not Specified',
    loan_amount: lead.loan_amount as number | null,
    loan_category: lead.loan_category_code as string | null,
    loan_subcategory: lead.loan_subcategory_code as string | null,

    // Source Attribution
    source_type: sourceType,
    source_display: getSourceDisplay(sourceType),
    partner_id: lead.source_partner_id as string | null,
    partner_name: lead.source_partner_name as string | null,
    lead_generator_id: lead.lead_generator_id as string | null,
    lead_generator_name: lead.lead_generator_name as string | null,

    // Status
    status: status,
    status_display: getStatusDisplay(status),
    form_status: lead.form_status as string | null,
    cam_status: lead.cam_status as string | null,
    application_phase: lead.application_phase as number | undefined,

    // BDE Assignment
    assigned_bde_id: lead.assigned_bde_id as string | null,
    assigned_bde_name: lead.assigned_bde_name as string | null,
    assigned_at: lead.assigned_at as string | null,

    // Form Progress
    form_completion_percentage: lead.form_completion_percentage as number | null,

    // Priority
    priority_level: lead.lead_priority as string | null,
    lead_score: lead.lead_score as number | null,

    // Outcome
    outcome: lead.outcome as string | null,
    outcome_at: lead.outcome_at as string | null,

    // Financial
    sanctioned_amount: lead.sanctioned_amount as number | null,
    disbursed_amount: lead.disbursed_amount as number | null,

    // CAM Info
    cam_credit_score: lead.cam_credit_score as number | null,
    cam_risk_grade: lead.cam_risk_grade as string | null,
    cam_eligible_amount: lead.cam_eligible_amount as number | null,

    // Timestamps
    created_at: lead.created_at as string,
    updated_at: lead.updated_at as string,

    // Metadata
    collected_data: lead.collected_data as Record<string, unknown> | null,
    tags: lead.tags as string[] | null,
    remarks: lead.remarks as string | null,
  }
}

/**
 * GET /api/superadmin/unified-crm/leads
 * Fetch leads from the unified leads table with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// SECURITY FIX C1: Add authentication check
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Parse parameters
    const sourceType = searchParams.get('source_type')
    const status = searchParams.get('status')
    const camStatus = searchParams.get('cam_status')
    const outcome = searchParams.get('outcome')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const assignedBdeId = searchParams.get('assigned_bde_id')
    const leadGeneratorId = searchParams.get('lead_generator_id')
    const applicationPhase = searchParams.get('application_phase')
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const offset = (page - 1) * limit
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    // Build query
    let query = supabase
      .from('leads')
      .select(
        `
        id,
        lead_number,
        source_type,
        lead_generator_id,
        lead_generator_name,
        lead_generator_role,
        source_partner_id,
        source_partner_code,
        source_partner_name,
        customer_name,
        customer_mobile,
        customer_email,
        customer_city,
        customer_state,
        loan_type,
        loan_category_code,
        loan_subcategory_code,
        loan_amount,
        form_status,
        application_phase,
        form_completion_percentage,
        cam_required,
        cam_status,
        cam_credit_score,
        cam_risk_grade,
        cam_eligible_amount,
        lead_status,
        lead_priority,
        lead_score,
        lead_quality,
        assigned_bde_id,
        assigned_bde_name,
        assigned_at,
        outcome,
        outcome_at,
        sanctioned_amount,
        disbursed_amount,
        collected_data,
        tags,
        remarks,
        created_at,
        updated_at,
        is_active
      `,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply filters
    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    if (status) {
      query = query.eq('lead_status', status)
    }

    if (camStatus) {
      query = query.eq('cam_status', camStatus)
    }

    if (outcome) {
      query = query.eq('outcome', outcome)
    }

    if (applicationPhase) {
      query = query.eq('application_phase', parseInt(applicationPhase))
    }

    if (search) {
      const sanitizedSearch = search.replace(/[%_'";\\]/g, '')
      query = query.or(
        `customer_name.ilike.%${sanitizedSearch}%,customer_mobile.ilike.%${sanitizedSearch}%,lead_number.ilike.%${sanitizedSearch}%`
      )
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    if (assignedBdeId) {
      query = query.eq('assigned_bde_id', assignedBdeId)
    }

    if (leadGeneratorId) {
      query = query.eq('lead_generator_id', leadGeneratorId)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: leads, count: totalCount, error } = await query

    if (error) {
      apiLogger.error('Error fetching leads', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 })
    }

    // Normalize leads
    const normalizedLeads = (leads || []).map(normalizeLead)

    // Calculate stats
    const stats = await calculateStats(supabase)

    const response: UnifiedCRMLeadsResponse = {
      leads: normalizedLeads,
      total: totalCount || 0,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      stats,
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in unified CRM leads API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Calculate statistics from the leads table
 */
async function calculateStats(supabase: ReturnType<typeof createSupabaseAdmin>): Promise<UnifiedCRMStats> {
  const stats: UnifiedCRMStats = {
    total_leads: 0,
    by_source: {},
    by_status: {},
    by_table: { partner_leads: 0, unified_leads: 0 }, // Legacy - kept for compatibility
    by_outcome: { disbursed: 0, rejected: 0, dropped: 0, in_progress: 0 },
    by_phase: { phase_0: 0, phase_1: 0, phase_2: 0, cam: 0, bde: 0 },
    by_cam_status: { not_required: 0, pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 },
    financial: { total_loan_amount: 0, total_sanctioned: 0, total_disbursed: 0 },
    today_new_leads: 0,
    this_week_leads: 0,
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoISO = weekAgo.toISOString()

  // Get all leads for stats (limited to active leads)
  const { data: leadsData } = await supabase
    .from('leads')
    .select(`
      source_type,
      lead_status,
      cam_status,
      outcome,
      application_phase,
      loan_amount,
      sanctioned_amount,
      disbursed_amount,
      created_at
    `)
    .eq('is_active', true)

  if (leadsData) {
    leadsData.forEach((lead) => {
      stats.total_leads++

      // Count by source
      const source = lead.source_type || 'UNKNOWN'
      stats.by_source[source] = (stats.by_source[source] || 0) + 1

      // Count by status
      const status = lead.lead_status || 'UNKNOWN'
      stats.by_status[status] = (stats.by_status[status] || 0) + 1

      // Count by outcome
      if (lead.outcome === 'DISBURSED') {
        stats.by_outcome!.disbursed++
      } else if (lead.outcome === 'REJECTED') {
        stats.by_outcome!.rejected++
      } else if (lead.outcome === 'DROPPED') {
        stats.by_outcome!.dropped++
      } else {
        stats.by_outcome!.in_progress++
      }

      // Count by phase
      const phase = lead.application_phase || 0
      if (phase === 0) stats.by_phase!.phase_0++
      else if (phase === 1) stats.by_phase!.phase_1++
      else if (phase === 2) stats.by_phase!.phase_2++
      else if (status.startsWith('CAM_')) stats.by_phase!.cam++
      else stats.by_phase!.bde++

      // Count by CAM status
      const camStatus = (lead.cam_status || 'NOT_REQUIRED').toUpperCase()
      if (camStatus === 'NOT_REQUIRED') stats.by_cam_status!.not_required++
      else if (camStatus === 'PENDING') stats.by_cam_status!.pending++
      else if (camStatus === 'PROCESSING') stats.by_cam_status!.processing++
      else if (camStatus === 'COMPLETED') stats.by_cam_status!.completed++
      else if (camStatus === 'FAILED') stats.by_cam_status!.failed++
      else if (camStatus === 'SKIPPED') stats.by_cam_status!.skipped++

      // Financial
      if (lead.loan_amount) {
        stats.financial!.total_loan_amount += lead.loan_amount
      }
      if (lead.sanctioned_amount) {
        stats.financial!.total_sanctioned += lead.sanctioned_amount
      }
      if (lead.disbursed_amount) {
        stats.financial!.total_disbursed += lead.disbursed_amount
      }

      // Today's leads
      if (lead.created_at >= todayISO) {
        stats.today_new_leads++
      }

      // This week's leads
      if (lead.created_at >= weekAgoISO) {
        stats.this_week_leads++
      }
    })
  }

  // For backward compatibility, map to legacy table counts
  // ULAP leads are counted as "partner_leads", BDE pipeline as "unified_leads"
  const ulapCount = Object.entries(stats.by_source)
    .filter(([key]) => key.startsWith('ULAP_'))
    .reduce((sum, [_, count]) => sum + count, 0)

  stats.by_table.partner_leads = ulapCount
  stats.by_table.unified_leads = stats.total_leads - ulapCount

  return stats
}
