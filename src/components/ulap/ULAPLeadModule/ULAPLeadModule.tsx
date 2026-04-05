/**
 * ULAP Lead Module - Main Component
 * A world-class fintech UI component for lead management
 *
 * Features:
 * - Glassmorphism design with premium fintech aesthetics
 * - Smooth animations with Framer Motion
 * - Role-based tab configuration
 * - Real-time stats dashboard
 * - Mobile-first responsive design
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type { ULAPLeadModuleProps, ULAPTab } from './types'
import { getModuleConfig, getVisibleTabs } from './config'
import { useUserContext } from './hooks/useUserContext'
import { useLeadModule } from './hooks/useLeadModule'
import { useShareLink } from './hooks/useShareLink'
import { SubmitLeadTab } from './tabs/SubmitLeadTab'
import { ShareLinkTab } from './tabs/ShareLinkTab'
import { LeadStatusTab } from './tabs/LeadStatusTab'

// =====================================================
// ICONS
// =====================================================

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
)

const LinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
)

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
)

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
)

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

// =====================================================
// TAB ICONS MAPPING
// =====================================================

const TAB_ICONS: Record<ULAPTab, typeof PlusIcon> = {
  submit: PlusIcon,
  share: LinkIcon,
  status: ChartBarIcon,
}

// =====================================================
// STATS CARD COMPONENT
// =====================================================

interface StatsCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  trend?: number
  delay?: number
}

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon,
  color,
  trend,
  delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={cn(
      'relative overflow-hidden rounded-2xl p-5',
      'bg-gradient-to-br from-white/[0.08] to-white/[0.02]',
      'border border-white/[0.08]',
      'backdrop-blur-xl',
      'group hover:border-white/[0.15] transition-all duration-300'
    )}
  >
    {/* Glow Effect */}
    <div
      className={cn(
        'absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20',
        'group-hover:opacity-30 transition-opacity duration-500',
        color
      )}
    />

    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className="text-white/50 text-sm font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {trend !== undefined && (
          <p
            className={cn(
              'text-xs mt-1 flex items-center gap-1',
              trend >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            <span>{trend >= 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(trend)}% from last month</span>
          </p>
        )}
      </div>
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          'bg-gradient-to-br',
          color
        )}
      >
        {icon}
      </div>
    </div>
  </motion.div>
)

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ULAPLeadModule({
  context,
  className,
  defaultTab,
  onLeadSubmitted,
  onLinkGenerated,
}: ULAPLeadModuleProps) {
  // Get configuration for this context
  const config = useMemo(() => getModuleConfig(context), [context])
  const visibleTabs = useMemo(() => getVisibleTabs(config), [config])

  // State
  const [activeTab, setActiveTab] = useState<ULAPTab>(
    defaultTab || config.defaultTab || visibleTabs[0] || 'submit'
  )

  // Hooks
  const { userContext, isLoading: isLoadingUser, error: userError } = useUserContext({ context })

  const {
    submitLead,
    isSubmitting,
    submitError,
    lastSubmittedLead,
    leads,
    leadsTotal,
    isLoadingLeads,
    leadsError,
    fetchLeads,
    currentPage,
    filters,
    stats,
  } = useLeadModule({ context, userContext })

  const {
    generateLink,
    links,
    isGenerating,
    error: linkError,
    fetchLinks,
    isLoadingLinks,
    copyLink,
    shareViaWhatsApp,
  } = useShareLink({
    userContext,
    sourceType: config.sourceType,
    expiryDays: config.shareLinkExpiry,
  })

  // Fetch links on mount if share tab is visible
  useEffect(() => {
    if (config.showShareLink && userContext) {
      fetchLinks()
    }
  }, [config.showShareLink, userContext, fetchLinks])

  // Callback when lead is submitted
  useEffect(() => {
    if (lastSubmittedLead && onLeadSubmitted) {
      onLeadSubmitted(lastSubmittedLead.id, lastSubmittedLead.number)
    }
  }, [lastSubmittedLead, onLeadSubmitted])

  // Loading state
  if (isLoadingUser) {
    return (
      <div className={cn('min-h-[600px] flex items-center justify-center', className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <LoadingSpinner className="w-16 h-16 text-orange-500" />
            <motion.div
              className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-white/60 text-sm">Loading your workspace...</p>
        </motion.div>
      </div>
    )
  }

  // Error state
  if (userError) {
    return (
      <div className={cn('min-h-[600px] flex items-center justify-center', className)}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-8"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Unable to Load</h3>
          <p className="text-white/60 text-sm">{userError}</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-zinc-950', className)}>
      {/* Header Section */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <SparklesIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {config.labels.moduleTitle}
              </h1>
              <p className="text-white/50 text-sm mt-0.5">
                {userContext?.userName && `Welcome, ${userContext.userName}`}
              </p>
            </div>
          </motion.div>

          {/* Stats Cards */}
          {config.showLeadStatus && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard
                label="Total Leads"
                value={stats.total}
                icon={<ChartBarIcon className="w-6 h-6 text-white" />}
                color="from-blue-500 to-blue-600"
                delay={0}
              />
              <StatsCard
                label="In Progress"
                value={stats.inProgress}
                icon={<LoadingSpinner className="w-6 h-6 text-white" />}
                color="from-yellow-500 to-orange-500"
                delay={0.1}
              />
              <StatsCard
                label="Completed"
                value={stats.completed}
                icon={
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="from-emerald-500 to-green-600"
                delay={0.2}
              />
              <StatsCard
                label="Pending"
                value={stats.pending}
                icon={
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="from-purple-500 to-violet-600"
                delay={0.3}
              />
            </div>
          )}

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <div className="flex gap-2 p-1.5 rounded-2xl bg-white/[0.05] backdrop-blur-sm border border-white/[0.08]">
              {visibleTabs.map((tab) => {
                const Icon = TAB_ICONS[tab]
                const isActive = activeTab === tab
                const label =
                  tab === 'submit'
                    ? config.labels.submitTabLabel
                    : tab === 'share'
                    ? config.labels.shareTabLabel
                    : config.labels.statusTabLabel

                return (
                  <motion.button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl',
                      'text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'text-white'
                        : 'text-white/60 hover:text-white/80'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/25"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'submit' && (
            <motion.div
              key="submit"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <SubmitLeadTab
                context={context}
                config={config}
                userContext={userContext}
                submitLead={submitLead}
                isSubmitting={isSubmitting}
                submitError={submitError}
                lastSubmittedLead={lastSubmittedLead}
              />
            </motion.div>
          )}

          {activeTab === 'share' && config.showShareLink && (
            <motion.div
              key="share"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <ShareLinkTab
                context={context}
                config={config}
                userContext={userContext}
                generateLink={generateLink}
                isGenerating={isGenerating}
                error={linkError}
                links={links}
                isLoadingLinks={isLoadingLinks}
                copyLink={copyLink}
                shareViaWhatsApp={shareViaWhatsApp}
                onLinkGenerated={onLinkGenerated}
              />
            </motion.div>
          )}

          {activeTab === 'status' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <LeadStatusTab
                context={context}
                config={config}
                userContext={userContext}
                leads={leads}
                leadsTotal={leadsTotal}
                isLoadingLeads={isLoadingLeads}
                leadsError={leadsError}
                fetchLeads={fetchLeads}
                currentPage={currentPage}
                filters={filters}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default ULAPLeadModule
