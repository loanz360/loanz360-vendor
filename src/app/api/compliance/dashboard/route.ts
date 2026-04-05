export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { getComplianceStats } from '@/lib/compliance/compliance-service'

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await getComplianceStats()

    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'Failed to load dashboard stats' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    return handleApiError(error, 'fetch compliance dashboard')
  }
}
