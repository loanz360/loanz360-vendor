'use client'

import { useState, useRef, useCallback } from 'react'
import {
  X,
  Upload,
  File,
  FileText,
  Image,
  Table,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react'
import { formatFileSize } from '@/lib/workdrive/workdrive-utils'

interface UploadFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (files: File[]) => Promise<void>
  maxFileSizeMB?: number
  allowedTypes?: string[]
}

export default function UploadModal({
  isOpen,
  onClose,
  onUpload,
  maxFileSizeMB = 15,
  allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv'],
}: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedTypes.includes(extension)) {
      return `File type .${extension} is not allowed`
    }
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxFileSizeMB}MB limit`
    }
    return null
  }

  const addFiles = (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'pending',
      error: validateFile(file) || undefined,
    }))

    // Mark files with validation errors as error status
    uploadFiles.forEach((uf) => {
      if (uf.error) {
        uf.status = 'error'
      }
    })

    setFiles((prev) => [...prev, ...uploadFiles])
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
    }
  }

  const handleUpload = async () => {
    const validFiles = files.filter((f) => f.status === 'pending')
    if (validFiles.length === 0) return

    setIsUploading(true)

    // Update all valid files to uploading status
    setFiles((prev) =>
      prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' as const } : f))
    )

    try {
      await onUpload(validFiles.map((f) => f.file))

      // Mark all as success
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'success' as const, progress: 100 } : f
        )
      )

      // Close modal after short delay
      setTimeout(() => {
        onClose()
        setFiles([])
      }, 1500)
    } catch (error) {
      // Mark all uploading files as error
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'error' as const, error: 'Upload failed' }
            : f
        )
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      onClose()
      setFiles([])
    }
  }

  const getFileIcon = (file: File) => {
    const type = file.type
    if (type.startsWith('image/')) return Image
    if (type.includes('spreadsheet') || type.includes('excel') || file.name.endsWith('.csv'))
      return Table
    if (type.includes('pdf') || type.includes('document') || type.includes('text'))
      return FileText
    return File
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const successCount = files.filter((f) => f.status === 'success').length
  const errorCount = files.filter((f) => f.status === 'error').length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/20 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="w-6 h-6 text-orange-500" />
              Upload Files
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Max size: {maxFileSizeMB}MB per file
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/20 hover:border-orange-500/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.map((t) => `.${t}`).join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-white font-medium mb-2">
              Drag and drop files here
            </p>
            <p className="text-gray-400 text-sm mb-4">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Allowed: {allowedTypes.join(', ')}
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">
                  Files ({files.length})
                </h3>
                {pendingCount > 0 && (
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file) => {
                  const FileIcon = getFileIcon(file.file)
                  return (
                    <div
                      key={file.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        file.status === 'error'
                          ? 'bg-red-500/10 border-red-500/30'
                          : file.status === 'success'
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <FileIcon
                        className={`w-8 h-8 ${
                          file.status === 'error'
                            ? 'text-red-400'
                            : file.status === 'success'
                            ? 'text-green-400'
                            : 'text-blue-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{file.file.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatFileSize(file.file.size)}
                          </span>
                          {file.status === 'uploading' && (
                            <span className="text-xs text-orange-400">Uploading...</span>
                          )}
                          {file.error && (
                            <span className="text-xs text-red-400">{file.error}</span>
                          )}
                        </div>
                        {file.status === 'uploading' && (
                          <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 transition-all duration-300"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'pending' && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-1 text-gray-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {file.status === 'uploading' && (
                          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                        )}
                        {file.status === 'success' && (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <div className="text-sm text-gray-400">
            {successCount > 0 && (
              <span className="text-green-400">{successCount} uploaded</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-400 ml-2">{errorCount} failed</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={pendingCount === 0 || isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {pendingCount} {pendingCount === 1 ? 'File' : 'Files'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
