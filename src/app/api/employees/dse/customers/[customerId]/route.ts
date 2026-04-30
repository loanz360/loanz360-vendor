import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'


// Validation schema for updating customer
const updateCustomerSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  company_name: z.string().max(255).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  department: z.string().max(150).optional().nullable(),
  primary_mobile: z.string().min(10).max(15).optional(),
  alternate_mobile: z.string().max(15).optional().nullable(),
  whatsapp_number: z.string().max(15).optional().nullable(),
  email: z.string().email().optional().nullable(),
  alternate_email: z.string().email().optional().nullable(),
  landline: z.string().max(20).optional().nullable(),
  address_line1: z.string().max(500).optional().nullable(),
  address_line2: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  country: z.string().max(100).optional(),
  business_type: z.enum([
    'Individual', 'Proprietorship', 'Partnership', 'LLP', 'Private Limited',
    'Public Limited', 'Government', 'NGO', 'Trust', 'Other'
  ]).optional().nullable(),
  industry: z.string().max(150).optional().nullable(),
  company_size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional().nullable(),
  annual_turnover: z.number().optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  linkedin_profile: z.string().max(500).optional().nullable(),
  source: z.enum([
    'Field Visit', 'Visiting Card', 'Referral', 'Cold Call', 'Exhibition',
    'Seminar', 'Digital Campaign', 'Walk-in', 'Partner Referral', 'Other'
  ]).optional(),
  referral_source: z.string().max(255).optional().nullable(),
  campaign_name: z.string().max(255).optional().nullable(),
  customer_status: z.enum([
    'New', 'Active', 'Prospect', 'Hot Lead', 'Warm Lead', 'Cold Lead',
    'Customer', 'Inactive', 'Lost', 'DNC'
  ]).optional(),
  tags: z.array(z.string()).optional().nullable(),
  custom_fields: z.record(z.string(), z.unknown()).optional().nullable(),
  customer_rating: z.number().min(1).max(5).optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  potential_value: z.number().optional().nullable(),
})

// Helper function to verify DSE role and customer ownership
async function verifyAccess(supabase: unknown, userId: string, customerId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return { isValid: false, error: 'Failed to verify user role', status: 500 }
  }

  if (!profile || profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
    return { isValid: false, error: 'Access denied', status: 403 }
  }

  const { data: customer, error } = await supabase
    .from('dse_customers')
    .select('id, customer_id, dse_user_id, full_name, company_name, designation, department, primary_mobile, alternate_mobile, whatsapp_number, email, alternate_email, landline, address_line1, address_line2, city, state, pincode, country, business_type, industry, company_size, annual_turnover, website, linkedin_profile, source, referral_source, campaign_name, customer_status, tags, custom_fields, customer_rating, priority, potential_value, first_visit_date, last_visit_date, total_visits, notes_count, meetings_count, visit_location, visit_latitude, visit_longitude, visit_address, visiting_card_front_url, visiting_card_back_url, visiting_card_captured_at, visiting_card_ocr_data, is_deleted, created_at, updated_at')
    .eq('id', customerId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error) {
    return { isValid: false, error: 'Failed to fetch customer', status: 500 }
  }

  if (!customer) {
    return { isValid: false, error: 'Customer not found', status: 404 }
  }

  if (customer.dse_user_id !== userId) {
    return { isValid: false, error: 'You do not have access to this customer', status: 403 }
  }

  return { isValid: true, customer }
}

