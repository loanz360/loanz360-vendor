'use client'

import React from 'react'
import { validatePassword } from '@/lib/validation/input-validator'

interface PasswordStrengthMeterProps {
  password: string
  className?: string
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  if (!password) return null

  const validation = validatePassword(password)

  // Determine strength level
  const getStrengthLevel = (): number => {
    if (!validation.valid) return 0
    if (validation.strength === 'weak') return 1
    if (validation.strength === 'medium') return 2
    if (validation.strength === 'strong') return 3
    return 0
  }

  const strengthLevel = getStrengthLevel()
  const strengthLabels = ['', 'Weak', 'Medium', 'Strong']
  const strengthColors = [
    '',
    'bg-red-500',
    'bg-yellow-500',
    'bg-green-500'
  ]
  const strengthTextColors = [
    '',
    'text-red-500',
    'text-yellow-500',
    'text-green-500'
  ]

  // Password requirements checklist
  const requirements = [
    { met: password.length >= 8, label: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), label: 'One uppercase letter' },
    { met: /[a-z]/.test(password), label: 'One lowercase letter' },
    { met: /[0-9]/.test(password), label: 'One number' },
    { met: /[^A-Za-z0-9]/.test(password), label: 'One special character' }
  ]

  return (
    <div className={className}>
      {/* Strength bar */}
      <div className="flex gap-1 mb-2">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strengthLevel ? strengthColors[strengthLevel] : 'bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      {strengthLevel > 0 && (
        <p className={`text-xs font-medium mb-2 ${strengthTextColors[strengthLevel]}`}>
          Password strength: {strengthLabels[strengthLevel]}
        </p>
      )}

      {/* Requirements checklist */}
      <div className="space-y-1">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
              req.met ? 'bg-green-500' : 'bg-gray-700'
            }`}>
              {req.met && (
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className={req.met ? 'text-gray-400' : 'text-gray-500'}>
              {req.label}
            </span>
          </div>
        ))}
      </div>

      {/* Error message if validation fails */}
      {password.length > 0 && !validation.valid && validation.error && (
        <p className="text-xs text-red-500 mt-2">
          {validation.error}
        </p>
      )}
    </div>
  )
}
