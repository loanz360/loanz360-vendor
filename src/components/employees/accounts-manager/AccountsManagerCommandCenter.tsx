'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  X,
  FileCheck,
  Users,
  BarChart3,
  HeadphonesIcon,
  FileText,
  Target,
  Command,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  Bell,
  Keyboard,
  UserCheck,
  Briefcase,
  Building2,
} from 'lucide-react'
import { downloadPDF } from '@/lib/utils/export-helpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandCenterProps {
  isOpen: boolean
  onClose: () => void
  stats?: {
    pending: number
    overdue: number
    inProgress: number
    verifiedToday: number
  }
  onNavigate: (path: string) => void
  onRefresh: () => void
}

interface QuickAction {
  id: string
  label: string
  shortcut: string
  icon: React.ReactNode
  path: string
  badge?: number
  color: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_SEARCHES_KEY = 'am-command-center-recent'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecentSearch(term: string) {
  const recent = getRecentSearches().filter((s) => s !== term)
  recent.unshift(term)
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountsManagerCommandCenter({
  isOpen,
  onClose,
  stats,
  onNavigate,
  onRefresh,
}: CommandCenterProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [shortcutsExpanded, setShortcutsExpanded] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Load recent searches when panel opens
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches())
      // Focus search input after animation
      const timer = setTimeout(() => searchRef.current?.focus(), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // -------------------------------------------------------------------------
  // Quick actions definition (uses stats for badges)
  // -------------------------------------------------------------------------

  const quickActions: QuickAction[] = [
    {
      id: 'cp-applications',
      label: 'Review CP Applications',
      shortcut: 'Ctrl+1',
      icon: <UserCheck className="h-5 w-5" />,
      path: '/employees/accounts-manager/cp-applications',
      badge: stats?.pending,
      color: 'text-orange-400',
    },
    {
      id: 'ba-applications',
      label: 'Review BA Applications',
      shortcut: 'Ctrl+2',
      icon: <Briefcase className="h-5 w-5" />,
      path: '/employees/accounts-manager/ba-applications',
      color: 'text-blue-400',
    },
    {
      id: 'bp-applications',
      label: 'Review BP Applications',
      shortcut: 'Ctrl+3',
      icon: <Building2 className="h-5 w-5" />,
      path: '/employees/accounts-manager/bp-applications',
      color: 'text-purple-400',
    },
    {
      id: 'team',
      label: 'View Team',
      shortcut: 'Ctrl+4',
      icon: <Users className="h-5 w-5" />,
      path: '/employees/accounts-manager/team',
      color: 'text-emerald-400',
    },
    {
      id: 'overview',
      label: 'Accounts Overview',
      shortcut: 'Ctrl+5',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/employees/accounts-manager/overview',
      color: 'text-cyan-400',
    },
    {
      id: 'tickets',
      label: 'Support Tickets',
      shortcut: 'Ctrl+6',
      icon: <HeadphonesIcon className="h-5 w-5" />,
      path: '/employees/accounts-manager/tickets',
      badge: stats?.overdue,
      color: 'text-rose-400',
    },
    {
      id: 'reports',
      label: 'Financial Reports',
      shortcut: 'Ctrl+7',
      icon: <FileText className="h-5 w-5" />,
      path: '/employees/accounts-manager/reports',
      color: 'text-amber-400',
    },
    {
      id: 'targets',
      label: 'Department Targets',
      shortcut: 'Ctrl+8',
      icon: <Target className="h-5 w-5" />,
      path: '/employees/accounts-manager/targets',
      color: 'text-lime-400',
    },
  ]

  // -------------------------------------------------------------------------
  // Filtered actions for search
  // -------------------------------------------------------------------------

  const filteredActions = searchQuery.trim()
    ? quickActions.filter((a) =>
        a.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : quickActions

  // -------------------------------------------------------------------------
  // Navigate helper
  // -------------------------------------------------------------------------

  const handleNavigate = useCallback(
    (path: string) => {
      onNavigate(path)
      onClose()
    },
    [onNavigate, onClose]
  )

  // -------------------------------------------------------------------------
  // Search submit
  // -------------------------------------------------------------------------

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim()
    if (!q) return
    saveRecentSearch(q)
    setRecentSearches(getRecentSearches())
    // Navigate to a search results route or handle inline
    handleNavigate(`/employees/accounts-manager?search=${encodeURIComponent(q)}`)
  }, [searchQuery, handleNavigate])

  // -------------------------------------------------------------------------
  // PDF generation
  // -------------------------------------------------------------------------

  const handleGeneratePdf = useCallback(() => {
    setGeneratingPdf(true)
    const now = new Date()
    const reportData = [
      {
        Metric: 'Pending Applications',
        Value: stats?.pending ?? 0,
        Status: (stats?.pending ?? 0) > 10 ? 'High' : 'Normal',
      },
      {
        Metric: 'Overdue Reviews',
        Value: stats?.overdue ?? 0,
        Status: (stats?.overdue ?? 0) > 0 ? 'Action Required' : 'Clear',
      },
      {
        Metric: 'In Progress',
        Value: stats?.inProgress ?? 0,
        Status: 'Active',
      },
      {
        Metric: 'Verified Today',
        Value: stats?.verifiedToday ?? 0,
        Status: 'Completed',
      },
    ]

    try {
      downloadPDF(reportData, `department-performance-${now.toISOString().slice(0, 10)}`, {
        title: 'Department Performance Report',
        orientation: 'portrait',
      })
    } finally {
      setTimeout(() => setGeneratingPdf(false), 1200)
    }
  }, [stats])

  // -------------------------------------------------------------------------
  // Keyboard shortcuts (global)
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape closes
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        onClose()
        return
      }

