'use client'

import React from 'react'
import Image from 'next/image'
import { Gift, Calendar, TrendingUp, Award, Clock } from 'lucide-react'
import IncentiveProgressBar from './IncentiveProgressBar'
import { IncentiveCardProps } from '@/lib/types/incentive-types'

export default function IncentiveCard({
  incentive,
  allocation,
  showActions = false,
  onEdit,
  onDelete,
  onView,
  showProgress = false,
  compact = false,
}: IncentiveCardProps) {
  const isExpired = new Date(incentive.end_date) < new Date()
  const daysRemaining = Math.ceil(
    (new Date(incentive.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  const getStatusBadge = () => {
    const status = incentive.status
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      disabled: 'bg-yellow-100 text-yellow-800',
    }

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || colors.draft}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getIncentiveTypeBadge = () => {
    const typeColors = {
      bonus: 'bg-blue-100 text-blue-800',
      commission: 'bg-purple-100 text-purple-800',
      reward: 'bg-orange-100 text-orange-800',
      cash: 'bg-green-100 text-green-800',
      voucher: 'bg-pink-100 text-pink-800',
      gift: 'bg-yellow-100 text-yellow-800',
      travel: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800',
    }

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${typeColors[incentive.incentive_type as keyof typeof typeColors] || typeColors.other}`}
      >
        {incentive.incentive_type.charAt(0).toUpperCase() + incentive.incentive_type.slice(1)}
      </span>
    )
  }

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-orange-500" />
              <h3 className="font-semibold font-poppins">{incentive.incentive_title}</h3>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Award className="w-4 h-4" />
                {incentive.reward_currency} {incentive.reward_amount?.toLocaleString()}
              </span>
              {!isExpired && daysRemaining > 0 && (
                <span className="flex items-center gap-1 text-orange-600">
                  <Clock className="w-4 h-4" />
                  {daysRemaining} days left
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {getStatusBadge()}
            {getIncentiveTypeBadge()}
          </div>
        </div>

        {showProgress && allocation && (
          <div className="mt-3">
            <IncentiveProgressBar
              current={allocation.progress_percentage}
              target={100}
              color={allocation.progress_percentage >= 100 ? 'green' : 'blue'}
              showPercentage
            />
          </div>
        )}

        {showActions && (
          <div className="flex gap-2 mt-3">
            {onView && (
              <button
                onClick={() => onView(incentive.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
              >
                View
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(incentive.id)}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(incentive.id)}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image Banner */}
      {incentive.incentive_image_url && (
        <div className="relative w-full h-48 bg-gradient-to-r from-orange-500 to-pink-500">
          <Image
            src={incentive.incentive_image_url}
            alt={incentive.incentive_title}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2 font-poppins">{incentive.incentive_title}</h3>
            <p className="text-gray-600 text-sm line-clamp-2">{incentive.incentive_description}</p>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            {getStatusBadge()}
            {getIncentiveTypeBadge()}
          </div>
        </div>

        {/* Reward Amount */}
        <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-orange-600" />
              <span className="text-sm text-gray-600">Reward</span>
            </div>
            <span className="text-2xl font-bold text-orange-600">
              {incentive.reward_currency} {incentive.reward_amount?.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress (if allocated) */}
        {showProgress && allocation && (
          <div className="mb-4">
            <IncentiveProgressBar
              current={allocation.progress_percentage}
              target={100}
              label="Your Progress"
              color={
                allocation.progress_percentage >= 100
                  ? 'green'
                  : allocation.progress_percentage >= 50
                    ? 'blue'
                    : 'orange'
              }
              showPercentage
            />
            {allocation.earned_amount > 0 && (
              <div className="mt-2 text-sm text-green-600 font-semibold">
                💰 Earned: {incentive.reward_currency} {allocation.earned_amount.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Dates & Countdown */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Start Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(incentive.start_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">End Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(incentive.end_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Days Remaining */}
        {!isExpired && daysRemaining > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-orange-800 font-semibold">
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </span>
            </div>
          </div>
        )}

        {/* Performance Criteria */}
        {incentive.performance_criteria && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-900 font-poppins">Target Criteria</h4>
            </div>
            <div className="space-y-1 text-sm text-blue-800">
              <p>
                <span className="font-medium">Metric:</span>{' '}
                {incentive.performance_criteria.metric?.replace(/_/g, ' ')}
              </p>
              <p>
                <span className="font-medium">Target:</span>{' '}
                {incentive.performance_criteria.target_value} (
                {incentive.performance_criteria.measurement_type})
              </p>
              {incentive.performance_criteria.target_period && (
                <p>
                  <span className="font-medium">Period:</span>{' '}
                  {incentive.performance_criteria.target_period}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2">
            {onView && (
              <button
                onClick={() => onView(incentive.id)}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                View Details
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(incentive.id)}
                className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(incentive.id)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
