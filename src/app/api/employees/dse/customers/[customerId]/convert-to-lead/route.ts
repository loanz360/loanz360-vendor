import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { calculateLeadScore } from '@/lib/validations/dse-validation'

export const dynamic = 'force-dynamic'

// Validation schema for lead conversion
const convertToLeadSchema = z.object({
  lead_type: z.enum([
    'Business Loan', 'Personal Loan', 'Home Loan', 'Auto Loan',
    'Education Loan', 'Mortgage', 'Insurance', 'Investment', 'Other'
  ]),
  product_interest: z.string().max(255).optional(),
  estimated_value: z.number().optional(),
  probability_percentage: z.number().min(0).max(100).default(50),
  expected_close_date: z.string().optional(), // ISO date string
  requirements: z.string().optional(),
  pain_points: z.string().optional(),
  budget_range: z.string().max(100).optional(),
  decision_timeline: z.string().max(100).optional(),
  decision_makers: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().max(100).optional(),
})

// POST - Convert customer to lead
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

    // Verify DSE role using shared utility
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    // ATOMIC: Try to set is_converted_to_lead = true only if currently false.
    // This prevents race conditions where two concurrent requests could both
    // see is_converted_to_lead = false and create duplicate leads.
    const { data: updated, error: updateError } = await supabase
      .from('dse_customers')
      .update({ is_converted_to_lead: true, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('dse_user_id', user.id) // Defense-in-depth: ensure DSE owns this customer
      .eq('is_converted_to_lead', false) // Atomic check - only update if not already converted
      .eq('is_deleted', false)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Failed to atomically update customer for conversion', updateError)
      return NextResponse.json({ success: false, error: 'Failed to convert customer' }, { status: 500 })
    }

    if (!updated) {
      // Edge case: is_converted_to_lead might be true but the lead was soft-deleted.
      // In that scenario the customer appears "stuck" as converted. We check for this
      // and provide a more helpful error message. A future enhancement could allow
      // re-conversion if the original lead was soft-deleted.
      const { data: customer } = await supabase
        .from('dse_customers')
        .select('id, is_converted_to_lead, is_deleted')
        .eq('id', customerId)
        .eq('dse_user_id', user.id)
        .maybeSingle()

      if (!customer || customer.is_deleted) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 })
      }

      if (customer.is_converted_to_lead) {
        // Check if the associated lead still exists (not soft-deleted)
        const { data: existingLead } = await supabase
          .from('dse_leads')
          .select('id, lead_id, lead_stage, is_deleted')
          .eq('customer_id', customerId)
          .maybeSingle()

        if (existingLead && existingLead.is_deleted) {
          // Stale state: lead was soft-deleted but customer still marked as converted.
          // For now, return a descriptive error. Could be enhanced to allow re-conversion.
          return NextResponse.json({
            success: false,
            error: 'Customer was previously converted but the lead was deleted. Please contact support to re-convert.',
          }, { status: 409 })
        }

        return NextResponse.json({
          success: false,
          error: 'Customer is already converted to a lead',
          existingLead: existingLead ? { id: existingLead.id, lead_id: existingLead.lead_id, lead_stage: existingLead.lead_stage } : null,
        }, { status: 409 })
      }

      return NextResponse.json({ success: false, error: 'Customer not found or already converted' }, { status: 409 })
    }

    // The atomic update succeeded - customer is now marked as converted.
    // Proceed to create the lead.
    const customer = updated

    const body = await request.json()
    const validatedData = convertToLeadSchema.parse(body)

    // Calculate dynamic lead score instead of hardcoded value
    const leadScore = calculateLeadScore({
      has_name: !!customer.full_name,
      has_mobile: !!customer.primary_mobile,
      has_email: !!customer.email,
      has_location: !!customer.city,
      has_employment_details: false,
      has_documents: false,
      response_time_hours: null,
      total_interactions: 0,
      customer_initiated_contact: false,
      document_submission_speed_days: null,
      loan_amount: validatedData.estimated_value ?? null,
      product_min_amount: null,
      product_max_amount: null,
      source_type: validatedData.source || 'DSE',
      days_since_creation: 0,
    })

    // Create lead
    const { data: lead, error: leadError } = await supabase
      .from('dse_leads')
      .insert({
        customer_id: customerId,
        dse_user_id: user.id,
        customer_name: customer.full_name,
        company_name: customer.company_name,
        designation: customer.designation,
        mobile: customer.primary_mobile,
        email: customer.email,
        city: customer.city,
        state: customer.state,
        lead_type: validatedData.lead_type,
        product_interest: validatedData.product_interest,
        estimated_value: validatedData.estimated_value,
        probability_percentage: validatedData.probability_percentage,
        expected_close_date: validatedData.expected_close_date,
        requirements: validatedData.requirements,
        pain_points: validatedData.pain_points,
        budget_range: validatedData.budget_range,
        decision_timeline: validatedData.decision_timeline,
        decision_makers: validatedData.decision_makers,
        tags: validatedData.tags,
        lead_stage: 'New',
        lead_score: leadScore,
      })
      .select()
      .maybeSingle()

    // Null check after insert
    if (leadError || !lead) {
      apiLogger.error('Failed to create lead from customer conversion', { customerId, error: leadError })
      // Rollback the customer conversion flag since lead creation failed
      await supabase
        .from('dse_customers')
        .update({ is_converted_to_lead: false, updated_at: new Date().toISOString() })
        .eq('id', customerId)
        .eq('dse_user_id', user.id)
      return NextResponse.json({ success: false, error: 'Failed to create lead' }, { status: 500 })
    }

    // Update customer with the lead_id and conversion timestamp
    const { error: linkError } = await supabase
      .from('dse_customers')
      .update({
        lead_id: lead.id,
        converted_to_lead_at: new Date().toISOString(),
        customer_status: 'Prospect'
      })
      .eq('id', customerId)
      .eq('dse_user_id', user.id) // Defense-in-depth

    if (linkError) {
      apiLogger.error('Failed to link lead to customer after conversion', { customerId, leadId: lead.id, error: linkError })
    }

    // Create audit logs and stage history with error checking
    const auditResults = await Promise.all([
      supabase.from('dse_audit_log').insert({
        entity_type: 'Customer',
        entity_id: customerId,
        action: 'Converted',
        new_values: { lead_id: lead.id },
        user_id: user.id,
        changes_summary: `Converted customer ${customer.full_name} to lead`
      }),
      supabase.from('dse_audit_log').insert({
        entity_type: 'Lead',
        entity_id: lead.id,
        action: 'Created',
        new_values: lead,
        user_id: user.id,
        changes_summary: `Created lead from customer ${customer.full_name}`
      }),
      supabase.from('dse_lead_stage_history').insert({
        lead_id: lead.id,
        to_stage: 'New',
        changed_by: user.id,
        reason: 'Lead created from customer conversion'
      })
    ])

    // Log any audit/history failures (non-blocking)
    auditResults.forEach((result, index) => {
      if (result.error) {
        const labels = ['customer audit log', 'lead audit log', 'stage history']
        apiLogger.error(`Failed to create ${labels[index]} for conversion`, {
          customerId,
          leadId: lead.id,
          error: result.error,
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: lead,
      message: 'Customer successfully converted to lead'
    }, { status: 201 })

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

    apiLogger.error('Error converting customer to lead', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
