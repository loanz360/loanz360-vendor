import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Validation schema for converting lead to deal
const convertToDealSchema = z.object({
  loan_type: z.string().min(1, 'Loan type is required'),
  loan_amount: z.number().positive('Loan amount must be positive'),
  loan_purpose: z.string().optional(),
  customer_name: z.string().min(2, 'Customer name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email().optional().nullable(),
  location: z.string().optional(),
  business_name: z.string().optional(),
  auto_assign_bde: z.boolean().default(true),
  specific_bde_id: z.string().uuid().optional(),
  conversion_notes: z.string().optional()
})

// Helper function to verify DSE role
async function verifyDSERole(supabase: any, userId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select('role, sub_role, full_name')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { isValid: false, error: 'User profile not found', profile: null }
  }

  if (profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
    return { isValid: false, error: 'Access denied. This feature is only available for Direct Sales Executives.', profile: null }
  }

  return { isValid: true, profile }
}

/**
 * POST - Convert a DSE lead to a deal (proposal)
 * This creates a new entry in crm_deals and updates the dse_leads table
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const { leadId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid || !roleCheck.profile) {
      return NextResponse.json({ success: false, error: roleCheck.error }, { status: 403 })
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = convertToDealSchema.parse(body)

    // Fetch the DSE lead
    const { data: dseLead, error: leadError } = await supabase
      .from('dse_leads')
      .select('*')
      .eq('id', leadId)
      .eq('dse_user_id', user.id)
      .maybeSingle()

    if (leadError || !dseLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found or access denied' },
        { status: 404 }
      )
    }

    // Check if already converted
    if (dseLead.converted_to_deal) {
      return NextResponse.json(
        { success: false, error: 'This lead has already been converted to a deal' },
        { status: 400 }
      )
    }

    // Auto-assign BDE if requested
    let assignedBdeId = validatedData.specific_bde_id || null
    let assignedBdeName = null

    if (validatedData.auto_assign_bde && !assignedBdeId) {
      // Call the auto-assign function
      const { data: assignResult, error: assignError } = await supabase
        .rpc('auto_assign_deal_to_bde', {
          p_loan_type: validatedData.loan_type,
          p_location: validatedData.location || dseLead.location || '',
          p_loan_amount: validatedData.loan_amount
        })

      if (!assignError && assignResult) {
        assignedBdeId = assignResult
      }
    }

    // Get BDE name if assigned
    if (assignedBdeId) {
      const { data: bde } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', assignedBdeId)
        .maybeSingle()

      if (bde) {
        assignedBdeName = bde.full_name
      }
    }

    // Fetch documents from the lead
    const { data: leadDocuments } = await supabase
      .from('dse_notes')
      .select('attachments')
      .eq('lead_id', leadId)
      .not('attachments', 'is', null)

    // Combine all attachments
    const documents = leadDocuments?.reduce((acc: any[], note) => {
      if (note.attachments && Array.isArray(note.attachments)) {
        return [...acc, ...note.attachments]
      }
      return acc
    }, []) || []

    // Create the deal in crm_deals
    const dealData = {
      customer_name: validatedData.customer_name,
      phone: validatedData.phone,
      email: validatedData.email || dseLead.email,
      location: validatedData.location || dseLead.location,
      loan_type: validatedData.loan_type,
      loan_amount: validatedData.loan_amount,
      loan_purpose: validatedData.loan_purpose || dseLead.loan_purpose,
      business_name: validatedData.business_name || dseLead.business_name,
      stage: 'docs_collected',
      status: 'in_progress',
      bde_id: assignedBdeId,
      cro_id: null, // Not originated from CRO
      source_type: 'dse',
      source_employee_id: user.id,
      source_lead_type: 'dse_lead',
      dse_lead_id: leadId,
      documents: documents,
      notes: validatedData.conversion_notes || `Converted from DSE lead by ${roleCheck.profile.full_name}`,
      assigned_at: assignedBdeId ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newDeal, error: dealCreateError } = await supabase
      .from('crm_deals')
      .insert(dealData)
      .select()
      .maybeSingle()

    if (dealCreateError) {
      apiLogger.error('Error creating deal', dealCreateError)
      return NextResponse.json(
        { success: false, error: 'Failed to create deal' },
        { status: 500 }
      )
    }

    if (!newDeal) {
      return NextResponse.json(
        { success: false, error: 'Deal creation returned no data' },
        { status: 500 }
      )
    }

    // Update the DSE lead to mark as converted (include dse_user_id filter to prevent IDOR)
    const { error: leadUpdateError } = await supabase
      .from('dse_leads')
      .update({
        converted_to_deal: true,
        converted_to_deal_at: new Date().toISOString(),
        deal_id: newDeal.id,
        assigned_bde_id: assignedBdeId,
        assigned_bde_name: assignedBdeName,
        lead_stage: 'Won',
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('dse_user_id', user.id)

    if (leadUpdateError) {
      apiLogger.error('Error updating lead', leadUpdateError)
      // Don't fail the request, deal is created
    }

    // Create initial stage history entry
    await supabase
      .from('deal_stage_history')
      .insert({
        deal_id: newDeal.id,
        from_stage: null,
        to_stage: 'docs_collected',
        from_status: null,
        to_status: 'in_progress',
        changed_by: user.id,
        changed_by_name: roleCheck.profile.full_name,
        change_reason: 'Deal created from DSE lead conversion',
        notes: validatedData.conversion_notes
      })

    // If BDE is assigned, create initial reminder
    if (assignedBdeId) {
      const reminderTime = new Date()
      reminderTime.setHours(reminderTime.getHours() + 3)

      await supabase
        .from('deal_update_reminders')
        .insert({
          deal_id: newDeal.id,
          bde_id: assignedBdeId,
          reminder_type: '3_hour',
          scheduled_at: reminderTime.toISOString(),
          priority: 'normal',
          status: 'pending'
        })
    }

    // Update customer status if exists (include dse_user_id filter to prevent IDOR)
    if (dseLead.customer_id) {
      await supabase
        .from('dse_customers')
        .update({
          customer_status: 'Customer',
          is_converted_to_lead: true,
          lead_id: leadId,
          updated_at: new Date().toISOString()
        })
        .eq('id', dseLead.customer_id)
        .eq('dse_user_id', user.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Lead successfully converted to deal',
      data: {
        deal_id: newDeal.id,
        bde_id: assignedBdeId,
        bde_name: assignedBdeName,
        assigned: !!assignedBdeId
      }
    })

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    apiLogger.error('Error in convert lead to deal', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
