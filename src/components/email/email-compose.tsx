'use client'

import { toast } from 'sonner'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Minimize2,
  Maximize2,
  Send,
  Paperclip,
  Link,
  Smile,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Trash2,
  Clock,
  ChevronDown,
  Loader2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import DOMPurify from 'dompurify'

interface EmailAddress {
  name?: string
  email: string
}

interface Attachment {
  id: string
  filename: string
  size: number
  content_type: string
  file?: File
  data?: string // base64 encoded file content
}

interface ComposeProps {
  isOpen: boolean
  isMinimized: boolean
  isMaximized: boolean
  replyTo?: {
    message_id: string
    subject: string
    from: EmailAddress
    to: EmailAddress[]
    body: string
  }
  forwardFrom?: {
    message_id: string
    subject: string
    body: string
    attachments: Attachment[]
  }
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onSend: (data: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    body_html: string
    body_text: string
    attachments: Attachment[]
    scheduled_at?: string
  }) => Promise<void>
  onSaveDraft: (data?: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    body_html: string
    body_text: string
    attachments: Attachment[]
  }) => void
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'application/zip', 'application/x-zip-compressed',
]

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function EmailCompose({
  isOpen,
  isMinimized,
  isMaximized,
  replyTo,
  forwardFrom,
  onClose,
  onMinimize,
  onMaximize,
  onSend,
  onSaveDraft,
}: ComposeProps) {
  const [to, setTo] = useState<EmailAddress[]>([])
  const [cc, setCc] = useState<EmailAddress[]>([])
  const [bcc, setBcc] = useState<EmailAddress[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmNoSubject, setConfirmNoSubject] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Date>()
  const [toInput, setToInput] = useState('')
  const [ccInput, setCcInput] = useState('')
  const [bccInput, setBccInput] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = useRef(false)

  // Initialize from reply/forward -- sanitize HTML to prevent XSS
  useEffect(() => {
    if (replyTo) {
      setTo([replyTo.from])
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
      const sanitizedBody = DOMPurify.sanitize(replyTo.body)
      const newBody = `<br/><br/><div style="border-left: 2px solid #ccc; padding-left: 16px; margin-top: 16px;">${sanitizedBody}</div>`
      bodyRef.current = newBody
      setBody(newBody)
      if (editorRef.current) {
        editorRef.current.innerHTML = newBody
      }
    } else if (forwardFrom) {
      setSubject(forwardFrom.subject.startsWith('Fwd:') ? forwardFrom.subject : `Fwd: ${forwardFrom.subject}`)
      const sanitizedBody = DOMPurify.sanitize(forwardFrom.body)
      const newBody = `<br/><br/>---------- Forwarded message ----------<br/>${sanitizedBody}`
      bodyRef.current = newBody
      setBody(newBody)
      if (editorRef.current) {
        editorRef.current.innerHTML = newBody
      }
      setAttachments(forwardFrom.attachments || [])
    }
  }, [replyTo, forwardFrom])

  // Sync editor content on mount (only when editor ref becomes available)
  useEffect(() => {
    if (editorRef.current && bodyRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = bodyRef.current
    }
  })

  // Auto-save drafts every 30s while editing
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    isDirtyRef.current = true

    autoSaveTimerRef.current = setTimeout(() => {
      if (isDirtyRef.current && (subject || body || to.length > 0)) {
        onSaveDraft({
          to,
          cc,
          bcc,
          subject,
          body_html: body,
          body_text: body.replace(/<[^>]*>/g, ''),
          attachments,
        })
        isDirtyRef.current = false
      }
    }, 30000) // 30 seconds
  }, [subject, body, to, cc, bcc, attachments, onSaveDraft])

  // Watch for changes to trigger auto-save
  useEffect(() => {
    if (isOpen && !isMinimized) {
      triggerAutoSave()
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [subject, body, to, cc, bcc, isOpen, isMinimized, triggerAutoSave])

  // Escape key to close compose
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleAddRecipient = (type: 'to' | 'cc' | 'bcc', input: string) => {
    const email = input.trim()
    if (!email) return

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return

    const newAddress: EmailAddress = { email }

    switch (type) {
      case 'to':
        if (!to.find(t => t.email === email)) {
          setTo([...to, newAddress])
        }
        setToInput('')
        break
      case 'cc':
        if (!cc.find(c => c.email === email)) {
          setCc([...cc, newAddress])
        }
        setCcInput('')
        break
      case 'bcc':
        if (!bcc.find(b => b.email === email)) {
          setBcc([...bcc, newAddress])
        }
        setBccInput('')
        break
    }
  }

  const handleRemoveRecipient = (type: 'to' | 'cc' | 'bcc', email: string) => {
    switch (type) {
      case 'to':
        setTo(to.filter(t => t.email !== email))
        break
      case 'cc':
        setCc(cc.filter(c => c.email !== email))
        break
      case 'bcc':
        setBcc(bcc.filter(b => b.email !== email))
        break
    }
  }

  const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB per file
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB total

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    const currentTotalSize = attachments.reduce((sum, a) => sum + (a.size || 0), 0)
    const newAttachments: Attachment[] = []
    let addedSize = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // File type validation
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" has an unsupported file type (${file.type || 'unknown'})`)
        continue
      }

      // File size validation
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds 25MB limit (${formatFileSize(file.size)})`)
        continue
      }

      if (currentTotalSize + addedSize + file.size > MAX_TOTAL_SIZE) {
        toast.error(`Adding "${file.name}" would exceed 100MB total attachment limit`)
        continue
      }

      addedSize += file.size
      newAttachments.push({
        id: `temp-${Date.now()}-${i}`,
        filename: file.name,
        size: file.size,
        content_type: file.type,
        file: file,
      })
    }

    if (newAttachments.length > 0) {
      setAttachments([...attachments, ...newAttachments])
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id))
  }

  const handleSend = async (bypassSubjectCheck = false) => {
    if (to.length === 0) {
      toast.error('Please add at least one recipient')
      return
    }

    if (!subject.trim() && !bypassSubjectCheck) {
      setConfirmNoSubject(true)
      return
    }

    setSending(true)
    try {
      // Convert File objects to base64 for the API
      const processedAttachments = await Promise.all(
        attachments.map(async (att) => {
          if (att.file) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                const result = reader.result as string
                // Remove data URL prefix (e.g., "data:application/pdf;base64,")
                resolve(result.split(',')[1] || result)
              }
              reader.onerror = reject
              reader.readAsDataURL(att.file!)
            })
            return {
              id: att.id,
              filename: att.filename,
              size: att.size,
              content_type: att.content_type,
              data: base64,
            }
          }
          return { id: att.id, filename: att.filename, size: att.size, content_type: att.content_type, data: att.data }
        })
      )

      await onSend({
        to,
        cc,
        bcc,
        subject,
        body_html: body,
        body_text: body.replace(/<[^>]*>/g, ''),
        attachments: processedAttachments,
        scheduled_at: scheduleDate?.toISOString(),
      })
      handleClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email'
      toast.error(errorMessage)
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    setTo([])
    setCc([])
    setBcc([])
    setSubject('')
    setBody('')
    bodyRef.current = ''
    if (editorRef.current) editorRef.current.innerHTML = ''
    setAttachments([])
    setShowCc(false)
    setShowBcc(false)
    setScheduleDate(undefined)
    setToInput('')
    setCcInput('')
    setBccInput('')
    isDirtyRef.current = false
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    onClose()
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          width: isMaximized ? '100%' : isMinimized ? 280 : undefined,
          height: isMaximized ? '100%' : isMinimized ? 48 : 'auto',
        }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className={cn(
          'fixed bg-slate-900 border border-slate-700 rounded-t-lg shadow-2xl overflow-hidden flex flex-col z-50',
          isMaximized
            ? 'inset-4'
            : isMinimized
            ? 'bottom-0 right-4 w-[280px]'
            : 'bottom-0 right-4 max-h-[80vh] w-[min(600px,calc(100vw-2rem))]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white truncate">
            {sending ? 'Sending email...' : subject || 'New Message'}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-white"
              onClick={onMinimize}
              aria-label="Minimize compose window"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-white"
              onClick={onMaximize}
              aria-label="Maximize compose window"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-white"
              onClick={handleClose}
              aria-label="Close compose window"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Recipients */}
            <div className="p-3 space-y-2 border-b border-slate-700">
              {/* To */}
              <div className="flex items-start gap-2">
                <Label className="w-12 pt-1 text-sm text-slate-400">To</Label>
                <div className="flex-1 flex flex-wrap items-center gap-1">
                  {to.map((recipient) => (
                    <Badge
                      key={recipient.email}
                      variant="secondary"
                      className="gap-1 bg-slate-700"
                    >
                      {recipient.name || recipient.email}
                      <button
                        onClick={() => handleRemoveRecipient('to', recipient.email)}
                        aria-label={`Remove ${recipient.email}`}
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        handleAddRecipient('to', toInput)
                      }
                    }}
                    onBlur={() => handleAddRecipient('to', toInput)}
                    placeholder="Add recipients"
                    className="flex-1 min-w-[150px] h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                    aria-label="Add recipients"
                  />
                </div>
                <div className="flex gap-1 text-sm">
                  {!showCc && (
                    <button
                      onClick={() => setShowCc(true)}
                      className="text-slate-400 hover:text-white"
                      aria-label="Show CC field"
                    >
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button
                      onClick={() => setShowBcc(true)}
                      className="text-slate-400 hover:text-white"
                      aria-label="Show BCC field"
                    >
                      Bcc
                    </button>
                  )}
                </div>
              </div>

              {/* Cc */}
              {showCc && (
                <div className="flex items-start gap-2">
                  <Label className="w-12 pt-1 text-sm text-slate-400">Cc</Label>
                  <div className="flex-1 flex flex-wrap items-center gap-1">
                    {cc.map((recipient) => (
                      <Badge
                        key={recipient.email}
                        variant="secondary"
                        className="gap-1 bg-slate-700"
                      >
                        {recipient.name || recipient.email}
                        <button
                          onClick={() => handleRemoveRecipient('cc', recipient.email)}
                          aria-label={`Remove ${recipient.email} from CC`}
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={ccInput}
                      onChange={(e) => setCcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          handleAddRecipient('cc', ccInput)
                        }
                      }}
                      onBlur={() => handleAddRecipient('cc', ccInput)}
                      placeholder="Add CC recipients"
                      className="flex-1 min-w-[150px] h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                      aria-label="Add CC recipients"
                    />
                  </div>
                </div>
              )}

              {/* Bcc */}
              {showBcc && (
                <div className="flex items-start gap-2">
                  <Label className="w-12 pt-1 text-sm text-slate-400">Bcc</Label>
                  <div className="flex-1 flex flex-wrap items-center gap-1">
                    {bcc.map((recipient) => (
                      <Badge
                        key={recipient.email}
                        variant="secondary"
                        className="gap-1 bg-slate-700"
                      >
                        {recipient.name || recipient.email}
                        <button
                          onClick={() => handleRemoveRecipient('bcc', recipient.email)}
                          aria-label={`Remove ${recipient.email} from BCC`}
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={bccInput}
                      onChange={(e) => setBccInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          handleAddRecipient('bcc', bccInput)
                        }
                      }}
                      onBlur={() => handleAddRecipient('bcc', bccInput)}
                      placeholder="Add BCC recipients"
                      className="flex-1 min-w-[150px] h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                      aria-label="Add BCC recipients"
                    />
                  </div>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center gap-2">
                <Label className="w-12 text-sm text-slate-400">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="flex-1 h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                  aria-label="Email subject"
                />
              </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1 px-3 py-1 border-b border-slate-700">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => execCommand('bold')}
                      aria-label="Bold"
                    >
                      <Bold className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bold</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => execCommand('italic')}
                      aria-label="Italic"
                    >
                      <Italic className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Italic</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => execCommand('underline')}
                      aria-label="Underline"
                    >
                      <Underline className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Underline</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-4 bg-slate-700 mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => execCommand('insertUnorderedList')}
                      aria-label="Bulleted list"
                    >
                      <List className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Bulleted list</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => execCommand('insertOrderedList')}
                      aria-label="Numbered list"
                    >
                      <ListOrdered className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Numbered list</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto">
              <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-label="Email body"
                aria-multiline="true"
                className="p-4 min-h-full text-sm text-white outline-none"
                onInput={(e) => {
                  const html = e.currentTarget.innerHTML
                  bodyRef.current = html
                  setBody(html)
                }}
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-slate-700">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-sm"
                  >
                    <Paperclip className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-300">{attachment.filename}</span>
                    <span className="text-slate-500 text-xs">
                      ({formatFileSize(attachment.size)})
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`Remove attachment ${attachment.filename}`}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between p-3 border-t border-slate-700">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_FILE_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  aria-label="Upload file attachments"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Attach files"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach files</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Insert link">
                        <Link className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert link</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Insert emoji">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert emoji</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSaveDraft({
                    to,
                    cc,
                    bcc,
                    subject,
                    body_html: body,
                    body_text: body.replace(/<[^>]*>/g, ''),
                    attachments,
                  })}
                  className="text-slate-400"
                  aria-label="Save draft"
                >
                  Save draft
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="text-slate-400"
                  aria-label="Discard email"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" aria-label="Schedule send">
                      <Clock className="h-4 w-4" />
                      Schedule
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={setScheduleDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={() => handleSend()}
                  disabled={sending || to.length === 0}
                  className="gap-2 bg-orange-500 hover:bg-orange-600"
                  aria-label="Send email"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </motion.div>

      {/* Send without subject confirmation */}
      {confirmNoSubject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Confirm send without subject">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Send without subject?</h3>
            <p className="text-sm text-slate-400 mb-6">
              This email has no subject line. Are you sure you want to send it?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmNoSubject(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg"
                aria-label="Cancel, go back to add a subject"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmNoSubject(false)
                  handleSend(true)
                }}
                className="px-4 py-2 text-sm text-white bg-orange-600 hover:bg-orange-500 rounded-lg"
                aria-label="Send without subject"
              >
                Send Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
