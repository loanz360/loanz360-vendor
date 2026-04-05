'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Award,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Minus,
  BarChart3,
} from 'lucide-react'

interface BankComparisonProps {
  bankIds: string[]
  dateRange?: string
  onClose: () => void
}

interface BankMetrics {
  bankId: string
  bankName: string
  bankLogo: string | null

  // Volume Metrics
  totalSubmissions: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number

  // Success Metrics
  approvalRate: number
  rejectionRate: number
  conversionRate: number

  // Time Metrics
  avgTAT: number
  minTAT: number
  maxTAT: number
  slaCompliance: number

  // Financial Metrics
  totalDisbursed: number
  formattedDisbursed: string
  avgLoanAmount: number
  formattedAvgLoan: string

  // Rankings
  approvalRank: number
  volumeRank: number
  tatRank: number
  revenueRank: number
}

interface ComparisonInsight {
  metric: string
  bestBank: string
  worstBank: string
  difference: number
  recommendation: string
}

export function BankComparisonComponent({ bankIds, dateRange = 'last_30_days', onClose }: BankComparisonProps) {
  const [selectedMetric, setSelectedMetric] = useState<'approval' | 'volume' | 'tat' | 'revenue'>('approval')

  const { data, isLoading, error } = useQuery({
    queryKey: ['bank-comparison', bankIds, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        bankIds: bankIds.join(','),
        dateRange
      })
      const res = await fetch(`/api/bdm/team-pipeline/banks/comparison?${params}`)
      if (!res.ok) throw new Error('Failed to fetch bank comparison')
      return res.json()
    },
    enabled: bankIds.length >= 2,
  })

  const banks: BankMetrics[] = data?.data?.banks || []
  const insights: ComparisonInsight[] = data?.data?.insights || []

  const getBestWorstIndicator = (value: number, best: number, worst: number, higherIsBetter: boolean = true) => {
    if (value === best) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <Award className="w-4 h-4" />
          <span className="text-xs font-semibold">BEST</span>
        </div>
      )
    }
    if (value === worst) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-semibold">WORST</span>
        </div>
      )
    }
    return null
  }

  const getComparisonIcon = (current: number, baseline: number, higherIsBetter: boolean = true) => {
    const diff = current - baseline
    const threshold = baseline * 0.05 // 5% difference threshold

    if (Math.abs(diff) < threshold) {
      return <Minus className="w-4 h-4 text-gray-400" />
    }

    if (higherIsBetter) {
      return diff > 0
        ? <TrendingUp className="w-4 h-4 text-green-600" />
        : <TrendingDown className="w-4 h-4 text-red-600" />
    } else {
      return diff < 0
        ? <TrendingUp className="w-4 h-4 text-green-600" />
        : <TrendingDown className="w-4 h-4 text-red-600" />
    }
  }

  const getMetricValue = (bank: BankMetrics, metric: string) => {
    switch (metric) {
      case 'approval': return bank.approvalRate
      case 'volume': return bank.totalSubmissions
      case 'tat': return bank.avgTAT
      case 'revenue': return bank.totalDisbursed
      default: return 0
    }
  }

  const getRadarData = () => {
    if (!banks.length) return []

    const metrics = ['Approval Rate', 'Volume', 'TAT', 'Revenue', 'SLA Compliance']
    const maxValues = {
      approvalRate: 100,
      volume: Math.max(...banks.map(b => b.totalSubmissions)),
      tat: Math.max(...banks.map(b => b.avgTAT)),
      revenue: Math.max(...banks.map(b => b.totalDisbursed)),
      sla: 100,
    }

    return banks.map(bank => ({
      bankName: bank.bankName,
      values: [
        (bank.approvalRate / maxValues.approvalRate) * 100,
        (bank.totalSubmissions / maxValues.volume) * 100,
        ((maxValues.tat - bank.avgTAT) / maxValues.tat) * 100, // Inverted: lower TAT is better
        (bank.totalDisbursed / maxValues.revenue) * 100,
        (bank.slaCompliance / maxValues.sla) * 100,
      ],
    }))
  }

  if (bankIds.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
          <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Select More Banks</h3>
          <p className="text-gray-600 text-center mb-4">
            Please select at least 2 banks to compare (up to 5 banks).
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Bank Performance Comparison</h2>
            <p className="text-purple-100 text-sm">Comparing {banks.length} banks side-by-side</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Metric Selector */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Compare by:</span>
            {[
              { id: 'approval', label: 'Approval Rate', icon: TrendingUp },
              { id: 'volume', label: 'Volume', icon: BarChart3 },
              { id: 'tat', label: 'TAT', icon: ArrowUpDown },
              { id: 'revenue', label: 'Revenue', icon: TrendingUp },
            ].map((metric) => (
              <button
                key={metric.id}
                onClick={() => setSelectedMetric(metric.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedMetric === metric.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <metric.icon className="w-4 h-4" />
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-600" />
              <p className="text-red-800">Failed to load comparison data. Please try again.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Comparison Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase sticky left-0 bg-gray-50">
                          Metric
                        </th>
                        {banks.map((bank) => (
                          <th key={bank.bankId} className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-2">
                              {bank.bankLogo ? (
                                <img src={bank.bankLogo} alt={bank.bankName} className="w-10 h-10 rounded" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                                  {bank.bankName.charAt(0)}
                                </div>
                              )}
                              <span className="text-xs font-semibold text-gray-900">{bank.bankName}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Volume Metrics */}
                      <tr className="bg-blue-50">
                        <td colSpan={banks.length + 1} className="px-4 py-2 font-semibold text-sm text-blue-900">
                          Volume Metrics
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          Total Submissions
                        </td>
                        {banks.map((bank) => {
                          const best = Math.max(...banks.map(b => b.totalSubmissions))
                          const worst = Math.min(...banks.map(b => b.totalSubmissions))
                          return (
                            <td key={bank.bankId} className="px-4 py-3 text-center">
                              <p className="text-lg font-bold text-gray-900">{bank.totalSubmissions}</p>
                              {getBestWorstIndicator(bank.totalSubmissions, best, worst, true)}
                            </td>
                          )
                        })}
                      </tr>

                      {/* Success Metrics */}
                      <tr className="bg-green-50">
                        <td colSpan={banks.length + 1} className="px-4 py-2 font-semibold text-sm text-green-900">
                          Success Metrics
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          Approval Rate
                        </td>
                        {banks.map((bank) => {
                          const best = Math.max(...banks.map(b => b.approvalRate))
                          const worst = Math.min(...banks.map(b => b.approvalRate))
                          return (
                            <td key={bank.bankId} className="px-4 py-3 text-center">
                              <p className="text-lg font-bold text-green-600">{bank.approvalRate.toFixed(1)}%</p>
                              {getBestWorstIndicator(bank.approvalRate, best, worst, true)}
                            </td>
                          )
                        })}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          SLA Compliance
                        </td>
                        {banks.map((bank) => {
                          const best = Math.max(...banks.map(b => b.slaCompliance))
                          const worst = Math.min(...banks.map(b => b.slaCompliance))
                          return (
                            <td key={bank.bankId} className="px-4 py-3 text-center">
                              <p className="text-lg font-bold text-gray-900">{bank.slaCompliance.toFixed(1)}%</p>
                              {getBestWorstIndicator(bank.slaCompliance, best, worst, true)}
                            </td>
                          )
                        })}
                      </tr>

                      {/* Time Metrics */}
                      <tr className="bg-orange-50">
                        <td colSpan={banks.length + 1} className="px-4 py-2 font-semibold text-sm text-orange-900">
                          Time Metrics
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          Average TAT
                        </td>
                        {banks.map((bank) => {
                          const best = Math.min(...banks.map(b => b.avgTAT)) // Lower is better
                          const worst = Math.max(...banks.map(b => b.avgTAT))
                          return (
                            <td key={bank.bankId} className="px-4 py-3 text-center">
                              <p className="text-lg font-bold text-orange-600">{bank.avgTAT.toFixed(1)} days</p>
                              {getBestWorstIndicator(bank.avgTAT, best, worst, false)}
                            </td>
                          )
                        })}
                      </tr>

                      {/* Financial Metrics */}
                      <tr className="bg-purple-50">
                        <td colSpan={banks.length + 1} className="px-4 py-2 font-semibold text-sm text-purple-900">
                          Financial Metrics
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          Total Disbursed
                        </td>
                        {banks.map((bank) => {
                          const best = Math.max(...banks.map(b => b.totalDisbursed))
                          const worst = Math.min(...banks.map(b => b.totalDisbursed))
                          return (
                            <td key={bank.bankId} className="px-4 py-3 text-center">
                              <p className="text-lg font-bold text-purple-600">{bank.formattedDisbursed}</p>
                              {getBestWorstIndicator(bank.totalDisbursed, best, worst, true)}
                            </td>
                          )
                        })}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          Avg Loan Amount
                        </td>
                        {banks.map((bank) => {
                          const best = Math.max(...banks.map(b => b.avgLoanAmount))
                          const worst = Math.min(...banks.map(b => b.avgLoanAmount))
                          return (
                            <td key={bank.bankId} className="px-4 py-3 text-center">
                              <p className="text-sm font-medium text-gray-900">{bank.formattedAvgLoan}</p>
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Insights & Recommendations */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Key Insights & Recommendations
                </h3>
                <div className="space-y-3">
                  {insights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <CheckCircle className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{insight.metric}</h4>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium text-green-600">{insight.bestBank}</span> outperforms{' '}
                          <span className="font-medium text-red-600">{insight.worstBank}</span> by{' '}
                          <span className="font-bold">{insight.difference.toFixed(1)}%</span>
                        </p>
                        <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                          💡 {insight.recommendation}
                        </p>
                      </div>
                    </div>
                  ))}
                  {insights.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No insights available</p>
                  )}
                </div>
              </div>

              {/* Rankings Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-900 mb-3">Best Approval Rate</h4>
                  {banks.find(b => b.approvalRank === 1) && (
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-yellow-600" />
                      <span className="font-bold text-yellow-900">
                        {banks.find(b => b.approvalRank === 1)?.bankName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-3">Highest Volume</h4>
                  {banks.find(b => b.volumeRank === 1) && (
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-blue-900">
                        {banks.find(b => b.volumeRank === 1)?.bankName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-900 mb-3">Fastest TAT</h4>
                  {banks.find(b => b.tatRank === 1) && (
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-900">
                        {banks.find(b => b.tatRank === 1)?.bankName}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-purple-900 mb-3">Top Revenue</h4>
                  {banks.find(b => b.revenueRank === 1) && (
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-purple-600" />
                      <span className="font-bold text-purple-900">
                        {banks.find(b => b.revenueRank === 1)?.bankName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Comparison based on {dateRange.replace(/_/g, ' ')} data
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
