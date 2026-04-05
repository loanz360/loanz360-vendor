'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Play,
  Pause,
  Save,
  Plus,
  Trash2,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Clock,
  GitBranch,
  Split,
  ChevronDown,
  ChevronUp,
  Zap,
  UserPlus,
  UserX,
  FileText,
  Handshake,
  CalendarClock,
  Settings,
  GripVertical,
  AlertCircle,
  ArrowDown,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface CampaignStep {
  id: string
  type: 'notification' | 'wait' | 'condition' | 'split_test'
  config: {
    channel?: 'email' | 'sms' | 'push' | 'in_app'
    template_id?: string
    subject?: string
    message?: string
    delay_value?: number
    delay_unit?: 'hours' | 'days' | 'weeks'
    condition_type?: 'opened' | 'clicked' | 'not_opened' | 'not_clicked'
    condition_window?: number
    true_branch?: CampaignStep[]
    false_branch?: CampaignStep[]
    split_percentage?: number
    variant_a?: CampaignStep[]
    variant_b?: CampaignStep[]
  }
}

interface Campaign {
  name: string
  description: string
  trigger: string
  trigger_config: Record<string, unknown>
  steps: CampaignStep[]
  is_active: boolean
  start_date?: string
  end_date?: string
}

interface CampaignAutomationProps {
  initialCampaign?: Campaign
  onSave?: (campaign: Campaign) => void
  onChange?: (campaign: Campaign) => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRIGGERS = [
  { value: 'new_registration', label: 'New User Registration', icon: UserPlus, desc: 'Triggered when a new user signs up' },
  { value: 'user_inactivity', label: 'User Inactivity', icon: UserX, desc: 'Triggered after X days of inactivity' },
  { value: 'loan_status_change', label: 'Loan Status Change', icon: FileText, desc: 'Triggered when loan application status changes' },
  { value: 'partner_onboarding', label: 'Partner Onboarding', icon: Handshake, desc: 'Triggered when a new partner is onboarded' },
  { value: 'custom_event', label: 'Custom Date/Event', icon: CalendarClock, desc: 'Triggered on a specific date or custom event' },
] as const

const STEP_TYPES = [
  { value: 'notification' as const, label: 'Send Notification', icon: Mail, color: 'blue' },
  { value: 'wait' as const, label: 'Wait / Delay', icon: Clock, color: 'yellow' },
  { value: 'condition' as const, label: 'Condition', icon: GitBranch, color: 'green' },
  { value: 'split_test' as const, label: 'A/B Split Test', icon: Split, color: 'purple' },
] as const

const CHANNEL_ICONS = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: Smartphone,
} as const

