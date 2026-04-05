/**
 * Audit Log Viewer Component
 * Displays admin activity logs with filtering and search
 */

'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Key,
  RefreshCw,
} from 'lucide-react'
import { format } from 'date-fns'
import { fetchWithErrorHandling, showErrorToast } from '@/lib/errors/client-errors'

export type AuditActionType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'enabled'
  | 'disabled'
  | 'password_reset'
  | 'permission_changed'
  | 'login_success'
  | 'login_failed'
  | 'profile_updated'
  | 'module_access_granted'
  | 'module_access_revoked'

interface AuditLog {
  id: string
  admin_id: string | null
  action_type: AuditActionType
  action_description: string
  changes: Record<string, any>
  performed_by: string | null
  performed_by_name: string | null
  performed_by_role: string | null
  performed_at: string
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, any>
}

interface AuditLogViewerProps {
  adminId?: string
  maxHeight?: string
  showFilters?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

const actionTypeConfig: Record<
  AuditActionType,
  { label: string; icon: React.ReactNode; variant: 'default' | 'success' | 'warning' | 'destructive' }
> = {
  created: {
    label: 'Created',
    icon: <CheckCircle className="h-4 w-4" />,
    variant: 'success',
  },
  updated: {
    label: 'Updated',
    icon: <Edit className="h-4 w-4" />,
    variant: 'default',
  },
  deleted: {
    label: 'Deleted',
    icon: <Trash2 className="h-4 w-4" />,
    variant: 'destructive',
  },
  enabled: {
    label: 'Enabled',
    icon: <CheckCircle className="h-4 w-4" />,
    variant: 'success',
  },
  disabled: {
    label: 'Disabled',
    icon: <XCircle className="h-4 w-4" />,
    variant: 'warning',
  },
  password_reset: {
    label: 'Password Reset',
    icon: <Key className="h-4 w-4" />,
    variant: 'warning',
  },
  permission_changed: {
    label: 'Permission Changed',
    icon: <Shield className="h-4 w-4" />,
    variant: 'default',
  },
  login_success: {
    label: 'Login Success',
    icon: <CheckCircle className="h-4 w-4" />,
    variant: 'success',
  },
  login_failed: {
    label: 'Login Failed',
    icon: <AlertCircle className="h-4 w-4" />,
    variant: 'destructive',
  },
  profile_updated: {
    label: 'Profile Updated',
    icon: <User className="h-4 w-4" />,
    variant: 'default',
  },
  module_access_granted: {
    label: 'Access Granted',
    icon: <Shield className="h-4 w-4" />,
    variant: 'success',
  },
  module_access_revoked: {
    label: 'Access Revoked',
    icon: <Shield className="h-4 w-4" />,
    variant: 'warning',
  },
}

export function AuditLogViewer({
  adminId,
  maxHeight = '600px',
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 30000,
}: AuditLogViewerProps) {
  const [logs, setLogs] = React.useState<AuditLog[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [actionFilter, setActionFilter] = React.useState<string>('all')
  const [dateFilter, setDateFilter] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null)

  const fetchLogs = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (adminId) {
        params.append('admin_id', adminId)
      }

      if (search) {
        params.append('search', search)
      }

      if (actionFilter !== 'all') {
        params.append('action_type', actionFilter)
      }

      if (dateFilter !== 'all') {
        params.append('date_filter', dateFilter)
      }

      const endpoint = adminId
        ? `/api/admin-management/${adminId}/audit-logs?${params}`
        : `/api/admin-management/audit-logs?${params}`

      const result = await fetchWithErrorHandling<{ logs: AuditLog[]; pagination: any }>(endpoint)

      if (result.success && result.data) {
        setLogs(result.data.logs || [])
        setTotalPages(result.data.pagination?.totalPages || 1)
      }
    } catch (error) {
      showErrorToast('Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }, [adminId, search, actionFilter, dateFilter, page])

  React.useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh
  React.useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchLogs()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchLogs])

  const exportToCSV = () => {
    const headers = ['Date', 'Action', 'Description', 'Performed By', 'IP Address']
    const rows = logs.map((log) => [
      format(new Date(log.performed_at), 'yyyy-MM-dd HH:mm:ss'),
      actionTypeConfig[log.action_type]?.label || log.action_type,
      log.action_description,
      log.performed_by_name || 'System',
      log.ip_address || 'N/A',
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Audit Logs</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <Badge variant="outline" className="gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Auto-refresh
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="password_reset">Password Reset</SelectItem>
                <SelectItem value="permission_changed">Permission Changed</SelectItem>
                <SelectItem value="login_success">Login Success</SelectItem>
                <SelectItem value="login_failed">Login Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => fetchLogs()}>
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        )}

        <div className="border rounded-lg" style={{ maxHeight, overflowY: 'auto' }}>
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const config = actionTypeConfig[log.action_type]
                  return (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {format(new Date(log.performed_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config?.variant || 'default'} className="gap-1">
                          {config?.icon}
                          {config?.label || log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{log.action_description}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-sm">
                              {log.performed_by_name || 'System'}
                            </div>
                            {log.performed_by_role && (
                              <div className="text-xs text-gray-500">{log.performed_by_role}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {log.ip_address || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Audit Log Details</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Action Type</label>
                <div className="mt-1">
                  <Badge variant={actionTypeConfig[selectedLog.action_type]?.variant}>
                    {actionTypeConfig[selectedLog.action_type]?.label}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="mt-1 text-sm">{selectedLog.action_description}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Performed By</label>
                <p className="mt-1 text-sm">
                  {selectedLog.performed_by_name || 'System'} ({selectedLog.performed_by_role})
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Timestamp</label>
                <p className="mt-1 text-sm">
                  {format(new Date(selectedLog.performed_at), 'MMMM dd, yyyy HH:mm:ss')}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">IP Address</label>
                <p className="mt-1 text-sm">{selectedLog.ip_address || 'N/A'}</p>
              </div>

              {selectedLog.user_agent && (
                <div>
                  <label className="text-sm font-medium text-gray-600">User Agent</label>
                  <p className="mt-1 text-sm text-gray-600 truncate">{selectedLog.user_agent}</p>
                </div>
              )}

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Changes</label>
                  <pre className="mt-1 text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
