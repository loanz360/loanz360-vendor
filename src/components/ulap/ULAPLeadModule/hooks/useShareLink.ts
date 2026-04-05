/**
 * useShareLink Hook
 * Handles share link generation with hidden tracking
 */

'use client'

import { useState, useCallback } from 'react'
import type { ULAPShareLink, ULAPUserContext, ULAPSourceType } from '../types'

interface UseShareLinkOptions {
  userContext: ULAPUserContext | null
  sourceType: ULAPSourceType
  expiryDays: number
}

interface UseShareLinkReturn {
  generateLink: (customerName: string, customerMobile: string, loanType?: string) => Promise<ULAPShareLink | null>
  links: ULAPShareLink[]
  isGenerating: boolean
  error: string | null
  fetchLinks: () => Promise<void>
  isLoadingLinks: boolean
  copyLink: (link: ULAPShareLink) => void
  shareViaWhatsApp: (link: ULAPShareLink, customerName: string) => void
}

export function useShareLink({
  userContext,
  sourceType,
  expiryDays,
}: UseShareLinkOptions): UseShareLinkReturn {
  const [links, setLinks] = useState<ULAPShareLink[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingLinks, setIsLoadingLinks] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Generate a new shareable link
   */
  const generateLink = useCallback(
    async (
      customerName: string,
      customerMobile: string,
      loanType?: string
    ): Promise<ULAPShareLink | null> => {
      if (!userContext) {
        setError('User context not available')
        return null
      }

      setIsGenerating(true)
      setError(null)

      try {
        const response = await fetch('/api/ulap/share-link/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: customerName,
            customer_mobile: customerMobile,
            loan_type: loanType,
            source_type: sourceType,
            source_user_id: userContext.userId,
            source_user_name: userContext.userName,
            source_partner_id: userContext.partnerId,
            source_partner_name: userContext.partnerName,
            expiry_days: expiryDays,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate link')
        }

        const newLink = data.link as ULAPShareLink

        // Add to links list
        setLinks((prev) => [newLink, ...prev])

        return newLink
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate link'
        setError(errorMessage)
        console.error('Error generating share link:', err)
        return null
      } finally {
        setIsGenerating(false)
      }
    },
    [userContext, sourceType, expiryDays]
  )

  /**
   * Fetch existing links for the user
   */
  const fetchLinks = useCallback(async () => {
    if (!userContext) return

    setIsLoadingLinks(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        source_user_id: userContext.userId,
        source_type: sourceType,
      })

      const response = await fetch(`/api/ulap/share-link/list?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch links')
      }

      setLinks(data.links || [])
    } catch (err) {
      console.error('Error fetching share links:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch links')
    } finally {
      setIsLoadingLinks(false)
    }
  }, [userContext, sourceType])

  /**
   * Copy link to clipboard
   */
  const copyLink = useCallback((link: ULAPShareLink) => {
    // Copy the clean URL (without visible tracking params)
    navigator.clipboard.writeText(link.full_url)
  }, [])

  /**
   * Share via WhatsApp
   */
  const shareViaWhatsApp = useCallback((link: ULAPShareLink, customerName: string) => {
    const message = encodeURIComponent(
      `Hi ${customerName},\n\nPlease use this link to apply for your loan:\n${link.full_url}\n\nThis link is valid for ${expiryDays} days.`
    )

    window.open(`https://wa.me/?text=${message}`, '_blank')
  }, [expiryDays])

  return {
    generateLink,
    links,
    isGenerating,
    error,
    fetchLinks,
    isLoadingLinks,
    copyLink,
    shareViaWhatsApp,
  }
}

export default useShareLink
