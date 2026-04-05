'use client'

import { useState } from 'react'
import {
  FileText, Download, Filter, Calendar, User, Search,
  ChevronDown, ChevronLeft, ChevronRight, Loader2,
  Upload, Trash2, Share2, Eye, Edit, FolderPlus, Move
} from 'lucide-react'

interface AuditLogEntry {
  id: string
  action: string
  userId: string
  userName: string
  userEmail: string
  resourceType: 'file' | 'folder' | 'share' | 'workspace'
  resourceId: string
  resourceName: string
  details: Record<string, unknown>
  ipAddress: string
  userAgent: string
  timestamp: string
}

interface AdminAuditLogsProps {
  logs: AuditLogEntry[]
  totalCount: number
  currentPage: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
  onFilter: (filters: AuditFilters) => void
  onExport: (format: 'csv' | 'json') => Promise<void>
}

interface AuditFilters {
  action?: string
  userId?: string
  resourceType?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  upload: Upload,
  download: Download,
  delete: Trash2,
  share: Share2,
  view: Eye,
  edit: Edit,
  create_folder: FolderPlus,
  move: Move,
  restore: Upload,
}

const ACTION_COLORS: Record<string, string> = {
  upload: 'bg-green-500/20 text-green-400',
  download: 'bg-blue-500/20 text-blue-400',
  delete: 'bg-red-500/20 text-red-400',
  share: 'bg-purple-500/20 text-purple-400',
  view: 'bg-gray-500/20 text-gray-400',
  edit: 'bg-yellow-500/20 text-yellow-400',
  create_folder: 'bg-orange-500/20 text-orange-400',
  move: 'bg-cyan-500/20 text-cyan-400',
  restore: 'bg-emerald-500/20 text-emerald-400',
}

export default function AdminAuditLogs({
  logs,
  totalCount,
  currentPage,
  pageSize,
  isLoading,
  onPageChange,
  onFilter,
  onExport,
}: AdminAuditLogsProps) {
  const [filters, setFilters] = useState<AuditFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize)

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
    onFilter(newFilters)
  }

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true)
    try {
      await onExport(format)
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || FileText
    return Icon
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-orange-500" />
          Audit Logs
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'border-orange-500 text-orange-400 bg-orange-500/10'
                : 'border-white/20 text-gray-300 hover:bg-white/5'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <div className="relative">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Action</label>
              <div className="relative">
                <select
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full appearance-none px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 text-sm cursor-pointer"
                >
                  <option value="">All Actions</option>
                  <option value="upload">Upload</option>
                  <option value="download">Download</option>
                  <option value="delete">Delete</option>
                  <option value="share">Share</option>
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                  <option value="create_folder">Create Folder</option>
                  <option value="move">Move</option>
                  <option value="restore">Restore</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Resource Type</label>
              <div className="relative">
                <select
                  value={filters.resourceType || ''}
                  onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                  className="w-full appearance-none px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 text-sm cursor-pointer"
                >
                  <option value="">All Types</option>
                  <option value="file">Files</option>
                  <option value="folder">Folders</option>
                  <option value="share">Shares</option>
                  <option value="workspace">Workspaces</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            No audit logs found matching your criteria
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Action</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Resource</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">IP Address</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Timestamp</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ActionIcon = getActionIcon(log.action)
                  const colorClass = ACTION_COLORS[log.action] || 'bg-gray-500/20 text-gray-400'

                  return (
                    <>
                      <tr key={log.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                            <ActionIcon className="w-3.5 h-3.5" />
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-orange-400" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{log.userName}</p>
                              <p className="text-gray-500 text-xs">{log.userEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white text-sm truncate max-w-xs">{log.resourceName}</p>
                            <p className="text-gray-500 text-xs capitalize">{log.resourceType}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-400 text-sm font-mono">
                          {log.ipAddress}
                        </td>
                        <td className="py-4 px-6 text-gray-400 text-sm">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="px-3 py-1 text-xs text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                          >
                            {expandedLog === log.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr className="bg-white/5">
                          <td colSpan={6} className="py-4 px-6">
                            <div className="p-4 bg-black/30 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-300 mb-3">Additional Details</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">User Agent:</span>
                                  <p className="text-gray-300 mt-1 text-xs font-mono break-all">
                                    {log.userAgent}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Metadata:</span>
                                  <pre className="text-gray-300 mt-1 text-xs font-mono bg-black/30 p-2 rounded overflow-auto max-h-32">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 border border-white/20 rounded-lg text-gray-400 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number
              if (totalPages <= 5) {
                page = i + 1
              } else if (currentPage <= 3) {
                page = i + 1
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i
              } else {
                page = currentPage - 2 + i
              }
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`w-10 h-10 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-orange-500 text-white'
                      : 'border border-white/20 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 border border-white/20 rounded-lg text-gray-400 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
