'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { MessageCircle, ChevronDown, Send, X, Edit3, FileText, RefreshCw, Sparkles, Check } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateKey = 'introduction' | 'follow_up' | 'document_reminder' | 'application_update' | 'custom'

interface MessageTemplate {
  key: TemplateKey
  label: string
  description: string
  icon: React.ElementType
  buildMessage: (vars: TemplateVars) => string
}

interface TemplateVars {
  customerName: string
  croName: string
  loanType: string
  pendingDocs: string[]
  leadStatus: string
}

interface WhatsAppQuickActionProps {
  customerName: string
  customerPhone: string
  loanType?: string
  leadStatus?: string
  pendingDocs?: string[]
  onMessageSent?: () => void
  variant?: 'button' | 'icon' | 'fab'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WHATSAPP_GREEN = '#25D366'

const TEMPLATES: MessageTemplate[] = [
  {
    key: 'introduction',
    label: 'Introduction',
    description: 'First contact with the lead',
    icon: Sparkles,
    buildMessage: (v) =>
      `Hi ${v.customerName}, I'm ${v.croName} from LOANZ 360. I'd like to discuss your ${v.loanType} requirements.`,
  },
  {
    key: 'follow_up',
    label: 'Follow-up',
    description: 'Continue a previous conversation',
    icon: RefreshCw,
    buildMessage: (v) =>
      `Hi ${v.customerName}, following up on our conversation about your ${v.loanType}. Do you have any questions?`,
  },
  {
    key: 'document_reminder',
    label: 'Document Reminder',
    description: 'Remind about pending documents',
    icon: FileText,
    buildMessage: (v) => {
      const docs = v.pendingDocs.length > 0 ? v.pendingDocs.join(', ') : 'required documents'
      return `Hi ${v.customerName}, just a reminder to share your documents for your ${v.loanType} application. We need: ${docs}.`
    },
  },
  {
    key: 'application_update',
    label: 'Application Update',
    description: 'Share application progress',
    icon: Check,
    buildMessage: (v) =>
      `Hi ${v.customerName}, great news! Your ${v.loanType} application is progressing. Current status: ${v.leadStatus}.`,
  },
  {
    key: 'custom',
    label: 'Custom Message',
    description: 'Write your own message',
    icon: Edit3,
    buildMessage: () => '',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clean phone number: strip spaces, dashes, parentheses.
 * Ensure +91 country code prefix for Indian numbers.
 */
function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // If it starts with +, keep as-is (already has country code)
  if (cleaned.startsWith('+')) {
    return cleaned.replace('+', '')
  }

  // If it starts with 0, remove leading 0 and add 91
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }

  // If it's 10 digits (Indian mobile), add 91 prefix
  if (cleaned.length === 10) {
    return `91${cleaned}`
  }

  // If already 12 digits starting with 91, return as-is
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned
  }

  // Fallback: return as-is
  return cleaned
}

/**
 * Build the WhatsApp deep link URL.
 */
