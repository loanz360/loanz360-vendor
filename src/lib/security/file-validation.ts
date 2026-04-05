/**
 * File Upload Security - Magic Byte Validation
 *
 * This module provides secure file validation using magic bytes (file signatures)
 * to prevent malicious file uploads that spoof MIME types.
 *
 * SECURITY: MIME types can be easily spoofed. Always validate actual file content.
 *
 * COMPLIANCE: PCI-DSS 6.5.8, OWASP A03:2021 - Injection
 */

import { logger } from '@/lib/utils/logger'

// File magic bytes (first few bytes that identify file type)
const FILE_SIGNATURES: Record<string, { magic: number[][]; ext: string; mime: string }> = {
  // PDF
  PDF: {
    magic: [[0x25, 0x50, 0x44, 0x46]], // %PDF
    ext: 'pdf',
    mime: 'application/pdf',
  },

  // Images
  JPEG: {
    magic: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // Exif
      [0xFF, 0xD8, 0xFF, 0xE8], // SPIFF
    ],
    ext: 'jpg',
    mime: 'image/jpeg',
  },
  PNG: {
    magic: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    ext: 'png',
    mime: 'image/png',
  },

  // Microsoft Office (newer formats)
  XLSX: {
    magic: [[0x50, 0x4B, 0x03, 0x04]], // ZIP signature (XLSX is ZIP-based)
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  DOCX: {
    magic: [[0x50, 0x4B, 0x03, 0x04]], // ZIP signature (DOCX is ZIP-based)
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },

  // CSV/Text (no magic bytes, validated by content)
  CSV: {
    magic: [], // CSV has no magic bytes
    ext: 'csv',
    mime: 'text/csv',
  },
  TXT: {
    magic: [], // Plain text has no magic bytes
    ext: 'txt',
    mime: 'text/plain',
  },
}

export interface FileValidationResult {
  valid: boolean
  detectedType?: string
  detectedMime?: string
  reason?: string
  sanitizedFilename?: string
}

/**
 * Validate file using magic bytes
 */
export function validateFileContent(buffer: Buffer, filename: string, claimedMimeType: string): FileValidationResult {
  // Get file extension from filename
  const fileExt = filename.split('.').pop()?.toLowerCase() || ''

  // Sanitize filename (prevent path traversal)
  const sanitizedFilename = sanitizeFilename(filename)

  // Check if file is empty
  if (buffer.length === 0) {
    return {
      valid: false,
      reason: 'Empty file',
    }
  }

  // For text-based files (CSV, TXT), we can't use magic bytes
  if (claimedMimeType === 'text/csv' || claimedMimeType === 'text/plain') {
    // Validate content is actually text
    if (!isTextContent(buffer)) {
      return {
        valid: false,
        reason: 'File claims to be text but contains binary data',
      }
    }

    // For CSV, validate structure
    if (claimedMimeType === 'text/csv' && fileExt === 'csv') {
      if (!isValidCSV(buffer)) {
        return {
          valid: false,
          reason: 'Invalid CSV structure',
        }
      }
    }

    return {
      valid: true,
      detectedType: fileExt,
      detectedMime: claimedMimeType,
      sanitizedFilename,
    }
  }

  // Check magic bytes for binary files
  const detectedType = detectFileType(buffer)

  if (!detectedType) {
    logger.warn('Could not detect file type from magic bytes', { filename, claimedMimeType })
    return {
      valid: false,
      reason: 'Could not verify file type',
    }
  }

  // Verify claimed MIME type matches detected type
  if (detectedType.mime !== claimedMimeType) {
    logger.warn('MIME type mismatch', {
      filename,
      claimed: claimedMimeType,
      detected: detectedType.mime,
    })
    return {
      valid: false,
      reason: `File type mismatch: claimed ${claimedMimeType}, detected ${detectedType.mime}`,
    }
  }

  // Verify file extension matches detected type
  if (detectedType.ext !== fileExt) {
    logger.warn('File extension mismatch', {
      filename,
      claimedExt: fileExt,
      detectedExt: detectedType.ext,
    })
    // Allow but log the mismatch
  }

  return {
    valid: true,
    detectedType: detectedType.ext,
    detectedMime: detectedType.mime,
    sanitizedFilename,
  }
}

/**
 * Detect file type from magic bytes
 */
function detectFileType(buffer: Buffer): { ext: string; mime: string } | null {
  for (const [, signature] of Object.entries(FILE_SIGNATURES)) {
    if (signature.magic.length === 0) continue // Skip text files

    for (const magic of signature.magic) {
      if (matchesMagicBytes(buffer, magic)) {
        return { ext: signature.ext, mime: signature.mime }
      }
    }
  }

  return null
}

