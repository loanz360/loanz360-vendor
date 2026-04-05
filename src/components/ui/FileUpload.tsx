'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Upload, X, AlertCircle, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface FileUploadProps {
  onUploadSuccess: (url: string, metadata?: any) => void
  onUploadError?: (error: string) => void
  currentImageUrl?: string | null
  maxSizeMB?: number
  acceptedFormats?: string[]
  className?: string
}

export default function FileUpload({
  onUploadSuccess,
  onUploadError,
  currentImageUrl,
  maxSizeMB = 10,
  acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  className = ''
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedMetadata, setUploadedMetadata] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Accepted formats: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File size too large. Maximum size is ${maxSizeMB}MB.`
    }

    return null
  }, [acceptedFormats, maxSizeMB])

  const uploadFile = async (file: File) => {
    setError(null)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 100)

      // Upload to API
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/offers/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadProgress(100)
      setUploadedMetadata(data)

      // Call success callback
      onUploadSuccess(data.url, data)

      // Show success for 1 second
      setTimeout(() => {
        setUploadProgress(0)
      }, 1000)

    } catch (err: unknown) {
      console.error('Upload error:', err)
      const errorMessage = (err instanceof Error ? err.message : String(err)) || 'Failed to upload file'
      setError(errorMessage)
      setPreviewUrl(null)

      if (onUploadError) {
        onUploadError(errorMessage)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      if (onUploadError) {
        onUploadError(validationError)
      }
      return
    }

    uploadFile(file)
  }, [validateFile, uploadFile, onUploadError])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      if (onUploadError) {
        onUploadError(validationError)
      }
      return
    }

    uploadFile(file)
  }, [validateFile, uploadFile, onUploadError])

  const handleRemoveImage = useCallback(() => {
    setPreviewUrl(null)
    setUploadedMetadata(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg transition-all duration-300
          ${isDragging
            ? 'border-orange-500 bg-orange-500/10'
            : previewUrl
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-gray-700 bg-gray-900/50 hover:border-orange-500/50'
          }
          ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={previewUrl ? undefined : handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        <AnimatePresence mode="wait">
          {previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative"
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg"
              />

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Upload success badge */}
              {uploadProgress === 100 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute bottom-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Uploaded
                </motion.div>
              )}

              {/* Metadata */}
              {uploadedMetadata && (
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded text-xs">
                  {uploadedMetadata.dimensions.width}x{uploadedMetadata.dimensions.height} • {uploadedMetadata.savings}% saved
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                  <div className="w-full max-w-xs">
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-sm text-gray-400 mt-2">Uploading... {uploadProgress}%</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mx-auto w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-orange-500" />
                  </div>
                  <p className="text-gray-300 mb-2 font-medium">
                    Drag and drop your image here
                  </p>
                  <p className="text-gray-500 text-sm mb-4">
                    or click to browse files
                  </p>
                  <div className="text-xs text-gray-600">
                    Accepted formats: {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}
                    <br />
                    Max size: {maxSizeMB}MB • Recommended: 800x400 to 1600x800 pixels
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-medium">Upload Error</p>
            <p className="text-xs text-red-400/80 mt-1">{error}</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
