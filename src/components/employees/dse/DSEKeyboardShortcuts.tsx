'use client'

import { useEffect, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Keyboard } from 'lucide-react'

/**
 * DSE Keyboard Shortcuts - Fortune 500 Grade Productivity Enhancement
 *
 * Global shortcuts available across all DSE pages:
 *   Alt+K   → Quick Search (navigate to leads with search focus)
 *   Alt+N   → New Lead
 *   Ctrl+Shift+P → My Pipeline
 *   Ctrl+Shift+C → Customer Database
 *   Ctrl+Shift+M → My Proposals
 *   Ctrl+Shift+S → Schedule
 *   Ctrl+Shift+D → Dashboard
 *   ?       → Show shortcuts help (when not in an input)
 *   Escape  → Close any open modal/panel
 */

interface ShortcutAction {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  category: string
  action: () => void
}

interface DSEKeyboardShortcutsProps {
  onQuickSearch?: () => void
  onNewLead?: () => void
  onCloseModal?: () => void
}

export default function DSEKeyboardShortcuts({
  onQuickSearch,
  onNewLead,
  onCloseModal,
}: DSEKeyboardShortcutsProps) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  const shortcuts: ShortcutAction[] = useMemo(() => [
    // Navigation
    {
      key: 'd',
      ctrl: true,
      shift: true,
      description: 'Go to Dashboard',
      category: 'Navigation',
      action: () => router.push('/employees'),
    },
    {
      key: 'p',
      ctrl: true,
      shift: true,
      description: 'Go to My Pipeline',
      category: 'Navigation',
      action: () => router.push('/employees/direct-sales-executive/leads'),
    },
    {
      key: 'c',
      ctrl: true,
      shift: true,
      description: 'Go to Customer Database',
      category: 'Navigation',
      action: () => router.push('/employees/direct-sales-executive/customer-database'),
    },
    {
      key: 'm',
      ctrl: true,
      shift: true,
      description: 'Go to My Proposals',
      category: 'Navigation',
      action: () => router.push('/employees/direct-sales-executive/my-proposals'),
    },
    {
      key: 's',
      ctrl: true,
      shift: true,
      description: 'Go to Schedule',
      category: 'Navigation',
      action: () => router.push('/employees/direct-sales-executive/schedule'),
    },
    // Actions
    {
      key: 'k',
      alt: true,
      description: 'Quick Search',
      category: 'Actions',
      action: () => router.push('/employees/direct-sales-executive/leads/my-leads?focus=search'),
    },
    {
      key: 'n',
      alt: true,
      description: 'New Lead',
      category: 'Actions',
      action: () => {
        if (onNewLead) {
          onNewLead()
        } else {
          router.push('/employees/direct-sales-executive/leads/new')
        }
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      // ? key shows help (only when not in input)
      if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowHelp((prev) => !prev)
        return
      }

      // Escape closes help panel
      if (e.key === 'Escape') {
        setShowHelp(false)
        return
      }

      // Match against registered shortcuts
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl
          ? e.ctrlKey || e.metaKey
          : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          // Allow Ctrl+C/V/X/Z in inputs
          if (isInput && shortcut.ctrl && !shortcut.shift) {
            if (['c', 'v', 'x', 'z', 'a'].includes(shortcut.key.toLowerCase())) {
              return
            }
          }

          e.preventDefault()
          shortcut.action()
          return
        }
      }
    },
    [shortcuts, showHelp]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!showHelp) return null

  // Group shortcuts by category
  const grouped = shortcuts.reduce(
    (acc, s) => {
      if (!acc[s.category]) acc[s.category] = []
      acc[s.category].push(s)
      return acc
    },
    {} as Record<string, ShortcutAction[]>
  )

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setShowHelp(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Keyboard className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close shortcuts panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-5 last:mb-0">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-1.5">
                {items.map((shortcut) => (
                  <div
                    key={`${shortcut.ctrl}-${shortcut.shift}-${shortcut.key}`}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-gray-300">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.ctrl && (
                        <>
                          <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-gray-300">
                            Ctrl
                          </kbd>
                          <span className="text-gray-600">+</span>
                        </>
                      )}
                      {shortcut.alt && (
                        <>
                          <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-gray-300">
                            Alt
                          </kbd>
                          <span className="text-gray-600">+</span>
                        </>
                      )}
                      {shortcut.shift && (
                        <>
                          <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-gray-300">
                            Shift
                          </kbd>
                          <span className="text-gray-600">+</span>
                        </>
                      )}
                      <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-gray-300 uppercase">
                        {shortcut.key}
                      </kbd>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Additional non-registered shortcuts */}
          <div className="mb-0">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              General
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-300">Show this help</span>
                <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-gray-300">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-300">Close modal / panel</span>
                <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded text-gray-300">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded">?</kbd> anywhere to toggle this panel
          </p>
        </div>
      </div>
    </div>
  )
}
