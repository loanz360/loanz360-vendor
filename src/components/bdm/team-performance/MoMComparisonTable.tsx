'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MoMComparison } from '@/types/bdm-team-performance'
import { ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'

interface MoMComparisonTableProps {
  comparisons: MoMComparison[]
}

export default function MoMComparisonTable({ comparisons }: MoMComparisonTableProps) {
  if (!comparisons || comparisons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-purple-600" />
            Month-over-Month Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <ArrowUpDown className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No comparison data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5 text-purple-600" />
          Month-over-Month Comparison
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Compare performance changes between consecutive months
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Month</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Metric</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Current</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Previous</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Change</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">% Change</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comparison, index) => (
                <tbody key={index} className="border-b border-gray-200">
                  {/* Conversions Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900" rowSpan={3}>
                      <div>
                        <div className="font-bold">{comparison.month}</div>
                        <div className="text-xs text-gray-500">{comparison.year}</div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-gray-700">Conversions</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-bold text-gray-900">
                      {comparison.conversions.current}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {comparison.conversions.previous}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={getChangeColor(comparison.conversions.change)}>
                        {comparison.conversions.change > 0 ? '+' : ''}{comparison.conversions.change}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {getTrendIcon(comparison.conversions.changePercentage)}
                        <span className={`font-semibold ${getChangeColor(comparison.conversions.changePercentage)}`}>
                          {comparison.conversions.changePercentage > 0 ? '+' : ''}
                          {comparison.conversions.changePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Revenue Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-gray-700">Revenue</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-bold text-gray-900">
                      {formatCurrency(comparison.revenue.current, true)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatCurrency(comparison.revenue.previous, true)}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={getChangeColor(comparison.revenue.change)}>
                        {comparison.revenue.change > 0 ? '+' : ''}
                        {formatCurrency(comparison.revenue.change, true)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {getTrendIcon(comparison.revenue.changePercentage)}
                        <span className={`font-semibold ${getChangeColor(comparison.revenue.changePercentage)}`}>
                          {comparison.revenue.changePercentage > 0 ? '+' : ''}
                          {comparison.revenue.changePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Conversion Rate Row */}
                  <tr className="hover:bg-gray-50 border-b-2 border-gray-300">
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-sm font-medium text-gray-700">Conv. Rate</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-bold text-gray-900">
                      {comparison.conversionRate.current.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {comparison.conversionRate.previous.toFixed(1)}%
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={getChangeColor(comparison.conversionRate.change)}>
                        {comparison.conversionRate.change > 0 ? '+' : ''}
                        {comparison.conversionRate.change.toFixed(1)}pp
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {getTrendIcon(comparison.conversionRate.changePercentage)}
                        <span className={`font-semibold ${getChangeColor(comparison.conversionRate.changePercentage)}`}>
                          {comparison.conversionRate.changePercentage > 0 ? '+' : ''}
                          {comparison.conversionRate.changePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-semibold text-gray-900 mb-4">Overall Trends</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversions Trend */}
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="text-xs text-blue-700 mb-1 font-medium">Avg. Conversions Change</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-blue-900">
                  {comparisons.length > 0
                    ? (
                        comparisons.reduce((sum, c) => sum + c.conversions.changePercentage, 0) /
                        comparisons.length
                      ).toFixed(1)
                    : '0'}
                  %
                </div>
                {getTrendIcon(
                  comparisons.reduce((sum, c) => sum + c.conversions.changePercentage, 0) /
                    comparisons.length
                )}
              </div>
            </div>

            {/* Revenue Trend */}
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="text-xs text-green-700 mb-1 font-medium">Avg. Revenue Change</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-green-900">
                  {comparisons.length > 0
                    ? (
                        comparisons.reduce((sum, c) => sum + c.revenue.changePercentage, 0) /
                        comparisons.length
                      ).toFixed(1)
                    : '0'}
                  %
                </div>
                {getTrendIcon(
                  comparisons.reduce((sum, c) => sum + c.revenue.changePercentage, 0) /
                    comparisons.length
                )}
              </div>
            </div>

            {/* Conversion Rate Trend */}
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="text-xs text-purple-700 mb-1 font-medium">Avg. Conv. Rate Change</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-purple-900">
                  {comparisons.length > 0
                    ? (
                        comparisons.reduce((sum, c) => sum + c.conversionRate.changePercentage, 0) /
                        comparisons.length
                      ).toFixed(1)
                    : '0'}
                  %
                </div>
                {getTrendIcon(
                  comparisons.reduce((sum, c) => sum + c.conversionRate.changePercentage, 0) /
                    comparisons.length
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
          <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Key Insights
          </h4>
          <ul className="space-y-1 text-sm text-indigo-800">
            {getInsights(comparisons).map((insight, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-indigo-600 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function getChangeColor(value: number): string {
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-gray-600'
}

function getTrendIcon(value: number) {
  if (value > 5) return <TrendingUp className="h-4 w-4 text-green-600" />
  if (value < -5) return <TrendingDown className="h-4 w-4 text-red-600" />
  return <Minus className="h-4 w-4 text-gray-600" />
}

function getInsights(comparisons: MoMComparison[]): string[] {
  const insights: string[] = []

  if (comparisons.length === 0) return ['No data available for insights']

  // Calculate average changes
  const avgConvChange =
    comparisons.reduce((sum, c) => sum + c.conversions.changePercentage, 0) / comparisons.length
  const avgRevChange =
    comparisons.reduce((sum, c) => sum + c.revenue.changePercentage, 0) / comparisons.length
  const avgRateChange =
    comparisons.reduce((sum, c) => sum + c.conversionRate.changePercentage, 0) / comparisons.length

  // Conversion insights
  if (avgConvChange > 10) {
    insights.push(
      `Strong growth trend: Conversions increasing by ${avgConvChange.toFixed(1)}% on average`
    )
  } else if (avgConvChange < -10) {
    insights.push(
      `Declining conversions: Average decrease of ${Math.abs(avgConvChange).toFixed(1)}% - review sales strategy`
    )
  } else {
    insights.push(`Conversions are relatively stable with ${avgConvChange.toFixed(1)}% average change`)
  }

  // Revenue insights
  if (avgRevChange > 15) {
    insights.push(`Excellent revenue growth: ${avgRevChange.toFixed(1)}% average increase`)
  } else if (avgRevChange < -10) {
    insights.push(
      `Revenue declining by ${Math.abs(avgRevChange).toFixed(1)}% - investigate pricing or deal sizes`
    )
  }

  // Efficiency insights
  if (avgRateChange > 5) {
    insights.push(`Conversion rate improving: Team efficiency is increasing`)
  } else if (avgRateChange < -5) {
    insights.push(`Conversion rate declining: Focus on lead quality and sales training`)
  }

  // Recent month analysis
  const latestMonth = comparisons[0]
  if (latestMonth) {
    if (
      latestMonth.conversions.changePercentage > 20 &&
      latestMonth.revenue.changePercentage > 20
    ) {
      insights.push(
        `🔥 Outstanding performance in ${latestMonth.month}: Both conversions and revenue up 20%+`
      )
    } else if (
      latestMonth.conversions.changePercentage < -20 ||
      latestMonth.revenue.changePercentage < -20
    ) {
      insights.push(
        `⚠️ ${latestMonth.month} showed significant decline - immediate attention needed`
      )
    }
  }

  return insights
}
