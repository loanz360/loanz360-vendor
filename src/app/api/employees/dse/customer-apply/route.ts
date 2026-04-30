import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


const customerApplySchema = z.object({
  customer_name: z.string().min(2).max(255),
  customer_mobile: z.string().min(10).max(15),
  customer_email: z.string().email().optional().nullable(),
  customer_city: z.string().max(100).optional().nullable(),
  customer_state: z.string().max(100).optional().nullable(),
  customer_pincode: z.string().max(10).optional().nullable(),
  loan_type: z.string().min(1),
  required_loan_amount: z.number().positive().optional().nullable(),
  loan_purpose: z.string().max(500).optional().nullable(),
  remarks: z.string().max(1000).optional().nullable(),
})

/**
 * POST /api/employees/dse/customer-apply
 * DSE applies for a loan on behalf of a customer
 * Creates a lead with source_type = 'dse_direct'
 */
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
    const { data: profile } = await supabase
      .from('users')
      .select('role, sub_role, full_name, generated_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validated = customerApplySchema.parse(body)

    const cleanedMobile = validated.customer_mobile.replace(/[\s\-\(\)]/g, '')

    // Check for duplicate (same customer + loan type by this DSE)
    const { data: existingLead } = await supabase
      .from('dse_leads')
      .select('id, lead_id')
      .eq('dse_user_id', user.id)
      .eq('lead_type', validated.loan_type)
      .ilike('customer_name', validated.customer_name.trim())
      .limit(1)
      .maybeSingle()

    if (existingLead) {
      return NextResponse.json({
        success: false,
        error: `A lead already exists for this customer and loan type (${existingLead.lead_id})`,
        code: 'DUPLICATE_LEAD',
      }, { status: 409 })
    }

    // Generate lead ID
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomSuffix = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
    const leadIdGenerated = `DSE-LEAD-${dateStr}-${randomSuffix}`

    // First check if customer already exists in dse_customers
    let customerId = null
    const { data: existingCustomer } = await supabase
      .from('dse_customers')
      .select('id')
      .eq('dse_user_id', user.id)
      .eq('primary_mobile', cleanedMobile)
      .limit(1)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      // Create a customer record
      const custDateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const custSuffix = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
      const { data: newCust } = await supabase
        .from('dse_customers')
        .insert({
          dse_user_id: user.id,
          customer_id: `DSE-CUST-${custDateStr}-${custSuffix}`,
          full_name: validated.customer_name.trim(),
          primary_mobile: cleanedMobile,
          email: validated.customer_email || null,
          city: validated.customer_city || null,
          state: validated.customer_state || null,
          pincode: validated.customer_pincode || null,
          source: 'Direct Application',
          customer_status: 'Prospect',
          priority: 'High',
        })
        .select('id')
        .maybeSingle()

      if (newCust) customerId = newCust.id
    }

    // Create DSE lead
    const { data: lead, error: leadError } = await supabase
      .from('dse_leads')
      .insert({
        dse_user_id: user.id,
        customer_id: customerId,
        lead_id: leadIdGenerated,
        customer_name: validated.customer_name.trim(),
        customer_mobile: cleanedMobile,
        customer_email: validated.customer_email || null,
        customer_city: validated.customer_city || null,
        lead_type: validated.loan_type,
        estimated_value: validated.required_loan_amount || null,
        requirements: validated.loan_purpose || null,
        lead_stage: 'New',
        source_type: 'dse_direct_apply',
        tags: validated.remarks ? [validated.remarks] : [],
      })
      .select('id, lead_id')
      .maybeSingle()

    if (leadError) {
      apiLogger.error('DSE customer-apply: lead creation failed', leadError)
      return NextResponse.json({ success: false, error: 'Failed to create lead' }, { status: 500 })
    }

    // Update customer as converted to lead
    if (customerId && lead) {
      await supabase
        .from('dse_customers')
        .update({
          is_converted_to_lead: true,
          lead_id: lead.id,
          converted_to_lead_at: new Date().toISOString(),
        })
        .eq('id', customerId)
    }

    // Audit log
    await supabase.from('dse_audit_log').insert({
      entity_type: 'Lead',
      entity_id: lead?.id,
      action: 'Created',
      changes_summary: `DSE applied for customer: ${validated.customer_name}, Loan: ${validated.loan_type}`,
      user_id: user.id,
      user_name: profile.full_name,
    }).then(() => {})

    return NextResponse.json({
      success: true,
      message: `Application submitted successfully! Lead ID: ${leadIdGenerated}`,
      data: {
        lead_id: lead?.id,
        lead_number: leadIdGenerated,
        customer_name: validated.customer_name,
        loan_type: validated.loan_type,
        loan_amount: validated.required_loan_amount,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('DSE customer-apply error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
