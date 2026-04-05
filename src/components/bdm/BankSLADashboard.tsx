'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  BarChart3,
  Activity,
} from 'lucide-react'

interface BankSLADashboardProps {
  dateRange?: string
}

interface SLAMetrics {
  bankId: string
  bankName: string
  bankLogo: string | null

  // SLA Compliance
  slaTarget: number // Days
  slaCompliance: number // Percentage
  onTimeCount: number
  lateCount: number
  criticalCount: number // Very late

  // TAT Distribution
  avgTAT: number
  minTAT: number
  maxTAT: number
  medianTAT: number

  // TAT Buckets
  within15Days: number
  days16to30: number
  days31to45: number
  days46to60: number
  over60Days: number

  // Trends
  complianceTrend: 'up' | 'down' | 'neutral'
  complianceChange: number
  tatTrend: 'up' | 'down' | 'neutral'
  tatChange: number

  // At Risk
  atRiskCount: number
  escalatedCount: number
}

interface AtRiskApplication {
  id: string
  customerName: string
  loanType: string
  amount: number
  formattedAmount: string
  bankName: string
  submittedDate: string
  daysElapsed: number
  daysRemaining: number
  riskLevel: 'medium' | 'high' | 'critical'
  bdeName: string
}

interface MonthlyTrend {
  month: string
  slaCompliance: number
  avgTAT: number
  totalApplications: number
}

export function BankSLADashboard({ dateRange = 'last_30_days' }: BankSLADashboardProps) {
  const [sortBy, setSortBy] = useState('slaCompliance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedBank, setSelectedBank] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['bank-sla', dateRange, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({ dateRange, sortBy, sortOrder })
      const res = await fetch(`/api/bdm/team-pipeline/banks/sla?${params}`)
      if (!res.ok) throw new Error('Failed to fetch SLA data')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const banks: SLAMetrics[] = data?.data?.banks || []
  const atRiskApplications: AtRiskApplication[] = data?.data?.atRiskApplications || []
  const monthlyTrends: MonthlyTrend[] = data?.data?.monthlyTrends || []
  const teamMetrics = data?.data?.teamMetrics || {}

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-600" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      default:
        return <CheckCircle className="w-4 h-4 text-green-600" />
    }
  }

  const getComplianceColor = (compliance: number) => {
    if (compliance >= 80) return 'text-green-600'
    if (compliance >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs">+{change.toFixed(1)}%</span>
        </div>
      )
    }
    if (trend === 'down') {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown className="w-3 h-3" />
          <span className="text-xs">{change.toFixed(1)}%</span>
        </div>
      )
    }
    return <span className="text-xs text-gray-600">No change</span>
  }

  return (
    <div className="space-y-6">
      {/* Team Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">Team SLA Compliance</span>
          </div>
          <p className="text-3xl font-bold text-green-900">
            {teamMetrics.avgSLACompliance?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-green-700 mt-1">
            {teamMetrics.onTimeCount || 0} on time, {teamMetrics.lateCount || 0} late
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Team Avg TAT</span>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {teamMetrics.avgTAT?.toFixed(1) || 0}d
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Target: {teamMetrics.slaTarget || 30} days
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">At Risk</span>
          </div>
          <p className="text-3xl font-bold text-orange-900">
            {teamMetrics.atRiskCount || 0}
          </p>
          <p className="text-xs text-orange-700 mt-1">
            Applications nearing SLA breach
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-900">Escalated</span>
          </div>
          <p className="text-3xl font-bold text-red-900">
            {teamMetrics.escalatedCount || 0}
          </p>
          <p className="text-xs text-red-700 mt-1">
            Critical SLA breaches
          </p>
        </div>
      </div>

      {/* Bank-wise SLA Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Bank-wise SLA Performance</h3>
          <p className="text-sm text-gray-600">{banks.length} banks monitored</p>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : banks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No SLA data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Bank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    SLA Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Compliance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Avg TAT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    TAT Distribution
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    At Risk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {banks.map((bank) => (
                  <tr
                    key={bank.bankId}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedBank(bank.bankId)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {bank.bankLogo ? (
                          <img src={bank.bankLogo} alt={bank.bankName} className="w-8 h-8 rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                            {bank.bankName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{bank.bankName}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{bank.slaTarget} days</span>
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-lg font-bold ${getComplianceColor(bank.slaCompliance)}`}>
                            {bank.slaCompliance.toFixed(1)}%
                          </span>
                          {bank.slaCompliance >= 80 ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        {getTrendIcon(bank.complianceTrend, bank.complianceChange)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <p className={`text-sm font-semibold ${
                          bank.avgTAT <= bank.slaTarget ? 'text-green-600' :
                          bank.avgTAT <= bank.slaTarget * 1.5 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {bank.avgTAT.toFixed(1)} days
                        </p>
                        <p className="text-xs text-gray-500">
                          Range: {bank.minTAT}-{bank.maxTAT}d
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${bank.within15Days}%` }}
                            />
                          </div>
                          <span className="text-gray-600">≤15d: {bank.within15Days}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500"
                              style={{ width: `${bank.days16to30}%` }}
                            />
                          </div>
                          <span className="text-gray-600">16-30d: {bank.days16to30}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500"
                              style={{ width: `${bank.over60Days}%` }}
                            />
                          </div>
                          <span className="text-gray-600">&gt;60d: {bank.over60Days}%</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-orange-600">{bank.atRiskCount}</p>
                          <p className="text-xs text-gray-600">At risk</p>
                        </div>
                        {bank.escalatedCount > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-red-600">{bank.escalatedCount}</p>
                            <p className="text-xs text-gray-600">Escalated</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* At-Risk Applications */}
      {atRiskApplications.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">At-Risk Applications</h3>
            <p className="text-sm text-gray-600">
              {atRiskApplications.length} applications nearing or breaching SLA
            </p>
          </div>

          <div className="p-4 space-y-3">
            {atRiskApplications.slice(0, 10).map((app) => (
              <div
                key={app.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${getRiskColor(app.riskLevel)}`}
              >
                <div className="flex items-center gap-3">
                  {getRiskIcon(app.riskLevel)}
                  <div>
                    <h4 className="font-semibold text-gray-900">{app.customerName}</h4>
                    <p className="text-sm text-gray-600">
                      {app.loanType} • {app.formattedAmount} • {app.bankName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {app.daysElapsed} days elapsed
                    </p>
                    <p className="text-xs text-gray-600">
                      {app.daysRemaining > 0
                        ? `${app.daysRemaining} days remaining`
                        : `${Math.abs(app.daysRemaining)} days overdue`
                      }
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-600">BDE</p>
                    <p className="text-sm font-medium text-gray-900">{app.bdeName}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Trends */}
      {monthlyTrends.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">SLA Compliance Trends</h3>
            <p className="text-sm text-gray-600">Last 6 months performance</p>
          </div>

          <div className="p-6">
            <div className="flex items-end justify-between gap-2 h-64">
              {monthlyTrends.map((trend, index) => {
                const maxCompliance = Math.max(...monthlyTrends.map(t => t.slaCompliance))
                const heightPercentage = (trend.slaCompliance / maxCompliance) * 100

                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center gap-1">
                      <span className={`text-xs font-semibold ${getComplianceColor(trend.slaCompliance)}`}>
                        {trend.slaCompliance.toFixed(0)}%
                      </span>
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          trend.slaCompliance >= 80 ? 'bg-green-500' :
                          trend.slaCompliance >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ height: `${heightPercentage}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-900">{trend.month}</p>
                      <p className="text-xs text-gray-500">{trend.totalApplications} apps</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
