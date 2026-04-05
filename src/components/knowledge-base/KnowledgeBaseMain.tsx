'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import {
  KB_CATEGORIES,
  KB_FAQS,
  KB_GLOSSARY,
  searchKnowledgeBase,
  getPopularFAQs
} from '@/lib/knowledge-base'
import type { KBCategory, KBFAQ, KBGlossaryTerm } from '@/types/knowledge-base'
import { COMPANY_INFO } from '@/lib/constants/theme'

// Custom hook for debounced search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Icons for categories
const CategoryIcons: Record<string, React.FC<{ className?: string }>> = {
  'user-dollar': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18v-2m0-4v-2m3 4h-6" />
    </svg>
  ),
  briefcase: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  'building-columns': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  home: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  car: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 01-2-2V9a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2M8 17v2a1 1 0 001 1h1a1 1 0 001-1v-2m4 0v2a1 1 0 001 1h1a1 1 0 001-1v-2M5 11l2-4h10l2 4" />
    </svg>
  ),
  'graduation-cap': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  coins: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  building: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  landmark: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  'chart-line': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  percent: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7a2 2 0 100 4 2 2 0 000-4zM15 13a2 2 0 100 4 2 2 0 000-4zM19 5L5 19" />
    </svg>
  ),
  'file-text': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  calculator: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  'shield-check': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  receipt: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  scale: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  smartphone: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  handshake: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  ),
  users: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

// Default icon for missing icons
const DefaultIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)

interface KnowledgeBaseMainProps {
  basePath: string
  userRole?: string
  theme?: 'default' | 'orange' | 'blue'
}

