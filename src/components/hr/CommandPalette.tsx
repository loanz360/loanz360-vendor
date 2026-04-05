'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, Zap, Users, Calendar, DollarSign, FileText, Shield, BookOpen, BarChart3, Bell, Settings, ArrowRight, Command } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'

interface PaletteAction {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  category: 'navigate' | 'action' | 'search'
  keywords: string[]
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debouncedQuery = useDebounce(query, 150)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const navigate = useCallback((path: string) => {
    router.push(path)
    onClose()
  }, [router, onClose])

  const actions: PaletteAction[] = useMemo(() => [
    // Quick Actions
    { id: 'add-employee', label: 'Add New Employee', description: 'Create a new employee record', icon: Users, category: 'action', keywords: ['hire', 'new', 'create', 'onboard'], action: () => navigate('/employees/hr/employees?action=add') },
    { id: 'approve-leaves', label: 'Approve Pending Leaves', description: 'Review and approve leave requests', icon: Calendar, category: 'action', keywords: ['leave', 'approve', 'pending'], action: () => navigate('/employees/hr/employee-attendance?tab=leaves') },
    { id: 'run-payroll', label: 'Generate Payroll', description: 'Process monthly payroll', icon: DollarSign, category: 'action', keywords: ['salary', 'pay', 'process', 'generate'], action: () => navigate('/employees/hr/payroll/generate') },
    { id: 'send-notification', label: 'Send Notification', description: 'Broadcast a notification to employees', icon: Bell, category: 'action', keywords: ['notify', 'announce', 'broadcast', 'message'], action: () => navigate('/employees/hr/notification-center') },
    { id: 'create-letter', label: 'Generate Letter', description: 'Create an offer/experience letter', icon: FileText, category: 'action', keywords: ['offer', 'experience', 'letter', 'document'], action: () => navigate('/employees/hr/letters') },
    { id: 'start-review', label: 'Start Performance Review', description: 'Initiate a new review cycle', icon: BarChart3, category: 'action', keywords: ['review', 'appraisal', 'performance', 'evaluation'], action: () => navigate('/employees/hr/reviews') },

    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', icon: Zap, category: 'navigate', keywords: ['home', 'overview', 'main'], action: () => navigate('/employees/hr/dashboard') },
    { id: 'nav-employees', label: 'Go to Employees', icon: Users, category: 'navigate', keywords: ['staff', 'people', 'team'], action: () => navigate('/employees/hr/employees') },
    { id: 'nav-attendance', label: 'Go to Attendance', icon: Calendar, category: 'navigate', keywords: ['present', 'absent'], action: () => navigate('/employees/hr/employee-attendance') },
    { id: 'nav-payroll', label: 'Go to Payroll', icon: DollarSign, category: 'navigate', keywords: ['salary', 'wages', 'pay'], action: () => navigate('/employees/hr/payroll') },
    { id: 'nav-recruitment', label: 'Go to Recruitment', icon: Users, category: 'navigate', keywords: ['hiring', 'jobs', 'candidates'], action: () => navigate('/employees/hr/recruitment') },
    { id: 'nav-compliance', label: 'Go to Compliance', icon: Shield, category: 'navigate', keywords: ['pf', 'esi', 'tax', 'statutory'], action: () => navigate('/employees/hr/compliance') },
    { id: 'nav-learning', label: 'Go to Learning', icon: BookOpen, category: 'navigate', keywords: ['training', 'courses', 'skills'], action: () => navigate('/employees/hr/learning') },
    { id: 'nav-analytics', label: 'Go to Analytics', icon: BarChart3, category: 'navigate', keywords: ['reports', 'charts', 'metrics'], action: () => navigate('/employees/hr/analytics') },
    { id: 'nav-audit', label: 'Go to Audit Logs', icon: FileText, category: 'navigate', keywords: ['history', 'changes', 'activity'], action: () => navigate('/employees/hr/audit-logs') },
    { id: 'nav-settings', label: 'Go to Office Timings', icon: Settings, category: 'navigate', keywords: ['settings', 'config', 'office', 'hours'], action: () => navigate('/employees/hr/office-timings') },
  ], [navigate])

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return actions
    const q = debouncedQuery.toLowerCase()
    return actions.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.keywords.some(k => k.includes(q))
    )
  }, [debouncedQuery, actions])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, PaletteAction[]> = {}
    for (const action of filtered) {
      const cat = action.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(action)
    }
    return groups
  }, [filtered])

  const flatList = useMemo(() => filtered, [filtered])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, flatList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault()
      flatList[selectedIndex].action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [flatList, selectedIndex, onClose])

  if (!isOpen) return null

  const categoryLabels: Record<string, string> = {
    action: 'Quick Actions',
    navigate: 'Navigation',
    search: 'Search',
  }

  let globalIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Command className="w-4 h-4 text-[#FF6700]" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-gray-400 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[350px] overflow-y-auto py-1">
          {flatList.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No commands found for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category] || category}
                  </span>
                </div>
                {items.map(item => {
                  const idx = globalIndex++
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        idx === selectedIndex ? 'bg-[#FF6700]/10 text-[#FF6700]' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{item.label}</span>
                        {item.description && (
                          <span className="text-[10px] text-gray-500 ml-2">{item.description}</span>
                        )}
                      </div>
                      {idx === selectedIndex && <ArrowRight className="w-3 h-3 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/10 text-[10px] text-gray-500">
          <span><kbd className="font-mono">&#8593;&#8595;</kbd> Navigate</span>
          <span><kbd className="font-mono">Enter</kbd> Execute</span>
          <span><kbd className="font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
