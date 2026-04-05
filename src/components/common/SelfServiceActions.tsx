'use client'

import React, { useState } from 'react'
import { FileText, Calendar, DollarSign, Clock, ChevronRight, Loader2 } from 'lucide-react'

interface QuickAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void | Promise<void>
  badge?: string
  badgeColor?: string
}

interface SelfServiceActionsProps {
  actions: QuickAction[]
  title?: string
  columns?: 2 | 3 | 4
}

export function SelfServiceActions({ actions, title = 'Quick Actions', columns = 3 }: SelfServiceActionsProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleClick = async (action: QuickAction) => {
    if (action.href) {
      window.location.href = action.href
      return
    }
    if (action.onClick) {
      setLoadingId(action.id)
      try {
        await action.onClick()
      } finally {
        setLoadingId(null)
      }
    }
  }

  const gridCols = columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div>
      {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
      <div className={`grid ${gridCols} gap-3`}>
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            disabled={loadingId === action.id}
            className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:bg-gray-700/50 hover:border-[#FF6700]/30 transition-all duration-200 text-left group disabled:opacity-50"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#FF6700]/10 flex items-center justify-center text-[#FF6700] group-hover:bg-[#FF6700]/20 transition-colors">
              {loadingId === action.id ? <Loader2 className="w-5 h-5 animate-spin" /> : action.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{action.label}</span>
                {action.badge && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${action.badgeColor || 'bg-[#FF6700]/20 text-[#FF6700]'}`}>
                    {action.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 truncate block">{action.description}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#FF6700] transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// Pre-defined action sets for common portals
export const HR_QUICK_ACTIONS: QuickAction[] = [
  { id: 'leave-approvals', label: 'Leave Approvals', description: 'Review pending requests', icon: <Calendar className="w-5 h-5" />, href: '/employees/hr/employee-attendance' },
  { id: 'payroll', label: 'Run Payroll', description: 'Process monthly payroll', icon: <DollarSign className="w-5 h-5" />, href: '/employees/hr/payroll' },
  { id: 'attendance', label: 'Attendance', description: 'View attendance records', icon: <Clock className="w-5 h-5" />, href: '/employees/hr/attendance' },
  { id: 'letters', label: 'Generate Letters', description: 'Create offer/appointment letters', icon: <FileText className="w-5 h-5" />, href: '/employees/hr/letters' },
]
