'use client'

import React, { useState, useEffect } from 'react'
import {
  MessageSquare, Plus, X, Loader2, AlertCircle, Pin, Star, Send,
  Edit2, Trash2, Calendar, User, Clock, ChevronDown, ChevronUp,
  Check, AlertTriangle, Tag as TagIcon
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface CustomerNotesProps {
  customerId: string
}

interface CustomerNote {
  id: string
  note_title: string | null
  note_content: string
  note_type: string
  category: string | null
  is_important: boolean
  is_pinned: boolean
  visibility: string
  tags: string[] | null
  reminder_at: string | null
  assigned_to: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  users?: {
    id: string
    full_name: string
    email: string
  }
  assigned_user?: {
    id: string
    full_name: string
  }
  comment_count: number
  comments?: NoteComment[]
}

interface NoteComment {
  id: string
  comment_content: string
  created_at: string
  users: {
    id: string
    full_name: string
    email: string
  }
}

const NOTE_TYPES = [
  { value: 'GENERAL', label: 'General', icon: MessageSquare },
  { value: 'FOLLOW_UP', label: 'Follow Up', icon: Calendar },
  { value: 'COMPLAINT', label: 'Complaint', icon: AlertTriangle },
  { value: 'FEEDBACK', label: 'Feedback', icon: Star },
  { value: 'INTERNAL', label: 'Internal', icon: User },
  { value: 'MEETING', label: 'Meeting', icon: Calendar },
  { value: 'CALL_LOG', label: 'Call Log', icon: MessageSquare }
]

const CATEGORIES = [
  { value: 'SALES', label: 'Sales' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'COLLECTIONS', label: 'Collections' },
  { value: 'RISK', label: 'Risk' },
  { value: 'GENERAL', label: 'General' }
]

export function CustomerNotes({ customerId }: CustomerNotesProps) {
  const [notes, setNotes] = useState<CustomerNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [filter, setFilter] = useState<{
    noteType: string | null
    category: string | null
    isImportant: boolean
  }>({
    noteType: null,
    category: null,
    isImportant: false
  })

  // New note form state
  const [newNote, setNewNote] = useState({
    note_title: '',
    note_content: '',
    note_type: 'GENERAL',
    category: 'GENERAL',
    is_important: false,
    is_pinned: false
  })

  // Comment state
  const [commentContent, setCommentContent] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchNotes()
  }, [customerId, filter])

  const fetchNotes = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filter.noteType) params.append('note_type', filter.noteType)
      if (filter.category) params.append('category', filter.category)
      if (filter.isImportant) params.append('is_important', 'true')

      const response = await fetch(
        `/api/superadmin/customer-management/customers/${customerId}/notes?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch notes')
      }

      const data = await response.json()

      if (data.success) {
        setNotes(data.notes || [])
        setError(null)
      } else {
        throw new Error(data.error || 'Failed to fetch notes')
      }
    } catch (err) {
      console.error('Error fetching notes:', err)
      setError('Failed to load notes')
      clientLogger.error('Failed to fetch customer notes', { customerId, error: err })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNoteWithComments = async (noteId: string) => {
    try {
      const response = await fetch(
        `/api/superadmin/customer-management/customers/${customerId}/notes/${noteId}`
      )

      if (!response.ok) throw new Error('Failed to fetch note details')

      const data = await response.json()

      if (data.success) {
        // Update the note in the list with comments
        setNotes(notes.map(n => n.id === noteId ? { ...n, comments: data.note.comments } : n))
      }
    } catch (err) {
      console.error('Error fetching note details:', err)
    }
  }

  const createNote = async () => {
    if (!newNote.note_content.trim()) {
      setError('Note content is required')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch(
        `/api/superadmin/customer-management/customers/${customerId}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newNote,
            note_title: newNote.note_title.trim() || null,
            note_content: newNote.note_content.trim()
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        setNotes([data.note, ...notes])
        setNewNote({
          note_title: '',
          note_content: '',
          note_type: 'GENERAL',
          category: 'GENERAL',
          is_important: false,
          is_pinned: false
        })
        setIsCreatingNote(false)
        setError(null)
      } else {
        setError(data.error || 'Failed to create note')
      }
    } catch (err) {
      console.error('Error creating note:', err)
      setError('Failed to create note')
      clientLogger.error('Failed to create customer note', { customerId, error: err })
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      const response = await fetch(
        `/api/superadmin/customer-management/customers/${customerId}/notes/${noteId}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (data.success) {
        setNotes(notes.filter(n => n.id !== noteId))
        setError(null)
      } else {
        setError(data.error || 'Failed to delete note')
      }
    } catch (err) {
      console.error('Error deleting note:', err)
      setError('Failed to delete note')
    }
  }

  const addComment = async (noteId: string) => {
    const content = commentContent[noteId]?.trim()
    if (!content) return

    try {
      const response = await fetch(
        `/api/superadmin/customer-management/customers/${customerId}/notes/${noteId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_content: content })
        }
      )

      const data = await response.json()

      if (data.success) {
        // Refresh note with comments
        await fetchNoteWithComments(noteId)
        setCommentContent({ ...commentContent, [noteId]: '' })
        setError(null)
      } else {
        setError(data.error || 'Failed to add comment')
      }
    } catch (err) {
      console.error('Error adding comment:', err)
      setError('Failed to add comment')
    }
  }

  const toggleNoteExpansion = async (noteId: string) => {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null)
    } else {
      setExpandedNoteId(noteId)
      // Fetch comments if not already loaded
      const note = notes.find(n => n.id === noteId)
      if (note && !note.comments) {
        await fetchNoteWithComments(noteId)
      }
    }
  }

  const getNoteTypeColor = (type: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      GENERAL: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
      FOLLOW_UP: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
      COMPLAINT: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
      FEEDBACK: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
      INTERNAL: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
      MEETING: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      CALL_LOG: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' }
    }
    return colors[type] || colors.GENERAL
  }

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Filters */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-orange-400" />
            <span>Customer Notes</span>
            <span className="text-sm text-gray-400 font-normal">({notes.length})</span>
          </h3>

          <button
            onClick={() => setIsCreatingNote(!isCreatingNote)}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            {isCreatingNote ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isCreatingNote ? 'Cancel' : 'New Note'}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 mb-4">
          <select
            value={filter.noteType || ''}
            onChange={(e) => setFilter({ ...filter, noteType: e.target.value || null })}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Types</option>
            {NOTE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <select
            value={filter.category || ''}
            onChange={(e) => setFilter({ ...filter, category: e.target.value || null })}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          <button
            onClick={() => setFilter({ ...filter, isImportant: !filter.isImportant })}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              filter.isImportant
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
            }`}
          >
            <Star className={`w-4 h-4 inline mr-1 ${filter.isImportant ? 'fill-current' : ''}`} />
            Important
          </button>
        </div>

        {/* Create Note Form */}
        {isCreatingNote && (
          <div className="bg-white/10 rounded-lg p-4 border border-white/20 mb-4">
            <input
              type="text"
              value={newNote.note_title}
              onChange={(e) => setNewNote({ ...newNote, note_title: e.target.value })}
              placeholder="Note title (optional)"
              className="w-full px-4 py-2 mb-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <textarea
              value={newNote.note_content}
              onChange={(e) => setNewNote({ ...newNote, note_content: e.target.value })}
              placeholder="Write your note here..."
              rows={5}
              className="w-full px-4 py-3 mb-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <select
                value={newNote.note_type}
                onChange={(e) => setNewNote({ ...newNote, note_type: e.target.value })}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {NOTE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>

              <select
                value={newNote.category}
                onChange={(e) => setNewNote({ ...newNote, category: e.target.value })}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNote.is_important}
                    onChange={(e) => setNewNote({ ...newNote, is_important: e.target.checked })}
                    className="rounded border-white/20 bg-white/5 text-orange-600 focus:ring-orange-500"
                  />
                  <Star className="w-4 h-4" />
                  <span>Important</span>
                </label>

                <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNote.is_pinned}
                    onChange={(e) => setNewNote({ ...newNote, is_pinned: e.target.checked })}
                    className="rounded border-white/20 bg-white/5 text-orange-600 focus:ring-orange-500"
                  />
                  <Pin className="w-4 h-4" />
                  <span>Pin</span>
                </label>
              </div>

              <button
                onClick={createNote}
                disabled={isSubmitting || !newNote.note_content.trim()}
                className="flex items-center space-x-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Create Note</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes List */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => {
            const typeColors = getNoteTypeColor(note.note_type)
            const isExpanded = expandedNoteId === note.id

            return (
              <div
                key={note.id}
                className={`bg-white/5 rounded-xl border transition-all ${
                  note.is_pinned
                    ? 'border-orange-500/30 shadow-lg shadow-orange-500/10'
                    : 'border-white/10'
                }`}
              >
                <div className="p-4">
                  {/* Note Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {note.is_pinned && <Pin className="w-4 h-4 text-orange-400 fill-current" />}
                        {note.is_important && <Star className="w-4 h-4 text-yellow-400 fill-current" />}
                        {note.note_title && (
                          <h4 className="text-white font-semibold">{note.note_title}</h4>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeColors.bg} ${typeColors.text} ${typeColors.border}`}>
                          {note.note_type.replace(/_/g, ' ')}
                        </span>
                        {note.category && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            {note.category}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {note.note_content}
                      </p>

                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{note.users?.full_name}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </span>
                        {note.comment_count > 0 && (
                          <span className="flex items-center space-x-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{note.comment_count} {note.comment_count === 1 ? 'comment' : 'comments'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => toggleNoteExpansion(note.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Section - Comments */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      {/* Comments List */}
                      {note.comments && note.comments.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {note.comments.map((comment) => (
                            <div key={comment.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                              <div className="flex items-start space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {comment.users.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-white">{comment.users.full_name}</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-gray-300 text-sm">{comment.comment_content}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment Form */}
                      <div className="flex items-start space-x-2">
                        <textarea
                          value={commentContent[note.id] || ''}
                          onChange={(e) => setCommentContent({ ...commentContent, [note.id]: e.target.value })}
                          placeholder="Add a comment..."
                          rows={2}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                        <button
                          onClick={() => addComment(note.id)}
                          disabled={!commentContent[note.id]?.trim()}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center">
          <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No notes yet</h3>
          <p className="text-gray-400 mb-4">
            Start adding notes to track interactions and important information about this customer.
          </p>
          <button
            onClick={() => setIsCreatingNote(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create First Note</span>
          </button>
        </div>
      )}
    </div>
  )
}
