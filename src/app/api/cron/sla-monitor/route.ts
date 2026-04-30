
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { runSLAMonitor, updateSLAStatistics } from '@/lib/cron/sla-monitor'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cron/sla-monitor
 * Cron endpoint to run SLA monitoring
 *
 * Should be called by a cron service (Vercel Cron, external cron, etc.)
 * Recommended schedule: Every 5 minutes for critical monitoring
 *
 * Authorization: Uses cron secret token
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Verify cron authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check which operation to run
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation') || 'monitor'

    let result

    switch (operation) {
      case 'monitor':
        // Run warning and breach checks
        result = await runSLAMonitor()
        break

      case 'statistics':
        // Update daily statistics
        result = await updateSLAStatistics()
        break

      case 'all':
        // Run everything
        const monitorResult = await runSLAMonitor()
        const statsResult = await updateSLAStatistics()
        result = {
          monitor: monitorResult,
          statistics: statsResult
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid operation. Use: monitor, statistics, or all' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      operation,
      result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    apiLogger.error('Cron error', error)
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message
      },
      { status: 500 }
    )
  }
}
