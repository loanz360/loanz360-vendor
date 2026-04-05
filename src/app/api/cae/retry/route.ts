/**
 * API Route: Retry Failed Credit Appraisal
 * POST /api/cae/retry
 *
 * Retries a failed credit appraisal
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { caeService } from '@/lib/cae'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface RetryRequest {
  appraisal_id: string
}

interface RetryResponse {
  success: boolean
  data?: {
    appraisal_id: string
    status: string
    message: string
  }
  error?: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } as RetryResponse, {
        status: 401,
      })
    }

    // Parse request body
    const body: RetryRequest = await request.json()

    if (!body.appraisal_id) {
      return NextResponse.json(
        { success: false, error: 'appraisal_id is required' } as RetryResponse,
        { status: 400 }
      )
    }

    // Retry the appraisal
    const result = await caeService.retryAppraisal(body.appraisal_id)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to retry appraisal',
        } as RetryResponse,
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        appraisal_id: body.appraisal_id,
        status: 'PROCESSING',
        message: 'Appraisal retry initiated. Processing in background.',
      },
    } as RetryResponse)
  } catch (error) {
    apiLogger.error('CAE retry error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as RetryResponse,
      { status: 500 }
    )
  }
}
