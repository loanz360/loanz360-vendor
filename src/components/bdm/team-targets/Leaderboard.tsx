'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, TrendingUp, TrendingDown, Award, Zap, Target, Star } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface LeaderboardProps {
  month: number
  year: number
}

interface LeaderboardEntry {
  rank: number
  bdeId: string
  bdeName: string
  employeeCode: string
  metrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    conversionRate: number
    currentStreak: number
  }
  achievement: {
    overallAchievement: number
  }
  status: string
  grade: string
  badges: Array<{ id: string; name: string; icon: string; rarity: string }>
  totalBadges: number
  trends: {
    overall: number
  }
}

interface CategoryRanking {
  rank: number
  bdeId: string
  bdeName: string
  employeeCode: string
  value: number
  badge: string
  percentile: number
}

interface Category {
  id: string
  name: string
  icon: string
  description: string
  unit: string
  rankings: CategoryRanking[]
}

interface Achievement {
  bdeName: string
  badgeCount: number
  recentBadges: Array<{ id: string; name: string; icon: string; earnedAt: string; rarity: string }>
}

interface Streak {
  bdeId: string
  bdeName: string
  currentStreak: number
  type: string
  icon: string
}

interface Milestone {
  bdeId: string
  bdeName: string
  type: string
  value: number
  displayValue: string
  achievedAt: string
  icon: string
}

interface Record {
  type: string
  bdeId: string
  bdeName: string
  value: number
  displayValue: string
  date: string
  icon: string
}

interface AchievementsData {
  achievements: Achievement[]
  streaks: Streak[]
  milestones: Milestone[]
  records: Record[]
}

