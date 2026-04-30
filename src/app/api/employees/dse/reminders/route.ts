import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { validatePagination } from '@/lib/validations/dse-validation'


// Validation schema for reminders
const reminderSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  reminder_type: z.enum([
    'General', 'Follow-up Call', 'Meeting', 'Document Collection',
    'Payment Follow-up', 'Proposal Submission', 'Birthday', 'Anniversary', 'Custom'
  ]).default('General'),
  reminder_datetime: z.string().refine((val) => {
    const d = new Date(val)
    return !isNaN(d.getTime())
  }, { message: 'reminder_datetime must be a valid ISO date string' }),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: z.enum([
    'Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom'
  ]).optional().nullable(),
  recurrence_end_date: z.string().optional().nullable(),
  recurrence_count: z.number().optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  notify_before_minutes: z.number().default(15),
  notify_via_push: z.boolean().default(true),
  notify_via_email: z.boolean().default(false),
  notify_via_sms: z.boolean().default(false),
})

// GET - List reminders
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const leadId = searchParams.get('leadId')
    const status = searchParams.get('status') // No default - allow fetching all statuses
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))

    let query = supabase
      .from('dse_reminders')
      .select('*, dse_customers(full_name, company_name), dse_leads(customer_name, lead_stage)', { count: 'exact' })
      .eq('owner_id', user.id)
      .order('reminder_datetime', { ascending: true })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    // Only apply status filter if explicitly provided
    if (status) {
      query = query.eq('status', status)
    }

    if (dateFrom) {
      const parsedFrom = new Date(dateFrom)
      if (!isNaN(parsedFrom.getTime())) {
        query = query.gte('reminder_date', dateFrom)
      }
    }

    if (dateTo) {
      const parsedTo = new Date(dateTo)
      if (!isNaN(parsedTo.getTime())) {
        query = query.lte('reminder_date', dateTo)
      }
    }

    query = query.range(offset, offset + limit - 1)

    const { data: reminders, error, count } = await query

    if (error) throw error

    // Get today's reminders count
    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('dse_reminders')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('status', 'Active')
      .eq('reminder_date', today)

    // Get overdue reminders count
    const { count: overdueCount } = await supabase
      .from('dse_reminders')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('status', 'Active')
      .lt('reminder_datetime', new Date().toISOString())

    return NextResponse.json({
      success: true,
      data: {
        reminders,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        stats: {
          todayCount: todayCount || 0,
          overdueCount: overdueCount || 0
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a reminder
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const body = await request.json()
    const validatedData = reminderSchema.parse(body)

    // Verify ownership if customer_id or lead_id provided
    if (validatedData.customer_id) {
      const { data: customer, error } = await supabase
        .from('dse_customers')
        .select('dse_user_id')
        .eq('id', validatedData.customer_id)
        .maybeSingle()

      if (error || !customer || customer.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Customer not found or access denied' }, { status: 403 })
      }
    }

    if (validatedData.lead_id) {
      const { data: lead, error } = await supabase
        .from('dse_leads')
        .select('dse_user_id')
        .eq('id', validatedData.lead_id)
        .maybeSingle()

      if (error || !lead || lead.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Lead not found or access denied' }, { status: 403 })
      }
    }

    // Parse datetime for date extraction
    const reminderDatetime = new Date(validatedData.reminder_datetime)
    const reminderDate = reminderDatetime.toISOString().split('T')[0]
    const reminderTime = reminderDatetime.toTimeString().split(' ')[0]

    // Create reminder
    const { data: reminder, error: createError } = await supabase
      .from('dse_reminders')
      .insert({
        ...validatedData,
        owner_id: user.id,
        created_by: user.id,
        reminder_date: reminderDate,
        reminder_time: reminderTime,
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    if (!reminder) {
      apiLogger.error('Reminder insert returned null despite no error')
      return NextResponse.json(
        { success: false, error: 'Failed to create reminder' },
        { status: 500 }
      )
    }

    // Create audit log
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Reminder',
      entity_id: reminder.id,
      action: 'ReminderSet',
      new_values: reminder,
      user_id: user.id,
      changes_summary: `Set reminder: ${validatedData.title}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for reminder creation', auditError)
    }

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error creating reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
