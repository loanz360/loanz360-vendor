'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  getFAQById,
  getRelatedFAQs,
  KB_CATEGORIES
} from '@/lib/knowledge-base'

interface KnowledgeBaseFAQDetailProps {
  faqId: string
  basePath: string
}

export function KnowledgeBaseFAQDetail({ faqId, basePath }: KnowledgeBaseFAQDetailProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not-helpful' | null>(null)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const faq = useMemo(() => getFAQById(faqId), [faqId])
  const relatedFaqs = useMemo(() => faq ? getRelatedFAQs(faqId, 5) : [], [faqId, faq])

  const category = useMemo(() => {
    if (!faq) return null
    return KB_CATEGORIES.find(cat => cat.id === faq.categoryId)
  }, [faq])

  // Submit feedback to API for both positive and negative
  const submitFeedback = useCallback(async (isHelpful: boolean, comment?: string) => {
    setFeedbackLoading(true)
    try {
      await fetch('/api/knowledge-base/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: faqId,
          contentType: 'faq',
          isHelpful,
          comment: comment || undefined
        })
      })
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setFeedbackLoading(false)
    }
  }, [faqId])

  const handleFeedback = useCallback((isHelpful: boolean) => {
    setFeedbackGiven(isHelpful ? 'helpful' : 'not-helpful')
    if (isHelpful) {
      // Send positive feedback to API immediately
      submitFeedback(true)
    } else {
      setShowFeedbackForm(true)
    }
  }, [submitFeedback])

  const handleSubmitFeedback = useCallback(async () => {
    await submitFeedback(false, feedbackComment)
    setShowFeedbackForm(false)
    setFeedbackComment('')
  }, [feedbackComment, submitFeedback])

  const handleShare = useCallback(async () => {
    if (!faq) return
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: faq.question,
          url: window.location.href
        })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href)
      }
    } catch {
      // User cancelled share or clipboard failed — ignore
    }
  }, [faq])

  if (!faq) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center p-8 bg-gray-900 rounded-xl border border-orange-500/20 max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">FAQ Not Found</h2>
          <p className="text-gray-400 mb-6">
            The FAQ you&apos;re looking for doesn&apos;t exist or may have been removed.
          </p>
          <Link
            href={basePath}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Knowledge Base
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Breadcrumb Header */}
      <div className="bg-gray-900 border-b border-orange-500/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link href={basePath} className="text-gray-400 hover:text-orange-400">
              Knowledge Base
            </Link>
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {category && (
              <>
                <Link
                  href={`${basePath}/category/${category.slug}`}
                  className="text-gray-400 hover:text-orange-400"
                >
                  {category.name}
                </Link>
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
            <span className="text-white truncate max-w-xs">FAQ</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FAQ Content */}
          <div className="lg:col-span-2">
            <article className="bg-gray-900 rounded-xl border border-orange-500/20 overflow-hidden">
              {/* Question */}
              <div className="p-6 border-b border-orange-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">
                      {faq.question}
                    </h1>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {faq.viewCount.toLocaleString()} views
                      </span>
                      {faq.isPopular && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs">
                          Popular
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Answer */}
              <div className="p-6">
                <div className="prose prose-sm prose-invert max-w-none">
                  <div className="whitespace-pre-line text-gray-300">
                    {faq.answer}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-orange-500/20">
                  {faq.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-800 border border-orange-500/20 text-gray-300 text-sm rounded-lg"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Feedback Section */}
              <div className="p-6 bg-gray-800/50 border-t border-orange-500/20">
                {!feedbackGiven ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-medium">
                      Was this answer helpful?
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleFeedback(true)}
                        disabled={feedbackLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        aria-label="Yes, this was helpful"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        Yes
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        disabled={feedbackLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        aria-label="No, this was not helpful"
                      >
                        <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {feedbackGiven === 'helpful' ? (
                      <div className="flex items-center gap-3 text-green-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Thank you for your feedback!</span>
                      </div>
                    ) : showFeedbackForm ? (
                      <div className="space-y-4">
                        <p className="text-gray-300">
                          We&apos;re sorry this wasn&apos;t helpful. How can we improve?
                        </p>
                        <textarea
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Please tell us what was missing or unclear..."
                          className="w-full p-3 border border-orange-500/30 rounded-lg bg-gray-900 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          rows={3}
                          maxLength={1000}
                          aria-label="Feedback comment"
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => { setShowFeedbackForm(false); submitFeedback(false) }}
                            className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            Skip
                          </button>
                          <button
                            onClick={handleSubmitFeedback}
                            disabled={feedbackLoading}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {feedbackLoading ? 'Submitting...' : 'Submit Feedback'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-orange-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Thank you for your feedback!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-orange-500/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 text-gray-500 hover:text-orange-400 text-sm transition-colors"
                    aria-label="Print this FAQ"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 text-gray-500 hover:text-orange-400 text-sm transition-colors"
                    aria-label="Share this FAQ"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </button>
                </div>
                <span className="text-xs text-gray-500">
                  Last updated: {new Date(faq.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </article>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Category Info */}
            {category && (
              <div className="bg-gray-900 rounded-xl border border-orange-500/20 p-4">
                <h3 className="font-semibold text-white mb-3">Category</h3>
                <Link
                  href={`${basePath}/category/${category.slug}`}
                  className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-500/10"
                  >
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-white">{category.name}</div>
                    <div className="text-sm text-gray-500">
                      View all FAQs
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Related FAQs */}
            {relatedFaqs.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-orange-500/20 p-4">
                <h3 className="font-semibold text-white mb-3">Related Questions</h3>
                <ul className="space-y-3">
                  {relatedFaqs.map(relatedFaq => (
                    <li key={relatedFaq.id}>
                      <Link
                        href={`${basePath}/faq/${relatedFaq.id}`}
                        className="block p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <div className="text-sm text-white line-clamp-2">
                          {relatedFaq.question}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Need More Help */}
            <div className="bg-gradient-to-br from-orange-600 to-amber-600 rounded-xl p-4 text-white">
              <h3 className="font-semibold mb-2">Need More Help?</h3>
              <p className="text-sm text-white/90 mb-4">
                Can&apos;t find what you&apos;re looking for? Our support team is here to help.
              </p>
              <Link
                href={`${basePath}/../tickets`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Contact Support
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeBaseFAQDetail
