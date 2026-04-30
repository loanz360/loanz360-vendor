import { parseBody } from '@/lib/utils/parse-body'

/**
 * BDM Team Pipeline - BDE Actions API
 * GET /api/bdm/team-pipeline/bde-performance/actions
 *
 * Track action items and tasks assigned to BDEs
 * POST - Create new action item
 * PATCH - Update action status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
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
    const bdeId = searchParams.get('bdeId')
    const status = searchParams.get('status') // pending, in_progress, completed, cancelled
    const priority = searchParams.get('priority') // critical, high, medium, low
    const category = searchParams.get('category') // follow_up, documentation, quality, training

    // 3. Get BDEs under this BDM
    const bdeIds = await getBDEIds(bdmId)

    if (bdeId && !bdeIds.includes(bdeId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDE not under your management' },
        { status: 403 }
      )
    }

    const targetBdeIds = bdeId ? [bdeId] : bdeIds

    // 4. Build query for actions (using alerts table for now, can create dedicated actions table)
    const supabase = createClient()
    let query = supabase
      .from('pipeline_alerts')
      .select(`
        id,
        bde_user_id,
        alert_type,
        severity,
        message,
        metadata,
        is_read,
        is_resolved,
        created_at,
        updated_at,
        users:bde_user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .in('bde_user_id', targetBdeIds)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status === 'completed') {
      query = query.eq('is_resolved', true)
    } else if (status === 'pending') {
      query = query.eq('is_resolved', false).eq('is_read', false)
    } else if (status === 'in_progress') {
      query = query.eq('is_resolved', false).eq('is_read', true)
    }

    if (priority) {
      query = query.eq('severity', priority)
    }

    if (category) {
      query = query.eq('alert_type', category.toUpperCase())
    }

    const { data: actions, error } = await query

    if (error) {
      apiLogger.error('[Actions API] Error fetching actions', error)
      throw new Error(`Failed to fetch actions: ${error.message}`)
    }

    // 5. Transform and categorize actions
    const transformedActions = actions?.map(action => {
      const dueDate = action.metadata?.due_date || null
      const isOverdue = dueDate ? new Date(dueDate) < new Date() : false
      const daysUntilDue = dueDate
        ? Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        id: action.id,
        bdeId: action.bde_user_id,
        bdeName: action.users?.full_name || 'Unknown',
        bdeEmail: action.users?.email,
        bdeAvatar: action.users?.avatar_url,

        title: action.message,
        description: action.metadata?.description || null,
        category: mapAlertTypeToCategory(action.alert_type),
        categoryLabel: getCategoryLabel(action.alert_type),

        status: getActionStatus(action),
        statusLabel: getActionStatusLabel(action),
        statusColor: getActionStatusColor(action),

        priority: action.severity,
        priorityLabel: getPriorityLabel(action.severity),
        priorityColor: getPriorityColor(action.severity),

        dueDate,
        dueDateFormatted: dueDate ? formatDate(dueDate) : null,
        isOverdue,
        daysUntilDue,

        assignedBy: action.metadata?.assigned_by || bdmId,
        createdAt: action.created_at,
        createdAtFormatted: formatRelativeTime(action.created_at),
        updatedAt: action.updated_at,
        updatedAtFormatted: formatRelativeTime(action.updated_at),

        relatedLeadId: action.metadata?.lead_id || null,
        notes: action.metadata?.notes || null,
      }
    }) || []

    // 6. Calculate summary statistics
    const summary = {
      total: transformedActions.length,
      pending: transformedActions.filter(a => a.status === 'pending').length,
      inProgress: transformedActions.filter(a => a.status === 'in_progress').length,
      completed: transformedActions.filter(a => a.status === 'completed').length,
      overdue: transformedActions.filter(a => a.isOverdue).length,
      critical: transformedActions.filter(a => a.priority === 'critical').length,
      high: transformedActions.filter(a => a.priority === 'high').length,
    }

    // 7. Group by category
    const byCategory = transformedActions.reduce((acc, action) => {
      const cat = action.category
      if (!acc[cat]) {
        acc[cat] = []
      }
      acc[cat].push(action)
      return acc
    }, {} as Record<string, any[]>)

    // 8. Group by BDE
    const byBDE = transformedActions.reduce((acc, action) => {
      const bdeId = action.bdeId
      if (!acc[bdeId]) {
        acc[bdeId] = {
          bdeId,
          bdeName: action.bdeName,
          actions: [],
          pending: 0,
          overdue: 0,
        }
      }
      acc[bdeId].actions.push(action)
      if (action.status === 'pending') acc[bdeId].pending++
      if (action.isOverdue) acc[bdeId].overdue++
      return acc
    }, {} as Record<string, any>)

    // 9. Return response
    return NextResponse.json({
      success: true,
      data: {
        actions: transformedActions,
        summary,
        byCategory,
        byBDE: Object.values(byBDE),
        filters: {
          bdeId,
          status,
          priority,
          category,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Actions API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch actions',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    const {
      bdeId,
      title,
      description,
      category,
      priority,
      dueDate,
      relatedLeadId,
    } = body

    if (!bdeId || !title || !category || !priority) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: bdeId, title, category, priority' },
        { status: 400 }
      )
    }

    // 3. Verify BDE is under this BDM
    const bdeIds = await getBDEIds(bdmId)
    if (!bdeIds.includes(bdeId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDE not under your management' },
        { status: 403 }
      )
    }

    // 4. Create action (using alerts table)
    const supabase = createClient()
    const { data: action, error } = await supabase
      .from('pipeline_alerts')
      .insert({
        bde_user_id: bdeId,
        alert_type: category.toUpperCase(),
        severity: priority,
        message: title,
        metadata: {
          description,
          due_date: dueDate,
          lead_id: relatedLeadId,
          assigned_by: bdmId,
          is_action_item: true,
        },
        is_read: false,
        is_resolved: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Actions API] Error creating action', error)
      throw new Error(`Failed to create action: ${error.message}`)
    }

    // 5. Return response
    return NextResponse.json({
      success: true,
      data: {
        action,
      },
      message: 'Action created successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Actions API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create action',
      },
      { status: 500 }
    )
  }
}

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
    const { actionId, status, notes } = body

    if (!actionId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: actionId, status' },
        { status: 400 }
      )
    }

    // 3. Update action status
    const supabase = createClient()

    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (status === 'in_progress') {
      updates.is_read = true
      updates.is_resolved = false
    } else if (status === 'completed') {
      updates.is_read = true
      updates.is_resolved = true
    } else if (status === 'cancelled') {
      updates.is_resolved = true
    }

    if (notes) {
      updates.metadata = {
        notes,
      }
    }

    const { data: action, error } = await supabase
      .from('pipeline_alerts')
      .update(updates)
      .eq('id', actionId)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Actions API] Error updating action', error)
      throw new Error(`Failed to update action: ${error.message}`)
    }

    // 4. Return response
    return NextResponse.json({
      success: true,
      data: {
        action,
      },
      message: 'Action updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Actions API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update action',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function getActionStatus(action: any): string {
  if (action.is_resolved) return 'completed'
  if (action.is_read) return 'in_progress'
  return 'pending'
}

function getActionStatusLabel(action: any): string {
  const status = getActionStatus(action)
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

function getActionStatusColor(action: any): string {
  const status = getActionStatus(action)
  const colors: Record<string, string> = {
    pending: '#F59E0B',
    in_progress: '#3B82F6',
    completed: '#10B981',
    cancelled: '#6B7280',
  }
  return colors[status] || '#6B7280'
}

function mapAlertTypeToCategory(alertType: string): string {
  const mapping: Record<string, string> = {
    STALE_LEAD: 'follow_up',
    MISSING_DOCUMENTS: 'documentation',
    HIGH_VALUE_LEAD: 'follow_up',
    BANK_REJECTION_RISK: 'quality',
    RESPONSE_TIME_ALERT: 'follow_up',
    FOLLOW_UP: 'follow_up',
    DOCUMENTATION: 'documentation',
    QUALITY: 'quality',
    TRAINING: 'training',
  }
  return mapping[alertType] || 'follow_up'
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    follow_up: 'Follow Up',
    documentation: 'Documentation',
    quality: 'Quality',
    training: 'Training',
    STALE_LEAD: 'Follow Up',
    MISSING_DOCUMENTS: 'Documentation',
    HIGH_VALUE_LEAD: 'Follow Up',
    BANK_REJECTION_RISK: 'Quality',
  }
  return labels[category] || category
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }
  return labels[priority] || priority
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: '#DC2626',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#6B7280',
  }
  return colors[priority] || '#6B7280'
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(dateString)
}
