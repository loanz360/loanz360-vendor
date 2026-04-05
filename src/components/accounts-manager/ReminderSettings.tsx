'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Clock,
  Calendar,
  Mail,
  Send,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Users,
  FileWarning,
  Eye,
} from 'lucide-react'

interface ReminderConfig {
  daily_digest_enabled: boolean
  digest_time: string
  overdue_alerts: boolean
  absent_team_alert: boolean
  weekly_report: boolean
  weekly_report_day: string
}

interface PendingReminders {
  overdue_items: number
  absent_team_members: number
  applications_needing_attention: number
}

interface Props {
  onSave?: () => void
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
]

const DEFAULT_CONFIG: ReminderConfig = {
  daily_digest_enabled: true,
  digest_time: '09:00',
  overdue_alerts: true,
  absent_team_alert: true,
  weekly_report: true,
  weekly_report_day: 'monday',
}

export default function ReminderSettings({ onSave }: Props) {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULT_CONFIG)
  const [pending, setPending] = useState<PendingReminders | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [digestSuccess, setDigestSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/employees/accounts-manager/reminders')
      const data = await res.json()
      if (data.success) {
        setConfig(data.data.config)
        setPending(data.data.pending_reminders)
      } else {
        setError(data.error || 'Failed to load config')
      }
    } catch {
      setError('Failed to load reminder settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveSuccess(false)
      setError(null)
      const res = await fetch('/api/employees/accounts-manager/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', config }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        onSave?.()
      } else {
        setError(data.error || 'Failed to save')
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSendDigest = async () => {
    try {
      setSendingDigest(true)
      setDigestSuccess(false)
      setError(null)
      const res = await fetch('/api/employees/accounts-manager/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_digest' }),
      })
      const data = await res.json()
      if (data.success) {
        setDigestSuccess(true)
        setTimeout(() => setDigestSuccess(false), 3000)
      } else {
        setError(data.error || 'Failed to send digest')
      }
    } catch {
      setError('Failed to send digest')
    } finally {
      setSendingDigest(false)
    }
  }

  const updateConfig = (key: keyof ReminderConfig, value: boolean | string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  if (loading) {
    return (
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
          <span className="text-gray-400 text-sm">Loading reminder settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="frosted-card p-6 rounded-lg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-500" />
          Automated Reminders
        </h2>
        {pending && (
          <div className="flex items-center gap-3 text-xs">
            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {pending.overdue_items} overdue
            </span>
            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded flex items-center gap-1">
              <Users className="w-3 h-3" />
              {pending.absent_team_members} absent
            </span>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded flex items-center gap-1">
              <FileWarning className="w-3 h-3" />
              {pending.applications_needing_attention} attention
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Digest Toggle */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-white">Daily Digest Email</span>
            </div>
            <button
              onClick={() => updateConfig('daily_digest_enabled', !config.daily_digest_enabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                config.daily_digest_enabled ? 'bg-orange-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  config.daily_digest_enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Receive a daily summary of overdue items, absent members, and flagged applications.
          </p>
        </div>

        {/* Digest Time */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-white">Digest Send Time</span>
          </div>
          <input
            type="time"
            value={config.digest_time}
            onChange={(e) => updateConfig('digest_time', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500">Time in IST when the daily digest is generated.</p>
        </div>

        {/* Overdue Alerts */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-white">Overdue Application Alerts</span>
            </div>
            <button
              onClick={() => updateConfig('overdue_alerts', !config.overdue_alerts)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                config.overdue_alerts ? 'bg-orange-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  config.overdue_alerts ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Get notified when applications exceed their SLA processing time.
          </p>
        </div>

        {/* Absent Team Alert */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">Absent Team Member Alerts</span>
            </div>
            <button
              onClick={() => updateConfig('absent_team_alert', !config.absent_team_alert)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                config.absent_team_alert ? 'bg-orange-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  config.absent_team_alert ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Alert when team members have not logged in by the digest time.
          </p>
        </div>

        {/* Weekly Report */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">Weekly Summary Report</span>
            </div>
            <button
              onClick={() => updateConfig('weekly_report', !config.weekly_report)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                config.weekly_report ? 'bg-orange-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  config.weekly_report ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Receive a comprehensive weekly performance summary.
          </p>
        </div>

        {/* Weekly Report Day */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Weekly Report Day</span>
          </div>
          <select
            value={config.weekly_report_day}
            onChange={(e) => updateConfig('weekly_report_day', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none"
          >
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">Day of the week to receive the weekly report.</p>
        </div>
      </div>

      {/* Digest Preview */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors"
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Hide' : 'Show'} Digest Preview
        </button>

        {showPreview && (
          <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2">
              <Mail className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-white">
                Daily Accounts Digest - {formattedDate}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-gray-300">
                  <span className="text-red-400 font-bold">{pending?.overdue_items ?? 0}</span>{' '}
                  overdue items requiring immediate attention
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-gray-300">
                  <span className="text-yellow-400 font-bold">
                    {pending?.absent_team_members ?? 0}
                  </span>{' '}
                  team members not yet active today
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-gray-300">
                  <span className="text-blue-400 font-bold">
                    {pending?.applications_needing_attention ?? 0}
                  </span>{' '}
                  applications need attention
                </span>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-2 text-xs text-gray-500">
              This notification will be delivered at {config.digest_time} IST daily.
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Settings'}
        </button>

        <button
          onClick={handleSendDigest}
          disabled={sendingDigest}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {sendingDigest ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : digestSuccess ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sendingDigest ? 'Sending...' : digestSuccess ? 'Sent!' : 'Send Digest Now'}
        </button>

        <button
          onClick={handleSendDigest}
          disabled={sendingDigest}
          className="flex items-center gap-2 border border-gray-600 hover:border-gray-500 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
        >
          <Mail className="w-4 h-4" />
          Send Test Digest
        </button>
      </div>
    </div>
  )
}
