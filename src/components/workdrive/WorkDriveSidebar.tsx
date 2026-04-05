'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HardDrive,
  FolderOpen,
  Clock,
  Star,
  Trash2,
  Share2,
  Settings,
  Users,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { formatFileSize } from '@/lib/workdrive/workdrive-utils'

interface WorkDriveSidebarProps {
  basePath: string // e.g., '/employees/workdrive' or '/superadmin/workdrive'
  isAdmin?: boolean
  isSuperAdmin?: boolean
  storageUsed?: number
  storageLimit?: number
  onNewFolder?: () => void
  onUpload?: () => void
}

export default function WorkDriveSidebar({
  basePath,
  isAdmin = false,
  isSuperAdmin = false,
  storageUsed = 0,
  storageLimit = 10 * 1024 * 1024 * 1024, // 10GB default
  onNewFolder,
  onUpload,
}: WorkDriveSidebarProps) {
  const pathname = usePathname()
  const [adminExpanded, setAdminExpanded] = useState(true)

  const usagePercent = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0
  const usageColor = usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-yellow-500' : 'bg-green-500'

  const mainMenuItems = [
    {
      label: 'My Drive',
      icon: HardDrive,
      href: `${basePath}`,
      exact: true,
    },
    {
      label: 'Shared with Me',
      icon: Share2,
      href: `${basePath}/shared`,
    },
    {
      label: 'Recent',
      icon: Clock,
      href: `${basePath}/recent`,
    },
    {
      label: 'Favorites',
      icon: Star,
      href: `${basePath}/favorites`,
    },
    {
      label: 'Trash',
      icon: Trash2,
      href: `${basePath}/trash`,
    },
  ]

  const adminMenuItems = [
    {
      label: 'Storage Overview',
      icon: BarChart3,
      href: `${basePath}/admin/storage`,
    },
    {
      label: 'User Management',
      icon: Users,
      href: `${basePath}/admin/users`,
    },
    {
      label: 'Audit Logs',
      icon: FileText,
      href: `${basePath}/admin/audit`,
    },
    {
      label: 'Settings',
      icon: Settings,
      href: `${basePath}/admin/settings`,
    },
  ]

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-white/10 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="w-6 h-6 text-orange-500" />
          <h2 className="text-lg font-bold text-white">WorkDrive</h2>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {onUpload && (
            <button
              onClick={onUpload}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload
            </button>
          )}
          {onNewFolder && (
            <button
              onClick={onNewFolder}
              className="flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              title="New Folder"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {mainMenuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href, item.exact)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Admin Section */}
        {(isAdmin || isSuperAdmin) && (
          <div className="mt-6">
            <button
              onClick={() => setAdminExpanded(!adminExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
            >
              <span>Admin Controls</span>
              {adminExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {adminExpanded && (
              <ul className="space-y-1 mt-1">
                {adminMenuItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </nav>

      {/* Storage Usage */}
      <div className="p-4 border-t border-white/10">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Storage</span>
            <span className="text-gray-300">
              {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${usageColor} transition-all duration-300`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {usagePercent.toFixed(1)}% used
          </p>
        </div>
      </div>
    </div>
  )
}
