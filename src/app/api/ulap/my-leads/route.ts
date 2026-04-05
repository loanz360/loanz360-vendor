export const dynamic = 'force-dynamic'

/**
 * API Route: ULAP My Leads
 * GET /api/ulap/my-leads - Get all leads submitted by the logged-in user
 *
 * FIXED: C5 (search sanitization), H1 (rate limiting), H4 (loan_amount column),
 * H10 (aggregate stats), M9 (limit cap), M10 (page validation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

export async function GET(request: NextRequest) {
  try {
    // H1 FIX: Add rate limiting
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    // M10 FIX: Validate page parameter
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    // M9 FIX: Cap limit at 100
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 100)
    const offset = (page - 1) * limit

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Build query for leads created by this user
    // H4 FIX: Select both loan_amount and required_loan_amount, use COALESCE logic client-side
    let query = supabase
      .from('leads')
      .select(`
        id,
        lead_number,
        customer_name,
        customer_mobile,
        customer_email,
        customer_city,
        loan_type,
        loan_category_code,
        loan_subcategory_code,
        loan_amount,
        required_loan_amount,
        form_status,
        lead_status,
        application_phase,
        form_completion_percentage,
        short_link,
        short_code,
        source_type,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('lead_generator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status) {
      query = query.eq('form_status', status)
    }

    // C5 FIX: Sanitize search input to prevent PostgREST filter injection
    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`lead_number.ilike.%${safeSearch}%,customer_name.ilike.%${safeSearch}%,customer_mobile.ilike.%${safeSearch}%`)
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: leads, error: fetchError, count } = await query

    if (fetchError) {
      apiLogger.error('Error fetching leads', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leads' },
        { status: 500 }
      )
    }

    // H4 FIX: Normalize loan_amount — use required_loan_amount as fallback
    const normalizedLeads = (leads || []).map((lead: Record<string, unknown>) => ({
      ...lead,
      loan_amount: (lead.loan_amount as number) || (lead.required_loan_amount as number) || null,
    }))

    // H10 FIX: Use aggregate count queries instead of fetching all rows
    const statsPromises = [
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_generator_id', user.id).eq('is_active', true),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_generator_id', user.id).eq('is_active', true).eq('form_status', 'PHASE_1_SUBMITTED'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_generator_id', user.id).eq('is_active', true).eq('form_status', 'PHASE_2_IN_PROGRESS'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_generator_id', user.id).eq('is_active', true).eq('form_status', 'PHASE_2_SUBMITTED'),
    ]

    const [totalResult, phase1Result, phase2InProgressResult, phase2SubmittedResult] = await Promise.all(statsPromises)

    const statusCounts = {
      total: totalResult.count || 0,
      phase_1_submitted: phase1Result.count || 0,
      phase_2_in_progress: phase2InProgressResult.count || 0,
      phase_2_submitted: phase2SubmittedResult.count || 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        leads: normalizedLeads,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats: statusCounts,
      },
    })
  } catch (error) {
    apiLogger.error('Error in ULAP my-leads API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
