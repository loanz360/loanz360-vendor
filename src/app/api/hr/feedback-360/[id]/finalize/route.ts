
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const { id } = await params
    if (!id) return NextResponse.json({ success: false, error: 'Request ID is required' }, { status: 400 })

    const { data: feedbackReq, error: fetchErr } = await adminClient
      .from('feedback_360_requests')
      .select('id, status, employee_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !feedbackReq) {
      return NextResponse.json({ success: false, error: 'Feedback request not found' }, { status: 404 })
    }

    if (feedbackReq.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Feedback cycle is already finalized' }, { status: 400 })
    }

    const { data: responses } = await adminClient
      .from('feedback_360_responses')
      .select('id, status, overall_rating, relationship_to_employee')
      .eq('request_id', id)

    const allResponses = responses || []
    const submitted = allResponses.filter((r: Record<string, unknown>) => r.status === 'SUBMITTED')
    const pending = allResponses.filter((r: Record<string, unknown>) => r.status !== 'SUBMITTED')

    if (submitted.length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Cannot finalize: at least 3 submitted responses required. Currently have ' + submitted.length + '.',
      }, { status: 400 })
    }

    if (pending.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot finalize: ${pending.length} reviewer(s) have not yet submitted their feedback. All reviewers must submit before finalizing.`,
        data: { pending_count: pending.length, submitted_count: submitted.length, total: allResponses.length },
      }, { status: 400 })
    }

    const avgRating = submitted.reduce((s: number, r: unknown) => s + (r.overall_rating || 0), 0) / submitted.length

    const { error: updateErr } = await adminClient
      .from('feedback_360_requests')
      .update({
        status: 'COMPLETED',
        finalized_at: new Date().toISOString(),
        finalized_by: user.id,
        aggregate_score: Math.round(avgRating * 100) / 100,
      })
      .eq('id', id)

    if (updateErr) throw updateErr

    apiLogger.info('Feedback 360 cycle finalized', {
      requestId: id,
      employeeId: feedbackReq.employee_id,
      submittedCount: submitted.length,
      avgRating: Math.round(avgRating * 100) / 100,
    })

    return NextResponse.json({
      success: true,
      message: 'Feedback cycle finalized successfully',
      data: {
        submitted_count: submitted.length,
        aggregate_score: Math.round(avgRating * 100) / 100,
      },
    })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/feedback-360/[id]/finalize', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
