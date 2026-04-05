'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, DashboardCard } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, TrendingUp, FileText, Download, Calendar, AlertCircle, RefreshCw } from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/cn'

interface AnalyticsSummary {
  month: string
  summary: {
    totalPartners: {
      count: number
      growth: { percentage: number; direction: string }
    }
    businessAssociates: {
      count: number
      growth: { percentage: number; direction: string }
    }
    businessPartners: {
      count: number
      growth: { percentage: number; direction: string }
    }
    channelPartners: {
      count: number
      growth: { percentage: number; direction: string }
    }
  }
}

interface GrowthData {
  labels: string[]
  datasets: {
    businessAssociates: number[]
    businessPartners: number[]
    channelPartners: number[]
    total: number[]
  }
}

interface BusinessData {
  labels: string[]
  datasets: {
    totalLoanAmount: number[]
    sanctionedAmount: number[]
    disbursedAmount: number[]
  }
}

interface ErrorState {
  summary: string | null
  growth: string | null
  business: string | null
}

export default function AnalyticsDashboard() {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  )
  const [monthsForTrends, setMonthsForTrends] = useState<number>(6)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [growthData, setGrowthData] = useState<GrowthData | null>(null)
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [exporting, setExporting] = useState<boolean>(false)
  const [errors, setErrors] = useState<ErrorState>({
    summary: null,
    growth: null,
    business: null,
  })

  // Fetch summary data
  useEffect(() => {
    fetchSummary()
  }, [selectedMonth])

  // Fetch trend data
  useEffect(() => {
    fetchGrowthTrends()
    fetchBusinessPerformance()
  }, [monthsForTrends])

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true)
      setErrors(prev => ({ ...prev, summary: null }))
      const response = await fetch(`/api/cpe/analytics/summary?month=${selectedMonth}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch summary data')
      }

      if (result.success) {
        setSummary(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch summary')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load summary'
      console.error('Error fetching summary:', errorMessage)
      setErrors(prev => ({ ...prev, summary: errorMessage }))
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  const fetchGrowthTrends = useCallback(async () => {
    try {
      setErrors(prev => ({ ...prev, growth: null }))
      const response = await fetch(`/api/cpe/analytics/partner-growth?months=${monthsForTrends}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch growth trends')
      }

      if (result.success) {
        setGrowthData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch growth trends')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load growth trends'
      console.error('Error fetching growth trends:', errorMessage)
      setErrors(prev => ({ ...prev, growth: errorMessage }))
    }
  }, [monthsForTrends])

  const fetchBusinessPerformance = useCallback(async () => {
    try {
      setErrors(prev => ({ ...prev, business: null }))
      const response = await fetch(`/api/cpe/analytics/business-performance?months=${monthsForTrends}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch business performance')
      }

      if (result.success) {
        setBusinessData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch business performance')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load business performance'
      console.error('Error fetching business performance:', errorMessage)
      setErrors(prev => ({ ...prev, business: errorMessage }))
    }
  }, [monthsForTrends])

  // Retry all failed requests
  const retryAllFailed = () => {
    if (errors.summary) fetchSummary()
    if (errors.growth) fetchGrowthTrends()
    if (errors.business) fetchBusinessPerformance()
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const response = await fetch(
        `/api/cpe/analytics/export?format=excel&month=${selectedMonth}&months=${monthsForTrends}`
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `CPE_Analytics_${selectedMonth}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Export failed')
      }
    } catch (error) {
      console.error('Error exporting:', error)
    } finally {
      setExporting(false)
    }
  }

  // Format growth data for chart
  const growthChartData = growthData?.labels.map((label, index) => ({
    month: label,
    'Business Associates': growthData.datasets.businessAssociates[index],
    'Business Partners': growthData.datasets.businessPartners[index],
    'Channel Partners': growthData.datasets.channelPartners[index],
    Total: growthData.datasets.total[index],
  }))

  // Format business data for chart
  const businessChartData = businessData?.labels.map((label, index) => ({
    month: label,
    'Total Loan Amount': businessData.datasets.totalLoanAmount[index] / 100000, // Convert to lakhs
    'Sanctioned Amount': businessData.datasets.sanctionedAmount[index] / 100000,
    'Disbursed Amount': businessData.datasets.disbursedAmount[index] / 100000,
  }))

  // Check if any errors exist
  const hasErrors = errors.summary || errors.growth || errors.business

  return (
    <div className="space-y-6 p-4 lg:p-6 bg-black">
      {/* Global Error Banner */}
      {hasErrors && (
        <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Some data failed to load</p>
                <p className="text-red-300/70 text-sm">
                  {[errors.summary, errors.growth, errors.business].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={retryAllFailed}
              className="border-red-500/50 text-red-400 hover:bg-red-950"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry All
            </Button>
          </div>
        </div>
      )}

      {/* Sub-header with filters - No duplicate title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <p className="text-gray-400">
          Partner recruitment and business performance insights
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none cursor-pointer w-[130px]"
            />
          </div>

          {/* Export Button */}
          <Button onClick={handleExport} disabled={exporting} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse bg-gray-900 border-gray-700">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-700 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : errors.summary ? (
        <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium mb-2">Failed to load summary</p>
          <p className="text-red-300/70 text-sm mb-4">{errors.summary}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSummary}
            className="border-red-500/50 text-red-400 hover:bg-red-950"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="Total Partners"
            value={summary.summary.totalPartners.count}
            trend={summary.summary.totalPartners.growth.direction as 'up' | 'down' | 'neutral'}
            trendValue={`${Math.abs(summary.summary.totalPartners.growth.percentage).toFixed(1)}%`}
            icon={<Users className="w-8 h-8" />}
          />
          <DashboardCard
            title="Business Associates"
            value={summary.summary.businessAssociates.count}
            trend={summary.summary.businessAssociates.growth.direction as 'up' | 'down' | 'neutral'}
            trendValue={`${Math.abs(summary.summary.businessAssociates.growth.percentage).toFixed(1)}%`}
            icon={<Users className="w-8 h-8" />}
          />
          <DashboardCard
            title="Business Partners"
            value={summary.summary.businessPartners.count}
            trend={summary.summary.businessPartners.growth.direction as 'up' | 'down' | 'neutral'}
            trendValue={`${Math.abs(summary.summary.businessPartners.growth.percentage).toFixed(1)}%`}
            icon={<Users className="w-8 h-8" />}
          />
          <DashboardCard
            title="Channel Partners"
            value={summary.summary.channelPartners.count}
            trend={summary.summary.channelPartners.growth.direction as 'up' | 'down' | 'neutral'}
            trendValue={`${Math.abs(summary.summary.channelPartners.growth.percentage).toFixed(1)}%`}
            icon={<TrendingUp className="w-8 h-8" />}
          />
        </div>
      ) : null}

      {/* Trends Period Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Trends Period:</span>
        {[3, 6, 12].map((months) => (
          <Button
            key={months}
            variant={monthsForTrends === months ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMonthsForTrends(months)}
            className={monthsForTrends === months
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'border-gray-600 text-gray-300 hover:bg-gray-800'
            }
          >
            {months} Months
          </Button>
        ))}
      </div>

      {/* Partner Growth Chart */}
      <Card className="content-card">
        <CardHeader>
          <CardTitle className="text-white">Partner Growth Trends</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.growth ? (
            <div className="h-[350px] flex flex-col items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-red-400 font-medium mb-2">Failed to load chart</p>
              <p className="text-red-300/70 text-sm mb-4">{errors.growth}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchGrowthTrends}
                className="border-red-500/50 text-red-400 hover:bg-red-950"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : growthChartData && growthChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Line
                  type="monotone"
                  dataKey="Business Associates"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Business Partners"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Channel Partners"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Performance Chart */}
      <Card className="content-card">
        <CardHeader>
          <CardTitle className="text-white">Business Performance (in Lakhs ₹)</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.business ? (
            <div className="h-[350px] flex flex-col items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-red-400 font-medium mb-2">Failed to load chart</p>
              <p className="text-red-300/70 text-sm mb-4">{errors.business}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBusinessPerformance}
                className="border-red-500/50 text-red-400 hover:bg-red-950"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : businessChartData && businessChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={businessChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: number) => `₹${value.toFixed(2)}L`}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Area
                  type="monotone"
                  dataKey="Total Loan Amount"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="Sanctioned Amount"
                  stackId="2"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="Disbursed Amount"
                  stackId="3"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
