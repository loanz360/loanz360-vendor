'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  ArrowUpDown,
} from 'lucide-react'

interface BankPerformance {
  bankId: string
  bankName: string
  bankLogo: string | null
  totalSubmissions: number
  approvedApplications: number
  rejectedApplications: number
  pendingApplications: number
  approvalRate: number
  rejectionRate: number
  avgTAT: number
  minTAT: number
  maxTAT: number
  slaCompliance: number
  totalDisbursed: number
  formattedDisbursed: string
  avgLoanAmount: number
  formattedAvgLoan: string
  approvalRateTrend: 'up' | 'down' | 'neutral'
  approvalRateChange: number
  volumeTrend: 'up' | 'down' | 'neutral'
  volumeChange: number
  approvalRank: number
  volumeRank: number
  tatRank: number
}

interface BankPerformanceDashboardProps {
  dateRange?: string
  onBankClick?: (bankId: string) => void
}

export function BankPerformanceDashboard({ dateRange = 'last_30_days', onBankClick }: BankPerformanceDashboardProps) {
  const [sortBy, setSortBy] = useState('approvalRate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, error } = useQuery({
    queryKey: ['bank-performance', dateRange, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({ dateRange, sortBy, sortOrder })
      const res = await fetch(`/api/bdm/team-pipeline/banks/performance?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bank performance')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const banks: BankPerformance[] = data?.data?.banks || []
  const teamMetrics = data?.data?.teamMetrics || {}

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 text-gray-500" />
    return sortOrder === 'asc'
      ? <TrendingUp className="w-3 h-3 text-orange-400" />
      : <TrendingDown className="w-3 h-3 text-orange-400" />
  }

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') {
      return (
        <div className="flex items-center gap-1 text-green-400">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs">+{change.toFixed(1)}%</span>
        </div>
      )
    }
    if (trend === 'down') {
      return (
        <div className="flex items-center gap-1 text-red-400">
          <TrendingDown className="w-3 h-3" />
          <span className="text-xs">{change.toFixed(1)}%</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Minus className="w-3 h-3" />
        <span className="text-xs">0%</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Failed to load bank performance data. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-gray-400">Total Submissions</span>
          </div>
          <p className="text-3xl font-bold text-white">{teamMetrics.totalSubmissions || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-sm font-medium text-gray-400">Avg Approval Rate</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {teamMetrics.avgApprovalRate?.toFixed(1) || 0}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-sm font-medium text-gray-400">Avg TAT</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {teamMetrics.avgTAT?.toFixed(1) || 0}d
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm font-medium text-gray-400">Total Disbursed</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {teamMetrics.formattedTotalDisbursed || '₹0'}
          </p>
        </div>
      </div>

      {/* Banks Table */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Bank Performance Overview</h3>
          <p className="text-sm text-gray-400">{banks.length} banks tracked</p>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : banks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>No bank performance data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                    Bank
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('totalSubmissions')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Submissions
                      {getSortIcon('totalSubmissions')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('approvalRate')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Approval Rate
                      {getSortIcon('approvalRate')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('avgTAT')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Avg TAT
                      {getSortIcon('avgTAT')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('slaCompliance')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      SLA Compliance
                      {getSortIcon('slaCompliance')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('totalDisbursed')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Disbursed
                      {getSortIcon('totalDisbursed')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {banks.map((bank, index) => (
                  <tr
                    key={bank.bankId}
                    onClick={() => onBankClick?.(bank.bankId)}
                    className="hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      {bank.approvalRank <= 3 ? (
                        <div className="flex items-center gap-1">
                          <Award className={`w-4 h-4 ${
                            bank.approvalRank === 1 ? 'text-yellow-400' :
                            bank.approvalRank === 2 ? 'text-gray-400' :
                            'text-orange-400'
                          }`} />
                          <span className="font-bold text-white">#{bank.approvalRank}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">#{bank.approvalRank}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {bank.bankLogo ? (
                          <img src={bank.bankLogo} alt={bank.bankName} className="w-8 h-8 rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-400 text-xs font-bold">
                            {bank.bankName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-white">{bank.bankName}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{bank.totalSubmissions}</p>
                        {getTrendIcon(bank.volumeTrend, bank.volumeChange)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                bank.approvalRate >= 70 ? 'bg-green-500' :
                                bank.approvalRate >= 50 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${bank.approvalRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-white w-12 text-right">
                            {bank.approvalRate.toFixed(1)}%
                          </span>
                        </div>
                        {getTrendIcon(bank.approvalRateTrend, bank.approvalRateChange)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className={`text-sm font-medium ${
                        bank.avgTAT <= 15 ? 'text-green-400' :
                        bank.avgTAT <= 30 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {bank.avgTAT.toFixed(1)} days
                      </p>
                      <p className="text-xs text-gray-500">
                        {bank.minTAT}-{bank.maxTAT} days
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {bank.slaCompliance >= 80 ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : bank.slaCompliance >= 50 ? (
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-sm font-medium ${
                          bank.slaCompliance >= 80 ? 'text-green-400' :
                          bank.slaCompliance >= 50 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {bank.slaCompliance.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-white">
                        {bank.formattedDisbursed}
                      </p>
                      <p className="text-xs text-gray-500">
                        Avg: {bank.formattedAvgLoan}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
