'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ConfirmationVariant = 'danger' | 'warning' | 'info'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: ConfirmationVariant
  isLoading?: boolean
}

const VARIANT_CONFIG: Record<ConfirmationVariant, {
  icon: React.ReactNode
  buttonClass: string
  iconContainerClass: string
}> = {
  danger: {
    icon: <Trash2 className="w-6 h-6 text-red-400" />,
    buttonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    iconContainerClass: 'bg-red-900/30 border-red-500/30',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-yellow-400" />,
    buttonClass: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    iconContainerClass: 'bg-yellow-900/30 border-yellow-500/30',
  },
  info: {
    icon: <AlertTriangle className="w-6 h-6 text-blue-400" />,
    buttonClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    iconContainerClass: 'bg-blue-900/30 border-blue-500/30',
  },
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmationModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const config = VARIANT_CONFIG[variant]

  // Focus trap and keyboard handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onClose()
    }
    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }, [isLoading, onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      cancelRef.current?.focus()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full max-w-md rounded-xl',
          'bg-[#1a1a1a] border border-gray-700/50',
          'shadow-2xl shadow-black/50',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={cn(
            'w-12 h-12 rounded-full border flex items-center justify-center mx-auto mb-4',
            config.iconContainerClass
          )}>
            {config.icon}
          </div>

          {/* Title */}
          <h3 id="confirm-title" className="text-lg font-semibold text-white text-center mb-2 font-poppins">
            {title}
          </h3>

          {/* Message */}
          <div id="confirm-message" className="text-sm text-gray-400 text-center mb-6">
            {message}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              ref={cancelRef}
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
                'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'inline-flex items-center justify-center gap-2',
                config.buttonClass
              )}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
