'use client'

import React from 'react'
import { ChevronRight } from 'lucide-react'

interface FunnelStage {
  status: string
  label: string
  count: number
  totalValue: number
  formattedValue: string
  conversionRate: number
  color: string
  order: number
}

interface FunnelChartProps {
  stages: FunnelStage[]
  totalLeads: number
  totalValue: number
  overallConversion: number
  isLoading?: boolean
}

export function FunnelChart({
  stages,
  totalLeads,
  totalValue,
  overallConversion,
  isLoading = false,
}: FunnelChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No funnel data available
      </div>
    )
  }

  // Sort stages by order
  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  // Calculate maximum count for width percentage
  const maxCount = Math.max(...sortedStages.map(s => s.count))

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">Total Leads</p>
          <p className="text-2xl font-bold text-gray-900">{totalLeads.toLocaleString('en-IN')}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Total Value</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalValue >= 10000000
              ? `₹${(totalValue / 10000000).toFixed(2)} Cr`
              : totalValue >= 100000
              ? `₹${(totalValue / 100000).toFixed(2)} L`
              : `₹${totalValue.toLocaleString('en-IN')}`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Overall Conversion</p>
          <p className="text-2xl font-bold text-gray-900">{overallConversion.toFixed(1)}%</p>
        </div>
      </div>

      {/* Funnel Stages */}
      <div className="space-y-2">
        {sortedStages.map((stage, index) => {
          const widthPercentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
          const isFirst = index === 0
          const previousStage = index > 0 ? sortedStages[index - 1] : null
          const dropOffCount = previousStage ? previousStage.count - stage.count : 0
          const dropOffPercentage = previousStage && previousStage.count > 0
            ? ((dropOffCount / previousStage.count) * 100)
            : 0

          return (
            <div key={stage.status}>
              {/* Stage Bar */}
              <div className="relative">
                <div
                  className="rounded-lg p-4 transition-all duration-300 hover:shadow-md cursor-pointer"
                  style={{
                    backgroundColor: `${stage.color}15`,
                    width: `${Math.max(widthPercentage, 20)}%`,
                    borderLeft: `4px solid ${stage.color}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{stage.label}</h4>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: stage.color,
                            color: 'white',
                          }}
                        >
                          {stage.count.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-600">
                          {stage.formattedValue}
                        </span>
                        {!isFirst && (
                          <span className="text-sm font-medium" style={{ color: stage.color }}>
                            {stage.conversionRate.toFixed(1)}% conversion
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Drop-off Indicator */}
              {!isFirst && dropOffCount > 0 && (
                <div className="flex items-center gap-2 ml-4 my-1">
                  <div className="flex-1 h-px bg-gray-300" />
                  <span className="text-xs text-red-600 font-medium">
                    -{dropOffCount.toLocaleString('en-IN')} ({dropOffPercentage.toFixed(1)}% drop-off)
                  </span>
                  <div className="flex-1 h-px bg-gray-300" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">Pipeline Efficiency</p>
            <p className="text-xs text-blue-700 mt-1">
              {sortedStages[sortedStages.length - 1]?.count || 0} disbursed out of {sortedStages[0]?.count || 0} leads
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-900">
              {overallConversion.toFixed(1)}%
            </p>
            <p className="text-xs text-blue-700">Success Rate</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact horizontal funnel
export function FunnelChartHorizontal({
  stages,
  className = '',
}: {
  stages: FunnelStage[]
  className?: string
}) {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {sortedStages.map((stage, index) => (
        <React.Fragment key={stage.status}>
          <div className="flex-1 text-center">
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: `${stage.color}15`, borderTop: `3px solid ${stage.color}` }}
            >
              <p className="text-xs text-gray-600 mb-1">{stage.label}</p>
              <p className="text-lg font-bold text-gray-900">{stage.count}</p>
              {index > 0 && (
                <p className="text-xs font-medium mt-1" style={{ color: stage.color }}>
                  {stage.conversionRate.toFixed(0)}%
                </p>
              )}
            </div>
          </div>
          {index < sortedStages.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
