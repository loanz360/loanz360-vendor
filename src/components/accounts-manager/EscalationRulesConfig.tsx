'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings2,
  Save,
  Clock,
  Bell,
  Layers,
  UserCheck,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  X,
} from 'lucide-react'

interface EscalationConfig {
  auto_escalate_after_days: number
  notify_manager_after_days: number
  max_items_per_ae: number
  auto_reassign_on_absence: boolean
  escalation_recipients: string[]
}

interface Props {
  onSave?: () => void
}

const RECIPIENT_OPTIONS = [
  { value: 'ACCOUNTS_MANAGER', label: 'Accounts Manager' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'HR_MANAGER', label: 'HR Manager' },
]

const DEFAULT_CONFIG: EscalationConfig = {
  auto_escalate_after_days: 5,
  notify_manager_after_days: 3,
  max_items_per_ae: 15,
  auto_reassign_on_absence: true,
  escalation_recipients: ['ACCOUNTS_MANAGER', 'SUPER_ADMIN'],
}

export default function EscalationRulesConfig({ onSave }: Props) {
  const [config, setConfig] = useState<EscalationConfig>(DEFAULT_CONFIG)
  const [editConfig, setEditConfig] = useState<EscalationConfig>(DEFAULT_CONFIG)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/employees/accounts-manager/escalation-rules')
      const data = await res.json()
      if (data.success && data.data?.config) {
        setConfig(data.data.config)
        setEditConfig(data.data.config)
      }
    } catch {
      setError('Failed to load escalation rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaveSuccess(false)
    setConfirmSave(false)

    try {
      const res = await fetch('/api/employees/accounts-manager/escalation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editConfig),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to save rules')
        return
      }

      setConfig(data.data.config)
      setEditConfig(data.data.config)
      setSaveSuccess(true)
      setEditing(false)
      onSave?.()

      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleRecipient = (value: string) => {
    setEditConfig(prev => {
      const current = prev.escalation_recipients
      if (current.includes(value)) {
        if (current.length <= 1) return prev // Must have at least one
        return { ...prev, escalation_recipients: current.filter(r => r !== value) }
      }
      return { ...prev, escalation_recipients: [...current, value] }
    })
  }

  const cancelEdit = () => {
    setEditConfig(config)
    setEditing(false)
    setError(null)
    setConfirmSave(false)
  }

  if (loading) {
    return (
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="frosted-card p-6 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-orange-500" />
          Escalation Rules
        </h2>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-gray-700/50"
            >
              <Pencil className="w-3 h-3" />
              Edit Rules
            </button>
          ) : (
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-5">
        {/* Auto-Escalate After Days */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <label className="text-sm text-white font-medium">Auto-Escalate After</label>
          </div>
          <p className="text-[10px] text-gray-500 mb-2 ml-6">
            Automatically escalate items not resolved within this many days.
          </p>
          {editing ? (
            <div className="ml-6 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={14}
                value={editConfig.auto_escalate_after_days}
                onChange={(e) => setEditConfig(prev => ({ ...prev, auto_escalate_after_days: Number(e.target.value) }))}
                className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-sm text-orange-400 font-medium w-16 text-right">
                {editConfig.auto_escalate_after_days} days
              </span>
            </div>
          ) : (
            <div className="ml-6">
              <span className="text-sm text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg">
                {config.auto_escalate_after_days} days
              </span>
            </div>
          )}
        </div>

        {/* Notify Manager After Days */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-orange-400" />
            <label className="text-sm text-white font-medium">Notify Manager After</label>
          </div>
          <p className="text-[10px] text-gray-500 mb-2 ml-6">
            Send notification to manager when items are pending beyond this threshold.
          </p>
          {editing ? (
            <div className="ml-6 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={7}
                value={editConfig.notify_manager_after_days}
                onChange={(e) => setEditConfig(prev => ({ ...prev, notify_manager_after_days: Number(e.target.value) }))}
                className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-sm text-orange-400 font-medium w-16 text-right">
                {editConfig.notify_manager_after_days} days
              </span>
            </div>
          ) : (
            <div className="ml-6">
              <span className="text-sm text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg">
                {config.notify_manager_after_days} days
              </span>
            </div>
          )}
        </div>

        {/* Max Items Per AE */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-orange-400" />
            <label className="text-sm text-white font-medium">Max Items Per AE</label>
          </div>
          <p className="text-[10px] text-gray-500 mb-2 ml-6">
            Maximum number of active items each Accounts Executive can hold.
          </p>
          {editing ? (
            <div className="ml-6 flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={30}
                value={editConfig.max_items_per_ae}
                onChange={(e) => setEditConfig(prev => ({ ...prev, max_items_per_ae: Number(e.target.value) }))}
                className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-sm text-orange-400 font-medium w-16 text-right">
                {editConfig.max_items_per_ae} items
              </span>
            </div>
          ) : (
            <div className="ml-6">
              <span className="text-sm text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg">
                {config.max_items_per_ae} items
              </span>
            </div>
          )}
        </div>

        {/* Auto-Reassign on Absence */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-orange-400" />
            <label className="text-sm text-white font-medium">Auto-Reassign on Absence</label>
          </div>
          <p className="text-[10px] text-gray-500 mb-2 ml-6">
            Automatically redistribute items when a team member is marked absent.
          </p>
          {editing ? (
            <div className="ml-6">
              <button
                onClick={() => setEditConfig(prev => ({ ...prev, auto_reassign_on_absence: !prev.auto_reassign_on_absence }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  editConfig.auto_reassign_on_absence ? 'bg-orange-500' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    editConfig.auto_reassign_on_absence ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ) : (
            <div className="ml-6">
              <span className={`text-sm px-2.5 py-1 rounded-lg ${
                config.auto_reassign_on_absence
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-gray-500 bg-gray-800/50'
              }`}>
                {config.auto_reassign_on_absence ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}
        </div>

        {/* Escalation Recipients */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-orange-400" />
            <label className="text-sm text-white font-medium">Escalation Recipients</label>
          </div>
          <p className="text-[10px] text-gray-500 mb-2 ml-6">
            Roles that receive escalation notifications.
          </p>
          {editing ? (
            <div className="ml-6 flex flex-wrap gap-2">
              {RECIPIENT_OPTIONS.map((opt) => {
                const isSelected = editConfig.escalation_recipients.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleRecipient(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
                        : 'border-gray-700/50 bg-gray-800/30 text-gray-500 hover:border-gray-600/50 hover:text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="ml-6 flex flex-wrap gap-2">
              {config.escalation_recipients.map((r) => {
                const opt = RECIPIENT_OPTIONS.find(o => o.value === r)
                return (
                  <span key={r} className="text-xs text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg">
                    {opt?.label || r}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Save Confirmation */}
      {editing && confirmSave && (
        <div className="mt-5 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <p className="text-sm text-white mb-3">
            Save these escalation rule changes? This will apply immediately.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Confirm Save
            </button>
            <button
              onClick={() => setConfirmSave(false)}
              className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Save Button */}
      {editing && !confirmSave && (
        <div className="mt-5 pt-5 border-t border-gray-800/50">
          <button
            onClick={() => setConfirmSave(true)}
            disabled={saving}
            className="flex items-center gap-2 text-sm bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 font-medium"
          >
            <Save className="w-4 h-4" />
            Save Rules
          </button>
        </div>
      )}
    </div>
  )
}
