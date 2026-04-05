'use client'

import React, { useState, useCallback } from 'react'
import { Bell, Mail, MessageSquare, Smartphone, Save, RotateCcw } from 'lucide-react'

interface NotificationChannel {
  key: string
  label: string
  icon: React.ElementType
  description: string
}

const CHANNELS: NotificationChannel[] = [
  { key: 'in_app', label: 'In-App', icon: Bell, description: 'Notifications in the portal' },
  { key: 'email', label: 'Email', icon: Mail, description: 'Sent to your work email' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, description: 'WhatsApp Business messages' },
  { key: 'push', label: 'Push', icon: Smartphone, description: 'Browser push notifications' },
]

interface NotificationCategory {
  key: string
  label: string
  description: string
  events: NotificationEvent[]
}

interface NotificationEvent {
  key: string
  label: string
  description: string
  defaultChannels: string[]
}

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'leaves',
    label: 'Leave Management',
    description: 'Leave requests, approvals, and balances',
    events: [
      { key: 'leave_request', label: 'New Leave Request', description: 'When someone requests leave', defaultChannels: ['in_app', 'email'] },
      { key: 'leave_approved', label: 'Leave Approved', description: 'When your leave is approved', defaultChannels: ['in_app', 'email', 'whatsapp'] },
      { key: 'leave_rejected', label: 'Leave Rejected', description: 'When your leave is rejected', defaultChannels: ['in_app', 'email'] },
      { key: 'leave_balance_low', label: 'Low Leave Balance', description: 'When leave balance drops below 3 days', defaultChannels: ['in_app'] },
    ],
  },
  {
    key: 'payroll',
    label: 'Payroll & Salary',
    description: 'Payslips, salary credits, and tax declarations',
    events: [
      { key: 'payslip_generated', label: 'Payslip Generated', description: 'Monthly payslip available', defaultChannels: ['in_app', 'email'] },
      { key: 'salary_credited', label: 'Salary Credited', description: 'Salary has been processed', defaultChannels: ['in_app', 'email', 'whatsapp'] },
      { key: 'tax_declaration_due', label: 'Tax Declaration Due', description: 'Reminder to submit declarations', defaultChannels: ['in_app', 'email'] },
    ],
  },
  {
    key: 'performance',
    label: 'Performance & Growth',
    description: 'Reviews, feedback, and PIP updates',
    events: [
      { key: 'review_due', label: 'Review Due', description: 'Performance review period starting', defaultChannels: ['in_app', 'email'] },
      { key: 'feedback_received', label: 'Feedback Received', description: 'New 360 feedback submitted', defaultChannels: ['in_app'] },
      { key: 'pip_update', label: 'PIP Update', description: 'PIP status or milestone change', defaultChannels: ['in_app', 'email'] },
      { key: 'goal_deadline', label: 'Goal Deadline', description: 'Goal or OKR deadline approaching', defaultChannels: ['in_app'] },
    ],
  },
  {
    key: 'team',
    label: 'Team & Organization',
    description: 'New joiners, birthdays, and announcements',
    events: [
      { key: 'new_joiner', label: 'New Team Member', description: 'Someone joined your team', defaultChannels: ['in_app'] },
      { key: 'birthday', label: 'Birthday Reminder', description: 'Team member birthday', defaultChannels: ['in_app'] },
      { key: 'work_anniversary', label: 'Work Anniversary', description: 'Team member anniversary', defaultChannels: ['in_app'] },
      { key: 'announcement', label: 'Company Announcement', description: 'HR announcements and updates', defaultChannels: ['in_app', 'email'] },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance & Documents',
    description: 'Document expiry, compliance alerts',
    events: [
      { key: 'document_expiry', label: 'Document Expiring', description: 'Document needs renewal', defaultChannels: ['in_app', 'email'] },
      { key: 'compliance_alert', label: 'Compliance Alert', description: 'Statutory compliance deadline', defaultChannels: ['in_app', 'email'] },
      { key: 'policy_update', label: 'Policy Update', description: 'Company policy changed', defaultChannels: ['in_app', 'email'] },
    ],
  },
]

