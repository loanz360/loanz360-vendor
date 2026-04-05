'use client'

import React from 'react'
import { Calendar, Mail, Phone, CreditCard, Hash, Percent, DollarSign } from 'lucide-react'

interface ProfileFieldDefinition {
  id: string
  field_key: string
  field_label: string
  field_type: string
  profile_type: 'INDIVIDUAL' | 'ENTITY'
  field_section: string
  is_required: boolean
  is_required_for_loan: boolean
  validation_rules: Record<string, unknown>
  options: Array<{ value: string; label: string }>
  placeholder: string | null
  help_text: string | null
  display_order: number
  depends_on: Record<string, unknown> | null
}

interface DynamicFormFieldProps {
  field: ProfileFieldDefinition
  value: unknown
  onChange: (fieldKey: string, value: unknown) => void
  error?: string
  disabled?: boolean
  formData?: Record<string, unknown> // For conditional fields
}

export default function DynamicFormField({
  field,
  value,
  onChange,
  error,
  disabled = false,
  formData = {}
}: DynamicFormFieldProps) {
  // Check if field should be visible based on depends_on
  const isVisible = () => {
    if (!field.depends_on || typeof field.depends_on !== 'object') return true

    // depends_on format: { "field_key": "expected_value" } or { "field_key": ["value1", "value2"] }
    for (const [dependentFieldKey, expectedValue] of Object.entries(field.depends_on)) {
      const dependentValue = formData[dependentFieldKey]

      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(dependentValue as string)) return false
      } else {
        if (dependentValue !== expectedValue) return false
      }
    }

    return true
  }

  if (!isVisible()) return null

  // Get validation attributes from validation_rules
  const getValidationAttrs = () => {
    const attrs: Record<string, unknown> = {}
    const rules = field.validation_rules || {}

    if (rules.min_length) attrs.minLength = rules.min_length
    if (rules.max_length) attrs.maxLength = rules.max_length
    if (rules.min_value) attrs.min = rules.min_value
    if (rules.max_value) attrs.max = rules.max_value
    if (rules.pattern) attrs.pattern = rules.pattern

    return attrs
  }

  // Render label with required indicator
  const renderLabel = () => (
    <label className="block text-sm font-medium text-gray-300 mb-2">
      {field.field_label}
      {field.is_required && <span className="text-red-400 ml-1">*</span>}
      {field.is_required_for_loan && !field.is_required && (
        <span className="text-orange-400 ml-1" title="Required for loan applications">†</span>
      )}
    </label>
  )

  // Render help text
  const renderHelpText = () => {
    if (!field.help_text) return null
    return <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
  }

  // Render error
  const renderError = () => {
    if (!error) return null
    return <p className="text-xs text-red-400 mt-1">{error}</p>
  }

  // Base input classes
  const inputClasses = `w-full px-4 py-3 bg-gray-900 border ${
    error ? 'border-red-500' : 'border-gray-800'
  } rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`

  const handleChange = (newValue: unknown) => {
    onChange(field.field_key, newValue)
  }

  // Render field based on type
  switch (field.field_type) {
    case 'text':
    case 'pan':
    case 'aadhaar':
    case 'gstin':
    case 'ifsc':
    case 'pincode':
      return (
        <div>
          {renderLabel()}
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
            disabled={disabled}
            required={field.is_required}
            className={inputClasses}
            {...getValidationAttrs()}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'email':
      return (
        <div>
          {renderLabel()}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              value={(value as string) || ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || 'email@example.com'}
              disabled={disabled}
              required={field.is_required}
              className={`${inputClasses} pl-10`}
              {...getValidationAttrs()}
            />
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'phone':
      return (
        <div>
          {renderLabel()}
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="tel"
              value={(value as string) || ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || '+91 XXXXX XXXXX'}
              disabled={disabled}
              required={field.is_required}
              className={`${inputClasses} pl-10`}
              {...getValidationAttrs()}
            />
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'number':
    case 'currency':
      return (
        <div>
          {renderLabel()}
          <div className="relative">
            {field.field_type === 'currency' && (
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            )}
            <input
              type="number"
              value={(value as number) || ''}
              onChange={(e) => handleChange(e.target.valueAsNumber)}
              placeholder={field.placeholder || '0'}
              disabled={disabled}
              required={field.is_required}
              className={field.field_type === 'currency' ? `${inputClasses} pl-10` : inputClasses}
              {...getValidationAttrs()}
            />
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'percentage':
      return (
        <div>
          {renderLabel()}
          <div className="relative">
            <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="number"
              value={(value as number) || ''}
              onChange={(e) => handleChange(e.target.valueAsNumber)}
              placeholder={field.placeholder || '0'}
              disabled={disabled}
              required={field.is_required}
              min="0"
              max="100"
              step="0.01"
              className={`${inputClasses} pr-10`}
              {...getValidationAttrs()}
            />
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'date':
    case 'year':
      return (
        <div>
          {renderLabel()}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={field.field_type === 'year' ? 'number' : 'date'}
              value={(value as string) || ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder || (field.field_type === 'year' ? 'YYYY' : 'DD/MM/YYYY')}
              disabled={disabled}
              required={field.is_required}
              className={`${inputClasses} pl-10`}
              {...getValidationAttrs()}
            />
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'select':
    case 'radio':
      return (
        <div>
          {renderLabel()}
          {field.field_type === 'select' ? (
            <select
              value={(value as string) || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              required={field.is_required}
              className={inputClasses}
            >
              <option value="">Select {field.field_label}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              {field.options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-orange-500/50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name={field.field_key}
                    value={option.value}
                    checked={value === option.value}
                    onChange={(e) => handleChange(e.target.value)}
                    disabled={disabled}
                    required={field.is_required}
                    className="w-4 h-4 text-orange-500 bg-gray-900 border-gray-700 focus:ring-orange-500"
                  />
                  <span className="text-white">{option.label}</span>
                </label>
              ))}
            </div>
          )}
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-xl hover:border-orange-500/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={disabled}
              required={field.is_required}
              className="w-5 h-5 text-orange-500 bg-gray-900 border-gray-700 rounded focus:ring-orange-500"
            />
            <div className="flex-1">
              <span className="text-white font-medium">{field.field_label}</span>
              {field.is_required && <span className="text-red-400 ml-1">*</span>}
              {field.help_text && <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>}
            </div>
          </label>
          {renderError()}
        </div>
      )

    case 'multi_select':
      return (
        <div>
          {renderLabel()}
          <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-gray-900 border border-gray-800 rounded-xl">
            {field.options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : []
                    if (e.target.checked) {
                      handleChange([...currentValues, option.value])
                    } else {
                      handleChange(currentValues.filter((v) => v !== option.value))
                    }
                  }}
                  disabled={disabled}
                  className="w-4 h-4 text-orange-500 bg-gray-900 border-gray-700 rounded focus:ring-orange-500"
                />
                <span className="text-white text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'textarea':
    case 'address':
      return (
        <div>
          {renderLabel()}
          <textarea
            value={(value as string) || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
            disabled={disabled}
            required={field.is_required}
            rows={4}
            className={inputClasses}
            {...getValidationAttrs()}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      )

    case 'file':
      return (
        <div>
          {renderLabel()}
          <input
            type="file"
            onChange={(e) => handleChange(e.target.files?.[0] || null)}
            disabled={disabled}
            required={field.is_required}
            className={`${inputClasses} file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600`}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      )

    default:
      // Fallback for unknown field types
      return (
        <div>
          {renderLabel()}
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.field_label.toLowerCase()}`}
            disabled={disabled}
            required={field.is_required}
            className={inputClasses}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      )
  }
}
