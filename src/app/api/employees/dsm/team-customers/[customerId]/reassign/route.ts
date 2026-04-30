import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Validation schema for reassignment
const reassignSchema = z.object({
  new_dse_user_id: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
})

// Helper function to verify DSM role
async function verifyDSMRole(supabase: unknown, userId: string) {
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
async function getTeamMemberIds(supabase: unknown, dsmUserId: string) {
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

// POST - Reassign customer to another DSE in the team
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

    if (teamMemberIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You have no team members to reassign to' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = reassignSchema.parse(body)

    // Verify the new DSE is in the DSM's team
    if (!teamMemberIds.includes(validatedData.new_dse_user_id)) {
      return NextResponse.json(
        { success: false, error: 'The specified DSE is not in your team' },
        { status: 403 }
      )
    }

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

    // Check if already assigned to the same DSE
    if (customer.dse_user_id === validatedData.new_dse_user_id) {
      return NextResponse.json(
        { success: false, error: 'Customer is already assigned to this DSE' },
        { status: 400 }
      )
    }

    // Get old and new DSE details for audit log
    const { data: oldDSE } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', customer.dse_user_id)
      .maybeSingle()

    const { data: newDSE } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', validatedData.new_dse_user_id)
      .maybeSingle()

    // Update customer assignment
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('dse_customers')
      .update({
        dse_user_id: validatedData.new_dse_user_id,
        reassigned_at: new Date().toISOString(),
        reassigned_by: user.id,
      })
      .eq('id', customerId)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // Create audit logs
    await Promise.all([
      supabase.from('dse_audit_log').insert({
        entity_type: 'Customer',
        entity_id: customerId,
        action: 'Reassigned',
        old_values: { dse_user_id: customer.dse_user_id, dse_name: oldDSE?.full_name },
        new_values: { dse_user_id: validatedData.new_dse_user_id, dse_name: newDSE?.full_name },
        user_id: user.id,
        changes_summary: `Customer ${customer.full_name} reassigned from ${oldDSE?.full_name} to ${newDSE?.full_name} by DSM${validatedData.reason ? `: ${validatedData.reason}` : ''}`
      }),
      supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'REASSIGN_TEAM_CUSTOMER',
        resource_type: 'dse_customer',
        resource_id: customerId,
        details: {
          customer_id: customer.customer_id,
          old_dse_user_id: customer.dse_user_id,
          old_dse_name: oldDSE?.full_name,
          new_dse_user_id: validatedData.new_dse_user_id,
          new_dse_name: newDSE?.full_name,
          reason: validatedData.reason,
          reassigned_by: 'DSM'
        }
      })
    ])

    // If customer has associated lead, reassign that too
    if (customer.is_converted_to_lead && customer.lead_id) {
      await supabase
        .from('dse_leads')
        .update({
          dse_user_id: validatedData.new_dse_user_id,
          reassigned_at: new Date().toISOString(),
          reassigned_by: user.id,
        })
        .eq('id', customer.lead_id)

      await supabase.from('dse_audit_log').insert({
        entity_type: 'Lead',
        entity_id: customer.lead_id,
        action: 'Reassigned',
        old_values: { dse_user_id: customer.dse_user_id },
        new_values: { dse_user_id: validatedData.new_dse_user_id },
        user_id: user.id,
        changes_summary: `Lead reassigned along with customer ${customer.full_name}`
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedCustomer,
      message: `Customer successfully reassigned to ${newDSE?.full_name}`
    })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }

    apiLogger.error('Error reassigning customer', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
