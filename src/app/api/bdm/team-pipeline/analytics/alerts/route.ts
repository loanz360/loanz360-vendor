import { parseBody } from '@/lib/utils/parse-body'

/**
 * BDM Team Pipeline - Real-time Alerts API
 * GET /api/bdm/team-pipeline/analytics/alerts
 *
 * Returns active alerts for the BDM
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId } from '@/lib/bdm/bde-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const severity = searchParams.get('severity') // critical, high, medium, low
    const status = searchParams.get('status') || 'ACTIVE' // ACTIVE, ACKNOWLEDGED, RESOLVED
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createClient()

    // 3. Build query
    let query = supabase
      .from('pipeline_alerts')
      .select(
        `
        id,
        alert_type,
        severity,
        title,
        description,
        lead_id,
        bde_id,
        action_required,
        is_read,
        is_resolved,
        created_at,
        metadata
      `
      )
      .eq('bdm_user_id', bdmId)

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity.toLowerCase())
    }

    if (status === 'ACTIVE') {
      query = query.eq('is_resolved', false)
    } else if (status === 'RESOLVED') {
      query = query.eq('is_resolved', true)
    } else if (status === 'ACKNOWLEDGED') {
      query = query.eq('is_read', true).eq('is_resolved', false)
    }

    // Order by severity and creation time
    query = query
      .order('severity', { ascending: true }) // critical first
      .order('created_at', { ascending: false })
      .limit(limit)

    const { data: alerts, error } = await query

    if (error) {
      apiLogger.error('[Alerts API] Error fetching alerts', error)
      throw new Error(`Failed to fetch alerts: ${error.message}`)
    }

    // 4. Fetch related lead and BDE information
    const leadIds = alerts?.map((a) => a.lead_id).filter(Boolean) || []
    const bdeIds = alerts?.map((a) => a.bde_id).filter(Boolean) || []

    const [leadsData, bdesData] = await Promise.all([
      leadIds.length > 0
        ? supabase
            .from('leads')
            .select('id, customer_name, loan_type, loan_amount')
            .in('id', leadIds)
        : Promise.resolve({ data: [] }),
      bdeIds.length > 0
        ? supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', bdeIds)
        : Promise.resolve({ data: [] }),
    ])

    // 5. Create maps for quick lookup
    const leadsMap = new Map(leadsData.data?.map((l) => [l.id, l]))
    const bdesMap = new Map(bdesData.data?.map((b) => [b.id, b]))

    // 6. Enhance alerts with related data
    const enhancedAlerts = alerts?.map((alert) => ({
      id: alert.id,
      alertType: alert.alert_type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      actionRequired: alert.action_required,
      isRead: alert.is_read,
      isResolved: alert.is_resolved,
      createdAt: alert.created_at,
      metadata: alert.metadata,
      lead: alert.lead_id
        ? {
            id: alert.lead_id,
            customerName: leadsMap.get(alert.lead_id)?.customer_name || 'Unknown',
            loanType: leadsMap.get(alert.lead_id)?.loan_type || 'Unknown',
            loanAmount: leadsMap.get(alert.lead_id)?.loan_amount || 0,
          }
        : null,
      bde: alert.bde_id
        ? {
            id: alert.bde_id,
            name: bdesMap.get(alert.bde_id)?.full_name || 'Unknown',
            email: bdesMap.get(alert.bde_id)?.email || '',
          }
        : null,
    }))

    // 7. Calculate summary
    const summary = {
      critical: enhancedAlerts?.filter((a) => a.severity === 'critical').length || 0,
      high: enhancedAlerts?.filter((a) => a.severity === 'high').length || 0,
      medium: enhancedAlerts?.filter((a) => a.severity === 'medium').length || 0,
      low: enhancedAlerts?.filter((a) => a.severity === 'low').length || 0,
      total: enhancedAlerts?.length || 0,
      unread: enhancedAlerts?.filter((a) => !a.isRead).length || 0,
    }

    // 8. Return response
    return NextResponse.json({
      success: true,
      data: {
        alerts: enhancedAlerts,
        summary,
      },
      metadata: {
        filters: {
          severity: severity || 'all',
          status: status || 'all',
          limit,
        },
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    apiLogger.error('[Alerts API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch alerts',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bdm/team-pipeline/analytics/alerts
 * Mark alert as read or resolved
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { alertId, action } = body // action: 'mark_read' | 'mark_resolved'

    if (!alertId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing alertId or action' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // 3. Update alert
    let updateData: Record<string, any> = {}

    if (action === 'mark_read') {
      updateData = { is_read: true }
    } else if (action === 'mark_resolved') {
      updateData = {
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: bdmId,
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('pipeline_alerts')
      .update(updateData)
      .eq('id', alertId)
      .eq('bdm_user_id', bdmId) // Ensure alert belongs to this BDM

    if (error) {
      apiLogger.error('[Alerts API] Error updating alert', error)
      throw new Error(`Failed to update alert: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: `Alert ${action === 'mark_read' ? 'marked as read' : 'resolved'} successfully`,
    })
  } catch (error) {
    apiLogger.error('[Alerts API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update alert',
      },
      { status: 500 }
    )
  }
}
