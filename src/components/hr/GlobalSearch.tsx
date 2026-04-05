'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ArrowRight, Users, Calendar, DollarSign, FileText, Shield, BookOpen, Briefcase, ClipboardList } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchResult {
  id: string
  title: string
  description: string
  module: string
  icon: string
  url: string
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  employees: Users,
  attendance: Calendar,
  payroll: DollarSign,
  documents: FileText,
  compliance: Shield,
  learning: BookOpen,
  recruitment: Briefcase,
  reviews: ClipboardList,
}

const HR_MODULES = [
  { label: 'Dashboard', url: '/employees/hr/dashboard', keywords: ['home', 'overview', 'stats'] },
  { label: 'Employees', url: '/employees/hr/employees', keywords: ['staff', 'people', 'team', 'manage'] },
  { label: 'Employee Attendance', url: '/employees/hr/employee-attendance', keywords: ['present', 'absent', 'leave'] },
  { label: 'Payroll', url: '/employees/hr/payroll', keywords: ['salary', 'pay', 'compensation', 'wages'] },
  { label: 'Payroll Reports', url: '/employees/hr/payroll/reports', keywords: ['salary report', 'pay summary'] },
  { label: 'Payroll Generate', url: '/employees/hr/payroll/generate', keywords: ['run payroll', 'process salary'] },
  { label: 'Performance Reviews', url: '/employees/hr/reviews', keywords: ['appraisal', 'evaluation', 'rating'] },
  { label: '360 Feedback', url: '/employees/hr/feedback-360', keywords: ['peer review', 'feedback'] },
  { label: 'PIP', url: '/employees/hr/pip', keywords: ['performance improvement', 'warning'] },
  { label: 'Resignations', url: '/employees/hr/resignations', keywords: ['exit', 'quit', 'leave company', 'offboarding'] },
  { label: 'Recruitment', url: '/employees/hr/recruitment', keywords: ['hiring', 'candidates', 'jobs', 'requisition'] },
  { label: 'Learning', url: '/employees/hr/learning', keywords: ['training', 'courses', 'skills', 'development'] },
  { label: 'Benefits', url: '/employees/hr/benefits', keywords: ['insurance', 'health', 'claims', 'perks'] },
  { label: 'Compliance', url: '/employees/hr/compliance', keywords: ['pf', 'esi', 'tax', 'statutory'] },
  { label: 'BGV', url: '/employees/hr/bgv', keywords: ['background verification', 'check'] },
  { label: 'Documents', url: '/employees/hr/documents', keywords: ['files', 'upload', 'download'] },
  { label: 'Letters', url: '/employees/hr/letters', keywords: ['offer letter', 'experience letter', 'template'] },
  { label: 'Holidays', url: '/employees/hr/holidays', keywords: ['holiday calendar', 'public holidays', 'off days'] },
  { label: 'Org Chart', url: '/employees/hr/org-chart', keywords: ['organization', 'hierarchy', 'structure'] },
  { label: 'Profile Reviews', url: '/employees/hr/profile-reviews', keywords: ['profile check', 'data review'] },
  { label: 'Support Tickets', url: '/employees/hr/support-tickets', keywords: ['help', 'issues', 'complaints'] },
  { label: 'Canned Responses', url: '/employees/hr/canned-responses', keywords: ['templates', 'quick replies'] },
  { label: 'Audit Logs', url: '/employees/hr/audit-logs', keywords: ['history', 'changes', 'activity'] },
  { label: 'Analytics', url: '/employees/hr/analytics', keywords: ['reports', 'charts', 'metrics', 'data'] },
  { label: 'Notification Center', url: '/employees/hr/notification-center', keywords: ['alerts', 'messages', 'send'] },
  { label: 'Office Timings', url: '/employees/hr/office-timings', keywords: ['work hours', 'shift', 'schedule'] },
  { label: 'Onboarding', url: '/employees/hr/onboarding', keywords: ['new hire', 'joining', 'welcome'] },
]

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debouncedQuery = useDebounce(query, 200)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Filter modules based on search query
  const results = React.useMemo(() => {
    if (!debouncedQuery.trim()) return HR_MODULES.slice(0, 8)
    const q = debouncedQuery.toLowerCase()
    return HR_MODULES.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.keywords.some(k => k.includes(q))
    )
  }, [debouncedQuery])

  // Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      router.push(results[selectedIndex].url)
      setIsOpen(false)
    }
  }, [results, selectedIndex, router])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

      {/* Search Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search HR modules..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-gray-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No modules found for &quot;{query}&quot;
            </div>
          ) : (
            results.map((item, index) => {
              const IconComp = MODULE_ICONS[item.label.toLowerCase()] || FileText
              return (
                <button
                  key={item.url}
                  onClick={() => { router.push(item.url); setIsOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    index === selectedIndex ? 'bg-[#FF6700]/10 text-[#FF6700]' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <IconComp className="w-4 h-4 shrink-0" />
                  <span className="text-sm flex-1">{item.label}</span>
                  {index === selectedIndex && <ArrowRight className="w-3 h-3" />}
                </button>
              )
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/10 text-[10px] text-gray-500">
          <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono">Enter</kbd> Open</span>
          <span><kbd className="font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