type Preferences = Record<string, Record<string, boolean>>

interface NotificationPreferencesProps {
  initialPreferences?: Preferences
  onSave?: (preferences: Preferences) => void
}

function getDefaultPreferences(): Preferences {
  const prefs: Preferences = {}
  for (const cat of NOTIFICATION_CATEGORIES) {
    for (const event of cat.events) {
      prefs[event.key] = {}
      for (const ch of CHANNELS) {
        prefs[event.key][ch.key] = event.defaultChannels.includes(ch.key)
      }
    }
  }
  return prefs
}

export default function NotificationPreferences({ initialPreferences, onSave }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences || getDefaultPreferences())
  const [expandedCategory, setExpandedCategory] = useState<string>(NOTIFICATION_CATEGORIES[0].key)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const togglePreference = useCallback((eventKey: string, channelKey: string) => {
    setPreferences(prev => ({
      ...prev,
      [eventKey]: {
        ...prev[eventKey],
        [channelKey]: !prev[eventKey]?.[channelKey],
      },
    }))
    setHasChanges(true)
  }, [])

  const toggleAllForEvent = useCallback((eventKey: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [eventKey]: Object.fromEntries(CHANNELS.map(ch => [ch.key, enabled])),
    }))
    setHasChanges(true)
  }, [])

  const toggleAllForChannel = useCallback((channelKey: string, enabled: boolean) => {
    setPreferences(prev => {
      const updated = { ...prev }
      for (const key in updated) {
        updated[key] = { ...updated[key], [channelKey]: enabled }
      }
      return updated
    })
    setHasChanges(true)
  }, [])

  const handleReset = useCallback(() => {
    setPreferences(getDefaultPreferences())
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave?.(preferences)
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }, [preferences, onSave])

  return (
    <div className="space-y-4">
      {/* Channel Headers */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white">Notification Preferences</h3>
          <p className="text-xs text-gray-500 mt-0.5">Choose how you want to be notified for each event</p>
        </div>
        <div className="flex items-center gap-4">
          {CHANNELS.map(ch => {
            const Icon = ch.icon
            return (
              <button
                key={ch.key}
                onClick={() => {
                  const allEnabled = Object.values(preferences).every(p => p[ch.key])
                  toggleAllForChannel(ch.key, !allEnabled)
                }}
                className="flex flex-col items-center gap-1 group"
                title={`Toggle all ${ch.label}`}
              >
                <Icon className="w-4 h-4 text-gray-400 group-hover:text-[#FF6700] transition-colors" />
                <span className="text-[9px] text-gray-500">{ch.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Categories */}
      {NOTIFICATION_CATEGORIES.map(category => (
        <div key={category.key} className="border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedCategory(expandedCategory === category.key ? '' : category.key)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/[0.07] transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-white">{category.label}</span>
              <span className="text-xs text-gray-500 ml-2">{category.description}</span>
            </div>
            <span className="text-xs text-gray-500">{category.events.length} events</span>
          </button>

          {expandedCategory === category.key && (
            <div className="divide-y divide-white/5">
              {category.events.map(event => (
                <div key={event.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">{event.label}</p>
                    <p className="text-[10px] text-gray-500">{event.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {CHANNELS.map(ch => (
                      <button
                        key={ch.key}
                        onClick={() => togglePreference(event.key, ch.key)}
                        className={`w-8 h-5 rounded-full transition-colors relative ${
                          preferences[event.key]?.[ch.key] ? 'bg-[#FF6700]' : 'bg-white/10'
                        }`}
                        aria-label={`Toggle ${ch.label} for ${event.label}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          preferences[event.key]?.[ch.key] ? 'translate-x-3.5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
        </button>
        {onSave && (
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF6700] text-white text-sm rounded-lg hover:bg-[#FF6700]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        )}
      </div>
    </div>
  )
}

export { NOTIFICATION_CATEGORIES, CHANNELS, getDefaultPreferences }
export type { NotificationCategory, NotificationEvent, NotificationChannel, Preferences }
