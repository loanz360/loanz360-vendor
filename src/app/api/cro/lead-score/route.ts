import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { scoreAndUpdateLead, calculateLeadScore } from '@/lib/ai/lead-scoring'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cro/lead-score?leadId=...
 * Calculate lead score without saving.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const leadId = request.nextUrl.searchParams.get('leadId')
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'leadId is required' }, { status: 400 })
    }

    const result = await calculateLeadScore(supabase, leadId, user.id)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    apiLogger.error('Lead score GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/cro/lead-score
 * Calculate and save lead score to database.
 * Body: { leadId: string } or { leadIds: string[] } for batch scoring.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const body = await request.json()
    const { leadId, leadIds } = body

    // Single lead scoring
    if (leadId) {
      const result = await scoreAndUpdateLead(supabase, leadId, user.id)
      return NextResponse.json({ success: true, data: result })
    }

    // Batch scoring
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      const batchSize = Math.min(leadIds.length, 50) // Cap at 50
      const results = []

      for (let i = 0; i < batchSize; i++) {
        const result = await scoreAndUpdateLead(supabase, leadIds[i], user.id)
        results.push({ leadId: leadIds[i], ...result })
      }

      return NextResponse.json({
        success: true,
        data: {
          scored: results.length,
          results,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'leadId or leadIds required' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Lead score POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
