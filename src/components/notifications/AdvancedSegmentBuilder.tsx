'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Filter,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  Loader2,
  Target,
  Map,
  Calendar,
  Clock,
  Activity,
  TrendingUp,
  UserCheck,
  Building2,
  Briefcase
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' |
  'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty'

type LogicalOperator = 'AND' | 'OR'

interface Condition {
  id: string
  field: string
  operator: ConditionOperator
  value: string | number | string[]
  valueEnd?: string | number // For "between" operator
}

interface ConditionGroup {
  id: string
  operator: LogicalOperator
  conditions: Condition[]
}

interface Segment {
  id?: string
  name: string
  description: string
  groups: ConditionGroup[]
  groupOperator: LogicalOperator
  estimatedCount?: number
  createdAt?: string
  updatedAt?: string
}

interface FieldDefinition {
  name: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum'
  category: string
  options?: { value: string; label: string }[]
  operators: ConditionOperator[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FIELD_DEFINITIONS: FieldDefinition[] = [
  // User Demographics
  {
    name: 'user.role',
    label: 'User Role',
    type: 'enum',
    category: 'Demographics',
    options: [
      { value: 'employee', label: 'Employee' },
      { value: 'partner', label: 'Partner' },
      { value: 'customer', label: 'Customer' }
    ],
    operators: ['equals', 'not_equals', 'in', 'not_in']
  },
  {
    name: 'user.sub_role',
    label: 'Sub Role',
    type: 'string',
    category: 'Demographics',
    operators: ['equals', 'not_equals', 'contains', 'in', 'not_in']
  },
  {
    name: 'user.status',
    label: 'Account Status',
    type: 'enum',
    category: 'Demographics',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
      { value: 'suspended', label: 'Suspended' }
    ],
    operators: ['equals', 'not_equals', 'in']
  },
  // Geographic
  {
    name: 'user.state',
    label: 'State',
    type: 'string',
    category: 'Geographic',
    operators: ['equals', 'not_equals', 'in', 'not_in']
  },
  {
    name: 'user.city',
    label: 'City',
    type: 'string',
    category: 'Geographic',
    operators: ['equals', 'not_equals', 'in', 'not_in', 'contains']
  },
  {
    name: 'user.branch',
    label: 'Branch',
    type: 'string',
    category: 'Geographic',
    operators: ['equals', 'not_equals', 'in', 'not_in']
  },
  {
    name: 'user.pincode',
    label: 'Pincode',
    type: 'string',
    category: 'Geographic',
    operators: ['equals', 'not_equals', 'in', 'not_in', 'contains']
  },
  // Activity
  {
    name: 'activity.last_login_days',
    label: 'Days Since Last Login',
    type: 'number',
    category: 'Activity',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  },
  {
    name: 'activity.login_count_30d',
    label: 'Logins (Last 30 Days)',
    type: 'number',
    category: 'Activity',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  },
  {
    name: 'activity.notification_read_rate',
    label: 'Notification Read Rate (%)',
    type: 'number',
    category: 'Activity',
    operators: ['greater_than', 'less_than', 'between']
  },
  // Business
  {
    name: 'business.applications_submitted',
    label: 'Applications Submitted',
    type: 'number',
    category: 'Business',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  },
  {
    name: 'business.total_disbursement',
    label: 'Total Disbursement',
    type: 'number',
    category: 'Business',
    operators: ['greater_than', 'less_than', 'between']
  },
  {
    name: 'business.commission_earned',
    label: 'Commission Earned',
    type: 'number',
    category: 'Business',
    operators: ['greater_than', 'less_than', 'between']
  },
  // Partner Specific
  {
    name: 'partner.type',
    label: 'Partner Type',
    type: 'enum',
    category: 'Partner',
    options: [
      { value: 'BUSINESS_ASSOCIATE', label: 'Business Associate' },
      { value: 'BUSINESS_PARTNER', label: 'Business Partner' },
      { value: 'CHANNEL_PARTNER', label: 'Channel Partner' }
    ],
    operators: ['equals', 'not_equals', 'in']
  },
  {
    name: 'partner.tier',
    label: 'Partner Tier',
    type: 'enum',
    category: 'Partner',
    options: [
      { value: 'bronze', label: 'Bronze' },
      { value: 'silver', label: 'Silver' },
      { value: 'gold', label: 'Gold' },
      { value: 'platinum', label: 'Platinum' }
    ],
    operators: ['equals', 'not_equals', 'in']
  },
  {
    name: 'partner.onboarding_date',
    label: 'Onboarding Date',
    type: 'date',
    category: 'Partner',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  },
  // Employee Specific
  {
    name: 'employee.department',
    label: 'Department',
    type: 'string',
    category: 'Employee',
    operators: ['equals', 'not_equals', 'in', 'not_in']
  },
  {
    name: 'employee.designation',
    label: 'Designation',
    type: 'string',
    category: 'Employee',
    operators: ['equals', 'not_equals', 'contains', 'in', 'not_in']
  },
  {
    name: 'employee.joining_date',
    label: 'Joining Date',
    type: 'date',
    category: 'Employee',
    operators: ['equals', 'greater_than', 'less_than', 'between']
  }
]

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'is greater than',
  less_than: 'is less than',
  between: 'is between',
  in: 'is one of',
  not_in: 'is not one of',
  is_empty: 'is empty',
  is_not_empty: 'is not empty'
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Demographics: <Users className="w-4 h-4" />,
  Geographic: <Map className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  Business: <TrendingUp className="w-4 h-4" />,
  Partner: <Building2 className="w-4 h-4" />,
  Employee: <Briefcase className="w-4 h-4" />
}

