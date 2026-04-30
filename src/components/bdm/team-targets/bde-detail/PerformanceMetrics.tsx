'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react'

interface PerformanceMetricsProps {
  summary: unknown}

export default function PerformanceMetrics({ summary }: PerformanceMetricsProps) {
  const metrics = [
    {
      icon: <Users className="w-6 h-6" />,
      label: 'Leads Contacted',
      value: summary.metrics.leadsContacted,
      target: summary.targets.leadsContacted,
      achievement: summary.achievement.leadsAchievement,
      color: 'purple',
      bgColor: 'bg-purple-900/20',
      borderColor: 'border-purple-500/30',
    },
    {
      icon: <Target className="w-6 h-6" />,
      label: 'Conversions',
      value: summary.metrics.conversions,
      target: summary.targets.conversions,
      achievement: summary.achievement.conversionsAchievement,
      color: 'green',
      bgColor: 'bg-green-900/20',
      borderColor: 'border-green-500/30',
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      label: 'Revenue Generated',
      value: `₹${(summary.metrics.revenue / 10000000).toFixed(2)}Cr`,
      target: `₹${(summary.targets.revenue / 10000000).toFixed(2)}Cr`,
      achievement: summary.achievement.revenueAchievement,
      color: 'orange',
      bgColor: 'bg-orange-900/20',
      borderColor: 'border-orange-500/30',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {metrics.map((metric, index) => (
        <Card key={index} className={`content-card ${metric.borderColor}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${metric.bgColor}`}>{metric.icon}</div>
              <div className="text-right">
                <div className="text-sm text-gray-400">{metric.label}</div>
                <div className="text-3xl font-bold text-white mt-1">{metric.value}</div>
                <div className="text-xs text-gray-500 mt-1">Target: {metric.target}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span className="font-semibold text-white">{metric.achievement.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-${metric.color}-500 transition-all duration-500`}
                  style={{ width: `${Math.min(100, metric.achievement)}%` }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between text-sm">
              {metric.achievement >= 100 ? (
                <span className="text-green-500 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Target Exceeded
                </span>
              ) : metric.achievement >= 70 ? (
                <span className="text-blue-500">On Track</span>
              ) : metric.achievement >= 50 ? (
                <span className="text-yellow-500">At Risk</span>
              ) : (
                <span className="text-red-500">Behind</span>
              )}
              <span className="text-gray-500">
                {metric.achievement >= 100
                  ? `+${(metric.achievement - 100).toFixed(0)}%`
                  : `-${(100 - metric.achievement).toFixed(0)}%`}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
