'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, PieChart, TrendingUp, TrendingDown, Calendar,
  HardDrive, FileText, Users, FolderOpen, Clock, RefreshCw,
  Loader2, ArrowUpRight, ArrowDownRight, Download, Filter
} from 'lucide-react'

interface StorageAnalytics {
  totalStorage: number
  usedStorage: number
  availableStorage: number
  usagePercent: number
  byFileType: Array<{
    type: string
    count: number
    size: number
    percentage: number
  }>
  byDepartment: Array<{
    name: string
    size: number
    percentage: number
    userCount: number
  }>
  growthTrend: Array<{
    date: string
    size: number
    change: number
  }>
  topUsers: Array<{
    name: string
    email: string
    size: number
    fileCount: number
  }>
  recentActivity: Array<{
    action: string
    user: string
    file: string
    time: string
    size?: number
  }>
  summary: {
    totalFiles: number
    totalFolders: number
    totalUsers: number
    activeShares: number
    avgFileSize: number
    mostActiveDay: string
    storageGrowthRate: number
  }
}

interface StorageAnalyticsDashboardProps {
  onFetchAnalytics: () => Promise<StorageAnalytics>
  onExportReport: (format: 'csv' | 'pdf') => Promise<void>
}

export default function StorageAnalyticsDashboard({
  onFetchAnalytics,
  onExportReport,
}: StorageAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'users' | 'trends'>('overview')

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await onFetchAnalytics()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }, [onFetchAnalytics])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics, dateRange])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      document: '#3B82F6',
      image: '#10B981',
      spreadsheet: '#F59E0B',
      presentation: '#EF4444',
      archive: '#8B5CF6',
      other: '#6B7280',
    }
    return colors[type] || colors.other
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return '📄'
      case 'image': return '🖼️'
      case 'spreadsheet': return '📊'
      case 'presentation': return '📽️'
      case 'archive': return '📦'
      default: return '📁'
    }
  }

  if (isLoading && !analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // Use mock data if analytics is null
  const data = analytics || {
    totalStorage: 2 * 1024 * 1024 * 1024 * 1024,
    usedStorage: 0,
    availableStorage: 2 * 1024 * 1024 * 1024 * 1024,
    usagePercent: 0,
    byFileType: [],
    byDepartment: [],
    growthTrend: [],
    topUsers: [],
    recentActivity: [],
    summary: {
      totalFiles: 0,
      totalFolders: 0,
      totalUsers: 0,
      activeShares: 0,
      avgFileSize: 0,
      mostActiveDay: 'N/A',
      storageGrowthRate: 0,
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-orange-500" />
            Storage Analytics
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Comprehensive storage insights and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex bg-white/5 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
          <button
            onClick={loadAnalytics}
            disabled={isLoading}
            className="p-2 border border-white/20 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onExportReport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
        {(['overview', 'files', 'users', 'trends'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Main Storage Gauge */}
          <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-400">Organization Storage Usage</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {formatBytes(data.usedStorage)}
                  <span className="text-lg text-gray-500 font-normal ml-2">
                    / {formatBytes(data.totalStorage)}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${
                  data.usagePercent >= 90 ? 'text-red-400' :
                  data.usagePercent >= 75 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {data.usagePercent.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-400">Used</p>
              </div>
            </div>

            {/* Visual Storage Bar */}
            <div className="relative h-8 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                  data.usagePercent >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                  data.usagePercent >= 75 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                  'bg-gradient-to-r from-green-500 to-emerald-600'
                }`}
                style={{ width: `${Math.max(data.usagePercent, 1)}%` }}
              />
              {/* Threshold Markers */}
              <div className="absolute left-[75%] top-0 h-full w-0.5 bg-yellow-500/50" />
              <div className="absolute left-[90%] top-0 h-full w-0.5 bg-red-500/50" />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>0%</span>
              <span className="text-yellow-400">75% Warning</span>
              <span className="text-red-400">90% Critical</span>
              <span>100%</span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <FileText className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-white">{data.summary.totalFiles.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Files</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <FolderOpen className="w-5 h-5 text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-white">{data.summary.totalFolders.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Folders</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <Users className="w-5 h-5 text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-white">{data.summary.totalUsers.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Active Users</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <HardDrive className="w-5 h-5 text-green-400 mb-2" />
              <p className="text-2xl font-bold text-white">{formatBytes(data.summary.avgFileSize)}</p>
              <p className="text-xs text-gray-400">Avg File Size</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <Calendar className="w-5 h-5 text-orange-400 mb-2" />
              <p className="text-2xl font-bold text-white">{data.summary.mostActiveDay}</p>
              <p className="text-xs text-gray-400">Most Active Day</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              {data.summary.storageGrowthRate >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400 mb-2" />
              )}
              <p className={`text-2xl font-bold ${data.summary.storageGrowthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {data.summary.storageGrowthRate >= 0 ? '+' : ''}{data.summary.storageGrowthRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400">Growth Rate</p>
            </div>
          </div>

          {/* File Type & Department Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* File Type Distribution */}
            <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-orange-500" />
                Storage by File Type
              </h3>
              {data.byFileType.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No file type data available
                </div>
              ) : (
                <div className="space-y-3">
                  {data.byFileType.map((item) => (
                    <div key={item.type} className="flex items-center gap-3">
                      <span className="text-xl">{getTypeIcon(item.type)}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white capitalize">{item.type}</span>
                          <span className="text-gray-400">
                            {formatBytes(item.size)} ({item.count} files)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: getTypeColor(item.type),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Department Distribution */}
            <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                Storage by Department
              </h3>
              {data.byDepartment.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No department data available
                </div>
              ) : (
                <div className="space-y-3">
                  {data.byDepartment.slice(0, 6).map((dept, idx) => (
                    <div key={dept.name} className="flex items-center gap-3">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${
                        idx === 0 ? 'bg-orange-500/20 text-orange-400' :
                        idx === 1 ? 'bg-blue-500/20 text-blue-400' :
                        idx === 2 ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {dept.name.charAt(0)}
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white">{dept.name}</span>
                          <span className="text-gray-400">{formatBytes(dept.size)}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all"
                            style={{ width: `${dept.percentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {dept.userCount} users &bull; {dept.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'files' && (
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">File Type Analytics</h3>
          {data.byFileType.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No file data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {data.byFileType.map((item) => (
                <div
                  key={item.type}
                  className="p-4 bg-white/5 rounded-lg text-center hover:bg-white/10 transition-colors"
                >
                  <span className="text-3xl">{getTypeIcon(item.type)}</span>
                  <p className="text-xl font-bold text-white mt-2">{item.count}</p>
                  <p className="text-sm text-gray-400 capitalize">{item.type}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatBytes(item.size)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Top Users by Storage</h3>
          {data.topUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No user data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">#</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">User</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Files</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Storage Used</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((user, idx) => (
                    <tr key={user.email} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                          idx === 2 ? 'bg-orange-700/20 text-orange-400' :
                          'bg-gray-600/20 text-gray-500'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{user.fileCount}</td>
                      <td className="py-3 px-4 text-white font-medium">{formatBytes(user.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Storage Growth Trend</h3>
          {data.growthTrend.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No trend data available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.growthTrend.map((item) => (
                <div key={item.date} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-400 w-24">{item.date}</span>
                  <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"
                      style={{ width: `${(item.size / data.totalStorage) * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-24 text-right">{formatBytes(item.size)}</span>
                  <span className={`flex items-center gap-1 text-sm w-20 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {item.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="p-6 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Recent Activity
        </h3>
        {data.recentActivity.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recent activity
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentActivity.slice(0, 10).map((activity, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  activity.action === 'upload' ? 'bg-green-500/20 text-green-400' :
                  activity.action === 'download' ? 'bg-blue-500/20 text-blue-400' :
                  activity.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                  activity.action === 'share' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {activity.action}
                </span>
                <span className="text-white flex-1 truncate">{activity.file}</span>
                <span className="text-gray-400 text-sm">{activity.user}</span>
                <span className="text-gray-500 text-sm">{activity.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
