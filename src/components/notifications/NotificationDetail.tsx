'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Star,
  Archive,
  Calendar,
  User,
  MessageSquare,
  Send,
  Download,
  ExternalLink,
  Clock
} from 'lucide-react'
import Image from 'next/image'
import { formatDistanceToNow, format } from 'date-fns'
import RichTextEditor from './RichTextEditor'
import { toast } from 'sonner'
import { sanitizeHtml } from '@/lib/utils/sanitize-html'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
}

interface Reply {
  id: string
  reply_text: string
  reply_html?: string
  user_name: string
  user_avatar?: string
  created_at: string
  attachments?: Attachment[]
}

interface NotificationDetailProps {
  notificationId: string
  onClose: () => void
  onUpdate?: () => void
}

export default function NotificationDetail({
  notificationId,
  onClose,
  onUpdate
}: NotificationDetailProps) {
  const [notification, setNotification] = useState<any>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reply form
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyHtml, setReplyHtml] = useState('')
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  useEffect(() => {
    fetchNotificationDetails()
    if (notification?.allow_replies) {
      fetchReplies()
    }
  }, [notificationId])

  const fetchNotificationDetails = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/notifications/${notificationId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch notification')
      }

      setNotification(data.notification)

      // Mark as read and clicked
      if (!data.notification.is_read || !data.notification.clicked_at) {
        await fetch(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true, clicked: true })
        })
      }
    } catch (err: unknown) {
      console.error('Error fetching notification:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const fetchReplies = async () => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/replies`)
      const data = await response.json()

      if (response.ok) {
        setReplies(data.replies || [])
      }
    } catch (err) {
      console.error('Error fetching replies:', err)
    }
  }

  const handleToggleStar = async () => {
    if (!notification) return

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !notification.starred })
      })

      setNotification({ ...notification, starred: !notification.starred })
      if (onUpdate) onUpdate()
      toast.success(notification.starred ? 'Removed from starred' : 'Added to starred')
    } catch (error) {
      toast.error('Failed to update notification')
    }
  }

  const handleArchive = async () => {
    if (!notification) return

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true })
      })

      if (onUpdate) onUpdate()
      toast.success('Notification archived')
      onClose()
    } catch (error) {
      toast.error('Failed to archive notification')
    }
  }

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      toast.error('Reply cannot be empty')
      return
    }

    setSubmittingReply(true)

    try {
      const response = await fetch(`/api/notifications/${notificationId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply_text: replyText.trim(),
          reply_html: replyHtml
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit reply')
      }

      toast.success('Reply submitted successfully')
      setReplyHtml('')
      setReplyText('')
      setShowReplyForm(false)

      // Refresh replies
      fetchReplies()

      // Update notification reply count
      setNotification({
        ...notification,
        reply_count: (notification.reply_count || 0) + 1
      })

      if (onUpdate) onUpdate()
    } catch (error: unknown) {
      console.error('Error submitting reply:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to submit reply')
    } finally {
      setSubmittingReply(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-white mt-4">Loading notification...</p>
        </div>
      </div>
    )
  }

  if (error || !notification) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 max-w-md">
          <p className="text-red-400 mb-4">{error || 'Notification not found'}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'normal':
        return 'bg-blue-500'
      case 'low':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto bg-black/95 backdrop-blur-lg border border-white/10 rounded-lg">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-white/10">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-1 h-8 rounded ${getPriorityColor(notification.priority)}`} />
                <h2 className="text-2xl font-bold font-poppins">{notification.title}</h2>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-400">
                {notification.sent_by_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>From: {notification.sent_by_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(notification.created_at), 'PPp')}</span>
                </div>
                <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
                  {notification.priority}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleStar}
                className="p-2 hover:bg-white/10 rounded transition-colors"
                title={notification.starred ? 'Unstar' : 'Star'}
              >
                <Star className={`w-5 h-5 ${notification.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
              </button>

              <button
                onClick={handleArchive}
                className="p-2 hover:bg-white/10 rounded transition-colors"
                title="Archive"
              >
                <Archive className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Banner Image */}
          {notification.image_url && (
            <div className="relative w-full h-64">
              <Image
                src={notification.image_url}
                alt={notification.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Message */}
            <div>
              {notification.message_html ? (
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(notification.message_html) }}
                />
              ) : (
                <p className="text-gray-300 whitespace-pre-wrap">{notification.message}</p>
              )}
            </div>

            {/* Attachments */}
            {notification.attachments && notification.attachments.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2 font-poppins">
                  <Download className="w-5 h-5 text-orange-400" />
                  Attachments ({notification.attachments.length})
                </h3>
                <div className="space-y-2">
                  {notification.attachments.map((attachment: Attachment, index: number) => (
                    <a
                      key={index}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Download className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-white font-medium">{attachment.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            {notification.action_url && notification.action_label && (
              <div>
                <a
                  href={notification.action_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  {notification.action_label}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Validity Period */}
            {notification.valid_until && (
              <div className="flex items-center gap-2 text-sm text-gray-400 p-3 bg-white/5 rounded-lg">
                <Clock className="w-4 h-4" />
                <span>
                  Valid until: {format(new Date(notification.valid_until), 'PPp')}
                </span>
              </div>
            )}
          </div>

          {/* Replies Section */}
          {notification.allow_replies && (
            <div className="border-t border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 font-poppins">
                  <MessageSquare className="w-5 h-5 text-orange-400" />
                  Replies ({replies.length})
                </h3>
                {!showReplyForm && (
                  <button
                    onClick={() => setShowReplyForm(true)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Reply
                  </button>
                )}
              </div>

              {/* Reply Form */}
              {showReplyForm && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                  <RichTextEditor
                    content={replyHtml}
                    onChange={(html, text) => {
                      setReplyHtml(html)
                      setReplyText(text)
                    }}
                    placeholder="Write your reply..."
                    disabled={submittingReply}
                  />

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowReplyForm(false)
                        setReplyHtml('')
                        setReplyText('')
                      }}
                      disabled={submittingReply}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReply}
                      disabled={submittingReply || !replyText.trim()}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingReply ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Replies List */}
              {replies.length > 0 && (
                <div className="space-y-3">
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        {reply.user_avatar ? (
                          <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            <Image
                              src={reply.user_avatar}
                              alt={reply.user_name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-orange-400" />
                          </div>
                        )}

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-white font-medium">{reply.user_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            </p>
                          </div>

                          {reply.reply_html ? (
                            <div
                              className="prose prose-sm prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.reply_html) }}
                            />
                          ) : (
                            <p className="text-gray-300 text-sm whitespace-pre-wrap">
                              {reply.reply_text}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {replies.length === 0 && !showReplyForm && (
                <p className="text-gray-400 text-center py-4">No replies yet. Be the first to reply!</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
