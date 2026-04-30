import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createFollowUpTasks, FOLLOW_UP_SEQUENCES } from '@/lib/automation/follow-up-sequences'
import { apiLogger } from '@/lib/utils/logger'
import { verifyCROAuth } from '@/lib/api/ai-crm-middleware'


/**
 * AI-CRM Follow-up SEQUENCES API
 * Uses tasks_reminders table for automated multi-step follow-up sequences
 * NOT the same as /api/crm/followups which handles manual CRO follow-ups
 *
 * The main follow-ups API is /api/crm/followups (crm_followups table).
 * This endpoint operates on the `tasks_reminders` table for auto-generated
 * follow-up sequences. New manual follow-up features should be added to
 * /api/crm/followups, not here.
 */

/**
 * GET /api/ai-crm/cro/follow-ups
 *
 * Returns pending follow-up tasks for the CRO, including
 * auto-generated sequence tasks and manually created ones.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Verify CRO role
    const authResult = await verifyCROAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const days = parseInt(searchParams.get('days') || '7', 10)

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)

    let query = supabase
      .from('tasks_reminders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', status)
      .lte('due_date', endDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .order('due_time', { ascending: true })
      .limit(50)

    const { data: tasks, error } = await query

    if (error) {
      apiLogger.error('Error fetching follow-up tasks:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch follow-up tasks', data: [] }, { status: 500 })
    }

    // Group tasks: today, tomorrow, this week
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    const grouped = {
      overdue: (tasks || []).filter((t) => t.due_date < today),
      today: (tasks || []).filter((t) => t.due_date === today),
      tomorrow: (tasks || []).filter((t) => t.due_date === tomorrow),
      upcoming: (tasks || []).filter((t) => t.due_date > tomorrow),
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasks || [],
        grouped,
        total: tasks?.length || 0,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ai-crm/cro/follow-ups
 *
 * Creates a follow-up sequence for a contact or lead.
 *
 * Body: {
 *   entity_id: string,
 *   entity_type: 'contact' | 'lead',
 *   sequence_key: string, // e.g., 'new_contact', 'lead_docs_pending'
 *   customer_name: string,
 *   customer_phone?: string,
 *   loan_type?: string,
 *   loan_amount?: number,
 * }
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Verify CRO role
    const authResult = await verifyCROAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body: unknown    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const { entity_id, entity_type, sequence_key, customer_name, customer_phone, loan_type, loan_amount } = body

    if (!entity_id || !entity_type || !sequence_key || !customer_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!FOLLOW_UP_SEQUENCES[sequence_key]) {
      return NextResponse.json(
        { success: false, error: `Invalid sequence: ${sequence_key}. Valid: ${Object.keys(FOLLOW_UP_SEQUENCES).join(', ')}` },
        { status: 400 }
      )
    }

    // Create follow-up tasks
    const tasks = createFollowUpTasks(sequence_key, {
      userId: user.id,
      entityId: entity_id,
      entityType: entity_type,
      customerName: customer_name,
      customerPhone: customer_phone,
      loanType: loan_type,
      loanAmount: loan_amount,
    })

    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tasks generated for this sequence' },
        { status: 400 }
      )
    }

    // Insert tasks
    const { data: inserted, error } = await supabase
      .from('tasks_reminders')
      .insert(tasks)
      .select()

    if (error) {
      apiLogger.error('Error creating follow-up tasks:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create follow-up tasks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks_created: inserted?.length || 0,
        sequence: FOLLOW_UP_SEQUENCES[sequence_key].name,
      },
      message: `Follow-up sequence "${FOLLOW_UP_SEQUENCES[sequence_key].name}" created with ${inserted?.length || 0} tasks`,
    })
  } catch (error) {
    apiLogger.error('Error in follow-ups POST:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ai-crm/cro/follow-ups
 *
 * Mark a follow-up task as completed.
 * Body: { task_id: string, completed_notes?: string }
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Verify CRO role
    const authResult = await verifyCROAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body: unknown    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    const { task_id, completed_notes } = body

    if (!task_id) {
      return NextResponse.json(
        { success: false, error: 'Missing task_id' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tasks_reminders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_notes: completed_notes || null,
      })
      .eq('id', task_id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Task not found or unauthorized' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Task completed',
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
