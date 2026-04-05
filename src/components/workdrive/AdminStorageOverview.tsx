'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HardDrive, Users, FileText, TrendingUp, AlertTriangle,
  RefreshCw, Download, Settings, Loader2, FolderOpen,
  Share2, BarChart3, PieChart, Calendar, Clock, Database,
  AlertCircle, CheckCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

interface StorageStats {
  totalStorage: number
  usedStorage: number
  totalFiles: number
  totalFolders?: number
  totalUsers: number
  activeShares: number
  usagePercent?: number
  availableStorage?: number
  topUsers: Array<{
    userId: string
    userName: string
    usedStorage: number
    quota: number
    fileCount: number
  }>
  storageByDepartment: Array<{
    department: string
    usedStorage: number
    userCount: number
  }>
  recentActivity: Array<{
    action: string
    userName: string
    fileName: string
    timestamp: string
  }>
  byFileType?: Array<{
    type: string
    count: number
    size: number
  }>
  growthTrend?: Array<{
    date: string
    size: number
  }>
}

interface AdminStorageOverviewProps {
  onRefresh: () => Promise<StorageStats>
  onExportReport: () => Promise<void>
  onOpenSettings: () => void
}

export default function AdminStorageOverview({
  onRefresh,
  onExportReport,
  onOpenSettings,
}: AdminStorageOverviewProps) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadStats = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await onRefresh()
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load storage stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load statistics')
      // Set default empty stats on error
      setStats({
        totalStorage: 2 * 1024 * 1024 * 1024 * 1024,
        usedStorage: 0,
        totalFiles: 0,
        totalUsers: 0,
        activeShares: 0,
        topUsers: [],
        storageByDepartment: [],
        recentActivity: [],
      })
    } finally {
      setIsLoading(false)
    }
  }, [onRefresh])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    if (bytes < 0) return 'Unlimited'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getUsagePercentage = (used: number, total: number): number => {
    if (total <= 0) return 0
    return Math.min(100, (used / total) * 100)
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    if (percentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getUsageTextColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 75) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload':
        return <ArrowUpRight className="w-4 h-4 text-green-400" />
      case 'download':
        return <ArrowDownRight className="w-4 h-4 text-blue-400" />
      case 'delete':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      case 'share':
        return <Share2 className="w-4 h-4 text-purple-400" />
      default:
        return <FileText className="w-4 h-4 text-gray-400" />
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await onExportReport()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const getRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading storage analytics...</p>
        </div>
      </div>
    )
  }

  // Use default values if stats is null
  const safeStats: StorageStats = stats || {
    totalStorage: 2 * 1024 * 1024 * 1024 * 1024,
    usedStorage: 0,
    totalFiles: 0,
    totalUsers: 0,
    activeShares: 0,
    topUsers: [],
    storageByDepartment: [],
    recentActivity: [],
  }

  const overallUsage = getUsagePercentage(safeStats.usedStorage, safeStats.totalStorage)

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-orange-500" />
            Storage Overview
          </h2>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export Report
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Warning</p>
            <p className="text-sm text-gray-400 mt-1">
              {error}. Showing default values. Please check your database connection.
            </p>
          </div>
        </div>
      )}

      {/* Main Storage Card */}
      <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl">
              <Database className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Organization Storage</p>
              <p className="text-3xl font-bold text-white">
                {formatBytes(safeStats.usedStorage)}
                <span className="text-lg text-gray-500 font-normal"> / {formatBytes(safeStats.totalStorage)}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold ${getUsageTextColor(overallUsage)}`}>
              {overallUsage.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-400">Used</p>
          </div>
        </div>

        {/* Storage Progress Bar */}
        <div className="relative">
          <div className="h-4 bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full ${getUsageColor(overallUsage)} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.max(overallUsage, 1)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0%</span>
            <span className="text-yellow-400">75%</span>
            <span className="text-red-400">90%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Available Storage */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-gray-400">
            {formatBytes(safeStats.totalStorage - safeStats.usedStorage)} available
          </span>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Files</p>
              <p className="text-2xl font-bold text-white">{safeStats.totalFiles.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <FolderOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Folders</p>
              <p className="text-2xl font-bold text-white">{(safeStats.totalFolders || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-white">{safeStats.totalUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <Share2 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Shares</p>
              <p className="text-2xl font-bold text-white">{safeStats.activeShares.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Users & Department Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users by Storage */}
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Top Users by Storage
          </h3>
          {safeStats.topUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No user storage data available</p>
              <p className="text-sm text-gray-600 mt-1">Users will appear here once they start using WorkDrive</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeStats.topUsers.map((user, idx) => {
                const usage = getUsagePercentage(user.usedStorage, user.quota)
                return (
                  <div key={user.userId} className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                          idx === 2 ? 'bg-orange-700/20 text-orange-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-white font-medium truncate max-w-[150px]">{user.userName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-medium">{formatBytes(user.usedStorage)}</span>
                        <span className="text-gray-500 text-sm"> / {formatBytes(user.quota)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getUsageColor(usage)} transition-all`}
                        style={{ width: `${Math.max(usage, 1)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>{user.fileCount} files</span>
                      <span className={getUsageTextColor(usage)}>
                        {usage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Storage by Department */}
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-orange-500" />
            Storage by Department
          </h3>
          {safeStats.storageByDepartment.length === 0 ? (
            <div className="text-center py-8">
              <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No department data available</p>
              <p className="text-sm text-gray-600 mt-1">Department storage will appear here once configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeStats.storageByDepartment.map((dept) => {
                const percentage = safeStats.usedStorage > 0
                  ? (dept.usedStorage / safeStats.usedStorage) * 100
                  : 0
                return (
                  <div key={dept.department} className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{dept.department}</span>
                      <span className="text-white">{formatBytes(dept.usedStorage)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all"
                        style={{ width: `${Math.max(percentage, 1)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {dept.userCount} users &bull; {percentage.toFixed(1)}% of total
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* File Type Distribution */}
      {safeStats.byFileType && safeStats.byFileType.length > 0 && (
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Storage by File Type
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {safeStats.byFileType.map((fileType) => {
              const typeColors: Record<string, string> = {
                document: 'from-blue-500/20 to-blue-600/10 text-blue-400',
                image: 'from-green-500/20 to-green-600/10 text-green-400',
                spreadsheet: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400',
                presentation: 'from-orange-500/20 to-orange-600/10 text-orange-400',
                archive: 'from-purple-500/20 to-purple-600/10 text-purple-400',
                other: 'from-gray-500/20 to-gray-600/10 text-gray-400',
              }
              const colorClass = typeColors[fileType.type] || typeColors.other
              return (
                <div
                  key={fileType.type}
                  className={`p-4 bg-gradient-to-br ${colorClass} rounded-lg text-center`}
                >
                  <p className="text-2xl font-bold">{fileType.count}</p>
                  <p className="text-sm capitalize mt-1">{fileType.type}</p>
                  <p className="text-xs opacity-70 mt-1">{formatBytes(fileType.size)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          Recent Activity
        </h3>
        {safeStats.recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No recent activity</p>
            <p className="text-sm text-gray-600 mt-1">Activity will appear here as users interact with WorkDrive</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Action</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">File</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {safeStats.recentActivity.map((activity, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs rounded-full ${
                        activity.action === 'upload' ? 'bg-green-500/20 text-green-400' :
                        activity.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                        activity.action === 'share' ? 'bg-purple-500/20 text-purple-400' :
                        activity.action === 'download' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {getActionIcon(activity.action)}
                        {activity.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white">{activity.userName}</td>
                    <td className="py-3 px-4 text-gray-300 truncate max-w-xs">{activity.fileName}</td>
                    <td className="py-3 px-4 text-gray-500 text-sm">
                      {getRelativeTime(activity.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alerts */}
      {safeStats.topUsers.some(u => getUsagePercentage(u.usedStorage, u.quota) >= 90) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Storage Alerts</p>
            <p className="text-sm text-gray-400 mt-1">
              {safeStats.topUsers.filter(u => getUsagePercentage(u.usedStorage, u.quota) >= 90).length} users
              are at or above 90% of their storage quota. Consider increasing their limits or requesting
              them to clean up files.
            </p>
          </div>
        </div>
      )}

      {safeStats.topUsers.some(u => getUsagePercentage(u.usedStorage, u.quota) >= 75 && getUsagePercentage(u.usedStorage, u.quota) < 90) && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Storage Warnings</p>
            <p className="text-sm text-gray-400 mt-1">
              {safeStats.topUsers.filter(u => {
                const usage = getUsagePercentage(u.usedStorage, u.quota)
                return usage >= 75 && usage < 90
              }).length} users
              are approaching their storage quota (75-90% used). Monitor their usage.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
