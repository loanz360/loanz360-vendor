import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

interface EscalationConfig {
  auto_escalate_after_days: number
  notify_manager_after_days: number
  max_items_per_ae: number
  auto_reassign_on_absence: boolean
  escalation_recipients: string[]
}

const DEFAULT_CONFIG: EscalationConfig = {
  auto_escalate_after_days: 5,
  notify_manager_after_days: 3,
  max_items_per_ae: 15,
  auto_reassign_on_absence: true,
  escalation_recipients: ['ACCOUNTS_MANAGER', 'SUPER_ADMIN'],
}

const CONFIG_KEY = 'accounts_manager_escalation_rules'

/**
 * Auth helper: validate ACCOUNTS_MANAGER or SUPER_ADMIN
 */
async function authorize(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', status: 401 }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, role, sub_role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (userError || !userData) return { error: 'User not found', status: 404 }

  if (userData.role !== 'SUPER_ADMIN' &&
      !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
    return { error: 'Access denied. Accounts Manager only.', status: 403 }
  }

  return { userData }
}

/**
 * GET /api/employees/accounts-manager/escalation-rules
 * Returns current escalation config or defaults.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const auth = await authorize(supabase)
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    // Try fetching from app_config table
    const { data: configRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle()

    let config: EscalationConfig = DEFAULT_CONFIG

    if (configRow?.value) {
      try {
        const stored = typeof configRow.value === 'string'
          ? JSON.parse(configRow.value)
          : configRow.value
        config = { ...DEFAULT_CONFIG, ...stored }
      } catch {
        // Fallback to defaults if parsing fails
        logger.warn('Failed to parse escalation config, using defaults')
      }
    }

    return NextResponse.json({
      success: true,
      data: { config },
    })
  } catch (error) {
    logger.error('Escalation rules GET error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employees/accounts-manager/escalation-rules
 * Updates escalation config with partial fields.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const auth = await authorize(supabase)
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const updates: Partial<EscalationConfig> = {}

    // Validate and pick fields
    if (body.auto_escalate_after_days !== undefined) {
      const val = Number(body.auto_escalate_after_days)
      if (isNaN(val) || val < 1 || val > 14) {
        return NextResponse.json(
          { success: false, error: 'auto_escalate_after_days must be between 1 and 14' },
          { status: 400 }
        )
      }
      updates.auto_escalate_after_days = val
    }

    if (body.notify_manager_after_days !== undefined) {
      const val = Number(body.notify_manager_after_days)
      if (isNaN(val) || val < 1 || val > 7) {
        return NextResponse.json(
          { success: false, error: 'notify_manager_after_days must be between 1 and 7' },
          { status: 400 }
        )
      }
      updates.notify_manager_after_days = val
    }

    if (body.max_items_per_ae !== undefined) {
      const val = Number(body.max_items_per_ae)
      if (isNaN(val) || val < 5 || val > 30) {
        return NextResponse.json(
          { success: false, error: 'max_items_per_ae must be between 5 and 30' },
          { status: 400 }
        )
      }
      updates.max_items_per_ae = val
    }

    if (body.auto_reassign_on_absence !== undefined) {
      updates.auto_reassign_on_absence = Boolean(body.auto_reassign_on_absence)
    }

    if (body.escalation_recipients !== undefined) {
      if (!Array.isArray(body.escalation_recipients) || body.escalation_recipients.length === 0) {
        return NextResponse.json(
          { success: false, error: 'escalation_recipients must be a non-empty array' },
          { status: 400 }
        )
      }
      const validRecipients = ['ACCOUNTS_MANAGER', 'SUPER_ADMIN', 'ADMIN', 'HR_MANAGER']
      const invalid = body.escalation_recipients.filter((r: string) => !validRecipients.includes(r))
      if (invalid.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid recipients: ${invalid.join(', ')}` },
          { status: 400 }
        )
      }
      updates.escalation_recipients = body.escalation_recipients
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    // Fetch existing config
    const { data: existingRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle()

    let currentConfig: EscalationConfig = DEFAULT_CONFIG
    if (existingRow?.value) {
      try {
        const stored = typeof existingRow.value === 'string'
          ? JSON.parse(existingRow.value)
          : existingRow.value
        currentConfig = { ...DEFAULT_CONFIG, ...stored }
      } catch {
        // Use defaults
      }
    }

    const newConfig = { ...currentConfig, ...updates }

    // Upsert config
    const { error: upsertError } = await supabase
      .from('app_config')
      .upsert(
        { key: CONFIG_KEY, value: newConfig, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

    if (upsertError) {
      logger.error('Failed to save escalation config', upsertError)
      return NextResponse.json({ success: false, error: 'Failed to save configuration' }, { status: 500 })
    }

    logger.info(`Escalation rules updated by ${auth.userData.full_name}`, updates)

    return NextResponse.json({
      success: true,
      data: { config: newConfig },
      message: 'Escalation rules updated successfully.',
    })
  } catch (error) {
    logger.error('Escalation rules POST error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
