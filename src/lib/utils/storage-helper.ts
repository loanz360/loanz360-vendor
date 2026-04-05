/**
 * Supabase Storage Helper
 *
 * Provides utility functions for uploading, downloading, and managing files in Supabase Storage
 */

import { createSupabaseClient } from '@/lib/supabase/client'

export type StorageBucket = 'employee-documents' | 'ai-crm-documents' | 'profile-photos'

interface UploadOptions {
  bucket: StorageBucket
  folder?: string
  fileName?: string
  upsert?: boolean
}

interface UploadResult {
  success: boolean
  path?: string
  url?: string
  error?: string
}

/**
 * Upload a file to Supabase Storage
 *
 * @param file - File to upload
 * @param options - Upload configuration
 * @returns Promise with upload result
 */
export async function uploadFile(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    const supabase = createSupabaseClient()

    // Generate file path
    const timestamp = Date.now()
    const sanitizedFileName = options.fileName || file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const folder = options.folder || ''
    const filePath = folder ? `${folder}/${timestamp}_${sanitizedFileName}` : `${timestamp}_${sanitizedFileName}`

    // Upload file
    const { data, error } = await supabase.storage
      .from(options.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: options.upsert || false
      })

    if (error) {
      console.error('[Storage Helper] Upload error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    // Get public URL (for public buckets) or signed URL (for private buckets)
    let publicURL: string | undefined

    if (options.bucket === 'profile-photos') {
      // Public bucket - get public URL
      const { data: urlData } = supabase.storage
        .from(options.bucket)
        .getPublicUrl(data.path)
      publicURL = urlData.publicUrl
    } else {
      // Private bucket - get signed URL (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from(options.bucket)
        .createSignedUrl(data.path, 3600)

      if (!urlError && urlData) {
        publicURL = urlData.signedUrl
      }
    }

    return {
      success: true,
      path: data.path,
      url: publicURL
    }
  } catch (error) {
    console.error('[Storage Helper] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete a file from Supabase Storage
 *
 * @param bucket - Storage bucket
 * @param path - File path in bucket
 * @returns Promise with delete result
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseClient()

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      console.error('[Storage Helper] Delete error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error) {
    console.error('[Storage Helper] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get a signed URL for a private file
 *
 * @param bucket - Storage bucket
 * @param path - File path in bucket
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Promise with signed URL
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn: number = 3600
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = createSupabaseClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('[Storage Helper] Signed URL error:', error)
      return { error: error.message }
    }

    return { url: data.signedUrl }
  } catch (error) {
    console.error('[Storage Helper] Unexpected error:', error)
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get public URL for a file (only works for public buckets)
 *
 * @param bucket - Storage bucket
 * @param path - File path in bucket
 * @returns Public URL
 */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const supabase = createSupabaseClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Validate file type and size
 *
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSizeMB - Maximum file size in MB
 * @returns Validation result with error message if invalid
 */
export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSizeMB: number
): { valid: boolean; error?: string } {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    }
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`
    }
  }

  return { valid: true }
}

/**
 * Common file type configurations
 */
export const FILE_TYPE_CONFIGS = {
  documents: {
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxSizeMB: 10,
    label: 'PDF or Word documents'
  },
  images: {
    types: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSizeMB: 5,
    label: 'JPEG, PNG, or WebP images'
  },
  spreadsheets: {
    types: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    maxSizeMB: 10,
    label: 'Excel or CSV files'
  },
  all: {
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    maxSizeMB: 10,
    label: 'Documents, images, or spreadsheets'
  }
}
