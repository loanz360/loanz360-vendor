'use client'

import { useState } from 'react'
import { X, FileText, Save, Trash2, AlertCircle } from 'lucide-react'

interface Note {
  id: string
  content: string
  created_at: string
  created_by?: string
  is_ai_generated?: boolean
}

interface NotesModalProps {
  isOpen: boolean
  onClose: () => void
  contactId: string
  contactName: string
  existingNotes?: Note[]
  onSaveNote: (note: string) => Promise<void>
  onDeleteNote?: (noteId: string) => Promise<void>
  onEditNote?: (noteId: string, content: string) => Promise<void>
}

export default function NotesModal({
  isOpen,
  onClose,
  contactId,
  contactName,
  existingNotes = [],
  onSaveNote,
  onDeleteNote,
  onEditNote
}: NotesModalProps) {
  const [noteContent, setNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!isOpen) return null

  const showError = (msg: string) => {
    setInlineError(msg)
    setTimeout(() => setInlineError(null), 5000)
  }

  const handleSave = async () => {
    if (!noteContent.trim()) return

    setInlineError(null)
    setIsSaving(true)
    try {
      await onSaveNote(noteContent.trim())
      setNoteContent('')
      // Don't close modal - allow adding multiple notes
    } catch (error) {
      console.error('Failed to save note:', error)
      showError('Failed to save note. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async (noteId: string) => {
    if (!editContent.trim() || !onEditNote) return

    setInlineError(null)
    setIsSaving(true)
    try {
      await onEditNote(noteId, editContent.trim())
      setEditingNoteId(null)
      setEditContent('')
    } catch (error) {
      console.error('Failed to edit note:', error)
      showError('Failed to edit note. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!onDeleteNote) return

    setInlineError(null)
    setIsSaving(true)
    try {
      await onDeleteNote(noteId)
      setConfirmDeleteId(null)
    } catch (error) {
      console.error('Failed to delete note:', error)
      showError('Failed to delete note. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id)
    setEditContent(note.content)
  }

  const cancelEditing = () => {
    setEditingNoteId(null)
    setEditContent('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/20 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold flex items-center font-poppins">
              <FileText className="w-6 h-6 mr-2 text-orange-500" />
              Notes - {contactName}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Add and manage notes for this contact</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {existingNotes.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase font-poppins">Existing Notes</h3>
              {existingNotes.map((note) => (
                <div
                  key={note.id}
                  className={`p-4 rounded-lg border ${
                    note.is_ai_generated
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-black/50 text-white border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                        rows={4}
                        disabled={isSaving}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(note.id)}
                          disabled={isSaving || !editContent.trim()}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isSaving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={isSaving}
                          className="px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {note.is_ai_generated && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs font-medium">
                              AI Generated
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        {!note.is_ai_generated && (
                          <div className="flex space-x-2">
                            {onEditNote && (
                              <button
                                onClick={() => startEditing(note)}
                                className="text-blue-400 hover:text-blue-300 text-xs"
                              >
                                Edit
                              </button>
                            )}
                            {onDeleteNote && (
                              confirmDeleteId === note.id ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-xs text-gray-400">Delete?</span>
                                  <button
                                    onClick={() => handleDelete(note.id)}
                                    disabled={isSaving}
                                    className="text-red-400 hover:text-red-300 text-xs font-medium"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-gray-400 hover:text-gray-300 text-xs"
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(note.id)}
                                  className="text-red-400 hover:text-red-300 text-xs"
                                >
                                  Delete
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-white text-sm whitespace-pre-wrap">{note.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No notes yet. Add your first note below.</p>
            </div>
          )}

          {/* Inline Error */}
          {inlineError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {inlineError}
            </div>
          )}

          {/* Add New Note */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold uppercase mb-3 font-poppins">Add New Note</h3>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note here..."
              className="w-full bg-black/50 text-white border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              rows={4}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !noteContent.trim()}
            className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
