'use client'

/**
 * Advanced Admin Search Component
 *
 * Features:
 * - Multi-field text search
 * - Role and department filters
 * - Date range pickers
 * - Quick filter presets
 * - Search history
 * - Saved searches
 * - Real-time results
 */

import { useState, useEffect, useCallback } from 'react'
import {
  type SearchFilter,
  searchFilterSchema,
  searchPresets,
  describeFilter,
  isEmptyFilter,
  saveToHistory,
  getSearchHistory,
} from '@/lib/search/admin-search'

// ============================================================================
// TYPES
// ============================================================================

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilter) => void
  initialFilters?: Partial<SearchFilter>
  availableRoles?: string[]
  availableDepartments?: string[]
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AdvancedSearch({
  onSearch,
  initialFilters = {},
  availableRoles = ['super_admin', 'admin', 'manager', 'viewer'],
  availableDepartments = [],
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilter>(() =>
    searchFilterSchema.parse(initialFilters)
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchFilter[]>([])

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory())
  }, [])

  const handleSearch = useCallback(() => {
    // Save to history
    saveToHistory(filters)
    setSearchHistory(getSearchHistory())

    // Trigger search
    onSearch(filters)
  }, [filters, onSearch])

  const handleReset = () => {
    const defaultFilters = searchFilterSchema.parse({})
    setFilters(defaultFilters)
    onSearch(defaultFilters)
  }

  const applyPreset = (presetKey: string) => {
    const preset = searchPresets[presetKey]
    if (preset) {
      const newFilters = searchFilterSchema.parse(preset)
      setFilters(newFilters)
      onSearch(newFilters)
      setShowPresets(false)
    }
  }

  const applyHistoryItem = (historyFilters: SearchFilter) => {
    setFilters(historyFilters)
    onSearch(historyFilters)
    setShowHistory(false)
  }

  const updateFilter = <K extends keyof SearchFilter>(
    key: K,
    value: SearchFilter[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const toggleRole = (role: string) => {
    setFilters((prev) => {
      const currentRoles = prev.roles || []
      const newRoles = currentRoles.includes(role)
        ? currentRoles.filter((r) => r !== role)
        : [...currentRoles, role]
      return { ...prev, roles: newRoles }
    })
  }

  const toggleDepartment = (dept: string) => {
    setFilters((prev) => {
      const currentDepts = prev.departments || []
      const newDepts = currentDepts.includes(dept)
        ? currentDepts.filter((d) => d !== dept)
        : [...currentDepts, dept]
      return { ...prev, departments: newDepts }
    })
  }

  const hasActiveFilters = !isEmptyFilter(filters)

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, ID, department..."
            value={filters.query || ''}
            onChange={(e) => updateFilter('query', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Search
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          {showAdvanced ? 'Hide' : 'Filters'}
        </button>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          title="Quick Presets"
        >
          ⚡
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          title="Search History"
        >
          🕒
        </button>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Active filters:</span>
          <span className="font-medium text-gray-900">
            {describeFilter(filters)}
          </span>
          <button
            onClick={handleReset}
            className="ml-auto text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Quick Presets Dropdown */}
      {showPresets && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Quick Filters</h3>
          <div className="grid grid-cols-2 gap-2">
            <PresetButton onClick={() => applyPreset('active_admins')}>
              Active Admins
            </PresetButton>
            <PresetButton onClick={() => applyPreset('inactive_admins')}>
              Inactive Admins
            </PresetButton>
            <PresetButton onClick={() => applyPreset('recent_signups')}>
              Recent Signups
            </PresetButton>
            <PresetButton onClick={() => applyPreset('two_factor_enabled')}>
              2FA Enabled
            </PresetButton>
            <PresetButton onClick={() => applyPreset('two_factor_disabled')}>
              2FA Disabled
            </PresetButton>
            <PresetButton onClick={() => applyPreset('super_admins')}>
              Super Admins
            </PresetButton>
            <PresetButton onClick={() => applyPreset('failed_logins')}>
              Failed Logins
            </PresetButton>
            <PresetButton onClick={() => applyPreset('no_phone')}>
              No Phone
            </PresetButton>
          </div>
        </div>
      )}

      {/* Search History */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Recent Searches</h3>
          {searchHistory.length === 0 ? (
            <p className="text-sm text-gray-500">No recent searches</p>
          ) : (
            <div className="space-y-2">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={() => applyHistoryItem(item)}
                  className="w-full text-left px-3 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50"
                >
                  {describeFilter(item)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-6">
          {/* Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles
            </label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <FilterChip
                  key={role}
                  label={role.replace(/_/g, ' ')}
                  active={filters.roles?.includes(role) || false}
                  onClick={() => toggleRole(role)}
                />
              ))}
            </div>
          </div>

          {/* Departments */}
          {availableDepartments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departments
              </label>
              <div className="flex flex-wrap gap-2">
                {availableDepartments.map((dept) => (
                  <FilterChip
                    key={dept}
                    label={dept}
                    active={filters.departments?.includes(dept) || false}
                    onClick={() => toggleDepartment(dept)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex gap-2">
              <FilterChip
                label="All"
                active={filters.status === 'all'}
                onClick={() => updateFilter('status', 'all')}
              />
              <FilterChip
                label="Active"
                active={filters.status === 'active'}
                onClick={() => updateFilter('status', 'active')}
              />
              <FilterChip
                label="Inactive"
                active={filters.status === 'inactive'}
                onClick={() => updateFilter('status', 'inactive')}
              />
            </div>
          </div>

          {/* Two-Factor Authentication */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Two-Factor Authentication
            </label>
            <div className="flex gap-2">
              <FilterChip
                label="Any"
                active={filters.twoFactorEnabled === undefined}
                onClick={() => updateFilter('twoFactorEnabled', undefined)}
              />
              <FilterChip
                label="Enabled"
                active={filters.twoFactorEnabled === true}
                onClick={() => updateFilter('twoFactorEnabled', true)}
              />
              <FilterChip
                label="Disabled"
                active={filters.twoFactorEnabled === false}
                onClick={() => updateFilter('twoFactorEnabled', false)}
              />
            </div>
          </div>

          {/* Date Ranges */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Created After
              </label>
              <input
                type="date"
                value={filters.createdAfter || ''}
                onChange={(e) => updateFilter('createdAfter', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Created Before
              </label>
              <input
                type="date"
                value={filters.createdBefore || ''}
                onChange={(e) => updateFilter('createdBefore', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Additional Filters */}
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.hasPhone === true}
                onChange={(e) =>
                  updateFilter('hasPhone', e.target.checked ? true : undefined)
                }
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Has phone number</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Failed Login Attempts (minimum)
              </label>
              <input
                type="number"
                min="0"
                value={filters.failedLoginAttempts || ''}
                onChange={(e) =>
                  updateFilter(
                    'failedLoginAttempts',
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
            </div>
          </div>

          {/* Sorting */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  updateFilter('sortBy', e.target.value as unknown)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="created_at">Created Date</option>
                <option value="updated_at">Updated Date</option>
                <option value="last_login">Last Login</option>
                <option value="full_name">Name</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) =>
                  updateFilter('sortOrder', e.target.value as 'asc' | 'desc')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              onClick={handleSearch}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// FILTER CHIP
// ============================================================================

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm font-medium rounded-full border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

// ============================================================================
// PRESET BUTTON
// ============================================================================

function PresetButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
    >
      {children}
    </button>
  )
}
