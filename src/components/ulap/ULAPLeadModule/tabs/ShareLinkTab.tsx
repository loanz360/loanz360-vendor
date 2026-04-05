/**
 * Share Link Tab Component
 * World-class fintech UI for generating and sharing trackable links
 */

'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type {
  ULAPModuleContext,
  ULAPModuleConfig,
  ULAPUserContext,
  ULAPShareLink,
} from '../types'

// =====================================================
// TYPES
// =====================================================

interface ShareLinkTabProps {
  context: ULAPModuleContext
  config: ULAPModuleConfig
  userContext: ULAPUserContext | null
  generateLink: (customerName: string, customerMobile: string, loanType?: string) => Promise<ULAPShareLink | null>
  isGenerating: boolean
  error: string | null
  links: ULAPShareLink[]
  isLoadingLinks: boolean
  copyLink: (link: ULAPShareLink) => void
  shareViaWhatsApp: (link: ULAPShareLink, customerName: string) => void
  onLinkGenerated?: (link: string) => void
}

// =====================================================
// ICONS
// =====================================================

const LinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
)

const CopyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
)

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const UserPlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
  </svg>
)

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  </svg>
)

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getDaysRemaining(expiresAt: string): number {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export const ShareLinkTab: React.FC<ShareLinkTabProps> = ({
  context: _context,
  config,
  userContext: _userContext,
  generateLink,
  isGenerating,
  error,
  links,
  isLoadingLinks,
  copyLink,
  shareViaWhatsApp,
  onLinkGenerated,
}) => {
  // Form state
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [selectedLoanType, setSelectedLoanType] = useState('')
  const [generatedLink, setGeneratedLink] = useState<ULAPShareLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [showForm, setShowForm] = useState(true)

  // Handle generate
  const handleGenerate = useCallback(async () => {
    const link = await generateLink(customerName, customerMobile, selectedLoanType || undefined)
    if (link) {
      setGeneratedLink(link)
      setShowForm(false)
      onLinkGenerated?.(link.full_url)
    }
  }, [customerName, customerMobile, selectedLoanType, generateLink, onLinkGenerated])

  // Handle copy
  const handleCopy = useCallback((link: ULAPShareLink) => {
    copyLink(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [copyLink])

  // Reset form
  const handleNewLink = useCallback(() => {
    setCustomerName('')
    setCustomerMobile('')
    setSelectedLoanType('')
    setGeneratedLink(null)
    setShowForm(true)
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Generate Link Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Generate Link</h3>
              <p className="text-white/50 text-sm">Create a trackable application link</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Customer Name (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Customer Name <span className="text-white/40">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl',
                      'bg-white/[0.05] border border-white/[0.1]',
                      'text-white placeholder-white/30',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                      'transition-all duration-200'
                    )}
                  />
                </div>

                {/* Customer Mobile (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Mobile Number <span className="text-white/40">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl',
                      'bg-white/[0.05] border border-white/[0.1]',
                      'text-white placeholder-white/30',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                      'transition-all duration-200'
                    )}
                  />
                </div>

                {/* Loan Type (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Loan Type <span className="text-white/40">(Optional)</span>
                  </label>
                  <select
                    value={selectedLoanType}
                    onChange={(e) => setSelectedLoanType(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl',
                      'bg-white/[0.05] border border-white/[0.1]',
                      'text-white',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                      'transition-all duration-200'
                    )}
                  >
                    <option value="" className="bg-zinc-900">Any Loan Type</option>
                    <option value="HOME_LOAN" className="bg-zinc-900">Home Loan</option>
                    <option value="PERSONAL_LOAN" className="bg-zinc-900">Personal Loan</option>
                    <option value="BUSINESS_LOAN" className="bg-zinc-900">Business Loan</option>
                    <option value="VEHICLE_LOAN" className="bg-zinc-900">Vehicle Loan</option>
                    <option value="EDUCATION_LOAN" className="bg-zinc-900">Education Loan</option>
                    <option value="GOLD_LOAN" className="bg-zinc-900">Gold Loan</option>
                    <option value="LAP" className="bg-zinc-900">Loan Against Property</option>
                  </select>
                </div>

                {/* Expiry Info */}
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-400 text-sm">
                    <ClockIcon className="w-4 h-4" />
                    <span>Link will expire in {config.shareLinkExpiry} days</span>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <p className="text-red-400 text-sm">{error}</p>
                  </motion.div>
                )}

                <motion.button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  whileHover={{ scale: isGenerating ? 1 : 1.02 }}
                  whileTap={{ scale: isGenerating ? 1 : 0.98 }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl',
                    'bg-gradient-to-r from-purple-500 to-violet-600',
                    'text-white font-medium',
                    'shadow-lg shadow-purple-500/25',
                    isGenerating && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isGenerating ? (
                    <>
                      <LoadingSpinner className="w-5 h-5" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-5 h-5" />
                      <span>Generate Link</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            ) : generatedLink && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Success State */}
                <div className="text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4"
                  >
                    <CheckIcon className="w-8 h-8 text-white" />
                  </motion.div>
                  <h4 className="text-lg font-semibold text-white">Link Generated!</h4>
                  <p className="text-white/50 text-sm">Share this link with your customer</p>
                </div>

                {/* Link Display */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-white/50 text-xs mb-2">Application Link</p>
                  <p className="text-white font-mono text-sm break-all">
                    {generatedLink.full_url}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    onClick={() => handleCopy(generatedLink)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 rounded-xl',
                      'bg-white/[0.05] hover:bg-white/[0.1]',
                      'text-white font-medium transition-colors'
                    )}
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-5 h-5 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-5 h-5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => shareViaWhatsApp(generatedLink, customerName || 'Customer')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 rounded-xl',
                      'bg-[#25D366] hover:bg-[#22c55e]',
                      'text-white font-medium transition-colors'
                    )}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    <span>WhatsApp</span>
                  </motion.button>
                </div>

                <motion.button
                  type="button"
                  onClick={handleNewLink}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
                    'border border-white/[0.1] hover:border-white/[0.2]',
                    'text-white/70 hover:text-white font-medium transition-all'
                  )}
                >
                  <LinkIcon className="w-5 h-5" />
                  <span>Generate Another Link</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recent Links Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <ShareIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Recent Links</h3>
                <p className="text-white/50 text-sm">Track your shared links</p>
              </div>
            </div>
          </div>

          {isLoadingLinks ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="w-8 h-8 text-cyan-500" />
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
                <LinkIcon className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/50 text-sm">No links generated yet</p>
              <p className="text-white/30 text-xs mt-1">Generate your first link to start tracking</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {links.map((link, index) => {
                const daysRemaining = getDaysRemaining(link.expires_at)
                const isExpired = daysRemaining === 0

                return (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'p-4 rounded-xl border transition-all duration-200',
                      isExpired
                        ? 'bg-white/[0.02] border-white/[0.05] opacity-60'
                        : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {link.short_code}
                        </p>
                        <p className="text-white/50 text-xs mt-1">
                          Created {formatDate(link.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isExpired && (
                          <>
                            <motion.button
                              type="button"
                              onClick={() => handleCopy(link)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition-colors"
                            >
                              <CopyIcon className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => shareViaWhatsApp(link, 'Customer')}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-2 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] transition-colors"
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.05]">
                      <div className="flex items-center gap-1.5 text-white/50 text-xs">
                        <EyeIcon className="w-3.5 h-3.5" />
                        <span>{link.open_count} views</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/50 text-xs">
                        <UserPlusIcon className="w-3.5 h-3.5" />
                        <span>{link.conversion_count} conversions</span>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1.5 text-xs ml-auto',
                          isExpired ? 'text-red-400' : daysRemaining <= 7 ? 'text-yellow-400' : 'text-green-400'
                        )}
                      >
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>
                          {isExpired ? 'Expired' : `${daysRemaining}d left`}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Tips Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-white/[0.08]"
      >
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-orange-400" />
          Pro Tips for Better Conversions
        </h4>
        <ul className="space-y-2 text-white/60 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>Share links via WhatsApp for 3x higher conversion rates</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>Pre-fill customer name and mobile for a personalized experience</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-400 mt-1">•</span>
            <span>Follow up within 24 hours for best results</span>
          </li>
        </ul>
      </motion.div>
    </div>
  )
}

export default ShareLinkTab