// ============================================================================
// UTILITIES
// ============================================================================

const generateId = () => Math.random().toString(36).substring(2, 11)

const createEmptyCondition = (): Condition => ({
  id: generateId(),
  field: '',
  operator: 'equals',
  value: ''
})

const createEmptyGroup = (): ConditionGroup => ({
  id: generateId(),
  operator: 'AND',
  conditions: [createEmptyCondition()]
})

// ============================================================================
// COMPONENT
// ============================================================================

interface AdvancedSegmentBuilderProps {
  segment?: Segment
  onSave?: (segment: Segment) => void
  onCancel?: () => void
  onEstimateChange?: (count: number) => void
}

export default function AdvancedSegmentBuilder({
  segment: initialSegment,
  onSave,
  onCancel,
  onEstimateChange
}: AdvancedSegmentBuilderProps) {
  const [segment, setSegment] = useState<Segment>(
    initialSegment || {
      name: '',
      description: '',
      groups: [createEmptyGroup()],
      groupOperator: 'AND'
    }
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(segment.groups.map(g => g.id))
  )
  const [estimating, setEstimating] = useState(false)
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null)
  const [savedSegments, setSavedSegments] = useState<Segment[]>([])
  const [showSavedSegments, setShowSavedSegments] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Group fields by category
  const fieldsByCategory = FIELD_DEFINITIONS.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = []
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, FieldDefinition[]>)

  // Estimate recipients when segment changes
  useEffect(() => {
    const timer = setTimeout(() => {
      estimateRecipients()
    }, 1000)
    return () => clearTimeout(timer)
  }, [segment.groups, segment.groupOperator])

  // Load saved segments on mount
  useEffect(() => {
    fetchSavedSegments()
  }, [])

  const fetchSavedSegments = async () => {
    try {
      const response = await fetch('/api/notifications/segments')
      if (response.ok) {
        const data = await response.json()
        setSavedSegments(data.segments || [])
      }
    } catch (err) {
      console.error('Error fetching segments:', err)
    }
  }

  const estimateRecipients = async () => {
    // Validate that there's at least one complete condition
    const hasValidCondition = segment.groups.some(group =>
      group.conditions.some(c => c.field && c.operator && c.value)
    )

    if (!hasValidCondition) {
      setEstimatedCount(null)
      return
    }

    try {
      setEstimating(true)
      const response = await fetch('/api/notifications/segments/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: segment.groups,
          groupOperator: segment.groupOperator
        })
      })

      if (response.ok) {
        const data = await response.json()
        setEstimatedCount(data.count)
        onEstimateChange?.(data.count)
      }
    } catch (err) {
      console.error('Error estimating recipients:', err)
    } finally {
      setEstimating(false)
    }
  }

  const addGroup = () => {
    const newGroup = createEmptyGroup()
    setSegment(prev => ({
      ...prev,
      groups: [...prev.groups, newGroup]
    }))
    setExpandedGroups(prev => new Set([...prev, newGroup.id]))
  }

  const removeGroup = (groupId: string) => {
    if (segment.groups.length <= 1) return
    setSegment(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId)
    }))
  }

  const addCondition = (groupId: string) => {
    setSegment(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, createEmptyCondition()] }
          : g
      )
    }))
  }

  const removeCondition = (groupId: string, conditionId: string) => {
    setSegment(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
          : g
      )
    }))
  }

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<Condition>
  ) => {
    setSegment(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
              )
            }
          : g
      )
    }))
  }

  const updateGroupOperator = (groupId: string, operator: LogicalOperator) => {
    setSegment(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId ? { ...g, operator } : g
      )
    }))
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const handleSave = async () => {
    if (!segment.name.trim()) {
      setError('Segment name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/notifications/segments', {
        method: segment.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segment)
      })

      if (!response.ok) {
        throw new Error('Failed to save segment')
      }

      const data = await response.json()
      onSave?.({ ...segment, id: data.id })
      fetchSavedSegments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const loadSegment = (savedSegment: Segment) => {
    setSegment(savedSegment)
    setExpandedGroups(new Set(savedSegment.groups.map(g => g.id)))
    setShowSavedSegments(false)
  }

  const getFieldDefinition = (fieldName: string) => {
    return FIELD_DEFINITIONS.find(f => f.name === fieldName)
  }

  const renderValueInput = (condition: Condition, groupId: string) => {
    const fieldDef = getFieldDefinition(condition.field)
    if (!fieldDef) return null

    const baseClassName = "flex-1 bg-black/50 text-white px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none text-sm"

    if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
      return null
    }

    if (fieldDef.type === 'enum' && fieldDef.options) {
      if (condition.operator === 'in' || condition.operator === 'not_in') {
        return (
          <select
            multiple
            value={Array.isArray(condition.value) ? condition.value : []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, opt => opt.value)
              updateCondition(groupId, condition.id, { value: values })
            }}
            className={`${baseClassName} min-h-[80px]`}
          >
            {fieldDef.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      }
      return (
        <select
          value={condition.value as string}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className={baseClassName}
        >
          <option value="">Select value</option>
          {fieldDef.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    if (fieldDef.type === 'number') {
      if (condition.operator === 'between') {
        return (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="number"
              value={condition.value as number}
              onChange={(e) => updateCondition(groupId, condition.id, { value: parseFloat(e.target.value) })}
              placeholder="From"
              className={baseClassName}
            />
            <span className="text-gray-400">and</span>
            <input
              type="number"
              value={condition.valueEnd as number}
              onChange={(e) => updateCondition(groupId, condition.id, { valueEnd: parseFloat(e.target.value) })}
              placeholder="To"
              className={baseClassName}
            />
          </div>
        )
      }
      return (
        <input
          type="number"
          value={condition.value as number}
          onChange={(e) => updateCondition(groupId, condition.id, { value: parseFloat(e.target.value) })}
          placeholder="Enter value"
          className={baseClassName}
        />
      )
    }

    if (fieldDef.type === 'date') {
      if (condition.operator === 'between') {
        return (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="date"
              value={condition.value as string}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
              className={baseClassName}
            />
            <span className="text-gray-400">and</span>
            <input
              type="date"
              value={condition.valueEnd as string}
              onChange={(e) => updateCondition(groupId, condition.id, { valueEnd: e.target.value })}
              className={baseClassName}
            />
          </div>
        )
      }
      return (
        <input
          type="date"
          value={condition.value as string}
          onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
          className={baseClassName}
        />
      )
    }

    // String type
    if (condition.operator === 'in' || condition.operator === 'not_in') {
      return (
        <input
          type="text"
          value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}
          onChange={(e) => updateCondition(groupId, condition.id, {
            value: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
          })}
          placeholder="Enter values separated by commas"
          className={baseClassName}
        />
      )
    }

    return (
      <input
        type="text"
        value={condition.value as string}
        onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
        placeholder="Enter value"
        className={baseClassName}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-8 h-8 text-purple-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Advanced Segment Builder</h2>
            <p className="text-gray-400 text-sm">Create complex audience segments with multiple conditions</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Estimated Count */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-4 py-2">
            <p className="text-purple-300 text-xs">Estimated Recipients</p>
            <p className="text-2xl font-bold text-white">
              {estimating ? (
                <Loader2 className="w-5 h-5 animate-spin inline" />
              ) : estimatedCount !== null ? (
                estimatedCount.toLocaleString()
              ) : (
                '—'
              )}
            </p>
          </div>

          {/* Saved Segments Button */}
          <button
            onClick={() => setShowSavedSegments(!showSavedSegments)}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Saved Segments
          </button>
        </div>
      </div>

      {/* Saved Segments Dropdown */}
      {showSavedSegments && savedSegments.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Load Saved Segment</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {savedSegments.map(s => (
              <button
                key={s.id}
                onClick={() => loadSegment(s)}
                className="p-3 bg-black/30 hover:bg-black/50 rounded-lg text-left transition-colors"
              >
                <p className="text-white font-medium">{s.name}</p>
                <p className="text-gray-400 text-xs mt-1">{s.description || 'No description'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Segment Name & Description */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-2">Segment Name</label>
          <input
            type="text"
            value={segment.name}
            onChange={(e) => setSegment(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., High-value partners in Maharashtra"
            className="w-full bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-purple-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-2">Description (Optional)</label>
          <textarea
            value={segment.description}
            onChange={(e) => setSegment(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what this segment represents..."
            rows={2}
            className="w-full bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-purple-500 focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Condition Groups */}
      <div className="space-y-4">
        {segment.groups.map((group, groupIndex) => (
          <div key={group.id}>
            {/* Group Connector */}
            {groupIndex > 0 && (
              <div className="flex items-center justify-center my-4">
                <div className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1">
                  <button
                    onClick={() => setSegment(prev => ({ ...prev, groupOperator: 'AND' }))}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      segment.groupOperator === 'AND'
                        ? 'bg-purple-500 text-white'
                        : 'text-purple-300 hover:bg-purple-500/20'
                    }`}
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setSegment(prev => ({ ...prev, groupOperator: 'OR' }))}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      segment.groupOperator === 'OR'
                        ? 'bg-purple-500 text-white'
                        : 'text-purple-300 hover:bg-purple-500/20'
                    }`}
                  >
                    OR
                  </button>
                </div>
              </div>
            )}

            {/* Group Card */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              {/* Group Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedGroups.has(group.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-white font-medium">
                    Condition Group {groupIndex + 1}
                  </span>
                  <span className="text-gray-400 text-sm">
                    ({group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Group Internal Operator */}
                  <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); updateGroupOperator(group.id, 'AND') }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        group.operator === 'AND'
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Match ALL
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateGroupOperator(group.id, 'OR') }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        group.operator === 'OR'
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Match ANY
                    </button>
                  </div>

                  {/* Remove Group */}
                  {segment.groups.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeGroup(group.id) }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Group Conditions */}
              {expandedGroups.has(group.id) && (
                <div className="border-t border-white/10 p-4 space-y-3">
                  {group.conditions.map((condition, condIndex) => (
                    <div key={condition.id} className="flex items-start gap-3">
                      {/* Condition Connector */}
                      {condIndex > 0 && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          group.operator === 'AND' ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {group.operator}
                        </span>
                      )}

                      {/* Field Selector */}
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(group.id, condition.id, {
                          field: e.target.value,
                          operator: 'equals',
                          value: ''
                        })}
                        className="min-w-[200px] bg-black/50 text-white px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none text-sm"
                      >
                        <option value="">Select field</option>
                        {Object.entries(fieldsByCategory).map(([category, fields]) => (
                          <optgroup key={category} label={category}>
                            {fields.map(field => (
                              <option key={field.name} value={field.name}>
                                {field.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      {/* Operator Selector */}
                      {condition.field && (
                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(group.id, condition.id, {
                            operator: e.target.value as ConditionOperator
                          })}
                          className="min-w-[150px] bg-black/50 text-white px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none text-sm"
                        >
                          {getFieldDefinition(condition.field)?.operators.map(op => (
                            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                          ))}
                        </select>
                      )}

                      {/* Value Input */}
                      {condition.field && renderValueInput(condition, group.id)}

                      {/* Remove Condition */}
                      {group.conditions.length > 1 && (
                        <button
                          onClick={() => removeCondition(group.id, condition.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add Condition Button */}
                  <button
                    onClick={() => addCondition(group.id)}
                    className="mt-2 flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Condition
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add Group Button */}
        <button
          onClick={addGroup}
          className="w-full p-4 border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-lg text-gray-400 hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Condition Group
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !segment.name.trim()}
          className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Segment
            </>
          )}
        </button>
        <button
          onClick={() => onSave?.(segment)}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Apply Segment
        </button>
      </div>
    </div>
  )
}
