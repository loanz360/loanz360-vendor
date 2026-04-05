'use client'

import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { KEYBOARD_SHORTCUTS } from '@/hooks/superadmin/useKeyboardShortcuts'

export function KeyboardShortcutsPanel() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('show-keyboard-shortcuts', handler)
    return () => window.removeEventListener('show-keyboard-shortcuts', handler)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsOpen(false)}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white font-poppins">Keyboard Shortcuts</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <span className="text-gray-300 text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j}>
                    <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300 font-mono">
                      {key}
                    </kbd>
                    {j < shortcut.keys.length - 1 && <span className="text-gray-500 mx-1">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs">?</kbd> anytime to show this panel
        </p>
      </div>
    </div>
  )
}
