import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Validation schema for updating lead
const updateLeadSchema = z.object({
  customer_name: z.string().min(2).max(255).optional(),
  company_name: z.string().max(255).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  mobile: z.string().min(10).max(15).optional(),
  email: z.string().email().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  lead_type: z.enum([
    'Business Loan', 'Personal Loan', 'Home Loan', 'Auto Loan',
    'Education Loan', 'Mortgage', 'Insurance', 'Investment', 'Other'
  ]).optional(),
  product_interest: z.string().max(255).optional().nullable(),
  estimated_value: z.number().optional().nullable(),
  probability_percentage: z.number().min(0).max(100).optional(),
  expected_close_date: z.string().optional().nullable(),
  lead_stage: z.enum([
    'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation',
    'Won', 'Lost', 'On Hold', 'Nurturing'
  ]).optional(),
  requirements: z.string().optional().nullable(),
  pain_points: z.string().optional().nullable(),
  budget_range: z.string().max(100).optional().nullable(),
  decision_timeline: z.string().max(100).optional().nullable(),
  decision_makers: z.string().optional().nullable(),
  competitors: z.array(z.string()).optional().nullable(),
  competitor_products: z.string().optional().nullable(),
  stage_notes: z.string().optional().nullable(),
  lost_reason: z.string().max(255).optional().nullable(),
  won_reason: z.string().max(255).optional().nullable(),
  next_followup_at: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
})

// Helper to verify lead access
async function verifyLeadAccess(supabase: unknown, userId: string, leadId: string) {
  const { data: lead, error } = await supabase
    .from('dse_leads')
    .select('*')
    .eq('id', leadId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error || !lead) {
    return { isValid: false, error: 'Lead not found', status: 404 }
  }

  if (lead.dse_user_id !== userId) {
    return { isValid: false, error: 'Access denied', status: 403 }
  }

  return { isValid: true, lead }
}

// GET - Get single lead with history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { leadId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const access = await verifyLeadAccess(supabase, user.id, leadId)
    if (!access.isValid) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status })
    }

    // Fetch related data
    const [
      { data: customer },
      { data: notes },
      { data: meetings },
      { data: reminders },
      { data: stageHistory }
    ] = await Promise.all([
      access.lead.customer_id
        ? supabase.from('dse_customers').select('*').eq('id', access.lead.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('dse_notes')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('dse_meetings')
        .select('*')
        .eq('lead_id', leadId)
        .order('scheduled_date', { ascending: false })
        .limit(10),
      supabase
        .from('dse_reminders')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'Active')
        .order('reminder_datetime', { ascending: true })
        .limit(5),
      supabase
        .from('dse_lead_stage_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('changed_at', { ascending: false })
    ])

    return NextResponse.json({
      success: true,
      data: {
        lead: access.lead,
        customer,
        notes: notes || [],
        meetings: meetings || [],
        activeReminders: reminders || [],
        stageHistory: stageHistory || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update lead
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { leadId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const access = await verifyLeadAccess(supabase, user.id, leadId)
    if (!access.isValid) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status })
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = updateLeadSchema.parse(body)

    // Check if stage is changing
    const isStageChanging = validatedData.lead_stage && validatedData.lead_stage !== access.lead.lead_stage

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('dse_leads')
      .update({
        ...validatedData,
        last_contacted_at: new Date().toISOString(),
        contact_attempts: (access.lead.contact_attempts || 0) + 1
      })
      .eq('id', leadId)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    if (!updatedLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found after update' },
        { status: 404 }
      )
    }

    // If stage changed, record in history
    if (isStageChanging) {
      await supabase.from('dse_lead_stage_history').insert({
        lead_id: leadId,
        from_stage: access.lead.lead_stage,
        to_stage: validatedData.lead_stage,
        changed_by: user.id,
        reason: validatedData.stage_notes || null,
        notes: validatedData.lost_reason || validatedData.won_reason || null
      })

      // If Won, update converted values
      if (validatedData.lead_stage === 'Won') {
        await supabase
          .from('dse_leads')
          .update({
            converted_at: new Date().toISOString(),
            converted_value: access.lead.estimated_value
          })
          .eq('id', leadId)

        // Update customer status if linked
        if (access.lead.customer_id) {
          await supabase
            .from('dse_customers')
            .update({ customer_status: 'Customer' })
            .eq('id', access.lead.customer_id)
        }
      }
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Lead',
      entity_id: leadId,
      action: isStageChanging ? 'StageChanged' : 'Updated',
      old_values: access.lead,
      new_values: updatedLead,
      user_id: user.id,
      changes_summary: isStageChanging
        ? `Stage changed from ${access.lead.lead_stage} to ${validatedData.lead_stage}`
        : `Updated lead: ${updatedLead.customer_name}`
    })

    return NextResponse.json({
      success: true,
      data: updatedLead,
      message: isStageChanging
        ? `Lead moved to ${validatedData.lead_stage}`
        : 'Lead updated successfully'
    })

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

    apiLogger.error('Error updating lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { leadId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const access = await verifyLeadAccess(supabase, user.id, leadId)
    if (!access.isValid) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('dse_leads')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', leadId)

    if (deleteError) throw deleteError

    // Update customer if linked
    if (access.lead.customer_id) {
      await supabase
        .from('dse_customers')
        .update({
          is_converted_to_lead: false,
          lead_id: null
        })
        .eq('id', access.lead.customer_id)
    }

    // Create audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Lead',
      entity_id: leadId,
      action: 'Deleted',
      old_values: access.lead,
      user_id: user.id,
      changes_summary: `Deleted lead: ${access.lead.customer_name}`
    })

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
