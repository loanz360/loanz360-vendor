'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ConversionFunnelStage } from '@/types/bdm-team-performance'
import { Filter, TrendingDown } from 'lucide-react'

interface ConversionFunnelChartProps {
  funnel: ConversionFunnelStage[]
}

export default function ConversionFunnelChart({ funnel }: ConversionFunnelChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-purple-600" />
          Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {funnel.map((stage, index) => {
            const isLast = index === funnel.length - 1
            const widthPercentage = stage.id === 'revenue' ? 100 : stage.percentage

            return (
              <div key={stage.id} className="relative">
                {/* Stage Block */}
                <div
                  className={`relative ${stage.color} rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer`}
                  style={{
                    width: `${widthPercentage}%`,
                    minWidth: '50%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between text-white">
                      <div>
                        <div className="text-sm font-medium opacity-90">{stage.stageName}</div>
                        <div className="text-2xl font-bold mt-1">
                          {stage.formattedValue || stage.count.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        {stage.id !== 'leads' && stage.id !== 'revenue' && (
                          <div className="text-lg font-semibold">{stage.percentage.toFixed(1)}%</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drop-off Rate Badge */}
                  {!isLast && stage.dropoffRate > 0 && (
                    <div className="absolute -bottom-2 right-4 bg-white px-2 py-1 rounded shadow-md border border-gray-200">
                      <div className="flex items-center gap-1 text-xs">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        <span className="text-red-600 font-semibold">
                          -{stage.dropoffRate.toFixed(1)}%
                        </span>
                        <span className="text-gray-500">drop</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex justify-center my-2">
                    <div className="w-0.5 h-4 bg-gray-300" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Funnel Summary */}
        <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Overall Conversion Rate</div>
            <div className="text-2xl font-bold text-blue-600">
              {funnel[0]?.count > 0
                ? ((funnel.find((s) => s.id === 'conversions')?.count || 0) / funnel[0].count * 100).toFixed(1)
                : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Leads → Conversions</div>
          </div>

          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Meeting → Conversion</div>
            <div className="text-2xl font-bold text-green-600">
              {(funnel.find((s) => s.id === 'meetings')?.count || 0) > 0
                ? (
                    ((funnel.find((s) => s.id === 'conversions')?.count || 0) /
                      (funnel.find((s) => s.id === 'meetings')?.count || 1)) *
                    100
                  ).toFixed(1)
                : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Closing Efficiency</div>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-xs font-semibold text-gray-700 mb-2">Funnel Insights:</div>
          <ul className="space-y-1 text-xs text-gray-600">
            {getFunnelInsights(funnel).map((insight, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function getFunnelInsights(funnel: ConversionFunnelStage[]): string[] {
  const insights: string[] = []

  const leadsStage = funnel.find((s) => s.id === 'leads')
  const callsStage = funnel.find((s) => s.id === 'calls')
  const meetingsStage = funnel.find((s) => s.id === 'meetings')
  const conversionsStage = funnel.find((s) => s.id === 'conversions')

  if (!leadsStage || !callsStage || !meetingsStage || !conversionsStage) return insights

  // Insight 1: Biggest drop-off
  const dropoffs = funnel.filter((s) => s.dropoffRate > 0).sort((a, b) => b.dropoffRate - a.dropoffRate)
  if (dropoffs.length > 0) {
    insights.push(`Biggest drop-off at ${dropoffs[0].stageName} (${dropoffs[0].dropoffRate.toFixed(1)}%)`)
  }

  // Insight 2: Call-to-Meeting ratio
  const callToMeetingRate = (meetingsStage.count / (callsStage.count || 1)) * 100
  if (callToMeetingRate < 30) {
    insights.push('Low call-to-meeting conversion. Focus on call quality and scheduling.')
  } else if (callToMeetingRate > 50) {
    insights.push('Excellent call-to-meeting conversion rate!')
  }

  // Insight 3: Meeting-to-Conversion
  const meetingToConvRate = (conversionsStage.count / (meetingsStage.count || 1)) * 100
  if (meetingToConvRate < 30) {
    insights.push('Consider improving meeting preparation and closing techniques.')
  } else if (meetingToConvRate > 50) {
    insights.push('Strong closing rate from meetings!')
  }

  // Insight 4: Overall efficiency
  const overallConvRate = (conversionsStage.count / (leadsStage.count || 1)) * 100
  if (overallConvRate < 10) {
    insights.push('Overall conversion rate is low. Review lead quality and qualification process.')
  } else if (overallConvRate > 20) {
    insights.push('Excellent overall conversion efficiency!')
  }

  return insights
}
