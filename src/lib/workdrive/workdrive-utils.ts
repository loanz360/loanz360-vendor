/**
 * WorkDrive Client-Safe Utilities
 * These utilities can be safely imported in client components
 * They do NOT use any Node.js native modules (like sharp)
 */

import {
  FileCategory,
  FILE_CATEGORY_MAP,
} from '@/types/workdrive'

/**
 * Format bytes to human readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory {
  return FILE_CATEGORY_MAP[mimeType] || 'other'
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * Get file icon based on file type/category
 */
export function getFileIconName(fileType: string): string {
  const iconMap: Record<string, string> = {
    // Documents
    pdf: 'FileText',
    doc: 'FileText',
    docx: 'FileText',
    txt: 'FileText',

    // Spreadsheets
    xls: 'Table',
    xlsx: 'Table',
    csv: 'Table',

    // Presentations
    ppt: 'Presentation',
    pptx: 'Presentation',

    // Images
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    gif: 'Image',
    webp: 'Image',
    svg: 'Image',

    // Videos
    mp4: 'Video',
    avi: 'Video',
    mov: 'Video',
    mkv: 'Video',

    // Audio
    mp3: 'Music',
    wav: 'Music',
    ogg: 'Music',

    // Archives
    zip: 'Archive',
    rar: 'Archive',
    '7z': 'Archive',
    tar: 'Archive',
    gz: 'Archive',
  }

  return iconMap[fileType.toLowerCase()] || 'File'
}

/**
 * Check if file is previewable
 */
export function isPreviewable(mimeType: string): boolean {
  const previewableMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    // PDFs
    'application/pdf',

    // Videos
    'video/mp4',
    'video/webm',

    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',

    // Text
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
  ]

  return previewableMimes.includes(mimeType)
}

/**
 * Get display name for file category
 */
export function getCategoryDisplayName(category: FileCategory): string {
  const names: Record<FileCategory, string> = {
    document: 'Documents',
    image: 'Images',
    spreadsheet: 'Spreadsheets',
    presentation: 'Presentations',
    archive: 'Archives',
    other: 'Other Files',
  }

  return names[category]
}

/**
 * Validate file type against allowed types
 */
export function validateFileType(
  fileName: string,
  allowedExtensions: string[],
  blockedExtensions: string[]
): { valid: boolean; error?: string } {
  const extension = getFileExtension(fileName).toLowerCase()

  // Check blocked extensions
  if (blockedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not allowed for security reasons`,
    }
  }

  // Check allowed types (empty array means all allowed)
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not in the allowed list`,
    }
  }

  return { valid: true }
}

/**
 * Generate unique file name to avoid conflicts
 */
export function generateUniqueFileName(
  originalName: string,
  existingNames: string[]
): string {
  if (!existingNames.includes(originalName)) {
    return originalName
  }

  const extension = getFileExtension(originalName)
  const baseName = extension
    ? originalName.slice(0, -(extension.length + 1))
    : originalName

  let counter = 1
  let newName = extension
    ? `${baseName} (${counter}).${extension}`
    : `${baseName} (${counter})`

  while (existingNames.includes(newName)) {
    counter++
    newName = extension
      ? `${baseName} (${counter}).${extension}`
      : `${baseName} (${counter})`
  }

  return newName
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 4) return `${diffWeeks}w ago`
  if (diffMonths < 12) return `${diffMonths}mo ago`

  return formatDate(d)
}
