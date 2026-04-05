'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, CheckCircle, Info, XCircle } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  isLoading?: boolean
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null

  const variantConfig = {
    danger: {
      icon: XCircle,
      iconColor: 'text-red-500',
      buttonColor: 'bg-red-500 hover:bg-red-600',
      borderColor: 'border-red-500/20'
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      buttonColor: 'bg-orange-500 hover:bg-orange-600',
      borderColor: 'border-orange-500/20'
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-500',
      buttonColor: 'bg-blue-500 hover:bg-blue-600',
      borderColor: 'border-blue-500/20'
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      buttonColor: 'bg-green-500 hover:bg-green-600',
      borderColor: 'border-green-500/20'
    }
  }

  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = () => {
    onConfirm()
    // Don't auto-close - let parent component handle it after async operation
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-[#1A1A1A] border ${config.borderColor} rounded-xl w-full max-w-md shadow-2xl`}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-white/10">
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg bg-white/5 ${config.iconColor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3
                  id="confirm-modal-title"
                  className="text-xl font-bold text-white font-poppins"
                >
                  {title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-white/10">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 px-6 py-3 ${config.buttonColor} text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
