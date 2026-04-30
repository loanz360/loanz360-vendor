/**
 * API Route: Process Credit Appraisal
 * POST /api/cae/process
 *
 * Triggers credit appraisal processing for a lead
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { caeService } from '@/lib/cae'
import { apiLogger } from '@/lib/utils/logger'


interface ProcessRequest {
  lead_id: string
  provider?: string
}

interface ProcessResponse {
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
      return NextResponse.json({ success: false, error: 'Unauthorized' } as ProcessResponse, {
        status: 401,
      })
    }

    // Parse request body
    const body: ProcessRequest = await request.json()

    if (!body.lead_id) {
      return NextResponse.json({ success: false, error: 'lead_id is required' } as ProcessResponse, {
        status: 400,
      })
    }

    // Verify lead exists and user has access
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_id, partner_id, cam_status')
      .eq('id', body.lead_id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' } as ProcessResponse, {
        status: 404,
      })
    }

    // Check if CAM already completed
    if (lead.cam_status === 'COMPLETED') {
      return NextResponse.json(
        {
          success: false,
          error: 'CAM already completed for this lead',
        } as ProcessResponse,
        { status: 400 }
      )
    }

    // Process appraisal
    const result = await caeService.processAppraisal(body.lead_id, body.provider as any)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to process appraisal',
        } as ProcessResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        appraisal_id: result.appraisalId!,
        status: 'PROCESSING',
        message: 'Credit appraisal initiated. Processing in background.',
      },
    } as ProcessResponse)
  } catch (error) {
    apiLogger.error('CAE process error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ProcessResponse,
      { status: 500 }
    )
  }
}
