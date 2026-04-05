'use client'

import { useState, useEffect, useRef } from 'react'
import { Edit3, X, Loader2 } from 'lucide-react'

interface FileRenameModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    id: string
    name: string
    type: 'file' | 'folder'
  } | null
  onRename: (id: string, newName: string, type: 'file' | 'folder') => Promise<void>
}

export function FileRenameModal({
  isOpen,
  onClose,
  item,
  onRename,
}: FileRenameModalProps) {
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && item) {
      // For files, set name without extension for editing
      if (item.type === 'file') {
        const lastDotIndex = item.name.lastIndexOf('.')
        if (lastDotIndex > 0) {
          setNewName(item.name.substring(0, lastDotIndex))
        } else {
          setNewName(item.name)
        }
      } else {
        setNewName(item.name)
      }
      setError(null)
      // Focus input after a short delay to allow modal to render
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [isOpen, item])

  const getExtension = (): string => {
    if (!item || item.type !== 'file') return ''
    const lastDotIndex = item.name.lastIndexOf('.')
    return lastDotIndex > 0 ? item.name.substring(lastDotIndex) : ''
  }

  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Name cannot be empty'
    }
    if (name.length > 255) {
      return 'Name is too long (max 255 characters)'
    }
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(name)) {
      return 'Name contains invalid characters'
    }
    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
                          'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3',
                          'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
    if (reservedNames.includes(name.toUpperCase())) {
      return 'This name is reserved and cannot be used'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!item) return

    const finalName = item.type === 'file' ? newName + getExtension() : newName
    const validationError = validateName(newName.trim())

    if (validationError) {
      setError(validationError)
      return
    }

    // Check if name actually changed
    if (finalName === item.name) {
      onClose()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await onRename(item.id, finalName, item.type)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen || !item) return null

  const extension = getExtension()

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Rename {item.type === 'folder' ? 'Folder' : 'File'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              New name
            </label>
            <div className="flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setError(null)
                }}
                className={`flex-1 px-4 py-2 bg-white/5 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                  error ? 'border-red-500' : 'border-white/20'
                } ${extension ? 'rounded-r-none' : ''}`}
                placeholder="Enter new name"
                disabled={isLoading}
                autoComplete="off"
                spellCheck={false}
              />
              {extension && (
                <span className="px-3 py-2 bg-white/10 border border-l-0 border-white/20 rounded-r-lg text-gray-400">
                  {extension}
                </span>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-400 mt-2">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FileRenameModal
