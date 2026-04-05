/**
 * File Upload Security
 * Magic byte verification and secure file handling
 *
 * SECURITY FIX MED-03: Magic byte verification for file uploads
 */

/**
 * Magic bytes (file signatures) for allowed file types
 * First few bytes that identify the actual file type
 */
const MAGIC_BYTES: Record<string, { bytes: number[][]; extension: string; mimeType: string }> = {
  PDF: {
    bytes: [[0x25, 0x50, 0x44, 0x46]], // %PDF
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
  JPEG: {
    bytes: [[0xFF, 0xD8, 0xFF]], // JPEG/JFIF
    extension: '.jpg',
    mimeType: 'image/jpeg',
  },
  PNG: {
    bytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
    extension: '.png',
    mimeType: 'image/png',
  },
  DOCX: {
    bytes: [[0x50, 0x4B, 0x03, 0x04]], // ZIP format (DOCX is a ZIP)
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  XLSX: {
    bytes: [[0x50, 0x4B, 0x03, 0x04]], // ZIP format (XLSX is a ZIP)
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
}

/**
 * Maximum file sizes (in bytes)
 */
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5 MB
  DOCUMENT: 10 * 1024 * 1024, // 10 MB
  PDF: 20 * 1024 * 1024, // 20 MB
} as const

/**
 * Verify file type by checking magic bytes (file signature)
 *
 * @param buffer - File buffer (first few bytes)
 * @param expectedType - Expected file type key
 * @returns True if magic bytes match
 */
export function verifyMagicBytes(buffer: ArrayBuffer, expectedType: keyof typeof MAGIC_BYTES): boolean {
  const fileType = MAGIC_BYTES[expectedType]
  if (!fileType) return false

  const bytes = new Uint8Array(buffer)

  // Check if any of the magic byte patterns match
  return fileType.bytes.some((pattern) => {
    if (bytes.length < pattern.length) return false

    return pattern.every((byte, index) => bytes[index] === byte)
  })
}

/**
 * Detect file type from magic bytes
 *
 * @param buffer - File buffer (first 16 bytes usually sufficient)
 * @returns Detected file type or null
 */
export function detectFileType(buffer: ArrayBuffer): keyof typeof MAGIC_BYTES | null {
  for (const [type, config] of Object.entries(MAGIC_BYTES)) {
    if (verifyMagicBytes(buffer, type as keyof typeof MAGIC_BYTES)) {
      return type as keyof typeof MAGIC_BYTES
    }
  }
  return null
}

/**
 * Validate uploaded file
 *
 * @param file - File object from form upload
 * @param allowedTypes - Array of allowed file type keys
 * @returns Validation result with error message if invalid
 */
export async function validateUploadedFile(
  file: File,
  allowedTypes: Array<keyof typeof MAGIC_BYTES>
): Promise<{ valid: boolean; error?: string; detectedType?: string }> {
  // Check file size
  const maxSize = Math.max(...Object.values(MAX_FILE_SIZES))
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)} MB`,
    }
  }

  // Check if file size is 0
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    }
  }

  // Read first 16 bytes for magic byte verification
  const buffer = await file.slice(0, 16).arrayBuffer()

  // Detect actual file type
  const detectedType = detectFileType(buffer)

  if (!detectedType) {
    return {
      valid: false,
      error: 'Unsupported or corrupted file type',
    }
  }

  // Check if detected type is in allowed types
  if (!allowedTypes.includes(detectedType)) {
    return {
      valid: false,
      error: `File type not allowed. Detected: ${detectedType}`,
      detectedType,
    }
  }

  // Verify MIME type matches detected type (additional check)
  const expectedMimeType = MAGIC_BYTES[detectedType].mimeType
  if (file.type !== expectedMimeType) {
    return {
      valid: false,
      error: `MIME type mismatch. Expected: ${expectedMimeType}, Got: ${file.type}`,
      detectedType,
    }
  }

  return {
    valid: true,
    detectedType,
  }
}

/**
 * Sanitize filename to prevent directory traversal and injection
 *
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[/\\:\0]/g, '_')

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, '')

  // Limit length
  const maxLength = 255
  if (sanitized.length > maxLength) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    sanitized = sanitized.substring(0, maxLength - ext.length) + ext
  }

  // Ensure it's not empty
  if (!sanitized) {
    sanitized = 'unnamed_file'
  }

  return sanitized
}

/**
 * Generate secure random filename
 *
 * @param originalFilename - Original filename (for extension)
 * @returns Secure random filename with original extension
 */
export function generateSecureFilename(originalFilename: string): string {
  const extension = originalFilename.substring(originalFilename.lastIndexOf('.'))
  const randomBytes = crypto.getRandomValues(new Uint8Array(16))
  const randomString = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${randomString}${extension}`
}

/**
 * Check if file extension is allowed
 *
 * @param filename - Filename to check
 * @param allowedExtensions - Array of allowed extensions (with dots)
 * @returns True if extension is allowed
 */
export function isAllowedExtension(filename: string, allowedExtensions: string[]): boolean {
  const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return allowedExtensions.includes(extension)
}

/**
 * File upload configuration
 */
export const FILE_UPLOAD_CONFIG = {
  ALLOWED_TYPES: ['PDF', 'JPEG', 'PNG', 'DOCX'] as Array<keyof typeof MAGIC_BYTES>,
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx'],
  MAX_SIZE: MAX_FILE_SIZES.DOCUMENT,
  SCAN_FOR_VIRUSES: true, // Enable virus scanning in production
} as const

/**
 * Validate file upload with all security checks
 *
 * @param file - File to validate
 * @returns Validation result
 */
export async function validateFileUpload(file: File): Promise<{
  valid: boolean
  error?: string
  sanitizedFilename?: string
  secureFilename?: string
}> {
  // Check extension
  if (!isAllowedExtension(file.name, FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS)) {
    return {
      valid: false,
      error: 'File extension not allowed',
    }
  }

  // Validate magic bytes
  const validation = await validateUploadedFile(file, FILE_UPLOAD_CONFIG.ALLOWED_TYPES)
  if (!validation.valid) {
    return validation
  }

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name)
  const secureFilename = generateSecureFilename(file.name)

  return {
    valid: true,
    sanitizedFilename,
    secureFilename,
  }
}
