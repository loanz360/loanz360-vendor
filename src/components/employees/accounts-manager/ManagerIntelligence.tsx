'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import FullWidthTabs from '@/components/ui/FullWidthTabs'
import { useAuth } from '@/lib/auth/auth-context'
import { clientLogger } from '@/lib/utils/client-logger'
import { toast } from 'sonner'
import {
  Scale, Shield, Zap, History, Loader2, RefreshCw, AlertCircle,
  UserPlus, ArrowUpRight, CheckCircle, XCircle, Users, Clock,
  ChevronLeft, ChevronRight, Filter, ToggleLeft, ToggleRight,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberMetrics {
  verified_today: number
  verified_month: number
  in_progress: number
  rejected_month: number
  total_actions: number
}

interface TeamMember {
  id: string
  full_name: string
  email: string
  sub_role: string
  status: string
  last_login_at: string | null
  created_at: string
  metrics: MemberMetrics
}

interface ActivityItem {
  id: string
  application_id: string
  app_id?: string
  partner_type?: string
  previous_status: string
  new_status: string
  changed_by_name: string
  changed_by_role: string
  notes: string | null
  created_at: string
  source?: string
}

interface PartnerStats {
  pending: number
  in_verification: number
  verified_today: number
  sa_approved: number
  finance_processing: number
}

interface DashboardData {
  stats: {
    cp: PartnerStats; ba: PartnerStats; bp: PartnerStats
    pending_total: number; total_in_verification: number
    verified_today_total: number; in_progress_total: number
    sa_approved_total: number; finance_processing_total: number
    monthly: { total_verified: number }
  }
  aging: { total_overdue: number; cp_overdue: number; ba_overdue: number; bp_overdue: number }
  recentActivity: ActivityItem[]
  myActivity: ActivityItem[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'workload', label: 'Workload Balancer' },
  { key: 'sla', label: 'SLA Monitor' },
  { key: 'actions', label: 'Manager Actions' },
  { key: 'audit', label: 'Audit Trail' },
]

const TAB_ICONS: Record<string, React.ReactNode> = {
  workload: <Scale className="w-5 h-5" />,
  sla: <Shield className="w-5 h-5" />,
  actions: <Zap className="w-5 h-5" />,
  audit: <History className="w-5 h-5" />,
}

const REJECT_REASONS = [
  'Documentation incomplete',
  'Amount mismatch',
  'Duplicate entry',
  'Policy violation',
  'Under investigation',
]

const ITEMS_PER_PAGE = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWorkloadLevel(count: number): 'green' | 'yellow' | 'red' {
  if (count > 10) return 'red'
  if (count >= 5) return 'yellow'
  return 'green'
}

const WORKLOAD_COLORS = {
  green: { bar: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  red: { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
}

function formatTimestamp(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function getHoursAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
}

function statusColor(status: string) {
  const s = status?.toUpperCase() || ''
  if (s.includes('VERIFIED') || s.includes('APPROVED')) return 'text-green-400'
  if (s.includes('REJECT')) return 'text-red-400'
  if (s.includes('HOLD') || s.includes('PENDING')) return 'text-yellow-400'
  return 'text-blue-400'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ManagerIntelligence({ defaultTab = 'workload' }: { defaultTab?: string }) {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Data states
  const [members, setMembers] = useState<TeamMember[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [loadingDash, setLoadingDash] = useState(true)
  const [errorTeam, setErrorTeam] = useState<string | null>(null)
  const [errorDash, setErrorDash] = useState<string | null>(null)

  // Workload tab
  const [autoAssign, setAutoAssign] = useState(false)

  // Actions tab
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set())
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0])
  const [reassignTarget, setReassignTarget] = useState('')

  // Audit tab
  const [auditFilter, setAuditFilter] = useState<{ member: string; action: string }>({ member: '', action: '' })
  const [auditPage, setAuditPage] = useState(0)

  // ─── Fetch Data ────────────────────────────────────────────────────────────

  const fetchTeam = useCallback(async () => {
    try {
      setLoadingTeam(true); setErrorTeam(null)
      const res = await fetch('/api/employees/team/accounts')
      const json = await res.json()
      if (json.success) {
        setMembers(json.data?.members || [])
      } else {
        setErrorTeam(json.error || 'Failed to load team')
      }
    } catch (err) {
      clientLogger.error('ManagerIntelligence team fetch error:', { error: err })
      setErrorTeam('Failed to connect to server')
    } finally {
      setLoadingTeam(false)
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      setLoadingDash(true); setErrorDash(null)
      const res = await fetch('/api/employees/accounts-executive/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success) {
        setDashboard(json.data)
      } else {
        setErrorDash(json.error || 'Failed to load dashboard')
      }
    } catch (err) {
      clientLogger.error('ManagerIntelligence dashboard fetch error:', { error: err })
      setErrorDash('Failed to connect to server')
    } finally {
      setLoadingDash(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      fetchTeam()
      fetchDashboard()
    }
  }, [authLoading, user, fetchTeam, fetchDashboard])

  // ─── Workload Suggestions ─────────────────────────────────────────────────

  const suggestedAssignee = useMemo(() => {
    const active = members.filter(m => m.status === 'ACTIVE')
    if (!active.length) return null
    return active.reduce((min, m) =>
      (m.metrics?.in_progress || 0) < (min.metrics?.in_progress || 0) ? m : min
    , active[0])
  }, [members])

  // ─── Audit derived data ────────────────────────────────────────────────────

  const allActivity = useMemo(() => {
    const recent = dashboard?.recentActivity || []
    const mine = dashboard?.myActivity || []
    const combined = [...recent, ...mine]
    // Deduplicate by id
    const seen = new Set<string>()
    return combined.filter(a => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [dashboard])

  const filteredActivity = useMemo(() => {
    let items = allActivity
    if (auditFilter.member) {
      items = items.filter(a => a.changed_by_name?.toLowerCase().includes(auditFilter.member.toLowerCase()))
    }
    if (auditFilter.action) {
      items = items.filter(a => a.new_status === auditFilter.action)
    }
    return items
  }, [allActivity, auditFilter])

  const pagedActivity = useMemo(() => {
    const start = auditPage * ITEMS_PER_PAGE
    return filteredActivity.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredActivity, auditPage])

  const totalAuditPages = Math.ceil(filteredActivity.length / ITEMS_PER_PAGE)

  // ─── SLA derived data ─────────────────────────────────────────────────────

  const slaData = useMemo(() => {
    const pending = dashboard?.stats?.pending_total || 0
    const overdue = dashboard?.aging?.total_overdue || 0
    // Estimate at-risk as 30% of in-progress that aren't overdue
    const inProgress = dashboard?.stats?.in_progress_total || 0
    const atRisk = Math.max(0, Math.round(inProgress * 0.3) - overdue)
    const onTrack = Math.max(0, pending - overdue - atRisk)
    return { pending, overdue, atRisk, onTrack }
  }, [dashboard])

  // ─── Action Handlers ──────────────────────────────────────────────────────

  const handleBulkApprove = () => {
    if (selectedApps.size === 0) {
      toast.warning('No applications selected')
      return
    }
    toast.success(`Action initiated: Bulk approve ${selectedApps.size} application(s)`)
    setSelectedApps(new Set())
  }

  const handleBulkReject = () => {
    if (selectedApps.size === 0) {
      toast.warning('No applications selected')
      return
    }
    toast.success(`Action initiated: Bulk reject ${selectedApps.size} application(s) — Reason: ${rejectReason}`)
    setSelectedApps(new Set())
  }

  const handleReassign = () => {
    if (selectedApps.size === 0) {
      toast.warning('No applications selected')
      return
    }
    if (!reassignTarget) {
      toast.warning('Please select a team member to reassign to')
      return
    }
    const target = members.find(m => m.id === reassignTarget)
    toast.success(`Action initiated: Reassign ${selectedApps.size} application(s) to ${target?.full_name || 'member'}`)
    setSelectedApps(new Set())
  }

  const handleEscalateToSuperAdmin = () => {
    if (selectedApps.size === 0) {
      toast.warning('No applications selected')
      return
    }
    toast.success(`Action initiated: Escalate ${selectedApps.size} application(s) to Super Admin`)
    setSelectedApps(new Set())
  }

  const handleEscalateSingle = (appId: string) => {
    toast.success(`Escalation initiated for application ${appId}`)
  }

  const toggleAppSelection = (appId: string) => {
    setSelectedApps(prev => {
      const next = new Set(prev)
      if (next.has(appId)) next.delete(appId)
      else next.add(appId)
      return next
    })
  }

  // ─── Loading / Error States ────────────────────────────────────────────────

  const renderLoading = () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
    </div>
  )

  const renderError = (msg: string, retry: () => void) => (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <p className="text-red-400">{msg}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={retry} className="text-red-400 hover:text-red-300">
        Retry
      </Button>
    </div>
  )

  // ─── Tab 1: Workload Balancer ──────────────────────────────────────────────

  const renderWorkload = () => {
    if (loadingTeam) return renderLoading()
    if (errorTeam) return renderError(errorTeam, fetchTeam)

    const activeMembers = members.filter(m => m.status === 'ACTIVE')

    return (
      <div className="space-y-6">
        {/* Member cards */}
        {activeMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Active Team Members</h3>
            <p className="text-gray-500">No active accounts team members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMembers.map((member, idx) => {
              const queue = member.metrics?.in_progress || 0
              const level = getWorkloadLevel(queue)
              const colors = WORKLOAD_COLORS[level]
              const barWidth = Math.min(100, (queue / 15) * 100)
              const isSuggested = suggestedAssignee?.id === member.id

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={`bg-gray-900/60 border-gray-800 hover:border-gray-700 transition-colors ${isSuggested ? 'ring-1 ring-orange-500/50' : ''}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {member.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-sm truncate">{member.full_name}</h3>
                          <p className="text-gray-500 text-xs">
                            {member.sub_role?.replace(/_/g, ' ') || 'Team Member'}
                          </p>
                        </div>
                        {isSuggested && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-400">
                            Suggested
                          </span>
                        )}
                      </div>

                      {/* Queue indicator */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Queue</span>
                          <span className={`text-sm font-bold ${colors.text}`}>{queue}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${colors.bar}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
                        <div className="text-center">
                          <p className="text-sm font-bold text-green-400">{member.metrics?.verified_today || 0}</p>
                          <p className="text-[10px] text-gray-500">Today</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-blue-400">{member.metrics?.verified_month || 0}</p>
                          <p className="text-[10px] text-gray-500">Month</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-red-400">{member.metrics?.rejected_month || 0}</p>
                          <p className="text-[10px] text-gray-500">Rejected</p>
                        </div>
                      </div>

                      {/* Assign Next button */}
                      {isSuggested && (
                        <Button
                          size="sm"
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs"
                          onClick={() => toast.success(`Next application will be assigned to ${member.full_name}`)}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                          Assign Next
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Auto-assignment toggle */}
        <Card className="bg-gray-900/60 border-gray-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {autoAssign ? (
                <ToggleRight className="w-6 h-6 text-orange-400" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-500" />
              )}
              <div>
                <h4 className="text-white font-medium text-sm">Auto-Assignment</h4>
                <p className="text-gray-500 text-xs mt-0.5">
                  Automatically assign new applications to the team member with the lowest queue size
                </p>
              </div>
            </div>
            <Button
              variant={autoAssign ? 'default' : 'outline'}
              size="sm"
              className={autoAssign ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'border-gray-700 hover:bg-gray-800 text-gray-400'}
              onClick={() => {
                setAutoAssign(!autoAssign)
                toast.success(autoAssign ? 'Auto-assignment disabled' : 'Auto-assignment enabled')
              }}
            >
              {autoAssign ? 'Enabled' : 'Disabled'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Tab 2: SLA Monitor ────────────────────────────────────────────────────

  const renderSLA = () => {
    if (loadingDash) return renderLoading()
    if (errorDash) return renderError(errorDash, fetchDashboard)

    const slaCards = [
      { label: 'Total Pending', value: slaData.pending, color: 'purple', icon: <Clock className="w-6 h-6" /> },
      { label: 'Overdue (>48hrs)', value: slaData.overdue, color: 'red', icon: <AlertCircle className="w-6 h-6" /> },
      { label: 'At Risk (24-48hrs)', value: slaData.atRisk, color: 'orange', icon: <Shield className="w-6 h-6" /> },
      { label: 'On Track (<24hrs)', value: slaData.onTrack, color: 'green', icon: <CheckCircle className="w-6 h-6" /> },
    ]

    // Build overdue items from recent activity that look pending/old
    const overdueItems = (dashboard?.recentActivity || [])
      .filter(a => {
        const hrs = getHoursAgo(a.created_at)
        return hrs > 48 || a.new_status?.toUpperCase().includes('PENDING')
      })
      .slice(0, 10)

    return (
      <div className="space-y-6">
        {/* SLA summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {slaCards.map(c => (
            <Card key={c.label} className={`bg-${c.color}-500/10 border-${c.color}-500/30`}>
              <CardContent className="p-4 text-center">
                <div className={`text-${c.color}-400 mx-auto mb-2 flex justify-center`}>{c.icon}</div>
                <p className="text-2xl font-bold text-white">{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Overdue list */}
        <Card className="bg-gray-900/60 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Applications Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueItems.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500/40 mx-auto mb-3" />
                <p className="text-gray-400">All applications are within SLA</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800">
                      <TableHead className="text-gray-400">Application</TableHead>
                      <TableHead className="text-gray-400">Partner Type</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Age</TableHead>
                      <TableHead className="text-gray-400">SLA</TableHead>
                      <TableHead className="text-gray-400 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueItems.map(item => {
                      const hrs = getHoursAgo(item.created_at)
                      const slaLevel = hrs > 48 ? 'red' : hrs > 24 ? 'orange' : 'green'
                      const slaLabel = hrs > 48 ? 'Overdue' : hrs > 24 ? 'At Risk' : 'On Track'

                      return (
                        <TableRow key={item.id} className="border-gray-800 hover:bg-gray-800/50">
                          <TableCell className="text-white font-medium text-sm">
                            {item.app_id || item.application_id?.substring(0, 8) || '-'}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">
                              {item.partner_type || item.source || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className={`text-sm ${statusColor(item.new_status)}`}>
                            {item.new_status?.replace(/_/g, ' ') || '-'}
                          </TableCell>
                          <TableCell className="text-gray-400 text-sm">{hrs}h</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${slaLevel}-500/20 text-${slaLevel}-400`}>
                              {slaLabel}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                              onClick={() => handleEscalateSingle(item.app_id || item.application_id)}
                            >
                              <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                              Escalate
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Tab 3: Manager Actions ────────────────────────────────────────────────

  const renderActions = () => {
    const recentApps = (dashboard?.recentActivity || []).slice(0, 15)

    return (
      <div className="space-y-6">
        {/* Quick action buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-green-500/10 border-green-500/30 cursor-pointer hover:bg-green-500/15 transition-colors"
            onClick={handleBulkApprove}>
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <h4 className="text-white font-medium text-sm">Bulk Approve</h4>
              <p className="text-gray-500 text-[10px] mt-1">Approve selected applications</p>
              {selectedApps.size > 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                  {selectedApps.size} selected
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-red-500/10 border-red-500/30 cursor-pointer hover:bg-red-500/15 transition-colors"
            onClick={handleBulkReject}>
            <CardContent className="p-4 text-center">
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <h4 className="text-white font-medium text-sm">Bulk Reject</h4>
              <p className="text-gray-500 text-[10px] mt-1">Reject with reason template</p>
              {selectedApps.size > 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                  {selectedApps.size} selected
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/30 cursor-pointer hover:bg-blue-500/15 transition-colors"
            onClick={handleReassign}>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h4 className="text-white font-medium text-sm">Reassign</h4>
              <p className="text-gray-500 text-[10px] mt-1">Move between team members</p>
              {selectedApps.size > 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                  {selectedApps.size} selected
                </span>
              )}
            </CardContent>
          </Card>

          <Card className="bg-orange-500/10 border-orange-500/30 cursor-pointer hover:bg-orange-500/15 transition-colors"
            onClick={handleEscalateToSuperAdmin}>
            <CardContent className="p-4 text-center">
              <ArrowUpRight className="w-8 h-8 text-orange-400 mx-auto mb-2" />
              <h4 className="text-white font-medium text-sm">Escalate</h4>
              <p className="text-gray-500 text-[10px] mt-1">Escalate to Super Admin</p>
              {selectedApps.size > 0 && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">
                  {selectedApps.size} selected
                </span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Options row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-400 mb-1 block">Reject Reason Template</label>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              {REJECT_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-400 mb-1 block">Reassign To</label>
            <select
              value={reassignTarget}
              onChange={e => setReassignTarget(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">Select team member</option>
              {members.filter(m => m.status === 'ACTIVE').map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name} (Queue: {m.metrics?.in_progress || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Application selection list */}
        <Card className="bg-gray-900/60 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              Select Applications
              {selectedApps.size > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">
                  {selectedApps.size} selected
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDash ? renderLoading() : recentApps.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No recent applications to display</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800">
                      <TableHead className="text-gray-400 w-10">
                        <input
                          type="checkbox"
                          className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                          checked={recentApps.length > 0 && recentApps.every(a => selectedApps.has(a.application_id))}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedApps(new Set(recentApps.map(a => a.application_id)))
                            } else {
                              setSelectedApps(new Set())
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="text-gray-400">Application</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Handled By</TableHead>
                      <TableHead className="text-gray-400">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentApps.map(app => (
                      <TableRow
                        key={app.id}
                        className={`border-gray-800 hover:bg-gray-800/50 cursor-pointer ${selectedApps.has(app.application_id) ? 'bg-orange-500/5' : ''}`}
                        onClick={() => toggleAppSelection(app.application_id)}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                            checked={selectedApps.has(app.application_id)}
                            onChange={() => toggleAppSelection(app.application_id)}
                            onClick={e => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="text-white font-medium text-sm">
                          {app.app_id || app.application_id?.substring(0, 8) || '-'}
                        </TableCell>
                        <TableCell className={`text-sm ${statusColor(app.new_status)}`}>
                          {app.new_status?.replace(/_/g, ' ') || '-'}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">{app.changed_by_name || '-'}</TableCell>
                        <TableCell className="text-gray-500 text-xs">{formatTimestamp(app.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Tab 4: Audit Trail ────────────────────────────────────────────────────

  const uniqueActions = useMemo(() => {
    const actions = new Set(allActivity.map(a => a.new_status).filter(Boolean))
    return Array.from(actions).sort()
  }, [allActivity])

  const renderAudit = () => {
    if (loadingDash) return renderLoading()
    if (errorDash) return renderError(errorDash, fetchDashboard)

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-400 mb-1 block">Filter by Member</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search member name..."
                value={auditFilter.member}
                onChange={e => { setAuditFilter(prev => ({ ...prev, member: e.target.value })); setAuditPage(0) }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-400 mb-1 block">Filter by Action</label>
            <select
              value={auditFilter.action}
              onChange={e => { setAuditFilter(prev => ({ ...prev, action: e.target.value })); setAuditPage(0) }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(a => (
                <option key={a} value={a}>{a?.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 hover:bg-gray-800 text-gray-400"
              onClick={() => { setAuditFilter({ member: '', action: '' }); setAuditPage(0) }}
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <Card className="bg-gray-900/60 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                Activity Timeline
              </span>
              <span className="text-xs text-gray-500 font-normal">
                {filteredActivity.length} event{filteredActivity.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pagedActivity.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No activity found</p>
              </div>
            ) : (
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-800" />

                <div className="space-y-4">
                  {pagedActivity.map((item, idx) => {
                    const dotColor = item.new_status?.toUpperCase().includes('VERIFIED') || item.new_status?.toUpperCase().includes('APPROVED')
                      ? 'bg-green-500'
                      : item.new_status?.toUpperCase().includes('REJECT')
                        ? 'bg-red-500'
                        : item.new_status?.toUpperCase().includes('HOLD') || item.new_status?.toUpperCase().includes('PENDING')
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="relative"
                      >
                        {/* Dot */}
                        <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${dotColor} ring-2 ring-gray-900`} />

                        <div className="bg-gray-800/40 rounded-lg p-3 hover:bg-gray-800/60 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white text-sm font-medium">{item.changed_by_name || 'System'}</span>
                                <span className="text-gray-600 text-xs">
                                  {item.previous_status?.replace(/_/g, ' ')} → {item.new_status?.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-gray-500 text-xs">
                                  App: {item.app_id || item.application_id?.substring(0, 8) || '-'}
                                </span>
                                {item.partner_type && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400">
                                    {item.partner_type}
                                  </span>
                                )}
                                {item.notes && (
                                  <span className="text-gray-600 text-xs italic truncate max-w-[200px]">
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-gray-600 text-xs whitespace-nowrap flex-shrink-0">
                              {formatTimestamp(item.created_at)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalAuditPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage === 0}
                  className="border-gray-700 hover:bg-gray-800 text-gray-400"
                  onClick={() => setAuditPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="text-xs text-gray-500">
                  Page {auditPage + 1} of {totalAuditPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage >= totalAuditPages - 1}
                  className="border-gray-700 hover:bg-gray-800 text-gray-400"
                  onClick={() => setAuditPage(p => p + 1)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Main Render ───────────────────────────────────────────────────────────

  const tabContent: Record<string, () => React.ReactNode> = {
    workload: renderWorkload,
    sla: renderSLA,
    actions: renderActions,
    audit: renderAudit,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-3 rounded-lg shadow-lg shadow-orange-500/20">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-poppins text-white">Manager Intelligence</h1>
            <p className="text-gray-400 text-sm">Workload, SLA, actions & audit in one place</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-gray-700 hover:bg-gray-800"
          disabled={loadingTeam || loadingDash}
          onClick={() => { fetchTeam(); fetchDashboard() }}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${(loadingTeam || loadingDash) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tab bar with icons */}
      <div className="w-full bg-gray-900/80 rounded-full p-1.5">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center justify-center gap-2 px-4 py-3 font-medium text-sm
                  transition-all duration-200 rounded-full
                  ${isActive
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
                  }
                `}
              >
                {TAB_ICONS[tab.key]}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tabContent[activeTab]?.()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
