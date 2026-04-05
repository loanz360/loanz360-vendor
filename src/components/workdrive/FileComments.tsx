'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  MessageSquare,
  Send,
  Reply,
  MoreHorizontal,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  AtSign,
  X,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

interface Comment {
  id: string
  file_id: string
  user_id: string
  user_name?: string
  user_avatar?: string
  content: string
  mentions: string[]
  parent_comment_id?: string
  is_resolved?: boolean
  resolved_by?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  replies?: Comment[]
}

interface UserSuggestion {
  id: string
  full_name: string
  email: string
  avatar_url?: string
}

interface FileCommentsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileId: string
  fileName: string
}

export function FileComments({
  open,
  onOpenChange,
  fileId,
  fileName,
}: FileCommentsProps) {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [totalComments, setTotalComments] = useState(0)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)
  const [editingComment, setEditingComment] = useState<Comment | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const fetchComments = useCallback(async () => {
    if (!fileId) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      setCurrentUser(session.user)

      const response = await fetch(`/api/workdrive/comments?fileId=${fileId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch comments')
      }

      const data = await response.json()
      setComments(data.comments || [])
      setTotalComments(data.totalComments || 0)
    } catch (err) {
      console.error('Error fetching comments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }, [fileId, supabase])

  useEffect(() => {
    if (open && fileId) {
      fetchComments()
    }
  }, [open, fileId, fetchComments])

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUserSuggestions([])
      return
    }

    try {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5)

      setUserSuggestions(users || [])
    } catch (err) {
      console.error('Error searching users:', err)
    }
  }, [supabase])

  useEffect(() => {
    if (showMentions && mentionSearch) {
      searchUsers(mentionSearch)
    }
  }, [showMentions, mentionSearch, searchUsers])

  const insertMention = (user: UserSuggestion) => {
    const mention = `@[${user.full_name || user.email}](${user.id})`
    const textarea = textareaRef.current

    if (textarea) {
      const cursorPos = textarea.selectionStart
      const textBefore = newComment.slice(0, cursorPos).replace(/@\w*$/, '')
      const textAfter = newComment.slice(cursorPos)
      setNewComment(textBefore + mention + ' ' + textAfter)
    } else {
      setNewComment((prev) => prev.replace(/@\w*$/, '') + mention + ' ')
    }

    setShowMentions(false)
    setMentionSearch('')
    setUserSuggestions([])
  }

  const handleCommentChange = (value: string) => {
    setNewComment(value)

    // Check for @ mentions
    const match = value.match(/@(\w*)$/)
    if (match) {
      setShowMentions(true)
      setMentionSearch(match[1])
    } else {
      setShowMentions(false)
    }
  }

  const handleSubmit = async () => {
    if (!newComment.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/workdrive/comments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          content: newComment,
          parentCommentId: replyingTo?.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to post comment')
      }

      setNewComment('')
      setReplyingTo(null)
      await fetchComments()
    } catch (err) {
      console.error('Error posting comment:', err)
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editingComment || !editContent.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/workdrive/comments', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId: editingComment.id,
          content: editContent,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update comment')
      }

      setEditingComment(null)
      setEditContent('')
      await fetchComments()
    } catch (err) {
      console.error('Error updating comment:', err)
      setError(err instanceof Error ? err.message : 'Failed to update comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/workdrive/comments?commentId=${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete comment')
      }

      await fetchComments()
    } catch (err) {
      console.error('Error deleting comment:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  const handleResolve = async (comment: Comment) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/workdrive/comments', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId: comment.id,
          resolve: !comment.is_resolved,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update comment')
      }

      await fetchComments()
    } catch (err) {
      console.error('Error resolving comment:', err)
    }
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const isEditing = editingComment?.id === comment.id
    const isOwner = currentUser?.id === comment.user_id

    return (
      <div
        key={comment.id}
        className={`${isReply ? 'ml-10 mt-3' : 'mb-4'} ${
          comment.is_resolved ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.user_avatar} />
            <AvatarFallback className="text-xs">
              {getInitials(comment.user_name || 'U')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{comment.user_name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(comment.created_at)}
                </span>
                {comment.is_resolved && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isReply && (
                    <>
                      <DropdownMenuItem onClick={() => handleResolve(comment)}>
                        {comment.is_resolved ? (
                          <>
                            <Circle className="h-4 w-4 mr-2" />
                            Unresolve
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Resolve
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => setReplyingTo(comment)}
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingComment(comment)
                          setEditContent(comment.content)
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(comment.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleEdit}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingComment(null)
                      setEditContent('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                {renderContentWithMentions(comment.content)}
              </p>
            )}
          </div>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 border-l-2 border-muted pl-3">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    )
  }

  const renderContentWithMentions = (content: string) => {
    // Parse mentions in format @[username](user_id)
    const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g)

    return parts.map((part, i) => {
      const mentionMatch = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
      if (mentionMatch) {
        return (
          <span
            key={i}
            className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded"
          >
            @{mentionMatch[1]}
          </span>
        )
      }
      return part
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Comments
            {totalComments > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalComments}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="truncate">{fileName}</SheetDescription>
        </SheetHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm mt-4">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Comments List */}
        <ScrollArea className="flex-1 mt-4 pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
              <p>No comments yet</p>
              <p className="text-sm">Be the first to comment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => renderComment(comment))}
            </div>
          )}
        </ScrollArea>

        <Separator className="my-4" />

        {/* Reply indicator */}
        {replyingTo && (
          <div className="flex items-center justify-between p-2 bg-muted rounded-lg mb-2">
            <span className="text-sm text-muted-foreground">
              Replying to <span className="font-medium">{replyingTo.user_name}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Comment Input */}
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={replyingTo ? 'Write a reply...' : 'Write a comment... Use @ to mention'}
              value={newComment}
              onChange={(e) => handleCommentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit()
                }
              }}
              className="min-h-[80px] pr-12"
            />

            {/* Mention suggestions */}
            {showMentions && userSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {userSuggestions.map((user) => (
                  <button
                    key={user.id}
                    className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left"
                    onClick={() => insertMention(user)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.full_name || user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name || user.email}
                      </p>
                      {user.full_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AtSign className="h-3 w-3" />
              <span>@ to mention</span>
              <span className="mx-1">|</span>
              <span>Ctrl+Enter to send</span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default FileComments
