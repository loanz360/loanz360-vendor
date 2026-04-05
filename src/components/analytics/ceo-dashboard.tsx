'use client'

import { toast } from 'sonner'

/**
 * CEO Executive Dashboard
 * High-level business metrics and insights
 */

import { useState, useEffect } from 'react'
import type { CEODashboardData, BusinessInsight } from '@/lib/analytics/analytics-types'

interface KPICardProps {
  title: string
  value: string
  trend: 'up' | 'down' | 'stable'
  change: string
  isPositive: boolean
}

function KPICard({ title, value, trend, change, isPositive }: KPICardProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600'

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
      <div className={`text-sm ${trendColor} flex items-center gap-1`}>
        <span className="text-lg">{trendIcon}</span>
        <span>{change}</span>
      </div>
    </div>
  )
}

export default function CEODashboard() {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<CEODashboardData | null>(null)
  const [insights, setInsights] = useState<BusinessInsight[]>([])
  const [lastUpdated, setLastUpdated] = useState('')

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch dashboard KPIs
      const dashboardRes = await fetch('/api/analytics/dashboard?type=ceo')
      const dashboardJson = await dashboardRes.json()

      if (dashboardJson.success) {
        setDashboardData(dashboardJson.data)
        setLastUpdated(new Date(dashboardJson.last_updated).toLocaleString())
      }

      // Fetch recent insights
      const insightsRes = await fetch('/api/analytics/insights?limit=5&unread_only=true')
      const insightsJson = await insightsRes.json()

      if (insightsJson.success) {
        setInsights(insightsJson.insights)
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const generateInsights = async () => {
    try {
      const res = await fetch('/api/analytics/insights', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        setInsights(data.insights.slice(0, 5))
        toast.success(`Generated ${data.insights.length} new insights`)
      }
    } catch (error) {
      console.error('Failed to generate insights:', error)
    }
  }

  if (loading || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CEO Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Last updated: {lastUpdated}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Revenue"
          value={dashboardData.total_revenue.formatted_value}
          trend={dashboardData.total_revenue.trend}
          change={`${dashboardData.total_revenue.change_percentage.toFixed(1)}% vs last period`}
          isPositive={dashboardData.total_revenue.is_positive}
        />
        <KPICard
          title="Total Leads"
          value={dashboardData.total_leads.formatted_value}
          trend={dashboardData.total_leads.trend}
          change={`${dashboardData.total_leads.change_percentage.toFixed(1)}% vs last period`}
          isPositive={dashboardData.total_leads.is_positive}
        />
        <KPICard
          title="Conversion Rate"
          value={dashboardData.conversion_rate.formatted_value}
          trend={dashboardData.conversion_rate.trend}
          change={`${dashboardData.conversion_rate.change_percentage.toFixed(1)}% vs last period`}
          isPositive={dashboardData.conversion_rate.is_positive}
        />
        <KPICard
          title="Active CROs"
          value={dashboardData.active_cros.formatted_value}
          trend={dashboardData.active_cros.trend}
          change={`${dashboardData.active_cros.change_percentage.toFixed(1)}% vs last period`}
          isPositive={dashboardData.active_cros.is_positive}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="Customer Acquisition Cost"
          value={dashboardData.customer_acquisition_cost.formatted_value}
          trend={dashboardData.customer_acquisition_cost.trend}
          change={`${dashboardData.customer_acquisition_cost.change_percentage.toFixed(1)}%`}
          isPositive={!dashboardData.customer_acquisition_cost.is_positive} // Lower is better
        />
        <KPICard
          title="Customer Lifetime Value"
          value={dashboardData.customer_lifetime_value.formatted_value}
          trend={dashboardData.customer_lifetime_value.trend}
          change={`${dashboardData.customer_lifetime_value.change_percentage.toFixed(1)}%`}
          isPositive={dashboardData.customer_lifetime_value.is_positive}
        />
        <KPICard
          title="Growth Rate"
          value={dashboardData.growth_rate.formatted_value}
          trend={dashboardData.growth_rate.trend}
          change={`${dashboardData.growth_rate.change_percentage.toFixed(1)}% MoM`}
          isPositive={dashboardData.growth_rate.is_positive}
        />
      </div>

      {/* AI Insights Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">AI-Powered Insights</h2>
          <button
            onClick={generateInsights}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            Generate New Insights
          </button>
        </div>

        {insights.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No insights available. Click "Generate New Insights" to analyze your data.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {insights.map((insight) => (
              <div key={insight.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    insight.severity === 'critical' ? 'bg-red-600 text-white' :
                    insight.severity === 'high' ? 'bg-orange-600 text-white' :
                    insight.severity === 'medium' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  }`}>
                    {insight.severity.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {insight.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{insight.description}</p>

                    {insight.recommendations.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">Recommendations:</div>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {insight.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Impact: {insight.estimated_impact}</span>
                      <span>Effort: {insight.implementation_effort}</span>
                      <span>{new Date(insight.detected_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="p-6 bg-white rounded-lg shadow hover:shadow-md transition text-left">
          <div className="text-lg font-semibold text-gray-900 mb-2">View Revenue Forecast</div>
          <div className="text-sm text-gray-600">30/60/90-day revenue predictions with ML</div>
        </button>
        <button className="p-6 bg-white rounded-lg shadow hover:shadow-md transition text-left">
          <div className="text-lg font-semibold text-gray-900 mb-2">Lead Scoring Report</div>
          <div className="text-sm text-gray-600">AI-powered conversion probability analysis</div>
        </button>
        <button className="p-6 bg-white rounded-lg shadow hover:shadow-md transition text-left">
          <div className="text-lg font-semibold text-gray-900 mb-2">Team Performance</div>
          <div className="text-sm text-gray-600">CRO productivity and quota attainment</div>
        </button>
      </div>
    </div>
  )
}
