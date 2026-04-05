'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Filter, Save, Trash2, ChevronDown, X } from 'lucide-react'

export interface FilterField {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'dateRange' | 'multiSelect'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface FilterValues {
  [key: string]: string | string[] | { from: string; to: string }
}

export interface FilterPreset {
  id: string
  name: string
  values: FilterValues
  createdAt: string
}

interface AdvancedFiltersProps {
  fields: FilterField[]
  values: FilterValues
  onChange: (values: FilterValues) => void
  storageKey: string // unique key for localStorage persistence
}

export default function AdvancedFilters({ fields, values, onChange, storageKey }: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [showSavePreset, setShowSavePreset] = useState(false)

  // Load presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`hr-filters-${storageKey}`)
      if (saved) setPresets(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [storageKey])

  // Save presets to localStorage
  const savePresets = useCallback((newPresets: FilterPreset[]) => {
    setPresets(newPresets)
    localStorage.setItem(`hr-filters-${storageKey}`, JSON.stringify(newPresets))
  }, [storageKey])

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      values: { ...values },
      createdAt: new Date().toISOString(),
    }
    savePresets([...presets, preset])
    setPresetName('')
    setShowSavePreset(false)
  }

  const handleLoadPreset = (preset: FilterPreset) => {
    onChange(preset.values)
  }

  const handleDeletePreset = (id: string) => {
    savePresets(presets.filter(p => p.id !== id))
  }

  const handleClearAll = () => {
    const cleared: FilterValues = {}
    fields.forEach(f => {
      if (f.type === 'multiSelect') cleared[f.key] = []
      else if (f.type === 'dateRange') cleared[f.key] = { from: '', to: '' }
      else cleared[f.key] = ''
    })
    onChange(cleared)
  }

  const activeFilterCount = Object.values(values).filter(v => {
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object' && v !== null) return (v as { from: string }).from || (v as { to: string }).to
    return v && v !== ''
  }).length

  const handleFieldChange = (key: string, value: string | string[] | { from: string; to: string }) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-3">
      {/* Toggle Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[#FF6700] text-white text-xs rounded-full min-w-[18px] text-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Presets quick access */}
        {presets.length > 0 && (
          <div className="flex items-center gap-1">
            {presets.slice(0, 3).map(preset => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset)}
                className="px-2 py-1 bg-white/5 hover:bg-[#FF6700]/10 border border-white/10 rounded text-xs text-gray-400 hover:text-[#FF6700] transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        )}

        {activeFilterCount > 0 && (
          <button onClick={handleClearAll} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filter Fields */}
      {isExpanded && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs text-gray-400">{field.label}</label>
                {field.type === 'text' && (
                  <input
                    value={(values[field.key] as string) || ''}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder || `Search ${field.label.toLowerCase()}...`}
                    className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none focus:border-[#FF6700]/50"
                  />
                )}
                {field.type === 'select' && (
                  <select
                    value={(values[field.key] as string) || ''}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white outline-none focus:border-[#FF6700]/50"
                  >
                    <option value="">All</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {field.type === 'date' && (
                  <input
                    type="date"
                    value={(values[field.key] as string) || ''}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white outline-none focus:border-[#FF6700]/50"
                  />
                )}
                {field.type === 'dateRange' && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={((values[field.key] as { from: string; to: string })?.from) || ''}
                      onChange={e => handleFieldChange(field.key, { ...(values[field.key] as { from: string; to: string } || { from: '', to: '' }), from: e.target.value })}
                      className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white outline-none focus:border-[#FF6700]/50"
                    />
                    <input
                      type="date"
                      value={((values[field.key] as { from: string; to: string })?.to) || ''}
                      onChange={e => handleFieldChange(field.key, { ...(values[field.key] as { from: string; to: string } || { from: '', to: '' }), to: e.target.value })}
                      className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white outline-none focus:border-[#FF6700]/50"
                    />
                  </div>
                )}
                {field.type === 'multiSelect' && (
                  <div className="flex flex-wrap gap-1">
                    {field.options?.map(opt => {
                      const selected = ((values[field.key] as string[]) || []).includes(opt.value)
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            const current = (values[field.key] as string[]) || []
                            handleFieldChange(field.key, selected ? current.filter(v => v !== opt.value) : [...current, opt.value])
                          }}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            selected ? 'bg-[#FF6700] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save Preset */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            {showSavePreset ? (
              <>
                <input
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="px-3 py-1 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-gray-500 outline-none"
                  onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                />
                <button onClick={handleSavePreset} className="px-2 py-1 bg-[#FF6700] text-white text-xs rounded">
                  Save
                </button>
                <button onClick={() => setShowSavePreset(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button onClick={() => setShowSavePreset(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#FF6700]">
                <Save className="w-3 h-3" /> Save as preset
              </button>
            )}

            {/* Manage presets */}
            {presets.length > 0 && !showSavePreset && (
              <div className="flex items-center gap-1 ml-auto">
                {presets.map(p => (
                  <div key={p.id} className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-xs">
                    <button onClick={() => handleLoadPreset(p)} className="text-gray-400 hover:text-white">{p.name}</button>
                    <button onClick={() => handleDeletePreset(p.id)} className="text-gray-600 hover:text-red-400" aria-label={`Delete preset ${p.name}`}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
