'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, File, Bell, Users, User, CreditCard, Briefcase, DollarSign, Loader2 } from 'lucide-react'

interface SearchResult {
  id: string
  type: 'loan' | 'document' | 'notification' | 'lead' | 'customer' | 'employee' | 'partner' | 'application'
  title: string
  subtitle?: string
  description?: string
  status?: string
  url: string
  icon?: string
}

interface HeaderSearchProps {
  portal: 'customer' | 'employee' | 'partner' | 'superadmin'
  placeholder?: string
  className?: string
}

const iconMap: Record<string, React.ElementType> = {
  FileText,
  File,
  Bell,
  Users,
  User,
  CreditCard,
  Briefcase,
  DollarSign
}

const statusColors: Record<string, string> = {
  // Loan/Lead statuses
  'DRAFT': 'bg-gray-500/20 text-gray-400',
  'SUBMITTED': 'bg-blue-500/20 text-blue-400',
  'UNDER_REVIEW': 'bg-yellow-500/20 text-yellow-400',
  'APPROVED': 'bg-green-500/20 text-green-400',
  'REJECTED': 'bg-red-500/20 text-red-400',
  'DISBURSED': 'bg-emerald-500/20 text-emerald-400',
  'CLOSED': 'bg-gray-500/20 text-gray-400',
  'CONVERTED': 'bg-green-500/20 text-green-400',
  'DROPPED': 'bg-red-500/20 text-red-400',
  // Lead statuses
  'NEW': 'bg-blue-500/20 text-blue-400',
  'CONTACTED': 'bg-cyan-500/20 text-cyan-400',
  'IN_PROGRESS': 'bg-yellow-500/20 text-yellow-400',
  'ASSIGNED_TO_BDE': 'bg-purple-500/20 text-purple-400',
  'PROCESSING': 'bg-orange-500/20 text-orange-400',
  'SANCTIONED': 'bg-green-500/20 text-green-400',
  // User statuses
  'ACTIVE': 'bg-green-500/20 text-green-400',
  'INACTIVE': 'bg-gray-500/20 text-gray-400',
  'SUSPENDED': 'bg-red-500/20 text-red-400',
  'PENDING_VERIFICATION': 'bg-yellow-500/20 text-yellow-400',
  'PENDING_APPROVAL': 'bg-yellow-500/20 text-yellow-400',
  // Notification statuses
  'UNREAD': 'bg-blue-500/20 text-blue-400',
  'READ': 'bg-gray-500/20 text-gray-400',
  // Payout statuses
  'PENDING': 'bg-yellow-500/20 text-yellow-400',
  'PROCESSED': 'bg-green-500/20 text-green-400',
  'FAILED': 'bg-red-500/20 text-red-400',
  // Default
  'Uploaded': 'bg-green-500/20 text-green-400'
}

const typeColors: Record<string, string> = {
  loan: 'text-blue-400',
  document: 'text-green-400',
  notification: 'text-yellow-400',
  lead: 'text-purple-400',
  customer: 'text-cyan-400',
  employee: 'text-orange-400',
  partner: 'text-pink-400',
  application: 'text-emerald-400'
}

export function HeaderSearch({ portal, placeholder = 'Search...', className = '' }: HeaderSearchProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&portal=${portal}&limit=8`)
      const data = await response.json()

      if (data.results) {
        setResults(data.results)
      } else {
        setResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [portal])

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setSelectedIndex(-1)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.length >= 2) {
      setShowDropdown(true)
      setIsLoading(true)
      debounceRef.current = setTimeout(() => {
        performSearch(value)
      }, 300)
    } else {
      setResults([])
      setShowDropdown(false)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setShowDropdown(false)
    setSearchTerm('')
    setResults([])
    router.push(result.url)
  }

  // Clear search
  const handleClear = () => {
    setSearchTerm('')
    setResults([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const getIcon = (iconName?: string) => {
    if (!iconName) return FileText
    return iconMap[iconName] || FileText
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 group-hover:text-orange-500/70 w-4 h-4 transition-colors duration-200" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
          className="bg-black/40 text-white pl-10 pr-10 py-2.5 rounded-xl w-64 text-sm
                     focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:bg-black/60
                     placeholder-gray-500 transition-all duration-300
                     border border-white/5 hover:border-orange-500/20 hover:bg-black/50"
        />
        {/* Loading or Clear button */}
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden z-[60] max-h-[400px] overflow-y-auto">
          {isLoading && results.length === 0 ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500" />
              <p className="text-gray-400 text-sm mt-2">Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = getIcon(result.icon)
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className={`w-full px-4 py-3 text-left flex items-start space-x-3 transition-colors
                      ${selectedIndex === index ? 'bg-orange-500/10' : 'hover:bg-white/5'}`}
                  >
                    <div className={`p-2 rounded-lg bg-white/5 ${typeColors[result.type] || 'text-gray-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white text-sm font-medium truncate">{result.title}</p>
                        {result.status && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[result.status] || 'bg-gray-500/20 text-gray-400'}`}>
                            {result.status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-gray-400 text-xs truncate mt-0.5">{result.subtitle}</p>
                      )}
                      {result.description && (
                        <p className="text-gray-500 text-xs truncate">{result.description}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : searchTerm.length >= 2 && !isLoading ? (
            <div className="p-4 text-center">
              <Search className="w-8 h-8 mx-auto text-gray-600 mb-2" />
              <p className="text-gray-400 text-sm">No results found for &quot;{searchTerm}&quot;</p>
              <p className="text-gray-500 text-xs mt-1">Try different keywords</p>
            </div>
          ) : null}

          {/* Search tips */}
          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
              <p className="text-gray-500 text-xs">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 text-[10px]">↑↓</kbd> Navigate
                <span className="mx-2">|</span>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 text-[10px]">Enter</kbd> Select
                <span className="mx-2">|</span>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400 text-[10px]">Esc</kbd> Close
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default HeaderSearch
