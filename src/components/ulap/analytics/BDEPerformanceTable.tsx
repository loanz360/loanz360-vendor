'use client'

/**
 * BDE Performance Table
 *
 * Displays performance metrics for BDEs/employees handling leads
 * Shows conversion rates, processing times, and rankings
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Award,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Medal
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/cn'

interface BDEMetrics {
  id: string
  name: string
  employeeId: string
  avatar?: string
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  avgProcessingDays: number
  totalDisbursed: number
  pendingLeads: number
  trend: 'up' | 'down' | 'stable'
  rank: number
}

interface BDEPerformanceTableProps {
  teamId?: string
  dateRange?: 'week' | 'month' | 'quarter' | 'year'
  limit?: number
  showSearch?: boolean
}

// Mock data
const mockBDEs: BDEMetrics[] = [
  { id: '1', name: 'Rahul Sharma', employeeId: 'EMP001', totalLeads: 145, convertedLeads: 67, conversionRate: 46.2, avgProcessingDays: 3.2, totalDisbursed: 12500000, pendingLeads: 23, trend: 'up', rank: 1 },
  { id: '2', name: 'Priya Patel', employeeId: 'EMP002', totalLeads: 132, convertedLeads: 58, conversionRate: 43.9, avgProcessingDays: 3.5, totalDisbursed: 10800000, pendingLeads: 28, trend: 'up', rank: 2 },
  { id: '3', name: 'Amit Kumar', employeeId: 'EMP003', totalLeads: 128, convertedLeads: 52, conversionRate: 40.6, avgProcessingDays: 3.8, totalDisbursed: 9600000, pendingLeads: 31, trend: 'stable', rank: 3 },
  { id: '4', name: 'Neha Singh', employeeId: 'EMP004', totalLeads: 118, convertedLeads: 45, conversionRate: 38.1, avgProcessingDays: 4.1, totalDisbursed: 8200000, pendingLeads: 26, trend: 'down', rank: 4 },
  { id: '5', name: 'Vikram Reddy', employeeId: 'EMP005', totalLeads: 112, convertedLeads: 41, conversionRate: 36.6, avgProcessingDays: 4.3, totalDisbursed: 7500000, pendingLeads: 29, trend: 'up', rank: 5 },
  { id: '6', name: 'Anita Desai', employeeId: 'EMP006', totalLeads: 105, convertedLeads: 38, conversionRate: 36.2, avgProcessingDays: 4.5, totalDisbursed: 6900000, pendingLeads: 22, trend: 'stable', rank: 6 },
  { id: '7', name: 'Suresh Iyer', employeeId: 'EMP007', totalLeads: 98, convertedLeads: 34, conversionRate: 34.7, avgProcessingDays: 4.8, totalDisbursed: 6200000, pendingLeads: 25, trend: 'down', rank: 7 },
  { id: '8', name: 'Meera Nair', employeeId: 'EMP008', totalLeads: 92, convertedLeads: 31, conversionRate: 33.7, avgProcessingDays: 5.0, totalDisbursed: 5600000, pendingLeads: 27, trend: 'up', rank: 8 }
]

type SortField = 'totalLeads' | 'conversionRate' | 'avgProcessingDays' | 'totalDisbursed'
type SortDirection = 'asc' | 'desc'

export default function BDEPerformanceTable({
  teamId,
  dateRange = 'month',
  limit = 10,
  showSearch = true
}: BDEPerformanceTableProps) {
  const [bdes, setBdes] = useState<BDEMetrics[]>(mockBDEs)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('conversionRate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    fetchBDEMetrics()
  }, [teamId, dateRange])

  const fetchBDEMetrics = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 800))
      setBdes(mockBDEs)
    } catch (error) {
      console.error('Failed to fetch BDE metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const filteredAndSortedBDEs = bdes
    .filter(bde =>
      bde.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bde.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
    .slice(0, limit)

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Medal, color: 'text-yellow-400', bg: 'bg-yellow-500/10' }
    if (rank === 2) return { icon: Medal, color: 'text-gray-300', bg: 'bg-gray-400/10' }
    if (rank === 3) return { icon: Medal, color: 'text-orange-400', bg: 'bg-orange-500/10' }
    return null
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-48 mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">BDE Performance</h3>
              <p className="text-xs text-gray-400">{filteredAndSortedBDEs.length} team members</p>
            </div>
          </div>

          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search BDE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 w-64"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-gray-400 font-medium text-sm">Rank</th>
              <th className="text-left p-4 text-gray-400 font-medium text-sm">BDE</th>
              <th
                className="text-right p-4 text-gray-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('totalLeads')}
              >
                <div className="flex items-center justify-end gap-1">
                  Leads
                  <SortIcon field="totalLeads" />
                </div>
              </th>
              <th
                className="text-right p-4 text-gray-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('conversionRate')}
              >
                <div className="flex items-center justify-end gap-1">
                  Conv. Rate
                  <SortIcon field="conversionRate" />
                </div>
              </th>
              <th
                className="text-right p-4 text-gray-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('avgProcessingDays')}
              >
                <div className="flex items-center justify-end gap-1">
                  Avg. Days
                  <SortIcon field="avgProcessingDays" />
                </div>
              </th>
              <th
                className="text-right p-4 text-gray-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('totalDisbursed')}
              >
                <div className="flex items-center justify-end gap-1">
                  Disbursed
                  <SortIcon field="totalDisbursed" />
                </div>
              </th>
              <th className="text-center p-4 text-gray-400 font-medium text-sm">Trend</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedBDEs.map((bde, index) => {
              const rankBadge = getRankBadge(bde.rank)

              return (
                <motion.tr
                  key={bde.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {/* Rank */}
                  <td className="p-4">
                    {rankBadge ? (
                      <div className={`w-8 h-8 rounded-full ${rankBadge.bg} flex items-center justify-center`}>
                        <rankBadge.icon className={`w-4 h-4 ${rankBadge.color}`} />
                      </div>
                    ) : (
                      <span className="text-gray-500 font-medium">{bde.rank}</span>
                    )}
                  </td>

                  {/* BDE Info */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center">
                        {bde.avatar ? (
                          <img src={bde.avatar} alt={bde.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-orange-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{bde.name}</p>
                        <p className="text-xs text-gray-500">{bde.employeeId}</p>
                      </div>
                    </div>
                  </td>

                  {/* Leads */}
                  <td className="p-4 text-right">
                    <div>
                      <p className="text-white font-medium">{bde.totalLeads}</p>
                      <p className="text-xs text-gray-500">{bde.pendingLeads} pending</p>
                    </div>
                  </td>

                  {/* Conversion Rate */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${bde.conversionRate}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={`h-full rounded-full ${
                            bde.conversionRate >= 40 ? 'bg-green-500' :
                            bde.conversionRate >= 35 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        />
                      </div>
                      <span className={`font-medium ${
                        bde.conversionRate >= 40 ? 'text-green-400' :
                        bde.conversionRate >= 35 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {bde.conversionRate}%
                      </span>
                    </div>
                  </td>

                  {/* Avg Days */}
                  <td className="p-4 text-right">
                    <span className={`font-medium ${
                      bde.avgProcessingDays <= 4 ? 'text-green-400' :
                      bde.avgProcessingDays <= 5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {bde.avgProcessingDays}
                    </span>
                  </td>

                  {/* Disbursed */}
                  <td className="p-4 text-right">
                    <span className="text-white font-medium">{formatCurrency(bde.totalDisbursed)}</span>
                  </td>

                  {/* Trend */}
                  <td className="p-4 text-center">
                    {bde.trend === 'up' && (
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      </div>
                    )}
                    {bde.trend === 'down' && (
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                    {bde.trend === 'stable' && (
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-500/10">
                        <div className="w-4 h-0.5 bg-gray-400 rounded" />
                      </div>
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedBDEs.length === 0 && (
        <div className="p-8 text-center">
          <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No BDEs found</p>
        </div>
      )}
    </div>
  )
}
