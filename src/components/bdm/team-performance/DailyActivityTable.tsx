'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyActivityRow } from '@/types/bdm-team-performance'
import { Calendar, ArrowUpDown } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'
import { useState } from 'react'

interface DailyActivityTableProps {
  activities: DailyActivityRow[]
}

export default function DailyActivityTable({ activities }: DailyActivityTableProps) {
  const [sortBy, setSortBy] = useState<'day' | 'conversions' | 'revenue' | 'conversionRate'>('day')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  const sortedActivities = [...activities].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'day':
        comparison = a.day - b.day
        break
      case 'conversions':
        comparison = a.conversions - b.conversions
        break
      case 'revenue':
        comparison = a.revenue - b.revenue
        break
      case 'conversionRate':
        comparison = a.conversionRate - b.conversionRate
        break
    }
    return sortDirection === 'asc' ? comparison : -comparison
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          Daily Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('day')}
                    className="flex items-center gap-1 font-semibold hover:text-blue-600"
                  >
                    Date
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('conversions')}
                    className="flex items-center gap-1 font-semibold hover:text-blue-600 mx-auto"
                  >
                    Conv
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSort('revenue')}
                    className="flex items-center gap-1 font-semibold hover:text-blue-600 ml-auto"
                  >
                    Revenue
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-semibold">Disbursal</th>
                <th className="px-4 py-3 text-center font-semibold">Leads</th>
                <th className="px-4 py-3 text-center font-semibold">Calls</th>
                <th className="px-4 py-3 text-center font-semibold">Meetings</th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleSort('conversionRate')}
                    className="flex items-center gap-1 font-semibold hover:text-blue-600 mx-auto"
                  >
                    Rate %
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedActivities.map((day) => {
                const isWeekend = day.dayOfWeek === 'Sat' || day.dayOfWeek === 'Sun'
                const hasActivity = day.conversions > 0 || day.leads > 0

                return (
                  <tr
                    key={day.day}
                    className={`hover:bg-gray-50 transition-colors ${isWeekend ? 'bg-gray-50' : ''} ${!hasActivity ? 'opacity-50' : ''}`}
                  >
                    {/* Date */}
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">Day {day.day}</div>
                        <div className="text-xs text-gray-500">
                          {day.dayOfWeek} • {new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </td>

                    {/* Conversions */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded font-semibold ${day.conversions > 0 ? 'bg-green-100 text-green-800' : 'text-gray-400'}`}
                      >
                        {day.conversions}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3 text-right font-medium">
                      {day.revenue > 0 ? formatCurrency(day.revenue, true) : '-'}
                    </td>

                    {/* Disbursal */}
                    <td className="px-4 py-3 text-right text-gray-600">
                      {day.disbursal > 0 ? formatCurrency(day.disbursal, true) : '-'}
                    </td>

                    {/* Leads */}
                    <td className="px-4 py-3 text-center text-gray-700">{day.leads || '-'}</td>

                    {/* Calls */}
                    <td className="px-4 py-3 text-center text-gray-700">{day.calls || '-'}</td>

                    {/* Meetings */}
                    <td className="px-4 py-3 text-center text-gray-700">{day.meetings || '-'}</td>

                    {/* Conversion Rate */}
                    <td className="px-4 py-3 text-center">
                      {day.conversionRate > 0 ? (
                        <span
                          className={`text-xs font-semibold ${day.conversionRate >= 15 ? 'text-green-600' : day.conversionRate >= 10 ? 'text-blue-600' : 'text-yellow-600'}`}
                        >
                          {day.conversionRate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${getStatusBadge(day.achievementStatus)}`}
                      >
                        {getStatusLabel(day.achievementStatus)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Summary Footer */}
            <tfoot className="bg-gray-50 border-t-2 font-semibold">
              <tr>
                <td className="px-4 py-3">
                  <div className="font-bold">TOTAL</div>
                  <div className="text-xs text-gray-500">{activities.length} days</div>
                </td>
                <td className="px-4 py-3 text-center text-green-700">
                  {activities.reduce((sum, d) => sum + d.conversions, 0)}
                </td>
                <td className="px-4 py-3 text-right text-blue-700">
                  {formatCurrency(activities.reduce((sum, d) => sum + d.revenue, 0), true)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatCurrency(activities.reduce((sum, d) => sum + d.disbursal, 0), true)}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {activities.reduce((sum, d) => sum + d.leads, 0)}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {activities.reduce((sum, d) => sum + d.calls, 0)}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {activities.reduce((sum, d) => sum + d.meetings, 0)}
                </td>
                <td className="px-4 py-3 text-center text-purple-700">
                  {(
                    (activities.reduce((sum, d) => sum + d.conversions, 0) /
                      (activities.reduce((sum, d) => sum + d.leads, 0) || 1)) *
                    100
                  ).toFixed(1)}%
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>

          {sortedActivities.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No activities recorded yet</p>
              <p className="text-sm">Daily activities will appear here as data is collected</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'exceeding':
      return 'bg-green-100 text-green-800'
    case 'on_track':
      return 'bg-blue-100 text-blue-800'
    case 'at_risk':
      return 'bg-yellow-100 text-yellow-800'
    case 'behind':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'exceeding':
      return '🎯'
    case 'on_track':
      return '✓'
    case 'at_risk':
      return '⚠'
    case 'behind':
      return '✗'
    default:
      return '-'
  }
}
