'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BDEProjectionSummary } from '@/types/bdm-team-performance'
import { Users, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'
import { useState } from 'react'

interface BDEProjectionsTableProps {
  projections: BDEProjectionSummary[]
}

export default function BDEProjectionsTable({ projections }: BDEProjectionsTableProps) {
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'conversions' | 'revenue'>('status')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  if (!projections || projections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            BDE Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No BDE projections available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Sort projections
  const sortedProjections = [...projections].sort((a, b) => {
    let aVal: any, bVal: any

    switch (sortBy) {
      case 'name':
        aVal = a.bdeName
        bVal = b.bdeName
        break
      case 'status':
        const statusOrder = { on_track: 3, at_risk: 2, behind: 1 }
        aVal = statusOrder[a.status]
        bVal = statusOrder[b.status]
        break
      case 'conversions':
        aVal = a.conversionsProjection.gap
        bVal = b.conversionsProjection.gap
        break
      case 'revenue':
        aVal = a.revenueProjection.gap
        bVal = b.revenueProjection.gap
        break
      default:
        aVal = 0
        bVal = 0
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('asc')
    }
  }

  // Calculate summary stats
  const onTrackCount = projections.filter((p) => p.status === 'on_track').length
  const atRiskCount = projections.filter((p) => p.status === 'at_risk').length
  const behindCount = projections.filter((p) => p.status === 'behind').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            BDE Projections
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-700">{onTrackCount} On Track</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-gray-700">{atRiskCount} At Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-700">{behindCount} Behind</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    BDE Name
                    {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th
                  className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Status
                    {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Conversions</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjections.map((projection, index) => (
                <tr
                  key={projection.bdeId}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                    index < 3 ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* BDE Name */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                        {projection.bdeName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{projection.bdeName}</div>
                        {index < 3 && (
                          <div className="text-xs text-blue-600 font-medium">Top Performer</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="text-center py-4 px-4">
                    <div className="inline-flex items-center gap-1">
                      {projection.status === 'on_track' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle
                          className={`h-5 w-5 ${
                            projection.status === 'at_risk' ? 'text-yellow-600' : 'text-red-600'
                          }`}
                        />
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          projection.status === 'on_track'
                            ? 'bg-green-100 text-green-800'
                            : projection.status === 'at_risk'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {projection.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </td>

                  {/* Conversions */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <span className="text-gray-600">Current:</span>
                        <span className="font-bold">{projection.conversionsProjection.current}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <span className="text-gray-600">Target:</span>
                        <span className="font-bold">{projection.conversionsProjection.target}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <span className="text-gray-600">Projected:</span>
                        <span className="font-bold text-blue-600">
                          {projection.conversionsProjection.projected}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs">
                        {projection.conversionsProjection.gap <= 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-green-700">
                              +{Math.abs(projection.conversionsProjection.gap)}
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-red-700">
                              -{projection.conversionsProjection.gap}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            projection.conversionsProjection.likelihood === 'very_likely'
                              ? 'bg-green-100 text-green-800'
                              : projection.conversionsProjection.likelihood === 'likely'
                              ? 'bg-blue-100 text-blue-800'
                              : projection.conversionsProjection.likelihood === 'possible'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {projection.conversionsProjection.likelihood.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Revenue */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <span className="text-gray-600">Current:</span>
                        <span className="font-bold">
                          {formatCurrency(projection.revenueProjection.current, true)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <span className="text-gray-600">Target:</span>
                        <span className="font-bold">
                          {formatCurrency(projection.revenueProjection.target, true)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <span className="text-gray-600">Projected:</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(projection.revenueProjection.projected, true)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs">
                        {projection.revenueProjection.gap <= 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-green-700">
                              +{formatCurrency(Math.abs(projection.revenueProjection.gap), true)}
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-red-700">
                              -{formatCurrency(projection.revenueProjection.gap, true)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            projection.revenueProjection.likelihood === 'very_likely'
                              ? 'bg-green-100 text-green-800'
                              : projection.revenueProjection.likelihood === 'likely'
                              ? 'bg-blue-100 text-blue-800'
                              : projection.revenueProjection.likelihood === 'possible'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {projection.revenueProjection.likelihood.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="text-3xl font-bold text-green-700">{onTrackCount}</div>
              <div className="text-sm text-green-600 font-medium">BDEs On Track</div>
              <div className="text-xs text-gray-600 mt-1">
                {((onTrackCount / projections.length) * 100).toFixed(0)}% of team
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
              <div className="text-3xl font-bold text-yellow-700">{atRiskCount}</div>
              <div className="text-sm text-yellow-600 font-medium">BDEs At Risk</div>
              <div className="text-xs text-gray-600 mt-1">
                {((atRiskCount / projections.length) * 100).toFixed(0)}% of team
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
              <div className="text-3xl font-bold text-red-700">{behindCount}</div>
              <div className="text-sm text-red-600 font-medium">BDEs Behind</div>
              <div className="text-xs text-gray-600 mt-1">
                {((behindCount / projections.length) * 100).toFixed(0)}% of team
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
