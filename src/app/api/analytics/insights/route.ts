import { parseBody } from '@/lib/utils/parse-body'

/**
 * API Route: Business Insights
 * POST /api/analytics/insights - Generate new insights
 * GET /api/analytics/insights - Get insights (with filters)
 * PATCH /api/analytics/insights - Update insight status
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  generateInsights,
  getUnreadInsights,
  getInsightsByCategory,
  markInsightAsRead,
  dismissInsight,
  markInsightAsActioned,
} from '@/lib/analytics/insights-engine'
import type { InsightsRequest, InsightCategory } from '@/lib/analytics/analytics-types'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    // Generate new insights
    const insights = await generateInsights()

    return NextResponse.json({
      success: true,
      insights,
      total_count: insights.length,
      unread_count: insights.filter(i => !i.is_read).length,
    })
  } catch (error) {
    apiLogger.error('Insight generation error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as InsightCategory | null
    const limit = parseInt(searchParams.get('limit') || '10')
    const unreadOnly = searchParams.get('unread_only') === 'true'

    let insights

    if (unreadOnly) {
      insights = await getUnreadInsights(limit)
    } else if (category) {
      insights = await getInsightsByCategory(category, limit)
    } else {
      insights = await getUnreadInsights(limit)
    }

    return NextResponse.json({
      success: true,
      insights,
      total_count: insights.length,
      unread_count: insights.filter(i => !i.is_read).length,
    })
  } catch (error) {
    apiLogger.error('Get insights error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve insights' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { insight_id, action, action_taken, actioned_by } = body

    if (!insight_id) {
      return NextResponse.json(
        { success: false, error: 'insight_id is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'mark_read':
        await markInsightAsRead(insight_id)
        break
      case 'dismiss':
        await dismissInsight(insight_id)
        break
      case 'mark_actioned':
        if (!action_taken || !actioned_by) {
          return NextResponse.json(
            { success: false, error: 'action_taken and actioned_by required for mark_actioned' },
            { status: 400 }
          )
        }
        await markInsightAsActioned(insight_id, action_taken, actioned_by)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Insight ${action} successfully`,
    })
  } catch (error) {
    apiLogger.error('Update insight error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update insight' },
      { status: 500 }
    )
  }
}
