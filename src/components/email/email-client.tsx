'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, Mail, Settings, ArrowLeft, X, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmailSidebar } from './email-sidebar'
import { EmailList } from './email-list'
import { EmailViewer } from './email-viewer'
import { EmailCompose } from './email-compose'
import DOMPurify from 'dompurify'
import { clientLogger } from '@/lib/utils/client-logger'

interface EmailAccount {
  id: string
  email_address: string
  display_name: string
  status: string
  daily_quota: number
}

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

interface EmailMessage {
  id: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  subject: string
  snippet: string
  date: string
  is_read: boolean
  is_starred: boolean
  has_attachments: boolean
  labels?: string[]
  folder: string
}

interface EmailDetail extends EmailMessage {
  message_id: string
  thread_id?: string
  bcc?: { name: string; email: string }[]
  reply_to?: { name: string; email: string }
  body_html: string
  body_text: string
  attachments: Array<{
    id: string
    filename: string
    size: number
    content_type: string
    download_url?: string
  }>
}

interface QuotaInfo {
  used: number
  limit: number
  remaining: number
  percentage: number
}

interface EmailClientProps {
  onClose?: () => void
  fullPage?: boolean
}

export function EmailClient({ onClose, fullPage = false }: EmailClientProps) {
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<EmailAccount | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [labels, setLabels] = useState<EmailLabel[]>([])
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
  const [activeFolder, setActiveFolder] = useState('inbox')
  const [activeLabel, setActiveLabel] = useState<string>()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailDetailLoading, setEmailDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Delete confirmation state
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<EmailDetail | null>(null)

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMinimized, setComposeMinimized] = useState(false)
  const [composeMaximized, setComposeMaximized] = useState(false)
  const [replyTo, setReplyTo] = useState<{
    message_id: string
    subject: string
    from: { name?: string; email: string }
    to: { name?: string; email: string }[]
    body: string
  } | undefined>()
  const [forwardFrom, setForwardFrom] = useState<{
    message_id: string
    subject: string
    body: string
    attachments: Array<{ id: string; filename: string; size: number; content_type: string }>
  } | undefined>()

  // AbortController for search requests
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch account info
  const fetchAccount = useCallback(async () => {
    try {
      const response = await fetch('/api/email/account')
      const data = await response.json()

      if (data.success) {
        setAccount(data.data.account)
        setQuota(data.data.quota)
      } else {
        if (data.code === 'NO_EMAIL_ACCOUNT') {
          setError('no_account')
        } else if (data.code === 'EMAIL_SYSTEM_NOT_CONFIGURED' || data.code === 'PROVIDER_NOT_CONFIGURED' || data.code === 'EMAIL_NOT_CONFIGURED') {
          setError('email_not_configured')
        } else {
          setError(data.error || 'Failed to load account')
        }
      }
    } catch (err) {
      clientLogger.error('Failed to fetch account', { error: err })
      setError('Failed to connect to email service')
    }
  }, [])

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch('/api/email/folders')
      const data = await response.json()

      if (data.success) {
        setFolders(data.data.folders || [])
        setLabels(data.data.labels || [])
      } else if (data.code === 'EMAIL_SYSTEM_NOT_CONFIGURED' || data.code === 'PROVIDER_NOT_CONFIGURED' || data.code === 'EMAIL_NOT_CONFIGURED') {
        setError('email_not_configured')
      } else if (data.code === 'NO_EMAIL_ACCOUNT') {
        setError('no_account')
      }
    } catch (err) {
      clientLogger.error('Failed to fetch folders', { error: err })
    }
  }, [])

  // Fetch emails
  const fetchEmails = useCallback(async (folder: string, label?: string) => {
    try {
      setEmailsLoading(true)

      const params = new URLSearchParams({ folder })
      if (label) params.set('label', label)

      const response = await fetch(`/api/email/messages?${params}`)
      const data = await response.json()

      if (data.success) {
        setEmails(data.data || [])
        setSearchQuery('')
      } else if (data.code === 'EMAIL_NOT_CONFIGURED') {
        setError('email_not_configured')
      } else {
        toast.error(data.error || 'Failed to load emails')
      }
    } catch (err) {
      clientLogger.error('Failed to fetch emails', { error: err })
      toast.error('Failed to load emails')
    } finally {
      setEmailsLoading(false)
    }
  }, [])

  // Fetch single email
  const fetchEmailDetail = useCallback(async (id: string) => {
    try {
      setEmailDetailLoading(true)

      const response = await fetch(`/api/email/messages/${id}`)
      const data = await response.json()

      if (data.success) {
        setSelectedEmail(data.data)
      } else {
        toast.error(data.error || 'Failed to load email')
      }
    } catch (err) {
      clientLogger.error('Failed to fetch email detail', { error: err })
      toast.error('Failed to load email')
    } finally {
      setEmailDetailLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchAccount()
      await fetchFolders()
      setLoading(false)
    }
    init()
  }, [fetchAccount, fetchFolders])

  // Load emails when folder changes
  useEffect(() => {
    if (!error) {
      fetchEmails(activeFolder, activeLabel)
    }
  }, [activeFolder, activeLabel, error, fetchEmails])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      switch (e.key) {
        case 'c':
          if (!composeOpen) {
            e.preventDefault()
            handleCompose()
          }
          break
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (!composeOpen) {
              handleCompose()
            }
          }
          break
        case 'Escape':
          if (selectedEmail) {
            setSelectedEmail(null)
          } else if (composeOpen) {
            setComposeOpen(false)
          }
          break
        case 'j':
          // Navigate down in email list
          if (emails.length > 0) {
            const currentIndex = selectedEmail
              ? emails.findIndex(e => e.id === selectedEmail.id)
              : -1
            const nextIndex = Math.min(currentIndex + 1, emails.length - 1)
            if (nextIndex >= 0) fetchEmailDetail(emails[nextIndex].id)
          }
          break
        case 'k':
          // Navigate up in email list
          if (emails.length > 0) {
            const currentIndex = selectedEmail
              ? emails.findIndex(e => e.id === selectedEmail.id)
              : emails.length
            const prevIndex = Math.max(currentIndex - 1, 0)
            if (prevIndex >= 0) fetchEmailDetail(emails[prevIndex].id)
          }
          break
        case 'Delete':
        case '#':
          // Move selected email to trash
          if (selectedEmail) {
            e.preventDefault()
            setDeleteConfirmEmail(selectedEmail)
          }
          break
        case 'e':
          // Archive selected email
          if (selectedEmail) {
            e.preventDefault()
            handleArchive()
          }
          break
        case 'r':
          // Reply to selected email
          if (selectedEmail) {
            e.preventDefault()
            handleReply()
          }
          break
        case 'a':
          // Reply all (Shift+A)
          if (e.shiftKey && selectedEmail) {
            e.preventDefault()
            handleReplyAll()
          }
          break
        case 'f':
          // Forward - only without modifier keys to not block Ctrl+F find
          if (!e.ctrlKey && !e.metaKey && selectedEmail) {
            e.preventDefault()
            handleForward()
          }
          break
        case 's':
          // Star toggle
          if (selectedEmail) {
            e.preventDefault()
            handleStarToggle(selectedEmail.id, !selectedEmail.is_starred)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [composeOpen, selectedEmail, emails, fetchEmailDetail])

  // Handle folder change
  const handleFolderChange = (folderId: string) => {
    setActiveFolder(folderId)
    setActiveLabel(undefined)
    setSelectedEmail(null)
    setSelectedIds([])
  }

  // Handle label change
  const handleLabelChange = (labelId: string) => {
    setActiveLabel(labelId)
    setSelectedEmail(null)
    setSelectedIds([])
  }

  // Handle email click
  const handleEmailClick = (email: EmailMessage) => {
    fetchEmailDetail(email.id)
  }

  // Handle star toggle (optimistic update with rollback)
  const handleStarToggle = async (id: string, starred: boolean) => {
    // Optimistic update
    const previousEmails = [...emails]
    const previousSelected = selectedEmail
    setEmails(emails.map(e =>
      e.id === id ? { ...e, is_starred: starred } : e
    ))
    if (selectedEmail?.id === id) {
      setSelectedEmail({ ...selectedEmail, is_starred: starred })
    }

    try {
      const response = await fetch(`/api/email/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: starred }),
      })

      if (!response.ok) {
        throw new Error('Failed to update star')
      }
    } catch (err) {
      // Rollback on failure
      clientLogger.error('Failed to update star', { error: err })
      toast.error('Failed to update star')
      setEmails(previousEmails)
      if (previousSelected) setSelectedEmail(previousSelected)
    }
  }

  // Handle bulk action
  const handleBulkAction = async (action: string, ids: string[]) => {
    try {
      const response = await fetch('/api/email/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message_ids: ids }),
      })

      if (!response.ok) {
        throw new Error('Bulk action failed')
      }

      toast.success(`Action completed for ${ids.length} email(s)`)
      setSelectedIds([])
      fetchEmails(activeFolder, activeLabel)
    } catch (err) {
      clientLogger.error('Bulk action failed', { error: err })
      toast.error('Action failed')
    }
  }

  // Handle search with debounce and AbortController
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    // Abort previous search request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }

    if (!query.trim()) {
      fetchEmails(activeFolder, activeLabel)
      return
    }

    searchTimerRef.current = setTimeout(async () => {
      const abortController = new AbortController()
      searchAbortRef.current = abortController

      try {
        setEmailsLoading(true)
        const response = await fetch(
          `/api/email/search?q=${encodeURIComponent(query)}`,
          { signal: abortController.signal }
        )
        const data = await response.json()

        if (data.success) {
          setEmails(data.data || [])
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast.error('Search failed')
        }
      } finally {
        setEmailsLoading(false)
      }
    }, 300)
  }, [activeFolder, activeLabel, fetchEmails])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (searchAbortRef.current) searchAbortRef.current.abort()
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Handle compose
  const handleCompose = () => {
    // Check quota before composing
    if (quota && quota.remaining <= 0) {
      toast.error(`Daily email quota exceeded (${quota.used}/${quota.limit}). Try again tomorrow.`)
      return
    }
    setReplyTo(undefined)
    setForwardFrom(undefined)
    setComposeOpen(true)
    setComposeMinimized(false)
    setComposeMaximized(false)
  }

  // Handle reply
  const handleReply = () => {
    if (!selectedEmail) return

    setReplyTo({
      message_id: selectedEmail.message_id,
      subject: selectedEmail.subject,
      from: selectedEmail.from,
      to: [selectedEmail.from],
      body: DOMPurify.sanitize(selectedEmail.body_html),
    })
    setForwardFrom(undefined)
    setComposeOpen(true)
    setComposeMinimized(false)
  }

  // Handle reply all
  const handleReplyAll = () => {
    if (!selectedEmail) return

    // Filter out current user's email and deduplicate
    const currentUserEmail = account?.email_address?.toLowerCase() || ''
    const allRecipients = [
      selectedEmail.from,
      ...(selectedEmail.to || []),
      ...(selectedEmail.cc || []),
    ]
      .filter((r, i, arr) => arr.findIndex(a => a.email === r.email) === i)
      .filter(r => currentUserEmail ? r.email.toLowerCase() !== currentUserEmail : true)

    setReplyTo({
      message_id: selectedEmail.message_id,
      subject: selectedEmail.subject,
      from: selectedEmail.from,
      to: allRecipients,
      body: DOMPurify.sanitize(selectedEmail.body_html),
    })
    setForwardFrom(undefined)
    setComposeOpen(true)
    setComposeMinimized(false)
  }

  // Handle forward
  const handleForward = () => {
    if (!selectedEmail) return

    setForwardFrom({
      message_id: selectedEmail.message_id,
      subject: selectedEmail.subject,
      body: DOMPurify.sanitize(selectedEmail.body_html),
      attachments: selectedEmail.attachments || [],
    })
    setReplyTo(undefined)
    setComposeOpen(true)
    setComposeMinimized(false)
  }

  // Handle send
  const handleSend = async (data: {
    to: { name?: string; email: string }[]
    cc: { name?: string; email: string }[]
    bcc: { name?: string; email: string }[]
    subject: string
    body_html: string
    body_text: string
    attachments: Array<{ id: string; filename: string; size: number; content_type: string }>
    scheduled_at?: string
  }) => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message)
        fetchAccount() // Refresh quota
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send email'
      toast.error(errorMessage)
      throw err
    }
  }

  // Handle delete with confirmation
  const handleDeleteRequest = () => {
    if (!selectedEmail) return
    setDeleteConfirmEmail(selectedEmail)
  }

  const handleDeleteConfirm = async () => {
    const emailToDelete = deleteConfirmEmail
    if (!emailToDelete) return

    try {
      const response = await fetch(`/api/email/messages/${emailToDelete.id}`, {
        method: 'DELETE',
      })

      const result = await response.json().catch(() => ({ success: response.ok }))

      if (!response.ok || result.success === false) {
        throw new Error(result?.error || `Delete failed (${response.status})`)
      }

      toast.success('Email moved to trash')
      if (selectedEmail?.id === emailToDelete.id) {
        setSelectedEmail(null)
      }
      fetchEmails(activeFolder, activeLabel)
    } catch (err) {
      clientLogger.error('Email delete failed', { error: err })
      toast.error(err instanceof Error ? err.message : 'Failed to delete email')
    } finally {
      setDeleteConfirmEmail(null)
    }
  }

  // Handle archive
  const handleArchive = async () => {
    if (!selectedEmail) return

    try {
      const response = await fetch(`/api/email/messages/${selectedEmail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'archive' }),
      })

      if (!response.ok) {
        throw new Error('Failed to archive email')
      }

      toast.success('Email archived')
      setSelectedEmail(null)
      fetchEmails(activeFolder, activeLabel)
    } catch (err) {
      clientLogger.error('Email archive failed', { error: err })
      toast.error('Failed to archive email')
    }
  }

  // Handle attachment download
  const handleDownloadAttachment = (attachment: { id: string; filename: string; download_url?: string }) => {
    if (attachment.download_url) {
      window.open(attachment.download_url, '_blank')
    } else {
      toast.info('Attachment download not available yet')
    }
  }

  // Label creation modal state
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [creatingLabel, setCreatingLabel] = useState(false)

  // Handle create label
  const handleCreateLabel = () => {
    setNewLabelName('')
    setShowLabelModal(true)
  }

  const handleLabelSubmit = async () => {
    if (!newLabelName.trim()) return
    setCreatingLabel(true)
    try {
      const response = await fetch('/api/email/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName.trim() }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`Label "${newLabelName.trim()}" created`)
        setShowLabelModal(false)
        fetchFolders()
      } else {
        toast.error(data.error || 'Failed to create label')
      }
    } catch (err) {
      clientLogger.error('Label creation failed', { error: err })
      toast.error('Failed to create label')
    } finally {
      setCreatingLabel(false)
    }
  }

  // Handle settings
  const handleSettings = () => {
    toast.info('Email settings will be available in the next update')
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-slate-400">Loading email client...</p>
        </div>
      </div>
    )
  }

  // No account error
  if (error === 'no_account') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 p-8">
        <div className="max-w-md text-center space-y-4">
          <Mail className="h-16 w-16 text-slate-600 mx-auto" />
          <h2 className="text-xl font-semibold text-white">No Email Account</h2>
          <p className="text-slate-400">
            You don&apos;t have a company email account yet. Please contact your administrator to set up your email account.
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Email system not configured error
  if (error === 'email_not_configured') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 p-8">
        <div className="max-w-md text-center space-y-4">
          <Settings className="h-16 w-16 text-slate-600 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Email System Being Set Up</h2>
          <p className="text-slate-400">
            The company email system is being configured. Please check back later or contact your Super Admin for details.
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          )}
        </div>
      </div>
    )
  }

  // General error
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900 p-8">
        <Alert className="max-w-md border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-500">Error</AlertTitle>
          <AlertDescription className="text-red-400/80">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className={`flex h-full bg-slate-900 ${fullPage ? '' : 'rounded-lg overflow-hidden'}`}>
      {/* Sidebar */}
      <EmailSidebar
        folders={folders}
        labels={labels}
        activeFolder={activeFolder}
        activeLabel={activeLabel}
        onFolderChange={handleFolderChange}
        onLabelChange={handleLabelChange}
        onCompose={handleCompose}
        onCreateLabel={handleCreateLabel}
        onSettings={handleSettings}
        quota={quota || undefined}
        loading={emailsLoading}
      />

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Email List */}
        <div className={`${selectedEmail ? 'w-96 border-r border-slate-700' : 'flex-1'}`}>
          <EmailList
            emails={emails}
            selectedIds={selectedIds}
            activeEmailId={selectedEmail?.id}
            folder={activeFolder}
            loading={emailsLoading}
            searchQuery={searchQuery}
            onEmailClick={handleEmailClick}
            onSelectChange={setSelectedIds}
            onStarToggle={handleStarToggle}
            onRefresh={() => fetchEmails(activeFolder, activeLabel)}
            onSearch={handleSearch}
            onBulkAction={handleBulkAction}
          />
        </div>

        {/* Email Viewer */}
        <AnimatePresence mode="wait">
          {selectedEmail && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1"
            >
              <EmailViewer
                email={selectedEmail}
                loading={emailDetailLoading}
                onBack={() => setSelectedEmail(null)}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
                onDelete={handleDeleteRequest}
                onArchive={handleArchive}
                onStarToggle={(starred) => handleStarToggle(selectedEmail.id, starred)}
                onDownloadAttachment={handleDownloadAttachment}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete email?</h3>
            <p className="text-sm text-slate-400 mb-1">
              &quot;{deleteConfirmEmail.subject || '(No subject)'}&quot;
            </p>
            <p className="text-xs text-slate-500 mb-6">This will move the email to trash.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmEmail(null)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg"
                aria-label="Confirm delete"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Creation Modal */}
      {showLabelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Create label">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-white">Create Label</h3>
              </div>
              <button onClick={() => setShowLabelModal(false)} className="text-slate-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLabelSubmit()}
              placeholder="Label name"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 mb-4"
              aria-label="Label name"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLabelModal(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleLabelSubmit}
                disabled={!newLabelName.trim() || creatingLabel}
                className="px-4 py-2 text-sm text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
                aria-label="Create label"
              >
                {creatingLabel && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose */}
      <EmailCompose
        isOpen={composeOpen}
        isMinimized={composeMinimized}
        isMaximized={composeMaximized}
        replyTo={replyTo}
        forwardFrom={forwardFrom}
        onClose={() => setComposeOpen(false)}
        onMinimize={() => setComposeMinimized(!composeMinimized)}
        onMaximize={() => setComposeMaximized(!composeMaximized)}
        onSend={handleSend}
        onSaveDraft={async (draftData) => {
          try {
            await fetch('/api/email/drafts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folder: 'drafts',
                ...draftData,
              }),
            })
            toast.success('Draft saved')
          } catch {
            toast.error('Failed to save draft')
          }
        }}
      />
    </div>
  )
}
