import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Helper function to verify DSM role
async function verifyDSMRole(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { isValid: false, error: 'User profile not found' }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_MANAGER') {
    return { isValid: false, error: 'Access denied. This feature is only available for Direct Sales Managers.' }
  }

  return { isValid: true, profile }
}

// Helper function to get DSM's team member IDs
async function getTeamMemberIds(supabase: any, dsmUserId: string) {
  const { data: teamMembers, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'EMPLOYEE')
    .eq('sub_role', 'DIRECT_SALES_EXECUTIVE')
    .eq('manager_user_id', dsmUserId)

  if (error) {
    throw new Error('Failed to fetch team members')
  }

  return teamMembers?.map(member => member.id) || []
}

// POST - Convert team customer to lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const { customerId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSM role
    const roleCheck = await verifyDSMRole(supabase, user.id)
    if (!roleCheck.isValid) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Get team member IDs
    const teamMemberIds = await getTeamMemberIds(supabase, user.id)

    // Get customer and verify it belongs to DSM's team
    const { data: customer, error: customerError } = await supabase
      .from('dse_customers')
      .select('*')
      .eq('id', customerId)
      .in('dse_user_id', teamMemberIds)
      .eq('is_deleted', false)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json({ success: false, error: 'Customer not found in your team' }, { status: 404 })
    }

    // Check if already converted
    if (customer.is_converted_to_lead) {
      const { data: existingLead } = await supabase
        .from('dse_leads')
        .select('id, lead_id, lead_stage')
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .maybeSingle()

      return NextResponse.json(
        {
          success: false,
          error: 'Customer is already converted to a lead',
          existingLead
        },
        { status: 409 }
      )
    }

    // Create lead (assigned to the original DSE)
    const { data: lead, error: leadError } = await supabase
      .from('dse_leads')
      .insert({
        customer_id: customerId,
        dse_user_id: customer.dse_user_id, // Keep original DSE as owner
        customer_name: customer.full_name,
        company_name: customer.company_name,
        designation: customer.designation,
        mobile: customer.primary_mobile,
        email: customer.email,
        city: customer.city,
        state: customer.state,
        lead_type: 'Other', // Default value
        lead_stage: 'New',
        lead_score: 20,
        probability_percentage: 50,
      })
      .select()
      .maybeSingle()

    if (leadError) {
      throw leadError
    }

    // Update customer
    const { error: updateError } = await supabase
      .from('dse_customers')
      .update({
        is_converted_to_lead: true,
        lead_id: lead.id,
        converted_to_lead_at: new Date().toISOString(),
        customer_status: 'Prospect'
      })
      .eq('id', customerId)

    if (updateError) {
      throw updateError
    }

    // Create audit logs
    await Promise.all([
      supabase.from('dse_audit_log').insert({
        entity_type: 'Customer',
        entity_id: customerId,
        action: 'Converted',
        new_values: { lead_id: lead.id, converted_by_dsm: true },
        user_id: user.id,
        changes_summary: `DSM converted customer ${customer.full_name} to lead`
      }),
      supabase.from('dse_audit_log').insert({
        entity_type: 'Lead',
        entity_id: lead.id,
        action: 'Created',
        new_values: lead,
        user_id: user.id,
        changes_summary: `Lead created from customer ${customer.full_name} by DSM`
      }),
      supabase.from('dse_lead_stage_history').insert({
        lead_id: lead.id,
        to_stage: 'New',
        changed_by: user.id,
        reason: 'Lead created by DSM from customer conversion'
      }),
      supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'CONVERT_TEAM_CUSTOMER_TO_LEAD',
        resource_type: 'dse_customer',
        resource_id: customerId,
        details: {
          customer_id: customer.customer_id,
          lead_id: lead.id,
          dse_user_id: customer.dse_user_id,
          converted_by: 'DSM'
        }
      })
    ])

    return NextResponse.json({
      success: true,
      data: lead,
      message: 'Customer successfully converted to lead'
    }, { status: 201 })

  } catch (error: unknown) {
    apiLogger.error('Error converting customer to lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
