import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/crm/communications/history
 * Fetch communication logs for the authenticated CRO
 * Query params: page, limit, channel (email|sms|whatsapp), status, campaign, search
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify CRO or Super Admin role
    const { data: profile } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.subrole !== 'cro' && profile.role !== 'superadmin')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const channel = searchParams.get('channel') // email, sms, whatsapp
    const status = searchParams.get('status') // sent, failed, pending, scheduled
    const campaign = searchParams.get('campaign')
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    let query = supabase
      .from('crm_communications_log')
      .select('id, lead_id, contact_id, template_id, type, subject, message, recipient, recipient_name, status, sent_by, sent_at, campaign_name, created_at', { count: 'exact' })
      .eq('sent_by', user.id)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (channel) {
      query = query.eq('type', channel)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (campaign) {
      query = query.eq('campaign_name', campaign)
    }
    if (search) {
      query = query.or(`recipient_name.ilike.%${search}%,recipient.ilike.%${search}%`)
    }

    const { data: logs, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching communication history:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch communication history' }, { status: 500 })
    }

    // Compute analytics summary for the current CRO
    const { data: analyticsData } = await supabase
      .from('crm_communications_log')
      .select('status')
      .eq('sent_by', user.id)

    const analytics = {
      total: analyticsData?.length || 0,
      sent: analyticsData?.filter(l => l.status === 'sent').length || 0,
      delivered: analyticsData?.filter(l => l.status === 'delivered').length || 0,
      failed: analyticsData?.filter(l => l.status === 'failed').length || 0,
      pending: analyticsData?.filter(l => l.status === 'pending').length || 0,
      scheduled: analyticsData?.filter(l => l.status === 'scheduled').length || 0,
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      analytics,
      meta: {
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    })
  } catch (error) {
    apiLogger.error('Communication history error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
