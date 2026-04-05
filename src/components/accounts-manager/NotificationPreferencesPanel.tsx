'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Mail,
  Smartphone,
  Moon,
  Clock,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  VolumeX,
  Settings,
  Globe,
  FileText,
  Users,
  AlertTriangle,
  CheckSquare,
  BarChart3,
  Calendar,
  DollarSign,
  Zap,
} from 'lucide-react'

interface ChannelPrefs {
  in_app: boolean
  email: boolean
  push: boolean
}

interface CategoryPrefs {
  [key: string]: ChannelPrefs
}

interface QuietHours {
  enabled: boolean
  start: string
  end: string
}

interface DigestSettings {
  enabled: boolean
  frequency: 'realtime' | 'daily' | 'weekly'
  time: string
}

interface NotificationPreferences {
  channels: ChannelPrefs
  categories: CategoryPrefs
  quiet_hours: QuietHours
  digest: DigestSettings
}

interface Props {
  onSave?: () => void
}

const CATEGORY_META: {
  key: string
  label: string
  description: string
  icon: typeof Bell
}[] = [
  { key: 'application_updates', label: 'Application Updates', description: 'Loan application status changes', icon: FileText },
  { key: 'team_alerts', label: 'Team Alerts', description: 'Team member activities and assignments', icon: Users },
  { key: 'escalations', label: 'Escalations', description: 'Priority escalation notifications', icon: AlertTriangle },
  { key: 'approvals', label: 'Approvals', description: 'Approval requests and decisions', icon: CheckSquare },
  { key: 'system_updates', label: 'System Updates', description: 'Platform and system notifications', icon: Settings },
  { key: 'performance_reports', label: 'Performance Reports', description: 'Team and individual performance data', icon: BarChart3 },
  { key: 'leave_requests', label: 'Leave Requests', description: 'Team leave and attendance alerts', icon: Calendar },
  { key: 'payout_notifications', label: 'Payout Notifications', description: 'Payout processing and verification', icon: DollarSign },
]

