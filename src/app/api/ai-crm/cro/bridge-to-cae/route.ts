import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai-crm/cro/bridge-to-cae
 *
 * Bridges a CRM deal into the existing Credit Appraiser Engine (CAE)
 * by calling the bridge_crm_deal_to_partner_lead() RPC function.
 *
 * This creates a partner_leads record from CRM deal data so the
 * existing CAE can generate a full CAM.
 *
 * Body: { deal_id: string, cro_user_id: string }
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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

    const body = await request.json()
    const { deal_id } = body

    if (!deal_id) {
      return NextResponse.json(
        { success: false, error: 'Missing deal_id' },
        { status: 400 }
      )
    }

    // Always use the authenticated user's ID to prevent privilege escalation
    const croId = user.id

    // Call the bridge RPC function
    const { data, error } = await supabase.rpc('bridge_crm_deal_to_partner_lead', {
      p_deal_id: deal_id,
      p_cro_user_id: croId,
    })

    if (error) {
      apiLogger.error('Bridge RPC error:', error)
      return NextResponse.json(
        { success: false, error: 'An unexpected error occurred' || 'Failed to bridge deal to CAE' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        partner_lead_id: data,
        deal_id,
        message: 'Deal successfully bridged to CAE. BDE can now generate CAM.',
      },
    })
  } catch (error) {
    apiLogger.error('Error in bridge-to-cae:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai-crm/cro/bridge-to-cae?deal_id=xxx
 *
 * Check if a deal has been bridged to the CAE and get CAM status.
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
      return NextResponse.json(
        { success: false, error: 'Missing deal_id parameter' },
        { status: 400 }
      )
    }

    // Check if deal has a partner_lead_id (bridged to CAE)
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('id, partner_lead_id, bde_id, cro_id')
      .eq('id', dealId)
      .maybeSingle()

    if (!deal) {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      )
    }

    // Verify access (CRO or BDE)
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
          bridged: false,
          cam_status: null,
          message: 'Deal not yet bridged to CAE',
        },
      })
    }

    // Check if CAM has been generated
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
        bridged: true,
        partner_lead_id: deal.partner_lead_id,
        cam_status: cam ? {
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
        message: cam ? 'CAM generated via CAE' : 'Bridged to CAE, awaiting CAM generation',
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
