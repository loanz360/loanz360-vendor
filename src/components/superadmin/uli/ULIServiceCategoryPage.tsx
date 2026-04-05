'use client'

/**
 * Shared ULI Service Category Page Component
 * Used by all 10 service category pages (Identity & KYC, Credit Bureau, etc.)
 * Renders all services in a category with enable/disable, configure, and test actions
 */

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Search,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Settings,
  TestTube,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  IndianRupee,
  Activity,
  Zap,
  Shield,
  X,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Link from 'next/link'
import type { ULIService, ULIServiceCategory, ULIHealthStatus } from '@/lib/uli/uli-types'
import { ULI_CATEGORY_META } from '@/lib/uli/uli-types'

interface ULIServiceCategoryPageProps {
  category: ULIServiceCategory
  title: string
  description?: string
}

const HEALTH_CONFIG: Record<ULIHealthStatus, { color: string; icon: typeof CheckCircle; label: string }> = {
  HEALTHY: { color: 'text-green-400', icon: CheckCircle, label: 'Healthy' },
  DEGRADED: { color: 'text-orange-400', icon: AlertTriangle, label: 'Degraded' },
  DOWN: { color: 'text-red-400', icon: XCircle, label: 'Down' },
  UNKNOWN: { color: 'text-gray-400', icon: Activity, label: 'Unknown' },
}