const DIGEST_OPTIONS = [
  { value: 'realtime', label: 'Real-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
] as const

const DEFAULT_PREFERENCES: NotificationPreferences = {
  channels: { in_app: true, email: true, push: false },
  categories: {
    application_updates: { in_app: true, email: true, push: false },
    team_alerts: { in_app: true, email: true, push: false },
    escalations: { in_app: true, email: true, push: false },
    approvals: { in_app: true, email: true, push: false },
    system_updates: { in_app: true, email: false, push: false },
    performance_reports: { in_app: true, email: true, push: false },
    leave_requests: { in_app: true, email: true, push: false },
    payout_notifications: { in_app: true, email: true, push: false },
  },
  quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
  digest: { enabled: true, frequency: 'daily', time: '09:00' },
}

export default function NotificationPreferencesPanel({ onSave }: Props) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [muteAll, setMuteAll] = useState(false)

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/employees/notifications/preferences')
      const data = await response.json()

      if (response.ok && data.success && data.data?.preferences) {
        setPreferences(data.data.preferences)
        // Check if all are muted
        const cats = data.data.preferences.categories
        const allMuted = Object.values(cats).every(
          (c) => !(c as ChannelPrefs).in_app && !(c as ChannelPrefs).email && !(c as ChannelPrefs).push
        )
        setMuteAll(allMuted)
      }
    } catch {
      setError('Failed to load notification preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  const handleCategoryToggle = (categoryKey: string, channel: keyof ChannelPrefs) => {
    setPreferences((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryKey]: {
          ...prev.categories[categoryKey],
          [channel]: !prev.categories[categoryKey][channel],
        },
      },
    }))
    if (muteAll) setMuteAll(false)
  }

  const handleMuteAll = () => {
    const newMuted = !muteAll
    setMuteAll(newMuted)
    const newCategories: CategoryPrefs = {}
    for (const key of Object.keys(preferences.categories)) {
      newCategories[key] = {
        in_app: !newMuted,
        email: !newMuted,
        push: false,
      }
    }
    setPreferences((prev) => ({ ...prev, categories: newCategories }))
  }

  const handleQuietHoursToggle = () => {
    setPreferences((prev) => ({
      ...prev,
      quiet_hours: { ...prev.quiet_hours, enabled: !prev.quiet_hours.enabled },
    }))
  }

  const handleQuietHoursTime = (field: 'start' | 'end', value: string) => {
    setPreferences((prev) => ({
      ...prev,
      quiet_hours: { ...prev.quiet_hours, [field]: value },
    }))
  }

  const handleDigestToggle = () => {
    setPreferences((prev) => ({
      ...prev,
      digest: { ...prev.digest, enabled: !prev.digest.enabled },
    }))
  }

  const handleDigestFrequency = (frequency: 'realtime' | 'daily' | 'weekly') => {
    setPreferences((prev) => ({
      ...prev,
      digest: { ...prev.digest, frequency },
    }))
  }

  const handleDigestTime = (time: string) => {
    setPreferences((prev) => ({
      ...prev,
      digest: { ...prev.digest, time },
    }))
  }

  const handleReset = () => {
    setPreferences(DEFAULT_PREFERENCES)
    setMuteAll(false)
    setError(null)
    setSuccess(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const response = await fetch('/api/employees/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save preferences')
      }

      setSuccess(true)
      onSave?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  // Toggle switch component
  const Toggle = ({
    checked,
    onChange,
    label,
    color = 'bg-orange-500',
  }: {
    checked: boolean
    onChange: () => void
    label: string
    color?: string
  }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
        aria-label={label}
        role="switch"
        aria-checked={checked}
      />
      <div
        className={`w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:${color}`}
      />
    </label>
  )

  if (loading) {
    return (
      <div className="frosted-card p-6 rounded-lg flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-poppins text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              Notification Preferences
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Control how and when you receive notifications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success / Error Messages */}
        {success && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Preferences saved successfully!
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Quick Actions: Mute All */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <VolumeX className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-white font-medium">Mute All Notifications</p>
              <p className="text-gray-400 text-sm">
                Temporarily disable all notification channels
              </p>
            </div>
          </div>
          <Toggle
            checked={muteAll}
            onChange={handleMuteAll}
            label="Mute all notifications"
            color="bg-red-500"
          />
        </div>
      </div>

      {/* Category Matrix Grid */}
      <div className="frosted-card rounded-lg overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-500" />
            Category Controls
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Configure notifications per category and channel
          </p>
        </div>

        {/* Column Headers */}
        <div className="bg-white/5 px-6 py-3 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10">
          <div className="col-span-6">Category</div>
          <div className="col-span-2 flex flex-col items-center gap-1">
            <Bell className="w-4 h-4 text-orange-400" />
            In-App
          </div>
          <div className="col-span-2 flex flex-col items-center gap-1">
            <Mail className="w-4 h-4 text-blue-400" />
            Email
          </div>
          <div className="col-span-2 flex flex-col items-center gap-1">
            <Smartphone className="w-4 h-4 text-purple-400" />
            Push
          </div>
        </div>

        {/* Category Rows */}
        <div className="divide-y divide-white/5">
          {CATEGORY_META.map((cat) => {
            const prefs = preferences.categories[cat.key] || {
              in_app: true,
              email: true,
              push: false,
            }
            const Icon = cat.icon
            return (
              <div
                key={cat.key}
                className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-white/[0.02] transition-colors"
              >
                <div className="col-span-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{cat.label}</p>
                    <p className="text-gray-500 text-xs">{cat.description}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <Toggle
                    checked={prefs.in_app}
                    onChange={() => handleCategoryToggle(cat.key, 'in_app')}
                    label={`${cat.label} in-app notifications`}
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Toggle
                    checked={prefs.email}
                    onChange={() => handleCategoryToggle(cat.key, 'email')}
                    label={`${cat.label} email notifications`}
                    color="bg-blue-500"
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Toggle
                    checked={prefs.push}
                    onChange={() => handleCategoryToggle(cat.key, 'push')}
                    label={`${cat.label} push notifications`}
                    color="bg-purple-500"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="frosted-card p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Moon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-white font-medium">Quiet Hours</p>
              <p className="text-gray-400 text-sm">
                Silence non-urgent notifications during specific hours
              </p>
            </div>
          </div>
          <Toggle
            checked={preferences.quiet_hours.enabled}
            onChange={handleQuietHoursToggle}
            label="Enable quiet hours"
            color="bg-indigo-500"
          />
        </div>

        {preferences.quiet_hours.enabled && (
          <div className="pl-[52px] space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Start Time
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours.start}
                  onChange={(e) => handleQuietHoursTime('start', e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                  aria-label="Quiet hours start time"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  End Time
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours.end}
                  onChange={(e) => handleQuietHoursTime('end', e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                  aria-label="Quiet hours end time"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Globe className="w-3.5 h-3.5" />
              <span>Times shown in your timezone: {userTimezone}</span>
            </div>
          </div>
        )}
      </div>

      {/* Digest Settings */}
      <div className="frosted-card p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-medium">Email Digest</p>
              <p className="text-gray-400 text-sm">
                Batch notifications into a summary email
              </p>
            </div>
          </div>
          <Toggle
            checked={preferences.digest.enabled}
            onChange={handleDigestToggle}
            label="Enable email digest"
            color="bg-cyan-500"
          />
        </div>

        {preferences.digest.enabled && (
          <div className="pl-[52px] space-y-4">
            {/* Frequency Selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">
                Frequency
              </label>
              <div className="flex gap-2">
                {DIGEST_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleDigestFrequency(option.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      preferences.digest.frequency === option.value
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Time */}
            {preferences.digest.frequency !== 'realtime' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Preferred Time
                </label>
                <input
                  type="time"
                  value={preferences.digest.time}
                  onChange={(e) => handleDigestTime(e.target.value)}
                  className="w-48 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                  aria-label="Digest preferred time"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Save Bar */}
      <div className="frosted-card p-4 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Zap className="w-4 h-4 text-orange-400" />
          Changes are saved when you click Save Preferences
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
