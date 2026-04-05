import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'

export const dynamic = 'force-dynamic'

// ISO date regex (YYYY-MM-DD)
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

// Validation schema for visits
const visitSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  visit_date: z.string().regex(isoDateRegex, 'visit_date must be a valid ISO date (YYYY-MM-DD)'),
  visit_time: z.string().optional().nullable(),
  visit_type: z.enum([
    'In Person', 'Phone Call', 'Video Call', 'WhatsApp', 'Email', 'Other'
  ]).default('In Person'),
  visit_purpose: z.enum([
    'Introduction', 'Follow-up', 'Product Demo', 'Proposal Discussion',
    'Negotiation', 'Document Collection', 'Relationship Building',
    'Issue Resolution', 'Payment Collection', 'Other'
  ]).optional().nullable(),
  check_in_latitude: z.number().optional().nullable(),
  check_in_longitude: z.number().optional().nullable(),
  check_in_address: z.string().optional().nullable(),
  outcome: z.enum([
    'Successful', 'Partially Successful', 'Rescheduled', 'Not Met',
    'Not Available', 'Wrong Address', 'Cancelled', 'Pending'
  ]).optional().nullable(),
  outcome_notes: z.string().optional().nullable(),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z.string().optional().nullable(),
  follow_up_notes: z.string().optional().nullable(),
  photos: z.array(z.object({
    url: z.string(),
    type: z.string().optional(),
    caption: z.string().optional()
  })).optional().nullable(),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string().optional()
  })).optional().nullable(),
})

// GET - List visits
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
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const outcome = searchParams.get('outcome')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('dse_visits')
      .select('*, dse_customers(full_name, company_name), dse_leads(customer_name)', { count: 'exact' })
      .eq('dse_user_id', user.id)
      .order('visit_date', { ascending: false })
      .order('visit_time', { ascending: false })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    if (dateFrom) {
      query = query.gte('visit_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('visit_date', dateTo)
    }

    if (outcome) {
      query = query.eq('outcome', outcome)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: visits, error, count } = await query

    if (error) throw error

    // Get today's visits count
    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('dse_visits')
      .select('*', { count: 'exact', head: true })
      .eq('dse_user_id', user.id)
      .eq('visit_date', today)

    return NextResponse.json({
      success: true,
      data: {
        visits,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        stats: {
          todayVisits: todayCount || 0
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching visits', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Record a visit
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
    const validatedData = visitSchema.parse(body)

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

    // Create visit with check-in time
    const { data: visit, error: createError } = await supabase
      .from('dse_visits')
      .insert({
        ...validatedData,
        dse_user_id: user.id,
        check_in_time: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    if (!visit) {
      return NextResponse.json({ success: false, error: 'Failed to create visit' }, { status: 500 })
    }

    // Update customer last visit date and total_visits using two-step approach
    if (validatedData.customer_id) {
      // Step 1: Get current total_visits
      const { data: currentCustomer } = await supabase
        .from('dse_customers')
        .select('total_visits')
        .eq('id', validatedData.customer_id)
        .eq('dse_user_id', user.id)
        .maybeSingle()

      // Step 2: Update with incremented value
      if (currentCustomer) {
        await supabase
          .from('dse_customers')
          .update({
            last_visit_date: validatedData.visit_date,
            total_visits: (currentCustomer.total_visits || 0) + 1
          })
          .eq('id', validatedData.customer_id)
          .eq('dse_user_id', user.id)
      }
    }

    // Create follow-up reminder if required
    if (validatedData.follow_up_required && validatedData.follow_up_date) {
      const { error: reminderError } = await supabase.from('dse_reminders').insert({
        customer_id: validatedData.customer_id,
        lead_id: validatedData.lead_id,
        owner_id: user.id,
        created_by: user.id,
        title: 'Follow-up from visit',
        description: validatedData.follow_up_notes,
        reminder_type: 'Follow-up Call',
        reminder_datetime: `${validatedData.follow_up_date}T09:00:00`,
        reminder_date: validatedData.follow_up_date,
        reminder_time: '09:00:00',
        priority: 'Medium',
      })

      if (reminderError) {
        apiLogger.error('Failed to create follow-up reminder for visit', reminderError)
      }
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Visit',
      entity_id: visit.id,
      action: 'VisitRecorded',
      new_values: visit,
      user_id: user.id,
      changes_summary: `Recorded ${validatedData.visit_type} visit`
    })

    return NextResponse.json({
      success: true,
      data: visit,
      message: 'Visit recorded successfully'
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

    apiLogger.error('Error recording visit', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
