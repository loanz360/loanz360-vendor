'use client'

import React, { useCallback, useState } from 'react'
import { Phone, PhoneCall, Loader2 } from 'lucide-react'
import PostCallModal from './PostCallModal'
import { useCallTracking } from '@/hooks/useCallTracking'

/**
 * MaskedCallButton - Initiates a call using a masked/proxy phone number.
 * The CRO never sees the real customer phone; the backend handles unmasking.
 * Falls back to direct call via useCallTracking if masking API is unavailable.
 */

interface MaskedCallButtonProps {
  maskedPhone: string
  contactId: string
  contactType: 'contact' | 'positive_contact' | 'lead'
  contactName: string
  leadId?: string
  variant?: 'default' | 'small' | 'icon'
  className?: string
  onCallLogged?: () => void
}

export default function MaskedCallButton({
  maskedPhone,
  contactId,
  contactType,
  contactName,
  leadId,
  variant = 'default',
  className,
  onCallLogged,
}: MaskedCallButtonProps) {
  const { initiateCall, activeCall, callDuration, showPostCallModal, dismissPostCallModal } = useCallTracking()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConnecting(true)

    try {
      // Try masked call via backend proxy
      const res = await fetch('/api/ai-crm/cro/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          contact_type: contactType,
          masked_phone: maskedPhone,
          lead_id: leadId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.proxy_number) {
          // Backend returned a valid proxy number - use it
          setIsConnecting(false)
          initiateCall({
            contactId,
            contactType,
            customerName: contactName,
            customerPhone: data.proxy_number,
            leadId,
          })
          return
        }
        // proxy_number is falsy - fall back to direct call with real phone
        // (backend resolved the real number but proxy service is unavailable)
        if (data.real_phone) {
          setIsConnecting(false)
          initiateCall({
            contactId,
            contactType,
            customerName: contactName,
            customerPhone: data.real_phone,
            leadId,
          })
          return
        }
      }
    } catch {
      // Masked call API not available, fall back to direct call
    }

    // Fallback: direct call via useCallTracking with masked phone
    setIsConnecting(false)
    initiateCall({
      contactId,
      contactType,
      customerName: contactName,
      customerPhone: maskedPhone,
      leadId,
    })
  }, [initiateCall, contactId, contactType, contactName, maskedPhone, leadId])

  const handleCallLogSaved = useCallback(async () => {
    onCallLogged?.()
  }, [onCallLogged])

  const isThisContact = activeCall?.contactId === contactId

  const buttonStyles = {
    default: 'flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
    small: 'flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50',
    icon: 'flex items-center justify-center bg-green-600 hover:bg-green-700 text-white w-9 h-9 rounded-lg transition-colors disabled:opacity-50',
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isConnecting}
        className={className || buttonStyles[variant]}
        title={`Call ${contactName}`}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <PhoneCall className={variant === 'icon' ? 'w-4 h-4' : variant === 'small' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        )}
        {variant !== 'icon' && <span>{isConnecting ? 'Connecting...' : 'Call'}</span>}
      </button>

      {showPostCallModal && isThisContact && (
        <PostCallModal
          isOpen={true}
          onClose={() => {
            dismissPostCallModal()
            onCallLogged?.()
          }}
          onSubmit={handleCallLogSaved}
          customerName={contactName}
          customerPhone={maskedPhone}
          contactType={contactType}
          entityId={contactId}
          estimatedDuration={callDuration}
        />
      )}
    </>
  )
}
