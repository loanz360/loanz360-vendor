'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  User,
  DollarSign,
  Target,
  Clock,
  Award,
  Eye,
  ArrowUpDown,
  Download,
  Filter,
} from 'lucide-react'

interface BDEPerformance {
  bdeId: string
  bdeName: string
  bdeAvatar: string | null
  bdeEmail: string

  // Current Period Metrics
  totalLeads: number
  activeLeads: number
  convertedLeads: number
  lostLeads: number
  conversionRate: number

  // Revenue Metrics
  totalRevenue: number
  formattedRevenue: string
  avgDealSize: number
  formattedAvgDealSize: string

  // Efficiency Metrics
  avgTAT: number
  avgResponseTime: number
  activitiesCount: number

  // Pipeline Metrics
  pipelineValue: number
  formattedPipelineValue: string
  atRiskLeads: number
  staleLeads: number

  // Performance Score
  performanceScore: number
  scoreGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  scoreColor: string

  // Trends (vs previous period)
  conversionRateTrend: 'up' | 'down' | 'neutral'
  conversionRateChange: number
  revenueTrend: 'up' | 'down' | 'neutral'
  revenueChange: number

  // Rankings
  conversionRank: number
  revenueRank: number
  overallRank: number
}

interface PerformanceMatrixProps {
  dateRange?: string
  onBDEClick?: (bdeId: string) => void
}

