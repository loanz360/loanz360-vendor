import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


const VALID_ACTIONS = ['verify', 'reject', 'hold', 'escalate'] as const
const VALID_PARTNER_TYPES = ['CP', 'BA', 'BP'] as const

type BatchAction = (typeof VALID_ACTIONS)[number]
type PartnerType = (typeof VALID_PARTNER_TYPES)[number]

const STATUS_MAP: Record<BatchAction, string> = {
  verify: 'ACCOUNTS_VERIFIED',
  reject: 'REJECTED',
  hold: 'ON_HOLD',
  escalate: 'SA_APPROVED',
}

/**
 * POST /api/employees/accounts-manager/batch-verify
 * Batch verify, reject, hold, or escalate partner payout applications.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Accounts Manager only.' }, { status: 403 })
    }

    // Parse and validate body
    const body = await request.json()
    const { application_ids, action, partner_type, notes } = body as {
      application_ids: string[]
      action: BatchAction
      partner_type: PartnerType
      notes?: string
    }

    if (!application_ids || !Array.isArray(application_ids) || application_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'application_ids must be a non-empty array' }, { status: 400 })
    }

    if (application_ids.length > 100) {
      return NextResponse.json({ success: false, error: 'Maximum 100 applications per batch' }, { status: 400 })
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
    }

    if (!partner_type || !VALID_PARTNER_TYPES.includes(partner_type)) {
      return NextResponse.json({ success: false, error: `Invalid partner_type. Must be one of: ${VALID_PARTNER_TYPES.join(', ')}` }, { status: 400 })
    }

    const newStatus = STATUS_MAP[action]
    const now = new Date().toISOString()
    const tableName = partner_type === 'CP' ? 'cp_applications' : 'partner_payout_applications'
    const historyTable = partner_type === 'CP' ? 'cp_application_status_history' : 'partner_payout_status_history'

    let processed = 0
    const failed: number[] = []
    const errors: string[] = []

    // Fetch current applications to get previous statuses
    const { data: apps, error: fetchError } = await supabase
      .from(tableName)
      .select('id, app_id, status, partner_type')
      .in('id', application_ids)

    if (fetchError) {
      logger.error('Error fetching applications for batch verify:', { error: fetchError })
      return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
    }

    if (!apps || apps.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching applications found' }, { status: 404 })
    }

    // Filter to only applications in valid statuses for the action
    const validPreviousStatuses = ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION', 'ON_HOLD']
    const validApps = apps.filter(app => {
      if (validPreviousStatuses.includes(app.status)) return true
      errors.push(`Application ${app.app_id || app.id}: cannot ${action} from status ${app.status}`)
      return false
    })

    if (validApps.length === 0) {
      return NextResponse.json({
        success: true,
        data: { processed: 0, failed: apps.length, errors },
      })
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    }

    if (action === 'verify') {
      updatePayload.accounts_verified_at = now
      updatePayload.accounts_verified_by = user.id
    }

    if (action === 'reject') {
      updatePayload.reviewed_at = now
    }

    if (notes) {
      updatePayload.notes = notes
    }

    // Perform batch update
    const validIds = validApps.map(a => a.id)
    const { error: updateError } = await supabase
      .from(tableName)
      .update(updatePayload)
      .in('id', validIds)

    if (updateError) {
      logger.error('Error batch updating applications:', { error: updateError, action, partner_type })
      return NextResponse.json({ success: false, error: 'Failed to update applications' }, { status: 500 })
    }

    processed = validApps.length

    // Insert status history records
    const historyRecords = validApps.map(app => {
      const record: Record<string, unknown> = {
        application_id: app.id,
        previous_status: app.status,
        new_status: newStatus,
        changed_by: user.id,
        changed_by_name: userData.full_name,
        changed_by_role: userData.sub_role || userData.role,
        notes: notes || `Batch ${action} by ${userData.full_name} (${validApps.length} applications)`,
      }

      // partner_payout_status_history has extra columns
      if (partner_type !== 'CP') {
        record.app_id = app.app_id
        record.partner_type = app.partner_type || partner_type
      }

      return record
    })

    const { error: historyError } = await supabase
      .from(historyTable)
      .insert(historyRecords)

    if (historyError) {
      logger.error('Error inserting status history:', { error: historyError })
      // Non-blocking: the update succeeded, just log the history failure
      errors.push('Status history recording failed (updates were applied)')
    }

    logger.info('Batch verification completed', {
      action,
      partner_type,
      processed,
      failed: errors.length,
      by: userData.full_name,
    })

    return NextResponse.json({
      success: true,
      data: {
        processed,
        failed: application_ids.length - processed,
        errors,
      },
    })

  } catch (error) {
    logger.error('Batch verify error:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
