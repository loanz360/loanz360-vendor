'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  DollarSign,
  Target,
  Filter,
  Download,
  Search,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Clock
} from 'lucide-react'
import { exportHistoryToPDF } from '@/lib/utils/export/pdf-export'
import { exportHistoryToExcel } from '@/lib/utils/export/excel-export'

interface CPEHistoryTabProps {
  userId: string
}

export default function CPEHistoryTab({ userId }: CPEHistoryTabProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'monthly' | 'partners'>('monthly')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'BA' | 'BP' | 'CP'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    fetchHistoryData()

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchHistoryData(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [userId])

  const fetchHistoryData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      const response = await fetch('/api/performance/cpe/history')
      if (!response.ok) {
        throw new Error('Failed to fetch history data')
      }
      const result = await response.json()
      setData(result)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleManualRefresh = () => {
    fetchHistoryData(true)
  }

  const handleExportPDF = () => {
    if (!data) return

    // Get user name from local storage or use default
    const userName = localStorage.getItem('user_full_name') || 'Channel Partner Executive'
    exportHistoryToPDF(data, userName)
  }

  const handleExportExcel = () => {
    if (!data) return

    // Get user name from local storage or use default
    const userName = localStorage.getItem('user_full_name') || 'Channel Partner Executive'
    exportHistoryToExcel(data, userName)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-400">Loading history data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={fetchHistoryData}
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

  const monthlyHistory = data.history || []
  const partnerBreakdown = data.partnerBreakdown || []

  // Filter partners based on search and type
  const filteredPartners = partnerBreakdown.filter((partner: unknown) => {
    const matchesSearch = partner.partner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.partner_code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || partner.partner_type === filterType ||
      partner.partner_type === `BUSINESS_ASSOCIATE` && filterType === 'BA' ||
      partner.partner_type === `BUSINESS_PARTNER` && filterType === 'BP' ||
      partner.partner_type === `CHANNEL_PARTNER` && filterType === 'CP'
    return matchesSearch && matchesType
  })

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterType])

  // Pagination calculations
  const totalPages = Math.ceil(filteredPartners.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedPartners = filteredPartners.slice(startIndex, endIndex)

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-400" />
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-400" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-400'
    if (value < 0) return 'text-red-400'
    return 'text-gray-400'
  }

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Partners Recruited</p>
              <h3 className="text-3xl font-bold text-white">{data.totalPartnersRecruited || 0}</h3>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-blue-400">
            Active: {data.activePartnersCount || 0}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Best Month</p>
              <h3 className="text-2xl font-bold text-white">
                {monthlyHistory[0]?.period || 'N/A'}
              </h3>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Award className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <p className="text-xs text-green-400">
            Score: {monthlyHistory[0]?.overallScore || 0}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Avg Performance</p>
              <h3 className="text-3xl font-bold text-white">
                {monthlyHistory.length > 0
                  ? (monthlyHistory.reduce((sum: number, m: unknown) => sum + (m.overallScore || 0), 0) / monthlyHistory.length).toFixed(1)
                  : 0}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Target className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-purple-400">
            Last 6 months average
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('monthly')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeView === 'monthly'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Monthly History
          </button>
          <button
            onClick={() => setActiveView('partners')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeView === 'partners'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Partner Breakdown
          </button>
        </div>
      </div>

      {/* Monthly History View */}
      {activeView === 'monthly' && (
        <div className="content-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Monthly Performance History
          </h3>
          {monthlyHistory.length > 0 ? (
            <div className="space-y-4">
              {monthlyHistory.map((month: unknown) => (
                <div
                  key={`${month.month}-${month.year}`}
                  className="bg-gray-800/30 rounded-lg p-5 hover:bg-gray-800/50 transition-all border border-gray-700/50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white">{month.period}</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        Partners Recruited: <span className="text-white font-medium">{month.partnersRecruited || 0}</span>
                        <span className="mx-2 text-gray-600">•</span>
                        Grade: <span className={`font-bold ${
                          month.grade === 'A+' || month.grade === 'A' ? 'text-green-400' :
                          month.grade === 'B+' || month.grade === 'B' ? 'text-blue-400' :
                          month.grade === 'C+' || month.grade === 'C' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>{month.grade}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{month.overallScore}</div>
                      <div className="text-xs text-gray-500">Performance Score</div>
                    </div>
                  </div>

                  {/* Partner Type Breakdown */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-500/10 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">BA Recruited</p>
                      <p className="text-xl font-bold text-blue-400">{month.baRecruited || 0}</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">BP Recruited</p>
                      <p className="text-xl font-bold text-green-400">{month.bpRecruited || 0}</p>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">CP Recruited</p>
                      <p className="text-xl font-bold text-purple-400">{month.cpRecruited || 0}</p>
                    </div>
                  </div>

                  {/* Key Highlights */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {month.highlights?.map((highlight: string, index: number) => (
                      <div key={index} className="text-xs text-gray-400 bg-gray-900/50 rounded px-3 py-2">
                        {highlight}
                      </div>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Leads Generated</p>
                        <p className="text-white font-semibold">{month.metrics?.totalPartnerLeadsGenerated || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Sanctioned</p>
                        <p className="text-green-400 font-semibold">{month.metrics?.leadsSanctioned || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Conversion Rate</p>
                        <p className="text-blue-400 font-semibold">{month.metrics?.partnerConversionRate?.toFixed(1) || 0}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Target Achievement</p>
                        <p className="text-purple-400 font-semibold">{month.targetAchievement || 0}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No monthly history available</p>
          )}
        </div>
      )}

      {/* Partner Breakdown View */}
      {activeView === 'partners' && (
        <div className="content-card p-6">
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search partners by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterType === 'all'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('BA')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterType === 'BA'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                BA
              </button>
              <button
                onClick={() => setFilterType('BP')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterType === 'BP'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                BP
              </button>
              <button
                onClick={() => setFilterType('CP')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterType === 'CP'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                }`}
              >
                CP
              </button>
            </div>
          </div>

          {/* Partners Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Partner</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Location</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Days Active</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total Leads</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Sanctioned</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Avg/Day</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPartners.length > 0 ? (
                  paginatedPartners.map((partner: unknown) => (
                    <tr
                      key={partner.partner_id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-white">{partner.partner_name}</p>
                          <p className="text-xs text-gray-500">{partner.partner_code}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          partner.partner_type.includes('BA') ? 'bg-blue-500/20 text-blue-400' :
                          partner.partner_type.includes('BP') ? 'bg-green-500/20 text-green-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {partner.partner_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-300">{partner.city || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{partner.state || 'N/A'}</p>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-gray-300">{partner.days_active}</td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-white">{partner.total_leads}</td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-green-400">{partner.leads_sanctioned}</td>
                      <td className="py-3 px-4 text-right text-sm text-blue-400">{partner.avg_leads_per_day?.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          partner.is_recently_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            partner.is_recently_active ? 'bg-green-400' : 'bg-gray-400'
                          }`}></div>
                          {partner.is_recently_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No partners found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredPartners.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
              {/* Results Info and Rows Per Page */}
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-400">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredPartners.length)} of {filteredPartners.length} partners
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
