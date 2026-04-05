'use client'

/**
 * E27: Automated Health Check Dashboard
 * Monitors API uptime, response times, error rates
 */

import { useState, useEffect, useCallback } from 'react'
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react'

interface HealthCheck {
  name: string
  endpoint: string
  status: 'healthy' | 'degraded' | 'down' | 'checking'
  responseTime: number | null
  lastChecked: Date | null
  errorMessage?: string
}

const ENDPOINTS_TO_CHECK: { name: string; endpoint: string }[] = [
  { name: 'Dashboard API', endpoint: '/api/superadmin/dashboard' },
  { name: 'Auth Service', endpoint: '/api/auth/verify-session' },
  { name: 'Leads API', endpoint: '/api/superadmin/unified-crm/leads?limit=1' },
  { name: 'Employee API', endpoint: '/api/superadmin/employee-management?limit=1' },
  { name: 'Partner API', endpoint: '/api/superadmin/partner-management/partners?limit=1' },
  { name: 'Payout API', endpoint: '/api/superadmin/payouts/stats' },
  { name: 'Activity Feed', endpoint: '/api/superadmin/realtime-feed?limit=1' },
  { name: 'ULI Hub', endpoint: '/api/superadmin/uli-hub/health' },
]

export function HealthCheckDashboard() {
  const [checks, setChecks] = useState<HealthCheck[]>(
    ENDPOINTS_TO_CHECK.map(ep => ({
      ...ep,
      status: 'checking',
      responseTime: null,
      lastChecked: null,
    }))
  )
  const [isRunning, setIsRunning] = useState(false)

  const runHealthChecks = useCallback(async () => {
    setIsRunning(true)
    const results: HealthCheck[] = []

    for (const endpoint of ENDPOINTS_TO_CHECK) {
      const start = performance.now()
      try {
        const response = await fetch(endpoint.endpoint, {
          credentials: 'include',
          signal: AbortSignal.timeout(10000),
        })
        const responseTime = Math.round(performance.now() - start)

        results.push({
          ...endpoint,
          status: response.ok ? (responseTime > 2000 ? 'degraded' : 'healthy') : 'down',
          responseTime,
          lastChecked: new Date(),
          errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
        })
      } catch (error) {
        results.push({
          ...endpoint,
          status: 'down',
          responseTime: Math.round(performance.now() - start),
          lastChecked: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Connection failed',
        })
      }

      // Update progressively
      setChecks(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(c => c.endpoint === endpoint.endpoint)
        if (idx !== -1) updated[idx] = results[results.length - 1]
        return updated
      })
    }

    setIsRunning(false)
  }, [])

  useEffect(() => {
    runHealthChecks()
  }, [runHealthChecks])

  const healthyCount = checks.filter(c => c.status === 'healthy').length
  const degradedCount = checks.filter(c => c.status === 'degraded').length
  const downCount = checks.filter(c => c.status === 'down').length
  const avgResponseTime = checks
    .filter(c => c.responseTime !== null)
    .reduce((sum, c) => sum + (c.responseTime || 0), 0) / Math.max(1, checks.filter(c => c.responseTime !== null).length)

  const StatusIcon = ({ status }: { status: HealthCheck['status'] }) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'down': return <XCircle className="w-5 h-5 text-red-400" />
      default: return <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-xs text-green-400 mb-1">Healthy</p>
          <p className="text-2xl font-bold text-white">{healthyCount}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-xs text-yellow-400 mb-1">Degraded</p>
          <p className="text-2xl font-bold text-white">{degradedCount}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-xs text-red-400 mb-1">Down</p>
          <p className="text-2xl font-bold text-white">{downCount}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-xs text-blue-400 mb-1">Avg Response</p>
          <p className="text-2xl font-bold text-white">{Math.round(avgResponseTime)}ms</p>
        </div>
      </div>

      {/* Service List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-white font-poppins">Service Health</h3>
          </div>
          <button
            onClick={runHealthChecks}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Checking...' : 'Re-check'}
          </button>
        </div>

        <div className="divide-y divide-gray-800">
          {checks.map((check) => (
            <div key={check.endpoint} className="flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-3">
                <StatusIcon status={check.status} />
                <div>
                  <p className="text-sm font-medium text-white">{check.name}</p>
                  <p className="text-xs text-gray-500">{check.endpoint}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {check.errorMessage && (
                  <span className="text-xs text-red-400">{check.errorMessage}</span>
                )}
                {check.responseTime !== null && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className={`text-sm font-mono ${
                      check.responseTime < 500 ? 'text-green-400' :
                      check.responseTime < 2000 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {check.responseTime}ms
                    </span>
                  </div>
                )}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  check.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
                  check.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' :
                  check.status === 'down' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {check.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