export default function ULIServiceCategoryPage({ category, title, description }: ULIServiceCategoryPageProps) {
  const [services, setServices] = useState<ULIService[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<ULIService | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [expandedService, setExpandedService] = useState<string | null>(null)

  const categoryMeta = ULI_CATEGORY_META[category]

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/superadmin/uli-hub/services?category=${category}`)
      const json = await res.json()
      if (json.success) setServices(json.data)
    } catch (err) {
      console.error('Failed to fetch services:', err)
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { fetchServices() }, [fetchServices])

  const toggleService = async (service: ULIService) => {
    setToggling(service.id)
    try {
      const res = await fetch('/api/superadmin/uli-hub/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id, is_enabled: !service.is_enabled }),
      })
      const json = await res.json()
      if (json.success) {
        setServices(prev => prev.map(s => s.id === service.id ? json.data : s))
      }
    } catch (err) {
      console.error('Failed to toggle service:', err)
    } finally {
      setToggling(null)
    }
  }

  const testService = async (service: ULIService) => {
    setTesting(service.id)
    setTestResults(prev => ({ ...prev, [service.id]: undefined! }))
    // Simulate sandbox test call (replace with real ULI client call later)
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))
    setTestResults(prev => ({
      ...prev,
      [service.id]: {
        success: Math.random() > 0.15,
        message: 'Sandbox test completed (simulated)',
      },
    }))
    setTesting(null)
  }

  const bulkToggle = async (enable: boolean) => {
    const ids = filteredServices.map(s => s.id)
    for (const id of ids) {
      try {
        await fetch('/api/superadmin/uli-hub/services', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_enabled: enable }),
        })
      } catch {
        // Continue on failure
      }
    }
    fetchServices()
  }

  const filteredServices = services.filter(s =>
    s.service_name.toLowerCase().includes(search.toLowerCase()) ||
    s.service_code.toLowerCase().includes(search.toLowerCase()) ||
    (s.service_description || '').toLowerCase().includes(search.toLowerCase())
  )

  const enabledCount = services.filter(s => s.is_enabled).length
  const totalCost = services.reduce((sum, s) => sum + s.total_cost_this_month, 0)
  const avgSuccessRate = services.length > 0
    ? services.reduce((sum, s) => sum + s.success_rate, 0) / services.length
    : 0

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-gray-800 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-800 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-800 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/superadmin/uli-hub"
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-gray-400 mt-0.5 text-sm">
                {description || categoryMeta?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkToggle(true)}
              className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-xs font-medium transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => bulkToggle(false)}
              className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-medium transition-colors"
            >
              Disable All
            </button>
            <button
              onClick={fetchServices}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Zap className="w-3.5 h-3.5" />
              Total Services
            </div>
            <p className="text-2xl font-bold">{services.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Shield className="w-3.5 h-3.5" />
              Enabled
            </div>
            <p className="text-2xl font-bold text-green-400">{enabledCount}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Activity className="w-3.5 h-3.5" />
              Avg Success Rate
            </div>
            <p className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <IndianRupee className="w-3.5 h-3.5" />
              Cost This Month
            </div>
            <p className="text-2xl font-bold">{totalCost.toFixed(2)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#FF6700]"
          />
        </div>

        {/* Services List */}
        <div className="space-y-3">
          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No services match your search' : 'No services in this category'}
            </div>
          ) : (
            filteredServices.map((service) => {
              const health = HEALTH_CONFIG[service.health_status]
              const HealthIcon = health.icon
              const isExpanded = expandedService === service.id

              return (
                <div
                  key={service.id}
                  className={`rounded-xl border transition-colors ${
                    service.is_enabled
                      ? 'border-gray-700 bg-gray-900'
                      : 'border-gray-800 bg-gray-900/50 opacity-70'
                  }`}
                >
                  {/* Main Row */}
                  <div className="p-4 flex items-center gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleService(service)}
                      disabled={toggling === service.id}
                      className="flex-shrink-0"
                    >
                      {toggling === service.id ? (
                        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                      ) : service.is_enabled ? (
                        <ToggleRight className="w-7 h-7 text-[#FF6700]" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-gray-600" />
                      )}
                    </button>

                    {/* Service Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{service.service_name}</span>
                        <code className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                          {service.service_code}
                        </code>
                        {service.is_sandbox_only && (
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">
                            Sandbox Only
                          </span>
                        )}
                        {service.requires_consent && (
                          <span className="text-xs bg-orange-600/20 text-orange-400 px-1.5 py-0.5 rounded-full">
                            Consent Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {service.service_description}
                      </p>
                    </div>

                    {/* Health Status */}
                    <div className={`flex items-center gap-1.5 ${health.color}`}>
                      <HealthIcon className="w-4 h-4" />
                      <span className="text-xs">{health.label}</span>
                    </div>

                    {/* Stats */}
                    <div className="hidden lg:flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1" title="Success Rate">
                        <Activity className="w-3.5 h-3.5" />
                        {service.success_rate}%
                      </div>
                      <div className="flex items-center gap-1" title="Cost per Call">
                        <IndianRupee className="w-3.5 h-3.5" />
                        {service.cost_per_call}
                      </div>
                      <div className="flex items-center gap-1" title="Last Called">
                        <Clock className="w-3.5 h-3.5" />
                        {service.last_called_at
                          ? new Date(service.last_called_at).toLocaleDateString()
                          : 'Never'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => testService(service)}
                        disabled={testing === service.id}
                        className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        title="Test in Sandbox"
                      >
                        {testing === service.id ? (
                          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => setConfiguring(service)}
                        className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        title="Configure"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setExpandedService(isExpanded ? null : service.id)}
                        className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Test Result */}
                  {testResults[service.id] && (
                    <div className={`px-4 pb-3 flex items-center gap-2 text-xs ${
                      testResults[service.id].success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {testResults[service.id].success ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {testResults[service.id].message}
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-gray-500">API Path</span>
                          <p className="font-mono mt-0.5">{service.uli_api_path || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Method / Version</span>
                          <p className="mt-0.5">{service.uli_api_method} / {service.uli_api_version}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Timeout</span>
                          <p className="mt-0.5">{service.timeout_ms}ms</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Retries</span>
                          <p className="mt-0.5">{service.retry_count} (delay: {service.retry_delay_ms}ms)</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rate Limit / min</span>
                          <p className="mt-0.5">{service.rate_limit_per_minute}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rate Limit / day</span>
                          <p className="mt-0.5">{service.rate_limit_per_day}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Calls (month)</span>
                          <p className="mt-0.5">{service.total_calls_this_month}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Cost (month)</span>
                          <p className="mt-0.5">{service.total_cost_this_month.toFixed(2)}</p>
                        </div>
                      </div>
                      {service.feature_flag_key && (
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Feature Flag:</span>
                          <Link
                            href="/superadmin/feature-flags"
                            className="text-[#FF6700] hover:underline"
                          >
                            {service.feature_flag_key}
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Configure Modal */}
        {configuring && (
          <ConfigureModal
            service={configuring}
            onClose={() => setConfiguring(null)}
            onSaved={(updated) => {
              setServices(prev => prev.map(s => s.id === updated.id ? updated : s))
              setConfiguring(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// --- Configure Service Modal ---
function ConfigureModal({
  service,
  onClose,
  onSaved,
}: {
  service: ULIService
  onClose: () => void
  onSaved: (updated: ULIService) => void
}) {
  const [form, setForm] = useState({
    timeout_ms: service.timeout_ms,
    retry_count: service.retry_count,
    retry_delay_ms: service.retry_delay_ms,
    rate_limit_per_minute: service.rate_limit_per_minute,
    rate_limit_per_day: service.rate_limit_per_day,
    cost_per_call: service.cost_per_call,
    is_sandbox_only: service.is_sandbox_only,
    requires_consent: service.requires_consent,
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/superadmin/uli-hub/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id, ...form }),
      })
      const json = await res.json()
      if (json.success) onSaved(json.data)
    } catch (err) {
      console.error('Failed to update service:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold">Configure Service</h3>
            <p className="text-sm text-gray-400 mt-0.5">{service.service_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Timeout (ms)</label>
            <input
              type="number"
              value={form.timeout_ms}
              onChange={(e) => setForm({ ...form, timeout_ms: parseInt(e.target.value) || 30000 })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6700]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Retry Count</label>
            <input
              type="number"
              value={form.retry_count}
              onChange={(e) => setForm({ ...form, retry_count: parseInt(e.target.value) || 0 })}
              min={0}
              max={10}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6700]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Retry Delay (ms)</label>
            <input
              type="number"
              value={form.retry_delay_ms}
              onChange={(e) => setForm({ ...form, retry_delay_ms: parseInt(e.target.value) || 1000 })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6700]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cost per Call</label>
            <input
              type="number"
              step="0.01"
              value={form.cost_per_call}
              onChange={(e) => setForm({ ...form, cost_per_call: parseFloat(e.target.value) || 0 })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6700]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rate Limit / min</label>
            <input
              type="number"
              value={form.rate_limit_per_minute}
              onChange={(e) => setForm({ ...form, rate_limit_per_minute: parseInt(e.target.value) || 60 })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6700]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rate Limit / day</label>
            <input
              type="number"
              value={form.rate_limit_per_day}
              onChange={(e) => setForm({ ...form, rate_limit_per_day: parseInt(e.target.value) || 10000 })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF6700]"
            />
          </div>

          {/* Toggle options */}
          <div className="col-span-2 flex gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_sandbox_only}
                onChange={(e) => setForm({ ...form, is_sandbox_only: e.target.checked })}
                className="accent-[#FF6700] w-4 h-4"
              />
              Sandbox Only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.requires_consent}
                onChange={(e) => setForm({ ...form, requires_consent: e.target.checked })}
                className="accent-[#FF6700] w-4 h-4"
              />
              Requires Consent
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6700] hover:bg-[#e55d00] text-white transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
