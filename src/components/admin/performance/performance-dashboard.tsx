'use client'

/**
 * Performance Dashboard Component
 * Main dashboard combining all performance components
 */

import { useState } from 'react'
import PerformanceOverview from './performance-overview'
import PerformanceTrends from './performance-trends'
import Leaderboard from './leaderboard'
import TeamSummary from './team-summary'
import type { PeriodType } from '@/lib/performance/performance-analytics'

interface PerformanceDashboardProps {
  adminId?: string
  showTeamView?: boolean
}

export default function PerformanceDashboard({
  adminId,
  showTeamView = false,
}: PerformanceDashboardProps) {
  const [period, setPeriod] = useState<PeriodType>('30d')
  const [view, setView] = useState<'individual' | 'team'>(
    showTeamView ? 'team' : 'individual'
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
          <p className="text-gray-600">Track and analyze admin performance metrics</p>
        </div>
        <div className="flex gap-2">
          {adminId && (
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('individual')}
                className={`px-4 py-2 text-sm font-medium ${
                  view === 'individual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                My Performance
              </button>
              <button
                onClick={() => setView('team')}
                className={`px-4 py-2 text-sm font-medium ${
                  view === 'team'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Team View
              </button>
            </div>
          )}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {view === 'individual' && adminId ? (
        <IndividualView adminId={adminId} period={period} />
      ) : (
        <TeamView period={period} />
      )}
    </div>
  )
}

interface IndividualViewProps {
  adminId: string
  period: PeriodType
}

function IndividualView({ adminId, period }: IndividualViewProps) {
  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <PerformanceOverview adminId={adminId} period={period} />

      {/* Performance Trends */}
      <PerformanceTrends adminId={adminId} defaultPeriod={period} />

      {/* Leaderboard with highlight */}
      <Leaderboard
        defaultPeriod={period}
        limit={10}
        highlightAdminId={adminId}
      />
    </div>
  )
}

interface TeamViewProps {
  period: PeriodType
}

function TeamView({ period }: TeamViewProps) {
  return (
    <div className="space-y-6">
      {/* Team Summary */}
      <TeamSummary period={period} />

      {/* Leaderboard */}
      <Leaderboard defaultPeriod={period} limit={20} />
    </div>
  )
}
