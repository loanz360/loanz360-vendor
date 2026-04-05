export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get next item from queue (Power Dialer)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`

    // Get highest priority unlocked item that's ready to call
    const { data: nextItem, error } = await supabase
      .from('ts_call_queue')
      .select('*')
      .eq('sales_executive_id', user.id)
      .eq('status', 'QUEUED')
      .or(`locked_by.is.null,lock_expires_at.lt.${now.toISOString()}`)
      .or(`earliest_call_time.is.null,earliest_call_time.lte.${now.toISOString()}`)
      .or(`next_attempt_after.is.null,next_attempt_after.lte.${now.toISOString()}`)
      .order('priority', { ascending: false })
      .order('queue_position', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (!nextItem) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No items in queue'
      })
    }

    // Check DND before returning
    const { data: dndCheck } = await supabase
      .from('ts_dnd_registry')
      .select('id')
      .eq('phone_normalized', nextItem.contact_phone_normalized)
      .is('removed_at', null)
      .limit(1)
      .maybeSingle()

    if (dndCheck) {
      // Mark as DNC and get next
      await supabase
        .from('ts_call_queue')
        .update({
          status: 'REMOVED',
          removed_reason: 'On DNC registry',
          removed_at: now.toISOString()
        })
        .eq('id', nextItem.id)

      // Recursively get next (simplified - in production use iteration)
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Item was on DNC, removed from queue. Try again.',
        dnc_removed: true
      })
    }

    // Lock the item
    const { data: lockedItem, error: lockError } = await supabase
      .from('ts_call_queue')
      .update({
        locked_by: user.id,
        locked_at: now.toISOString(),
        lock_expires_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        status: 'DIALING'
      })
      .eq('id', nextItem.id)
      .eq('status', 'QUEUED')
      .select()
      .maybeSingle()

    if (lockError) {
      // Someone else grabbed it, try again
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Item was claimed by another process. Try again.',
        retry: true
      })
    }

    // Get associated script if any
    let script = null
    if (lockedItem.assigned_script_id) {
      const { data: scriptData } = await supabase
        .from('ts_call_scripts')
        .select('*')
        .eq('id', lockedItem.assigned_script_id)
        .maybeSingle()
      script = scriptData
    }

    return NextResponse.json({
      success: true,
      data: {
        queue_item: lockedItem,
        script,
        call_window_seconds: 300, // 5 minutes to complete
        compliance_checks: {
          dnd_cleared: true,
          within_calling_hours: currentHour >= 9 && currentHour < 21
        }
      }
    })
  } catch (error) {
    apiLogger.error('Get next queue item error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get next queue item' },
      { status: 500 }
    )
  }
}
