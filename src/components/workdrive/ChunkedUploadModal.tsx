'use client'

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, File, FileText, Image, Table, CheckCircle,
  AlertCircle, Loader2, Trash2, HardDrive, Zap, Pause, Play
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UploadFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'preparing' | 'uploading' | 'paused' | 'success' | 'error'
  error?: string
  sessionId?: string
  uploadedChunks?: number
  totalChunks?: number
  uploadSpeed?: number // bytes per second
  remainingTime?: number // seconds
}

interface StorageQuota {
  used: number
  limit: number
  available: number
  usagePercent: number
  isUnlimited: boolean
}

interface ChunkedUploadModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId?: string
  folderId?: string
  quota?: StorageQuota
  maxFileSizeMB?: number
  chunkSizeMB?: number
  allowedTypes?: string[]
  onUploadComplete?: () => void
}

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks for S3 multipart

export default function ChunkedUploadModal({
  isOpen,
  onClose,
  workspaceId,
  folderId,
  quota,
  maxFileSizeMB = 5120, // 5GB for chunked uploads
  chunkSizeMB = 5,
  allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'csv', 'zip', 'rar', 'mp4', 'mov', 'avi'],
  onUploadComplete,
}: ChunkedUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const getAuthToken = async (): Promise<string> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const validateFile = (file: File): string | null => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedTypes.includes(extension)) {
      return `File type .${extension} is not allowed`
    }
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return `File size exceeds ${formatBytes(maxFileSizeMB * 1024 * 1024)} limit`
    }
    if (quota && !quota.isUnlimited && file.size > quota.available) {
      return `Insufficient storage space. Need ${formatBytes(file.size)}, available ${formatBytes(quota.available)}`
    }
    return null
  }

  const addFiles = (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const uploadFiles: UploadFile[] = fileArray.map((file) => {
      const error = validateFile(file)
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error,
        totalChunks: Math.ceil(file.size / CHUNK_SIZE),
        uploadedChunks: 0,
      }
    })
    setFiles((prev) => [...prev, ...uploadFiles])
  }

  const removeFile = (id: string) => {
    // Abort if uploading
    const controller = abortControllers.current.get(id)
    if (controller) {
      controller.abort()
      abortControllers.current.delete(id)
    }
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFileChunked = async (uploadFile: UploadFile): Promise<void> => {
    const token = await getAuthToken()
    const { file, id } = uploadFile

    try {
      // Initialize upload
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'preparing' } : f))

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

      const initResponse = await fetch('/api/workdrive/upload/chunked', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'init',
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks,
          workspaceId,
          folderId,
        }),
      })

      if (!initResponse.ok) {
        const error = await initResponse.json()
        throw new Error(error.error || 'Failed to initialize upload')
      }

      const { sessionId } = await initResponse.json()

      setFiles(prev => prev.map(f => f.id === id ? {
        ...f,
        status: 'uploading',
        sessionId,
        totalChunks,
      } : f))

      // Upload chunks
      const controller = new AbortController()
      abortControllers.current.set(id, controller)

      let uploadedBytes = 0
      const startTime = Date.now()

      for (let i = 0; i < totalChunks; i++) {
        // Check if aborted
        if (controller.signal.aborted) {
          throw new Error('Upload cancelled')
        }

        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)

        const formData = new FormData()
        formData.append('action', 'uploadChunk')
        formData.append('sessionId', sessionId)
        formData.append('chunk', chunk)
        formData.append('chunkIndex', i.toString())

        const chunkResponse = await fetch('/api/workdrive/upload/chunked', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
          signal: controller.signal,
        })

        if (!chunkResponse.ok) {
          throw new Error('Failed to upload chunk')
        }

        uploadedBytes += chunk.size
        const progress = (uploadedBytes / file.size) * 100
        const elapsedSeconds = (Date.now() - startTime) / 1000
        const uploadSpeed = uploadedBytes / elapsedSeconds
        const remainingBytes = file.size - uploadedBytes
        const remainingTime = remainingBytes / uploadSpeed

        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          progress,
          uploadedChunks: i + 1,
          uploadSpeed,
          remainingTime,
        } : f))
      }

      // Complete upload
      const completeResponse = await fetch('/api/workdrive/upload/chunked', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete',
          sessionId,
        }),
      })

      if (!completeResponse.ok) {
        throw new Error('Failed to complete upload')
      }

      setFiles(prev => prev.map(f => f.id === id ? {
        ...f,
        status: 'success',
        progress: 100,
      } : f))

      abortControllers.current.delete(id)
    } catch (error: unknown) {
      if (error.name === 'AbortError' || error.message === 'Upload cancelled') {
        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          status: 'error',
          error: 'Upload cancelled',
        } : f))
      } else {
        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          status: 'error',
          error: (error instanceof Error ? error.message : String(error)) || 'Upload failed',
        } : f))
      }
      abortControllers.current.delete(id)
    }
  }

  const handleUpload = async () => {
    const validFiles = files.filter((f) => f.status === 'pending')
    if (validFiles.length === 0) return

    setIsUploading(true)

    // Upload files sequentially for chunked uploads
    for (const file of validFiles) {
      await uploadFileChunked(file)
    }

    setIsUploading(false)

    // Check if all uploads succeeded
    const allSuccess = files.every(f => f.status === 'success' || f.status === 'error')
    if (allSuccess && onUploadComplete) {
      setTimeout(() => {
        onUploadComplete()
        onClose()
        setFiles([])
      }, 1500)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      // Abort all ongoing uploads
      abortControllers.current.forEach(controller => controller.abort())
      abortControllers.current.clear()
      onClose()
      setFiles([])
    }
  }

  const getFileIcon = (file: File) => {
    const type = file.type
    if (type.startsWith('image/')) return Image
    if (type.includes('spreadsheet') || type.includes('excel') || file.name.endsWith('.csv')) return Table
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText
    return File
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const uploadingCount = files.filter((f) => f.status === 'uploading' || f.status === 'preparing').length
  const successCount = files.filter((f) => f.status === 'success').length
  const errorCount = files.filter((f) => f.status === 'error').length

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/20 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-orange-500" />
              Upload Files
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Supports large files up to {formatBytes(maxFileSizeMB * 1024 * 1024)} with resumable uploads
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

        {/* Storage Quota */}
        {quota && (
          <div className="px-6 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400 flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Storage
              </span>
              <span className="text-white">
                {formatBytes(quota.used)} / {quota.isUnlimited ? 'Unlimited' : formatBytes(quota.limit)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  quota.usagePercent >= 90 ? 'bg-red-500' :
                  quota.usagePercent >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${quota.usagePercent}%` }}
              />
            </div>
            {totalSize > 0 && !quota.isUnlimited && (
              <p className={`text-xs mt-1 ${
                totalSize > quota.available ? 'text-red-400' : 'text-gray-500'
              }`}>
                {totalSize > quota.available
                  ? `Selected files (${formatBytes(totalSize)}) exceed available space`
                  : `After upload: ${formatBytes(quota.used + totalSize)} used`
                }
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-white/20 hover:border-orange-500/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files) }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.map((t) => `.${t}`).join(',')}
              onChange={(e) => { if (e.target.files) addFiles(e.target.files) }}
              className="hidden"
            />
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-white font-medium mb-2">Drag and drop files here</p>
            <p className="text-gray-400 text-sm mb-4">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Allowed: {allowedTypes.slice(0, 8).join(', ')}{allowedTypes.length > 8 ? `, +${allowedTypes.length - 8} more` : ''}
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">
                  Files ({files.length}) - {formatBytes(totalSize)}
                </h3>
                {pendingCount > 0 && !isUploading && (
                  <button onClick={() => setFiles([])} className="text-xs text-gray-400 hover:text-white">
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
                      className={`p-4 rounded-lg border transition-colors ${
                        file.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                        file.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                        file.status === 'uploading' || file.status === 'preparing' ? 'bg-orange-500/10 border-orange-500/30' :
                        'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <FileIcon className={`w-8 h-8 flex-shrink-0 ${
                          file.status === 'error' ? 'text-red-400' :
                          file.status === 'success' ? 'text-green-400' :
                          file.status === 'uploading' ? 'text-orange-400' :
                          'text-blue-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{file.file.name}</p>
                          <div className="flex items-center gap-3 text-xs mt-1">
                            <span className="text-gray-400">{formatBytes(file.file.size)}</span>
                            {file.status === 'preparing' && (
                              <span className="text-orange-400">Preparing...</span>
                            )}
                            {file.status === 'uploading' && file.uploadSpeed && (
                              <>
                                <span className="text-orange-400">
                                  {formatBytes(file.uploadSpeed)}/s
                                </span>
                                {file.remainingTime && (
                                  <span className="text-gray-500">
                                    ~{formatTime(file.remainingTime)} left
                                  </span>
                                )}
                              </>
                            )}
                            {file.error && (
                              <span className="text-red-400">{file.error}</span>
                            )}
                          </div>
                          {(file.status === 'uploading' || file.status === 'preparing') && (
                            <div className="mt-2">
                              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
                                  style={{ width: `${file.progress}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-gray-500">
                                  {file.uploadedChunks || 0}/{file.totalChunks} chunks
                                </span>
                                <span className="text-orange-400">{file.progress.toFixed(1)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {file.status === 'pending' && (
                            <button onClick={() => removeFile(file.id)} className="p-1 text-gray-400 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {(file.status === 'uploading' || file.status === 'preparing') && (
                            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                          )}
                          {file.status === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                          {file.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                        </div>
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
            {uploadingCount > 0 && <span className="text-orange-400">{uploadingCount} uploading</span>}
            {successCount > 0 && <span className="text-green-400 ml-2">{successCount} completed</span>}
            {errorCount > 0 && <span className="text-red-400 ml-2">{errorCount} failed</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Cancel' : 'Close'}
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
