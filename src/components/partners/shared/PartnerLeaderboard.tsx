'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, Medal, TrendingUp, Users, IndianRupee, RefreshCw } from 'lucide-react'
import Image from 'next/image'

interface LeaderboardEntry {
  rank: number
  partnerId: string
  name: string
  partnerType: string
  profileUrl: string | null
  city: string | null
  state: string | null
  totalLeads: number
  conversions: number
  conversionRate: number
  totalCommission: number
  score: number
}

interface LeaderboardData {
  data: LeaderboardEntry[]
  myRank: number | null
  totalParticipants: number
  period: string
  metric: string
  count: number
}

interface PartnerLeaderboardProps {
  partnerType: 'BA' | 'BP' | 'CP'
}

const PERIOD_OPTIONS = [
  { value: '7d', label: 'This Week' },
  { value: '30d', label: 'This Month' },
  { value: '90d', label: 'This Quarter' },
  { value: 'all', label: 'All Time' },
]

const METRIC_OPTIONS = [
  { value: 'conversions', label: 'Conversions', icon: TrendingUp },
  { value: 'leads', label: 'Total Leads', icon: Users },
  { value: 'commission', label: 'Commission', icon: IndianRupee },
]

function getRankBadge(rank: number) {
  if (rank === 1) return { emoji: '🥇', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' }
  if (rank === 2) return { emoji: '🥈', bg: 'bg-gray-400/20', text: 'text-gray-300', border: 'border-gray-400/30' }
  if (rank === 3) return { emoji: '🥉', bg: 'bg-orange-600/20', text: 'text-orange-400', border: 'border-orange-600/30' }
  return { emoji: '', bg: 'bg-gray-800/50', text: 'text-gray-400', border: 'border-gray-700/30' }
}

function formatPartnerType(type: string) {
  const map: Record<string, string> = {
    'BUSINESS_ASSOCIATE': 'BA',
    'BUSINESS_PARTNER': 'BP',
    'CHANNEL_PARTNER': 'CP',
  }
  return map[type] || type
}

export function PartnerLeaderboard({ partnerType }: PartnerLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30d')
  const [metric, setMetric] = useState('conversions')

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        partner_type: partnerType,
        period,
        metric,
        limit: '20',
      })
      const res = await fetch(`/api/partners/leaderboard?${params}`)
      const result = await res.json()
      if (result.success) {
        setData(result)
      } else {
        setError(result.error || 'Failed to load leaderboard')
      }
    } catch {
      setError('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [partnerType, period, metric])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const formatScore = (entry: LeaderboardEntry) => {
    if (metric === 'commission') return `₹${entry.totalCommission.toLocaleString('en-IN')}`
    if (metric === 'leads') return `${entry.totalLeads} leads`
    return `${entry.conversions} converted`
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-poppins">Partner Leaderboard</h2>
            <p className="text-xs text-gray-400">{data?.totalParticipants || 0} participants</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            {PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            {METRIC_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={fetchLeaderboard}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* My Rank Banner */}
      {data?.myRank && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Medal className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-white">Your Rank</span>
            </div>
            <span className="text-lg font-bold text-orange-400">#{data.myRank}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800/30 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchLeaderboard} className="mt-2 text-xs text-orange-400 hover:text-orange-300">
            Try again
          </button>
        </div>
      )}

      {/* Leaderboard List */}
      {!loading && !error && data && (
        <div className="space-y-2">
          {data.data.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No leaderboard data for this period</p>
            </div>
          ) : (
            data.data.map((entry) => {
              const badge = getRankBadge(entry.rank)
              return (
                <div
                  key={entry.partnerId}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    entry.rank <= 3
                      ? `${badge.bg} ${badge.border}`
                      : 'bg-gray-900/30 border-gray-800/50 hover:bg-gray-800/30'
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${badge.bg} ${badge.text}`}>
                    {badge.emoji || `#${entry.rank}`}
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {entry.profileUrl ? (
                        <Image src={entry.profileUrl} alt="" width={36} height={36} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-gray-300">{entry.name?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{entry.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatPartnerType(entry.partnerType)}
                        {entry.city ? ` · ${entry.city}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-gray-500">Leads</p>
                      <p className="text-sm font-medium text-white">{entry.totalLeads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Conv.</p>
                      <p className="text-sm font-medium text-green-400">{entry.conversionRate}%</p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-400">{formatScore(entry)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
