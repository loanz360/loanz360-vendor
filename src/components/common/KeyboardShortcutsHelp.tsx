'use client'

import React, { useState, useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

interface ShortcutInfo {
  keys: string[]
  description: string
  category: string
}

const DEFAULT_SHORTCUTS: ShortcutInfo[] = [
  { keys: ['/'], description: 'Focus search bar', category: 'Navigation' },
  { keys: ['Ctrl', 'N'], description: 'Create new item', category: 'Actions' },
  { keys: ['Ctrl', 'S'], description: 'Save changes', category: 'Actions' },
  { keys: ['Ctrl', 'Shift', 'E'], description: 'Export data', category: 'Actions' },
  { keys: ['Ctrl', 'Shift', 'R'], description: 'Refresh data', category: 'Actions' },
  { keys: ['Esc'], description: 'Close modal / Cancel', category: 'Navigation' },
  { keys: ['Shift', '?'], description: 'Show this help', category: 'General' },
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'E'], description: 'Go to Employees', category: 'Navigation' },
  { keys: ['G', 'P'], description: 'Go to Payroll', category: 'Navigation' },
  { keys: ['G', 'A'], description: 'Go to Attendance', category: 'Navigation' },
]

export function KeyboardShortcutsHelp({ shortcuts = DEFAULT_SHORTCUTS }: { shortcuts?: ShortcutInfo[] }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setIsOpen(prev => !prev)
        }
      }
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  if (!isOpen) return null

  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[#FF6700]" />
            <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 text-gray-400 hover:text-white" aria-label="Close shortcuts help">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-6">
          {categories.map(cat => (
            <div key={cat}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{cat}</h4>
              <div className="space-y-2">
                {shortcuts.filter(s => s.category === cat).map(s => (
                  <div key={s.description} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          {i > 0 && <span className="text-gray-600 text-xs">+</span>}
                          <kbd className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-gray-300 font-mono min-w-[24px] text-center">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700 text-center">
          <span className="text-xs text-gray-500">Press <kbd className="px-1.5 py-0.5 bg-gray-900 border border-gray-600 rounded text-xs">Shift + ?</kbd> to toggle this panel</span>
        </div>
      </div>
    </div>
  )
}