export function PerformanceMatrix({ dateRange = 'last_30_days', onBDEClick }: PerformanceMatrixProps) {
  const [sortBy, setSortBy] = useState('performanceScore')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'conversionRate',
    'totalRevenue',
    'performanceScore',
  ])
  const [showFilters, setShowFilters] = useState(false)

  // Fetch performance matrix data
  const { data, isLoading, error } = useQuery({
    queryKey: ['bdm-performance-matrix', dateRange, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateRange,
        sortBy,
        sortOrder,
      })

      const res = await fetch(`/api/bdm/team-pipeline/bde-performance/matrix?${params}`)
      if (!res.ok) throw new Error('Failed to fetch performance matrix')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const performers: BDEPerformance[] = data?.data?.performers || []
  const teamAverages = data?.data?.teamAverages || {}

  const allMetrics = [
    { id: 'totalLeads', label: 'Total Leads', icon: User },
    { id: 'conversionRate', label: 'Conv. Rate %', icon: TrendingUp },
    { id: 'totalRevenue', label: 'Revenue', icon: DollarSign },
    { id: 'avgDealSize', label: 'Avg Deal', icon: DollarSign },
    { id: 'avgTAT', label: 'Avg TAT', icon: Clock },
    { id: 'pipelineValue', label: 'Pipeline', icon: Target },
    { id: 'performanceScore', label: 'Score', icon: Award },
  ]

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 text-gray-500" />
    }
    return sortOrder === 'asc'
      ? <TrendingUp className="w-3 h-3 text-orange-400" />
      : <TrendingDown className="w-3 h-3 text-orange-400" />
  }

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') {
      return (
        <div className="flex items-center gap-1 text-green-400">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs font-medium">+{change.toFixed(1)}%</span>
        </div>
      )
    }
    if (trend === 'down') {
      return (
        <div className="flex items-center gap-1 text-red-400">
          <TrendingDown className="w-3 h-3" />
          <span className="text-xs font-medium">{change.toFixed(1)}%</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Minus className="w-3 h-3" />
        <span className="text-xs font-medium">0%</span>
      </div>
    )
  }

  const getRankBadge = (rank: number, total: number) => {
    const colors = {
      1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      2: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    }

    if (rank <= 3) {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${colors[rank as keyof typeof colors]}`}>
          #{rank}
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">
        #{rank}
      </span>
    )
  }

  const handleExport = () => {
    // Export logic would go here
    console.log('Exporting performance matrix...')
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Failed to load performance matrix. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">BDE Performance Matrix</h2>
            <p className="text-sm text-gray-400">
              {performers.length} BDEs • Team Avg: {teamAverages.conversionRate?.toFixed(1)}% conversion
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 text-gray-300 flex items-center gap-2 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Metrics
              <span className="bg-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {selectedMetrics.length}
              </span>
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Metric Filter */}
        {showFilters && (
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Select Metrics to Display:</span>
              <button
                onClick={() => setSelectedMetrics(allMetrics.map(m => m.id))}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium"
              >
                Select All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allMetrics.map(metric => (
                <button
                  key={metric.id}
                  onClick={() => {
                    setSelectedMetrics(prev =>
                      prev.includes(metric.id)
                        ? prev.filter(m => m !== metric.id)
                        : [...prev, metric.id]
                    )
                  }}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    selectedMetrics.includes(metric.id)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  <metric.icon className="w-3 h-3" />
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : performers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <User className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-lg font-medium">No performance data available</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase sticky left-0 bg-gray-900">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase sticky left-16 bg-gray-900">
                  BDE
                </th>

                {selectedMetrics.includes('totalLeads') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('totalLeads')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Total Leads
                      {getSortIcon('totalLeads')}
                    </button>
                  </th>
                )}

                {selectedMetrics.includes('conversionRate') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('conversionRate')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Conv. Rate
                      {getSortIcon('conversionRate')}
                    </button>
                  </th>
                )}

                {selectedMetrics.includes('totalRevenue') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('totalRevenue')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Revenue
                      {getSortIcon('totalRevenue')}
                    </button>
                  </th>
                )}

                {selectedMetrics.includes('avgDealSize') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('avgDealSize')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Avg Deal
                      {getSortIcon('avgDealSize')}
                    </button>
                  </th>
                )}

                {selectedMetrics.includes('avgTAT') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('avgTAT')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Avg TAT
                      {getSortIcon('avgTAT')}
                    </button>
                  </th>
                )}

                {selectedMetrics.includes('pipelineValue') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('pipelineValue')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Pipeline
                      {getSortIcon('pipelineValue')}
                    </button>
                  </th>
                )}

                {selectedMetrics.includes('performanceScore') && (
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('performanceScore')}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400"
                    >
                      Score
                      {getSortIcon('performanceScore')}
                    </button>
                  </th>
                )}

                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {performers.map((bde, index) => (
                <tr
                  key={bde.bdeId}
                  className="hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3 sticky left-0 bg-gray-800">
                    {getRankBadge(bde.overallRank, performers.length)}
                  </td>

                  <td className="px-4 py-3 sticky left-16 bg-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                        {bde.bdeName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-white">{bde.bdeName}</p>
                        <p className="text-xs text-gray-500">{bde.bdeEmail}</p>
                      </div>
                    </div>
                  </td>

                  {selectedMetrics.includes('totalLeads') && (
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{bde.totalLeads}</p>
                        <p className="text-xs text-gray-500">
                          {bde.convertedLeads} won • {bde.lostLeads} lost
                        </p>
                      </div>
                    </td>
                  )}

                  {selectedMetrics.includes('conversionRate') && (
                    <td className="px-4 py-3">
                      <div>
                        <p className={`text-sm font-bold ${
                          bde.conversionRate >= teamAverages.conversionRate
                            ? 'text-green-400'
                            : 'text-orange-400'
                        }`}>
                          {bde.conversionRate.toFixed(1)}%
                        </p>
                        {getTrendIcon(bde.conversionRateTrend, bde.conversionRateChange)}
                      </div>
                    </td>
                  )}

                  {selectedMetrics.includes('totalRevenue') && (
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{bde.formattedRevenue}</p>
                        {getTrendIcon(bde.revenueTrend, bde.revenueChange)}
                      </div>
                    </td>
                  )}

                  {selectedMetrics.includes('avgDealSize') && (
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{bde.formattedAvgDealSize}</p>
                    </td>
                  )}

                  {selectedMetrics.includes('avgTAT') && (
                    <td className="px-4 py-3">
                      <p className={`text-sm font-medium ${
                        bde.avgTAT <= teamAverages.avgTAT
                          ? 'text-green-400'
                          : 'text-orange-400'
                      }`}>
                        {bde.avgTAT.toFixed(1)} days
                      </p>
                    </td>
                  )}

                  {selectedMetrics.includes('pipelineValue') && (
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{bde.formattedPipelineValue}</p>
                        {bde.atRiskLeads > 0 && (
                          <p className="text-xs text-red-400">{bde.atRiskLeads} at risk</p>
                        )}
                      </div>
                    </td>
                  )}

                  {selectedMetrics.includes('performanceScore') && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${bde.performanceScore}%`,
                                backgroundColor: bde.scoreColor,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className="text-sm font-bold"
                          style={{ color: bde.scoreColor }}
                        >
                          {bde.scoreGrade}
                        </span>
                      </div>
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <button
                      onClick={() => onBDEClick?.(bde.bdeId)}
                      className="p-2 text-orange-400 hover:bg-orange-500/20 rounded transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Team Averages Row */}
            <tfoot className="bg-orange-500/20 border-t-2 border-orange-500/30">
              <tr className="font-semibold">
                <td className="px-4 py-3 sticky left-0 bg-orange-500/20 text-orange-300" colSpan={2}>
                  Team Average
                </td>

                {selectedMetrics.includes('totalLeads') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.totalLeads?.toFixed(0)}
                  </td>
                )}

                {selectedMetrics.includes('conversionRate') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.conversionRate?.toFixed(1)}%
                  </td>
                )}

                {selectedMetrics.includes('totalRevenue') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.formattedRevenue}
                  </td>
                )}

                {selectedMetrics.includes('avgDealSize') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.formattedAvgDealSize}
                  </td>
                )}

                {selectedMetrics.includes('avgTAT') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.avgTAT?.toFixed(1)} days
                  </td>
                )}

                {selectedMetrics.includes('pipelineValue') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.formattedPipelineValue}
                  </td>
                )}

                {selectedMetrics.includes('performanceScore') && (
                  <td className="px-4 py-3 text-sm text-orange-300">
                    {teamAverages.performanceScore?.toFixed(0)}/100
                  </td>
                )}

                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
