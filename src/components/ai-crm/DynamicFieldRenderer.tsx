'use client'

import { useState } from 'react'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

export interface FieldSchema {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'email' | 'phone' | 'currency'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
}

export interface DocumentChecklistItem {
  key: string
  label: string
  required: boolean
  description?: string
  accepted_types?: string[]
}

// ============================================================================
// DynamicFieldRenderer
// ============================================================================

interface DynamicFieldRendererProps {
  fields: FieldSchema[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export default function DynamicFieldRenderer({ fields, values, onChange }: DynamicFieldRendererProps) {
  if (!fields || fields.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => (
        <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>

          {field.type === 'select' ? (
            <select
              value={(values[field.key] as string) || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            >
              <option value="" className="bg-gray-900">{field.placeholder || 'Select...'}</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-gray-900">
                  {opt.label}
                </option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              value={(values[field.key] as string) || ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
            />
          ) : (
            <input
              type={field.type === 'currency' ? 'number' : field.type === 'phone' ? 'tel' : field.type}
              value={(values[field.key] as string | number) ?? ''}
              onChange={(e) => {
                const val = field.type === 'number' || field.type === 'currency'
                  ? e.target.value ? Number(e.target.value) : ''
                  : e.target.value
                onChange(field.key, val)
              }}
              placeholder={field.placeholder}
              min={field.validation?.min}
              max={field.validation?.max}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// DocumentChecklist
// ============================================================================

interface DocumentChecklistProps {
  items: DocumentChecklistItem[]
  uploadedDocs: Record<string, { url?: string; uploaded_at?: string; name?: string }>
  onUpload: () => void
}

export function DocumentChecklist({ items, uploadedDocs, onUpload }: DocumentChecklistProps) {
  if (!items || items.length === 0) return null

  const uploadedCount = items.filter((item) => uploadedDocs[item.key]).length
  const requiredCount = items.filter((item) => item.required).length
  const requiredUploaded = items.filter((item) => item.required && uploadedDocs[item.key]).length

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span>{uploadedCount}/{items.length} uploaded</span>
        <span className={requiredUploaded === requiredCount ? 'text-green-400' : 'text-orange-400'}>
          {requiredUploaded}/{requiredCount} mandatory
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5">
        <div
          className="bg-orange-500 rounded-full h-1.5 transition-all"
          style={{ width: `${items.length > 0 ? (uploadedCount / items.length) * 100 : 0}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-2 mt-3">
        {items.map((item) => {
          const uploaded = uploadedDocs[item.key]
          return (
            <div
              key={item.key}
              className={`flex items-center justify-between p-2.5 rounded-lg border ${
                uploaded
                  ? 'border-green-500/20 bg-green-500/5'
                  : item.required
                    ? 'border-orange-500/20 bg-orange-500/5'
                    : 'border-white/10 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {uploaded ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : item.required ? (
                  <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {item.label}
                    {item.required && !uploaded && <span className="text-orange-400 ml-1">*</span>}
                  </p>
                  {uploaded?.name && (
                    <p className="text-xs text-gray-500 truncate">{uploaded.name}</p>
                  )}
                </div>
              </div>
              {!uploaded && (
                <button
                  onClick={onUpload}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 shrink-0"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
