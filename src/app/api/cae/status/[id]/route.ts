/**
 * API Route: Get Credit Appraisal Status
 * GET /api/cae/status/[id]
 *
 * Returns the status and result of a credit appraisal
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


interface StatusResponse {
  success: boolean
  data?: {
    id: string
    cam_id: string
    lead_id: string
    status: string
    provider: string
    credit_score?: number
    risk_grade?: string
    risk_score?: number
    eligible_loan_amount?: number
    recommendation?: string
    processing_time_ms?: number
    error_message?: string
    result?: unknown; created_at: string
    completed_at?: string
  }
  error?: string
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } as StatusResponse, {
        status: 401,
      })
    }

    // Fetch appraisal
    const { data: appraisal, error } = await supabase
      .from('credit_appraisals')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !appraisal) {
      return NextResponse.json({ success: false, error: 'Appraisal not found' } as StatusResponse, {
        status: 404,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: appraisal.id,
        cam_id: appraisal.cam_id,
        lead_id: appraisal.lead_id,
        status: appraisal.status,
        provider: appraisal.provider,
        credit_score: appraisal.credit_score,
        risk_grade: appraisal.risk_grade,
        risk_score: appraisal.risk_score,
        eligible_loan_amount: appraisal.eligible_loan_amount,
        recommendation: appraisal.recommendation,
        processing_time_ms: appraisal.processing_time_ms,
        error_message: appraisal.error_message,
        result: appraisal.response_payload?.data,
        created_at: appraisal.created_at,
        completed_at: appraisal.completed_at,
      },
    } as StatusResponse)
  } catch (error) {
    apiLogger.error('CAE status error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as StatusResponse,
      { status: 500 }
    )
  }
}
