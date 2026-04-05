'use client'

import React, { useState, useEffect } from 'react'
import { Trophy, TrendingUp, Award, Zap, Target, Users, Medal, Crown, Star, Flame } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  avatar_url?: string
  total_earned: number
  active_incentives: number
  achievement_count: number
  current_tier: string
  tier_color: string
}

interface TierBadge {
  tier_code: string
  tier_name: string
  tier_icon: string
  tier_color: string
  min_points: number
  max_points: number
  reward_multiplier: number
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  earned_at: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface GamificationDashboardProps {
  userId: string
}

export default function GamificationDashboard({ userId }: GamificationDashboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [currentTier, setCurrentTier] = useState<TierBadge | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'leaderboard' | 'achievements'>('leaderboard')

  useEffect(() => {
    fetchGamificationData()
  }, [userId])

  const fetchGamificationData = async () => {
    try {
      setLoading(true)

      // Fetch leaderboard
      const leaderboardRes = await fetch(`/api/incentives/gamification/leaderboard?limit=10`)
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setLeaderboardData(data.leaderboard || [])
        setUserRank(data.userRank || null)
      }

      // Fetch user achievements
      const achievementsRes = await fetch(`/api/incentives/gamification/achievements`)
      if (achievementsRes.ok) {
        const data = await achievementsRes.json()
        setAchievements(data.achievements || [])
        setCurrentTier(data.currentTier || null)
      }
    } catch (error) {
      console.error('Error fetching gamification data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTierIcon = (tierName: string) => {
    const tierIcons: Record<string, JSX.Element> = {
      Bronze: <Medal className="w-5 h-5 text-orange-700" />,
      Silver: <Medal className="w-5 h-5 text-gray-400" />,
      Gold: <Medal className="w-5 h-5 text-yellow-400" />,
      Platinum: <Crown className="w-5 h-5 text-blue-400" />,
      Diamond: <Star className="w-5 h-5 text-purple-400" />
    }
    return tierIcons[tierName] || <Medal className="w-5 h-5" />
  }

  const getTierColor = (tierName: string) => {
    const colors: Record<string, string> = {
      Bronze: 'from-orange-700 to-orange-900',
      Silver: 'from-gray-400 to-gray-600',
      Gold: 'from-yellow-400 to-yellow-600',
      Platinum: 'from-blue-400 to-blue-600',
      Diamond: 'from-purple-400 to-purple-600'
    }
    return colors[tierName] || 'from-gray-500 to-gray-700'
  }

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: 'text-gray-400 border-gray-600',
      rare: 'text-blue-400 border-blue-600',
      epic: 'text-purple-400 border-purple-600',
      legendary: 'text-yellow-400 border-yellow-600'
    }
    return colors[rarity] || 'text-gray-400 border-gray-600'
  }

  if (loading) {
    return (
      <div className="content-card p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="h-4 bg-gray-800 rounded w-1/2"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Tier Card */}
      {currentTier && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-gradient-to-r ${getTierColor(currentTier.tier_name)} p-6 rounded-lg border-2 border-opacity-50`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-full">
                {getTierIcon(currentTier.tier_name)}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white font-poppins">
                  {currentTier.tier_name} Tier
                </h3>
                <p className="text-white/80 text-sm">
                  Reward Multiplier: {currentTier.reward_multiplier}x
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                {currentTier.min_points} - {currentTier.max_points}
              </div>
              <div className="text-white/80 text-sm">Points Range</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
        <button
          onClick={() => setSelectedTab('leaderboard')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
            selectedTab === 'leaderboard'
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="font-medium">Leaderboard</span>
        </button>
        <button
          onClick={() => setSelectedTab('achievements')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
            selectedTab === 'achievements'
              ? 'bg-orange-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span className="font-medium">Achievements</span>
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {selectedTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Your Rank Card */}
            {userRank && (
              <div className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-orange-500 text-white font-bold px-3 py-2 rounded-lg">
                      #{userRank.rank}
                    </div>
                    <div>
                      <div className="text-white font-semibold">Your Rank</div>
                      <div className="text-orange-300 text-sm">{userRank.full_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      ₹{userRank.total_earned.toLocaleString()}
                    </div>
                    <div className="text-orange-300 text-sm">Total Earned</div>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard List */}
            <div className="content-card overflow-hidden">
              <div className="p-4 bg-gray-800 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white font-poppins flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Top Performers
                </h3>
              </div>
              <div className="divide-y divide-gray-800">
                {leaderboardData.map((entry, index) => (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div
                          className={`font-bold px-3 py-2 rounded-lg ${
                            entry.rank === 1
                              ? 'bg-yellow-500 text-black'
                              : entry.rank === 2
                                ? 'bg-gray-400 text-black'
                                : entry.rank === 3
                                  ? 'bg-orange-700 text-white'
                                  : 'bg-gray-700 text-white'
                          }`}
                        >
                          #{entry.rank}
                        </div>

                        {/* User Info */}
                        <div className="flex items-center gap-3">
                          {entry.avatar_url ? (
                            <img
                              src={entry.avatar_url}
                              alt={entry.full_name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold">
                              {entry.full_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="text-white font-medium">{entry.full_name}</div>
                            <div className="text-gray-400 text-sm flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gradient-to-r ${getTierColor(entry.current_tier)}`}>
                                {getTierIcon(entry.current_tier)}
                                {entry.current_tier}
                              </span>
                              <span>{entry.achievement_count} achievements</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">
                          ₹{entry.total_earned.toLocaleString()}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {entry.active_incentives} active
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {selectedTab === 'achievements' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {achievements.length === 0 ? (
              <div className="content-card p-12 text-center">
                <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Achievements Yet</h3>
                <p className="text-gray-400">
                  Start completing incentives to earn achievements and unlock rewards!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-gray-900 border-2 ${getRarityColor(achievement.rarity)} rounded-lg p-4 hover:scale-105 transition-transform`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-4xl">{achievement.icon}</div>
                      <div
                        className={`text-xs font-semibold px-2 py-1 rounded ${getRarityColor(achievement.rarity)}`}
                      >
                        {achievement.rarity.toUpperCase()}
                      </div>
                    </div>
                    <h4 className="text-white font-semibold mb-1">{achievement.title}</h4>
                    <p className="text-gray-400 text-sm mb-2">{achievement.description}</p>
                    <div className="text-xs text-gray-500">
                      Earned {new Date(achievement.earned_at).toLocaleDateString()}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
