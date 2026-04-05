import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { isValidUUID } from '@/lib/validations/dse-validation'

export const dynamic = 'force-dynamic'

// Validation schema for lost deal analysis
const lostReasonSchema = z.object({
  competitor_name: z.string().max(255).optional().nullable(),
  competitor_rate: z.number().min(0).max(100).optional().nullable(),
  loss_category: z.enum([
    'better_rate',
    'faster_processing',
    'existing_relationship',
    'documentation_issues',
    'customer_not_interested',
    'credit_score',
    'income_insufficient',
    'other',
  ], {
    errorMap: () => ({
      message: 'loss_category must be one of: better_rate, faster_processing, existing_relationship, documentation_issues, customer_not_interested, credit_score, income_insufficient, other',
    }),
  }),
  loss_notes: z.string().max(2000).optional().nullable(),
})

// Helper to verify lead access
async function verifyLeadAccess(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string, leadId: string) {
  const { data: lead, error } = await supabase
    .from('dse_leads')
    .select('*')
    .eq('id', leadId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error || !lead) {
    return { isValid: false as const, error: 'Lead not found', status: 404 }
  }

  if (lead.dse_user_id !== userId) {
    return { isValid: false as const, error: 'Access denied', status: 403 }
  }

  return { isValid: true as const, lead }
}

// POST - Record why a lead was lost
export async function POST(
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

    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    if (!isValidUUID(leadId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid lead ID format' },
        { status: 400 }
      )
    }

    const access = await verifyLeadAccess(supabase, user.id, leadId)
    if (!access.isValid) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      )
    }

    const body = await request.json()
    const validated = lostReasonSchema.parse(body)

    // Update lead stage to 'Lost' and record lost_reason
    const { error: updateError } = await supabase
      .from('dse_leads')
      .update({
        lead_stage: 'Lost',
        lost_reason: validated.loss_category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('dse_user_id', user.id)

    if (updateError) {
      apiLogger.error('Error updating lead stage to Lost', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update lead stage' },
        { status: 500 }
      )
    }

    // Record stage history
    await supabase
      .from('dse_lead_stage_history')
      .insert({
        lead_id: leadId,
        from_stage: access.lead.lead_stage,
        to_stage: 'Lost',
        changed_by: user.id,
        notes: validated.loss_notes || `Lead lost: ${validated.loss_category}`,
        changed_at: new Date().toISOString(),
      })

    // Store detailed loss analysis
    const lossAnalysis = {
      lead_id: leadId,
      dse_user_id: user.id,
      loss_category: validated.loss_category,
      competitor_name: validated.competitor_name || null,
      competitor_rate: validated.competitor_rate || null,
      loss_notes: validated.loss_notes || null,
      lead_stage_at_loss: access.lead.lead_stage,
      lead_value: access.lead.estimated_value || null,
      lead_type: access.lead.lead_type || null,
      days_in_pipeline: access.lead.created_at
        ? Math.floor((Date.now() - new Date(access.lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      created_at: new Date().toISOString(),
    }

    const { data: analysis, error: analysisError } = await supabase
      .from('dse_lead_loss_analysis')
      .insert(lossAnalysis)
      .select()
      .single()

    if (analysisError) {
      apiLogger.error('Error recording loss analysis', analysisError)
      // Lead stage already updated, so we log but don't fail the request
      return NextResponse.json({
        success: true,
        data: { lead_updated: true, analysis: null },
        message: 'Lead marked as lost, but detailed analysis could not be saved',
      })
    }

    apiLogger.info('Lead loss analysis recorded', {
      lead_id: leadId,
      loss_category: validated.loss_category,
      dse_user_id: user.id,
    })

    return NextResponse.json({
      success: true,
      data: analysis,
      message: 'Lead marked as lost and analysis recorded',
    })
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('Error in lost-reason POST', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Fetch loss analysis for a lead
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

    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    if (!isValidUUID(leadId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid lead ID format' },
        { status: 400 }
      )
    }

    const access = await verifyLeadAccess(supabase, user.id, leadId)
    if (!access.isValid) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      )
    }

    const { data: analysis, error: fetchError } = await supabase
      .from('dse_lead_loss_analysis')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .maybeSingle()

    if (fetchError) {
      apiLogger.error('Error fetching loss analysis', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch loss analysis' },
        { status: 500 }
      )
    }

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'No loss analysis found for this lead' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    })
  } catch (error: unknown) {
    apiLogger.error('Error in lost-reason GET', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
