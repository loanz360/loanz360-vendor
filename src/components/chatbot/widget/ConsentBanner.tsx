'use client'

import React, { useState, useEffect } from 'react'
import { Shield, X, Check } from 'lucide-react'

interface ConsentBannerProps {
  sessionId: string
  chatbotId: string
  onConsent: (consents: ConsentTypes) => void
  onDecline?: () => void
  privacyPolicyUrl?: string
  companyName?: string
}

interface ConsentTypes {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

const CONSENT_STORAGE_KEY = 'chatbot_consent'

/**
 * GDPR/DPDP Compliant Consent Banner for Chatbot Widget
 */
export function ConsentBanner({
  sessionId,
  chatbotId,
  onConsent,
  onDecline,
  privacyPolicyUrl = '/privacy-policy',
  companyName = 'Our company'
}: ConsentBannerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [consents, setConsents] = useState<ConsentTypes>({
    essential: true, // Always required
    analytics: false,
    marketing: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check for existing consent
  useEffect(() => {
    const stored = localStorage.getItem(`${CONSENT_STORAGE_KEY}_${chatbotId}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.consents && !isExpired(parsed.timestamp)) {
          onConsent(parsed.consents)
        }
      } catch {
        // Invalid stored consent, show banner
      }
    }
  }, [chatbotId, onConsent])

  const isExpired = (timestamp: number): boolean => {
    // Consent expires after 365 days
    const expiryMs = 365 * 24 * 60 * 60 * 1000
    return Date.now() - timestamp > expiryMs
  }

  const handleAcceptAll = async () => {
    const allConsents: ConsentTypes = {
      essential: true,
      analytics: true,
      marketing: true
    }
    await saveConsent(allConsents)
  }

  const handleAcceptSelected = async () => {
    await saveConsent(consents)
  }

  const handleDecline = () => {
    // Only essential consent
    const essentialOnly: ConsentTypes = {
      essential: true,
      analytics: false,
      marketing: false
    }
    saveConsent(essentialOnly)
    if (onDecline) {
      onDecline()
    }
  }

  const saveConsent = async (consentData: ConsentTypes) => {
    setIsSubmitting(true)

    try {
      // Save to backend
      await fetch('/api/public/chatbot/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          consents: [
            { consent_type: 'essential', granted: consentData.essential },
            { consent_type: 'analytics', granted: consentData.analytics },
            { consent_type: 'marketing', granted: consentData.marketing }
          ]
        })
      })
    } catch (error) {
      console.error('Failed to save consent to server:', error)
      // Continue anyway - don't block user experience
    }

    // Save to localStorage
    localStorage.setItem(`${CONSENT_STORAGE_KEY}_${chatbotId}`, JSON.stringify({
      consents: consentData,
      timestamp: Date.now()
    }))

    setIsSubmitting(false)
    onConsent(consentData)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 border-t border-gray-800 shadow-lg animate-slide-up">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-white">Privacy Settings</span>
          </div>
        </div>

        {/* Main text */}
        <p className="text-gray-300 text-sm mb-4">
          We use cookies and similar technologies to improve your experience.
          {' '}
          <a
            href={privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 hover:text-orange-300 underline"
          >
            Learn more
          </a>
        </p>

        {/* Detailed options (collapsible) */}
        {showDetails && (
          <div className="mb-4 space-y-3 p-3 bg-gray-800/50 rounded-lg">
            {/* Essential */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white">Essential</p>
                <p className="text-xs text-gray-400">Required for chat functionality</p>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-400">Always on</span>
              </div>
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white">Analytics</p>
                <p className="text-xs text-gray-400">Help us improve our service</p>
              </div>
              <button
                onClick={() => setConsents(prev => ({ ...prev, analytics: !prev.analytics }))}
                className={`w-10 h-5 rounded-full transition-colors ${
                  consents.analytics ? 'bg-orange-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                    consents.analytics ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Marketing */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white">Marketing</p>
                <p className="text-xs text-gray-400">Personalized follow-ups</p>
              </div>
              <button
                onClick={() => setConsents(prev => ({ ...prev, marketing: !prev.marketing }))}
                className={`w-10 h-5 rounded-full transition-colors ${
                  consents.marketing ? 'bg-orange-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                    consents.marketing ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAcceptAll}
            disabled={isSubmitting}
            className="flex-1 min-w-[120px] px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Accept All
          </button>
          {showDetails ? (
            <button
              onClick={handleAcceptSelected}
              disabled={isSubmitting}
              className="flex-1 min-w-[120px] px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save Preferences
            </button>
          ) : (
            <button
              onClick={() => setShowDetails(true)}
              className="flex-1 min-w-[120px] px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Customize
            </button>
          )}
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Essential Only
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ConsentBanner
