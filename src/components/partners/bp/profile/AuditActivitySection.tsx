'use client'

import React, { useState } from 'react'
import {
  History,
  Clock,
  User,
  Monitor,
  Globe,
  Filter,
  Search,
  ChevronRight,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import type { BPAuditLog, AuditActionType } from '@/types/bp-profile'
import { cn } from '@/lib/utils/cn'

interface AuditActivitySectionProps {
  auditLogs: BPAuditLog[]
  isLoading?: boolean
  onLoadMore?: () => void
  onExport?: () => Promise<void>
  hasMore?: boolean
}

const actionTypeLabels: Record<AuditActionType, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  VERIFY: 'Verified',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  LOGIN: 'Logged In',
  LOGOUT: 'Logged Out',
  PASSWORD_CHANGE: 'Password Changed',
  DOCUMENT_UPLOAD: 'Document Uploaded',
  DOCUMENT_DELETE: 'Document Deleted',
  PROFILE_EXPORT: 'Profile Exported',
  TEAM_MEMBER_ADD: 'Team Member Added',
  TEAM_MEMBER_REMOVE: 'Team Member Removed',
}

const actionTypeIcons: Record<AuditActionType, React.ElementType> = {
  CREATE: CheckCircle,
  UPDATE: History,
  DELETE: XCircle,
  VERIFY: CheckCircle,
  APPROVE: CheckCircle,
  REJECT: XCircle,
  LOGIN: Monitor,
  LOGOUT: Monitor,
  PASSWORD_CHANGE: AlertTriangle,
  DOCUMENT_UPLOAD: FileText,
  DOCUMENT_DELETE: FileText,
  PROFILE_EXPORT: Download,
  TEAM_MEMBER_ADD: User,
  TEAM_MEMBER_REMOVE: User,
}

const actionTypeColors: Record<AuditActionType, string> = {
  CREATE: 'text-green-400 bg-green-500/10',
  UPDATE: 'text-blue-400 bg-blue-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
  VERIFY: 'text-green-400 bg-green-500/10',
  APPROVE: 'text-green-400 bg-green-500/10',
  REJECT: 'text-red-400 bg-red-500/10',
  LOGIN: 'text-blue-400 bg-blue-500/10',
  LOGOUT: 'text-gray-400 bg-gray-500/10',
  PASSWORD_CHANGE: 'text-yellow-400 bg-yellow-500/10',
  DOCUMENT_UPLOAD: 'text-green-400 bg-green-500/10',
  DOCUMENT_DELETE: 'text-red-400 bg-red-500/10',
  PROFILE_EXPORT: 'text-purple-400 bg-purple-500/10',
  TEAM_MEMBER_ADD: 'text-green-400 bg-green-500/10',
  TEAM_MEMBER_REMOVE: 'text-red-400 bg-red-500/10',
}

export default function AuditActivitySection({
  auditLogs,
  isLoading = false,
  onLoadMore,
  onExport,
  hasMore = false,
}: AuditActivitySectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState<string>('ALL')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(dateString)
  }

  const handleExport = async () => {
    if (!onExport) return
    setIsExporting(true)
    try {
      await onExport()
    } finally {
      setIsExporting(false)
    }
  }

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.field_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.changed_by_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesAction = filterAction === 'ALL' || log.action_type === filterAction

    return matchesSearch && matchesAction
  })

  return (
    <CollapsibleSection
      title="Activity & Audit Log"
      icon={History}
      badge={
        auditLogs.length > 0
          ? { text: `${auditLogs.length} Records`, variant: 'default' }
          : undefined
      }
      actions={
        onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export
          </Button>
        )
      }
    >
      <div className="space-y-4 mt-4">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 text-white pl-10 pr-4 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-gray-800/50 text-white px-3 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="ALL">All Actions</option>
              {Object.entries(actionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const Icon = actionTypeIcons[log.action_type]
            const colorClass = actionTypeColors[log.action_type]
            const isExpanded = expandedLog === log.id

            return (
              <div
                key={log.id}
                className={cn(
                  'bg-gray-800/30 border border-gray-700/50 rounded-lg overflow-hidden transition-all',
                  isExpanded && 'border-orange-500/30'
                )}
              >
                {/* Main Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/50"
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  {/* Icon */}
                  <div className={cn('p-2 rounded-lg', colorClass.split(' ')[1])}>
                    <Icon className={cn('w-4 h-4', colorClass.split(' ')[0])} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {log.action_description}
                    </p>
                    <div className="flex items-center gap-3 text-gray-400 text-xs mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.changed_by === 'SELF' ? 'You' : log.changed_by_name || 'System'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge
                    className={cn(
                      'text-xs',
                      log.approval_status === 'APPROVED'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : log.approval_status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : log.approval_status === 'PENDING'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    )}
                  >
                    {actionTypeLabels[log.action_type]}
                  </Badge>

                  {/* Expand Indicator */}
                  <ChevronRight
                    className={cn(
                      'w-5 h-5 text-gray-400 transition-transform',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-700/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Field Change Info */}
                      {log.field_name && (
                        <div className="p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-gray-500 text-xs mb-1">Field Changed</p>
                          <p className="text-white text-sm font-medium">{log.field_name}</p>
                        </div>
                      )}

                      {/* Old Value */}
                      {log.old_value && (
                        <div className="p-3 bg-red-500/5 rounded-lg">
                          <p className="text-gray-500 text-xs mb-1">Previous Value</p>
                          <p className="text-red-400 text-sm font-mono">{log.old_value}</p>
                        </div>
                      )}

                      {/* New Value */}
                      {log.new_value && (
                        <div className="p-3 bg-green-500/5 rounded-lg">
                          <p className="text-gray-500 text-xs mb-1">New Value</p>
                          <p className="text-green-400 text-sm font-mono">{log.new_value}</p>
                        </div>
                      )}

                      {/* IP Address */}
                      {log.ip_address && (
                        <div className="p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-gray-500 text-xs mb-1">IP Address</p>
                          <p className="text-white text-sm font-mono">{log.ip_address}</p>
                        </div>
                      )}

                      {/* Source */}
                      <div className="p-3 bg-gray-800/50 rounded-lg">
                        <p className="text-gray-500 text-xs mb-1">Source</p>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-orange-400" />
                          <p className="text-white text-sm">{log.source}</p>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="p-3 bg-gray-800/50 rounded-lg">
                        <p className="text-gray-500 text-xs mb-1">Timestamp</p>
                        <p className="text-white text-sm">{formatDate(log.timestamp)}</p>
                      </div>
                    </div>

                    {/* Compliance Review Notes */}
                    {log.compliance_review_notes && (
                      <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                        <p className="text-yellow-400 text-xs font-medium mb-1">
                          Compliance Notes
                        </p>
                        <p className="text-gray-300 text-sm">{log.compliance_review_notes}</p>
                      </div>
                    )}

                    {/* System Flags */}
                    {log.system_flags && log.system_flags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {log.system_flags.map((flag, i) => (
                          <Badge
                            key={i}
                            className="bg-orange-500/10 text-orange-400 border-orange-500/30"
                          >
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading activity...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredLogs.length === 0 && (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg">
              <History className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium mb-2">No Activity Found</p>
              <p className="text-gray-400 text-sm">
                {searchQuery || filterAction !== 'ALL'
                  ? 'Try adjusting your search or filters'
                  : 'Your profile activity will appear here'}
              </p>
            </div>
          )}

          {/* Load More */}
          {hasMore && !isLoading && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                className="border-gray-600 text-gray-400 hover:text-white"
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  )
}