const CONDITION_LABELS: Record<string, string> = {
  opened: 'User opened previous notification',
  clicked: 'User clicked previous notification',
  not_opened: 'User did NOT open previous notification',
  not_clicked: 'User did NOT click previous notification',
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function createDefaultStep(type: CampaignStep['type']): CampaignStep {
  const base: CampaignStep = { id: generateId(), type, config: {} }
  switch (type) {
    case 'notification':
      base.config = { channel: 'email', subject: '', message: '' }
      break
    case 'wait':
      base.config = { delay_value: 1, delay_unit: 'days' }
      break
    case 'condition':
      base.config = { condition_type: 'opened', condition_window: 24, true_branch: [], false_branch: [] }
      break
    case 'split_test':
      base.config = { split_percentage: 50, variant_a: [], variant_b: [] }
      break
  }
  return base
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StepTypeSelector({ onSelect, onClose }: { onSelect: (type: CampaignStep['type']) => void; onClose: () => void }) {
  return (
    <div className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 border border-white/10 rounded-xl shadow-2xl p-3 w-64">
      <p className="text-xs text-gray-400 mb-2 px-1">Add a step</p>
      {STEP_TYPES.map((st) => {
        const Icon = st.icon
        return (
          <button
            key={st.value}
            onClick={() => { onSelect(st.value); onClose() }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
          >
            <div className={`p-1.5 rounded-md bg-${st.color}-500/20`}>
              <Icon className={`w-4 h-4 text-${st.color}-400`} />
            </div>
            <span className="text-sm text-white">{st.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function AddStepButton({ onAdd }: { onAdd: (type: CampaignStep['type']) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex flex-col items-center">
      {/* Connecting line */}
      <div className="w-px h-4 bg-white/10" />
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-dashed border-white/20 rounded-full text-xs text-gray-400 hover:text-white hover:border-orange-500/50 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Step
      </button>
      {open && <StepTypeSelector onSelect={onAdd} onClose={() => setOpen(false)} />}
      <div className="w-px h-4 bg-white/10" />
    </div>
  )
}

function NotificationStepEditor({ step, onUpdate }: { step: CampaignStep; onUpdate: (config: CampaignStep['config']) => void }) {
  const config = step.config
  return (
    <div className="space-y-3">
      {/* Channel selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Channel</label>
        <div className="grid grid-cols-4 gap-2">
          {(['email', 'sms', 'push', 'in_app'] as const).map((ch) => {
            const Icon = CHANNEL_ICONS[ch]
            const active = config.channel === ch
            return (
              <button
                key={ch}
                onClick={() => onUpdate({ ...config, channel: ch })}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                  active
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {ch === 'in_app' ? 'In-App' : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            )
          })}
        </div>
      </div>
      {/* Subject */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Subject</label>
        <input
          type="text"
          value={config.subject || ''}
          onChange={(e) => onUpdate({ ...config, subject: e.target.value })}
          placeholder="Notification subject..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
        />
      </div>
      {/* Message */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Message</label>
        <textarea
          value={config.message || ''}
          onChange={(e) => onUpdate({ ...config, message: e.target.value })}
          placeholder="Notification message..."
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
        />
      </div>
      {/* Template ID */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Template ID (optional)</label>
        <input
          type="text"
          value={config.template_id || ''}
          onChange={(e) => onUpdate({ ...config, template_id: e.target.value })}
          placeholder="e.g. tpl_welcome_001"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
        />
      </div>
    </div>
  )
}

function WaitStepEditor({ step, onUpdate }: { step: CampaignStep; onUpdate: (config: CampaignStep['config']) => void }) {
  const config = step.config
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="block text-xs text-gray-400 mb-1.5">Delay</label>
        <input
          type="number"
          min={1}
          value={config.delay_value || 1}
          onChange={(e) => onUpdate({ ...config, delay_value: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs text-gray-400 mb-1.5">Unit</label>
        <select
          value={config.delay_unit || 'days'}
          onChange={(e) => onUpdate({ ...config, delay_unit: e.target.value as 'hours' | 'days' | 'weeks' })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
        </select>
      </div>
    </div>
  )
}

function ConditionStepEditor({ step, onUpdate }: { step: CampaignStep; onUpdate: (config: CampaignStep['config']) => void }) {
  const config = step.config
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Condition</label>
        <select
          value={config.condition_type || 'opened'}
          onChange={(e) => onUpdate({ ...config, condition_type: e.target.value as 'opened' | 'clicked' | 'not_opened' | 'not_clicked' })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
        >
          {Object.entries(CONDITION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Within (hours)</label>
        <input
          type="number"
          min={1}
          value={config.condition_window || 24}
          onChange={(e) => onUpdate({ ...config, condition_window: Math.max(1, parseInt(e.target.value) || 24) })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
          <p className="text-xs font-medium text-green-400 mb-1">True Branch</p>
          <p className="text-xs text-gray-500">{config.true_branch?.length || 0} step(s)</p>
        </div>
        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
          <p className="text-xs font-medium text-red-400 mb-1">False Branch</p>
          <p className="text-xs text-gray-500">{config.false_branch?.length || 0} step(s)</p>
        </div>
      </div>
    </div>
  )
}

function SplitTestStepEditor({ step, onUpdate }: { step: CampaignStep; onUpdate: (config: CampaignStep['config']) => void }) {
  const config = step.config
  const pct = config.split_percentage || 50
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Split Ratio</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={pct}
            onChange={(e) => onUpdate({ ...config, split_percentage: parseInt(e.target.value) })}
            className="flex-1 accent-purple-500"
          />
          <span className="text-sm text-white font-mono w-24 text-right">{pct}% / {100 - pct}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
          <p className="text-xs font-medium text-purple-400 mb-1">Variant A ({pct}%)</p>
          <p className="text-xs text-gray-500">{config.variant_a?.length || 0} step(s)</p>
        </div>
        <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
          <p className="text-xs font-medium text-indigo-400 mb-1">Variant B ({100 - pct}%)</p>
          <p className="text-xs text-gray-500">{config.variant_b?.length || 0} step(s)</p>
        </div>
      </div>
    </div>
  )
}

function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
}: {
  step: CampaignStep
  index: number
  onUpdate: (config: CampaignStep['config']) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const meta = STEP_TYPES.find((s) => s.value === step.type)!
  const Icon = meta.icon

  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', iconBg: 'bg-blue-500/15' },
    yellow: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', text: 'text-yellow-400', iconBg: 'bg-yellow-500/15' },
    green: { bg: 'bg-green-500/5', border: 'border-green-500/20', text: 'text-green-400', iconBg: 'bg-green-500/15' },
    purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', iconBg: 'bg-purple-500/15' },
  }
  const c = colorMap[meta.color]

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="w-4 h-4 text-gray-600 cursor-grab" />
        <div className={`p-1.5 rounded-md ${c.iconBg}`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            Step {index + 1}: {meta.label}
          </p>
          {!expanded && step.type === 'notification' && step.config.subject && (
            <p className="text-xs text-gray-500 truncate">{step.config.subject}</p>
          )}
          {!expanded && step.type === 'wait' && (
            <p className="text-xs text-gray-500">
              Wait {step.config.delay_value} {step.config.delay_unit}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5">
          {step.type === 'notification' && <NotificationStepEditor step={step} onUpdate={onUpdate} />}
          {step.type === 'wait' && <WaitStepEditor step={step} onUpdate={onUpdate} />}
          {step.type === 'condition' && <ConditionStepEditor step={step} onUpdate={onUpdate} />}
          {step.type === 'split_test' && <SplitTestStepEditor step={step} onUpdate={onUpdate} />}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CampaignAutomation({
  initialCampaign,
  onSave,
  onChange,
}: CampaignAutomationProps) {
  const [campaign, setCampaign] = useState<Campaign>(() => initialCampaign || {
    name: '',
    description: '',
    trigger: '',
    trigger_config: {},
    steps: [],
    is_active: false,
    start_date: '',
    end_date: '',
  })

  const [showTriggerPicker, setShowTriggerPicker] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(true)

  const update = useCallback((patch: Partial<Campaign>) => {
    setCampaign((prev) => {
      const next = { ...prev, ...patch }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const addStep = useCallback((atIndex: number, type: CampaignStep['type']) => {
    setCampaign((prev) => {
      const newSteps = [...prev.steps]
      newSteps.splice(atIndex, 0, createDefaultStep(type))
      const next = { ...prev, steps: newSteps }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const updateStep = useCallback((index: number, config: CampaignStep['config']) => {
    setCampaign((prev) => {
      const newSteps = [...prev.steps]
      newSteps[index] = { ...newSteps[index], config }
      const next = { ...prev, steps: newSteps }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const deleteStep = useCallback((index: number) => {
    setCampaign((prev) => {
      const newSteps = prev.steps.filter((_, i) => i !== index)
      const next = { ...prev, steps: newSteps }
      onChange?.(next)
      return next
    })
  }, [onChange])

  const handleSave = () => {
    onSave?.(campaign)
  }

  const selectedTrigger = TRIGGERS.find((t) => t.value === campaign.trigger)

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Campaign Automation</h3>
            <p className="text-xs text-gray-400">Build automated notification sequences</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Active toggle */}
          <button
            onClick={() => update({ is_active: !campaign.is_active })}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              campaign.is_active
                ? 'bg-green-500/15 border-green-500/30 text-green-400'
                : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            {campaign.is_active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {campaign.is_active ? 'Active' : 'Paused'}
          </button>
          {/* Save */}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Campaign Settings */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-white">Campaign Settings</span>
            </div>
            {settingsExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {settingsExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Campaign Name</label>
                  <input
                    type="text"
                    value={campaign.name}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="e.g. Welcome Series"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Description</label>
                  <input
                    type="text"
                    value={campaign.description}
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="Brief description..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={campaign.start_date || ''}
                    onChange={(e) => update({ start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">End Date (optional)</label>
                  <input
                    type="date"
                    value={campaign.end_date || ''}
                    onChange={(e) => update({ end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>
              {/* Inactivity days config */}
              {campaign.trigger === 'user_inactivity' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Inactivity Threshold (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={(campaign.trigger_config.inactivity_days as number) || 7}
                    onChange={(e) => update({ trigger_config: { ...campaign.trigger_config, inactivity_days: parseInt(e.target.value) || 7 } })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trigger Selection */}
        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Trigger</label>
          {selectedTrigger ? (
            <div
              className="flex items-center gap-3 p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl cursor-pointer hover:bg-orange-500/10 transition-colors"
              onClick={() => setShowTriggerPicker(!showTriggerPicker)}
            >
              <div className="p-2 bg-orange-500/15 rounded-lg">
                <selectedTrigger.icon className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{selectedTrigger.label}</p>
                <p className="text-xs text-gray-400">{selectedTrigger.desc}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          ) : (
            <button
              onClick={() => setShowTriggerPicker(!showTriggerPicker)}
              className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-orange-500/30 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm">Select a trigger to start the campaign</span>
            </button>
          )}

          {showTriggerPicker && (
            <div className="mt-2 bg-gray-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {TRIGGERS.map((trigger) => {
                const TIcon = trigger.icon
                const isSelected = campaign.trigger === trigger.value
                return (
                  <button
                    key={trigger.value}
                    onClick={() => {
                      update({ trigger: trigger.value, trigger_config: {} })
                      setShowTriggerPicker(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                      isSelected ? 'bg-orange-500/10' : ''
                    }`}
                  >
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                      <TIcon className={`w-4 h-4 ${isSelected ? 'text-orange-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-white">{trigger.label}</p>
                      <p className="text-xs text-gray-500">{trigger.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Workflow Steps */}
        <div>
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
            Workflow Steps ({campaign.steps.length})
          </label>

          {campaign.steps.length === 0 && !campaign.trigger && (
            <div className="flex items-center gap-2 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-300/80">Select a trigger first, then add workflow steps.</p>
            </div>
          )}

          {campaign.trigger && (
            <div className="flex flex-col items-center">
              {/* Trigger node */}
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-medium text-orange-300">
                  {selectedTrigger?.label || 'Trigger'}
                </span>
              </div>

              {/* Add step at beginning */}
              <AddStepButton onAdd={(type) => addStep(0, type)} />

              {/* Steps */}
              {campaign.steps.map((step, index) => (
                <div key={step.id} className="w-full flex flex-col items-center">
                  <div className="w-full max-w-2xl">
                    <StepCard
                      step={step}
                      index={index}
                      onUpdate={(config) => updateStep(index, config)}
                      onDelete={() => deleteStep(index)}
                    />
                  </div>
                  <AddStepButton onAdd={(type) => addStep(index + 1, type)} />
                </div>
              ))}

              {/* End node */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 border border-white/10 rounded-full">
                <ArrowDown className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-400">End of Campaign</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
