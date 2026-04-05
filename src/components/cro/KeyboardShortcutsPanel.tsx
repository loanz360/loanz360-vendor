'use client'

import { useEffect, useRef } from 'react'
import { Keyboard, X } from 'lucide-react'
import { CRO_SHORTCUTS, type ShortcutEntry } from '@/hooks/useCROKeyboardShortcuts'

// ─── Types ──────────────────────────────────────────────────────────────────
interface KeyboardShortcutsPanelProps {
  isOpen: boolean
  onClose: () => void
  pendingChord?: string | null
}

// ─── Category metadata ──────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<ShortcutEntry['category'], string> = {
  navigation: 'Navigation',
  action: 'Actions',
  search: 'Search',
  general: 'General',
}

const CATEGORY_ORDER: ShortcutEntry['category'][] = [
  'navigation',
  'action',
  'search',
  'general',
]

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Group shortcuts by their category. */
function groupByCategory(shortcuts: ShortcutEntry[]) {
  const grouped = new Map<ShortcutEntry['category'], ShortcutEntry[]>()
  for (const entry of shortcuts) {
    const list = grouped.get(entry.category) ?? []
    list.push(entry)
    grouped.set(entry.category, list)
  }
  return grouped
}

/**
 * Render a key combo string (e.g. "g d") into styled <kbd> elements.
 * Chord keys like "g d" are split so each key gets its own badge with a
 * "then" indicator between them.
 */
function KeyCombo({ keys }: { keys: string }) {
  const parts = keys.split(' ')

  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, idx) => (
        <span key={idx} className="inline-flex items-center gap-1">
          {idx > 0 && (
            <span className="text-gray-500 text-xs select-none" aria-hidden>
              then
            </span>
          )}
          <kbd className="inline-flex items-center justify-center min-w-[1.5rem] bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm font-mono text-gray-200 shadow-sm">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function KeyboardShortcutsPanel({
  isOpen,
  onClose,
  pendingChord,
}: KeyboardShortcutsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const grouped = groupByCategory(CRO_SHORTCUTS)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKey, { capture: true })
    return () => window.removeEventListener('keydown', handleKey, { capture: true })
  }, [isOpen, onClose])

  // Focus trap: keep focus inside the panel when open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        // Close when clicking the overlay background
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        tabIndex={-1}
        className="relative w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 text-gray-100 shadow-2xl animate-in zoom-in-95 fade-in duration-200 outline-none"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800">
              <Keyboard className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              Keyboard Shortcuts
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            aria-label="Close shortcuts panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Pending chord indicator ─────────────────────────────────── */}
        {pendingChord && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
            </span>
            <span className="text-orange-300">
              Press next key&hellip;{' '}
              <kbd className="inline-flex items-center justify-center min-w-[1.5rem] bg-gray-700 border border-gray-600 rounded px-2 py-0.5 font-mono text-orange-400">
                {pendingChord}
              </kbd>
              <span className="text-orange-500 mx-1" aria-hidden>&rarr;</span>
            </span>
          </div>
        )}

        {/* ── Shortcut categories ─────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const entries = grouped.get(category)
            if (!entries || entries.length === 0) return null

            return (
              <section key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.keys}
                      className="flex items-center justify-between gap-4 rounded-lg bg-gray-800/50 px-4 py-2.5"
                    >
                      <span className="text-sm text-gray-300">
                        {entry.description}
                      </span>
                      <KeyCombo keys={entry.keys} />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* ── Footer hint ─────────────────────────────────────────────── */}
        <div className="border-t border-gray-700 px-6 py-3 text-center text-xs text-gray-500">
          Press <kbd className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 font-mono text-gray-400">Esc</kbd> to close
        </div>
      </div>
    </div>
  )
}
