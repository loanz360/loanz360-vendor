'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BDEPerformanceRow } from '@/types/bdm-team-performance'
import { Search, ArrowUpDown, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'

interface BDEPerformanceGridProps {
  bdePerformance: BDEPerformanceRow[]
  onBDEClick: (bdeId: string) => void
}

export default function BDEPerformanceGrid({
  bdePerformance,
  onBDEClick,
}: BDEPerformanceGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'conversions' | 'revenue' | 'achievement'>('achievement')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Filter and sort
  const filteredAndSorted = bdePerformance
    .filter((bde) =>
      bde.bdeName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.bdeName.localeCompare(b.bdeName)
          break
        case 'conversions':
          comparison = a.currentPerformance.conversions - b.currentPerformance.conversions
          break
        case 'revenue':
          comparison = a.currentPerformance.revenue - b.currentPerformance.revenue
          break
        case 'achievement':
          comparison = a.achievementRates.overall - b.achievementRates.overall
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>BDE Performance Grid</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search BDEs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 font-semibold text-sm hover:text-blue-600"
                  >
                    BDE Name
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('conversions')}
                    className="flex items-center gap-1 font-semibold text-sm hover:text-blue-600"
                  >
                    Conversions
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('revenue')}
                    className="flex items-center gap-1 font-semibold text-sm hover:text-blue-600"
                  >
                    Revenue
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('achievement')}
                    className="flex items-center gap-1 font-semibold text-sm hover:text-blue-600"
                  >
                    Achievement
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Rank</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAndSorted.map((bde) => (
                <tr
                  key={bde.bdeId}
                  className={`hover:bg-gray-50 transition-colors ${bde.statusBgColor}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-md">
                        {bde.bdeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium">{bde.bdeName}</div>
                        <div className="text-xs text-gray-500">{bde.employeeCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-semibold text-lg">{bde.currentPerformance.conversions}</div>
                      <div className="text-xs text-gray-500">of {bde.targets.conversionsTarget}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-semibold">{formatCurrency(bde.currentPerformance.revenue, true)}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(bde.targets.revenueTarget, true)}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                          <div
                            className={`h-2 rounded-full ${getProgressColor(bde.achievementRates.overall)} transition-all duration-500`}
                            style={{ width: `${Math.min(100, bde.achievementRates.overall)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-semibold ${getAchievementTextColor(bde.achievementRates.overall)}`}>
                          {bde.achievementRates.overall}%
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(bde.status)}`}>
                      {bde.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-2xl font-bold">
                      {getRankBadge(bde.overallRank)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onBDEClick(bde.bdeId)}
                      className="hover:bg-blue-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSorted.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No BDEs found</p>
              <p className="text-sm">Try adjusting your search query</p>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {filteredAndSorted.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {filteredAndSorted.length} of {bdePerformance.length} BDEs
            </div>
            <div>
              Avg Achievement: {Math.round(
                filteredAndSorted.reduce((sum, bde) => sum + bde.achievementRates.overall, 0) / filteredAndSorted.length
              )}%
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper functions
function getProgressColor(percentage: number) {
  if (percentage >= 100) return 'bg-green-500'
  if (percentage >= 80) return 'bg-blue-500'
  if (percentage >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getAchievementTextColor(percentage: number) {
  if (percentage >= 100) return 'text-green-600'
  if (percentage >= 80) return 'text-blue-600'
  if (percentage >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'exceeding':
      return 'bg-green-100 text-green-800 border border-green-300'
    case 'on_track':
      return 'bg-blue-100 text-blue-800 border border-blue-300'
    case 'at_risk':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300'
    case 'behind':
      return 'bg-red-100 text-red-800 border border-red-300'
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300'
  }
}

function getRankBadge(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}
