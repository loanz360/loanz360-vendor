'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  User,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Award,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  Activity,
  BarChart3,
  PieChart,
  FileText,
} from 'lucide-react'
import { TrendsSparkline } from './TrendsChart'
import { ActivityHeatmapCompact } from './ActivityHeatmap'

interface BDEDetail {
  bdeId: string
  bdeName: string
  bdeEmail: string
  bdePhone: string
  bdeAvatar: string | null
  joinedDate: string

  // Performance Metrics
  performanceScore: number
  scoreGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  scoreColor: string

  // Lead Metrics
  totalLeads: number
  activeLeads: number
  convertedLeads: number
  lostLeads: number
  conversionRate: number
  conversionRateTrend: 'up' | 'down' | 'neutral'
  conversionRateChange: number

  // Revenue Metrics
  totalRevenue: number
  formattedRevenue: string
  avgDealSize: number
  formattedAvgDealSize: string
  revenueTrend: 'up' | 'down' | 'neutral'
  revenueChange: number

  // Efficiency Metrics
  avgTAT: number
  avgResponseTime: number
  activitiesCount: number
  activitiesPerLead: number

  // Pipeline Metrics
  pipelineValue: number
  formattedPipelineValue: string
  atRiskLeads: number
  staleLeads: number

  // Rankings
  conversionRank: number
  revenueRank: number
  overallRank: number
  teamSize: number

  // Stage Breakdown
  stageBreakdown: Array<{
    stage: string
    stageLabel: string
    count: number
    percentage: number
    color: string
  }>

  // Recent Performance Trend
  performanceTrend: Array<{
    date: string
    formattedDate: string
    value: number
    formattedValue: string
  }>

  // Top Leads
  topLeads: Array<{
    id: string
    customerName: string
    loanAmount: number
    formattedAmount: string
    currentStage: string
    daysInStage: number
  }>

  // Recommendations
  recommendations: Array<{
    type: 'improvement' | 'strength' | 'alert'
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
  }>
}

interface BDEDrilldownModalProps {
  bdeId: string
  isOpen: boolean
  onClose: () => void
}