function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanedPhone = cleanPhoneNumber(phone)
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WhatsAppQuickAction({
  customerName,
  customerPhone,
  loanType = 'loan',
  leadStatus = 'In Progress',
  pendingDocs = [],
  onMessageSent,
  variant = 'button',
}: WhatsAppQuickActionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | null>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [editedMessage, setEditedMessage] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Template variables
  const templateVars: TemplateVars = useMemo(
    () => ({
      customerName,
      croName: 'your CRO', // Will be replaced by actual CRO name from auth context
      loanType,
      pendingDocs,
      leadStatus,
    }),
    [customerName, loanType, pendingDocs, leadStatus]
  )

  // Get the generated message for the selected template
  const generatedMessage = useMemo(() => {
    if (!selectedTemplate) return ''
    if (selectedTemplate === 'custom') return customMessage
    const template = TEMPLATES.find((t) => t.key === selectedTemplate)
    return template ? template.buildMessage(templateVars) : ''
  }, [selectedTemplate, templateVars, customMessage])

  // The final message (edited or generated)
  const finalMessage = isEditing ? editedMessage : generatedMessage

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Auto-focus textarea in custom mode
  useEffect(() => {
    if (selectedTemplate === 'custom' && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [selectedTemplate])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSelectedTemplate(null)
    setCustomMessage('')
    setEditedMessage('')
    setIsEditing(false)
  }, [])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isOpen) {
        handleClose()
      } else {
        setIsOpen(true)
      }
    },
    [isOpen, handleClose]
  )

  const handleTemplateSelect = useCallback(
    (key: TemplateKey) => {
      setSelectedTemplate(key)
      setIsEditing(false)
      if (key !== 'custom') {
        const template = TEMPLATES.find((t) => t.key === key)
        if (template) {
          setEditedMessage(template.buildMessage(templateVars))
        }
      } else {
        setEditedMessage('')
        setCustomMessage('')
      }
    },
    [templateVars]
  )

  const handleEditToggle = useCallback(() => {
    if (!isEditing) {
      setEditedMessage(generatedMessage)
    }
    setIsEditing((prev) => !prev)
  }, [isEditing, generatedMessage])

  const handleSend = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!finalMessage.trim()) return
      const url = buildWhatsAppUrl(customerPhone, finalMessage)
      window.open(url, '_blank', 'noopener,noreferrer')
      onMessageSent?.()
      handleClose()
    },
    [finalMessage, customerPhone, onMessageSent, handleClose]
  )

  // -------------------------------------------------------------------------
  // Trigger button rendering
  // -------------------------------------------------------------------------

  const renderTrigger = () => {
    switch (variant) {
      case 'icon':
        return (
          <button
            onClick={handleToggle}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:scale-110"
            style={{ backgroundColor: `${WHATSAPP_GREEN}20`, color: WHATSAPP_GREEN }}
            title={`Message ${customerName} on WhatsApp`}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )

      case 'fab':
        return (
          <button
            onClick={handleToggle}
            className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full shadow-lg shadow-green-900/30 transition-all duration-200 hover:scale-110 hover:shadow-xl hover:shadow-green-900/40"
            style={{ backgroundColor: WHATSAPP_GREEN }}
            title={`Message ${customerName} on WhatsApp`}
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </button>
        )

      default: // 'button'
        return (
          <button
            onClick={handleToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:brightness-110"
            style={{ backgroundColor: WHATSAPP_GREEN }}
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )
    }
  }

  // -------------------------------------------------------------------------
  // Dropdown panel rendering
  // -------------------------------------------------------------------------

  const dropdownPositionClass =
    variant === 'fab'
      ? 'fixed bottom-24 right-6 z-50'
      : 'absolute right-0 top-full mt-2 z-50'

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {renderTrigger()}

      {isOpen && (
        <div
          className={`${dropdownPositionClass} w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-700"
            style={{ backgroundColor: `${WHATSAPP_GREEN}15` }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" style={{ color: WHATSAPP_GREEN }} />
              <span className="text-sm font-semibold text-white">WhatsApp Message</span>
            </div>
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Recipient info */}
          <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">To:</span>
              <span className="text-xs text-gray-300 font-medium">
                {customerName} &middot; {customerPhone}
              </span>
            </div>
          </div>

          {!selectedTemplate ? (
            /* ---- Template selection view ---- */
            <div className="py-2">
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Choose a template
                </span>
              </div>
              {TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.key}
                    onClick={() => handleTemplateSelect(template.key)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left"
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: `${WHATSAPP_GREEN}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: WHATSAPP_GREEN }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-200 block">
                        {template.label}
                      </span>
                      <span className="text-xs text-gray-500 block truncate">
                        {template.description}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            /* ---- Message preview / edit view ---- */
            <div className="p-4 space-y-3">
              {/* Template badge */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedTemplate(null)
                    setIsEditing(false)
                  }}
                  className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
                >
                  <ChevronDown className="w-3 h-3 rotate-90" />
                  Back to templates
                </button>
                {selectedTemplate !== 'custom' && (
                  <button
                    onClick={handleEditToggle}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                    style={{
                      backgroundColor: isEditing ? `${WHATSAPP_GREEN}20` : 'transparent',
                      color: isEditing ? WHATSAPP_GREEN : '#9ca3af',
                    }}
                  >
                    <Edit3 className="w-3 h-3" />
                    {isEditing ? 'Editing' : 'Edit'}
                  </button>
                )}
              </div>

              {/* Message display / edit area */}
              {selectedTemplate === 'custom' || isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={selectedTemplate === 'custom' ? customMessage : editedMessage}
                  onChange={(e) => {
                    if (selectedTemplate === 'custom') {
                      setCustomMessage(e.target.value)
                    } else {
                      setEditedMessage(e.target.value)
                    }
                  }}
                  placeholder={
                    selectedTemplate === 'custom'
                      ? `Type your message to ${customerName}...`
                      : 'Edit your message...'
                  }
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{ focusRingColor: WHATSAPP_GREEN } as React.CSSProperties}
                  onFocus={(e) => {
                    e.target.style.borderColor = WHATSAPP_GREEN
                    e.target.style.boxShadow = `0 0 0 1px ${WHATSAPP_GREEN}`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#374151'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              ) : (
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {generatedMessage}
                  </p>
                </div>
              )}

              {/* Character count */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  {finalMessage.length} characters
                </span>
                {finalMessage.length > 1000 && (
                  <span className="text-[10px] text-amber-400">
                    Long messages may be truncated
                  </span>
                )}
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!finalMessage.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                style={{
                  backgroundColor: finalMessage.trim() ? WHATSAPP_GREEN : '#374151',
                }}
              >
                <Send className="w-4 h-4" />
                Send via WhatsApp
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
