'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonthEndProjection } from '@/types/bdm-team-performance'
import { TrendingUp, TrendingDown, Target, DollarSign, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'

interface MonthEndProjectionCardsProps {
  projections: MonthEndProjection[]
  daysRemaining: number
}

export default function MonthEndProjectionCards({ projections, daysRemaining }: MonthEndProjectionCardsProps) {
  if (!projections || projections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No projection data available</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {projections.map((projection) => {
        const Icon = getMetricIcon(projection.metric)
        const isOnTrack = projection.gap <= 0
        const isVeryFeasible = projection.feasibility === 'very_feasible'
        const isFeasible = projection.feasibility === 'feasible'

        return (
          <Card
            key={projection.metric}
            className={`border-2 ${
              isOnTrack
                ? 'border-green-400 bg-gradient-to-br from-green-50 to-green-100'
                : projection.feasibility === 'unlikely'
                ? 'border-red-400 bg-gradient-to-br from-red-50 to-red-100'
                : 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100'
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className={`h-5 w-5 ${getMetricColor(projection.metric)}`} />
                  {getMetricLabel(projection.metric)}
                </CardTitle>
                {isOnTrack ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current vs Target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Current</span>
                  <span className="font-bold text-gray-900">
                    {formatValue(projection.metric, projection.current.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Target</span>
                  <span className="font-bold text-gray-900">
                    {formatValue(projection.metric, projection.target.value)}
                  </span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${
                      isOnTrack ? 'bg-green-500' : 'bg-yellow-500'
                    } transition-all duration-500`}
                    style={{
                      width: `${Math.min(100, (projection.current.value / projection.target.value) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-600 text-right">
                  {((projection.current.value / projection.target.value) * 100).toFixed(1)}% of target
                </div>
              </div>

              {/* Projection */}
              <div className="bg-white/70 rounded-lg p-3 border-2 border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Month-End Projection</div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatValue(projection.metric, projection.projected.mostLikely)}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                  <span>Optimistic: {formatValue(projection.metric, projection.projected.optimistic)}</span>
                  <span>Pessimistic: {formatValue(projection.metric, projection.projected.pessimistic)}</span>
                </div>
                <div className="mt-2 text-xs font-medium text-gray-700">
                  Confidence: {projection.projected.confidence}%
                </div>
              </div>

              {/* Gap Analysis */}
              <div className={`rounded-lg p-3 ${isOnTrack ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Gap to Target</span>
                  <span className={`text-2xl font-bold ${isOnTrack ? 'text-green-700' : 'text-red-700'}`}>
                    {isOnTrack ? '+' : ''}
                    {formatValue(projection.metric, Math.abs(projection.gap))}
                  </span>
                </div>
                {!isOnTrack && (
                  <div className="text-xs text-gray-700">
                    <div className="font-medium mb-1">Required Daily Rate:</div>
                    <div>{formatValue(projection.metric, projection.requiredPace)} per day</div>
                    <div className="mt-1">
                      Current: {formatValue(projection.metric, projection.currentPace)} per day
                    </div>
                  </div>
                )}
              </div>

              {/* Likelihood */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">Likelihood</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xs w-24 text-gray-600">Exceed</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${projection.likelihood.exceedTarget}%` }}
                      />
                    </div>
                    <div className="text-xs w-10 text-right font-medium">
                      {projection.likelihood.exceedTarget}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs w-24 text-gray-600">Meet</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${projection.likelihood.meetTarget}%` }}
                      />
                    </div>
                    <div className="text-xs w-10 text-right font-medium">
                      {projection.likelihood.meetTarget}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs w-24 text-gray-600">Fall Short</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-red-500"
                        style={{ width: `${projection.likelihood.fallShort}%` }}
                      />
                    </div>
                    <div className="text-xs w-10 text-right font-medium">
                      {projection.likelihood.fallShort}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Feasibility */}
              <div
                className={`rounded-lg p-3 border-2 ${
                  isVeryFeasible
                    ? 'bg-green-50 border-green-500'
                    : isFeasible
                    ? 'bg-blue-50 border-blue-500'
                    : projection.feasibility === 'challenging'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isVeryFeasible || isFeasible ? (
                    <CheckCircle2
                      className={`h-5 w-5 ${isVeryFeasible ? 'text-green-600' : 'text-blue-600'}`}
                    />
                  ) : (
                    <AlertTriangle
                      className={`h-5 w-5 ${projection.feasibility === 'challenging' ? 'text-yellow-600' : 'text-red-600'}`}
                    />
                  )}
                  <span
                    className={`text-sm font-bold ${
                      isVeryFeasible
                        ? 'text-green-700'
                        : isFeasible
                        ? 'text-blue-700'
                        : projection.feasibility === 'challenging'
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}
                  >
                    {projection.feasibility.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-700">{projection.reasoning}</div>
              </div>

              {/* Days Remaining */}
              <div className="text-center py-2 bg-white/50 rounded border">
                <div className="text-2xl font-bold text-gray-900">{daysRemaining}</div>
                <div className="text-xs text-gray-600">Days Remaining</div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function getMetricIcon(metric: string) {
  switch (metric) {
    case 'conversions':
      return Target
    case 'revenue':
      return DollarSign
    case 'leads':
      return Users
    default:
      return Target
  }
}

function getMetricColor(metric: string) {
  switch (metric) {
    case 'conversions':
      return 'text-blue-600'
    case 'revenue':
      return 'text-green-600'
    case 'leads':
      return 'text-purple-600'
    default:
      return 'text-gray-600'
  }
}

function getMetricLabel(metric: string) {
  switch (metric) {
    case 'conversions':
      return 'Conversions'
    case 'revenue':
      return 'Revenue'
    case 'leads':
      return 'Leads'
    default:
      return metric
  }
}

function formatValue(metric: string, value: number): string {
  switch (metric) {
    case 'revenue':
      return formatCurrency(value, true)
    case 'conversions':
    case 'leads':
      return Math.round(value).toString()
    default:
      return value.toString()
  }
}
