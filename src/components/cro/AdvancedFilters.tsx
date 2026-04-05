'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Search,
  Save,
  FolderOpen,
  Trash2,
  Check,
} from 'lucide-react'
import {
  CONTACT_STATUSES,
  LEAD_STATUSES,
  LEAD_STAGES,
  DEAL_STATUSES,
  DEAL_STAGES,
  LOAN_TYPES,
  formatStatusName,
  formatStageName,
  CONTACT_STATUS_LABELS,
  DEAL_STAGE_LABELS,
} from '@/lib/constants/sales-pipeline'

// ============================================================================
// Types
// ============================================================================

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'date-range' | 'number-range' | 'text'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface SavedFilter {
  id: string
  name: string
  filters: Record<string, unknown>
}

export interface AdvancedFiltersProps {
  filters: FilterConfig[]
  activeFilters: Record<string, unknown>
  onFilterChange: (filters: Record<string, unknown>) => void
  onClearAll: () => void
  savedFilters?: SavedFilter[]
  onSaveFilter?: (name: string, filters: Record<string, unknown>) => void
  onLoadFilter?: (id: string) => void
  onDeleteSavedFilter?: (id: string) => void
}

// ============================================================================
// Date range presets
// ============================================================================

const DATE_PRESETS = [
  { label: 'Today', getValue: () => { const d = new Date().toISOString().slice(0, 10); return { from: d, to: d } } },
  { label: 'This Week', getValue: () => {
    const now = new Date()
    const day = now.getDay()
    const start = new Date(now)
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }},
  { label: 'This Month', getValue: () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }},
  { label: 'Last 30 Days', getValue: () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - 30)
    return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }},
  { label: 'Custom', getValue: () => ({ from: '', to: '' }) },
] as const

// ============================================================================
// Preset Filter Configs
// ============================================================================

export const CONTACT_FILTERS: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'multi-select',
    options: CONTACT_STATUSES.map(s => ({ value: s, label: CONTACT_STATUS_LABELS[s] || formatStatusName(s) })),
  },
  { key: 'city', label: 'City', type: 'text', placeholder: 'Filter by city...' },
  { key: 'date_from', label: 'From Date', type: 'date-range' },
  { key: 'date_to', label: 'To Date', type: 'date-range' },
]

export const LEAD_FILTERS: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'multi-select',
    options: LEAD_STATUSES.map(s => ({ value: s, label: formatStatusName(s) })),
  },
  {
    key: 'stage',
    label: 'Stage',
    type: 'multi-select',
    options: LEAD_STAGES.map(s => ({ value: s, label: formatStageName(s) })),
  },
  {
    key: 'loan_type',
    label: 'Loan Type',
    type: 'multi-select',
    options: LOAN_TYPES.map(t => ({ value: t, label: t })),
  },
  { key: 'loan_amount_min', label: 'Min Amount', type: 'number-range', placeholder: '0' },
  { key: 'loan_amount_max', label: 'Max Amount', type: 'number-range', placeholder: '1,00,00,000' },
  { key: 'lead_score_min', label: 'Min Lead Score', type: 'number-range', placeholder: '0' },
  { key: 'lead_score_max', label: 'Max Lead Score', type: 'number-range', placeholder: '100' },
  { key: 'date_from', label: 'Created After', type: 'date-range' },
  { key: 'date_to', label: 'Created Before', type: 'date-range' },
]

export const DEAL_FILTERS: FilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'multi-select',
    options: DEAL_STATUSES.map(s => ({ value: s, label: formatStatusName(s) })),
  },
  {
    key: 'stage',
    label: 'Stage',
    type: 'multi-select',
    options: DEAL_STAGES.map(s => ({ value: s, label: DEAL_STAGE_LABELS[s] || formatStageName(s) })),
  },
  {
    key: 'loan_type',
    label: 'Loan Type',
    type: 'multi-select',
    options: LOAN_TYPES.map(t => ({ value: t, label: t })),
  },
  { key: 'deal_value_min', label: 'Min Deal Value', type: 'number-range', placeholder: '0' },
  { key: 'deal_value_max', label: 'Max Deal Value', type: 'number-range', placeholder: '1,00,00,000' },
  { key: 'date_from', label: 'Created After', type: 'date-range' },
]

