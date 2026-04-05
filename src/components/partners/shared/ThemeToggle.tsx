'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/lib/contexts/theme-context'
import { useState, useRef, useEffect } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ]

  const current = options.find(o => o.value === theme) || options[1]
  const CurrentIcon = current.icon

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
        title={`Theme: ${current.label}`}
      >
        <CurrentIcon className="w-5 h-5" />
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-36 bg-gray-900/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
          {options.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => { setTheme(value); setShowMenu(false) }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                theme === value
                  ? 'text-orange-400 bg-orange-500/10'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
