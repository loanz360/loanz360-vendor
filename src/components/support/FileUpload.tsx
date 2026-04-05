'use client'

import { toast } from 'sonner'

import React, { useState, useRef, useCallback } from 'react'
import {
  Upload,
  X,
  File,
  Image,
  FileText,
  Film,
  Music,
  Archive,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

export interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  url?: string
}

export interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void
  onUpload?: (file: File) => Promise<{ url: string; id: string }>
  maxFiles?: number
  maxFileSize?: number // in bytes
  acceptedTypes?: string[]
  disabled?: boolean
  className?: string
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_MAX_FILES = 5
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-rar-compressed'
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Film
  if (type.startsWith('audio/')) return Music
  if (type.includes('pdf')) return FileText
  if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return Archive
  return File
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// ============================================================
// FILE UPLOAD COMPONENT
// ============================================================

export default function FileUpload({
  onFilesChange,
  onUpload,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  className = ''
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update parent when files change
  const updateFiles = useCallback((newFiles: UploadedFile[]) => {
    setFiles(newFiles)
    onFilesChange(newFiles)
  }, [onFilesChange])

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)}`
    }
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return 'File type not supported'
    }
    return null
  }

  // Add files
  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)

    // Check max files limit
    if (files.length + fileArray.length > maxFiles) {
      toast.info(`Maximum ${maxFiles} files allowed`)
      return
    }

    const uploadedFiles: UploadedFile[] = []

    for (const file of fileArray) {
      const error = validateFile(file)
      const uploadedFile: UploadedFile = {
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined
      }
      uploadedFiles.push(uploadedFile)
    }

    const newFilesList = [...files, ...uploadedFiles]
    updateFiles(newFilesList)

    // Auto-upload if onUpload is provided
    if (onUpload) {
      for (const uploadedFile of uploadedFiles) {
        if (uploadedFile.status === 'pending') {
          await uploadFile(uploadedFile, newFilesList)
        }
      }
    }
  }, [files, maxFiles, onUpload, updateFiles, validateFile])

  // Upload a single file
  const uploadFile = async (uploadedFile: UploadedFile, currentFiles: UploadedFile[]) => {
    if (!onUpload) return

    // Update status to uploading
    const updatedFiles = currentFiles.map(f =>
      f.id === uploadedFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
    )
    updateFiles(updatedFiles)

    try {
      // Simulate progress (real implementation would use XMLHttpRequest or fetch with progress)
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === uploadedFile.id && f.progress < 90) {
            return { ...f, progress: f.progress + 10 }
          }
          return f
        }))
      }, 200)

      const result = await onUpload(uploadedFile.file)

      clearInterval(progressInterval)

      // Update with success
      setFiles(prev => prev.map(f =>
        f.id === uploadedFile.id
          ? { ...f, status: 'success' as const, progress: 100, url: result.url }
          : f
      ))
    } catch (error) {
      // Update with error
      setFiles(prev => prev.map(f =>
        f.id === uploadedFile.id
          ? { ...f, status: 'error' as const, error: (error as Error).message }
          : f
      ))
    }
  }

  // Remove file
  const removeFile = useCallback((id: string) => {
    const newFiles = files.filter(f => f.id !== id)
    updateFiles(newFiles)
  }, [files, updateFiles])

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }

  // Handle click to select
  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-white/20 hover:border-orange-500/50 hover:bg-white/5'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-orange-500' : 'text-gray-400'}`} />

        <p className="text-white font-medium mb-1">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-gray-400 text-sm mb-2">
          or click to browse
        </p>
        <p className="text-gray-500 text-xs">
          Max {maxFiles} files, up to {formatFileSize(maxFileSize)} each
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => {
            const FileIcon = getFileIcon(file.type)

            return (
              <div
                key={file.id}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border
                  ${file.status === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : file.status === 'success'
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-white/5 border-white/10'
                  }
                `}
              >
                {/* File Icon */}
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${file.status === 'error'
                    ? 'bg-red-500/20'
                    : file.status === 'success'
                      ? 'bg-green-500/20'
                      : 'bg-white/10'
                  }
                `}>
                  <FileIcon className={`w-5 h-5 ${
                    file.status === 'error'
                      ? 'text-red-400'
                      : file.status === 'success'
                        ? 'text-green-400'
                        : 'text-gray-400'
                  }`} />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                  <p className="text-gray-400 text-xs">
                    {formatFileSize(file.size)}
                    {file.error && (
                      <span className="text-red-400 ml-2">{file.error}</span>
                    )}
                  </p>

                  {/* Progress Bar */}
                  {file.status === 'uploading' && (
                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-200"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {file.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(file.id)
                  }}
                  className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Accepted Types Info */}
      <p className="text-gray-500 text-xs">
        Supported: Images (JPG, PNG, GIF), Documents (PDF, DOC, DOCX, XLS, XLSX), Text (TXT, CSV), Archives (ZIP, RAR)
      </p>
    </div>
  )
}

// ============================================================
// COMPACT FILE UPLOAD (for inline use in forms)
// ============================================================

export function CompactFileUpload({
  onFilesChange,
  maxFiles = 3,
  disabled = false
}: {
  onFilesChange: (files: File[]) => void
  maxFiles?: number
  disabled?: boolean
}) {
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).slice(0, maxFiles - files.length)
      const updatedFiles = [...files, ...newFiles].slice(0, maxFiles)
      setFiles(updatedFiles)
      onFilesChange(updatedFiles)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index)
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm"
          >
            <File className="w-4 h-4 text-orange-400" />
            <span className="text-white max-w-32 truncate">{file.name}</span>
            <button
              onClick={() => removeFile(index)}
              className="text-gray-400 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {files.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-white/20 rounded-lg text-sm text-gray-400 hover:border-orange-500 hover:text-orange-400 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Attach file
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
    </div>
  )
}
