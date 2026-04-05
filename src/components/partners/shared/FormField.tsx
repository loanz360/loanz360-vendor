'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface FormFieldOption {
  value: string
  label: string
}

interface FormFieldProps {
  label: string
  icon?: React.ElementType
  value: string | number | boolean | null | undefined
  onChange?: (value: string) => void
  isEditing: boolean
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'select' | 'textarea' | 'password'
  placeholder?: string
  disabled?: boolean
  required?: boolean
  hint?: string
  error?: string
  options?: FormFieldOption[]
  readOnly?: boolean
  maxLength?: number
  minLength?: number
  pattern?: string
  autoComplete?: string
  className?: string
  inputClassName?: string
  labelClassName?: string
  rows?: number
  min?: number | string
  max?: number | string
  step?: number | string
  suffix?: string
  prefix?: string
  showPasswordToggle?: boolean
  onBlur?: () => void
  onFocus?: () => void
  copyable?: boolean
  onCopy?: () => void
  verified?: boolean
  verificationStatus?: 'pending' | 'verified' | 'failed' | 'not_submitted'
}

export default function FormField({
  label,
  icon: Icon,
  value,
  onChange,
  isEditing,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  hint,
  error,
  options,
  readOnly = false,
  maxLength,
  minLength,
  pattern,
  autoComplete,
  className,
  inputClassName,
  labelClassName,
  rows = 3,
  min,
  max,
  step,
  suffix,
  prefix,
  onBlur,
  onFocus,
  copyable,
  onCopy,
  verified,
  verificationStatus,
}: FormFieldProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  const displayValue = value?.toString() || ''

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    onChange?.(e.target.value)
  }

  const handleCopy = () => {
    if (displayValue) {
      navigator.clipboard.writeText(displayValue)
      onCopy?.()
    }
  }

  const getVerificationBadge = () => {
    if (verified !== undefined) {
      return verified ? (
        <span className="ml-2 text-xs text-green-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Verified
        </span>
      ) : null
    }

    if (verificationStatus) {
      const statusConfig = {
        pending: { text: 'Pending', class: 'text-yellow-400' },
        verified: { text: 'Verified', class: 'text-green-400' },
        failed: { text: 'Failed', class: 'text-red-400' },
        not_submitted: { text: 'Not Submitted', class: 'text-gray-400' },
      }
      const config = statusConfig[verificationStatus]
      return (
        <span className={cn('ml-2 text-xs flex items-center gap-1', config.class)}>
          {config.text}
        </span>
      )
    }

    return null
  }

  const inputBaseClass = cn(
    'w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-lg border transition-all',
    'focus:outline-none focus:ring-2 focus:ring-orange-500 text-base',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    error ? 'border-red-500 focus:ring-red-500' : 'border-gray-700/50',
    Icon && 'pl-11',
    prefix && 'pl-16',
    suffix && 'pr-16',
    inputClassName
  )

  const renderInput = () => {
    if (!isEditing || readOnly) {
      return (
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-base font-medium',
              displayValue ? 'text-white' : 'text-gray-500 italic'
            )}
          >
            {prefix && displayValue && <span className="text-gray-400 mr-1">{prefix}</span>}
            {displayValue || 'Not provided'}
            {suffix && displayValue && <span className="text-gray-400 ml-1">{suffix}</span>}
          </p>
          {copyable && displayValue && (
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Copy to clipboard"
            >
              <svg className="w-4 h-4 text-gray-400 hover:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {getVerificationBadge()}
        </div>
      )
    }

    const inputType = type === 'password' && showPassword ? 'text' : type

    if (type === 'select' && options) {
      return (
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          )}
          <select
            value={displayValue}
            onChange={handleChange}
            disabled={disabled}
            className={inputBaseClass}
            onBlur={onBlur}
            onFocus={onFocus}
          >
            <option value="">Select {label}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    if (type === 'textarea') {
      return (
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
          )}
          <textarea
            value={displayValue}
            onChange={handleChange}
            disabled={disabled}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            minLength={minLength}
            className={cn(inputBaseClass, 'resize-none', Icon && 'pl-11')}
            onBlur={onBlur}
            onFocus={onFocus}
          />
          {maxLength && (
            <div className="text-right text-xs text-gray-500 mt-1">
              {displayValue.length} / {maxLength}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        )}
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {prefix}
          </span>
        )}
        <input
          type={inputType}
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          autoComplete={autoComplete}
          min={min}
          max={max}
          step={step}
          className={inputBaseClass}
          onBlur={onBlur}
          onFocus={onFocus}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {suffix}
          </span>
        )}
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <label className={cn('text-gray-400 text-sm flex items-center gap-2', labelClassName)}>
        {Icon && <Icon className="w-4 h-4" />}
        {label}
        {required && <span className="text-red-400">*</span>}
        {readOnly && isEditing && (
          <span className="text-xs text-gray-500 ml-1">(Read Only)</span>
        )}
      </label>
      {renderInput()}
      {hint && !error && <p className="text-gray-500 text-xs">{hint}</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

// Multi-select version for arrays
interface MultiSelectFieldProps {
  label: string
  icon?: React.ElementType
  value: string[]
  onChange?: (value: string[]) => void
  isEditing: boolean
  options: FormFieldOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  hint?: string
  error?: string
  maxSelections?: number
  className?: string
}

export function MultiSelectField({
  label,
  icon: Icon,
  value = [],
  onChange,
  isEditing,
  options,
  disabled = false,
  required = false,
  hint,
  error,
  maxSelections,
  className,
}: MultiSelectFieldProps) {
  const handleToggle = (optValue: string) => {
    if (!onChange) return

    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      if (maxSelections && value.length >= maxSelections) return
      onChange([...value, optValue])
    }
  }

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-gray-400 text-sm flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>

      {!isEditing ? (
        <p
          className={cn(
            'text-base font-medium',
            selectedLabels ? 'text-white' : 'text-gray-500 italic'
          )}
        >
          {selectedLabels || 'Not selected'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              disabled={disabled || (maxSelections && value.length >= maxSelections && !value.includes(option.value))}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                value.includes(option.value)
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                  : 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:border-gray-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {hint && !error && <p className="text-gray-500 text-xs">{hint}</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {maxSelections && isEditing && (
        <p className="text-gray-500 text-xs">
          {value.length} / {maxSelections} selected
        </p>
      )}
    </div>
  )
}

// Switch/Toggle field
interface SwitchFieldProps {
  label: string
  description?: string
  icon?: React.ElementType
  value: boolean
  onChange?: (value: boolean) => void
  isEditing: boolean
  disabled?: boolean
  className?: string
}

export function SwitchField({
  label,
  description,
  icon: Icon,
  value,
  onChange,
  isEditing,
  disabled = false,
  className,
}: SwitchFieldProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 bg-gray-800/30 rounded-lg',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-gray-700/50">
            <Icon className="w-5 h-5 text-orange-400" />
          </div>
        )}
        <div>
          <p className="text-white font-medium">{label}</p>
          {description && <p className="text-gray-400 text-sm">{description}</p>}
        </div>
      </div>
      {isEditing ? (
        <button
          type="button"
          role="switch"
          aria-checked={value}
          onClick={() => onChange?.(!value)}
          disabled={disabled}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            value ? 'bg-orange-500' : 'bg-gray-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              value ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      ) : (
        <span
          className={cn(
            'text-sm font-medium px-2 py-1 rounded',
            value
              ? 'text-green-400 bg-green-500/10'
              : 'text-gray-400 bg-gray-700/50'
          )}
        >
          {value ? 'Yes' : 'No'}
        </span>
      )}
    </div>
  )
}
