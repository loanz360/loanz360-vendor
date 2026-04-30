import { parseBody } from '@/lib/utils/parse-body'
/**
 * API Route: Follow-up Automation
 * GET /api/automation/follow-ups - Get pending follow-ups
 * POST /api/automation/follow-ups - Schedule a follow-up
 * PATCH /api/automation/follow-ups - Complete a follow-up
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import {
  getPendingFollowUps,
  scheduleFollowUp,
  completeFollowUp,
  getTodaysFollowUps
} from '@/lib/automation/lead-follow-up'
import { apiLogger } from '@/lib/utils/logger'


interface FollowUpResponse {
  success: boolean
  data?: unknown
  error?: string
}

// GET - Retrieve pending follow-ups
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as FollowUpResponse,
        { status: 401 }
      )
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'my' // 'my', 'team', 'today', 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get employee info
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role, branch_id, territory_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let followUps = []

    if (view === 'today') {
      followUps = await getTodaysFollowUps()
    } else if (view === 'my' && employee) {
      const dateRange = startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined
      followUps = await getPendingFollowUps(employee.id, dateRange)
    } else {
      // For 'team' and 'all', query directly with appropriate filters
      let query = supabase
        .from('follow_up_schedules')
        .select('*')
        .eq('status', 'PENDING')
        .order('scheduled_date', { ascending: true })

      if (view === 'team' && employee) {
        // Get team members based on branch/territory
        const { data: teamMembers } = await supabase
          .from('employees')
          .select('id')
          .or(`branch_id.eq.${employee.branch_id},territory_id.eq.${employee.territory_id}`)

        if (teamMembers) {
          const memberIds = teamMembers.map(m => m.id)
          query = query.in('bde_id', memberIds)
        }
      }

      if (startDate) {
        query = query.gte('scheduled_date', startDate)
      }
      if (endDate) {
        query = query.lte('scheduled_date', endDate)
      }

      const { data } = await query
      followUps = data || []
    }

    // Get statistics
    const { count: pendingCount } = await supabase
      .from('follow_up_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .eq('bde_id', employee?.id || '')

    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('follow_up_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .gte('scheduled_date', today)
      .lt('scheduled_date', `${today}T23:59:59`)

    return NextResponse.json({
      success: true,
      data: {
        followUps,
        stats: {
          pending: pendingCount || 0,
          dueToday: todayCount || 0
        }
      }
    } as FollowUpResponse)
  } catch (error) {
    apiLogger.error('Follow-ups GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as FollowUpResponse,
      { status: 500 }
    )
  }
}

// POST - Schedule a new follow-up
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as FollowUpResponse,
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate required fields
    const requiredFields = ['leadId', 'leadNumber', 'customerName', 'customerMobile', 'bdeId', 'bdeName', 'scheduledDate', 'followUpType']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `${field} is required` } as FollowUpResponse,
          { status: 400 }
        )
      }
    }

    const result = await scheduleFollowUp(
      body.leadId,
      body.leadNumber,
      body.customerName,
      body.customerMobile,
      body.bdeId,
      body.bdeName,
      new Date(body.scheduledDate),
      body.followUpType,
      body.notes
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error } as FollowUpResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { scheduleId: result.scheduleId }
    } as FollowUpResponse)
  } catch (error) {
    apiLogger.error('Follow-ups POST error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as FollowUpResponse,
      { status: 500 }
    )
  }
}

// PATCH - Complete a follow-up
export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as FollowUpResponse,
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    if (!body.scheduleId || !body.outcome) {
      return NextResponse.json(
        { success: false, error: 'scheduleId and outcome are required' } as FollowUpResponse,
        { status: 400 }
      )
    }

    const nextFollowUpDate = body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : undefined

    const result = await completeFollowUp(
      body.scheduleId,
      body.outcome,
      nextFollowUpDate
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error } as FollowUpResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { completed: true }
    } as FollowUpResponse)
  } catch (error) {
    apiLogger.error('Follow-ups PATCH error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as FollowUpResponse,
      { status: 500 }
    )
  }
}
