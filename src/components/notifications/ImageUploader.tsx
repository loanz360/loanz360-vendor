'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Loader } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'

interface ImageUploaderProps {
  value?: string // URL of uploaded image
  onChange: (url: string | null) => void
  label?: string
  description?: string
  disabled?: boolean
}

export default function ImageUploader({
  value,
  onChange,
  label = 'Notification Image',
  description = 'Upload a banner image for your notification (JPEG, PNG, WebP, GIF - Max 5MB)',
  disabled = false
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    if (disabled) return

    const file = acceptedFiles[0]
    setError(null)

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError(`File too large. Maximum size: 5MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/notifications/upload/image', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image')
      }

      onChange(data.url)
    } catch (err: unknown) {
      console.error('Error uploading image:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }, [disabled, onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif']
    },
    maxFiles: 1,
    disabled: disabled || uploading
  })

  const handleRemove = async () => {
    if (disabled) return
    onChange(null)
    setError(null)
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

      {/* Upload Area or Preview */}
      {!value ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragActive
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-white/20 bg-black/30 hover:border-orange-500/50 hover:bg-orange-500/5'
            }
            ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-12 h-12 text-orange-400 animate-spin" />
              <p className="text-sm text-gray-400">Uploading image...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white/5 rounded-full">
                <Upload className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">
                  {isDragActive ? 'Drop image here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPEG, PNG, WebP, GIF (max 5MB)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative group">
          {/* Image Preview */}
          <div className="relative w-full h-64 bg-black/50 rounded-lg overflow-hidden border border-white/10">
            <Image
              src={value}
              alt="Notification preview"
              fill
              className="object-cover"
            />

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="p-3 bg-red-500 hover:bg-red-600 rounded-full transition-colors disabled:opacity-50"
                title="Remove image"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Image info */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              <span>Image uploaded</span>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