// ============================================================================
// Helper: format INR for display in inputs
// ============================================================================

function formatINR(value: number | string | undefined): string {
  if (value === undefined || value === '' || value === null) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  return new Intl.NumberFormat('en-IN').format(num)
}

function parseINR(value: string): string {
  return value.replace(/[^0-9.]/g, '')
}

// ============================================================================
// Sub-components
// ============================================================================

/** Multi-select dropdown with checkboxes */
function MultiSelectDropdown({
  options,
  selected,
  onChange,
  label,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleValue = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white hover:border-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
      >
        <span className="truncate text-left">
          {selected.length === 0
            ? `All ${label}`
            : selected.length === 1
              ? options.find(o => o.value === selected[0])?.label || selected[0]
              : `${selected.length} selected`}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-52 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 py-1">
          {/* Select All / Deselect All */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
            <button
              type="button"
              onClick={() => onChange(options.map(o => o.value))}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleValue(opt.value)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                selected.includes(opt.value)
                  ? 'bg-orange-500 border-orange-500'
                  : 'border-gray-600'
              }`}>
                {selected.includes(opt.value) && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Date range with presets */
function DateRangeInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (val: string) => void
  label: string
}) {
  const [showPresets, setShowPresets] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPresets(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[#111] border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
          aria-label={label}
        />
      </div>
    </div>
  )
}

/** Number range input with INR formatting */
function NumberRangeInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | number | undefined
  onChange: (val: string) => void
  placeholder?: string
}) {
  const [displayValue, setDisplayValue] = useState(value ? formatINR(value) : '')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? formatINR(value) : '')
    }
  }, [value, isFocused])

  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₹</span>
      <input
        type="text"
        inputMode="numeric"
        value={isFocused ? (value?.toString() || '') : displayValue}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => {
          const raw = parseINR(e.target.value)
          onChange(raw)
        }}
        className="w-full bg-[#111] border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
        placeholder={placeholder || '0'}
      />
    </div>
  )
}

/** Lead score range slider */
function ScoreSlider({
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  min: number
  max: number
  onMinChange: (val: number) => void
  onMaxChange: (val: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <div className="flex gap-3 items-center">
        <input
          type="range"
          min={0}
          max={100}
          value={min}
          onChange={e => {
            const v = parseInt(e.target.value)
            if (v <= max) onMinChange(v)
          }}
          className="flex-1 h-1.5 rounded-full appearance-none bg-gray-700 accent-orange-500"
          aria-label="Minimum score"
        />
        <input
          type="range"
          min={0}
          max={100}
          value={max}
          onChange={e => {
            const v = parseInt(e.target.value)
            if (v >= min) onMaxChange(v)
          }}
          className="flex-1 h-1.5 rounded-full appearance-none bg-gray-700 accent-orange-500"
          aria-label="Maximum score"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdvancedFilters({
  filters,
  activeFilters,
  onFilterChange,
  onClearAll,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteSavedFilter,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Count active filters (non-empty values)
  const activeCount = Object.entries(activeFilters).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'number') return true
    return v !== undefined && v !== null
  }).length

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
        setSaveDialogOpen(false)
        setSavedFiltersOpen(false)
      }
    }
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsExpanded(false)
        setSaveDialogOpen(false)
        setSavedFiltersOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const updateFilter = useCallback((key: string, value: unknown) => {
    const updated = { ...activeFilters, [key]: value }
    // Remove empty values
    if (value === '' || value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      delete updated[key]
    }
    onFilterChange(updated)
  }, [activeFilters, onFilterChange])

  const removeFilter = useCallback((key: string) => {
    const updated = { ...activeFilters }
    delete updated[key]
    onFilterChange(updated)
  }, [activeFilters, onFilterChange])

  const handleSaveFilter = () => {
    if (filterName.trim() && onSaveFilter) {
      onSaveFilter(filterName.trim(), activeFilters)
      setFilterName('')
      setSaveDialogOpen(false)
    }
  }

  // Build display label for active filter pills
  const getFilterPillLabel = (key: string, value: unknown): string => {
    const config = filters.find(f => f.key === key)
    const label = config?.label || key.replace(/_/g, ' ')

    if (Array.isArray(value)) {
      if (config?.options) {
        const labels = value.map(v => config.options?.find(o => o.value === v)?.label || v)
        return `${label}: ${labels.join(', ')}`
      }
      return `${label}: ${value.join(', ')}`
    }
    if (typeof value === 'number') {
      if (key.includes('amount') || key.includes('value')) {
        return `${label}: ₹${formatINR(value)}`
      }
      if (key.includes('score')) {
        return `${label}: ${value}`
      }
      return `${label}: ${value}`
    }
    if (typeof value === 'string') {
      return `${label}: ${value}`
    }
    return `${label}: ${String(value)}`
  }

  const renderFilterInput = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'multi-select': {
        const selected = (activeFilters[filter.key] as string[]) || []
        return (
          <MultiSelectDropdown
            options={filter.options || []}
            selected={selected}
            onChange={vals => updateFilter(filter.key, vals)}
            label={filter.label}
          />
        )
      }

      case 'select': {
        const value = (activeFilters[filter.key] as string) || ''
        return (
          <select
            value={value}
            onChange={e => updateFilter(filter.key, e.target.value)}
            className="w-full bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
          >
            <option value="">All</option>
            {filter.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      }

      case 'date-range': {
        const value = (activeFilters[filter.key] as string) || ''
        return (
          <DateRangeInput
            value={value}
            onChange={val => updateFilter(filter.key, val)}
            label={filter.label}
          />
        )
      }

      case 'number-range': {
        const value = activeFilters[filter.key]
        // Check if it's a lead_score field to show slider
        if (filter.key === 'lead_score_min' || filter.key === 'lead_score_max') {
          return (
            <NumberRangeInput
              value={value as string | number | undefined}
              onChange={val => updateFilter(filter.key, val)}
              placeholder={filter.placeholder}
            />
          )
        }
        return (
          <NumberRangeInput
            value={value as string | number | undefined}
            onChange={val => updateFilter(filter.key, val)}
            placeholder={filter.placeholder}
          />
        )
      }

      case 'text': {
        const value = (activeFilters[filter.key] as string) || ''
        return (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              value={value}
              onChange={e => updateFilter(filter.key, e.target.value)}
              className="w-full bg-[#111] border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
              placeholder={filter.placeholder || `Search ${filter.label.toLowerCase()}...`}
            />
          </div>
        )
      }

      default:
        return null
    }
  }

  // Check for lead_score pair to render slider
  const hasLeadScore = filters.some(f => f.key === 'lead_score_min') && filters.some(f => f.key === 'lead_score_max')
  const leadScoreMin = (activeFilters['lead_score_min'] as number) || 0
  const leadScoreMax = (activeFilters['lead_score_max'] as number) || 100

  // Filter out lead_score fields from main render if we show a slider
  const displayFilters = hasLeadScore
    ? filters.filter(f => f.key !== 'lead_score_min' && f.key !== 'lead_score_max')
    : filters

  return (
    <div className="space-y-3">
      {/* Filter Trigger Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div ref={panelRef} className="relative">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-orange-500/50 transition-colors"
            aria-expanded={isExpanded}
            aria-label={`Filters${activeCount > 0 ? `, ${activeCount} active` : ''}`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium">
                {activeCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>

          {/* Expanded Filter Panel */}
          {isExpanded && (
            <div className="absolute top-full left-0 mt-2 w-[460px] max-w-[95vw] md:max-w-[460px] bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-white font-poppins">Advanced Filters</h3>
                <div className="flex items-center gap-2">
                  {/* Date Presets */}
                  {(filters.some(f => f.type === 'date-range')) && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const menu = e.currentTarget.nextElementSibling
                          if (menu) menu.classList.toggle('hidden')
                        }}
                        className="text-xs text-gray-400 hover:text-orange-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                      >
                        <Calendar className="h-3 w-3" />
                        Presets
                      </button>
                      <div className="hidden absolute right-0 top-full mt-1 w-36 bg-[#222] border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                        {DATE_PRESETS.filter(p => p.label !== 'Custom').map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const vals = preset.getValue()
                              const updated = { ...activeFilters }
                              if (vals.from) updated['date_from'] = vals.from
                              if (vals.to) updated['date_to'] = vals.to
                              onFilterChange(updated)
                              // Close preset menu
                              const menu = (e.currentTarget.parentElement)
                              if (menu) menu.classList.add('hidden')
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeCount > 0 && (
                    <button
                      onClick={() => { onClearAll(); }}
                      className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Fields */}
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Group filters in pairs for 2-column layout on wider panels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayFilters.map(filter => (
                    <div key={filter.key} className={`space-y-1.5 ${
                      filter.type === 'multi-select' ? 'sm:col-span-2' : ''
                    }`}>
                      <label className="text-xs text-gray-400 font-medium">{filter.label}</label>
                      {renderFilterInput(filter)}
                    </div>
                  ))}
                </div>

                {/* Lead Score Slider */}
                {hasLeadScore && (
                  <div className="space-y-1.5 border-t border-gray-700/50 pt-4">
                    <label className="text-xs text-gray-400 font-medium">
                      Lead Score Range: {leadScoreMin} - {leadScoreMax}
                    </label>
                    <ScoreSlider
                      min={leadScoreMin}
                      max={leadScoreMax}
                      onMinChange={v => updateFilter('lead_score_min', v)}
                      onMaxChange={v => updateFilter('lead_score_max', v)}
                    />
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                <div className="flex items-center gap-2">
                  {/* Save Filter */}
                  {onSaveFilter && (
                    <div className="relative">
                      {saveDialogOpen ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={filterName}
                            onChange={e => setFilterName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveFilter() }}
                            placeholder="Filter name..."
                            className="w-32 bg-[#111] border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-orange-500 outline-none"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveFilter}
                            disabled={!filterName.trim()}
                            className="p-1 text-orange-400 hover:text-orange-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setSaveDialogOpen(false); setFilterName('') }}
                            className="p-1 text-gray-400 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSaveDialogOpen(true)}
                          disabled={activeCount === 0}
                          className="text-xs text-gray-400 hover:text-orange-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                      )}
                    </div>
                  )}

                  {/* Load Saved Filters */}
                  {onLoadFilter && savedFilters.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setSavedFiltersOpen(!savedFiltersOpen)}
                        className="text-xs text-gray-400 hover:text-orange-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors"
                      >
                        <FolderOpen className="h-3 w-3" />
                        Saved ({savedFilters.length})
                      </button>
                      {savedFiltersOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-52 bg-[#222] border border-gray-700 rounded-lg shadow-xl z-50 py-1 max-h-40 overflow-y-auto">
                          {savedFilters.map(sf => (
                            <div key={sf.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5 group">
                              <button
                                onClick={() => {
                                  onLoadFilter(sf.id)
                                  setSavedFiltersOpen(false)
                                }}
                                className="flex-1 text-left text-xs text-gray-300 hover:text-white truncate"
                              >
                                {sf.name}
                              </button>
                              {onDeleteSavedFilter && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteSavedFilter(sf.id)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400 transition-opacity"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-500 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Active filter count text */}
        {activeCount > 0 && !isExpanded && (
          <span className="text-xs text-gray-400">
            {activeCount} filter{activeCount !== 1 ? 's' : ''} applied
          </span>
        )}
      </div>

      {/* Active Filter Pills */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(activeFilters).map(([key, value]) => {
            // Skip empty values
            if (Array.isArray(value) && value.length === 0) return null
            if (value === '' || value === undefined || value === null) return null
            // Skip default score values
            if (key === 'lead_score_min' && value === 0) return null
            if (key === 'lead_score_max' && value === 100) return null

            return (
              <button
                key={key}
                onClick={() => removeFilter(key)}
                className="group flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full text-xs text-orange-300 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300 transition-colors"
                title={`Remove ${key} filter`}
              >
                <span className="truncate max-w-[200px]">{getFilterPillLabel(key, value)}</span>
                <X className="h-3 w-3 flex-shrink-0 opacity-60 group-hover:opacity-100" />
              </button>
            )
          })}
          <button
            onClick={onClearAll}
            className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded hover:bg-white/5 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
