/**
 * Full Width Tab Component
 * Matches the screenshot style with end-to-end tabs
 * Orange active state, ash hover effect
 */

'use client'

import React from 'react'

export interface TabItem {
  key: string
  label: string
  count?: number
}

interface FullWidthTabsProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (key: string) => void
  className?: string
}

export default function FullWidthTabs({
  tabs,
  activeTab,
  onTabChange,
  className = ''
}: FullWidthTabsProps) {
  return (
    <div className={`w-full bg-gray-900/80 rounded-full p-1.5 ${className}`}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                flex items-center justify-center gap-2 px-4 py-3 font-medium text-sm
                transition-all duration-200 rounded-full
                ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
                }
              `}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`
                    flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ml-1
                    ${isActive ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-300'}
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
