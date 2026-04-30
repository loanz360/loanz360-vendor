import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/cro/agenda
 * Fetch today's agenda: followups, scheduled calls, unread chats, new contacts (24h)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

    // Parallel fetch all agenda items
    const [
      followupsResult,
      callLogsResult,
      unreadChatsResult,
      newContactsResult,
      newLeadsResult,
    ] = await Promise.all([
      // Today's follow-ups
      supabase
        .from('crm_followups')
        .select('id, lead_id, scheduled_at, purpose, status, created_at')
        .eq('created_by', userId)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .in('status', ['scheduled', 'pending'])
        .order('scheduled_at', { ascending: true })
        .limit(20),

      // Today's call logs (already done today)
      supabase
        .from('cro_call_logs')
        .select('id, customer_name, customer_phone, call_outcome, call_started_at, call_duration_seconds')
        .eq('cro_id', userId)
        .gte('call_started_at', todayStart.toISOString())
        .order('call_started_at', { ascending: true })
        .limit(50),

      // Unread chat conversations
      supabase
        .from('chat_conversations')
        .select('id, customer_name, customer_phone, unread_cro_count, last_message_preview, last_message_at')
        .eq('cro_id', userId)
        .eq('status', 'active')
        .gt('unread_cro_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(10),

      // New contacts assigned in last 24h
      supabase
        .from('crm_contacts')
        .select('id, full_name, phone, created_at')
        .eq('assigned_to', userId)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),

      // New leads assigned in last 24h
      supabase
        .from('crm_leads')
        .select('id, customer_name, phone, created_at, loan_type')
        .eq('assigned_cro_id', userId)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const followups = followupsResult.data || []
    const callLogs = callLogsResult.data || []
    const unreadChats = unreadChatsResult.data || []
    const newContacts = newContactsResult.data || []
    const newLeads = newLeadsResult.data || []

    // Build timeline items
    const timeline: Array<{
      id: string
      type: string
      title: string
      subtitle: string
      time: string
      status: string
      actionUrl?: string
    }> = []

    // Follow-ups
    followups.forEach(f => {
      timeline.push({
        id: f.id,
        type: 'followup',
        title: f.purpose || 'Follow-up scheduled',
        subtitle: `Lead ID: ${f.lead_id?.substring(0, 8)}...`,
        time: f.scheduled_at,
        status: f.status,
        actionUrl: `/employees/cro/ai-crm?tab=leads`,
      })
    })

    // Unread chats
    unreadChats.forEach(c => {
      timeline.push({
        id: c.id,
        type: 'chat',
        title: `${c.unread_cro_count} unread from ${c.customer_name}`,
        subtitle: c.last_message_preview || c.customer_phone,
        time: c.last_message_at || new Date().toISOString(),
        status: 'unread',
        actionUrl: `/employees/cro/chat`,
      })
    })

    // New contacts
    newContacts.forEach(c => {
      timeline.push({
        id: c.id,
        type: 'new_contact',
        title: `New contact: ${c.full_name}`,
        subtitle: c.phone || 'No phone',
        time: c.created_at,
        status: 'new',
        actionUrl: `/employees/cro/ai-crm?tab=contacts`,
      })
    })

    // New leads
    newLeads.forEach(l => {
      timeline.push({
        id: l.id,
        type: 'new_lead',
        title: `New lead: ${l.customer_name}`,
        subtitle: l.loan_type || 'No loan type',
        time: l.created_at,
        status: 'new',
        actionUrl: `/employees/cro/ai-crm?tab=leads`,
      })
    })

    // Sort by time
    timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    // Compute progress
    const totalTasks = followups.length + unreadChats.length + newContacts.length + newLeads.length
    const completedFollowups = followups.filter(f => f.status === 'completed').length
    const callsToday = callLogs.length
    const completedTasks = completedFollowups + callsToday

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTasks,
          completedTasks,
          pendingFollowups: followups.length - completedFollowups,
          callsToday,
          unreadMessages: unreadChats.reduce((sum, c) => sum + c.unread_cro_count, 0),
          newContacts: newContacts.length,
          newLeads: newLeads.length,
        },
        timeline,
        callLogs,
      },
    })
  } catch (error) {
    console.error('Error fetching agenda:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
