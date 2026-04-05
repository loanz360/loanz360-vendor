/**
 * Revenue Forecasting Service
 * Time series forecasting for revenue predictions
 */

import { createClient } from '@/lib/supabase/server'
import type {
  RevenueForecast,
  ForecastPeriod,
  ForecastMethod,
  RevenueByDimension,
} from './analytics-types'

// ============================================================================
// HISTORICAL DATA RETRIEVAL
// ============================================================================

interface RevenueDataPoint {
  date: string
  revenue: number
  lead_count: number
  conversion_rate: number
}

/**
 * Get historical revenue data for forecasting
 */
async function getHistoricalRevenue(
  daysBack: number = 90
): Promise<RevenueDataPoint[]> {
  const supabase = await createClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  // Get revenue from won leads
  const { data: leads, error } = await supabase
    .from('leads')
    .select('loan_amount, status, created_at, updated_at')
    .eq('status', 'won')
    .gte('updated_at', startDate.toISOString())
    .order('updated_at', { ascending: true })

  if (error || !leads) {
    console.error('Error fetching historical revenue:', error)
    return []
  }

  // Group by date and calculate daily revenue
  const revenueByDate: Record<string, RevenueDataPoint> = {}

  leads.forEach(lead => {
    const date = lead.updated_at.split('T')[0]
    if (!revenueByDate[date]) {
      revenueByDate[date] = {
        date,
        revenue: 0,
        lead_count: 0,
        conversion_rate: 0,
      }
    }
    revenueByDate[date].revenue += lead.loan_amount || 0
    revenueByDate[date].lead_count += 1
  })

  return Object.values(revenueByDate).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
}

// ============================================================================
// FORECASTING ALGORITHMS
// ============================================================================

/**
 * Linear Regression Forecast
 * Fits a linear trend line to historical data
 */
function linearRegressionForecast(
  historicalData: RevenueDataPoint[],
  forecastDays: number
): { predicted: number; slope: number; intercept: number } {
  if (historicalData.length < 2) {
    return { predicted: 0, slope: 0, intercept: 0 }
  }

  // Convert dates to numeric x values (days from start)
  const startDate = new Date(historicalData[0].date).getTime()
  const dataPoints = historicalData.map((point, index) => ({
    x: (new Date(point.date).getTime() - startDate) / (1000 * 60 * 60 * 24),
    y: point.revenue,
  }))

  // Calculate linear regression: y = mx + b
  const n = dataPoints.length
  const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0)
  const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0)
  const sumXY = dataPoints.reduce((sum, p) => sum + p.x * p.y, 0)
  const sumX2 = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Project forward
  const lastX = dataPoints[dataPoints.length - 1].x
  const futureX = lastX + forecastDays
  const predicted = slope * futureX + intercept

  return { predicted: Math.max(predicted, 0), slope, intercept }
}

/**
 * Moving Average Forecast
 * Uses weighted moving average of recent periods
 */
function movingAverageForecast(
  historicalData: RevenueDataPoint[],
  windowSize: number = 7
): number {
  if (historicalData.length < windowSize) {
    windowSize = historicalData.length
  }

  const recentData = historicalData.slice(-windowSize)
  const average = recentData.reduce((sum, point) => sum + point.revenue, 0) / recentData.length

  return Math.max(average, 0)
}

/**
 * Exponential Smoothing Forecast
 * Gives more weight to recent observations
 */
function exponentialSmoothingForecast(
  historicalData: RevenueDataPoint[],
  alpha: number = 0.3 // Smoothing factor (0-1)
): number {
  if (historicalData.length === 0) return 0

  let forecast = historicalData[0].revenue

  for (let i = 1; i < historicalData.length; i++) {
    forecast = alpha * historicalData[i].revenue + (1 - alpha) * forecast
  }

  return Math.max(forecast, 0)
}

/**
 * Growth Rate Forecast
 * Calculates average growth rate and projects forward
 */
function growthRateForecast(
  historicalData: RevenueDataPoint[],
  forecastDays: number
): number {
  if (historicalData.length < 2) return 0

  // Calculate period-over-period growth rates
  const growthRates: number[] = []
  for (let i = 1; i < historicalData.length; i++) {
    if (historicalData[i - 1].revenue > 0) {
      const growth = (historicalData[i].revenue - historicalData[i - 1].revenue) /
                     historicalData[i - 1].revenue
      growthRates.push(growth)
    }
  }

  if (growthRates.length === 0) return historicalData[historicalData.length - 1].revenue

  // Average growth rate
  const avgGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length

  // Apply growth rate for forecast period
  const lastRevenue = historicalData[historicalData.length - 1].revenue
  const periodsToForecast = forecastDays / (historicalData.length > 1 ? 1 : 30)
  const predicted = lastRevenue * Math.pow(1 + avgGrowth, periodsToForecast)

  return Math.max(predicted, 0)
}

