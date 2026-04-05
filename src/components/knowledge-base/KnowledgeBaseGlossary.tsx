'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import {
  KB_GLOSSARY,
  getGlossaryByLetter,
  getGlossaryLetters,
  getRelatedGlossaryTerms
} from '@/lib/knowledge-base'
import type { KBGlossaryTerm } from '@/types/knowledge-base'

interface KnowledgeBaseGlossaryProps {
  basePath: string
  initialLetter?: string
  initialTermId?: string
}

export function KnowledgeBaseGlossary({
  basePath,
  initialLetter,
  initialTermId
}: KnowledgeBaseGlossaryProps) {
  const searchParams = useSearchParams()
  const letterParam = searchParams.get('letter') || initialLetter || 'A'
  const termParam = searchParams.get('term') || initialTermId

  const [activeLetter, setActiveLetter] = useState(letterParam.toUpperCase())
  const [selectedTerm, setSelectedTerm] = useState<string | null>(termParam)
  const [searchQuery, setSearchQuery] = useState('')

  const availableLetters = useMemo(() => getGlossaryLetters(), [])

  const filteredTerms = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return KB_GLOSSARY.filter(term =>
        term.term.toLowerCase().includes(query) ||
        term.definition.toLowerCase().includes(query) ||
        term.aliases.some(alias => alias.toLowerCase().includes(query))
      )
    }
    return getGlossaryByLetter(activeLetter)
  }, [activeLetter, searchQuery])

  const selectedTermData = useMemo(() => {
    if (!selectedTerm) return null
    return KB_GLOSSARY.find(t => t.id === selectedTerm || t.term === selectedTerm)
  }, [selectedTerm])

  const relatedTerms = useMemo(() => {
    if (!selectedTermData) return []
    return getRelatedGlossaryTerms(selectedTermData.id)
  }, [selectedTermData])

  const handleLetterClick = useCallback((letter: string) => {
    setActiveLetter(letter)
    setSearchQuery('')
    setSelectedTerm(null)
  }, [])

  const handleTermClick = useCallback((term: KBGlossaryTerm) => {
    setSelectedTerm(term.id)
  }, [])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (e.target.value) {
      setSelectedTerm(null)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center gap-2 text-white/80 text-sm">
              <li>
                <Link href={basePath} className="hover:text-white transition-colors">
                  Knowledge Base
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-white">Glossary</span>
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Banking & Finance Glossary
          </h1>
          <p className="text-white/90 text-lg max-w-2xl mb-6">
            Comprehensive definitions of banking, loan, and financial terminology.
            Master the language of finance.
          </p>

          {/* Search */}
          <div className="max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder="Search terms..."
                value={searchQuery}
                onChange={handleSearch}
                aria-label="Search glossary terms"
                className="w-full px-5 py-3 pl-12 rounded-xl bg-white/95 backdrop-blur text-gray-900 placeholder-gray-500 focus:ring-4 focus:ring-white/30 border-0"
              />
              <svg
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Alphabet Navigation */}
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-orange-500/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap gap-1 justify-center">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
              const hasTerms = availableLetters.includes(letter)
              return (
                <button
                  key={letter}
                  onClick={() => hasTerms && handleLetterClick(letter)}
                  disabled={!hasTerms}
                  aria-label={`Show terms starting with ${letter}`}
                  aria-pressed={activeLetter === letter}
                  className={cn(
                    "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                    activeLetter === letter
                      ? "bg-orange-500 text-white shadow-md"
                      : hasTerms
                        ? "text-gray-400 hover:bg-orange-500/20 hover:text-orange-400"
                        : "text-gray-700 cursor-not-allowed"
                  )}
                >
                  {letter}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Terms List */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl border border-orange-500/20 overflow-hidden">
              <div className="p-4 border-b border-orange-500/20">
                <h2 className="font-semibold text-white">
                  {searchQuery ? `Search Results (${filteredTerms.length})` : `Terms - ${activeLetter}`}
                </h2>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {filteredTerms.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    {searchQuery ? `No terms found for "${searchQuery}"` : `No terms starting with "${activeLetter}"`}
                  </div>
                ) : (
                  <ul className="divide-y divide-orange-500/10">
                    {filteredTerms.map(term => (
                      <li key={term.id}>
                        <button
                          onClick={() => handleTermClick(term)}
                          aria-pressed={selectedTerm === term.id}
                          className={cn(
                            "w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors",
                            selectedTerm === term.id && "bg-orange-500/10 border-l-4 border-orange-500"
                          )}
                        >
                          <div className="font-medium text-white">
                            {term.term}
                          </div>
                          <div className="text-sm text-gray-500 line-clamp-1">
                            {term.shortDefinition}
                          </div>
                          {term.isImportant && (
                            <span className="mt-1 inline-block px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                              Important
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Term Details */}
          <div className="lg:col-span-2">
            {selectedTermData ? (
              <div className="bg-gray-900 rounded-xl border border-orange-500/20">
                {/* Term Header */}
                <div className="p-6 border-b border-orange-500/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {selectedTermData.term}
                      </h2>
                      {selectedTermData.pronunciation && (
                        <p className="text-gray-500 italic mb-2">
                          /{selectedTermData.pronunciation}/
                        </p>
                      )}
                      {selectedTermData.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedTermData.aliases.map(alias => (
                            <span
                              key={alias}
                              className="px-2 py-1 bg-gray-800 border border-orange-500/20 text-gray-300 text-sm rounded-lg"
                            >
                              Also: {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${selectedTermData.term}: ${selectedTermData.definition}`
                        ).catch(() => {})
                      }}
                      aria-label="Copy definition"
                      className="p-2 text-gray-500 hover:text-orange-400 hover:bg-gray-800 rounded-lg transition-colors"
                      title="Copy definition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Definition */}
                <div className="p-6 border-b border-orange-500/20">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                    Definition
                  </h3>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <p className="text-gray-300 whitespace-pre-line">
                      {selectedTermData.definition}
                    </p>
                  </div>
                </div>

                {/* Examples */}
                {selectedTermData.examples.length > 0 && (
                  <div className="p-6 border-b border-orange-500/20">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                      Examples
                    </h3>
                    <ul className="space-y-2">
                      {selectedTermData.examples.map((example, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-400">
                          <span className="text-orange-500 mt-1">•</span>
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Usage Notes */}
                {selectedTermData.usageNotes && (
                  <div className="p-6 border-b border-orange-500/20 bg-amber-900/10">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Usage Note
                    </h3>
                    <p className="text-amber-300 text-sm">
                      {selectedTermData.usageNotes}
                    </p>
                  </div>
                )}

                {/* Related Terms */}
                {relatedTerms.length > 0 && (
                  <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                      Related Terms
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {relatedTerms.map(term => (
                        <button
                          key={term.id}
                          onClick={() => handleTermClick(term)}
                          className="px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg text-sm hover:bg-orange-500/20 transition-colors"
                        >
                          {term.term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="p-4 bg-gray-800/50 border-t border-orange-500/20 rounded-b-xl">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Category: {selectedTermData.category}</span>
                    <span>Last updated: {new Date(selectedTermData.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-orange-500/20 p-12 text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Select a Term
                </h3>
                <p className="text-gray-400 max-w-sm mx-auto">
                  Click on any term from the list to see its complete definition, examples, and related terms.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-xl p-4 border border-orange-500/20 text-center">
            <div className="text-3xl font-bold text-orange-400">
              {KB_GLOSSARY.length}
            </div>
            <div className="text-sm text-gray-500">Total Terms</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-orange-500/20 text-center">
            <div className="text-3xl font-bold text-orange-400">
              {availableLetters.length}
            </div>
            <div className="text-sm text-gray-500">Letters</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-orange-500/20 text-center">
            <div className="text-3xl font-bold text-orange-400">
              {KB_GLOSSARY.filter(t => t.isImportant).length}
            </div>
            <div className="text-sm text-gray-500">Key Terms</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-orange-500/20 text-center">
            <div className="text-3xl font-bold text-orange-400">
              {new Set(KB_GLOSSARY.map(t => t.category)).size}
            </div>
            <div className="text-sm text-gray-500">Categories</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeBaseGlossary
