/**
 * Activity Alerts API
 * Manage alert rules and configurations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


// Get all alerts
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const isActive = searchParams.get('active')

    let query = supabase
      .from('activity_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (isActive === 'true') {
      query = query.eq('is_active', true)
    } else if (isActive === 'false') {
      query = query.eq('is_active', false)
    }

    const { data: alerts, error } = await query

    if (error) {
      apiLogger.error('[Alerts API] Query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch alerts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      alerts: alerts || []
    })
  } catch (error) {
    apiLogger.error('[Alerts API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Create new alert rule
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const {
      name,
      description,
      trigger_conditions,
      alert_severity,
      notify_in_app = true,
      notify_email = false,
      notify_sms = false,
      notify_webhook = false,
      recipient_users,
      recipient_roles,
      webhook_url,
      cooldown_seconds = 300,
      max_alerts_per_hour = 10,
      escalation_enabled = false,
      escalation_after_minutes,
      escalation_to_users,
      created_by
    } = body

    if (!name || !trigger_conditions) {
      return NextResponse.json(
        { success: false, error: 'Name and trigger conditions are required' },
        { status: 400 }
      )
    }

    const { data: alert, error } = await supabase
      .from('activity_alerts')
      .insert({
        name,
        description,
        trigger_conditions,
        alert_severity: alert_severity || 'warning',
        notify_in_app,
        notify_email,
        notify_sms,
        notify_webhook,
        recipient_users,
        recipient_roles,
        webhook_url,
        cooldown_seconds,
        max_alerts_per_hour,
        escalation_enabled,
        escalation_after_minutes,
        escalation_to_users,
        created_by
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Alerts API] Create error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      alert,
      message: 'Alert created successfully'
    })
  } catch (error) {
    apiLogger.error('[Alerts API] POST Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update alert
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      )
    }

    const { data: alert, error } = await supabase
      .from('activity_alerts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Alerts API] Update error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      alert,
      message: 'Alert updated successfully'
    })
  } catch (error) {
    apiLogger.error('[Alerts API] PATCH Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete alert
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('activity_alerts')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('[Alerts API] Delete error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully'
    })
  } catch (error) {
    apiLogger.error('[Alerts API] DELETE Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
