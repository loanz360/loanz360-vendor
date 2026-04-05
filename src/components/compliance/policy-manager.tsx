'use client'

/**
 * Policy Manager Component
 * Policy configuration, enforcement toggles, evidence requirements
 */

import { useState, useEffect } from 'react'
import type { CompliancePolicy } from '@/lib/compliance/compliance-types'
import { getFrameworkColor, getSeverityBadge } from '@/lib/compliance/compliance-service'

export default function PolicyManager() {
  const [policies, setPolicies] = useState<CompliancePolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<'framework' | 'category'>('framework')
  const [filterFramework, setFilterFramework] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const fetchPolicies = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterFramework) params.append('framework', filterFramework)

      const response = await fetch(`/api/compliance/policies?${params}`)
      const data = await response.json()

      if (data.success) {
        setPolicies(data.policies)
        // Auto-expand all groups
        const groups = new Set(data.policies.map((p: CompliancePolicy) =>
          groupBy === 'framework' ? p.framework : p.category
        ))
        setExpandedGroups(groups)
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicies()
  }, [filterFramework])

  const toggleEnforcement = async (policyId: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/compliance/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId,
          isEnforced: !currentValue,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setPolicies(policies.map(p =>
          p.id === policyId ? { ...p, is_enforced: !currentValue } : p
        ))
      }
    } catch (error) {
      console.error('Failed to toggle enforcement:', error)
    }
  }

  const toggleAutoCheck = async (policyId: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/compliance/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId,
          autoCheckEnabled: !currentValue,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setPolicies(policies.map(p =>
          p.id === policyId ? { ...p, auto_check_enabled: !currentValue } : p
        ))
      }
    } catch (error) {
      console.error('Failed to toggle auto-check:', error)
    }
  }

  const toggleGroup = (group: string) => {
    const newSet = new Set(expandedGroups)
    if (newSet.has(group)) {
      newSet.delete(group)
    } else {
      newSet.add(group)
    }
    setExpandedGroups(newSet)
  }

  const groupedPolicies = policies.reduce((acc, policy) => {
    const key = groupBy === 'framework' ? policy.framework : policy.category
    if (!acc[key]) acc[key] = []
    acc[key].push(policy)
    return acc
  }, {} as Record<string, CompliancePolicy[]>)

  const getEnforcementStats = () => {
    const total = policies.length
    const enforced = policies.filter(p => p.is_enforced).length
    const active = policies.filter(p => p.is_active).length
    return { total, enforced, active, rate: total > 0 ? (enforced / total * 100).toFixed(0) : 0 }
  }

  const stats = getEnforcementStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policy Manager</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure compliance policies and enforcement rules
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{stats.rate}%</div>
          <div className="text-sm text-gray-500">Enforcement Rate</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Policies</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Enforced</div>
          <div className="text-3xl font-bold text-green-600">{stats.enforced}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Active</div>
          <div className="text-3xl font-bold text-blue-600">{stats.active}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Group By:</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'framework' | 'category')}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="framework">Framework</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Filter Framework:</label>
            <select
              value={filterFramework}
              onChange={(e) => setFilterFramework(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Frameworks</option>
              <option value="soc2">SOC 2</option>
              <option value="iso27001">ISO 27001</option>
              <option value="gdpr">GDPR</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      {/* Policy Groups */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedPolicies).map(([group, groupPolicies]) => (
            <div key={group} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    groupBy === 'framework' ? getFrameworkColor(group) : 'bg-gray-600 text-white'
                  }`}>
                    {group.toUpperCase()}
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {groupPolicies.length} Policies
                  </span>
                  <span className="text-sm text-gray-600">
                    ({groupPolicies.filter(p => p.is_enforced).length} enforced)
                  </span>
                </div>
                <span className="text-2xl text-gray-400">
                  {expandedGroups.has(group) ? '▼' : '▶'}
                </span>
              </button>

              {/* Policy List */}
              {expandedGroups.has(group) && (
                <div className="border-t border-gray-200 divide-y divide-gray-200">
                  {groupPolicies.map((policy) => (
                    <div key={policy.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-mono text-gray-600">{policy.policy_code}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityBadge(policy.severity)}`}>
                              {policy.severity.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              policy.enforcement_type === 'preventive' ? 'bg-red-600 text-white' :
                              policy.enforcement_type === 'detective' ? 'bg-yellow-600 text-white' :
                              'bg-blue-600 text-white'
                            }`}>
                              {policy.enforcement_type.toUpperCase()}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{policy.title}</h3>
                          <p className="text-sm text-gray-600 mb-2">{policy.description}</p>
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
                            <strong>Requirement:</strong> {policy.requirement}
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={policy.is_enforced}
                            onChange={() => toggleEnforcement(policy.id, policy.is_enforced)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm font-medium text-gray-700">Enforce Policy</span>
                        </label>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={policy.auto_check_enabled}
                            onChange={() => toggleAutoCheck(policy.id, policy.auto_check_enabled)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm font-medium text-gray-700">Auto-Check</span>
                        </label>

                        {policy.auto_check_enabled && policy.check_frequency && (
                          <span className="text-sm text-gray-600">
                            Frequency: {policy.check_frequency}
                          </span>
                        )}

                        {policy.requires_evidence && (
                          <span className="text-sm text-gray-600">
                            Evidence: {policy.evidence_types.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
