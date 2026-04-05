'use client'

import React from 'react'

interface ActivityTimelineProps {
  summary: any
}

export default function ActivityTimeline({ summary }: ActivityTimelineProps) {
  const stats = [
    {
      label: 'Total Active Days',
      value: summary.performance.activeDays,
      total: summary.performance.totalDays,
      percentage: summary.performance.activityRate,
      color: 'blue',
    },
    {
      label: 'Days Exceeded Target',
      value: summary.performance.exceededDays,
      total: summary.performance.totalDays,
      percentage: (summary.performance.exceededDays / summary.performance.totalDays) * 100,
      color: 'green',
    },
    {
      label: 'Days Met Target',
      value: summary.performance.metDays,
      total: summary.performance.totalDays,
      percentage: (summary.performance.metDays / summary.performance.totalDays) * 100,
      color: 'blue',
    },
  ]

  const averages = [
    {
      label: 'Average Daily Leads',
      value: summary.performance.avgDailyLeads.toFixed(1),
      icon: '📞',
      color: 'purple',
    },
    {
      label: 'Average Daily Conversions',
      value: summary.performance.avgDailyConversions.toFixed(1),
      icon: '✅',
      color: 'green',
    },
    {
      label: 'Average Daily Revenue',
      value: `₹${(summary.performance.avgDailyRevenue / 100000).toFixed(2)}L`,
      icon: '💰',
      color: 'orange',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Activity Statistics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Activity Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{stat.label}</span>
                <span className="text-xs text-gray-500">
                  {stat.value}/{stat.total}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-2">{stat.percentage.toFixed(0)}%</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-full rounded-full bg-${stat.color}-500`}
                  style={{ width: `${Math.min(100, stat.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Averages */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Daily Averages</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {averages.map((avg, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{avg.icon}</span>
                <div>
                  <div className="text-sm text-gray-400">{avg.label}</div>
                  <div className="text-xl font-bold text-white">{avg.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Month Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-white mb-1">{summary.metrics.leadsContacted}</div>
            <div className="text-sm text-gray-400">Total Leads</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.achievement.leadsAchievement.toFixed(0)}% of target
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-400 mb-1">{summary.metrics.conversions}</div>
            <div className="text-sm text-gray-400">Total Conversions</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.achievement.conversionsAchievement.toFixed(0)}% of target
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-400 mb-1">
              ₹{(summary.metrics.revenue / 10000000).toFixed(2)}Cr
            </div>
            <div className="text-sm text-gray-400">Total Revenue</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.achievement.revenueAchievement.toFixed(0)}% of target
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-400 mb-1">{summary.metrics.conversionRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-400">Conversion Rate</div>
            <div className="text-xs text-gray-500 mt-1">Lead to conversion</div>
          </div>
        </div>
      </div>
    </div>
  )
}
