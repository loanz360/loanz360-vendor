import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai-crm/cro/cam-status?deal_id=xxx
 *
 * Returns the CAM status for a CRM deal by checking if it has been
 * bridged to the existing CAE system and whether a CAM has been generated.
 *
 * CROs can see status (not full CAM content) for their deals.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dealId = searchParams.get('deal_id')

    if (!dealId) {
      // Return CAM status for all CRO's deals
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('id, customer_name, loan_type, loan_amount, partner_lead_id, bde_id, stage, status')
        .eq('cro_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!deals || deals.length === 0) {
        return NextResponse.json({ success: true, data: [] })
      }

      // For each deal that has partner_lead_id, check CAM status
      const results = await Promise.all(
        deals.map(async (deal) => {
          let camStatus = null
          if (deal.partner_lead_id) {
            const { data: cam } = await supabase
              .from('credit_appraisal_memos')
              .select('status, recommendation, risk_grade, eligible_amount, created_at')
              .eq('lead_id', deal.partner_lead_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            camStatus = cam || null
          }

          return {
            deal_id: deal.id,
            customer_name: deal.customer_name,
            loan_type: deal.loan_type,
            loan_amount: deal.loan_amount,
            deal_stage: deal.stage,
            deal_status: deal.status,
            bridged_to_cae: !!deal.partner_lead_id,
            cam: camStatus ? {
              status: camStatus.status,
              recommendation: camStatus.recommendation,
              risk_grade: camStatus.risk_grade,
              eligible_amount: camStatus.eligible_amount,
              generated_at: camStatus.created_at,
            } : null,
          }
        })
      )

      return NextResponse.json({ success: true, data: results })
    }

    // Get specific deal CAM status
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('id, partner_lead_id, bde_id, cro_id, customer_name, loan_type, loan_amount, stage, status')
      .eq('id', dealId)
      .maybeSingle()

    if (!deal) {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Verify CRO has access
    if (deal.cro_id !== user.id && deal.bde_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (!deal.partner_lead_id) {
      return NextResponse.json({
        success: true,
        data: {
          deal_id: deal.id,
          bridged_to_cae: false,
          cam: null,
          message: 'Deal not yet bridged to Credit Appraiser Engine',
        },
      })
    }

    // Check CAM in existing CAE system
    const { data: cam } = await supabase
      .from('credit_appraisal_memos')
      .select('id, cam_id, status, recommendation, risk_grade, risk_score, credit_score, eligible_amount, created_at')
      .eq('lead_id', deal.partner_lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        deal_id: deal.id,
        bridged_to_cae: true,
        partner_lead_id: deal.partner_lead_id,
        cam: cam ? {
          id: cam.id,
          cam_id: cam.cam_id,
          status: cam.status,
          recommendation: cam.recommendation,
          risk_grade: cam.risk_grade,
          risk_score: cam.risk_score,
          credit_score: cam.credit_score,
          eligible_amount: cam.eligible_amount,
          generated_at: cam.created_at,
        } : null,
        message: cam ? 'CAM generated via Credit Appraiser Engine' : 'Bridged to CAE, awaiting CAM generation by BDE',
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
