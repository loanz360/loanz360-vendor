'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, HardDrive, AlertTriangle, Edit2, Save, X,
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart3,
  AlertCircle, CheckCircle
} from 'lucide-react'

interface Department {
  name: string
  userCount: number
  storageUsed: number
  storageUsedFormatted: string
  storageLimit: number
  storageLimitFormatted: string
  storageAvailable: number
  usagePercent: number
  fileCount: number
  hasQuota: boolean
  quotaId?: string
  alertThreshold: number
}

interface DepartmentSummary {
  totalDepartments: number
  totalUsers: number
  totalFiles: number
  totalUsed: number
  totalUsedFormatted: string
  totalLimit: number
  totalLimitFormatted: string
  overallUsagePercent: number
}

interface AdminDepartmentQuotasProps {
  onRefresh: () => Promise<{ departments: Department[]; summary: DepartmentSummary }>
  onUpdateQuota: (departmentName: string, storageLimitGB: number, alertThreshold: number) => Promise<void>
}

export default function AdminDepartmentQuotas({
  onRefresh,
  onUpdateQuota,
}: AdminDepartmentQuotasProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [summary, setSummary] = useState<DepartmentSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingDept, setEditingDept] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ limitGB: 10, alertThreshold: 80 })
  const [isSaving, setIsSaving] = useState(false)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'users'>('usage')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await onRefresh()
      setDepartments(data.departments)
      setSummary(data.summary)
    } catch (error) {
      console.error('Failed to load department data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [onRefresh])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleEdit = (dept: Department) => {
    setEditingDept(dept.name)
    setEditValues({
      limitGB: Math.round(dept.storageLimit / (1024 * 1024 * 1024)),
      alertThreshold: dept.alertThreshold,
    })
  }

  const handleSave = async (deptName: string) => {
    setIsSaving(true)
    try {
      await onUpdateQuota(deptName, editValues.limitGB, editValues.alertThreshold)
      setEditingDept(null)
      await loadData()
    } catch (error) {
      console.error('Failed to save quota:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingDept(null)
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 75) return 'bg-yellow-500'
    if (percent >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getUsageTextColor = (percent: number) => {
    if (percent >= 90) return 'text-red-400'
    if (percent >= 75) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getAlertIcon = (percent: number, threshold: number) => {
    if (percent >= 90) return <AlertTriangle className="w-4 h-4 text-red-400" />
    if (percent >= threshold) return <AlertCircle className="w-4 h-4 text-yellow-400" />
    return <CheckCircle className="w-4 h-4 text-green-400" />
  }

  const sortedDepartments = [...departments].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'usage':
        comparison = a.storageUsed - b.storageUsed
        break
      case 'users':
        comparison = a.userCount - b.userCount
        break
    }
    return sortOrder === 'desc' ? -comparison : comparison
  })

  if (isLoading && departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading department quotas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-orange-500" />
            Department Quotas
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage storage allocation per department
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Departments</p>
                <p className="text-xl font-bold text-white">{summary.totalDepartments}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Users</p>
                <p className="text-xl font-bold text-white">{summary.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <HardDrive className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Used</p>
                <p className="text-xl font-bold text-white">{summary.totalUsedFormatted}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Overall Usage</p>
                <p className={`text-xl font-bold ${getUsageTextColor(summary.overallUsagePercent)}`}>
                  {summary.overallUsagePercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">Sort by:</span>
        <div className="flex gap-2">
          {(['usage', 'name', 'users'] as const).map((field) => (
            <button
              key={field}
              onClick={() => {
                if (sortBy === field) {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy(field)
                  setSortOrder('desc')
                }
              }}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                sortBy === field
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortBy === field && (
                <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Department List */}
      <div className="space-y-3">
        {sortedDepartments.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No departments found</p>
            <p className="text-sm text-gray-500 mt-1">
              Departments will appear here once users are assigned
            </p>
          </div>
        ) : (
          sortedDepartments.map((dept) => (
            <div
              key={dept.name}
              className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl overflow-hidden"
            >
              {/* Main Row */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedDept(expandedDept === dept.name ? null : dept.name)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {getAlertIcon(dept.usagePercent, dept.alertThreshold)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{dept.name}</span>
                      {!dept.hasQuota && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                          Default Quota
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {dept.userCount} users
                      </span>
                      <span>{dept.fileCount} files</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-white font-medium">
                      {dept.storageUsedFormatted} / {dept.storageLimitFormatted}
                    </p>
                    <p className={`text-sm ${getUsageTextColor(dept.usagePercent)}`}>
                      {dept.usagePercent.toFixed(1)}% used
                    </p>
                  </div>

                  <div className="w-32">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getUsageColor(dept.usagePercent)} transition-all`}
                        style={{ width: `${Math.max(dept.usagePercent, 1)}%` }}
                      />
                    </div>
                  </div>

                  {expandedDept === dept.name ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedDept === dept.name && (
                <div className="px-4 pb-4 pt-2 border-t border-white/5">
                  {editingDept === dept.name ? (
                    <div className="flex items-end gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Storage Limit (GB)
                        </label>
                        <input
                          type="number"
                          value={editValues.limitGB}
                          onChange={(e) => setEditValues({ ...editValues, limitGB: parseInt(e.target.value) || 0 })}
                          className="w-32 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Alert Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={editValues.alertThreshold}
                          onChange={(e) => setEditValues({ ...editValues, alertThreshold: parseInt(e.target.value) || 80 })}
                          className="w-32 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                          min="50"
                          max="100"
                        />
                      </div>
                      <button
                        onClick={() => handleSave(dept.name)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center gap-2 px-4 py-2 border border-white/20 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-3 gap-6 text-sm">
                        <div>
                          <p className="text-gray-400">Storage Limit</p>
                          <p className="text-white font-medium">{dept.storageLimitFormatted}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Alert Threshold</p>
                          <p className="text-white font-medium">{dept.alertThreshold}%</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Available</p>
                          <p className="text-green-400 font-medium">
                            {((dept.storageLimit - dept.storageUsed) / (1024 * 1024 * 1024)).toFixed(2)} GB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(dept)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Quota
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Warning for departments near limit */}
      {departments.some(d => d.usagePercent >= 90) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Critical Storage Alerts</p>
            <p className="text-sm text-gray-400 mt-1">
              {departments.filter(d => d.usagePercent >= 90).map(d => d.name).join(', ')}
              {' '}department(s) at 90%+ capacity. Consider increasing their quota.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
