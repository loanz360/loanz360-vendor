'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  DollarSign,
  Clock,
  FileText,
  Users,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  XCircle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react'

interface BankInsightsModalProps {
  bankId: string
  bankName: string
  dateRange?: string
  onClose: () => void
}

interface LoanTypeBreakdown {
  loanType: string
  count: number
  percentage: number
  avgAmount: number
  formattedAvgAmount: string
  approvalRate: number
}

interface BDEPerformance {
  bdeUserId: string
  bdeName: string
  totalSubmissions: number
  approvedCount: number
  approvalRate: number
  avgTAT: number
  totalDisbursed: number
  formattedDisbursed: string
}

interface RecentApplication {
  id: string
  customerName: string
  loanType: string
  amount: number
  formattedAmount: string
  status: string
  submittedAt: string
  daysInProgress: number
  bdeName: string
}

interface AIInsight {
  type: 'positive' | 'negative' | 'neutral' | 'recommendation'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

interface BankInsightsData {
  bankName: string
  bankLogo: string | null
  totalSubmissions: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  approvalRate: number
  rejectionRate: number
  avgTAT: number
  minTAT: number
  maxTAT: number
  slaCompliance: number
  totalDisbursed: number
  formattedDisbursed: string
  loanTypeBreakdown: LoanTypeBreakdown[]
  bdePerformance: BDEPerformance[]
  recentApplications: RecentApplication[]
  aiInsights: AIInsight[]
}

export function BankInsightsModal({ bankId, bankName, dateRange = 'last_30_days', onClose }: BankInsightsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'loan-types' | 'bde-performance' | 'recent'>('overview')

  const { data, isLoading, error } = useQuery({
    queryKey: ['bank-insights', bankId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ bankId, dateRange })
      const res = await fetch(`/api/bdm/team-pipeline/banks/insights?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bank insights')
      return res.json()
    },
  })

  const insights: BankInsightsData = data?.data || {}

  const getTrendColor = (rate: number, threshold: number) => {
    if (rate >= threshold) return 'text-green-600'
    if (rate >= threshold * 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'disbursed':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending':
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'negative':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'recommendation':
        return <Lightbulb className="w-5 h-5 text-yellow-600" />
      default:
        return <Activity className="w-5 h-5 text-blue-600" />
    }
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    }
    return colors[priority as keyof typeof colors] || colors.low
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {insights.bankLogo ? (
              <img src={insights.bankLogo} alt={bankName} className="w-12 h-12 rounded bg-white p-1" />
            ) : (
              <div className="w-12 h-12 rounded bg-white flex items-center justify-center text-blue-600 font-bold text-lg">
                {bankName.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{bankName} - Detailed Insights</h2>
              <p className="text-blue-100 text-sm">Performance analysis and recommendations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 px-6">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'loan-types', label: 'Loan Types', icon: PieChart },
              { id: 'bde-performance', label: 'BDE Performance', icon: Users },
              { id: 'recent', label: 'Recent Applications', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
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
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-600" />
              <p className="text-red-800">Failed to load bank insights. Please try again.</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Total Submissions</span>
                      </div>
                      <p className="text-3xl font-bold text-blue-900">{insights.totalSubmissions || 0}</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-green-900">Approval Rate</span>
                      </div>
                      <p className="text-3xl font-bold text-green-900">
                        {insights.approvalRate?.toFixed(1) || 0}%
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-orange-600" />
                        <span className="text-sm font-medium text-orange-900">Avg TAT</span>
                      </div>
                      <p className="text-3xl font-bold text-orange-900">
                        {insights.avgTAT?.toFixed(1) || 0}d
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900">Total Disbursed</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-900">
                        {insights.formattedDisbursed || '₹0'}
                      </p>
                    </div>
                  </div>

                  {/* AI Insights */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-600" />
                      AI-Powered Insights & Recommendations
                    </h3>
                    <div className="space-y-3">
                      {(insights.aiInsights || []).map((insight, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(insight.priority)}`}>
                                {insight.priority}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{insight.description}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400 mt-1" />
                        </div>
                      ))}
                      {(!insights.aiInsights || insights.aiInsights.length === 0) && (
                        <p className="text-center text-gray-500 py-4">No insights available yet</p>
                      )}
                    </div>
                  </div>

                  {/* Performance Distribution */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{insights.approvedCount || 0}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">{insights.pendingCount || 0}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Rejected</p>
                      <p className="text-2xl font-bold text-red-600">{insights.rejectedCount || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Loan Types Tab */}
              {activeTab === 'loan-types' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Loan Type Breakdown</h3>
                  {(insights.loanTypeBreakdown || []).map((loanType, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{loanType.loanType}</h4>
                          <p className="text-sm text-gray-600">{loanType.count} applications</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{loanType.percentage.toFixed(1)}%</p>
                          <p className="text-sm text-gray-600">of total</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${loanType.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Avg Amount: <span className="font-semibold text-gray-900">{loanType.formattedAvgAmount}</span>
                        </span>
                        <span className={`font-semibold ${getTrendColor(loanType.approvalRate, 70)}`}>
                          {loanType.approvalRate.toFixed(1)}% approval
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!insights.loanTypeBreakdown || insights.loanTypeBreakdown.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No loan type data available</p>
                  )}
                </div>
              )}

              {/* BDE Performance Tab */}
              {activeTab === 'bde-performance' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">BDE Performance by This Bank</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">BDE Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Submissions</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Approved</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Approval Rate</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Avg TAT</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Disbursed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(insights.bdePerformance || []).map((bde, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-900">{bde.bdeName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-900">{bde.totalSubmissions}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-green-600 font-medium">{bde.approvedCount}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${getTrendColor(bde.approvalRate, 70)}`}>
                                {bde.approvalRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-900">{bde.avgTAT.toFixed(1)} days</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-900">{bde.formattedDisbursed}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!insights.bdePerformance || insights.bdePerformance.length === 0) && (
                      <p className="text-center text-gray-500 py-8">No BDE performance data available</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Applications Tab */}
              {activeTab === 'recent' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Recent Applications to This Bank</h3>
                  {(insights.recentApplications || []).map((app, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{app.customerName}</h4>
                          <p className="text-sm text-gray-600">{app.loanType}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="text-gray-600">
                            Amount: <span className="font-semibold text-gray-900">{app.formattedAmount}</span>
                          </span>
                          <span className="text-gray-600">
                            BDE: <span className="font-semibold text-gray-900">{app.bdeName}</span>
                          </span>
                        </div>
                        <span className="text-gray-500">
                          {app.daysInProgress} days in progress
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!insights.recentApplications || insights.recentApplications.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No recent applications</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Data updated in real-time • SLA Target: 30 days
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
