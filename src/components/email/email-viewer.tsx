'use client'

import React, { useState, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  MoreVertical,
  Paperclip,
  Download,
  ExternalLink,
  Printer,
  Tag,
  ChevronDown,
  ChevronUp,
  Mail,
  Clock,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface EmailAddress {
  name: string
  email: string
}

interface Attachment {
  id: string
  filename: string
  size: number
  content_type: string
  download_url?: string
}

interface EmailDetail {
  id: string
  message_id: string
  thread_id?: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  reply_to?: EmailAddress
  subject: string
  date: string
  body_html: string
  body_text: string
  is_read: boolean
  is_starred: boolean
  has_attachments: boolean
  attachments: Attachment[]
  labels: string[]
  folder: string
}

interface EmailViewerProps {
  email: EmailDetail | null
  loading?: boolean
  onBack: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onDelete: () => void
  onArchive: () => void
  onStarToggle: (starred: boolean) => void
  onDownloadAttachment: (attachment: Attachment) => void
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

export function EmailViewer({
  email,
  loading,
  onBack,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onArchive,
  onStarToggle,
  onDownloadAttachment,
}: EmailViewerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Note: Keyboard shortcuts are handled centrally in email-client.tsx
  // to avoid duplicate event handlers firing the same actions multiple times

  // Build sanitized HTML content for the iframe via srcdoc
  const iframeSrcdoc = React.useMemo(() => {
    if (!email?.body_html) return ''
    const sanitizedHtml = DOMPurify.sanitize(email.body_html, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['target'],
    })
    return `<!DOCTYPE html>
      <html>
      <head>
        <base target="_blank">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #e2e8f0;
            background: transparent;
            margin: 0;
            padding: 0;
            line-height: 1.6;
          }
          a { color: #f97316; }
          img { max-width: 100%; height: auto; }
          blockquote { border-left: 2px solid #475569; padding-left: 12px; margin-left: 0; color: #94a3b8; }
        </style>
      </head>
      <body>${sanitizedHtml}</body>
      </html>`
  }, [email?.body_html])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900/30">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-slate-400">Loading email...</p>
        </div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900/30">
        <div className="flex flex-col items-center gap-3 text-center">
          <Mail className="h-16 w-16 text-slate-600" />
          <h3 className="text-lg font-medium text-slate-300">No email selected</h3>
          <p className="text-sm text-slate-500">
            Select an email from the list to view its contents
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/30" role="article" aria-label={`Email: ${email.subject}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-700">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-400 hover:text-white"
          aria-label="Back to email list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 ml-auto">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStarToggle(!email.is_starred)}
                  className="text-slate-400 hover:text-yellow-500"
                  aria-label={email.is_starred ? 'Unstar this email' : 'Star this email'}
                >
                  <Star
                    className={cn(
                      'h-4 w-4',
                      email.is_starred && 'text-yellow-500 fill-yellow-500'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{email.is_starred ? 'Unstar' : 'Star'}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReply}
                  className="text-slate-400 hover:text-white"
                  aria-label="Reply to this email"
                >
                  <Reply className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply (r)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReplyAll}
                  className="text-slate-400 hover:text-white"
                  aria-label="Reply all"
                >
                  <ReplyAll className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply All (Shift+A)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onForward}
                  className="text-slate-400 hover:text-white"
                  aria-label="Forward this email"
                >
                  <Forward className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Forward (f)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-4 bg-slate-700 mx-1" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onArchive}
                  className="text-slate-400 hover:text-white"
                  aria-label="Archive this email"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive (e)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="text-slate-400 hover:text-red-500"
                  aria-label="Delete this email"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete (#)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
                aria-label="More email actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Tag className="h-4 w-4 mr-2" />
                Add label
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new window
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Mark as unread</DropdownMenuItem>
              <DropdownMenuItem>Mark as spam</DropdownMenuItem>
              <DropdownMenuItem>Block sender</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-6"
        >
          {/* Subject */}
          <h1 className="text-xl font-semibold text-white">
            {email.subject || '(No subject)'}
          </h1>

          {/* Sender Info */}
          <div className="flex items-start gap-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-orange-500/20 text-orange-500">
                {getInitials(email.from.name || email.from.email)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">
                  {email.from.name || email.from.email}
                </span>
                <span className="text-sm text-slate-400">
                  &lt;{email.from.email}&gt;
                </span>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 mt-1"
                aria-label={showDetails ? 'Hide email details' : 'Show email details'}
                aria-expanded={showDetails}
              >
                <span>to {email.to[0]?.name || email.to[0]?.email}</span>
                {email.to.length > 1 && (
                  <span>and {email.to.length - 1} others</span>
                )}
                {showDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 p-3 rounded-lg bg-slate-800/50 text-sm space-y-2"
                >
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-12">From:</span>
                    <span className="text-slate-300">{email.from.email}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-12">To:</span>
                    <span className="text-slate-300">
                      {email.to.map(t => t.email).join(', ')}
                    </span>
                  </div>
                  {email.cc && email.cc.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-slate-400 w-12">Cc:</span>
                      <span className="text-slate-300">
                        {email.cc.map(c => c.email).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-12">Date:</span>
                    <span className="text-slate-300">
                      {format(new Date(email.date), 'PPpp')}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-3 w-3" />
              {format(new Date(email.date), 'PPp')}
            </div>
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-slate-800/30 border border-slate-700">
              <Paperclip className="h-4 w-4 text-slate-400 mt-0.5" />
              {email.attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  onClick={() => onDownloadAttachment(attachment)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                  aria-label={`Download attachment: ${attachment.filename} (${formatFileSize(attachment.size)})`}
                >
                  <span className="text-sm text-slate-300">{attachment.filename}</span>
                  <span className="text-xs text-slate-500">
                    ({formatFileSize(attachment.size)})
                  </span>
                  <Download className="h-3 w-3 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {/* Email Body - rendered in sandboxed iframe */}
          {email.body_html ? (
            <iframe
              ref={iframeRef}
              sandbox=""
              srcdoc={iframeSrcdoc}
              title="Email content"
              className="w-full min-h-[300px] border-0 bg-transparent"
              style={{ colorScheme: 'dark' }}
            />
          ) : (
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
              {email.body_text}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Reply */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Button onClick={onReply} className="gap-2 bg-orange-500 hover:bg-orange-600" aria-label="Reply to this email">
            <Reply className="h-4 w-4" />
            Reply
          </Button>
          <Button variant="outline" onClick={onForward} className="gap-2" aria-label="Forward this email">
            <Forward className="h-4 w-4" />
            Forward
          </Button>
        </div>
      </div>
    </div>
  )
}
