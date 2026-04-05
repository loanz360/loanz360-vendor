'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Calendar,
  Building2,
  FileText,
  IndianRupee,
  Target,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/cn'

interface ForecastResult {
  lead_id: string
  bank_name: string
  location: string
  loan_type: string
  loan_amount: number
  expected_disbursement_date: string
  probability: number
  commission_rate: number
  expected_commission: number
  weighted_commission: number
}

interface ForecastSummary {
  total_pipeline_value: number
  total_expected_commission: number
  total_weighted_commission: number
  by_month: {
    month: string
    pipeline_value: number
    expected_commission: number
    weighted_commission: number
    lead_count: number
  }[]
  by_bank: {
    bank_name: string
    pipeline_value: number
    expected_commission: number
    lead_count: number
  }[]
  by_loan_type: {
    loan_type: string
    pipeline_value: number
    expected_commission: number
    lead_count: number
  }[]
}

interface PayoutForecastProps {
  partnerType: 'BA' | 'BP' | 'CP'
}

export default function PayoutForecast({ partnerType }: PayoutForecastProps) {
  const [forecasts, setForecasts] = useState<ForecastResult[]>([])
  const [summary, setSummary] = useState<ForecastSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [months, setMonths] = useState(6)
  const [showDetails, setShowDetails] = useState(false)
  const [activeView, setActiveView] = useState<'month' | 'bank' | 'loanType'>('month')

  // Fetch forecast data
  const fetchForecast = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/commissions/forecast?months=${months}&partnerType=${partnerType}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch forecast')
      }

      setForecasts(data.forecasts || [])
      setSummary(data.summary || null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [months, partnerType])

  useEffect(() => {
    fetchForecast()
  }, [fetchForecast])

  // Format month label
  const formatMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }

  // Get max value for chart scaling
  const getMaxValue = (data: Record<string, number>[], key: string): number => {
    return Math.max(...data.map(d => d[key]), 1)
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <span className="ml-3 text-gray-400">Loading forecast data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-red-300 text-center mb-4">{error}</p>
          <Button onClick={fetchForecast} variant="outline" className="border-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Pipeline Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-xl border border-blue-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">Pipeline</span>
          </div>
          <p className="text-gray-400 text-sm mb-1">Total Pipeline Value</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(summary?.total_pipeline_value || 0)}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {forecasts.length} active leads
          </p>
        </motion.div>

        {/* Expected Commission */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-900/30 to-green-900/10 rounded-xl border border-green-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <IndianRupee className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">Expected</span>
          </div>
          <p className="text-gray-400 text-sm mb-1">Expected Commission</p>
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(summary?.total_expected_commission || 0)}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            If all leads convert
          </p>
        </motion.div>

        {/* Weighted Commission */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 rounded-xl border border-orange-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-500/20 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-xs text-orange-400 bg-orange-500/20 px-2 py-1 rounded">Weighted</span>
          </div>
          <p className="text-gray-400 text-sm mb-1">Weighted Forecast</p>
          <p className="text-2xl font-bold text-orange-400">
            {formatCurrency(summary?.total_weighted_commission || 0)}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Based on probability
          </p>
        </motion.div>
      </div>

      {/* Forecast Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400 text-sm">Forecast Period:</span>
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="bg-white/5 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10
                       focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value={3}>Next 3 months</option>
            <option value={6}>Next 6 months</option>
            <option value={12}>Next 12 months</option>
          </select>
        </div>

        <Button
          onClick={fetchForecast}
          variant="outline"
          size="sm"
          className="border-white/10 text-gray-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Charts Section */}
      {summary && (summary.by_month.length > 0 || summary.by_bank.length > 0) && (
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 overflow-hidden">
          {/* Chart Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveView('month')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'month'
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              By Month
            </button>
            <button
              onClick={() => setActiveView('bank')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'bank'
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" />
              By Bank
            </button>
            <button
              onClick={() => setActiveView('loanType')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'loanType'
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              By Loan Type
            </button>
          </div>

          {/* Chart Content */}
          <div className="p-6">
            {activeView === 'month' && summary.by_month.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Monthly Commission Forecast</h4>
                {summary.by_month.map((item, index) => {
                  const maxCommission = getMaxValue(summary.by_month, 'expected_commission')
                  const barWidth = (item.expected_commission / maxCommission) * 100

                  return (
                    <div key={item.month} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{formatMonth(item.month)}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 text-xs">{item.lead_count} leads</span>
                          <span className="text-white font-medium">{formatCurrency(item.expected_commission)}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Pipeline: {formatCurrency(item.pipeline_value)}</span>
                        <span className="text-orange-400">Weighted: {formatCurrency(item.weighted_commission)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeView === 'bank' && summary.by_bank.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Commission by Bank</h4>
                {summary.by_bank.slice(0, 8).map((item, index) => {
                  const maxCommission = getMaxValue(summary.by_bank, 'expected_commission')
                  const barWidth = (item.expected_commission / maxCommission) * 100

                  return (
                    <div key={item.bank_name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 truncate max-w-[200px]">{item.bank_name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 text-xs">{item.lead_count} leads</span>
                          <span className="text-white font-medium">{formatCurrency(item.expected_commission)}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeView === 'loanType' && summary.by_loan_type.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Commission by Loan Type</h4>
                {summary.by_loan_type.slice(0, 8).map((item, index) => {
                  const maxCommission = getMaxValue(summary.by_loan_type, 'expected_commission')
                  const barWidth = (item.expected_commission / maxCommission) * 100

                  return (
                    <div key={item.loan_type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 truncate max-w-[200px]">{item.loan_type}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 text-xs">{item.lead_count} leads</span>
                          <span className="text-white font-medium">{formatCurrency(item.expected_commission)}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Empty State */}
            {((activeView === 'month' && summary.by_month.length === 0) ||
              (activeView === 'bank' && summary.by_bank.length === 0) ||
              (activeView === 'loanType' && summary.by_loan_type.length === 0)) && (
              <div className="text-center py-8">
                <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No data available for this view</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Forecast Table */}
      {forecasts.length > 0 && (
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <h4 className="text-sm font-medium text-gray-300">Lead-wise Forecast Details</h4>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-xs">{forecasts.length} leads</span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showDetails && (
            <div className="border-t border-white/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">Bank</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Loan Type</th>
                    <th className="px-4 py-3 font-medium text-right">Loan Amount</th>
                    <th className="px-4 py-3 font-medium text-center">Rate</th>
                    <th className="px-4 py-3 font-medium text-center">Probability</th>
                    <th className="px-4 py-3 font-medium text-right">Expected</th>
                    <th className="px-4 py-3 font-medium text-right">Weighted</th>
                    <th className="px-4 py-3 font-medium">Expected Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {forecasts.map((forecast) => (
                    <tr key={forecast.lead_id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-white">{forecast.bank_name}</td>
                      <td className="px-4 py-3 text-gray-400">{forecast.location}</td>
                      <td className="px-4 py-3 text-gray-400">{forecast.loan_type}</td>
                      <td className="px-4 py-3 text-white text-right">{formatCurrency(forecast.loan_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-400">{forecast.commission_rate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          forecast.probability >= 75 ? 'bg-green-900/50 text-green-400' :
                          forecast.probability >= 50 ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-red-900/50 text-red-400'
                        }`}>
                          {forecast.probability}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-400 text-right">{formatCurrency(forecast.expected_commission)}</td>
                      <td className="px-4 py-3 text-orange-400 text-right">{formatCurrency(forecast.weighted_commission)}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(forecast.expected_disbursement_date).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {forecasts.length === 0 && (
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 p-12">
          <div className="text-center">
            <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Pipeline Data</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Your commission forecast will appear here once you have active leads in your pipeline.
              Add leads with expected disbursement dates to see your projected earnings.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
