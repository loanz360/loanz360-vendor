'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  Paperclip,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Archive,
  MailOpen,
  Mail,
  Tag,
  SearchX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface EmailMessage {
  id: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  subject: string
  snippet: string
  date: string
  is_read: boolean
  is_starred: boolean
  has_attachments: boolean
  labels?: string[]
  folder: string
}

interface EmailListProps {
  emails: EmailMessage[]
  selectedIds: string[]
  activeEmailId?: string
  folder: string
  loading?: boolean
  searchQuery?: string
  onEmailClick: (email: EmailMessage) => void
  onSelectChange: (ids: string[]) => void
  onStarToggle: (id: string, starred: boolean) => void
  onRefresh: () => void
  onSearch: (query: string) => void
  onBulkAction: (action: string, ids: string[]) => void
}

function formatEmailDate(dateString: string): string {
  const date = new Date(dateString)

  if (isToday(date)) {
    return format(date, 'h:mm a')
  }
  if (isYesterday(date)) {
    return 'Yesterday'
  }
  if (isThisWeek(date)) {
    return format(date, 'EEE')
  }
  if (isThisYear(date)) {
    return format(date, 'MMM d')
  }
  return format(date, 'MMM d, yyyy')
}

// Loading skeleton for email rows
function EmailRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 animate-pulse">
      <div className="h-4 w-4 rounded bg-slate-700" />
      <div className="h-4 w-4 rounded bg-slate-700" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 rounded bg-slate-700" />
          <div className="h-3 w-3 rounded bg-slate-700" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-40 rounded bg-slate-700" />
          <div className="h-3 w-60 rounded bg-slate-700/50" />
        </div>
      </div>
      <div className="h-3 w-12 rounded bg-slate-700" />
    </div>
  )
}

// Memoized email row to prevent unnecessary re-renders
const EmailRow = React.memo(function EmailRow({
  email,
  isSelected,
  isActive,
  folder,
  onSelect,
  onClick,
  onStarToggle,
}: {
  email: EmailMessage
  isSelected: boolean
  isActive: boolean
  folder: string
  onSelect: (id: string, checked: boolean) => void
  onClick: () => void
  onStarToggle: (id: string, starred: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
        isActive
          ? 'bg-orange-500/10 border-l-2 border-orange-500'
          : isSelected
          ? 'bg-slate-800/50'
          : 'hover:bg-slate-800/30',
        !email.is_read && 'bg-slate-800/20'
      )}
      onClick={onClick}
      role="row"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(email.id, !!checked)}
        onClick={(e) => e.stopPropagation()}
        className="border-slate-600"
        aria-label={`Select email from ${email.from.name || email.from.email}`}
      />

      {/* Star */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onStarToggle(email.id, !email.is_starred)
        }}
        className="flex-shrink-0"
        aria-label={email.is_starred ? 'Unstar email' : 'Star email'}
      >
        <Star
          className={cn(
            'h-4 w-4 transition-colors',
            email.is_starred
              ? 'text-yellow-500 fill-yellow-500'
              : 'text-slate-500 hover:text-yellow-500'
          )}
        />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              email.is_read ? 'text-slate-300' : 'text-white font-medium'
            )}
          >
            {folder === 'sent' ? email.to[0]?.name || email.to[0]?.email : email.from.name || email.from.email}
          </span>
          {email.has_attachments && (
            <Paperclip className="h-3 w-3 text-slate-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              email.is_read ? 'text-slate-400' : 'text-slate-200'
            )}
          >
            {email.subject || '(No subject)'}
          </span>
          <span className="text-xs text-slate-500 truncate">
            {email.snippet ? `-- ${email.snippet}` : ''}
          </span>
        </div>
      </div>

      {/* Date */}
      <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
        {formatEmailDate(email.date)}
      </span>
    </div>
  )
})

