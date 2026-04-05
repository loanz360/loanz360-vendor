'use client'

import { useState, useCallback } from 'react'
import { Upload, X, FileText, Loader, Download } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

interface Attachment {
  name: string
  url: string
  path: string
  size: number
  type: string
  uploaded_at: string
}

interface AttachmentUploaderProps {
  value: Attachment[]
  onChange: (attachments: Attachment[]) => void
  label?: string
  description?: string
  maxFiles?: number
  disabled?: boolean
}

export default function AttachmentUploader({
  value,
  onChange,
  label = 'Attachments',
  description = 'Upload documents (PDF, DOC, XLS, PPT, ZIP, TXT, CSV - Max 10MB each)',
  maxFiles = 5,
  disabled = false
}: AttachmentUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    if (disabled) return

    // Check max files limit
    if (value.length + acceptedFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed. You have ${value.length} file(s) already.`)
      return
    }

    setError(null)
    setUploading(true)

    const uploadedAttachments: Attachment[] = []

    try {
      for (const file of acceptedFiles) {
        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} is too large. Maximum size: 10MB`)
          continue
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/notifications/upload/attachment', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}`)
        }

        uploadedAttachments.push({
          name: data.name,
          url: data.url,
          path: data.path,
          size: data.size,
          type: data.type,
          uploaded_at: data.uploaded_at
        })
      }

      onChange([...value, ...uploadedAttachments])
    } catch (err: unknown) {
      console.error('Error uploading attachments:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }, [disabled, value, onChange, maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/zip': ['.zip'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    maxFiles,
    disabled: disabled || uploading || value.length >= maxFiles
  })

  const handleRemove = (index: number) => {
    if (disabled) return
    const newAttachments = value.filter((_, i) => i !== index)
    onChange(newAttachments)
    setError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄'
    if (type.includes('word') || type.includes('document')) return '📝'
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊'
    if (type.includes('powerpoint') || type.includes('presentation')) return '📊'
    if (type.includes('zip')) return '🗜️'
    if (type.includes('text') || type.includes('csv')) return '📃'
    return '📎'
  }

  return (
    <div className="space-y-3">
      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-white mb-1">
          {label}
        </label>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      {/* Upload Area */}
      {value.length < maxFiles && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
            ${isDragActive
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-white/20 bg-black/30 hover:border-orange-500/50 hover:bg-orange-500/5'
            }
            ${disabled || uploading || value.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-10 h-10 text-orange-400 animate-spin" />
              <p className="text-sm text-gray-400">Uploading attachment(s)...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white/5 rounded-full">
                <Upload className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">
                  {isDragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {value.length}/{maxFiles} files • PDF, DOC, XLS, PPT, ZIP, TXT, CSV (max 10MB each)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uploaded Attachments List */}
      {value.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            {value.length} attachment{value.length !== 1 ? 's' : ''} uploaded
          </p>

          <div className="space-y-2">
            {value.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg group hover:border-orange-500/50 transition-colors"
              >
                {/* File Icon */}
                <div className="text-2xl flex-shrink-0">
                  {getFileIcon(attachment.type)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {attachment.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {formatFileSize(attachment.size)}
                    </span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">
                      {new Date(attachment.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    disabled={disabled}
                    className="p-2 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    <X className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Max files reached */}
      {value.length >= maxFiles && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-sm text-orange-400">
            Maximum {maxFiles} files reached. Remove a file to upload more.
          </p>
        </div>
      )}
    </div>
  )
}
