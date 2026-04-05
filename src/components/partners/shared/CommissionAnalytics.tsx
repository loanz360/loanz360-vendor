'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  IndianRupee,
  Target,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  Calendar,
  Building2,
  FileText,
  MapPin,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/cn'

interface AnalyticsSummary {
  total_disbursements: number
  total_commission_earned: number
  avg_commission_rate: number
  total_leads: number
  conversion_rate: number
  period_comparison: {
    current: {
      disbursements: number
      commission: number
      leads: number
    }
    previous: {
      disbursements: number
      commission: number
      leads: number
    }
    growth: {
      disbursements: number
      commission: number
      leads: number
    }
  }
}

interface DimensionItem {
  name: string
  disbursements: number
  commission: number
  lead_count: number
  avg_rate?: number
}

interface MonthItem {
  month: string
  disbursements: number
  commission: number
  lead_count: number
}

interface AnalyticsByDimension {
  by_bank: DimensionItem[]
  by_loan_type: DimensionItem[]
  by_location: DimensionItem[]
  by_month: MonthItem[]
}

interface CommissionAnalyticsProps {
  partnerType: 'BA' | 'BP' | 'CP'
}

export default function CommissionAnalytics({ partnerType }: CommissionAnalyticsProps) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [dimensions, setDimensions] = useState<AnalyticsByDimension | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('12months')
  const [activeTab, setActiveTab] = useState<'bank' | 'loanType' | 'location'>('bank')

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/commissions/analytics?period=${period}&partnerType=${partnerType}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analytics')
      }

      setSummary(data.summary)
      setDimensions(data.dimensions)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [period, partnerType])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Format percentage with trend
  const formatGrowth = (value: number) => {
    const isPositive = value >= 0
    return (
      <span className={`flex items-center text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    )
  }

  // Format month label
  const formatMonth = (monthStr: string): string => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-900/50 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-24 mb-4" />
              <div className="h-8 bg-gray-700 rounded w-32 mb-2" />
              <div className="h-4 bg-gray-700 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900/50 rounded-xl p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-300 mb-4">{error}</p>
        <Button onClick={fetchAnalytics} variant="outline" className="border-white/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white font-poppins">Commission Analytics</h2>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white/5 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10
                       focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="6months">Last 6 Months</option>
            <option value="12months">Last 12 Months</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Disbursements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-xl border border-blue-500/30 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Target className="w-5 h-5 text-blue-400" />
            </div>
            {summary && formatGrowth(summary.period_comparison.growth.disbursements)}
          </div>
          <p className="text-gray-400 text-sm mb-1">Total Disbursements</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(summary?.total_disbursements || 0)}
          </p>
        </motion.div>

        {/* Total Commission */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-900/30 to-green-900/10 rounded-xl border border-green-500/30 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <IndianRupee className="w-5 h-5 text-green-400" />
            </div>
            {summary && formatGrowth(summary.period_comparison.growth.commission)}
          </div>
          <p className="text-gray-400 text-sm mb-1">Commission Earned</p>
          <p className="text-2xl font-bold text-green-400">
            {formatCurrency(summary?.total_commission_earned || 0)}
          </p>
        </motion.div>

        {/* Avg Commission Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 rounded-xl border border-orange-500/30 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-orange-500/20 p-2 rounded-lg">
              <Percent className="w-5 h-5 text-orange-400" />
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Avg Commission Rate</p>
          <p className="text-2xl font-bold text-orange-400">
            {(summary?.avg_commission_rate || 0).toFixed(2)}%
          </p>
        </motion.div>

        {/* Conversion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 rounded-xl border border-purple-500/30 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            {summary && formatGrowth(summary.period_comparison.growth.leads)}
          </div>
          <p className="text-gray-400 text-sm mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-purple-400">
            {(summary?.conversion_rate || 0).toFixed(1)}%
          </p>
          <p className="text-gray-500 text-xs mt-1">{summary?.total_leads || 0} total leads</p>
        </motion.div>
      </div>

      {/* Monthly Trend Chart */}
      {dimensions && dimensions.by_month.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            Monthly Commission Trend
          </h3>

          <div className="space-y-4">
            {dimensions.by_month.map((item, index) => {
              const maxCommission = Math.max(...dimensions.by_month.map(m => m.commission), 1)
              const barWidth = (item.commission / maxCommission) * 100

              return (
                <div key={item.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 w-20">{formatMonth(item.month)}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 text-xs">{item.lead_count} deals</span>
                      <span className="text-white font-medium w-24 text-right">{formatCurrency(item.commission)}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Dimension Analysis */}
      {dimensions && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 overflow-hidden"
        >
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'bank'
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" />
              By Bank
            </button>
            <button
              onClick={() => setActiveTab('loanType')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'loanType'
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              By Loan Type
            </button>
            <button
              onClick={() => setActiveTab('location')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'location'
                  ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MapPin className="w-4 h-4" />
              By Location
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'bank' && dimensions.by_bank.length > 0 && (
              <div className="space-y-4">
                {dimensions.by_bank.slice(0, 8).map((item, index) => {
                  const maxCommission = Math.max(...dimensions.by_bank.map(b => b.commission), 1)
                  const barWidth = (item.commission / maxCommission) * 100

                  return (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium truncate max-w-[200px]">{item.name}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">{item.lead_count} deals</span>
                          {item.avg_rate !== undefined && (
                            <span className="text-orange-400">{item.avg_rate.toFixed(2)}%</span>
                          )}
                          <span className="text-green-400 font-medium">{formatCurrency(item.commission)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'loanType' && dimensions.by_loan_type.length > 0 && (
              <div className="space-y-4">
                {dimensions.by_loan_type.slice(0, 8).map((item, index) => {
                  const maxCommission = Math.max(...dimensions.by_loan_type.map(l => l.commission), 1)
                  const barWidth = (item.commission / maxCommission) * 100

                  return (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium truncate max-w-[200px]">{item.name}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">{item.lead_count} deals</span>
                          {item.avg_rate !== undefined && (
                            <span className="text-orange-400">{item.avg_rate.toFixed(2)}%</span>
                          )}
                          <span className="text-green-400 font-medium">{formatCurrency(item.commission)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'location' && dimensions.by_location.length > 0 && (
              <div className="space-y-4">
                {dimensions.by_location.slice(0, 8).map((item, index) => {
                  const maxCommission = Math.max(...dimensions.by_location.map(l => l.commission), 1)
                  const barWidth = (item.commission / maxCommission) * 100

                  return (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium truncate max-w-[200px]">{item.name}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500">{item.lead_count} deals</span>
                          <span className="text-green-400 font-medium">{formatCurrency(item.commission)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Empty State */}
            {((activeTab === 'bank' && dimensions.by_bank.length === 0) ||
              (activeTab === 'loanType' && dimensions.by_loan_type.length === 0) ||
              (activeTab === 'location' && dimensions.by_location.length === 0)) && (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No data available for this dimension</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