// ============================================================================
// CONFIDENCE INTERVALS
// ============================================================================

/**
 * Calculate confidence intervals based on historical variance
 */
function calculateConfidenceIntervals(
  predicted: number,
  historicalData: RevenueDataPoint[],
  confidenceLevel: number = 0.95
): { low: number; high: number } {
  if (historicalData.length < 2) {
    return { low: predicted * 0.85, high: predicted * 1.15 }
  }

  // Calculate standard deviation of historical revenue
  const revenues = historicalData.map(d => d.revenue)
  const mean = revenues.reduce((sum, r) => sum + r, 0) / revenues.length
  const variance = revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length
  const stdDev = Math.sqrt(variance)

  // Use Z-score for confidence level (1.96 for 95% confidence)
  const zScore = confidenceLevel === 0.95 ? 1.96 :
                 confidenceLevel === 0.90 ? 1.645 :
                 confidenceLevel === 0.99 ? 2.576 : 1.96

  const margin = zScore * stdDev

  return {
    low: Math.max(predicted - margin, 0),
    high: predicted + margin,
  }
}

// ============================================================================
// DIMENSIONAL BREAKDOWN
// ============================================================================

/**
 * Get revenue breakdown by lead source
 */
async function getRevenueBySource(): Promise<RevenueByDimension> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leads')
    .select('source, loan_amount')
    .eq('status', 'won')
    .not('loan_amount', 'is', null)

  if (error || !data) return {}

  const bySource: RevenueByDimension = {}
  data.forEach(lead => {
    const source = lead.source || 'unknown'
    bySource[source] = (bySource[source] || 0) + (lead.loan_amount || 0)
  })

  return bySource
}

/**
 * Get revenue breakdown by product type
 */
async function getRevenueByProduct(): Promise<RevenueByDimension> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leads')
    .select('loan_type, loan_amount')
    .eq('status', 'won')
    .not('loan_amount', 'is', null)

  if (error || !data) return {}

  const byProduct: RevenueByDimension = {}
  data.forEach(lead => {
    const product = lead.loan_type || 'unknown'
    byProduct[product] = (byProduct[product] || 0) + (lead.loan_amount || 0)
  })

  return byProduct
}

/**
 * Get revenue breakdown by region (if location data available)
 */
async function getRevenueByRegion(): Promise<RevenueByDimension> {
  // Placeholder - implement when location data is available
  return {
    'North': 0,
    'South': 0,
    'East': 0,
    'West': 0,
  }
}

// ============================================================================
// MAIN FORECASTING FUNCTION
// ============================================================================

/**
 * Generate revenue forecast for specified period
 */
