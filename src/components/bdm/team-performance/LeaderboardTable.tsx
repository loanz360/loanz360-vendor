'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaderboardEntry } from '@/types/bdm-team-performance'
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'

interface LeaderboardTableProps {
  leaderboard: LeaderboardEntry[]
  onBDEClick?: (bdeId: string) => void
}

export default function LeaderboardTable({ leaderboard, onBDEClick }: LeaderboardTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Team Leaderboard Rankings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.map((entry) => (
            <div
              key={entry.bdeId}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg ${getRankBorderColor(entry.rank)} ${getRankBgColor(entry.rank)}`}
              onClick={() => onBDEClick?.(entry.bdeId)}
            >
              <div className="flex items-center gap-4">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                  {getRankBadge(entry.rank)}
                </div>

                {/* BDE Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                      {entry.bdeName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-900 truncate">{entry.bdeName}</h3>
                      <p className="text-sm text-gray-500">{entry.employeeCode}</p>
                    </div>
                    {/* Grade Badge */}
                    <div className={`px-4 py-2 rounded-lg font-bold text-2xl ${getGradeColor(entry.grade)} shadow-md`}>
                      {entry.grade}
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white/50 rounded p-2">
                      <div className="text-xs text-gray-600 mb-1">Score</div>
                      <div className={`text-xl font-bold ${getScoreColor(entry.overallScore)}`}>
                        {entry.overallScore}%
                      </div>
                    </div>
                    <div className="bg-white/50 rounded p-2">
                      <div className="text-xs text-gray-600 mb-1">Conversions</div>
                      <div className="text-xl font-bold text-green-600">{entry.conversions}</div>
                    </div>
                    <div className="bg-white/50 rounded p-2">
                      <div className="text-xs text-gray-600 mb-1">Revenue</div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(entry.revenue, true)}
                      </div>
                    </div>
                    <div className="bg-white/50 rounded p-2">
                      <div className="text-xs text-gray-600 mb-1">Conv. Rate</div>
                      <div className="text-xl font-bold text-purple-600">
                        {entry.conversionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Overall Achievement</span>
                      <span className={`font-semibold ${getStatusColor(entry.status)}`}>
                        {entry.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${getProgressBarColor(entry.overallScore)} transition-all duration-500`}
                        style={{ width: `${Math.min(100, entry.overallScore)}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges Earned */}
                  {entry.badgesEarned > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Award className="h-4 w-4 text-yellow-600" />
                        <span className="font-semibold">{entry.badgesEarned} badges</span>
                      </div>
                      {entry.recentBadges && entry.recentBadges.length > 0 && (
                        <div className="flex gap-1">
                          {entry.recentBadges.map((badge) => (
                            <div
                              key={badge.id}
                              className={`px-2 py-1 rounded text-xs font-medium border ${getBadgeStyle(badge.rarity)}`}
                              title={badge.name}
                            >
                              {badge.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No leaderboard data</p>
              <p className="text-sm">Performance data will appear here</p>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {leaderboard.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-1">Team Members</div>
                <div className="text-2xl font-bold text-gray-900">{leaderboard.length}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Avg Score</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(
                    leaderboard.reduce((sum, e) => sum + e.overallScore, 0) / leaderboard.length
                  )}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Conversions</div>
                <div className="text-2xl font-bold text-green-600">
                  {leaderboard.reduce((sum, e) => sum + e.conversions, 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                <div className="text-xl font-bold text-purple-600">
                  {formatCurrency(
                    leaderboard.reduce((sum, e) => sum + e.revenue, 0),
                    true
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getRankBadge(rank: number) {
  if (rank === 1) {
    return (
      <div className="flex flex-col items-center">
        <Trophy className="h-10 w-10 text-yellow-500 mb-1" />
        <span className="text-4xl font-bold text-yellow-600">1st</span>
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex flex-col items-center">
        <Medal className="h-9 w-9 text-gray-400 mb-1" />
        <span className="text-3xl font-bold text-gray-600">2nd</span>
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex flex-col items-center">
        <Medal className="h-8 w-8 text-orange-600 mb-1" />
        <span className="text-2xl font-bold text-orange-600">3rd</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center w-16">
      <span className="text-2xl font-bold text-gray-500">#{rank}</span>
    </div>
  )
}

function getRankBorderColor(rank: number) {
  if (rank === 1) return 'border-yellow-400'
  if (rank === 2) return 'border-gray-400'
  if (rank === 3) return 'border-orange-400'
  return 'border-gray-200'
}

function getRankBgColor(rank: number) {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-yellow-100'
  if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-gray-100'
  if (rank === 3) return 'bg-gradient-to-r from-orange-50 to-orange-100'
  return 'bg-white hover:bg-gray-50'
}

function getGradeColor(grade: string) {
  if (grade.startsWith('A')) return 'bg-green-100 text-green-800 border-2 border-green-500'
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800 border-2 border-blue-500'
  if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500'
  if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800 border-2 border-orange-500'
  return 'bg-red-100 text-red-800 border-2 border-red-500'
}

function getScoreColor(score: number) {
  if (score >= 100) return 'text-green-600'
  if (score >= 80) return 'text-blue-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getProgressBarColor(score: number) {
  if (score >= 100) return 'bg-green-500'
  if (score >= 80) return 'bg-blue-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'exceeding':
      return 'text-green-700'
    case 'on_track':
      return 'text-blue-700'
    case 'at_risk':
      return 'text-yellow-700'
    case 'behind':
      return 'text-red-700'
    default:
      return 'text-gray-700'
  }
}

function getBadgeStyle(rarity: string) {
  switch (rarity) {
    case 'legendary':
      return 'bg-purple-100 text-purple-800 border-purple-400'
    case 'epic':
      return 'bg-pink-100 text-pink-800 border-pink-400'
    case 'rare':
      return 'bg-blue-100 text-blue-800 border-blue-400'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-400'
  }
}
