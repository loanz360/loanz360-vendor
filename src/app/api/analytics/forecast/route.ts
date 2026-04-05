export const dynamic = 'force-dynamic'

/**
 * API Route: Revenue Forecasting
 * POST /api/analytics/forecast - Generate new forecast
 * GET /api/analytics/forecast - Get latest forecasts
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  generateRevenueForecast,
  getLatestForecast,
  generateAllForecasts,
  getForecastAccuracyMetrics,
} from '@/lib/analytics/forecasting-service'
import type { RevenueForecastRequest, ForecastPeriod, ForecastMethod } from '@/lib/analytics/analytics-types'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const body: RevenueForecastRequest = await request.json()

    const period: ForecastPeriod = body.period || '30_days'
    const method: ForecastMethod = body.method || 'linear_regression'

    const forecast = await generateRevenueForecast(period, method)

    return NextResponse.json({
      success: true,
      forecast,
      historical_accuracy: null, // TODO: Get from previous forecasts
    })
  } catch (error) {
    apiLogger.error('Forecast generation error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Generate all forecasts
    if (action === 'generate_all') {
      const { forecasts, errors } = await generateAllForecasts()

      return NextResponse.json({
        success: true,
        forecasts,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // Get accuracy metrics
    if (action === 'accuracy') {
      const metrics = await getForecastAccuracyMetrics()

      return NextResponse.json({
        success: true,
        metrics,
      })
    }

    // Get latest forecast for specific period
    const period = searchParams.get('period') as ForecastPeriod || '30_days'

    const forecast = await getLatestForecast(period)

    if (!forecast) {
      return NextResponse.json(
        { success: false, error: 'No forecast found for this period' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      forecast,
    })
  } catch (error) {
    apiLogger.error('Get forecast error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve forecast' },
      { status: 500 }
    )
  }
}
