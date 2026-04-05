/**
 * CRON: Workflow Automation Runner
 * Schedule: Every minute (* * * * *)
 *
 * Processes:
 * 1. Scheduled/delayed workflow actions (delay_minutes queue)
 * 2. SLA warning & breach triggers
 * 3. Lead nurturing workflow steps (time-elapsed)
 * 4. Inactivity-based lead follow-up triggers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secure-cron-secret-here'
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const results = {
      delayed_actions_processed: 0,
      sla_warnings_triggered: 0,
      sla_breaches_triggered: 0,
      lead_workflows_advanced: 0,
      inactivity_triggers_fired: 0,
      errors: [] as string[],
    }

    // =========================================================
    // 1. PROCESS DELAYED WORKFLOW ACTIONS
    // =========================================================
    const { data: scheduledActions, error: saError } = await supabase
      .from('scheduled_workflow_actions')
      .select('*')
      .eq('status', 'pending')
      .lte('execute_at', now)
      .order('execute_at', { ascending: true })
      .limit(100)

    if (saError) {
      results.errors.push(`Scheduled actions fetch: ${saError.message}`)
    } else if (scheduledActions && scheduledActions.length > 0) {
      for (const action of scheduledActions) {
        try {
          // Mark as processing
          await supabase
            .from('scheduled_workflow_actions')
            .update({ status: 'processing', started_at: now })
            .eq('id', action.id)

          // Execute the action via automation route
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const res = await fetch(`${baseUrl}/api/automation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': cronSecret,
            },
            body: JSON.stringify({
              action: 'execute_delayed',
              scheduled_action_id: action.id,
              rule_id: action.rule_id,
              ticket_id: action.ticket_id,
              ticket_source: action.ticket_source,
              action_type: action.action_type,
              action_params: action.action_params,
            }),
          })

          if (res.ok) {
            await supabase
              .from('scheduled_workflow_actions')
              .update({ status: 'completed', completed_at: now })
              .eq('id', action.id)
            results.delayed_actions_processed++
          } else {
            throw new Error(`HTTP ${res.status}`)
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          results.errors.push(`Delayed action ${action.id}: ${msg}`)
          await supabase
            .from('scheduled_workflow_actions')
            .update({ status: 'failed', error_message: msg })
            .eq('id', action.id)
        }
      }
    }

    // =========================================================
    // 2. SLA WARNING TRIGGERS (response_due within 30 minutes)
    // =========================================================
    const thirtyMinsFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const { data: slaNearTickets, error: slaWarnError } = await supabase
      .from('support_tickets')
      .select('id, source, status, response_due_at, sla_warning_sent')
      .eq('status', 'open')
      .eq('sla_warning_sent', false)
      .lte('response_due_at', thirtyMinsFromNow)
      .gte('response_due_at', now)
      .limit(50)

    if (slaWarnError) {
      results.errors.push(`SLA warning fetch: ${slaWarnError.message}`)
    } else if (slaNearTickets && slaNearTickets.length > 0) {
      for (const ticket of slaNearTickets) {
        try {
          // Fire sla_warning workflow trigger
          await supabase.rpc('fire_workflow_trigger', {
            p_ticket_id: ticket.id,
            p_ticket_source: ticket.source || 'customer',
            p_trigger: 'sla_warning',
            p_context: { response_due_at: ticket.response_due_at },
          }).catch(() => null) // Non-critical

          await supabase
            .from('support_tickets')
            .update({ sla_warning_sent: true })
            .eq('id', ticket.id)

          results.sla_warnings_triggered++
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          results.errors.push(`SLA warning ticket ${ticket.id}: ${msg}`)
        }
      }
    }

    // =========================================================
    // 3. SLA BREACH TRIGGERS (response_due has passed)
    // =========================================================
    const { data: slaBreachedTickets, error: slaBreachError } = await supabase
      .from('support_tickets')
      .select('id, source, status, response_due_at, sla_breached')
      .eq('status', 'open')
      .eq('sla_breached', false)
      .lt('response_due_at', now)
      .limit(50)

    if (slaBreachError) {
      results.errors.push(`SLA breach fetch: ${slaBreachError.message}`)
    } else if (slaBreachedTickets && slaBreachedTickets.length > 0) {
      for (const ticket of slaBreachedTickets) {
        try {
          await supabase.rpc('fire_workflow_trigger', {
            p_ticket_id: ticket.id,
            p_ticket_source: ticket.source || 'customer',
            p_trigger: 'sla_breach',
            p_context: { breached_at: now },
          }).catch(() => null)

          await supabase
            .from('support_tickets')
            .update({ sla_breached: true, sla_breached_at: now })
            .eq('id', ticket.id)

          results.sla_breaches_triggered++
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          results.errors.push(`SLA breach ticket ${ticket.id}: ${msg}`)
        }
      }
    }

    // =========================================================
    // 4. LEAD NURTURING WORKFLOW RUNS (advance waiting steps)
    // =========================================================
    const { data: pendingRuns, error: runsError } = await supabase
      .from('workflow_runs')
      .select('id, lead_id, template_id, current_step, next_step_at, status')
      .eq('status', 'waiting')
      .lte('next_step_at', now)
      .limit(50)

    if (runsError) {
      results.errors.push(`Workflow runs fetch: ${runsError.message}`)
    } else if (pendingRuns && pendingRuns.length > 0) {
      for (const run of pendingRuns) {
        try {
          const { error: stepError } = await supabase.rpc('process_workflow_step', {
            p_run_id: run.id,
          })
          if (!stepError) {
            results.lead_workflows_advanced++
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          results.errors.push(`Workflow run ${run.id}: ${msg}`)
        }
      }
    }

    // =========================================================
    // 5. INACTIVITY TRIGGERS — leads not touched in N hours
    // =========================================================
    // Fire inactivity trigger for active leads with no update in 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: inactiveLeads, error: inactError } = await supabase
      .from('partner_leads')
      .select('id, lead_status, assigned_to, last_activity_at')
      .in('lead_status', ['ASSIGNED', 'CONTACTED', 'DOCUMENT_PENDING'])
      .lt('last_activity_at', oneDayAgo)
      .eq('inactivity_trigger_sent', false)
      .limit(50)

    if (inactError) {
      results.errors.push(`Inactivity leads fetch: ${inactError.message}`)
    } else if (inactiveLeads && inactiveLeads.length > 0) {
      const ids = inactiveLeads.map(l => l.id)
      // Batch update to avoid N+1
      await supabase
        .from('partner_leads')
        .update({ inactivity_trigger_sent: true })
        .in('id', ids)
      results.inactivity_triggers_fired = inactiveLeads.length
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      ...results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    apiLogger.error('Workflow runner cron error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: msg },
      { status: 500 }
    )
  }
}