export default function Leaderboard({ month, year }: LeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [categoryData, setCategoryData] = useState<Category[]>([])
  const [achievementsData, setAchievementsData] = useState<AchievementsData | null>(null)
  const [metric, setMetric] = useState('overall')
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useState<'overall' | 'categories' | 'achievements'>('overall')

  useEffect(() => {
    fetchLeaderboard()
  }, [month, year, metric])

  useEffect(() => {
    if (activeView === 'categories') {
      fetchCategoryRankings()
    } else if (activeView === 'achievements') {
      fetchAchievements()
    }
  }, [activeView, month, year])

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(
        `/api/bdm/team-targets/leaderboard/overall?month=${month}&year=${year}&metric=${metric}`
      )
      const data = await response.json()

      if (data.success) {
        setLeaderboardData(data.data.leaderboard)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategoryRankings = async () => {
    try {
      const response = await fetch(`/api/bdm/team-targets/leaderboard/by-category?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        setCategoryData(data.data.categories)
      }
    } catch (error) {
      console.error('Error fetching category rankings:', error)
    }
  }

  const fetchAchievements = async () => {
    try {
      const response = await fetch(`/api/bdm/team-targets/leaderboard/achievements?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        setAchievementsData(data.data)
      }
    } catch (error) {
      console.error('Error fetching achievements:', error)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />
    if (rank === 3) return <Medal className="w-6 h-6 text-orange-700" />
    return <span className="text-gray-400 font-semibold">#{rank}</span>
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-purple-600'
      case 'epic':
        return 'bg-blue-600'
      case 'rare':
        return 'bg-green-600'
      default:
        return 'bg-gray-600'
    }
  }

  if (isLoading && activeView === 'overall') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as unknown)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-900 border border-gray-800">
          <TabsTrigger
            value="overall"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Overall Rankings
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Target className="w-4 h-4 mr-2" />
            Category Leaders
          </TabsTrigger>
          <TabsTrigger
            value="achievements"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
          >
            <Award className="w-4 h-4 mr-2" />
            Achievements
          </TabsTrigger>
        </TabsList>

        {/* Overall Rankings Tab */}
        <TabsContent value="overall" className="space-y-6 mt-6">
          {/* Metric Selector */}
          <Card className="content-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Sort by:</span>
                <div className="flex gap-2">
                  {['overall', 'leads', 'conversions', 'revenue', 'streak'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        metric === m
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <div className="space-y-3">
            {leaderboardData.map((entry) => (
              <Card
                key={entry.bdeId}
                className={`content-card hover:border-orange-500/50 transition-all ${
                  entry.rank <= 3 ? 'ring-2 ring-orange-500/20' : ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-6">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-12 flex items-center justify-center">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* BDE Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white">{entry.bdeName}</h3>
                        <span className="text-sm text-gray-500">{entry.employeeCode}</span>
                        <Badge className="bg-gray-800 text-white">{entry.grade}</Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Leads: </span>
                          <span className="text-white font-semibold">{entry.metrics.leadsContacted}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Conversions: </span>
                          <span className="text-white font-semibold">{entry.metrics.conversions}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Revenue: </span>
                          <span className="text-white font-semibold">
                            ₹{(entry.metrics.revenue / 100000).toFixed(1)}L
                          </span>
                        </div>
                        {entry.metrics.currentStreak > 0 && (
                          <div>
                            <span className="text-orange-500">🔥 {entry.metrics.currentStreak} days</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Achievement */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-3xl font-bold text-orange-500 mb-1">
                        {entry.achievement.overallAchievement.toFixed(0)}%
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        {entry.trends.overall > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        <span className={entry.trends.overall > 0 ? 'text-green-500' : 'text-red-500'}>
                          {Math.abs(entry.trends.overall).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Badges */}
                    {entry.totalBadges > 0 && (
                      <div className="flex-shrink-0">
                        <div className="flex gap-1">
                          {entry.badges.slice(0, 3).map((badge) => (
                            <span key={badge.id} className="text-2xl" title={badge.name}>
                              {badge.icon}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {leaderboardData.length === 0 && (
            <Card className="content-card">
              <CardContent className="p-12 text-center">
                <p className="text-gray-400">No data available for leaderboard</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Category Rankings Tab */}
        <TabsContent value="categories" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {categoryData.map((category) => (
              <Card key={category.id} className="content-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <div>{category.name}</div>
                      <div className="text-sm text-gray-400 font-normal mt-1">{category.description}</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {category.rankings.slice(0, 5).map((ranking) => (
                      <div
                        key={ranking.bdeId}
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{ranking.badge}</span>
                          <div>
                            <div className="font-semibold text-white">{ranking.bdeName}</div>
                            <div className="text-xs text-gray-400">{ranking.employeeCode}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-orange-500">
                            {category.unit === '%'
                              ? `${ranking.value.toFixed(1)}%`
                              : category.unit === '₹'
                                ? `₹${(ranking.value / 100000).toFixed(1)}L`
                                : ranking.value.toFixed(0)}
                          </div>
                          <div className="text-xs text-gray-400">Top {ranking.percentile.toFixed(0)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {categoryData.length === 0 && (
            <Card className="content-card">
              <CardContent className="p-12 text-center">
                <p className="text-gray-400">No category data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-6 mt-6">
          {achievementsData && (
            <>
              {/* Streaks Section */}
              {achievementsData.streaks.length > 0 && (
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Zap className="w-5 h-5 text-orange-500" />
                      Active Streaks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {achievementsData.streaks.map((streak) => (
                        <div
                          key={streak.bdeId}
                          className="p-4 bg-gradient-to-br from-orange-900/20 to-gray-800/50 border border-orange-500/30 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl">{streak.icon}</span>
                            <Badge className={getRarityColor(streak.type)}>{streak.type}</Badge>
                          </div>
                          <div className="text-white font-semibold">{streak.bdeName}</div>
                          <div className="text-2xl font-bold text-orange-500 mt-2">
                            {streak.currentStreak} days
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Team Records */}
              {achievementsData.records.length > 0 && (
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Star className="w-5 h-5 text-yellow-500" />
                      Team Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {achievementsData.records.map((record, index) => (
                        <div
                          key={index}
                          className="p-4 bg-gradient-to-br from-yellow-900/20 to-gray-800/50 border border-yellow-500/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{record.icon}</span>
                            <div>
                              <div className="text-xs text-gray-400 uppercase">{record.type}</div>
                              <div className="text-white font-semibold">{record.bdeName}</div>
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-yellow-500 mb-1">{record.displayValue}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(record.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Milestones */}
              {achievementsData.milestones.length > 0 && (
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Award className="w-5 h-5 text-green-500" />
                      Recent Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {achievementsData.milestones.map((milestone, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{milestone.icon}</span>
                            <div>
                              <div className="font-semibold text-white">{milestone.bdeName}</div>
                              <div className="text-sm text-gray-400">{milestone.type}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-500">{milestone.displayValue}</div>
                            <div className="text-xs text-gray-400">
                              {new Date(milestone.achievedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Badge Collection */}
              {achievementsData.achievements.length > 0 && (
                <Card className="content-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Trophy className="w-5 h-5 text-purple-500" />
                      Badge Collection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {achievementsData.achievements.map((achievement, index) => (
                        <div key={index} className="border-t border-gray-800 pt-4 first:border-t-0 first:pt-0">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-semibold text-white">{achievement.bdeName}</div>
                            <Badge className="bg-purple-600">{achievement.badgeCount} badges</Badge>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {achievement.recentBadges.map((badge) => (
                              <div
                                key={badge.id}
                                className="px-3 py-2 bg-gray-800 rounded-lg flex items-center gap-2"
                                title={`Earned ${new Date(badge.earnedAt).toLocaleDateString()}`}
                              >
                                <span className="text-xl">{badge.icon}</span>
                                <div>
                                  <div className="text-xs text-white">{badge.name}</div>
                                  <Badge className={`${getRarityColor(badge.rarity)} text-xs`}>
                                    {badge.rarity}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!achievementsData && (
            <Card className="content-card">
              <CardContent className="p-12 text-center">
                <p className="text-gray-400">No achievements data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
