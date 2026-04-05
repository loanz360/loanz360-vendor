'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { getKBCategoryBySlug, getFAQsByCategory, KB_CATEGORIES } from '@/lib/knowledge-base'
import type { KBFAQ, KBCategory } from '@/types/knowledge-base'

interface KnowledgeBaseCategoryProps {
  categorySlug: string
  basePath: string
}

export function KnowledgeBaseCategory({ categorySlug, basePath }: KnowledgeBaseCategoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set())

  const category = useMemo(() => getKBCategoryBySlug(categorySlug), [categorySlug])
  const faqs = useMemo(() => {
    if (!category) return []
    return getFAQsByCategory(category.id)
  }, [category])

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs
    const searchTerm = searchQuery.toLowerCase()
    return faqs.filter(faq =>
      faq.question.toLowerCase().includes(searchTerm) ||
      faq.answer.toLowerCase().includes(searchTerm)
    )
  }, [faqs, searchQuery])

  // Dynamically compute related categories based on tags and audience overlap
  const relatedCategories = useMemo(() => {
    if (!category) return []

    // Get current category's tags and audience
    const currentTags = new Set(category.metadata.tags)
    const currentAudience = new Set(category.metadata.targetAudience)

    // Score other categories based on tag and audience overlap
    const scored = KB_CATEGORIES
      .filter(cat => cat.slug !== categorySlug && cat.isActive)
      .map(cat => {
        let score = 0

        // Score based on tag overlap
        cat.metadata.tags.forEach(tag => {
          if (currentTags.has(tag)) score += 2
        })

        // Score based on audience overlap
        cat.metadata.targetAudience.forEach(audience => {
          if (currentAudience.has(audience)) score += 1
        })

        // Bonus for same category type (loan products vs knowledge)
        const isCurrentLoanProduct = category.slug.includes('loan') || category.slug.includes('credit')
        const isCatLoanProduct = cat.slug.includes('loan') || cat.slug.includes('credit')
        if (isCurrentLoanProduct === isCatLoanProduct) score += 1

        return { category: cat, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.category)

    // If we don't have enough related categories, add some defaults
    if (scored.length < 4) {
      const defaultSlugs = ['banking-basics', 'interest-rates', 'documentation', 'credit-score']
      const defaults = defaultSlugs
        .filter(slug => slug !== categorySlug && !scored.find(c => c.slug === slug))
        .map(slug => getKBCategoryBySlug(slug))
        .filter((cat): cat is KBCategory => cat !== undefined)

      scored.push(...defaults.slice(0, 4 - scored.length))
    }

    return scored
  }, [category, categorySlug])

  // Feedback submission handler
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'not-helpful'>>({})
  const handleFeedback = useCallback(async (faqId: string, isHelpful: boolean) => {
    if (feedbackGiven[faqId]) return // Prevent duplicate submissions
    setFeedbackGiven(prev => ({ ...prev, [faqId]: isHelpful ? 'helpful' : 'not-helpful' }))
    try {
      await fetch('/api/knowledge-base/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: faqId,
          contentType: 'faq',
          isHelpful
        })
      })
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }, [feedbackGiven])

  const toggleFaq = (faqId: string) => {
    setExpandedFaqs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(faqId)) {
        newSet.delete(faqId)
      } else {
        newSet.add(faqId)
      }
      return newSet
    })
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Category Not Found</h2>
          <Link href={basePath} className="text-orange-400 hover:underline">
            ← Back to Knowledge Base
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Category Hero */}
      <div
        className="relative py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"
      >
        <div className="max-w-5xl mx-auto">
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
                <span className="text-white">{category.name}</span>
              </li>
            </ol>
          </nav>

          <div className="flex items-start gap-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/20 backdrop-blur"
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{category.name}</h1>
              <p className="text-white/90 text-lg max-w-2xl">{category.description}</p>
              <div className="flex items-center gap-4 mt-4">
                <span className="text-white/80 text-sm">
                  {faqs.length} FAQs
                </span>
                <span className="text-white/80 text-sm">
                  •
                </span>
                <span className="text-white/80 text-sm">
                  {category.articleCount} Articles
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="relative mb-8">
          <input
            type="text"
            placeholder={`Search in ${category.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3 pl-12 rounded-xl border border-orange-500/30 bg-gray-900 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            aria-label={`Search FAQs in ${category.name}`}
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-gray-900 rounded-xl border border-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{faqs.length}</div>
                <div className="text-sm text-gray-400">FAQs Available</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-900 rounded-xl border border-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {faqs.reduce((sum, faq) => sum + faq.viewCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Total Views</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-900 rounded-xl border border-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">
                  {faqs.reduce((sum, faq) => sum + faq.helpfulCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Found Helpful</div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQs List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">
            Frequently Asked Questions
            {searchQuery && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({filteredFaqs.length} results)
              </span>
            )}
          </h2>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-gray-900 rounded-xl border border-orange-500/20">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400">No FAQs found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredFaqs.map((faq, index) => (
              <div
                key={faq.id}
                className="bg-gray-900 rounded-xl border border-orange-500/20 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={expandedFaqs.has(faq.id)}
                  className="w-full p-5 text-left flex items-start gap-4 hover:bg-gray-800/50 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-400 font-semibold text-sm">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white pr-8">
                      {faq.question}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {faq.viewCount.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        {faq.helpfulCount}
                      </span>
                      {faq.isPopular && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                          Popular
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className={cn(
                      "w-5 h-5 text-gray-500 transition-transform flex-shrink-0",
                      expandedFaqs.has(faq.id) && "rotate-180"
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedFaqs.has(faq.id) && (
                  <div className="px-5 pb-5">
                    <div className="ml-12 pt-4 border-t border-orange-500/20">
                      <div className="prose prose-sm prose-invert max-w-none text-gray-300">
                        <div className="whitespace-pre-line">{faq.answer}</div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        {faq.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-800 border border-orange-500/20 text-gray-300 text-xs rounded-lg"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Feedback */}
                      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-orange-500/20">
                        {feedbackGiven[faq.id] ? (
                          <span className={`text-sm ${feedbackGiven[faq.id] === 'helpful' ? 'text-green-400' : 'text-orange-400'}`}>
                            Thank you for your feedback!
                          </span>
                        ) : (
                          <>
                            <span className="text-sm text-gray-400">Was this helpful?</span>
                            <button
                              onClick={() => handleFeedback(faq.id, true)}
                              aria-label="Mark as helpful"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              Yes
                            </button>
                            <button
                              onClick={() => handleFeedback(faq.id, false)}
                              aria-label="Mark as not helpful"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                              </svg>
                              No
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Related Categories */}
        {relatedCategories.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-4">
              Related Categories
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedCategories.map(relatedCat => (
                <Link
                  key={relatedCat.slug}
                  href={`${basePath}/category/${relatedCat.slug}`}
                  className="group p-4 bg-gray-900 border border-orange-500/20 rounded-xl hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-orange-500/10"
                  >
                    <svg
                      className="w-5 h-5 text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                    {relatedCat.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {relatedCat.articleCount} articles
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KnowledgeBaseCategory
