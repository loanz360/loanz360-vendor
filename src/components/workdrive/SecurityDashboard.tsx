'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle,
  FileWarning,
  Activity,
  Users,
  Lock,
  Unlock,
  Eye,
  Download,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
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

interface SecurityEvent {
  id: string
  user_id: string
  user_name?: string
  event_type: string
  file_id?: string
  file_name?: string
  details: Record<string, any>
  risk_level: string
  resolved: boolean
  created_at: string
}

interface SecurityStats {
  totalEvents: number
  blockedFiles: number
  suspiciousUsers: number
  complianceFlags: number
  eventsByType: Record<string, number>
  riskDistribution: Record<string, number>
  recentTrend: 'up' | 'down' | 'stable'
  trendPercentage: number
}

export function SecurityDashboard() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 0,
    blockedFiles: 0,
    suspiciousUsers: 0,
    complianceFlags: 0,
    eventsByType: {},
    riskDistribution: {},
    recentTrend: 'stable',
    trendPercentage: 0,
  })
  const [dateRange, setDateRange] = useState('7d')
  const [eventFilter, setEventFilter] = useState<string>('all')

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const fetchSecurityData = useCallback(async () => {
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      switch (dateRange) {
        case '24h':
          startDate.setHours(now.getHours() - 24)
          break
        case '7d':
          startDate.setDate(now.getDate() - 7)
          break
        case '30d':
          startDate.setDate(now.getDate() - 30)
          break
        case '90d':
          startDate.setDate(now.getDate() - 90)
          break
      }

      // Fetch security events
      let eventsQuery = supabase
        .from('workdrive_security_logs')
        .select(`
          id,
          user_id,
          event_type,
          file_id,
          file_name,
          details,
          risk_level,
          resolved,
          created_at,
          user:profiles!workdrive_security_logs_user_id_fkey(full_name, email)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      if (eventFilter !== 'all') {
        eventsQuery = eventsQuery.eq('event_type', eventFilter)
      }

      const { data: eventsData, error: eventsError } = await eventsQuery

      if (eventsError) {
        console.error('Error fetching events:', eventsError)
      } else {
        const formattedEvents = (eventsData || []).map((e: any) => ({
          ...e,
          user_name: e.user?.full_name || e.user?.email || 'Unknown',
        }))
        setEvents(formattedEvents)
      }

      // Calculate stats
      const allEvents = eventsData || []
      const blockedCount = allEvents.filter((e: any) => e.event_type === 'scan_blocked').length
      const suspiciousCount = new Set(
        allEvents
          .filter((e: any) => e.event_type === 'suspicious_activity')
          .map((e: any) => e.user_id)
      ).size

      // Get compliance flags count
      const { count: complianceCount } = await supabase
        .from('workdrive_compliance_flags')
        .select('id', { count: 'exact', head: true })
        .eq('reviewed', false)

      // Calculate event distribution
      const eventsByType: Record<string, number> = {}
      const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }

      allEvents.forEach((e: any) => {
        eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1
        if (e.risk_level && riskDistribution.hasOwnProperty(e.risk_level)) {
          riskDistribution[e.risk_level]++
        }
      })

      // Calculate trend (compare with previous period)
      const previousStart = new Date(startDate)
      previousStart.setTime(previousStart.getTime() - (now.getTime() - startDate.getTime()))

      const { count: previousCount } = await supabase
        .from('workdrive_security_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', startDate.toISOString())

      const currentCount = allEvents.length
      let trend: 'up' | 'down' | 'stable' = 'stable'
      let trendPercentage = 0

      if (previousCount && previousCount > 0) {
        trendPercentage = Math.round(((currentCount - previousCount) / previousCount) * 100)
        trend = trendPercentage > 10 ? 'up' : trendPercentage < -10 ? 'down' : 'stable'
      }

      setStats({
        totalEvents: currentCount,
        blockedFiles: blockedCount,
        suspiciousUsers: suspiciousCount,
        complianceFlags: complianceCount || 0,
        eventsByType,
        riskDistribution,
        recentTrend: trend,
        trendPercentage: Math.abs(trendPercentage),
      })
    } catch (error) {
      console.error('Error fetching security data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, dateRange, eventFilter])

  useEffect(() => {
    fetchSecurityData()
  }, [fetchSecurityData])

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'scan_blocked':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'scan_warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'scan_passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'access_denied':
        return <Lock className="h-4 w-4 text-red-500" />
      case 'suspicious_activity':
        return <ShieldAlert className="h-4 w-4 text-orange-500" />
      default:
        return <Shield className="h-4 w-4 text-gray-500" />
    }
  }

  const getRiskBadge = (level: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    }
    return <Badge className={colors[level] || ''}>{level}</Badge>
  }

  const getTrendIcon = () => {
    if (stats.recentTrend === 'up') {
      return <TrendingUp className="h-4 w-4 text-red-500" />
    } else if (stats.recentTrend === 'down') {
      return <TrendingDown className="h-4 w-4 text-green-500" />
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            Security Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor security events and compliance status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchSecurityData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{stats.totalEvents}</p>
                  {getTrendIcon()}
                  {stats.trendPercentage > 0 && (
                    <span className={`text-xs ${stats.recentTrend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                      {stats.trendPercentage}%
                    </span>
                  )}
                </div>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked Files</p>
                <p className="text-2xl font-bold text-red-600">{stats.blockedFiles}</p>
              </div>
              <FileWarning className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspicious Users</p>
                <p className="text-2xl font-bold text-orange-600">{stats.suspiciousUsers}</p>
              </div>
              <Users className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Flags</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.complianceFlags}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.riskDistribution).map(([level, count]) => {
              const total = Object.values(stats.riskDistribution).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (count / total) * 100 : 0
              const colors: Record<string, string> = {
                low: 'bg-green-500',
                medium: 'bg-yellow-500',
                high: 'bg-orange-500',
                critical: 'bg-red-500',
              }

              return (
                <div key={level} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{level}</span>
                    <span>{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <Progress value={percentage} className={`h-2 ${colors[level]}`} />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Security Events</CardTitle>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="scan_blocked">Blocked</SelectItem>
                <SelectItem value="scan_warning">Warnings</SelectItem>
                <SelectItem value="access_denied">Access Denied</SelectItem>
                <SelectItem value="suspicious_activity">Suspicious</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mb-2 opacity-50" />
              <p>No security events in this period</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEventIcon(event.event_type)}
                          <span className="capitalize">
                            {event.event_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{event.user_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {event.file_name || '-'}
                      </TableCell>
                      <TableCell>{getRiskBadge(event.risk_level)}</TableCell>
                      <TableCell>{formatDate(event.created_at)}</TableCell>
                      <TableCell>
                        {event.resolved ? (
                          <Badge variant="outline" className="text-green-600">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">
                            Open
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SecurityDashboard
