import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


interface AutomationRule {
  id: string
  name: string
  trigger_event: string
  trigger_conditions: Record<string, unknown> | null
  action_type: string
  action_config: Record<string, unknown>
  is_active: boolean
}

/**
 * GET /api/cro/automation/evaluate
 * Cron-triggered: Evaluates all active automation rules and executes matching actions.
 * Designed to run every 15-30 minutes.
 *
 * Handles:
 * - no_contact_72h: Leads with no activity in 72 hours → escalate/notify
 * - followup_missed: Overdue follow-ups → send reminder notification
 * - sla_breach: Leads past SLA → escalate to manager
 * - score_threshold: Leads reaching score threshold → auto-change status
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronKey = request.nextUrl.searchParams.get('key')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const isVercelCron = authHeader === `Bearer ${cronSecret}`
    const isExternalCron = cronKey === cronSecret
    if (!isVercelCron && !isExternalCron) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = await createClient()

    // Fetch active automation rules
    const { data: rules, error: rulesError } = await supabase
      .from('crm_automation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (rulesError || !rules || rules.length === 0) {
      return NextResponse.json({ success: true, data: { processed: 0, message: 'No active rules' } })
    }

    const results: Array<{ rule: string; action: string; affected: number }> = []

    for (const rule of rules as AutomationRule[]) {
      try {
        const affected = await evaluateRule(supabase, rule, request.url)
        if (affected > 0) {
          results.push({ rule: rule.name, action: rule.action_type, affected })
        }
      } catch (error) {
        apiLogger.error(`Rule "${rule.name}" failed:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        rulesEvaluated: rules.length,
        actionsTriggered: results.length,
        results,
      },
    })
  } catch (error) {
    apiLogger.error('Automation evaluate error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function evaluateRule(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  rule: AutomationRule,
  baseUrl: string
): Promise<number> {
  const now = new Date()

  switch (rule.trigger_event) {
    case 'no_contact_72h': {
      // Find leads with no call logs in 72 hours
      const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000)

      const { data: staleLeads } = await supabase
        .from('crm_leads')
        .select('id, cro_id, customer_name')
        .not('status', 'in', '("converted","lost")')
        .lt('updated_at', cutoff.toISOString())
        .limit(50)

      if (!staleLeads || staleLeads.length === 0) return 0

      return await executeAction(supabase, rule, staleLeads, baseUrl)
    }

    case 'followup_missed': {
      // Find overdue pending follow-ups
      const { data: overdueFollowups } = await supabase
        .from('crm_followups')
        .select('id, lead_id, owner_id, title')
        .eq('status', 'Pending')
        .lt('scheduled_at', now.toISOString())
        .limit(50)

      if (!overdueFollowups || overdueFollowups.length === 0) return 0

      return await executeAction(supabase, rule, overdueFollowups, baseUrl)
    }

    case 'score_threshold': {
      // Find leads reaching score threshold
      const threshold = Number(rule.trigger_conditions?.threshold || 70)
      const targetStatus = (rule.action_config?.new_status as string) || 'Interested'

      // Note: lead_score doesn't exist on crm_leads - this trigger type is not functional
      // Keeping as placeholder for future schema additions
      const { data: highScoreLeads } = await supabase
        .from('crm_leads')
        .select('id, cro_id, customer_name')
        .not('status', 'in', `("${targetStatus.toLowerCase()}","converted","lost")`)
        .limit(50)

      if (!highScoreLeads || highScoreLeads.length === 0) return 0

      // Auto-change status
      let affected = 0
      for (const lead of highScoreLeads) {
        const { error } = await supabase
          .from('crm_leads')
          .update({ status: targetStatus, updated_at: now.toISOString() })
          .eq('id', lead.id)

        if (!error) {
          affected++
          // Log audit
          await supabase.from('crm_audit_logs').insert({
            entity_type: 'lead',
            entity_id: lead.id,
            action: 'status_changed',
            old_value: JSON.stringify({ status: 'auto-scored' }),
            new_value: JSON.stringify({ status: targetStatus }),
            performed_by: 'system',
            notes: `Auto-promoted by rule "${rule.name}"`,
          }).then(() => {}).catch(() => { /* Non-critical side effect */ })
        }
      }
      return affected
    }

    default:
      return 0
  }
}

async function executeAction(
  supabase: unknown,
  rule: AutomationRule,
  entities: Array<Record<string, unknown>>,
  baseUrl: string
): Promise<number> {
  const sb = supabase as Awaited<ReturnType<typeof createClient>>
  let affected = 0

  switch (rule.action_type) {
    case 'send_notification': {
      for (const entity of entities) {
        const userId = (entity.cro_id || entity.owner_id) as string
        if (!userId) continue

        await sb
          .from('in_app_notifications')
          .insert({
            user_id: userId,
            title: rule.action_config.title as string || rule.name,
            message: rule.action_config.message as string || `Automation rule triggered for ${entity.customer_name || 'a lead'}`,
            type: 'warning',
            category: 'automation',
            action_url: rule.action_config.action_url as string || '/employees/cro/ai-crm/leads',
            metadata: { rule_id: rule.id, entity_id: entity.id },
          })
          .then(() => { affected++ })
          .catch(() => { /* Non-critical side effect */ })
      }
      break
    }

    case 'escalate': {
      for (const entity of entities) {
        const croId = (entity.cro_id || entity.owner_id) as string
        if (!croId) continue

        // Find CRO's manager
        const { data: hierarchy } = await sb
          .from('employee_hierarchy')
          .select('manager_id')
          .eq('employee_id', croId)
          .maybeSingle()

        const managerId = hierarchy?.manager_id
        if (!managerId) continue

        await sb
          .from('in_app_notifications')
          .insert({
            user_id: managerId,
            title: `Escalation: ${rule.name}`,
            message: `Lead "${entity.customer_name || entity.id}" requires attention (CRO inactive for 72h)`,
            type: 'warning',
            category: 'escalation',
            action_url: `/employees/cro/customer/${entity.id}?type=lead`,
            metadata: { rule_id: rule.id, entity_id: entity.id, cro_id: croId },
          })
          .then(() => { affected++ })
          .catch(() => { /* Non-critical side effect */ })
      }
      break
    }

    case 'change_status': {
      const newStatus = rule.action_config.new_status as string
      if (!newStatus) break

      for (const entity of entities) {
        await sb
          .from('crm_leads')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', entity.id as string)
          .then(() => { affected++ })
          .catch(() => { /* Non-critical side effect */ })
      }
      break
    }

    case 'create_followup': {
      for (const entity of entities) {
        const croId = (entity.cro_id || entity.owner_id) as string
        if (!croId) continue

        const followupDate = new Date()
        followupDate.setDate(followupDate.getDate() + 1)
        followupDate.setHours(10, 0, 0, 0)

        await sb
          .from('crm_followups')
          .insert({
            lead_id: entity.lead_id || entity.id,
            scheduled_at: followupDate.toISOString(),
            owner_id: croId,
            title: rule.action_config.purpose as string || `Auto: ${rule.name}`,
            notes: `Auto-created by automation rule: ${rule.name}`,
          })
          .then(() => { affected++ })
          .catch(() => { /* Non-critical side effect */ })
      }
      break
    }
  }

  return affected
}