export function BDEDrilldownModal({ bdeId, isOpen, onClose }: BDEDrilldownModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'activity' | 'insights'>('overview')

  // Fetch BDE details
  const { data, isLoading, error } = useQuery({
    queryKey: ['bde-detail', bdeId],
    queryFn: async () => {
      const res = await fetch(`/api/bdm/team-pipeline/bde-performance/individual?bdeId=${bdeId}`)
      if (!res.ok) throw new Error('Failed to fetch BDE details')
      return res.json()
    },
    enabled: isOpen && !!bdeId,
  })

  const bde: BDEDetail | undefined = data?.data?.bde

  if (!isOpen) return null

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+{change.toFixed(1)}%</span>
        </div>
      )
    }
    if (trend === 'down') {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-medium">{change.toFixed(1)}%</span>
        </div>
      )
    }
    return <div className="text-sm text-gray-600">No change</div>
  }

  const getRankBadge = (rank: number, total: number) => {
    const percentage = ((total - rank + 1) / total) * 100

    if (rank === 1) {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-full">
          <Award className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-bold text-yellow-800">Top Performer</span>
        </div>
      )
    }

    if (percentage >= 75) {
      return (
        <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          Top {Math.round(percentage)}%
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
        #{rank} of {total}
      </span>
    )
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">BDE Performance Details</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {isLoading ? (
              <div className="h-20 bg-blue-700 rounded animate-pulse" />
            ) : bde && (
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-blue-700 text-3xl font-bold shadow-lg">
                  {bde.bdeName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-1">{bde.bdeName}</h3>
                  <div className="flex items-center gap-4 text-sm opacity-90">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {bde.bdeEmail}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {bde.bdePhone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Joined {bde.joinedDate}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {getRankBadge(bde.overallRank, bde.teamSize)}
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className="text-sm opacity-90">Performance Score:</span>
                    <span className="text-3xl font-bold">{bde.scoreGrade}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'leads', label: 'Leads', icon: FileText },
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'insights', label: 'Insights', icon: Target },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
                <p className="text-lg font-medium">Failed to load BDE details</p>
              </div>
            ) : bde && (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-medium text-blue-900">Total Leads</span>
                        </div>
                        <p className="text-3xl font-bold text-blue-900">{bde.totalLeads}</p>
                        <p className="text-xs text-blue-700 mt-1">
                          {bde.activeLeads} active
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-medium text-green-900">Conversion Rate</span>
                        </div>
                        <p className="text-3xl font-bold text-green-900">{bde.conversionRate.toFixed(1)}%</p>
                        {getTrendIcon(bde.conversionRateTrend, bde.conversionRateChange)}
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-medium text-purple-900">Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-900">{bde.formattedRevenue}</p>
                        {getTrendIcon(bde.revenueTrend, bde.revenueChange)}
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-medium text-orange-900">Avg TAT</span>
                        </div>
                        <p className="text-3xl font-bold text-orange-900">{bde.avgTAT.toFixed(1)}</p>
                        <p className="text-xs text-orange-700 mt-1">days</p>
                      </div>
                    </div>

                    {/* Stage Breakdown */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Distribution by Stage</h3>
                      <div className="space-y-2">
                        {bde.stageBreakdown.map(stage => (
                          <div key={stage.stage}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">{stage.stageLabel}</span>
                              <span className="text-sm text-gray-600">{stage.count} leads ({stage.percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${stage.percentage}%`,
                                  backgroundColor: stage.color,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance Trend */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trend (Last 30 Days)</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        {bde.performanceTrend && bde.performanceTrend.length > 0 ? (
                          <TrendsSparkline dataPoints={bde.performanceTrend} color={bde.scoreColor} height={80} />
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">No trend data available</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Leads Tab */}
                {activeTab === 'leads' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Active Leads</h3>
                      <div className="space-y-3">
                        {bde.topLeads && bde.topLeads.length > 0 ? (
                          bde.topLeads.map(lead => (
                            <div key={lead.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                                  {lead.customerName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{lead.customerName}</p>
                                  <p className="text-sm text-gray-600">{lead.currentStage}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{lead.formattedAmount}</p>
                                <p className="text-xs text-gray-600">{lead.daysInStage} days in stage</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-8">No active leads</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-green-900 mb-1">Converted</p>
                        <p className="text-2xl font-bold text-green-700">{bde.convertedLeads}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-900 mb-1">Active</p>
                        <p className="text-2xl font-bold text-blue-700">{bde.activeLeads}</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-red-900 mb-1">Lost</p>
                        <p className="text-2xl font-bold text-red-700">{bde.lostLeads}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Total Activities</p>
                        <p className="text-3xl font-bold text-gray-900">{bde.activitiesCount}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Activities per Lead</p>
                        <p className="text-3xl font-bold text-gray-900">{bde.activitiesPerLead.toFixed(1)}</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Avg Response Time</p>
                        <p className="text-3xl font-bold text-gray-900">{bde.avgResponseTime.toFixed(0)}h</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Heatmap (Coming Soon)</h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                        <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>Activity heatmap visualization</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Insights Tab */}
                {activeTab === 'insights' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">AI-Powered Recommendations</h3>
                      <div className="space-y-3">
                        {bde.recommendations && bde.recommendations.length > 0 ? (
                          bde.recommendations.map((rec, index) => (
                            <div
                              key={index}
                              className={`border-l-4 rounded-lg p-4 ${
                                rec.type === 'improvement' ? 'bg-orange-50 border-orange-500' :
                                rec.type === 'strength' ? 'bg-green-50 border-green-500' :
                                'bg-red-50 border-red-500'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  rec.type === 'improvement' ? 'bg-orange-200' :
                                  rec.type === 'strength' ? 'bg-green-200' :
                                  'bg-red-200'
                                }`}>
                                  {rec.type === 'improvement' ? <TrendingUp className="w-4 h-4 text-orange-700" /> :
                                   rec.type === 'strength' ? <Award className="w-4 h-4 text-green-700" /> :
                                   <AlertCircle className="w-4 h-4 text-red-700" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className={`font-semibold ${
                                      rec.type === 'improvement' ? 'text-orange-900' :
                                      rec.type === 'strength' ? 'text-green-900' :
                                      'text-red-900'
                                    }`}>
                                      {rec.title}
                                    </h4>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {rec.priority}
                                    </span>
                                  </div>
                                  <p className={`text-sm ${
                                    rec.type === 'improvement' ? 'text-orange-700' :
                                    rec.type === 'strength' ? 'text-green-700' :
                                    'text-red-700'
                                  }`}>
                                    {rec.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-8">No recommendations available</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                          <span className="font-semibold text-yellow-900">At-Risk Leads</span>
                        </div>
                        <p className="text-3xl font-bold text-yellow-700">{bde.atRiskLeads}</p>
                        <p className="text-sm text-yellow-600 mt-1">Require immediate attention</p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-orange-600" />
                          <span className="font-semibold text-orange-900">Stale Leads</span>
                        </div>
                        <p className="text-3xl font-bold text-orange-700">{bde.staleLeads}</p>
                        <p className="text-sm text-orange-600 mt-1">No activity in 7+ days</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
