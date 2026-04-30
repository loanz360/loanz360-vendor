'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Target, Users, Clock, Award, TrendingUp, Medal } from 'lucide-react'

interface TeamChallengesProps {
  status?: 'active' | 'completed' | 'all'
}

export function TeamChallengesComponent({ status = 'active' }: TeamChallengesProps) {
  const [selectedStatus, setSelectedStatus] = useState(status)

  const { data, isLoading } = useQuery({
    queryKey: ['team-challenges', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus !== 'all' ? `?status=${selectedStatus}` : ''
      const res = await fetch(`/api/bdm/team-targets/challenges${params}`)
      if (!res.ok) throw new Error('Failed to fetch challenges')
      return res.json()
    },
  })

  const challenges = data?.data?.challenges || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'completed': return 'bg-blue-100 text-blue-700'
      case 'expired': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getChallengeTypeIcon = (type: string) => {
    switch (type) {
      case 'individual': return <Target className="w-5 h-5" />
      case 'team': return <Users className="w-5 h-5" />
      case 'head_to_head': return <Trophy className="w-5 h-5" />
      default: return <Award className="w-5 h-5" />
    }
  }

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0
    return Math.min(Math.round((current / target) * 100), 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500'
    if (percentage >= 75) return 'bg-blue-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedStatus('active')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setSelectedStatus('completed')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          All Challenges
        </button>
      </div>

      {/* Challenges List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : challenges.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-gray-900 mb-2">No Challenges Found</h3>
            <p className="text-gray-600">
              {selectedStatus === 'active'
                ? 'There are no active challenges at the moment.'
                : 'No challenges match the selected filter.'}
            </p>
          </div>
        ) : (
          challenges.map((challenge: unknown) => {
            const progress = calculateProgress(
              challenge.current_value || 0,
              challenge.target_value || 0
            )
            const daysRemaining = getDaysRemaining(challenge.end_date)
            const isActive = challenge.status === 'active'

            return (
              <div key={challenge.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      {getChallengeTypeIcon(challenge.challenge_type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{challenge.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{challenge.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(challenge.status)}`}>
                          {challenge.status}
                        </span>
                        <span className="text-xs text-gray-600 capitalize">
                          {challenge.challenge_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {challenge.reward_badge_id && (
                    <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-lg">
                      <Award className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-700">Badge Reward</span>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-bold text-gray-900">
                      {challenge.current_value || 0} / {challenge.target_value || 0} {challenge.metric_type}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${getProgressColor(progress)} transition-all duration-300`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-600">{progress}% complete</span>
                    {isActive && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="w-3 h-3" />
                        {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Leaderboard/Participants */}
                {challenge.participants && challenge.participants.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Medal className="w-4 h-4" />
                      Leaderboard
                    </h4>
                    <div className="space-y-2">
                      {challenge.participants
                        .sort((a: unknown, b: unknown) => (b.current_value || 0) - (a.current_value || 0))
                        .slice(0, 5)
                        .map((participant: unknown, index: number) => {
                          const participantProgress = calculateProgress(
                            participant.current_value || 0,
                            challenge.target_value || 0
                          )

                          return (
                            <div
                              key={participant.id}
                              className={`flex items-center gap-3 p-2 rounded ${
                                index === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                              }`}
                            >
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  index === 0
                                    ? 'bg-yellow-400 text-yellow-900'
                                    : index === 1
                                    ? 'bg-gray-300 text-gray-700'
                                    : index === 2
                                    ? 'bg-orange-300 text-orange-900'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">
                                    {participant.bde?.full_name || 'BDE'}
                                  </span>
                                  <span className="text-sm font-bold">
                                    {participant.current_value || 0} {challenge.metric_type}
                                  </span>
                                </div>
                                <div className="w-full bg-white rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${getProgressColor(participantProgress)}`}
                                    style={{ width: `${participantProgress}%` }}
                                  />
                                </div>
                              </div>
                              {participant.is_winner && (
                                <Trophy className="w-4 h-4 text-yellow-600" />
                              )}
                            </div>
                          )
                        })}
                    </div>
                    {challenge.participants.length > 5 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        +{challenge.participants.length - 5} more participants
                      </p>
                    )}
                  </div>
                )}

                {/* Footer Info */}
                <div className="border-t pt-4 mt-4 flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-4">
                    <span>
                      Started: {new Date(challenge.start_date).toLocaleDateString()}
                    </span>
                    <span>
                      Ends: {new Date(challenge.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  {challenge.completion_percentage !== undefined && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span className="font-medium">
                        {challenge.completion_percentage}% team completion
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Stats Summary */}
      {challenges.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium">Total Challenges</span>
            </div>
            <p className="text-2xl font-bold">{challenges.length}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Active Participants</span>
            </div>
            <p className="text-2xl font-bold">
              {challenges.reduce(
                (sum: number, c: unknown) => sum + (c.participants?.length || 0),
                0
              )}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold">
              {challenges.filter((c: unknown) => c.status === 'completed').length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
