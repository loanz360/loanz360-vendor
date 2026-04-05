/**
 * SLA Monitoring System for Partner Support Tickets
 * Runs periodically to check SLA deadlines and send alerts
 */

import { createClient } from '@/lib/supabase/server'
import { notifySLAWarning, notifySLABreach } from '@/lib/notifications/ticket-notifications'

/**
 * Check tickets approaching SLA deadline (80% of time elapsed)
 * Should run every 15 minutes
 */
export async function checkSLAWarnings() {
  const supabase = await createClient()

  try {
    const now = new Date()

    // Get all open tickets with SLA deadlines
    const { data: tickets, error } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .not('status', 'in', '(resolved,closed)')
      .not('sla_breached', 'eq', true)
      .not('sla_deadline', 'is', null)

    if (error) {
      console.error('Error fetching tickets for SLA check:', error)
      return { success: false, error: error.message }
    }

    if (!tickets || tickets.length === 0) {
      return { success: true, warnings: 0, message: 'No tickets to check' }
    }

    let warningsSent = 0

    for (const ticket of tickets) {
      const deadline = new Date(ticket.sla_deadline)
      const createdAt = new Date(ticket.created_at)
      const totalTime = deadline.getTime() - createdAt.getTime()
      const elapsed = now.getTime() - createdAt.getTime()
      const percentElapsed = (elapsed / totalTime) * 100

      // Send warning at 80% elapsed
      if (percentElapsed >= 80 && !ticket.sla_warning_sent) {
        await notifySLAWarning({
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          partnerName: ticket.partner_name,
          partnerEmail: ticket.partner_email,
          slaDeadline: ticket.sla_deadline
        })

        // Mark warning as sent
        await supabase
          .from('partner_support_tickets')
          .update({ sla_warning_sent: true, sla_warning_sent_at: now.toISOString() })
          .eq('id', ticket.id)

        // Log activity
        await supabase.from('partner_ticket_activity_log').insert({
          ticket_id: ticket.id,
          action_type: 'sla_warning',
          action_by_type: 'system',
          action_by_name: 'SLA Monitor',
          description: `SLA warning: ${Math.round(100 - percentElapsed)}% time remaining`
        })

        warningsSent++
      }
    }

    return {
      success: true,
      warnings: warningsSent,
      checked: tickets.length,
      timestamp: now.toISOString()
    }
  } catch (error) {
    console.error('Error in SLA warning check:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Check tickets that have breached SLA deadline
 * Should run every 5 minutes
 */
export async function checkSLABreaches() {
  const supabase = await createClient()

  try {
    const now = new Date()

    // Get all open tickets past their SLA deadline
    const { data: tickets, error } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .not('status', 'in', '(resolved,closed)')
      .eq('sla_breached', false)
      .lt('sla_deadline', now.toISOString())

    if (error) {
      console.error('Error fetching tickets for breach check:', error)
      return { success: false, error: error.message }
    }

    if (!tickets || tickets.length === 0) {
      return { success: true, breaches: 0, message: 'No breaches detected' }
    }

    let breachesDetected = 0

    for (const ticket of tickets) {
      // Mark as breached
      await supabase
        .from('partner_support_tickets')
        .update({
          sla_breached: true,
          sla_breach_time: now.toISOString()
        })
        .eq('id', ticket.id)

      // Send breach notification
      await notifySLABreach({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        partnerName: ticket.partner_name,
        partnerEmail: ticket.partner_email,
        slaDeadline: ticket.sla_deadline
      })

      // Log activity
      await supabase.from('partner_ticket_activity_log').insert({
        ticket_id: ticket.id,
        action_type: 'sla_breach',
        action_by_type: 'system',
        action_by_name: 'SLA Monitor',
        description: `SLA BREACHED - Deadline: ${ticket.sla_deadline}`
      })

      // Auto-escalate breached tickets
      if (!ticket.is_escalated) {
        await supabase
          .from('partner_support_tickets')
          .update({
            is_escalated: true,
            escalation_level: 1,
            escalated_at: now.toISOString(),
            escalation_reason: 'Auto-escalated due to SLA breach'
          })
          .eq('id', ticket.id)

        await supabase.from('partner_ticket_activity_log').insert({
          ticket_id: ticket.id,
          action_type: 'escalated',
          action_by_type: 'system',
          action_by_name: 'SLA Monitor',
          description: 'Auto-escalated to Level 1 due to SLA breach'
        })
      }

      breachesDetected++
    }

    return {
      success: true,
      breaches: breachesDetected,
      checked: tickets.length,
      timestamp: now.toISOString()
    }
  } catch (error) {
    console.error('Error in SLA breach check:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Update SLA statistics for reporting
 * Should run once daily
 */
export async function updateSLAStatistics() {
  const supabase = await createClient()

  try {
    // Get SLA performance metrics
    const { data: tickets } = await supabase
      .from('partner_support_tickets')
      .select('*')
      .in('status', ['resolved', 'closed'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (!tickets || tickets.length === 0) {
      return { success: true, message: 'No tickets to analyze' }
    }

    const totalTickets = tickets.length
    const breachedTickets = tickets.filter(t => t.sla_breached).length
    const onTimeTickets = totalTickets - breachedTickets
    const slaComplianceRate = ((onTimeTickets / totalTickets) * 100).toFixed(2)

    // Calculate average response and resolution times
    const avgResponseTime =
      tickets.reduce((sum, t) => sum + (parseFloat(t.response_time_hours) || 0), 0) /
      totalTickets
    const avgResolutionTime =
      tickets.reduce((sum, t) => sum + (parseFloat(t.resolution_time_hours) || 0), 0) /
      totalTickets

    // Store statistics
    await supabase.from('partner_ticket_sla_statistics').insert({
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString(),
      total_tickets: totalTickets,
      on_time_tickets: onTimeTickets,
      breached_tickets: breachedTickets,
      sla_compliance_rate: parseFloat(slaComplianceRate),
      avg_response_time_hours: avgResponseTime.toFixed(2),
      avg_resolution_time_hours: avgResolutionTime.toFixed(2)
    })

    return {
      success: true,
      statistics: {
        totalTickets,
        onTimeTickets,
        breachedTickets,
        slaComplianceRate: `${slaComplianceRate}%`,
        avgResponseTime: `${avgResponseTime.toFixed(2)}h`,
        avgResolutionTime: `${avgResolutionTime.toFixed(2)}h`
      }
    }
  } catch (error) {
    console.error('Error updating SLA statistics:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Master SLA monitor function - runs all checks
 */
export async function runSLAMonitor() {
  console.log('[SLA Monitor] Starting SLA monitoring checks...')

  const results = {
    warnings: await checkSLAWarnings(),
    breaches: await checkSLABreaches(),
    timestamp: new Date().toISOString()
  }

  console.log('[SLA Monitor] Completed:', results)

  return results
}
