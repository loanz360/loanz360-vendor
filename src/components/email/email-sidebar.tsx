'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Inbox,
  Send,
  FileEdit,
  Star,
  Trash2,
  AlertTriangle,
  Archive,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CARD_COLORS } from '@/lib/constants/theme'

interface EmailFolder {
  id: string
  name: string
  icon: string
  unread_count: number
  is_system?: boolean
}

interface EmailLabel {
  id: string
  name: string
  color: string
  unread_count: number
  total_count: number
}

interface EmailSidebarProps {
  folders: EmailFolder[]
  labels: EmailLabel[]
  activeFolder: string
  activeLabel?: string
  onFolderChange: (folderId: string) => void
  onLabelChange: (labelId: string) => void
  onCompose: () => void
  onCreateLabel?: () => void
  onSettings?: () => void
  loading?: boolean
  quota?: {
    used: number
    limit: number
    percentage: number
  }
}

const folderIcons: Record<string, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileEdit,
  starred: Star,
  trash: Trash2,
  spam: AlertTriangle,
  archive: Archive,
}

export function EmailSidebar({
  folders,
  labels,
  activeFolder,
  activeLabel,
  onFolderChange,
  onLabelChange,
  onCompose,
  onCreateLabel,
  onSettings,
  loading,
  quota,
}: EmailSidebarProps) {
  const [labelsExpanded, setLabelsExpanded] = useState(true)

  return (
    <div className="w-64 h-full bg-slate-900/50 border-r border-slate-700 flex flex-col" role="navigation" aria-label="Email navigation">
      {/* Compose Button */}
      <div className="p-4">
        <Button
          onClick={onCompose}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
          aria-label="Compose new email"
        >
          <Plus className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Folders */}
      <div className="flex-1 overflow-y-auto px-2">
        <nav className="space-y-1" aria-label="Email folders">
          {folders.map((folder) => {
            const Icon = folderIcons[folder.id] || Inbox
            const isActive = activeFolder === folder.id && !activeLabel

            return (
              <button
                key={folder.id}
                onClick={() => onFolderChange(folder.id)}
                aria-label={`${folder.name}${folder.unread_count > 0 ? ` (${folder.unread_count} unread)` : ''}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                  isActive
                    ? 'bg-orange-500/20 text-orange-500'
                    : 'text-slate-300 hover:bg-slate-800'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                {folder.unread_count > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'h-5 px-1.5 text-xs',
                      isActive
                        ? `${CARD_COLORS.primary.bg} ${CARD_COLORS.primary.text} border ${CARD_COLORS.primary.border}`
                        : 'bg-slate-700 text-slate-300'
                    )}
                  >
                    {folder.unread_count > 99 ? '99+' : folder.unread_count}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>

        {/* Labels Section - always visible so users can create labels */}
        <div className="mt-6">
            <button
              onClick={() => setLabelsExpanded(!labelsExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider hover:text-slate-300"
              aria-label={`Labels section, ${labelsExpanded ? 'click to collapse' : 'click to expand'}`}
              aria-expanded={labelsExpanded}
            >
              {labelsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Labels
            </button>

            {labelsExpanded && (
              <motion.nav
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1 mt-1"
                aria-label="Email labels"
              >
                {labels.map((label) => {
                  const isActive = activeLabel === label.id

                  return (
                    <button
                      key={label.id}
                      onClick={() => onLabelChange(label.id)}
                      aria-label={`Label: ${label.name}${label.unread_count > 0 ? ` (${label.unread_count} unread)` : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800/50'
                      )}
                    >
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{label.name}</span>
                      {label.unread_count > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-slate-700 text-slate-300">
                          {label.unread_count}
                        </Badge>
                      )}
                    </button>
                  )
                })}

                {onCreateLabel && (
                  <button
                    onClick={onCreateLabel}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                    aria-label="Create new label"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create label</span>
                  </button>
                )}
              </motion.nav>
            )}
          </div>
      </div>

      {/* Footer with Quota and Settings */}
      <div className="p-4 border-t border-slate-700 space-y-3">
        {quota && (
          <div className="space-y-2" aria-label="Email quota usage">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Daily Quota</span>
              <span className="text-slate-300">
                {quota.used} / {quota.limit}
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={quota.percentage} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  quota.percentage >= 90
                    ? 'bg-red-500'
                    : quota.percentage >= 70
                    ? 'bg-yellow-500'
                    : 'bg-orange-500'
                )}
                style={{ width: `${Math.min(quota.percentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing...
          </div>
        )}

        {onSettings && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettings}
            className="w-full justify-start text-slate-400 hover:text-slate-300"
            aria-label="Email settings"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        )}
      </div>
    </div>
  )
}
