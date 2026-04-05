'use client'

import React from 'react'
import { IncentiveProgressBarProps } from '@/lib/types/incentive-types'

export default function IncentiveProgressBar({
  current,
  target,
  label,
  showPercentage = true,
  color = 'blue',
}: IncentiveProgressBarProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  }

  const bgColorClasses: Record<string, string> = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    red: 'bg-red-100',
    gray: 'bg-gray-700',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
  }

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-semibold text-gray-900">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      <div
        className={`w-full h-3 rounded-full ${bgColorClasses[color] || bgColorClasses.blue}`}
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Progress: ${percentage.toFixed(1)}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClasses[color] || colorClasses.blue}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-gray-500">
          {current.toLocaleString()} / {target.toLocaleString()}
        </span>
        {percentage >= 100 && (
          <span className="text-xs font-semibold text-green-600">
            ✓ Target Achieved!
          </span>
        )}
      </div>
    </div>
  )
}
