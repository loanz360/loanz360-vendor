'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'

// Field type from profile_fields_config table
export interface ProfileField {
  id: string
  field_key: string
  field_label: string
  field_type: 'text' | 'number' | 'currency' | 'select' | 'radio' | 'date' | 'email' | 'tel'
  field_placeholder?: string
  is_required: boolean
  validation_pattern?: string
  options?: Array<{ value: string; label: string }>
  grid_columns: number // 1 = full width, 2 = half width
  help_text?: string
}

interface DynamicFieldProps {
  field: ProfileField
  value: string | number | undefined
  onChange: (value: string) => void
  error?: string
}

export default function DynamicField({
  field,
  value,
  onChange,
  error
}: DynamicFieldProps) {
  const {
    field_key,
    field_label,
    field_type,
    field_placeholder,
    is_required,
    options,
    help_text
  } = field

  // Format currency display
  const formatCurrency = (val: string): string => {
    const num = val.replace(/[^0-9]/g, '')
    if (!num) return ''
    return parseInt(num, 10).toLocaleString('en-IN')
  }

  const handleCurrencyChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '')
    onChange(cleaned)
  }

  // Common input classes
  const inputClasses = `w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
    error
      ? 'border-red-500 focus:ring-red-500/50'
      : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
  }`

  // Render different field types
  const renderField = () => {
    switch (field_type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <input
            type={field_type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field_placeholder || ''}
            className={inputClasses}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field_placeholder || ''}
            className={inputClasses}
          />
        )

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
            <input
              type="text"
              value={value ? formatCurrency(String(value)) : ''}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              placeholder={field_placeholder || 'Enter amount'}
              className={`${inputClasses} pl-10`}
            />
          </div>
        )

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
        )

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          >
            <option value="">Select {field_label}</option>
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )

      case 'radio':
        return (
          <div className="flex gap-4">
            {options?.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={field_key}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field_placeholder || ''}
            className={inputClasses}
          />
        )
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {field_label}
        {is_required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {renderField()}

      {error && (
        <div className="mt-1 flex items-center gap-1 text-sm text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}

      {help_text && !error && (
        <p className="mt-1 text-xs text-gray-500">{help_text}</p>
      )}
    </div>
  )
}