export function EmailList({
  emails,
  selectedIds,
  activeEmailId,
  folder,
  loading,
  searchQuery,
  onEmailClick,
  onSelectChange,
  onStarToggle,
  onRefresh,
  onSearch,
  onBulkAction,
}: EmailListProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<string[] | null>(null)
  const selectAllRef = useRef<HTMLButtonElement>(null)

  // Sync local search with parent
  useEffect(() => {
    if (searchQuery !== undefined) {
      setLocalSearchQuery(searchQuery)
    }
  }, [searchQuery])

  // Reset focused index when email list changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [emails])

  const allSelected = emails.length > 0 && selectedIds.length === emails.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < emails.length

  // Set indeterminate state on select-all checkbox
  useEffect(() => {
    const el = selectAllRef.current?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (el) {
      el.indeterminate = someSelected
    }
  }, [someSelected])

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectChange([])
    } else {
      onSelectChange(emails.map(e => e.id))
    }
  }

  const handleSelect = useCallback((id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, id])
    } else {
      onSelectChange(selectedIds.filter(i => i !== id))
    }
  }, [selectedIds, onSelectChange])

  const handleSearch = () => {
    onSearch(localSearchQuery)
  }

  // Note: j/k keyboard navigation is handled centrally in email-client.tsx
  // to avoid duplicate event handlers fighting for control

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/30" role="table" aria-label="Email list">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-700">
        {/* Select All */}
        <Checkbox
          ref={selectAllRef}
          checked={allSelected || someSelected}
          onCheckedChange={handleSelectAll}
          className={cn(
            'border-slate-600',
            someSelected && !allSelected && 'data-[state=checked]:bg-slate-600'
          )}
          aria-label={someSelected ? `${selectedIds.length} of ${emails.length} selected` : 'Select all emails'}
        />

        {/* Bulk Actions */}
        <AnimatePresence mode="wait">
          {selectedIds.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onBulkAction('archive', selectedIds)}
                className="text-slate-400 hover:text-white"
                aria-label="Archive selected"
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBulkDeleteConfirm([...selectedIds])}
                className="text-slate-400 hover:text-red-500"
                aria-label="Delete selected"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onBulkAction('mark_read', selectedIds)}
                className="text-slate-400 hover:text-white"
                aria-label="Mark selected as read"
              >
                <MailOpen className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onBulkAction('mark_unread', selectedIds)}
                className="text-slate-400 hover:text-white"
                aria-label="Mark selected as unread"
              >
                <Mail className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" aria-label="Label actions">
                    <Tag className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Add label...</DropdownMenuItem>
                  <DropdownMenuItem>Remove label...</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="secondary" className="ml-2 text-xs">
                {selectedIds.length} selected
              </Badge>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2 flex-1"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="text-slate-400 hover:text-white"
                aria-label="Refresh emails"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search emails..."
                  value={localSearchQuery}
                  onChange={(e) => {
                    setLocalSearchQuery(e.target.value)
                    onSearch(e.target.value)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-8 bg-slate-800/50 border-slate-700 text-sm"
                  aria-label="Search emails"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
                aria-label="Filter emails"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto text-slate-400 hover:text-white" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onBulkAction('mark_all_read', emails.map(e => e.id))}>
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sort by date</DropdownMenuItem>
            <DropdownMenuItem>Sort by sender</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto" role="rowgroup">
        {loading && emails.length === 0 ? (
          <div className="divide-y divide-slate-700/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <EmailRowSkeleton key={i} />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-center">
              {localSearchQuery ? (
                <>
                  <SearchX className="h-12 w-12 text-slate-600" />
                  <p className="text-slate-400">
                    No results found for &ldquo;{localSearchQuery}&rdquo;
                  </p>
                  <p className="text-sm text-slate-500">Try a different search term</p>
                </>
              ) : (
                <>
                  <Mail className="h-12 w-12 text-slate-600" />
                  <p className="text-slate-400">No emails in {folder}</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {emails.map((email, index) => {
              const isSelected = selectedIds.includes(email.id)
              const isActive = activeEmailId === email.id || focusedIndex === index

              return (
                <EmailRow
                  key={email.id}
                  email={email}
                  isSelected={isSelected}
                  isActive={isActive}
                  folder={folder}
                  onSelect={handleSelect}
                  onClick={() => onEmailClick(email)}
                  onStarToggle={onStarToggle}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination info */}
      {emails.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 text-xs text-slate-500">
          <span>{emails.length} email{emails.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Confirm bulk delete">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete {bulkDeleteConfirm.length} email{bulkDeleteConfirm.length !== 1 ? 's' : ''}?</h3>
            <p className="text-sm text-slate-400 mb-6">
              This will move {bulkDeleteConfirm.length} selected email{bulkDeleteConfirm.length !== 1 ? 's' : ''} to trash.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg"
                aria-label="Cancel bulk delete"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onBulkAction('delete', bulkDeleteConfirm)
                  setBulkDeleteConfirm(null)
                }}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg"
                aria-label="Confirm delete selected emails"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
