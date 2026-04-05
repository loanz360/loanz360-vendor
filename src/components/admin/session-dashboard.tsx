'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useConfirmationDialog, ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Monitor, Smartphone, Tablet, MapPin, Clock, AlertCircle, Power, Trash2 } from 'lucide-react'
import { fetchWithErrorHandling, showErrorToast, showSuccessToast } from '@/lib/errors/client-errors'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  id: string
  device_type: string
  device_name: string
  browser: string
  os: string
  ip_address: string
  ip_city: string
  ip_country: string
  is_active: boolean
  is_current: boolean
  is_suspicious: boolean
  created_at: string
  last_activity_at: string
  expires_at: string
}

export function SessionDashboard({ adminId }: { adminId: string }) {
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const { isOpen, config, openDialog, closeDialog } = useConfirmationDialog()

  React.useEffect(() => {
    fetchSessions()
  }, [adminId])

  const fetchSessions = async () => {
    setLoading(true)
    const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/sessions`)
    if (result.success) {
      setSessions(result.data.sessions)
      setStats(result.data.statistics)
    }
    setLoading(false)
  }

  const terminateSession = (sessionId: string) => {
    openDialog({
      action: 'custom',
      title: 'Terminate Session',
      description: 'This will immediately log out the user from this device.',
      confirmText: 'Terminate',
      variant: 'destructive',
      onConfirm: async () => {
        const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/sessions`, {
          method: 'DELETE',
          body: JSON.stringify({ sessionId })
        })
        if (result.success) {
          showSuccessToast('Session terminated')
          fetchSessions()
        }
        closeDialog()
      }
    })
  }

  const terminateAllSessions = () => {
    openDialog({
      action: 'delete',
      entityName: 'all sessions',
      entityType: 'sessions',
      onConfirm: async () => {
        const result = await fetchWithErrorHandling(`/api/admin-management/${adminId}/sessions`, {
          method: 'DELETE',
          body: JSON.stringify({ terminateAll: true })
        })
        if (result.success) {
          showSuccessToast('All sessions terminated')
          fetchSessions()
        }
        closeDialog()
      }
    })
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="h-5 w-5" />
      case 'tablet': return <Tablet className="h-5 w-5" />
      default: return <Monitor className="h-5 w-5" />
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Statistics */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.active_sessions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_sessions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unique Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unique_devices}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unique Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.unique_ips}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sessions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Manage active login sessions across devices</CardDescription>
              </div>
              <Button variant="destructive" size="sm" onClick={terminateAllSessions}>
                <Power className="h-4 w-4 mr-2" />
                Terminate All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-start justify-between border rounded-lg p-4">
                  <div className="flex gap-4">
                    <div className="mt-1">{getDeviceIcon(session.device_type)}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{session.device_name || session.browser}</p>
                        {session.is_current && <Badge>Current Session</Badge>}
                        {session.is_suspicious && <Badge variant="destructive">Suspicious</Badge>}
                      </div>
                      <p className="text-sm text-gray-600">{session.os} • {session.browser}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.ip_city}, {session.ip_country} ({session.ip_address})
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active {formatDistanceToNow(new Date(session.last_activity_at))} ago
                        </span>
                      </div>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button variant="ghost" size="sm" onClick={() => terminateSession(session.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-center text-gray-500 py-8">No active sessions</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog open={isOpen} onOpenChange={closeDialog} onConfirm={config.onConfirm || (() => {})} {...config} />
    </>
  )
}
