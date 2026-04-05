'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// Local type matching component UI shape
interface SeasonalPattern {
  quarter: string;
  monthsIncluded: number;
  avgConversions: number;
  totalConversions: number;
  conversionsTrend: 'increasing' | 'decreasing' | 'stable';
  avgRevenue: number;
  totalRevenue: number;
  revenueTrend: 'increasing' | 'decreasing' | 'stable';
  avgConversionRate: number;
  conversionRateTrend: 'increasing' | 'decreasing' | 'stable';
}
import { Calendar, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'

interface SeasonalPatternsPanelProps {
  patterns: SeasonalPattern[]
}

export default function SeasonalPatternsPanel({ patterns }: SeasonalPatternsPanelProps) {
  if (!patterns || patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-600" />
            Seasonal Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No seasonal data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Find best and worst performing quarters
  const bestQuarter = patterns.reduce((best, current) =>
    current.avgConversions > best.avgConversions ? current : best
  )
  const worstQuarter = patterns.reduce((worst, current) =>
    current.avgConversions < worst.avgConversions ? current : worst
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-orange-600" />
          Seasonal Patterns (Quarterly Analysis)
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Identify trends and patterns across fiscal quarters
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quarterly Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patterns.map((pattern) => {
            const isBest = pattern.quarter === bestQuarter.quarter
            const isWorst = pattern.quarter === worstQuarter.quarter && patterns.length > 1

            return (
              <Card
                key={pattern.quarter}
                className={`border-2 ${
                  isBest
                    ? 'border-green-400 bg-gradient-to-br from-green-50 to-green-100'
                    : isWorst
                    ? 'border-red-400 bg-gradient-to-br from-red-50 to-red-100'
                    : 'border-gray-200 bg-white'
                } transition-all`}
              >
                <CardContent className="p-4">
                  {/* Quarter Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{pattern.quarter}</h3>
                      <p className="text-xs text-gray-600">{pattern.monthsIncluded} months</p>
                    </div>
                    {isBest && (
                      <div className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        BEST
                      </div>
                    )}
                    {isWorst && patterns.length > 1 && (
                      <div className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                        NEEDS FOCUS
                      </div>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  <div className="space-y-3">
                    {/* Conversions */}
                    <div className="bg-white/70 rounded-lg p-3 border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Avg Conversions</span>
                        {getTrendIcon(pattern.conversionsTrend)}
                      </div>
                      <div className="text-2xl font-bold text-blue-900">
                        {pattern.avgConversions.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Total: {pattern.totalConversions}
                      </div>
                    </div>

                    {/* Revenue */}
                    <div className="bg-white/70 rounded-lg p-3 border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Avg Revenue</span>
                        {getTrendIcon(pattern.revenueTrend)}
                      </div>
                      <div className="text-xl font-bold text-green-900">
                        {formatCurrency(pattern.avgRevenue, true)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Total: {formatCurrency(pattern.totalRevenue, true)}
                      </div>
                    </div>

                    {/* Conversion Rate */}
                    <div className="bg-white/70 rounded-lg p-3 border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Avg Conv. Rate</span>
                        {getTrendIcon(pattern.conversionRateTrend)}
                      </div>
                      <div className="text-2xl font-bold text-purple-900">
                        {pattern.avgConversionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Trend Summary */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Overall Trend</span>
                      <span
                        className={`font-bold ${
                          pattern.conversionsTrend === 'increasing' && pattern.revenueTrend === 'increasing'
                            ? 'text-green-700'
                            : pattern.conversionsTrend === 'decreasing' || pattern.revenueTrend === 'decreasing'
                            ? 'text-red-700'
                            : 'text-gray-700'
                        }`}
                      >
                        {pattern.conversionsTrend === 'increasing' && pattern.revenueTrend === 'increasing'
                          ? 'STRONG GROWTH'
                          : pattern.conversionsTrend === 'decreasing' || pattern.revenueTrend === 'decreasing'
                          ? 'NEEDS IMPROVEMENT'
                          : 'STABLE'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Comparison Chart (Simple Bar Chart) */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Quarterly Comparison</h4>
          <div className="space-y-4">
            {/* Conversions Comparison */}
            <div>
              <div className="text-xs text-gray-600 mb-2 font-medium">Conversions</div>
              <div className="flex items-end gap-2 h-32">
                {patterns.map((pattern) => {
                  const maxConversions = Math.max(...patterns.map((p) => p.avgConversions))
                  const heightPercent = (pattern.avgConversions / maxConversions) * 100

                  return (
                    <div key={pattern.quarter} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600"
                           style={{ height: `${heightPercent}%` }}>
                        <div className="text-center text-white font-bold text-xs pt-2">
                          {pattern.avgConversions.toFixed(0)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-700 font-medium mt-2">
                        {pattern.quarter.replace('Quarter ', 'Q')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Revenue Comparison */}
            <div>
              <div className="text-xs text-gray-600 mb-2 font-medium">Revenue (₹L)</div>
              <div className="flex items-end gap-2 h-32">
                {patterns.map((pattern) => {
                  const maxRevenue = Math.max(...patterns.map((p) => p.avgRevenue))
                  const heightPercent = (pattern.avgRevenue / maxRevenue) * 100

                  return (
                    <div key={pattern.quarter} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-green-500 rounded-t-lg transition-all hover:bg-green-600"
                           style={{ height: `${heightPercent}%` }}>
                        <div className="text-center text-white font-bold text-xs pt-2">
                          {(pattern.avgRevenue / 100000).toFixed(1)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-700 font-medium mt-2">
                        {pattern.quarter.replace('Quarter ', 'Q')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4 border-2 border-orange-200">
          <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Seasonal Insights
          </h4>
          <ul className="space-y-1 text-sm text-orange-800">
            {getSeasonalInsights(patterns, bestQuarter, worstQuarter).map((insight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Performance Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border-2">
            <div className="text-xs text-gray-600 mb-1">Best Quarter</div>
            <div className="text-xl font-bold text-green-600">{bestQuarter.quarter}</div>
            <div className="text-sm text-gray-700 mt-1">
              {bestQuarter.avgConversions.toFixed(1)} avg conversions
            </div>
          </div>
          {patterns.length > 1 && (
            <div className="bg-white rounded-lg p-4 border-2">
              <div className="text-xs text-gray-600 mb-1">Needs Focus</div>
              <div className="text-xl font-bold text-red-600">{worstQuarter.quarter}</div>
              <div className="text-sm text-gray-700 mt-1">
                {worstQuarter.avgConversions.toFixed(1)} avg conversions
              </div>
            </div>
          )}
          <div className="bg-white rounded-lg p-4 border-2">
            <div className="text-xs text-gray-600 mb-1">Consistency</div>
            <div className="text-xl font-bold text-purple-600">
              {calculateConsistency(patterns)}%
            </div>
            <div className="text-sm text-gray-700 mt-1">Performance variance</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'increasing':
      return <TrendingUp className="h-4 w-4 text-green-600" />
    case 'decreasing':
      return <TrendingDown className="h-4 w-4 text-red-600" />
    default:
      return <Minus className="h-4 w-4 text-gray-600" />
  }
}

function getSeasonalInsights(
  patterns: SeasonalPattern[],
  bestQuarter: SeasonalPattern,
  worstQuarter: SeasonalPattern
): string[] {
  const insights: string[] = []

  if (patterns.length === 0) return ['No data available for insights']

  // Best quarter insight
  insights.push(
    `${bestQuarter.quarter} is your strongest period with ${bestQuarter.avgConversions.toFixed(1)} average conversions and ${formatCurrency(bestQuarter.avgRevenue, true)} average revenue`
  )

  // Worst quarter insight (if multiple quarters)
  if (patterns.length > 1 && worstQuarter.quarter !== bestQuarter.quarter) {
    const gap = bestQuarter.avgConversions - worstQuarter.avgConversions
    const gapPercent = ((gap / bestQuarter.avgConversions) * 100).toFixed(0)
    insights.push(
      `${worstQuarter.quarter} lags behind ${bestQuarter.quarter} by ${gap.toFixed(1)} conversions (${gapPercent}% gap) - opportunity for improvement`
    )
  }

  // Trend analysis
  const increasingQuarters = patterns.filter(
    (p) => p.conversionsTrend === 'increasing' && p.revenueTrend === 'increasing'
  )
  const decreasingQuarters = patterns.filter(
    (p) => p.conversionsTrend === 'decreasing' || p.revenueTrend === 'decreasing'
  )

  if (increasingQuarters.length > patterns.length / 2) {
    insights.push(
      `Strong overall growth trajectory with ${increasingQuarters.length} quarter(s) showing positive trends`
    )
  } else if (decreasingQuarters.length > patterns.length / 2) {
    insights.push(
      `⚠️ ${decreasingQuarters.length} quarter(s) show declining trends - review seasonal strategies`
    )
  }

  // Conversion rate insight
  const avgConvRate =
    patterns.reduce((sum, p) => sum + p.avgConversionRate, 0) / patterns.length
  if (avgConvRate > 15) {
    insights.push(`Healthy conversion rate of ${avgConvRate.toFixed(1)}% across all quarters`)
  } else if (avgConvRate < 10) {
    insights.push(
      `Conversion rate averaging ${avgConvRate.toFixed(1)}% - focus on lead quality and sales training`
    )
  }

  return insights
}

function calculateConsistency(patterns: SeasonalPattern[]): number {
  if (patterns.length === 0) return 0

  const conversions = patterns.map((p) => p.avgConversions)
  const mean = conversions.reduce((sum, val) => sum + val, 0) / conversions.length
  const variance =
    conversions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / conversions.length
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0

  // Lower CV = higher consistency (inverse for display)
  return Math.max(0, 100 - coefficientOfVariation)
}
