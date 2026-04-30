'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Activity, AlertCircle, CheckCircle } from 'lucide-react'

interface PerformanceProjectionsProps {
  month?: string
}

export function PerformanceProjectionsComponent({ month }: PerformanceProjectionsProps) {
  const projectionMonth = month || new Date().toISOString().slice(0, 7)

  const { data, isLoading } = useQuery({
    queryKey: ['performance-projections', projectionMonth],
    queryFn: async () => {
      const res = await fetch(`/api/bdm/team-targets/projections?month=${projectionMonth}`)
      if (!res.ok) throw new Error('Failed to fetch projections')
      return res.json()
    },
  })

  const projections = data?.data?.projections || []

  const getLikelihoodColor = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return 'text-green-600 bg-green-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getLikelihoodIcon = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return <CheckCircle className="w-4 h-4" />
      case 'medium': return <Activity className="w-4 h-4" />
      case 'low': return <AlertCircle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const calculateProgress = (current: number, projected: number) => {
    if (projected === 0) return 0
    return Math.min(Math.round((current / projected) * 100), 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const teamSummary = {
    totalProjectedLeads: projections.reduce((sum: number, p: unknown) => sum + (p.projected_leads || 0), 0),
    totalCurrentLeads: projections.reduce((sum: number, p: unknown) => sum + (p.current_leads || 0), 0),
    totalProjectedConversions: projections.reduce((sum: number, p: unknown) => sum + (p.projected_conversions || 0), 0),
    totalCurrentConversions: projections.reduce((sum: number, p: unknown) => sum + (p.current_conversions || 0), 0),
    totalProjectedRevenue: projections.reduce((sum: number, p: unknown) => sum + (p.projected_revenue || 0), 0),
    totalCurrentRevenue: projections.reduce((sum: number, p: unknown) => sum + (p.current_revenue || 0), 0),
    avgConfidence: projections.length > 0
      ? projections.reduce((sum: number, p: unknown) => sum + (p.confidence_score || 0), 0) / projections.length
      : 0,
  }

  return (
    <div className="space-y-6">
      {/* Team Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Leads Projection</span>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{teamSummary.totalProjectedLeads}</span>
              <span className="text-sm text-gray-600">projected</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Current: </span>
              <span className="font-medium">{teamSummary.totalCurrentLeads}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(calculateProgress(teamSummary.totalCurrentLeads, teamSummary.totalProjectedLeads))}`}
                style={{ width: `${calculateProgress(teamSummary.totalCurrentLeads, teamSummary.totalProjectedLeads)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Conversions Projection</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{teamSummary.totalProjectedConversions}</span>
              <span className="text-sm text-gray-600">projected</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Current: </span>
              <span className="font-medium">{teamSummary.totalCurrentConversions}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(calculateProgress(teamSummary.totalCurrentConversions, teamSummary.totalProjectedConversions))}`}
                style={{ width: `${calculateProgress(teamSummary.totalCurrentConversions, teamSummary.totalProjectedConversions)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-600">Revenue Projection</span>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">₹{(teamSummary.totalProjectedRevenue / 100000).toFixed(1)}L</span>
              <span className="text-sm text-gray-600">projected</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Current: </span>
              <span className="font-medium">₹{(teamSummary.totalCurrentRevenue / 100000).toFixed(1)}L</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(calculateProgress(teamSummary.totalCurrentRevenue, teamSummary.totalProjectedRevenue))}`}
                style={{ width: `${calculateProgress(teamSummary.totalCurrentRevenue, teamSummary.totalProjectedRevenue)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Average Confidence Meter */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Team Confidence Score</h3>
          <span className="text-2xl font-bold text-blue-600">{teamSummary.avgConfidence.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
            style={{ width: `${teamSummary.avgConfidence}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Based on current performance trends and historical data
        </p>
      </div>

      {/* Individual BDE Projections */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-bold text-lg mb-4">Individual Projections</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : projections.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No projections available for this month</p>
        ) : (
          <div className="space-y-4">
            {projections.map((projection: unknown) => {
              const leadsProgress = calculateProgress(projection.current_leads, projection.projected_leads)
              const conversionsProgress = calculateProgress(projection.current_conversions, projection.projected_conversions)
              const revenueProgress = calculateProgress(projection.current_revenue, projection.projected_revenue)

              return (
                <div key={projection.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-semibold">{projection.bde?.full_name || 'BDE'}</h4>
                        <p className="text-xs text-gray-600">
                          {projection.days_elapsed} days elapsed • {projection.days_remaining} days remaining
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getLikelihoodColor(projection.likelihood)}`}>
                        {getLikelihoodIcon(projection.likelihood)}
                        {projection.likelihood} likelihood
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        {projection.confidence_score}% confidence
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Leads */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Leads</span>
                        <span className="text-xs font-medium">{leadsProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(leadsProgress)}`}
                          style={{ width: `${leadsProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{projection.current_leads}</span>
                        <span className="font-medium">{projection.projected_leads}</span>
                      </div>
                    </div>

                    {/* Conversions */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Conversions</span>
                        <span className="text-xs font-medium">{conversionsProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(conversionsProgress)}`}
                          style={{ width: `${conversionsProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{projection.current_conversions}</span>
                        <span className="font-medium">{projection.projected_conversions}</span>
                      </div>
                    </div>

                    {/* Revenue */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Revenue</span>
                        <span className="text-xs font-medium">{revenueProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(revenueProgress)}`}
                          style={{ width: `${revenueProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">₹{(projection.current_revenue / 100000).toFixed(1)}L</span>
                        <span className="font-medium">₹{(projection.projected_revenue / 100000).toFixed(1)}L</span>
                      </div>
                    </div>
                  </div>

                  {/* Trend Indicator */}
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
                    {conversionsProgress >= 80 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">On track to exceed target</span>
                      </>
                    ) : conversionsProgress >= 50 ? (
                      <>
                        <Activity className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-600">Needs attention to meet target</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-red-600">At risk of missing target</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
