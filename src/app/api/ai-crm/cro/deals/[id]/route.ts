/**
 * CRO Single Deal API
 *
 * Fetch a single deal by ID for CRO read-only view
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Authenticate and verify CRO role
  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const { id: dealId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!dealId || !uuidRegex.test(dealId)) {
      return createErrorResponse('Invalid deal ID', 400, requestId)
    }

    // Fetch the single deal (CRO has read-only access to their own deals)
    // Include monthly_income and assigned_at; exclude documents from detail view
    const { data: deal, error } = await supabase
      .from('crm_deals')
      .select(
        `
        id,
        lead_id,
        customer_name,
        phone,
        email,
        location,
        loan_type,
        loan_amount,
        loan_purpose,
        monthly_income,
        stage,
        status,
        bde_id,
        sanctioned_amount,
        disbursed_amount,
        sanctioned_at,
        disbursed_at,
        drop_reason,
        assigned_at,
        assigned_to_bde_at,
        last_updated_by_bde_at,
        notes,
        business_name,
        created_at,
        updated_at
      `
      )
      .eq('id', dealId)
      .eq('cro_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    // Separate error (500) from not-found (404)
    if (error) {
      logApiError(error as Error, request, { action: 'get_single_deal', requestId })
      return createErrorResponse('Failed to fetch deal', 500, requestId)
    }

    if (!deal) {
      return createErrorResponse(
        'Deal not found. It may have been removed or you do not have access.',
        404,
        requestId
      )
    }

    return NextResponse.json({
      success: true,
      data: deal,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'get_single_deal', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
