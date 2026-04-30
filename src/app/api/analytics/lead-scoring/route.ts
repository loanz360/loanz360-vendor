import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * API Route: Lead Scoring
 * POST /api/analytics/lead-scoring - Score a single lead
 * POST /api/analytics/lead-scoring/bulk - Score multiple leads
 * GET /api/analytics/lead-scoring/[leadId] - Get existing score
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateLeadScore, bulkScoreLeads, getLeadScore } from '@/lib/analytics/ml-scoring-service'
import type { LeadScoringRequest, BulkScoringRequest } from '@/lib/analytics/analytics-types'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      lead_ids: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Check if bulk scoring
    if (body.lead_ids && Array.isArray(body.lead_ids)) {
      const bulkRequest: BulkScoringRequest = body
      const startTime = Date.now()

      const { scores, failed } = await bulkScoreLeads(
        bulkRequest.lead_ids,
        bulkRequest.model_id
      )

      return NextResponse.json({
        success: true,
        scores,
        failed_leads: failed,
        processing_time_ms: Date.now() - startTime,
      })
    }

    // Single lead scoring
    const scoringRequest: LeadScoringRequest = body

    if (!scoringRequest.lead_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id is required' },
        { status: 400 }
      )
    }

    const score = await calculateLeadScore(
      scoringRequest.lead_id,
      scoringRequest.model_id
    )

    return NextResponse.json({
      success: true,
      score,
      model_used: score.model_id,
    })
  } catch (error) {
    apiLogger.error('Lead scoring error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'lead_id parameter required' },
        { status: 400 }
      )
    }

    const score = await getLeadScore(leadId)

    if (!score) {
      return NextResponse.json(
        { success: false, error: 'No score found for this lead' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      score,
    })
  } catch (error) {
    apiLogger.error('Get lead score error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve score' },
      { status: 500 }
    )
  }
}
