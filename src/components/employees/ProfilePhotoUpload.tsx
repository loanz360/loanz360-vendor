'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Camera, Upload, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clientLogger } from '@/lib/utils/client-logger'
import { useAuth } from '@/lib/auth/auth-context'
import CameraCapture from '@/components/ui/CameraCapture'

interface ProfilePhotoUploadProps {
  currentPhotoUrl: string | null
  onPhotoUpdated: (url: string) => void
  employeeName: string
}

export default function ProfilePhotoUpload({ currentPhotoUrl, onPhotoUpdated, employeeName }: ProfilePhotoUploadProps) {
  const { refreshUser } = useAuth()
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadPhoto = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPG, PNG, and WebP are allowed')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const response = await fetch('/api/employees/profile/upload-photo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success && result.data?.url) {
        setPhotoUrl(result.data.url)
        onPhotoUpdated(result.data.url)
        // Refresh user context to update sidebar avatar
        await refreshUser()
        clientLogger.info('Photo uploaded successfully')
      } else {
        setError(result.error || 'Failed to upload photo')
      }
    } catch (error) {
      clientLogger.error('Error uploading photo', error)
      setError('Failed to upload photo. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadPhoto(file)
  }

  const handleCameraCapture = async (file: File) => {
    await uploadPhoto(file)
  }

  const confirmDeletePhoto = useCallback(() => {
    setShowDeleteConfirm(true)
  }, [])

  const handleDeletePhoto = async () => {
    setShowDeleteConfirm(false)
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/employees/profile/upload-photo', {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setPhotoUrl(null)
        onPhotoUpdated('')
        // Refresh user context to update sidebar avatar
        await refreshUser()
        clientLogger.info('Photo deleted successfully')
      } else {
        setError(result.error || 'Failed to delete photo')
      }
    } catch (error) {
      clientLogger.error('Error deleting photo', error)
      setError('Failed to delete photo. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-300 mb-3">
        Profile Photo
      </label>

      <div className="flex items-start gap-6">
        {/* Photo Preview */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-800 border-4 border-gray-700/50 flex items-center justify-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={employeeName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center">
                <Camera className="w-12 h-12 text-gray-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">No photo</p>
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {(isUploading || isDeleting) && (
            <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1">
          <div className="flex flex-wrap gap-3 mb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading || isDeleting}
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isDeleting}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>

            <Button
              onClick={() => setIsCameraOpen(true)}
              disabled={isUploading || isDeleting}
              variant="outline"
              className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
              size="sm"
            >
              <Camera className="w-4 h-4 mr-2" />
              Take Selfie
            </Button>

            {photoUrl && (
              <Button
                onClick={confirmDeletePhoto}
                disabled={isUploading || isDeleting}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/10"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-1">
            Max size: 5MB • Formats: JPG, PNG, WebP
          </p>

          {error && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <span className="font-semibold">Error:</span> {error}
            </p>
          )}

          {photoUrl && !error && !isUploading && (
            <p className="text-xs text-green-400 mt-2">
              ✓ Photo uploaded successfully
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm photo deletion">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Profile Photo</h3>
            <p className="text-gray-400 text-sm mb-4">Are you sure you want to delete your profile photo? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="border-gray-600 text-gray-300" aria-label="Cancel deletion">Cancel</Button>
              <Button size="sm" onClick={handleDeletePhoto} className="bg-red-600 hover:bg-red-700 text-white" aria-label="Confirm deletion">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        aspectRatio="square"
      />
    </div>
  )
}