/**
 * Check if buffer starts with magic bytes
 */
function matchesMagicBytes(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false

  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false
  }

  return true
}

/**
 * Check if content is text (UTF-8 or ASCII)
 */
function isTextContent(buffer: Buffer): boolean {
  // Sample first 1KB for performance
  const sampleSize = Math.min(buffer.length, 1024)
  const sample = buffer.slice(0, sampleSize)

  let nullBytes = 0
  let controlChars = 0

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i]

    // Count null bytes (binary indicator)
    if (byte === 0) {
      nullBytes++
    }

    // Count control characters (except whitespace)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      controlChars++
    }
  }

  // If >5% null bytes or >10% control chars, likely binary
  const nullRatio = nullBytes / sampleSize
  const controlRatio = controlChars / sampleSize

  return nullRatio < 0.05 && controlRatio < 0.1
}

/**
 * Validate CSV structure
 */
function isValidCSV(buffer: Buffer): boolean {
  try {
    const content = buffer.toString('utf-8')
    const lines = content.split('\n').filter(line => line.trim().length > 0)

    if (lines.length === 0) return false

    // Check first line has at least one comma (header)
    const header = lines[0]
    if (!header.includes(',')) return false

    // Basic validation passed
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize filename to prevent path traversal and injection
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = filename.replace(/^.*[\\\/]/, '')

  // Remove dangerous characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_')

  // Prevent double extensions
  sanitized = sanitized.replace(/\.+/g, '.')

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || ''
    const name = sanitized.slice(0, 255 - ext.length - 1)
    sanitized = `${name}.${ext}`
  }

  // Prevent hidden files
  if (sanitized.startsWith('.')) {
    sanitized = 'file' + sanitized
  }

  return sanitized
}

/**
 * Scan for malicious patterns in file content
 */
export function scanForMaliciousPatterns(buffer: Buffer): { safe: boolean; threats: string[] } {
  const threats: string[] = []
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000)) // First 10KB

  // Check for executable signatures
  const executablePatterns = [
    /MZ.{0,100}This program/i, // Windows executable
    /^\x7FELF/, // Linux executable
    /#!\s*\/bin\/(ba)?sh/, // Shell script
    /<script[^>]*>/i, // JavaScript in file
    /<?php/i, // PHP code
    /import\s+os|import\s+sys/i, // Python system imports
  ]

  for (const pattern of executablePatterns) {
    if (pattern.test(content)) {
      threats.push('Executable content detected')
      break
    }
  }

  // Check for SQL injection attempts in CSV
  const sqlPatterns = [
    /;?\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC)\s+(TABLE|DATABASE|USER)/i,
    /UNION\s+SELECT/i,
    /--\s*$/m,
  ]

  for (const pattern of sqlPatterns) {
    if (pattern.test(content)) {
      threats.push('Potential SQL injection detected')
      break
    }
  }

  // Check for XXE injection in XML/Excel files
  if (content.includes('<!DOCTYPE') || content.includes('<!ENTITY')) {
    threats.push('Potential XXE injection detected')
  }

  return {
    safe: threats.length === 0,
    threats,
  }
}

/**
 * Complete file validation workflow
 */
export async function validateUploadedFile(
  buffer: Buffer,
  filename: string,
  claimedMimeType: string,
  allowedTypes: string[]
): Promise<FileValidationResult> {
  // Step 1: Validate claimed MIME type is allowed
  if (!allowedTypes.includes(claimedMimeType)) {
    return {
      valid: false,
      reason: `File type ${claimedMimeType} not allowed`,
    }
  }

  // Step 2: Validate file content matches claimed type
  const contentValidation = validateFileContent(buffer, filename, claimedMimeType)
  if (!contentValidation.valid) {
    return contentValidation
  }

  // Step 3: Scan for malicious patterns
  const malwareScan = scanForMaliciousPatterns(buffer)
  if (!malwareScan.safe) {
    logger.error('Malicious file upload attempt detected', {
      filename,
      threats: malwareScan.threats,
    })
    return {
      valid: false,
      reason: 'File contains potentially malicious content',
    }
  }

  // Step 4: All checks passed
  return contentValidation
}

/**
 * Allowed file types for different contexts
 */
export const ALLOWED_UPLOAD_TYPES = {
  DOCUMENTS: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  DATA_IMPORT: [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  IMAGES: [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
} as const
