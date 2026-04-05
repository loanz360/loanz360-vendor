'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  TrendingUp,
  Target,
  Award,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Download,
  FileText,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react'
import PerformanceTrendChart from './charts/PerformanceTrendChart'
import PartnerDistributionChart from './charts/PartnerDistributionChart'
import TargetAchievementGauge from './charts/TargetAchievementGauge'
import { exportAnalyticsToPDF } from '@/lib/utils/export/pdf-export'
import { exportAnalyticsToExcel } from '@/lib/utils/export/excel-export'

interface CPEAnalyticsTabProps {
  userId: string
}

export default function CPEAnalyticsTab({ userId }: CPEAnalyticsTabProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    fetchAnalyticsData()

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchAnalyticsData(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [userId])

  const fetchAnalyticsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      const response = await fetch('/api/performance/cpe/analytics')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setLastUpdated(new Date())
      } else {
        setError(result.error || 'Failed to load data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleManualRefresh = () => {
    fetchAnalyticsData(true)
  }

  const handleExportPDF = () => {
    if (!data) return

    // Get user name from local storage or use default
    const userName = localStorage.getItem('user_full_name') || 'Channel Partner Executive'
    exportAnalyticsToPDF(data, userName)
  }

  const handleExportExcel = () => {
    if (!data) return

    // Get user name from local storage or use default
    const userName = localStorage.getItem('user_full_name') || 'Channel Partner Executive'
    exportAnalyticsToExcel(data, userName)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-400">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={fetchAnalyticsData}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No data available</p>
      </div>
    )
  }

  const overview = data.overview || {}
  const partnerDistribution = data.partner_distribution || {}
  const currentMonthMetrics = data.current_month_metrics || {}
  const topPartners = data.top_partners || []
  const recentRecruitments = data.recent_recruitments || []
  const targetAchievement = data.target_achievement || {}

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        {/* Last Updated */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          {lastUpdated ? (
            <span>Last updated: {lastUpdated.toLocaleTimeString('en-IN')}</span>
          ) : (
            <span>Loading...</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Active Partners */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Active Partners</p>
              <h3 className="text-3xl font-bold text-white">
                {overview.total_active_partners || 0}
              </h3>
              <p className="text-xs text-blue-400 mt-2">
                Recruited this month: {overview.partners_recruited_this_month || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Total Leads Generated */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6 hover:shadow-lg hover:shadow-green-500/10 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Leads Generated</p>
              <h3 className="text-3xl font-bold text-white">
                {overview.total_leads_generated || 0}
              </h3>
              <p className="text-xs text-green-400 mt-2">
                By all recruited partners
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        {/* Estimated Commission */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Estimated Commission</p>
              <h3 className="text-3xl font-bold text-white">
                ₹{(overview.estimated_commission || 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-purple-400 mt-2">
                From partner payouts
              </p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Avg Partner Productivity */}
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl p-6 hover:shadow-lg hover:shadow-orange-500/10 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Avg Partner Productivity</p>
              <h3 className="text-3xl font-bold text-white">
                {overview.avg_partner_productivity?.toFixed(1) || 0}
              </h3>
              <p className="text-xs text-orange-400 mt-2">
                Leads per active partner
              </p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-gradient-to-br from-teal-500/10 to-teal-600/10 border border-teal-500/20 rounded-xl p-6 hover:shadow-lg hover:shadow-teal-500/10 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Conversion Rate</p>
              <h3 className="text-3xl font-bold text-white">
                {currentMonthMetrics.conversion_rate?.toFixed(1) || 0}%
              </h3>
              <p className="text-xs text-teal-400 mt-2">
                Leads to conversions
              </p>
            </div>
            <div className="p-3 bg-teal-500/20 rounded-lg">
              <Target className="w-6 h-6 text-teal-400" />
            </div>
          </div>
        </div>

        {/* Sanction Rate */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-xl p-6 hover:shadow-lg hover:shadow-yellow-500/10 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Sanction Rate</p>
              <h3 className="text-3xl font-bold text-white">
                {currentMonthMetrics.sanction_rate?.toFixed(1) || 0}%
              </h3>
              <p className="text-xs text-yellow-400 mt-2">
                Leads to sanctioned
              </p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trend Chart */}
      <PerformanceTrendChart data={data.performance_trend || []} />

      {/* Target Achievement Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <TargetAchievementGauge
          title="Partners Recruitment"
          current={targetAchievement.partners_recruited?.current || 0}
          target={targetAchievement.partners_recruited?.target || 0}
          unit="partners"
          color="#3B82F6"
        />
        <TargetAchievementGauge
          title="Leads Generated"
          current={targetAchievement.leads_generated?.current || 0}
          target={targetAchievement.leads_generated?.target || 0}
          unit="leads"
          color="#10B981"
        />
        <TargetAchievementGauge
          title="Business Volume"
          current={targetAchievement.business_volume?.current || 0}
          target={targetAchievement.business_volume?.target || 0}
          unit="₹"
          color="#A855F7"
        />
        <TargetAchievementGauge
          title="Commission"
          current={targetAchievement.commission?.current || 0}
          target={targetAchievement.commission?.target || 0}
          unit="₹"
          color="#F59E0B"
        />
      </div>

      {/* Partner Distribution & Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Partner Type Distribution - Chart Version */}
        <PartnerDistributionChart data={partnerDistribution} />

        {/* Current Month Performance */}
        <div className="content-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-400" />
            Current Month Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Leads Generated</span>
              <span className="text-sm font-semibold text-white">{currentMonthMetrics.leads_generated || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Leads Converted</span>
              <span className="text-sm font-semibold text-green-400">{currentMonthMetrics.leads_converted || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Leads Sanctioned</span>
              <span className="text-sm font-semibold text-blue-400">{currentMonthMetrics.leads_sanctioned || 0}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-400">Leads Disbursed</span>
              <span className="text-sm font-semibold text-purple-400">{currentMonthMetrics.leads_disbursed || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Partners */}
      <div className="content-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-400" />
          Top Performing Partners
        </h3>
        {topPartners.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Partner</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total Leads</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Sanctioned</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {topPartners.map((partner: any, index: number) => (
                  <tr key={partner.partner_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        index === 1 ? 'bg-gray-500/20 text-gray-400' :
                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-700/20 text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-white">{partner.partner_name}</p>
                        <p className="text-xs text-gray-500">{partner.partner_code}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
                        {partner.partner_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-white font-semibold">{partner.total_leads}</td>
                    <td className="py-3 px-4 text-right text-sm text-green-400 font-semibold">{partner.leads_sanctioned}</td>
                    <td className="py-3 px-4 text-right text-sm text-purple-400 font-semibold">{partner.conversion_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No partner data available</p>
        )}
      </div>

      {/* Recent Recruitments */}
      <div className="content-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Recent Recruitments
        </h3>
        {recentRecruitments.length > 0 ? (
          <div className="space-y-3">
            {recentRecruitments.map((partner: any) => (
              <div
                key={partner.partner_id}
                className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{partner.partner_name}</p>
                    <p className="text-xs text-gray-500">{partner.partner_code} • {partner.partner_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">{partner.days_active} days active</p>
                  <p className="text-xs text-gray-500">{partner.total_leads} leads generated</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No recent recruitments</p>
        )}
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(data.last_updated).toLocaleString('en-IN')}
      </div>
    </div>
  )
}