export async function generateRevenueForecast(
  period: ForecastPeriod,
  method: ForecastMethod = 'linear_regression'
): Promise<RevenueForecast> {
  const supabase = await createClient()

  // Determine forecast days
  const forecastDays = {
    '30_days': 30,
    '60_days': 60,
    '90_days': 90,
    'quarterly': 90,
    'yearly': 365,
  }[period] || 30

  // Get historical data (use 3x the forecast period for training)
  const historicalData = await getHistoricalRevenue(forecastDays * 3)

  if (historicalData.length === 0) {
    throw new Error('Insufficient historical data for forecasting')
  }

  // Generate prediction based on method
  let predicted_revenue = 0
  let methodDetails = {}

  switch (method) {
    case 'linear_regression': {
      const result = linearRegressionForecast(historicalData, forecastDays)
      predicted_revenue = result.predicted
      methodDetails = { slope: result.slope, intercept: result.intercept }
      break
    }
    case 'moving_average': {
      const dailyAvg = movingAverageForecast(historicalData, 14)
      predicted_revenue = dailyAvg * forecastDays
      methodDetails = { daily_average: dailyAvg }
      break
    }
    case 'exponential_smoothing': {
      const dailyForecast = exponentialSmoothingForecast(historicalData, 0.3)
      predicted_revenue = dailyForecast * forecastDays
      methodDetails = { daily_forecast: dailyForecast, alpha: 0.3 }
      break
    }
    case 'arima':
    case 'prophet': {
      // Fallback to growth rate for advanced methods (would need external libraries)
      predicted_revenue = growthRateForecast(historicalData, forecastDays)
      methodDetails = { fallback: 'growth_rate' }
      break
    }
    default: {
      predicted_revenue = growthRateForecast(historicalData, forecastDays)
    }
  }

  // Calculate confidence intervals
  const { low, high } = calculateConfidenceIntervals(predicted_revenue, historicalData, 0.95)

  // Get dimensional breakdowns
  const [revenue_by_source, revenue_by_product, revenue_by_region] = await Promise.all([
    getRevenueBySource(),
    getRevenueByProduct(),
    getRevenueByRegion(),
  ])

  // Save forecast to database
  const forecastData: Omit<RevenueForecast, 'id' | 'created_at' | 'updated_at'> = {
    forecast_date: new Date().toISOString().split('T')[0],
    forecast_period: period,
    forecast_method: method,
    predicted_revenue,
    confidence_interval_low: low,
    confidence_interval_high: high,
    confidence_level: 95.00,
    revenue_by_source,
    revenue_by_product,
    revenue_by_region,
  }

  const { data: savedForecast, error } = await supabase
    .from('revenue_forecasts')
    .insert(forecastData)
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to save forecast: ${error.message}`)
  }

  return savedForecast as RevenueForecast
}

// ============================================================================
// FORECAST RETRIEVAL
// ============================================================================

/**
 * Get the most recent forecast for a period
 */
export async function getLatestForecast(
  period: ForecastPeriod
): Promise<RevenueForecast | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('revenue_forecasts')
    .select('*')
    .eq('forecast_period', period)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as RevenueForecast
}

/**
 * Get all forecasts for a period
 */
export async function getForecastHistory(
  period: ForecastPeriod,
  limit: number = 30
): Promise<RevenueForecast[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('revenue_forecasts')
    .select('*')
    .eq('forecast_period', period)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data as RevenueForecast[]
}

// ============================================================================
// FORECAST ACCURACY TRACKING
// ============================================================================

/**
 * Update forecast with actual results and calculate accuracy
 */
export async function updateForecastWithActuals(
  forecastId: string,
  actualRevenue: number
): Promise<void> {
  const supabase = await createClient()

  // Get the forecast
  const { data: forecast, error: fetchError } = await supabase
    .from('revenue_forecasts')
    .select('*')
    .eq('id', forecastId)
    .maybeSingle()

  if (fetchError || !forecast) {
    throw new Error('Forecast not found')
  }

  // Calculate accuracy
  const forecast_error = actualRevenue - forecast.predicted_revenue
  const accuracy_percentage = forecast.predicted_revenue > 0
    ? 100 - (Math.abs(forecast_error) / forecast.predicted_revenue * 100)
    : 0

  // Update forecast
  const { error: updateError } = await supabase
    .from('revenue_forecasts')
    .update({
      actual_revenue: actualRevenue,
      accuracy_percentage,
      forecast_error,
    })
    .eq('id', forecastId)

  if (updateError) {
    throw new Error(`Failed to update forecast: ${updateError.message}`)
  }
}

/**
 * Get average forecast accuracy across all methods
 */
export async function getForecastAccuracyMetrics(): Promise<{
  overall_accuracy: number
  by_method: Record<string, number>
  by_period: Record<string, number>
}> {
  const supabase = await createClient()

  const { data: forecasts, error } = await supabase
    .from('revenue_forecasts')
    .select('forecast_method, forecast_period, accuracy_percentage')
    .not('actual_revenue', 'is', null)

  if (error || !forecasts || forecasts.length === 0) {
    return {
      overall_accuracy: 0,
      by_method: {},
      by_period: {},
    }
  }

  // Overall accuracy
  const overall_accuracy = forecasts.reduce((sum, f) => sum + (f.accuracy_percentage || 0), 0) / forecasts.length

  // Accuracy by method
  const by_method: Record<string, number> = {}
  const methodGroups: Record<string, number[]> = {}

  forecasts.forEach(f => {
    if (!methodGroups[f.forecast_method]) methodGroups[f.forecast_method] = []
    methodGroups[f.forecast_method].push(f.accuracy_percentage || 0)
  })

  Object.entries(methodGroups).forEach(([method, accuracies]) => {
    by_method[method] = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length
  })

  // Accuracy by period
  const by_period: Record<string, number> = {}
  const periodGroups: Record<string, number[]> = {}

  forecasts.forEach(f => {
    if (!periodGroups[f.forecast_period]) periodGroups[f.forecast_period] = []
    periodGroups[f.forecast_period].push(f.accuracy_percentage || 0)
  })

  Object.entries(periodGroups).forEach(([period, accuracies]) => {
    by_period[period] = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length
  })

  return {
    overall_accuracy,
    by_method,
    by_period,
  }
}

// ============================================================================
// BATCH FORECASTING
// ============================================================================

/**
 * Generate forecasts for all periods
 */
export async function generateAllForecasts(): Promise<{
  forecasts: RevenueForecast[]
  errors: string[]
}> {
  const periods: ForecastPeriod[] = ['30_days', '60_days', '90_days']
  const method: ForecastMethod = 'linear_regression'

  const forecasts: RevenueForecast[] = []
  const errors: string[] = []

  for (const period of periods) {
    try {
      const forecast = await generateRevenueForecast(period, method)
      forecasts.push(forecast)
    } catch (error) {
      errors.push(`Failed to generate ${period} forecast: ${error}`)
    }
  }

  return { forecasts, errors }
}