export function KnowledgeBaseMain({ basePath, userRole, theme = 'default' }: KnowledgeBaseMainProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'categories' | 'faqs' | 'glossary'>('categories')

  // Determine theme based on userRole if not explicitly provided
  const effectiveTheme = theme !== 'default' ? theme :
    (userRole === 'partner' || userRole === 'employee') ? 'orange' : 'blue'

  // Theme-based gradient classes
  const heroGradient = effectiveTheme === 'orange'
    ? 'from-orange-600 via-orange-500 to-amber-500'
    : 'from-blue-600 via-blue-500 to-cyan-500'

  const tabActiveClass = effectiveTheme === 'orange'
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'

  const primaryButtonClass = effectiveTheme === 'orange'
    ? 'bg-orange-600 hover:bg-orange-700'
    : 'bg-blue-600 hover:bg-blue-700'
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Debounce the search query by 300ms
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Filter categories based on user role
  const visibleCategories = useMemo(() => {
    return KB_CATEGORIES.filter(cat => {
      if (!userRole) return true
      if (userRole === 'customer' && cat.metadata.targetAudience.includes('customers')) return true
      if (userRole === 'partner' && cat.metadata.targetAudience.includes('partners')) return true
      if (userRole === 'employee' && cat.metadata.targetAudience.includes('employees')) return true
      return false
    })
  }, [userRole])

  // Category section boundaries based on slug identifiers
  const BANKING_KNOWLEDGE_START = useMemo(() => {
    const idx = visibleCategories.findIndex(cat => cat.slug === 'banking-basics')
    return idx >= 0 ? idx : 8
  }, [visibleCategories])

  const USER_GUIDES_START = useMemo(() => {
    const idx = KB_CATEGORIES.findIndex(cat => cat.slug === 'partner-guide')
    return idx >= 0 ? idx : 17
  }, [])

  // Loan product categories: from start up to banking knowledge
  const loanProductCategories = useMemo(() => {
    return visibleCategories.slice(0, BANKING_KNOWLEDGE_START)
  }, [visibleCategories, BANKING_KNOWLEDGE_START])

  // Banking knowledge categories: from banking-basics up to user guides
  const bankingKnowledgeCategories = useMemo(() => {
    const bankingStart = visibleCategories.findIndex(cat => cat.slug === 'banking-basics')
    if (bankingStart < 0) return []
    const guidesStart = visibleCategories.findIndex(cat => cat.slug === 'partner-guide' || cat.slug === 'customer-guide' || cat.slug === 'employee-guide')
    return guidesStart >= 0
      ? visibleCategories.slice(bankingStart, guidesStart)
      : visibleCategories.slice(bankingStart)
  }, [visibleCategories])

  // Filter User Guide categories based on portal type
  const userGuideCategories = useMemo(() => {
    // Get categories from user guides section onwards
    const guideCategories = KB_CATEGORIES.slice(USER_GUIDES_START)

    if (!userRole) return guideCategories

    return guideCategories.filter(cat => {
      // Partner Guide only for partners
      if (cat.slug === 'partner-guide') {
        return userRole === 'partner'
      }
      // Customer Guide only for customers
      if (cat.slug === 'customer-guide') {
        return userRole === 'customer'
      }
      // Employee Guide only for employees
      if (cat.slug === 'employee-guide') {
        return userRole === 'employee'
      }
      return true
    })
  }, [userRole, USER_GUIDES_START])

  // Search results with loading state
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return null
    return searchKnowledgeBase(debouncedSearchQuery, {
      includeCategories: true,
      includeFAQs: true,
      includeGlossary: true,
      limit: 5
    })
  }, [debouncedSearchQuery])

  // Track loading state when search query changes
  useEffect(() => {
    if (searchQuery && searchQuery !== debouncedSearchQuery) {
      setIsSearching(true)
    } else {
      setIsSearching(false)
    }
  }, [searchQuery, debouncedSearchQuery])

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Computed stats
  const totalFAQCount = KB_FAQS.length
  const totalGlossaryCount = KB_GLOSSARY.length

  // Popular FAQs
  const popularFAQs = useMemo(() => getPopularFAQs(6), [])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setShowSearchResults(e.target.value.length > 0)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setShowSearchResults(false)
    searchInputRef.current?.focus()
  }, [])

  const getIconComponent = (iconName: string) => {
    return CategoryIcons[iconName] || DefaultIcon
  }

  return (
    <div className="bg-black">
      {/* Hero Section with Search */}
      <div className={`relative bg-gradient-to-r ${heroGradient} overflow-hidden`}>
        <div className="absolute inset-0 bg-grid-white/[0.1] bg-[size:20px_20px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Knowledge Base
            </h1>
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-8">
              Your comprehensive guide to loans, banking terminology, and financial knowledge.
              Find answers to all your questions instantly.
            </p>

            {/* Search Bar */}
            <div ref={searchContainerRef} className="max-w-2xl mx-auto relative">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for topics, terms, or questions..."
                  value={searchQuery}
                  onChange={handleSearch}
                  aria-label="Search knowledge base"
                  aria-describedby="search-help"
                  aria-expanded={showSearchResults}
                  aria-controls="search-results"
                  role="combobox"
                  autoComplete="off"
                  className="w-full px-6 py-4 pl-14 text-lg rounded-2xl border-0 shadow-xl focus:ring-4 focus:ring-white/30 bg-white/95 backdrop-blur text-gray-900 placeholder-gray-500"
                />
                <span id="search-help" className="sr-only">
                  Search through categories, FAQs, and glossary terms. Results will appear below.
                </span>
                {isSearching ? (
                  <div className="absolute left-5 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : (
                  <svg
                    className="absolute left-5 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div
                  id="search-results"
                  role="listbox"
                  aria-label="Search results"
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                >
                  {isSearching ? (
                    <div className="p-6 text-center">
                      <div className="inline-flex items-center gap-2 text-gray-500">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Searching...
                      </div>
                    </div>
                  ) : searchResults && searchResults.categories.length === 0 &&
                   searchResults.faqs.length === 0 &&
                   searchResults.glossary.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No results found for &ldquo;<strong>{searchQuery.replace(/[<>]/g, '')}</strong>&rdquo;</p>
                      <p className="text-sm mt-1">Try different keywords or check spelling</p>
                    </div>
                  ) : searchResults && (
                    <div className="max-h-96 overflow-y-auto">
                      {/* Categories Results */}
                      {searchResults.categories.length > 0 && (
                        <div className="p-3 border-b border-gray-100">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Categories</h4>
                          {searchResults.categories.map(cat => {
                            const IconComponent = getIconComponent(cat.icon)
                            return (
                              <Link
                                key={cat.id}
                                href={`${basePath}/category/${cat.slug}`}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                                onClick={clearSearch}
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${cat.color}20` }}
                                >
                                  <IconComponent className="w-4 h-4" style={{ color: cat.color }} />
                                </div>
                                <span className="text-gray-900 font-medium">{cat.name}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}

                      {/* FAQ Results */}
                      {searchResults.faqs.length > 0 && (
                        <div className="p-3 border-b border-gray-100">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">FAQs</h4>
                          {searchResults.faqs.map(faq => (
                            <Link
                              key={faq.id}
                              href={`${basePath}/faq/${faq.id}`}
                              className="block px-3 py-2 hover:bg-gray-50 rounded-lg"
                              onClick={clearSearch}
                            >
                              <span className="text-gray-900">{faq.question}</span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Glossary Results */}
                      {searchResults.glossary.length > 0 && (
                        <div className="p-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Glossary</h4>
                          {searchResults.glossary.map(term => (
                            <Link
                              key={term.id}
                              href={`${basePath}/glossary?letter=${encodeURIComponent(term.firstLetter)}&term=${encodeURIComponent(term.term)}`}
                              className="block px-3 py-2 hover:bg-gray-50 rounded-lg"
                              onClick={clearSearch}
                            >
                              <span className="text-gray-900 font-medium">{term.term}</span>
                              <span className="text-gray-500 text-sm ml-2">- {term.shortDefinition}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap justify-center gap-8 mt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{KB_CATEGORIES.length}</div>
                <div className="text-white/70 text-sm">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{totalFAQCount}</div>
                <div className="text-white/70 text-sm">FAQs</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{totalGlossaryCount}</div>
                <div className="text-white/70 text-sm">Terms</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-orange-500/20" aria-label="Knowledge base sections">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 py-2" role="tablist" aria-label="Content sections">
            {[
              { id: 'categories', label: 'Browse Categories', icon: 'grid' },
              { id: 'faqs', label: 'Popular FAQs', icon: 'question' },
              { id: 'glossary', label: 'Glossary', icon: 'book' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
                  effectiveTheme === 'orange' ? "focus:ring-orange-500" : "focus:ring-blue-500",
                  activeTab === tab.id
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'categories' && (
          <div
            role="tabpanel"
            id="categories-panel"
            aria-labelledby="categories-tab"
            tabIndex={0}
          >
            {/* Loan Products Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-1 h-8 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                Loan Products
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {loanProductCategories.map((category) => {
                  const IconComponent = getIconComponent(category.icon)
                  return (
                    <Link
                      key={category.id}
                      href={`${basePath}/category/${category.slug}`}
                      className="group relative bg-gray-900 rounded-2xl hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 overflow-hidden border border-orange-500/20 hover:border-orange-500/40"
                    >
                      {/* Content */}
                      <div className="relative p-6">
                        {/* Icon */}
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors"
                        >
                          <IconComponent
                            className="w-7 h-7 text-orange-400 group-hover:text-orange-300 transition-colors"
                          />
                        </div>

                        {/* Text */}
                        <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors mb-2">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors line-clamp-2">
                          {category.description}
                        </p>

                        {/* Article Count Badge */}
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                            {category.articleCount} articles
                          </span>
                          <svg
                            className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transform group-hover:translate-x-1 transition-all"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Banking Knowledge Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-1 h-8 bg-gradient-to-b from-orange-400 to-orange-600 rounded-full" />
                Banking Knowledge
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {bankingKnowledgeCategories.map((category) => {
                  const IconComponent = getIconComponent(category.icon)
                  return (
                    <Link
                      key={category.id}
                      href={`${basePath}/category/${category.slug}`}
                      className="group flex items-center gap-4 p-4 bg-gray-900 rounded-xl hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 border border-orange-500/20 hover:border-orange-500/40"
                    >
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors"
                      >
                        <IconComponent className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {category.articleCount} articles
                        </p>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transform group-hover:translate-x-1 transition-all"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Guides Section - Only show if there are guides for this portal */}
            {userGuideCategories.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-1 h-8 bg-gradient-to-b from-orange-500 to-amber-400 rounded-full" />
                User Guides
              </h2>
              <div className={`grid gap-6 ${userGuideCategories.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 md:grid-cols-2'}`}>
                {userGuideCategories.map((category) => {
                  const IconComponent = getIconComponent(category.icon)
                  return (
                    <Link
                      key={category.id}
                      href={`${basePath}/category/${category.slug}`}
                      className="group relative bg-gray-900 rounded-2xl hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 overflow-hidden border border-orange-500/20 hover:border-orange-500/40"
                    >
                      <div className="p-6 flex items-start gap-4">
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors"
                        >
                          <IconComponent className="w-8 h-8 text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-white group-hover:text-orange-400 transition-colors mb-2">
                            {category.name}
                          </h3>
                          <p className="text-gray-400 text-sm mb-4">
                            {category.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-gray-800 border border-orange-500/20 rounded-full text-xs text-gray-300">
                              {category.articleCount} articles
                            </span>
                            <span className="text-orange-400 text-sm font-medium group-hover:underline">
                              Explore →
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
            )}
          </div>
        )}

        {activeTab === 'faqs' && (
          <div
            role="tabpanel"
            id="faqs-panel"
            aria-labelledby="faqs-tab"
            tabIndex={0}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Popular FAQs</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {popularFAQs.map((faq) => (
                <Link
                  key={faq.id}
                  href={`${basePath}/faq/${faq.id}`}
                  className="group p-5 bg-gray-900 rounded-xl hover:shadow-md hover:shadow-orange-500/10 transition-all border border-orange-500/20 hover:border-orange-500/40"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors mb-2 line-clamp-2">
                        {faq.question}
                      </h3>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {faq.viewCount.toLocaleString()} views
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                          {faq.helpfulCount} found helpful
                        </span>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transform group-hover:translate-x-1 transition-all flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => setActiveTab('categories')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors"
              >
                Browse All Categories
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'glossary' && (
          <div
            role="tabpanel"
            id="glossary-panel"
            aria-labelledby="glossary-tab"
            tabIndex={0}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Banking & Finance Glossary</h2>

            {/* Alphabet Navigation */}
            <nav aria-label="Browse glossary alphabetically" className="flex flex-wrap gap-2 mb-8 p-4 bg-gray-900 rounded-xl border border-orange-500/20">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                <Link
                  key={letter}
                  href={`${basePath}/glossary?letter=${letter}`}
                  aria-label={`View terms starting with ${letter}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium text-gray-400 hover:bg-orange-500/20 hover:text-orange-400 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {letter}
                </Link>
              ))}
            </nav>

            {/* Popular Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { term: 'EMI', def: 'Equated Monthly Installment' },
                { term: 'CIBIL Score', def: 'Credit score indicating creditworthiness' },
                { term: 'LTV', def: 'Loan to Value Ratio' },
                { term: 'Repo Rate', def: 'Rate at which RBI lends to banks' },
                { term: 'MCLR', def: 'Marginal Cost of Funds Lending Rate' },
                { term: 'NPA', def: 'Non-Performing Asset' }
              ].map(item => (
                <Link
                  key={item.term}
                  href={`${basePath}/glossary?term=${item.term}`}
                  className="group p-4 bg-gray-900 rounded-xl hover:shadow-md hover:shadow-orange-500/10 transition-all border border-orange-500/20 hover:border-orange-500/40"
                >
                  <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                    {item.term}
                  </h3>
                  <p className="text-sm text-gray-500">{item.def}</p>
                </Link>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href={`${basePath}/glossary`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors"
              >
                Browse Full Glossary
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Help Section */}
      <div className="bg-gray-900 border-t border-orange-500/20 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              Can't find what you're looking for?
            </h2>
            <p className="text-gray-400">
              Our support team is here to help you with any questions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-6 bg-gray-800 rounded-xl border border-orange-500/20">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Email Support</h3>
              <p className="text-sm text-gray-500">{COMPANY_INFO.supportEmail}</p>
            </div>

            <div className="text-center p-6 bg-gray-800 rounded-xl border border-orange-500/20">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Phone Support</h3>
              <p className="text-sm text-gray-500">{COMPANY_INFO.supportPhone}</p>
            </div>

            <div className="text-center p-6 bg-gray-800 rounded-xl border border-orange-500/20">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Live Chat</h3>
              <p className="text-sm text-gray-500">Available 9 AM - 9 PM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeBaseMain
