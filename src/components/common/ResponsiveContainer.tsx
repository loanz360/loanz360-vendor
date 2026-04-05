'use client'

import React, { useState } from 'react'
import { Menu, X } from 'lucide-react'

interface ResponsiveContainerProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  title?: string
  className?: string
}

export function ResponsiveContainer({ children, sidebar, title, className = '' }: ResponsiveContainerProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className={`flex h-full ${className}`}>
      {/* Mobile sidebar overlay */}
      {sidebar && isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 z-50 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <span className="text-sm font-semibold text-white">{title || 'Menu'}</span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-gray-400 hover:text-white" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      {sidebar && (
        <div className="hidden lg:block lg:w-64 lg:flex-shrink-0">
          {sidebar}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header bar */}
        {sidebar && (
          <div className="lg:hidden flex items-center gap-3 p-4 border-b border-gray-800">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {title && <span className="text-sm font-semibold text-white">{title}</span>}
          </div>
        )}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
