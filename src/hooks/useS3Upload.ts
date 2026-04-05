import { useState, useCallback } from 'react'

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

interface UseS3UploadOptions {
  onProgress?: (progress: number) => void
}

/**
 * Hook for uploading files directly to S3 using presigned URLs
 * Provides faster uploads by bypassing the server for file transfer
 */
export function useS3Upload(options?: UseS3UploadOptions) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const uploadToS3 = useCallback(async (
    file: File,
    uploadType: string
  ): Promise<UploadResult> => {
    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Step 1: Get presigned URL from our API
      const presignedResponse = await fetch('/api/customers/upload/presigned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          uploadType,
        }),
      })

      const presignedData = await presignedResponse.json()

      if (!presignedData.success) {
        throw new Error(presignedData.error || 'Failed to get upload URL')
      }

      // Step 2: Upload directly to S3 using presigned URL
      const uploadResponse = await fetch(presignedData.presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3')
      }

      setProgress(100)
      options?.onProgress?.(100)

      return {
        success: true,
        url: presignedData.publicUrl,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsUploading(false)
    }
  }, [options])

  // Fallback to server-side upload if direct S3 upload fails
  const uploadViaServer = useCallback(async (
    file: File,
    uploadType: string
  ): Promise<UploadResult> => {
    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', uploadType)

      const response = await fetch('/api/customers/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.url) {
        setProgress(100)
        return {
          success: true,
          url: result.url,
        }
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Smart upload: tries direct S3 first, falls back to server-side
  const upload = useCallback(async (
    file: File,
    uploadType: string
  ): Promise<UploadResult> => {
    // Try direct S3 upload first
    const result = await uploadToS3(file, uploadType)

    // If direct upload fails, try server-side upload
    if (!result.success) {
      console.log('Direct S3 upload failed, falling back to server-side upload')
      return uploadViaServer(file, uploadType)
    }

    return result
  }, [uploadToS3, uploadViaServer])

  return {
    upload,
    uploadToS3,
    uploadViaServer,
    isUploading,
    progress,
    error,
    reset: () => {
      setProgress(0)
      setError(null)
    },
  }
}
