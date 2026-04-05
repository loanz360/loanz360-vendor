/**
 * Reusable Tab Button Component
 * Standardized tab design across the application
 */

import React from 'react'

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  count?: number
}

export default function TabButton({ active, onClick, children, icon, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm
        transition-all duration-200 min-w-[200px]
        ${
          active
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
        }
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {count !== undefined && (
        <span
          className={`
            flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold
            ${active ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-500'}
          `}
        >
          {count}
        </span>
      )}
    </button>
  )
}
