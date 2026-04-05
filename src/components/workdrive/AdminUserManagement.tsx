'use client'

import { useState, useEffect } from 'react'
import {
  Users, Search, Filter, MoreVertical, Edit, Trash2,
  HardDrive, Lock, Unlock, Download, Loader2, ChevronDown
} from 'lucide-react'

interface UserStorageData {
  id: string
  name: string
  email: string
  role: string
  department: string
  usedStorage: number
  quota: number
  fileCount: number
  lastActivity: string
  isEnabled: boolean
}

interface AdminUserManagementProps {
  users: UserStorageData[]
  isLoading: boolean
  onSearch: (query: string) => void
  onUpdateQuota: (userId: string, newQuota: number) => Promise<void>
  onToggleAccess: (userId: string, enable: boolean) => Promise<void>
  onViewFiles: (userId: string) => void
  onExportUserData: (userId: string) => Promise<void>
}

const QUOTA_PRESETS = [
  { label: '1 GB', value: 1 * 1024 * 1024 * 1024 },
  { label: '5 GB', value: 5 * 1024 * 1024 * 1024 },
  { label: '10 GB', value: 10 * 1024 * 1024 * 1024 },
  { label: '20 GB', value: 20 * 1024 * 1024 * 1024 },
  { label: '50 GB', value: 50 * 1024 * 1024 * 1024 },
  { label: '100 GB', value: 100 * 1024 * 1024 * 1024 },
  { label: 'Unlimited', value: -1 },
]

export default function AdminUserManagement({
  users,
  isLoading,
  onSearch,
  onUpdateQuota,
  onToggleAccess,
  onViewFiles,
  onExportUserData,
}: AdminUserManagementProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [editingQuota, setEditingQuota] = useState<string | null>(null)
  const [newQuota, setNewQuota] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'enabled' && user.isEnabled) ||
      (statusFilter === 'disabled' && !user.isEnabled)
    return matchesSearch && matchesRole && matchesStatus
  })

  const uniqueRoles = [...new Set(users.map(u => u.role))]

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    if (bytes < 0) return 'Unlimited'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getUsagePercentage = (used: number, quota: number): number => {
    if (quota <= 0) return 0
    return Math.min(100, (used / quota) * 100)
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 75) return 'text-yellow-400'
    return 'text-green-400'
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    onSearch(e.target.value)
  }

  const handleUpdateQuota = async (userId: string) => {
    setIsSaving(true)
    try {
      await onUpdateQuota(userId, newQuota)
      setEditingQuota(null)
    } catch (err) {
      console.error('Failed to update quota:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleAccess = async (userId: string, currentStatus: boolean) => {
    setIsSaving(true)
    try {
      await onToggleAccess(userId, !currentStatus)
    } catch (err) {
      console.error('Failed to toggle access:', err)
    } finally {
      setIsSaving(false)
      setActiveMenu(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-orange-500" />
          User Management
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
          >
            <option value="all">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">User</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Role</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Storage</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Files</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Last Active</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No users found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const usage = getUsagePercentage(user.usedStorage, user.quota)
                    return (
                      <tr key={user.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {editingQuota === user.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={newQuota}
                                onChange={(e) => setNewQuota(parseInt(e.target.value))}
                                className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                              >
                                {QUOTA_PRESETS.map(preset => (
                                  <option key={preset.value} value={preset.value}>
                                    {preset.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleUpdateQuota(user.id)}
                                disabled={isSaving}
                                className="px-2 py-1 bg-green-500 text-white rounded text-xs disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingQuota(null)}
                                className="px-2 py-1 bg-gray-600 text-white rounded text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${getUsageColor(usage)}`}>
                                  {formatBytes(user.usedStorage)}
                                </span>
                                <span className="text-gray-500 text-sm">
                                  / {formatBytes(user.quota)}
                                </span>
                              </div>
                              <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    usage >= 90 ? 'bg-red-500' : usage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${usage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-gray-300">
                          {user.fileCount.toLocaleString()}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`flex items-center gap-1 text-sm ${
                            user.isEnabled ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {user.isEnabled ? (
                              <>
                                <Unlock className="w-4 h-4" />
                                Enabled
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4" />
                                Disabled
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-500 text-sm">
                          {new Date(user.lastActivity).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                          <div className="relative flex justify-end">
                            <button
                              onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-400" />
                            </button>

                            {activeMenu === user.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-10 overflow-hidden">
                                <button
                                  onClick={() => {
                                    setEditingQuota(user.id)
                                    setNewQuota(user.quota)
                                    setActiveMenu(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-300 hover:bg-white/10"
                                >
                                  <HardDrive className="w-4 h-4" />
                                  Edit Quota
                                </button>
                                <button
                                  onClick={() => {
                                    onViewFiles(user.id)
                                    setActiveMenu(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-300 hover:bg-white/10"
                                >
                                  <Search className="w-4 h-4" />
                                  View Files
                                </button>
                                <button
                                  onClick={() => onExportUserData(user.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-300 hover:bg-white/10"
                                >
                                  <Download className="w-4 h-4" />
                                  Export Data
                                </button>
                                <hr className="border-white/10" />
                                <button
                                  onClick={() => handleToggleAccess(user.id, user.isEnabled)}
                                  className={`w-full flex items-center gap-2 px-4 py-2 text-left ${
                                    user.isEnabled ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'
                                  }`}
                                >
                                  {user.isEnabled ? (
                                    <>
                                      <Lock className="w-4 h-4" />
                                      Disable Access
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="w-4 h-4" />
                                      Enable Access
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing {filteredUsers.length} of {users.length} users</span>
        <span>
          Total Storage Used: {formatBytes(users.reduce((sum, u) => sum + u.usedStorage, 0))}
        </span>
      </div>
    </div>
  )
}