// GET - Get single customer with related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { customerId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const access = await verifyAccess(supabase, user.id, customerId)
    if (!access.isValid) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status })
    }

    // Fetch related data - add dse_user_id filter for defense-in-depth
    const [
      { data: notes },
      { data: visits },
      { data: meetings },
      { data: reminders },
      { data: leads }
    ] = await Promise.all([
      supabase
        .from('dse_notes')
        .select('id, customer_id, lead_id, visit_id, meeting_id, note_type, title, content, is_voice_note, key_points, action_items, is_pinned, tags, created_at')
        .eq('customer_id', customerId)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('dse_visits')
        .select('id, customer_id, visit_date, visit_time, visit_type, visit_purpose, check_in_latitude, check_in_longitude, check_in_address, outcome, outcome_notes, created_at')
        .eq('customer_id', customerId)
        .eq('dse_user_id', user.id)
        .order('visit_date', { ascending: false })
        .limit(10),
      supabase
        .from('dse_meetings')
        .select('id, customer_id, title, meeting_type, meeting_purpose, scheduled_date, start_time, end_time, status, location_type, location_address, created_at')
        .eq('customer_id', customerId)
        .eq('organizer_id', user.id)
        .order('scheduled_date', { ascending: false })
        .limit(10),
      supabase
        .from('dse_reminders')
        .select('id, customer_id, title, description, reminder_type, reminder_datetime, reminder_date, reminder_time, priority, status, created_at')
        .eq('customer_id', customerId)
        .eq('owner_id', user.id)
        .eq('status', 'Active')
        .order('reminder_datetime', { ascending: true })
        .limit(5),
      // Use .select() without .maybeSingle() to avoid throwing on multiple leads
      supabase
        .from('dse_leads')
        .select('id, lead_id, customer_id, customer_name, lead_stage, status, loan_type, loan_amount, created_at')
        .eq('customer_id', customerId)
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    return NextResponse.json({
      success: true,
      data: {
        customer: access.customer,
        recentNotes: notes || [],
        recentVisits: visits || [],
        upcomingMeetings: meetings || [],
        activeReminders: reminders || [],
        leads: leads || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching customer', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { customerId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const access = await verifyAccess(supabase, user.id, customerId)
    if (!access.isValid) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateCustomerSchema.parse(body)

    // Check for duplicate mobile if being changed
    if (validatedData.primary_mobile && validatedData.primary_mobile !== access.customer.primary_mobile) {
      const { data: existing } = await supabase
        .from('dse_customers')
        .select('id')
        .eq('dse_user_id', user.id)
        .eq('primary_mobile', validatedData.primary_mobile)
        .eq('is_deleted', false)
        .neq('id', customerId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Another customer with this mobile number already exists' },
          { status: 409 }
        )
      }
    }

    // Update customer (include dse_user_id filter to prevent IDOR)
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('dse_customers')
      .update(validatedData)
      .eq('id', customerId)
      .eq('dse_user_id', user.id)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!updatedCustomer) {
      return NextResponse.json(
        { success: false, error: 'Failed to update customer' },
        { status: 500 }
      )
    }

    // Create audit log
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Customer',
      entity_id: customerId,
      action: 'Updated',
      old_values: access.customer,
      new_values: updatedCustomer,
      user_id: user.id,
      changes_summary: `Updated customer: ${updatedCustomer.full_name}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for customer update', auditError)
    }

    return NextResponse.json({
      success: true,
      data: updatedCustomer,
      message: 'Customer updated successfully'
    })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    apiLogger.error('Error updating customer', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { customerId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const access = await verifyAccess(supabase, user.id, customerId)
    if (!access.isValid) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status })
    }

    // Check for active leads before allowing delete
    const { data: activeLeads, error: leadsError } = await supabase
      .from('dse_leads')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('dse_user_id', user.id)
      .eq('is_deleted', false)
      .in('status', ['Active', 'In Progress', 'Submitted'])

    if (leadsError) {
      apiLogger.error('Error checking active leads before delete', leadsError)
    }

    if (activeLeads && activeLeads.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete customer with active leads. Please close or delete the leads first.' },
        { status: 409 }
      )
    }

    // Soft delete (include dse_user_id filter to prevent IDOR)
    const { error: deleteError } = await supabase
      .from('dse_customers')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', customerId)
      .eq('dse_user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    // Create audit log
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Customer',
      entity_id: customerId,
      action: 'Deleted',
      old_values: access.customer,
      user_id: user.id,
      changes_summary: `Deleted customer: ${access.customer.full_name}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for customer deletion', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting customer', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
