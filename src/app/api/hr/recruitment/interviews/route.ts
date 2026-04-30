import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidate_id')
    const status = searchParams.get('status')
    const parsedPage = parseInt(searchParams.get('page') || '1')
    const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage)
    const pageSize = 50
    const from = (page - 1) * pageSize

    let query = adminClient
      .from('interview_schedules')
      .select('*', { count: 'exact' })
      .order('scheduled_at', { ascending: true })

    if (candidateId) query = query.eq('candidate_id', candidateId)
    if (status) query = query.eq('status', status)

    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error
    const totalCount = count || 0
    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
    })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/recruitment/interviews', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const bodySchema = z.object({


      candidate_id: z.string().uuid(),


      interview_type: z.string().optional(),


      scheduled_at: z.string(),


      interviewer_name: z.string().optional(),


      location: z.string().optional(),


      notes: z.string().optional(),


      id: z.string().uuid(),


      status: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { candidate_id, interview_type, scheduled_at, interviewer_name, location, notes } = body
    if (!candidate_id) return NextResponse.json({ success: false, error: 'Candidate ID required' }, { status: 400 })
    if (!scheduled_at) return NextResponse.json({ success: false, error: 'Scheduled time required' }, { status: 400 })

    // Validate interview date is in the future
    const scheduledDate = new Date(scheduled_at)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format for scheduled_at' }, { status: 400 })
    }
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ success: false, error: 'Interview must be scheduled in the future' }, { status: 400 })
    }

    // Check for interviewer conflicts (same interviewer at overlapping time, within 1 hour window)
    if (interviewer_name) {
      const windowStart = new Date(scheduledDate.getTime() - 60 * 60 * 1000).toISOString()
      const windowEnd = new Date(scheduledDate.getTime() + 60 * 60 * 1000).toISOString()
      const { data: conflicts } = await adminClient
        .from('interview_schedules')
        .select('id, candidate_id, scheduled_at')
        .eq('interviewer_name', interviewer_name)
        .eq('status', 'scheduled')
        .gte('scheduled_at', windowStart)
        .lte('scheduled_at', windowEnd)

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Interviewer "${interviewer_name}" already has an interview scheduled within 1 hour of this time slot`
        }, { status: 409 })
      }
    }

    const { data, error } = await adminClient
      .from('interview_schedules')
      .insert({
        candidate_id,
        interview_type: interview_type || 'technical',
        scheduled_at,
        interviewer_name: interviewer_name || null,
        location: location || null,
        notes: notes || null,
        status: 'scheduled',
        scheduled_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/recruitment/interviews', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const bodySchema2 = z.object({


      status: z.string().optional(),


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id } = body
    if (!id) return NextResponse.json({ success: false, error: 'Interview ID required' }, { status: 400 })

    const allowedFields = ['status', 'feedback', 'interview_type', 'scheduled_at', 'interviewer_name', 'location', 'notes', 'rating', 'result']
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in body) updatePayload[key] = body[key]
    }
    if (body.status === 'completed') updatePayload.completed_at = new Date().toISOString()

    const { data, error } = await adminClient
      .from('interview_schedules')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/recruitment/interviews', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
