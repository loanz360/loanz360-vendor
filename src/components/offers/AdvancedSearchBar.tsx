'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, X, Filter, TrendingUp, Loader2 } from 'lucide-react'
import { debounce } from '@/lib/utils/debounce'

// Sanitize input to prevent XSS
function sanitizeSearchInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 200) // Limit length
}

interface SearchSuggestion {
  suggestion: string
  category: 'offer' | 'bank' | 'type'
  frequency: number
}

interface SearchFilters {
  banks?: string[]
  types?: string[]
  states?: string[]
  status?: string
  min_date?: string
  max_date?: string
  fuzzy?: boolean
}

interface AdvancedSearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void
  placeholder?: string
  showFilters?: boolean
  availableBanks?: string[]
  availableTypes?: string[]
  availableStates?: string[]
  className?: string
}

export default function AdvancedSearchBar({
  onSearch,
  placeholder = 'Search offers by title, bank, or type...',
  showFilters = true,
  availableBanks = [],
  availableTypes = [],
  availableStates = [],
  className = ''
}: AdvancedSearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const [filters, setFilters] = useState<SearchFilters>({
    fuzzy: true,
    status: 'active'
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Store abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch autocomplete suggestions with abort support
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    setIsLoadingSuggestions(true)
    try {
      const sanitizedQuery = sanitizeSearchInput(searchQuery)
      const response = await fetch(
        `/api/offers/search?q=${encodeURIComponent(sanitizedQuery)}&suggestions=true&limit=8`,
        { signal: abortControllerRef.current.signal }
      )
      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (error) {
      // Don't log abort errors
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to fetch suggestions:', error)
      }
      setSuggestions([])
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  // Create debounced function once using useMemo to prevent memory leak
  const debouncedFetchSuggestions = useMemo(
    () => debounce((q: string) => fetchSuggestions(q), 300),
    [fetchSuggestions]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending debounced calls
      if (debouncedFetchSuggestions.cancel) {
        debouncedFetchSuggestions.cancel()
      }
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [debouncedFetchSuggestions])

  // Handle query change
  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (value.length >= 2) {
      setShowSuggestions(true)
      debouncedFetchSuggestions(value)
    } else {
      setShowSuggestions(false)
      setSuggestions([])
    }
  }

  // Handle search execution
  const executeSearch = useCallback(() => {
    setShowSuggestions(false)
    setIsSearching(true)
    onSearch(query, filters)
    setTimeout(() => setIsSearching(false), 500)
  }, [query, filters, onSearch])

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    onSearch(suggestion, filters)
  }

  // Handle filter change
  const handleFilterChange = (key: keyof SearchFilters, value: SearchFilters[keyof SearchFilters]) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch()
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Clear search
  const clearSearch = () => {
    setQuery('')
    setSuggestions([])
    setShowSuggestions(false)
    setFilters({ fuzzy: true, status: 'active' })
    onSearch('', { fuzzy: true, status: 'active' })
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get category badge color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'bank': return 'bg-blue-500/20 text-blue-400'
      case 'type': return 'bg-purple-500/20 text-purple-400'
      case 'offer': return 'bg-green-500/20 text-green-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className={`relative w-full ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyPress}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-32 py-3.5 bg-white/5 border border-white/10 rounded-lg
                   text-white placeholder-gray-400 focus:outline-none focus:ring-2
                   focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              onClick={clearSearch}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {showFilters && (
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`p-2 rounded-lg transition-colors ${
                showFiltersPanel
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              title="Advanced filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={executeSearch}
            disabled={isSearching}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500
                     text-white rounded-lg font-medium hover:from-blue-600
                     hover:to-purple-600 transition-all disabled:opacity-50
                     disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>

      {/* Autocomplete Suggestions */}
      {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-white/10
                   rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
        >
          {isLoadingSuggestions ? (
            <div className="p-4 text-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-white/10 text-xs text-gray-400 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.suggestion)}
                  className="w-full px-4 py-3 hover:bg-white/5 transition-colors
                           text-left flex items-center justify-between group"
                >
                  <span className="text-white group-hover:text-blue-400 transition-colors">
                    {suggestion.suggestion}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(suggestion.category)}`}>
                      {suggestion.category}
                    </span>
                    {suggestion.frequency > 1 && (
                      <span className="text-xs text-gray-500">
                        {suggestion.frequency}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && showFiltersPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-white/10
                      rounded-lg shadow-xl z-40 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Bank Filter */}
            {availableBanks.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Banks
                </label>
                <select
                  multiple
                  value={filters.banks || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    handleFilterChange('banks', selected.length > 0 ? selected : undefined)
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  size={4}
                >
                  {availableBanks.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Type Filter */}
            {availableTypes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Offer Types
                </label>
                <select
                  multiple
                  value={filters.types || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    handleFilterChange('types', selected.length > 0 ? selected : undefined)
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  size={4}
                >
                  {availableTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}

            {/* States Filter */}
            {availableStates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  States
                </label>
                <select
                  multiple
                  value={filters.states || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    handleFilterChange('states', selected.length > 0 ? selected : undefined)
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg
                           text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  size={4}
                >
                  {availableStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Fuzzy Search Toggle */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.fuzzy || false}
                  onChange={(e) => handleFilterChange('fuzzy', e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-white/5 border-white/10 rounded
                           focus:ring-2 focus:ring-blue-500/50"
                />
                <span className="text-sm text-gray-300">
                  Enable fuzzy matching (typo tolerance)
                </span>
              </label>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => {
                setFilters({ fuzzy: true, status: 'active' })
                setShowFiltersPanel(false)
              }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear Filters
            </button>
            <button
              onClick={() => {
                setShowFiltersPanel(false)
                executeSearch()
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium
                       hover:bg-blue-600 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
