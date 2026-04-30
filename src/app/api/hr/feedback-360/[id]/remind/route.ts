
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
      .select('id, status, employee_id, request_sent_at')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !feedbackReq) {
      return NextResponse.json({ success: false, error: 'Feedback request not found' }, { status: 404 })
    }

    if (!['PENDING', 'IN_PROGRESS'].includes(feedbackReq.status)) {
      return NextResponse.json({ success: false, error: 'Cannot send reminder for a completed or finalized cycle' }, { status: 400 })
    }

    // Rate limit: no more than one reminder per hour
    if (feedbackReq.request_sent_at) {
      const lastSent = new Date(feedbackReq.request_sent_at).getTime()
      const oneHourAgo = Date.now() - 60 * 60 * 1000
      if (lastSent > oneHourAgo) {
        const minutesLeft = Math.ceil((lastSent - oneHourAgo) / (60 * 1000))
        return NextResponse.json({
          success: false,
          error: `Reminder already sent recently. Please wait ${minutesLeft} minute(s) before sending another reminder.`,
        }, { status: 429 })
      }
    }

    const { error: updateErr } = await adminClient
      .from('feedback_360_requests')
      .update({ request_sent_at: new Date().toISOString() })
      .eq('id', id)

    if (updateErr) throw updateErr

    const { data: pendingResponses } = await adminClient
      .from('feedback_360_responses')
      .select('id, feedback_giver_id, relationship_to_employee')
      .eq('request_id', id)
      .eq('status', 'DRAFT')

    apiLogger.info('Feedback 360 reminder sent', {
      requestId: id,
      employeeId: feedbackReq.employee_id,
      pendingCount: pendingResponses?.length || 0,
    })

    return NextResponse.json({
      success: true,
      message: 'Reminder sent to ' + (pendingResponses?.length || 0) + ' pending reviewers',
      data: { pending_count: pendingResponses?.length || 0 },
    })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/feedback-360/[id]/remind', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
