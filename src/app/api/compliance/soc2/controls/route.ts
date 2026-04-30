
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { soc2Service } from '@/lib/compliance/soc2-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/compliance/soc2/controls
 * Get all SOC 2 controls with optional filtering by Trust Service Category
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const filters: Record<string, unknown> = {}
    if (category) filters.trust_service_category = category

    const controls = await soc2Service.getControls(filters)

    return NextResponse.json({
      success: true,
      data: {
        controls,
        count: controls.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/compliance/soc2/controls', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
