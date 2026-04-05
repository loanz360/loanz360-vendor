'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Reminder {
  leadId: string
  customerName: string
  loanType: string
  status: string
  lastActivity: string
  daysInactive: number
  urgency: 'low' | 'medium' | 'high'
  message: string
}

interface FollowUpRemindersProps {
  partnerType: 'ba' | 'bp' | 'cp'
  maxItems?: number
}

const URGENCY_CONFIG = {
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Clock },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Bell },
}

export function FollowUpReminders({ partnerType, maxItems = 5 }: FollowUpRemindersProps) {
  const router = useRouter()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/reminders?days=3&limit=${maxItems}`)
      const result = await res.json()
      if (result.success) {
        setReminders(result.data)
      }
    } catch {
      // Silent fail - reminders are non-critical
    } finally {
      setLoading(false)
    }
  }, [maxItems])

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  if (loading || reminders.length === 0) return null

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 overflow-hidden">
      <div className="p-3 border-b border-orange-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-medium text-orange-400">Follow-up Reminders</span>
        </div>
        <span className="text-[10px] text-orange-400/60 px-2 py-0.5 rounded-full bg-orange-500/10">
          {reminders.length} pending
        </span>
      </div>
      <div className="divide-y divide-gray-800/30">
        {reminders.map((reminder) => {
          const cfg = URGENCY_CONFIG[reminder.urgency]
          const Icon = cfg.icon
          return (
            <button
              key={reminder.leadId}
              onClick={() => router.push(`/partners/${partnerType}/leads`)}
              className="w-full p-3 flex items-center gap-3 hover:bg-gray-800/20 transition-colors text-left"
            >
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{reminder.customerName}</p>
                <p className="text-[10px] text-gray-500">{reminder.loanType} · {reminder.daysInactive}d inactive</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