      // Only process Ctrl shortcuts
      if (!e.ctrlKey && !e.metaKey) return

      // Ctrl+K toggles panel (handled by parent too, but guard here)
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        if (isOpen) onClose()
        return
      }

      if (!isOpen) return

      // Ctrl+1-8 navigation
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 8) {
        e.preventDefault()
        const action = quickActions[num - 1]
        if (action) handleNavigate(action.path)
        return
      }

      // Ctrl+R refresh
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        onRefresh()
        return
      }

      // Ctrl+E export
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        handleGeneratePdf()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onRefresh, handleNavigate, handleGeneratePdf, quickActions])

  // -------------------------------------------------------------------------
  // Focus trap
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', trapFocus)
    return () => window.removeEventListener('keydown', trapFocus)
  }, [isOpen])

  // -------------------------------------------------------------------------
  // Keyboard shortcut definitions for display
  // -------------------------------------------------------------------------

  const shortcutGroups = [
    {
      title: 'Navigation',
      items: [
        { keys: 'Ctrl + 1-8', desc: 'Jump to section' },
        { keys: 'Ctrl + K', desc: 'Toggle Command Center' },
        { keys: 'Escape', desc: 'Close panel' },
      ],
    },
    {
      title: 'Actions',
      items: [
        { keys: 'Ctrl + R', desc: 'Refresh dashboard' },
        { keys: 'Ctrl + E', desc: 'Export / PDF report' },
        { keys: 'Ctrl + N', desc: 'Notifications' },
        { keys: 'Enter', desc: 'Search / confirm' },
      ],
    },
  ]

  // -------------------------------------------------------------------------
  // Status summary
  // -------------------------------------------------------------------------

  const statusItems = [
    { label: 'pending', value: stats?.pending ?? 0, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'overdue', value: stats?.overdue ?? 0, color: 'text-rose-400', bg: 'bg-rose-400/10' },
    { label: 'in progress', value: stats?.inProgress ?? 0, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'verified today', value: stats?.verifiedToday ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ]

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command Center"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-y-auto
                       bg-gray-950/95 text-gray-100 shadow-2xl backdrop-blur-xl
                       md:w-[480px] lg:w-[520px]"
          >
            {/* ---- Header ---- */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <Command className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold tracking-tight">Command Center</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close command center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ---- Search ---- */}
            <div className="border-b border-white/10 px-5 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch()
                  }}
                  placeholder="Search applications, team, tickets..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-20
                             text-sm text-white placeholder-gray-500 outline-none
                             transition focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/15
                                bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">
                  Enter
                </kbd>
              </div>

              {/* Recent searches */}
              {recentSearches.length > 0 && !searchQuery && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Clock className="h-3.5 w-3.5 text-gray-600" />
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setSearchQuery(term)
                        searchRef.current?.focus()
                      }}
                      className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-gray-400
                                 transition hover:bg-white/10 hover:text-white"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---- Status Overview ---- */}
            <div className="border-b border-white/10 px-5 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {statusItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() =>
                      handleNavigate(
                        `/employees/accounts-manager?filter=${item.label.replace(/\s+/g, '-')}`
                      )
                    }
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${item.bg}
                               transition hover:brightness-125`}
                  >
                    <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
                    <span className="text-xs text-gray-400">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Quick Actions Grid ---- */}
            <div className="flex-1 px-5 py-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleNavigate(action.path)}
                    className="group relative flex items-center gap-3 rounded-xl border border-white/5
                               bg-white/[0.03] px-4 py-3 text-left transition
                               hover:border-orange-500/30 hover:bg-white/[0.07]
                               active:scale-[0.98]"
                  >
                    <span className={`${action.color} transition group-hover:scale-110`}>
                      {action.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-200">
                        {action.label}
                      </span>
                      <kbd className="text-[10px] text-gray-600">{action.shortcut}</kbd>
                    </div>
                    {action.badge != null && action.badge > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full
                                       bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                        {action.badge}
                      </span>
                    )}
                  </button>
                ))}

                {filteredActions.length === 0 && (
                  <p className="col-span-2 py-8 text-center text-sm text-gray-600">
                    No actions match &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            </div>

            {/* ---- Keyboard Shortcuts ---- */}
            <div className="border-t border-white/10 px-5 py-3">
              <button
                onClick={() => setShortcutsExpanded((p) => !p)}
                className="flex w-full items-center justify-between text-xs font-medium
                           uppercase tracking-wider text-gray-500 transition hover:text-gray-300"
              >
                <span className="flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5" />
                  Keyboard Shortcuts
                </span>
                {shortcutsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              <AnimatePresence>
                {shortcutsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-4">
                      {shortcutGroups.map((group) => (
                        <div key={group.title}>
                          <p className="mb-1.5 text-[11px] font-semibold text-gray-400">
                            {group.title}
                          </p>
                          <div className="space-y-1">
                            {group.items.map((item) => (
                              <div
                                key={item.keys}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-gray-500">{item.desc}</span>
                                <kbd className="rounded border border-white/10 bg-white/5 px-2 py-0.5
                                                text-[10px] text-gray-400">
                                  {item.keys}
                                </kbd>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ---- Generate PDF Report ---- */}
            <div className="border-t border-white/10 px-5 py-4">
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="flex w-full items-center justify-center gap-2 rounded-xl
                           bg-orange-500 px-4 py-3 text-sm font-semibold text-white
                           transition hover:bg-orange-600 active:scale-[0.98]
                           disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {generatingPdf ? 'Generating...' : 'Generate Performance Report (PDF)'}
              </button>
              <p className="mt-2 text-center text-[11px] text-gray-600">
                Exports pending, overdue, in-progress, and verified metrics
              </p>
            </div>

            {/* ---- Footer hint ---- */}
            <div className="border-t border-white/10 px-5 py-2.5 text-center">
              <span className="text-[11px] text-gray-600">
                Press{' '}
                <kbd className="rounded border border-white/10 bg-white/5 px-1 text-[10px]">
                  Ctrl+K
                </kbd>{' '}
                to toggle &middot;{' '}
                <kbd className="rounded border border-white/10 bg-white/5 px-1 text-[10px]">
                  Esc
                </kbd>{' '}
                to close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
