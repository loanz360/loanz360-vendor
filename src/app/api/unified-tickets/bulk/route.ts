import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

type TicketSource = 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'

interface BulkTicketItem {
  id: string
  source: TicketSource
}

/**
 * POST /api/unified-tickets/bulk
 * Perform bulk operations on tickets from multiple sources
 *
 * Actions supported:
 * - update_status: Update status of multiple tickets
 * - update_priority: Update priority of multiple tickets
 * - assign: Assign multiple tickets to an agent
 * - add_tags: Add tags to multiple tickets
 * - remove_tags: Remove tags from multiple tickets
 * - close: Close multiple tickets
 * - reopen: Reopen multiple tickets
 * - export: Export ticket data
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Only employees and super admins can perform bulk operations
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: employee } = await supabase
      .from('employees')
      .select('id, full_name, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!superAdmin && !employee) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action, tickets, data: actionData } = body

    if (!action || !tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json(
        { error: 'action and tickets array are required' },
        { status: 400 }
      )
    }

    if (tickets.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 tickets per bulk operation' },
        { status: 400 }
      )
    }

    const updaterName = superAdmin?.full_name || employee?.full_name || 'Unknown'
    const updaterType = superAdmin ? 'super_admin' : 'employee'

    // Group tickets by source
    const ticketsBySource: Record<TicketSource, string[]> = {
      EMPLOYEE: [],
      CUSTOMER: [],
      PARTNER: []
    }

    for (const ticket of tickets as BulkTicketItem[]) {
      const source = ticket.source?.toUpperCase() as TicketSource
      if (['EMPLOYEE', 'CUSTOMER', 'PARTNER'].includes(source)) {
        ticketsBySource[source].push(ticket.id)
      }
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process based on action
    switch (action) {
      case 'update_status': {
        if (!actionData?.status) {
          return NextResponse.json({ success: false, error: 'status is required' }, { status: 400 })
        }

        const updates: any = {
          status: actionData.status,
          updated_at: new Date().toISOString()
        }

        if (actionData.status === 'resolved') {
          updates.resolved_at = new Date().toISOString()
          updates.resolved_by = user.id
        } else if (actionData.status === 'closed') {
          updates.closed_at = new Date().toISOString()
          updates.closed_by = user.id
        }

        // Update each source
        for (const [source, ids] of Object.entries(ticketsBySource)) {
          if (ids.length === 0) continue

          const tableName = getTableName(source as TicketSource)
          const activityTable = getActivityTableName(source as TicketSource)

          const { error } = await supabase
            .from(tableName)
            .update(updates)
            .in('id', ids)

          if (error) {
            results.failed += ids.length
            results.errors.push(`Failed to update ${source} tickets: ${error.message}`)
          } else {
            results.success += ids.length

            // Log activity for each ticket
            const activityLogs = ids.map(id => ({
              ticket_id: id,
              action_type: 'status_changed',
              action_by: user.id,
              action_by_type: updaterType,
              action_by_name: updaterName,
              field_changed: 'status',
              new_value: actionData.status,
              description: `Status bulk updated to ${actionData.status}`
            }))

            await supabase.from(activityTable).insert(activityLogs)
          }
        }
        break
      }

      case 'update_priority': {
        if (!actionData?.priority) {
          return NextResponse.json({ success: false, error: 'priority is required' }, { status: 400 })
        }

        const updates = {
          priority: actionData.priority,
          updated_at: new Date().toISOString()
        }

        for (const [source, ids] of Object.entries(ticketsBySource)) {
          if (ids.length === 0) continue

          const tableName = getTableName(source as TicketSource)
          const activityTable = getActivityTableName(source as TicketSource)

          const { error } = await supabase
            .from(tableName)
            .update(updates)
            .in('id', ids)

          if (error) {
            results.failed += ids.length
            results.errors.push(`Failed to update ${source} tickets: ${error.message}`)
          } else {
            results.success += ids.length

            const activityLogs = ids.map(id => ({
              ticket_id: id,
              action_type: 'priority_changed',
              action_by: user.id,
              action_by_type: updaterType,
              action_by_name: updaterName,
              field_changed: 'priority',
              new_value: actionData.priority,
              description: `Priority bulk updated to ${actionData.priority}`
            }))

            await supabase.from(activityTable).insert(activityLogs)
          }
        }
        break
      }

      case 'assign': {
        if (!actionData?.assigned_to_id) {
          return NextResponse.json({ success: false, error: 'assigned_to_id is required' }, { status: 400 })
        }

        for (const [source, ids] of Object.entries(ticketsBySource)) {
          if (ids.length === 0) continue

          const tableName = getTableName(source as TicketSource)
          const activityTable = getActivityTableName(source as TicketSource)

          // Get appropriate field name based on source
          const assignFieldName = getAssignFieldName(source as TicketSource)

          const updates: any = {
            [assignFieldName]: actionData.assigned_to_id,
            updated_at: new Date().toISOString()
          }

          if (source === 'EMPLOYEE') {
            updates.status = 'assigned'
          }

          const { error } = await supabase
            .from(tableName)
            .update(updates)
            .in('id', ids)

          if (error) {
            results.failed += ids.length
            results.errors.push(`Failed to assign ${source} tickets: ${error.message}`)
          } else {
            results.success += ids.length

            const activityLogs = ids.map(id => ({
              ticket_id: id,
              action_type: 'assigned',
              action_by: user.id,
              action_by_type: updaterType,
              action_by_name: updaterName,
              new_value: actionData.assigned_to_id,
              description: `Bulk assigned`
            }))

            await supabase.from(activityTable).insert(activityLogs)
          }
        }
        break
      }

      case 'add_tags': {
        if (!actionData?.tags || !Array.isArray(actionData.tags)) {
          return NextResponse.json({ success: false, error: 'tags array is required' }, { status: 400 })
        }

        for (const ticket of tickets as BulkTicketItem[]) {
          const source = ticket.source.toUpperCase() as TicketSource

          for (const tagId of actionData.tags) {
            const { error } = await supabase.from('ticket_tag_assignments').insert({
              ticket_id: ticket.id,
              ticket_type: source,
              tag_id: tagId,
              assigned_by: user.id
            })

            if (!error) {
              results.success++
            } else if (!error.message.includes('duplicate')) {
              results.failed++
              results.errors.push(`Failed to add tag to ticket ${ticket.id}`)
            }
          }
        }
        break
      }

      case 'remove_tags': {
        if (!actionData?.tags || !Array.isArray(actionData.tags)) {
          return NextResponse.json({ success: false, error: 'tags array is required' }, { status: 400 })
        }

        const ticketIds = tickets.map((t: BulkTicketItem) => t.id)

        const { error } = await supabase
          .from('ticket_tag_assignments')
          .delete()
          .in('ticket_id', ticketIds)
          .in('tag_id', actionData.tags)

        if (error) {
          results.failed = tickets.length
          results.errors.push(`Failed to remove tags: ${error.message}`)
        } else {
          results.success = tickets.length
        }
        break
      }

      case 'close': {
        const updates = {
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          updated_at: new Date().toISOString()
        }

        for (const [source, ids] of Object.entries(ticketsBySource)) {
          if (ids.length === 0) continue

          const tableName = getTableName(source as TicketSource)
          const activityTable = getActivityTableName(source as TicketSource)

          const { error } = await supabase
            .from(tableName)
            .update(updates)
            .in('id', ids)

          if (error) {
            results.failed += ids.length
            results.errors.push(`Failed to close ${source} tickets: ${error.message}`)
          } else {
            results.success += ids.length

            const activityLogs = ids.map(id => ({
              ticket_id: id,
              action_type: 'status_changed',
              action_by: user.id,
              action_by_type: updaterType,
              action_by_name: updaterName,
              field_changed: 'status',
              new_value: 'closed',
              description: 'Ticket bulk closed'
            }))

            await supabase.from(activityTable).insert(activityLogs)
          }
        }
        break
      }

      case 'reopen': {
        const updates = {
          status: 'reopened',
          resolved_at: null,
          closed_at: null,
          updated_at: new Date().toISOString()
        }

        for (const [source, ids] of Object.entries(ticketsBySource)) {
          if (ids.length === 0) continue

          const tableName = getTableName(source as TicketSource)
          const activityTable = getActivityTableName(source as TicketSource)

          // First, increment reopened_count
          for (const id of ids) {
            await supabase.rpc('increment_field', {
              table_name: tableName,
              field_name: 'reopened_count',
              row_id: id
            }).catch(() => {
              // Ignore if RPC doesn't exist
            })
          }

          const { error } = await supabase
            .from(tableName)
            .update(updates)
            .in('id', ids)

          if (error) {
            results.failed += ids.length
            results.errors.push(`Failed to reopen ${source} tickets: ${error.message}`)
          } else {
            results.success += ids.length

            const activityLogs = ids.map(id => ({
              ticket_id: id,
              action_type: 'status_changed',
              action_by: user.id,
              action_by_type: updaterType,
              action_by_name: updaterName,
              field_changed: 'status',
              new_value: 'reopened',
              description: 'Ticket bulk reopened'
            }))

            await supabase.from(activityTable).insert(activityLogs)
          }
        }
        break
      }

      case 'export': {
        // Fetch all tickets for export
        const exportData: any[] = []

        for (const [source, ids] of Object.entries(ticketsBySource)) {
          if (ids.length === 0) continue

          const tableName = getTableName(source as TicketSource)

          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .in('id', ids)

          if (!error && data) {
            exportData.push(...data.map(t => ({
              ...t,
              ticket_source: source
            })))
            results.success += data.length
          } else {
            results.failed += ids.length
          }
        }

        return NextResponse.json({
          success: true,
          action: 'export',
          results,
          data: exportData
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      results
    })
  } catch (error) {
    apiLogger.error('Bulk API Error', error)
    logApiError(error as Error, request, { action: 'bulkTicketOperation' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getTableName(source: TicketSource): string {
  switch (source) {
    case 'EMPLOYEE': return 'support_tickets'
    case 'CUSTOMER': return 'customer_support_tickets'
    case 'PARTNER': return 'partner_support_tickets'
    default: throw new Error(`Unknown source: ${source}`)
  }
}

function getActivityTableName(source: TicketSource): string {
  switch (source) {
    case 'EMPLOYEE': return 'ticket_activity_log'
    case 'CUSTOMER': return 'customer_ticket_activity_log'
    case 'PARTNER': return 'partner_ticket_activity_log'
    default: throw new Error(`Unknown source: ${source}`)
  }
}

function getAssignFieldName(source: TicketSource): string {
  switch (source) {
    case 'EMPLOYEE': return 'assigned_user_id'
    case 'CUSTOMER': return 'assigned_to_customer_support_id'
    case 'PARTNER': return 'assigned_to_partner_support_id'
    default: throw new Error(`Unknown source: ${source}`)
  }
}
