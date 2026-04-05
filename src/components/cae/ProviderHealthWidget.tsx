'use client'

/**
 * Provider Health Monitoring Widget
 * Displays real-time health status of all CAE providers
 * Part of Bug Fix #4 - Automated Provider Health Monitoring
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  TrendingUp,
  Zap,
} from 'lucide-react'

interface ProviderHealth {
  provider_key: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'TIMEOUT'
  last_checked: string
  response_time_ms: number
  success_rate: number
  error_message?: string
}

interface HealthData {
  providers: ProviderHealth[]
  overall_status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  checked_at: string
}

export function ProviderHealthWidget() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const { toast } = useToast()

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/cae/health')
      if (!res.ok) throw new Error('Failed to fetch health status')

      const data = await res.json()
      if (data.success) {
        setHealth(data.data)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Health check error:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch provider health status',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const triggerManualCheck = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/cae/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) throw new Error('Manual check failed')

      const data = await res.json()
      if (data.success) {
        setHealth(data.data)
        toast({
          title: 'Health Check Complete',
          description: 'All providers have been checked',
        })
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Manual check error:', error)
      toast({
        title: 'Error',
        description: 'Failed to perform manual health check',
        variant: 'destructive',
      })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    // Auto-refresh every minute
    const interval = setInterval(fetchHealth, 60000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const getStatusConfig = (status: string) => {
    const configs = {
      HEALTHY: {
        icon: <CheckCircle className="w-4 h-4" />,
        color: 'text-green-400',
        bg: 'bg-green-600/20',
        border: 'border-green-600/30',
      },
      DEGRADED: {
        icon: <AlertTriangle className="w-4 h-4" />,
        color: 'text-yellow-400',
        bg: 'bg-yellow-600/20',
        border: 'border-yellow-600/30',
      },
      DOWN: {
        icon: <XCircle className="w-4 h-4" />,
        color: 'text-red-400',
        bg: 'bg-red-600/20',
        border: 'border-red-600/30',
      },
      TIMEOUT: {
        icon: <Clock className="w-4 h-4" />,
        color: 'text-orange-400',
        bg: 'bg-orange-600/20',
        border: 'border-orange-600/30',
      },
    }

    return configs[status as keyof typeof configs] || configs.HEALTHY
  }

  const getOverallStatusConfig = (status: string) => {
    const configs = {
      HEALTHY: {
        color: 'text-green-400',
        bg: 'bg-green-600/10',
        label: 'All Systems Operational',
      },
      DEGRADED: {
        color: 'text-yellow-400',
        bg: 'bg-yellow-600/10',
        label: 'Partial Degradation',
      },
      DOWN: {
        color: 'text-red-400',
        bg: 'bg-red-600/10',
        label: 'System Issues Detected',
      },
    }

    return configs[status as keyof typeof configs] || configs.HEALTHY
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <Card className="bg-brand-ash">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            Provider Health Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!health) {
    return (
      <Card className="bg-brand-ash">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            Provider Health Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No health data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const overallConfig = getOverallStatusConfig(health.overall_status)

  return (
    <Card className="bg-brand-ash">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Provider Health Status
            </CardTitle>
            <CardDescription>Real-time monitoring of third-party providers</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerManualCheck}
            disabled={checking}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Check Now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className={`p-4 rounded-lg border ${overallConfig.bg} border-neutral-700`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall System Status</p>
              <p className={`text-lg font-bold ${overallConfig.color}`}>{overallConfig.label}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm text-foreground">{formatTimestamp(health.checked_at)}</p>
            </div>
          </div>
        </div>

        {/* Provider List */}
        {health.providers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No active providers configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {health.providers.map((provider) => {
              const config = getStatusConfig(provider.status)

              return (
                <div
                  key={provider.provider_key}
                  className={`p-4 rounded-lg border ${config.border} bg-neutral-800/30 hover:bg-neutral-800/50 transition-colors`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <div className={config.color}>{config.icon}</div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{provider.provider_key}</h4>
                        <p className={`text-sm ${config.color}`}>{provider.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full ${config.bg} ${config.color}`}>
                        {provider.success_rate.toFixed(1)}% uptime
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Response Time
                      </p>
                      <p className="text-foreground font-medium">{provider.response_time_ms}ms</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Success Rate
                      </p>
                      <p className="text-foreground font-medium">{provider.success_rate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last Check
                      </p>
                      <p className="text-foreground font-medium">{formatTimestamp(provider.last_checked)}</p>
                    </div>
                  </div>

                  {provider.error_message && (
                    <div className="mt-3 p-2 rounded bg-red-900/20 border border-red-800/30">
                      <p className="text-xs text-red-300">{provider.error_message}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
