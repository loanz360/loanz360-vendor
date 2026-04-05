/**
 * Advanced Filters Component for Payout Management
 * Provides date range, multiple status, partner type, and amount range filtering
 */

'use client'

import React, { useState } from 'react'
import { Calendar, Filter, X, Save, Download } from 'lucide-react'

export interface FilterState {
  dateRange: {
    start: string | null
    end: string | null
  }
  statuses: string[]
  partnerTypes: string[]
  amountRange: {
    min: number | null
    max: number | null
  }
  productTypes: string[]
  searchQuery: string
}

interface AdvancedFiltersProps {
  onFilterChange: (filters: FilterState) => void
  onSaveFilter?: (name: string, filters: FilterState) => void
  savedFilters?: { name: string; filters: FilterState }[]
  availableStatuses: string[]
  availablePartnerTypes: string[]
  availableProducts: string[]
}

export default function AdvancedFilters({
  onFilterChange,
  onSaveFilter,
  savedFilters = [],
  availableStatuses,
  availablePartnerTypes,
  availableProducts
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: null, end: null },
    statuses: [],
    partnerTypes: [],
    amountRange: { min: null, max: null },
    productTypes: [],
    searchQuery: ''
  })
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const handleFilterUpdate = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]
    handleFilterUpdate({ statuses: newStatuses })
  }

  const handlePartnerTypeToggle = (type: string) => {
    const newTypes = filters.partnerTypes.includes(type)
      ? filters.partnerTypes.filter(t => t !== type)
      : [...filters.partnerTypes, type]
    handleFilterUpdate({ partnerTypes: newTypes })
  }

  const handleProductToggle = (product: string) => {
    const newProducts = filters.productTypes.includes(product)
      ? filters.productTypes.filter(p => p !== product)
      : [...filters.productTypes, product]
    handleFilterUpdate({ productTypes: newProducts })
  }

  const handleClearFilters = () => {
    const emptyFilters: FilterState = {
      dateRange: { start: null, end: null },
      statuses: [],
      partnerTypes: [],
      amountRange: { min: null, max: null },
      productTypes: [],
      searchQuery: ''
    }
    setFilters(emptyFilters)
    onFilterChange(emptyFilters)
  }

  const handleSaveFilter = () => {
    if (saveFilterName.trim() && onSaveFilter) {
      onSaveFilter(saveFilterName, filters)
      setSaveFilterName('')
      setShowSaveDialog(false)
    }
  }

  const handleLoadFilter = (savedFilter: { name: string; filters: FilterState }) => {
    setFilters(savedFilter.filters)
    onFilterChange(savedFilter.filters)
  }

  const activeFilterCount =
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.partnerTypes.length > 0 ? 1 : 0) +
    (filters.productTypes.length > 0 ? 1 : 0) +
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0) +
    (filters.amountRange.min || filters.amountRange.max ? 1 : 0) +
    (filters.searchQuery ? 1 : 0)

  return (
    <div className="mb-6">
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Advanced Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500 text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        )}

        {savedFilters.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Saved:</span>
            {savedFilters.map((saved, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadFilter(saved)}
                className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 rounded-lg hover:bg-blue-900/50 transition-colors"
              >
                {saved.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div className="content-card p-6 space-y-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Calendar className="w-4 h-4 inline mr-2" />
              Date Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.dateRange.start || ''}
                  onChange={(e) => handleFilterUpdate({
                    dateRange: { ...filters.dateRange, start: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.dateRange.end || ''}
                  onChange={(e) => handleFilterUpdate({
                    dateRange: { ...filters.dateRange, end: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Commission Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Commission Status
            </label>
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusToggle(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.statuses.includes(status)
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Partner Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Partner Type
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePartnerTypes.map(type => (
                <button
                  key={type}
                  onClick={() => handlePartnerTypeToggle(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.partnerTypes.includes(type)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {type === 'BUSINESS_ASSOCIATE' ? 'BA' : type === 'BUSINESS_PARTNER' ? 'BP' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Commission Amount Range
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Minimum (₹)</label>
                <input
                  type="number"
                  value={filters.amountRange.min || ''}
                  onChange={(e) => handleFilterUpdate({
                    amountRange: { ...filters.amountRange, min: e.target.value ? Number(e.target.value) : null }
                  })}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Maximum (₹)</label>
                <input
                  type="number"
                  value={filters.amountRange.max || ''}
                  onChange={(e) => handleFilterUpdate({
                    amountRange: { ...filters.amountRange, max: e.target.value ? Number(e.target.value) : null }
                  })}
                  placeholder="1000000"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Product Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Loan Product
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableProducts.map(product => (
                <button
                  key={product}
                  onClick={() => handleProductToggle(product)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    filters.productTypes.includes(product)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {product}
                </button>
              ))}
            </div>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Search (Customer Name, Lead ID, Partner Name)
            </label>
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => handleFilterUpdate({ searchQuery: e.target.value })}
              placeholder="Search..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2">
              {onSaveFilter && (
                <>
                  {!showSaveDialog ? (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save Filter
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={saveFilterName}
                        onChange={(e) => setSaveFilterName(e.target.value)}
                        placeholder="Filter name..."
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleSaveFilter}
                        disabled={!saveFilterName.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowSaveDialog(false)
                          setSaveFilterName('')
                        }}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="text-sm text-gray-400">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
