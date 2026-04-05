'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  File,
  X,
  Download,
  User,
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  Reply,
  Trash2,
  Edit2
} from 'lucide-react'

export interface MessageAttachment {
  id: string
  name: string
  url: string
  type: string
  size: number
}

export interface Message {
  id: string
  content: string
  sender_id: string
  sender_name: string
  sender_type: 'customer' | 'partner' | 'employee' | 'system' | 'ai'
  sender_avatar?: string
  created_at: string
  attachments?: MessageAttachment[]
  is_internal?: boolean
  read_at?: string
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  reply_to?: {
    id: string
    content: string
    sender_name: string
  }
}

interface MessageThreadProps {
  messages: Message[]
  loading?: boolean
  currentUserId: string
  currentUserType: 'customer' | 'partner' | 'employee'
  onSendMessage: (content: string, attachments?: File[], isInternal?: boolean, replyToId?: string) => Promise<void>
  onDeleteMessage?: (messageId: string) => Promise<void>
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>
  allowInternalNotes?: boolean
  allowAttachments?: boolean
  maxAttachmentSize?: number // in MB
  placeholder?: string
  disabled?: boolean
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function MessageBubble({
  message,
  isOwn,
  onReply,
  onDelete,
  onEdit,
  showActions
}: {
  message: Message
  isOwn: boolean
  onReply?: () => void
  onDelete?: () => void
  onEdit?: () => void
  showActions: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)

  const getSenderIcon = () => {
    switch (message.sender_type) {
      case 'system':
        return <Bot className="w-4 h-4" />
      case 'ai':
        return <Bot className="w-4 h-4 text-purple-400" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getBubbleStyles = () => {
    if (message.sender_type === 'system') {
      return 'bg-gray-800 border border-gray-700 text-gray-300 mx-auto max-w-md text-center text-sm'
    }
    if (message.is_internal) {
      return 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-100'
    }
    if (isOwn) {
      return 'bg-orange-500/20 border border-orange-500/30 text-white ml-auto'
    }
    return 'bg-white/5 border border-white/10 text-white'
  }

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <Clock className="w-3 h-3 text-gray-500" />
      case 'delivered':
        return <CheckCircle className="w-3 h-3 text-gray-400" />
      case 'read':
        return <CheckCircle className="w-3 h-3 text-green-400" />
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />
      default:
        return null
    }
  }

  return (
    <div className={`group flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} ${message.sender_type === 'system' ? 'justify-center' : ''}`}>
      {message.sender_type !== 'system' && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isOwn ? 'bg-orange-500/20' : 'bg-white/10'
        }`}>
          {message.sender_avatar ? (
            <img src={message.sender_avatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            getSenderIcon()
          )}
        </div>
      )}

      <div className={`max-w-[70%] ${message.sender_type === 'system' ? 'max-w-md' : ''}`}>
        {/* Sender name and time */}
        {message.sender_type !== 'system' && (
          <div className={`flex items-center gap-2 mb-1 text-xs ${isOwn ? 'justify-end' : ''}`}>
            <span className="text-gray-400">{message.sender_name}</span>
            {message.is_internal && (
              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px]">
                Internal
              </span>
            )}
            <span className="text-gray-500">{formatTime(message.created_at)}</span>
          </div>
        )}

        {/* Reply reference */}
        {message.reply_to && (
          <div className={`mb-1 p-2 rounded bg-white/5 border-l-2 border-orange-500/50 text-xs ${isOwn ? 'text-right' : ''}`}>
            <span className="text-gray-500">Replying to {message.reply_to.sender_name}:</span>
            <p className="text-gray-400 truncate">{message.reply_to.content}</p>
          </div>
        )}

        {/* Message bubble */}
        <div className={`relative rounded-lg p-3 ${getBubbleStyles()}`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map(attachment => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded bg-black/20 hover:bg-black/30 transition-colors"
                >
                  {attachment.type.startsWith('image/') ? (
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                  ) : (
                    <File className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="flex-1 text-sm truncate">{attachment.name}</span>
                  <span className="text-xs text-gray-500">{formatFileSize(attachment.size)}</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </a>
              ))}
            </div>
          )}

          {/* Message actions */}
          {showActions && message.sender_type !== 'system' && (
            <div className={`absolute top-1 ${isOwn ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity`}>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
                    <div className={`absolute ${isOwn ? 'left-0' : 'right-0'} top-full mt-1 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px] z-10`}>
                      {onReply && (
                        <button
                          onClick={() => { onReply(); setShowMenu(false) }}
                          className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
                        >
                          <Reply className="w-4 h-4" /> Reply
                        </button>
                      )}
                      {isOwn && onEdit && (
                        <button
                          onClick={() => { onEdit(); setShowMenu(false) }}
                          className="w-full px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                      )}
                      {isOwn && onDelete && (
                        <button
                          onClick={() => { onDelete(); setShowMenu(false) }}
                          className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-white/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status indicator */}
        {isOwn && message.status && (
          <div className="flex justify-end mt-1">
            {getStatusIcon()}
          </div>
        )}
      </div>
    </div>
  )
}

export function MessageThread({
  messages,
  loading = false,
  currentUserId,
  currentUserType,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  allowInternalNotes = false,
  allowAttachments = true,
  maxAttachmentSize = 10,
  placeholder = 'Type a message...',
  disabled = false,
  className = ''
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isInternal, setIsInternal] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
    }
  }, [newMessage])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxSize = maxAttachmentSize * 1024 * 1024

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds ${maxAttachmentSize}MB limit`)
        return false
      }
      return true
    })

    setAttachments(prev => [...prev, ...validFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if ((!newMessage.trim() && attachments.length === 0) || disabled || sending) return

    setError(null)
    setSending(true)

    try {
      await onSendMessage(
        newMessage.trim(),
        attachments.length > 0 ? attachments : undefined,
        isInternal,
        replyTo?.id
      )
      setNewMessage('')
      setAttachments([])
      setReplyTo(null)
      setIsInternal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReply = (message: Message) => {
    setReplyTo(message)
    textareaRef.current?.focus()
  }

  const handleDelete = async (messageId: string) => {
    if (!onDeleteMessage) return
    if (!confirm('Are you sure you want to delete this message?')) return

    try {
      await onDeleteMessage(messageId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message')
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <MessageSquareIcon className="w-12 h-12 mb-3 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation below</p>
          </div>
        ) : (
          messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === currentUserId}
              onReply={() => handleReply(message)}
              onDelete={onDeleteMessage ? () => handleDelete(message.id) : undefined}
              onEdit={onEditMessage ? () => {/* TODO: implement edit UI */} : undefined}
              showActions={currentUserType === 'employee'}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose area */}
      <div className="border-t border-white/10 p-4">
        {/* Error message */}
        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="mb-3 p-2 bg-white/5 border-l-2 border-orange-500/50 rounded flex items-start gap-2">
            <div className="flex-1">
              <span className="text-xs text-gray-500">Replying to {replyTo.sender_name}</span>
              <p className="text-sm text-gray-400 truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/10 rounded"
              >
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                ) : (
                  <File className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-300 max-w-[150px] truncate">{file.name}</span>
                <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          {allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Message input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '150px' }}
            />
          </div>

          {/* Internal note toggle */}
          {allowInternalNotes && (
            <button
              onClick={() => setIsInternal(!isInternal)}
              disabled={disabled}
              className={`p-2 rounded-lg transition-colors ${
                isInternal
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              title={isInternal ? 'Internal note (not visible to customer)' : 'Switch to internal note'}
            >
              <EyeOffIcon className="w-5 h-5" />
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={disabled || sending || (!newMessage.trim() && attachments.length === 0)}
            className="p-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Helper text */}
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {isInternal && (
            <span className="text-yellow-500">⚠️ This message will only be visible to staff</span>
          )}
        </div>
      </div>
    </div>
  )
}

// Missing icon components
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// Export loading skeleton
export function MessageThreadSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            <div className={`max-w-[70%] ${i % 2 === 0 ? '' : 'ml-auto'}`}>
              <div className="h-3 w-24 bg-white/10 rounded animate-pulse mb-1" />
              <div className="p-3 rounded-lg bg-white/5">
                <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
