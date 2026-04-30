import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyCROAuth } from '@/lib/api/ai-crm-middleware'


/**
 * GET /api/cro/followups-upcoming?until=ISO_DATE
 * Returns upcoming follow-ups within the specified time window.
 * Used by browser notification system for 15-min reminders.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Verify CRO role via shared middleware
    const authResult = await verifyCROAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Default to next 24 hours if 'until' param not provided
    const untilParam = request.nextUrl.searchParams.get('until')
    const until = untilParam || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const now = new Date().toISOString()
    const userId = user.id

    // Fetch follow-ups owned by this CRO
    const { data: followups, error } = await supabase
      .from('crm_followups')
      .select(`
        id,
        scheduled_at,
        title,
        status,
        owner_id,
        lead:crm_leads!crm_followups_lead_id_fkey(customer_name, cro_id)
      `)
      .eq('owner_id', userId)
      .eq('status', 'Pending')
      .is('deleted_at', null)
      .gte('scheduled_at', now)
      .lte('scheduled_at', until)
      .order('scheduled_at', { ascending: true })
      .limit(10)

    // Also fetch follow-ups for leads assigned to this CRO but owned by others
    const { data: leadFollowups } = await supabase
      .from('crm_followups')
      .select(`
        id,
        scheduled_at,
        title,
        status,
        owner_id,
        lead:crm_leads!crm_followups_lead_id_fkey(customer_name, cro_id)
      `)
      .neq('owner_id', userId)
      .eq('status', 'Pending')
      .is('deleted_at', null)
      .gte('scheduled_at', now)
      .lte('scheduled_at', until)
      .order('scheduled_at', { ascending: true })
      .limit(10)

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 })
    }

    // Merge and filter: include lead followups where lead.cro_id matches
    const additionalFollowups = (leadFollowups || []).filter(f => {
      const lead = Array.isArray(f.lead) ? f.lead[0] : f.lead
      return lead?.cro_id === userId
    })

    const allFollowups = [...(followups || []), ...additionalFollowups]
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 10)

    // Flatten lead data
    const result = allFollowups.map(f => {
      const lead = Array.isArray(f.lead) ? f.lead[0] : f.lead
      return {
        id: f.id,
        scheduled_at: f.scheduled_at,
        title: f.title,
        customer_name: lead?.customer_name || 'Customer',
      }
    })

    const response = NextResponse.json({ success: true, data: result })
    response.headers.set('Cache-Control', 'private, max-age=30')
    return response
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
