/**
 * File Compression Utilities
 * Automatic compression for images and documents before S3 upload
 * Supports: Images (JPEG, PNG, WebP), PDFs
 */

import sharp from 'sharp'

/**
 * Compression configuration
 */
const COMPRESSION_CONFIG = {
  image: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 85,
    format: 'jpeg' as const,
  },
  thumbnail: {
    width: 300,
    height: 300,
    quality: 70,
  },
  pdf: {
    // PDF compression handled separately (future enhancement)
    enabled: false,
  },
}

/**
 * Compression result
 */
export interface CompressionResult {
  success: boolean
  compressed: boolean
  data: Buffer
  originalSize: number
  compressedSize: number
  compressionRatio: number // percentage saved
  mimeType: string
  error?: string
}

/**
 * Check if file type is compressible
 */
export function isCompressible(mimeType: string): boolean {
  const compressibleTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
  ]

  return compressibleTypes.includes(mimeType.toLowerCase())
}

/**
 * Compress image using Sharp
 */
export async function compressImage(
  buffer: Buffer,
  mimeType: string,
  options?: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    format?: 'jpeg' | 'png' | 'webp'
  }
): Promise<CompressionResult> {
  const originalSize = buffer.length

  try {
    // Check if compression is needed
    if (!isCompressible(mimeType)) {
      return {
        success: true,
        compressed: false,
        data: buffer,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        mimeType,
      }
    }

    // Set compression options
    const maxWidth = options?.maxWidth || COMPRESSION_CONFIG.image.maxWidth
    const maxHeight = options?.maxHeight || COMPRESSION_CONFIG.image.maxHeight
    const quality = options?.quality || COMPRESSION_CONFIG.image.quality
    const format = options?.format || COMPRESSION_CONFIG.image.format

    // Get image metadata
    const metadata = await sharp(buffer).metadata()

    // Start Sharp pipeline
    let pipeline = sharp(buffer)

    // Resize if needed (maintain aspect ratio)
    if (
      metadata.width &&
      metadata.height &&
      (metadata.width > maxWidth || metadata.height > maxHeight)
    ) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // Convert to desired format with compression
    let compressedBuffer: Buffer

    switch (format) {
      case 'jpeg':
        compressedBuffer = await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer()
        break

      case 'png':
        compressedBuffer = await pipeline
          .png({ quality, compressionLevel: 9 })
          .toBuffer()
        break

      case 'webp':
        compressedBuffer = await pipeline.webp({ quality }).toBuffer()
        break

      default:
        compressedBuffer = await pipeline
          .jpeg({ quality, mozjpeg: true })
          .toBuffer()
    }

    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100

    // If compressed size is larger, return original
    if (compressedSize >= originalSize) {
      return {
        success: true,
        compressed: false,
        data: buffer,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        mimeType,
      }
    }

    return {
      success: true,
      compressed: true,
      data: compressedBuffer,
      originalSize,
      compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      mimeType: `image/${format}`,
    }
  } catch (error) {
    console.error('Compression Error:', error)
    return {
      success: false,
      compressed: false,
      data: buffer,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      mimeType,
      error: error instanceof Error ? error.message : 'Unknown compression error',
    }
  }
}

/**
 * Generate thumbnail from image
 */
export async function generateThumbnail(
  buffer: Buffer,
  options?: {
    width?: number
    height?: number
    quality?: number
  }
): Promise<{
  success: boolean
  data?: Buffer
  size?: number
  error?: string
}> {
  try {
    const width = options?.width || COMPRESSION_CONFIG.thumbnail.width
    const height = options?.height || COMPRESSION_CONFIG.thumbnail.height
    const quality = options?.quality || COMPRESSION_CONFIG.thumbnail.quality

    const thumbnailBuffer = await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    return {
      success: true,
      data: thumbnailBuffer,
      size: thumbnailBuffer.length,
    }
  } catch (error) {
    console.error('Thumbnail Generation Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Compress file (auto-detect type)
 */
export async function compressFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<CompressionResult> {
  // Handle images
  if (isCompressible(mimeType)) {
    return await compressImage(buffer, mimeType)
  }

  // Handle PDFs (future enhancement)
  if (mimeType === 'application/pdf') {
    // For now, return original
    return {
      success: true,
      compressed: false,
      data: buffer,
      originalSize: buffer.length,
      compressedSize: buffer.length,
      compressionRatio: 0,
      mimeType,
    }
  }

  // For other file types, return original
  return {
    success: true,
    compressed: false,
    data: buffer,
    originalSize: buffer.length,
    compressedSize: buffer.length,
    compressionRatio: 0,
    mimeType,
  }
}

/**
 * Validate file size (15MB max)
 */
export function validateFileSize(
  sizeInBytes: number,
  maxSizeMB: number = 15
): {
  valid: boolean
  size: number
  maxSize: number
  error?: string
} {
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  if (sizeInBytes > maxSizeBytes) {
    return {
      valid: false,
      size: sizeInBytes,
      maxSize: maxSizeBytes,
      error: `File size ${formatFileSize(sizeInBytes)} exceeds maximum allowed size of ${maxSizeMB}MB`,
    }
  }

  return {
    valid: true,
    size: sizeInBytes,
    maxSize: maxSizeBytes,
  }
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',

    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',

    // Other
    json: 'application/json',
    xml: 'application/xml',
  }

  return mimeTypes[extension || ''] || 'application/octet-stream'
}

/**
 * Validate file type (allowed types)
 */
export function validateFileType(
  mimeType: string,
  allowedTypes?: string[]
): {
  valid: boolean
  mimeType: string
  error?: string
} {
  // Default allowed types (all common document/image types)
  const defaultAllowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ]

  const typesToCheck = allowedTypes || defaultAllowedTypes

  if (!typesToCheck.includes(mimeType)) {
    return {
      valid: false,
      mimeType,
      error: `File type ${mimeType} is not allowed. Allowed types: ${typesToCheck.join(', ')}`,
    }
  }

  return {
    valid: true,
    mimeType,
  }
}

/**
 * Complete file validation and compression pipeline
 */
export async function processFileUpload(params: {
  buffer: Buffer
  fileName: string
  mimeType: string
  maxSizeMB?: number
  compress?: boolean
  generateThumbnail?: boolean
}): Promise<{
  success: boolean
  processedFile?: Buffer
  thumbnail?: Buffer
  originalSize: number
  processedSize: number
  compressionRatio: number
  mimeType: string
  thumbnailSize?: number
  validationErrors?: string[]
  error?: string
}> {
  const errors: string[] = []

  try {
    // 1. Validate file size
    const sizeValidation = validateFileSize(
      params.buffer.length,
      params.maxSizeMB
    )
    if (!sizeValidation.valid) {
      errors.push(sizeValidation.error || 'File size validation failed')
    }

    // 2. Validate file type
    const typeValidation = validateFileType(params.mimeType)
    if (!typeValidation.valid) {
      errors.push(typeValidation.error || 'File type validation failed')
    }

    // If validation failed, return errors
    if (errors.length > 0) {
      return {
        success: false,
        originalSize: params.buffer.length,
        processedSize: params.buffer.length,
        compressionRatio: 0,
        mimeType: params.mimeType,
        validationErrors: errors,
        error: errors.join('; '),
      }
    }

    // 3. Compress file if enabled and compressible
    let processedBuffer = params.buffer
    let compressionRatio = 0
    let finalMimeType = params.mimeType

    if (params.compress !== false && isCompressible(params.mimeType)) {
      const compressionResult = await compressFile(
        params.buffer,
        params.mimeType,
        params.fileName
      )

      if (compressionResult.success) {
        processedBuffer = compressionResult.data
        compressionRatio = compressionResult.compressionRatio
        finalMimeType = compressionResult.mimeType
      }
    }

    // 4. Generate thumbnail if requested and image
    let thumbnailBuffer: Buffer | undefined
    let thumbnailSize: number | undefined

    if (
      params.generateThumbnail &&
      isCompressible(params.mimeType)
    ) {
      const thumbnailResult = await generateThumbnail(processedBuffer)
      if (thumbnailResult.success && thumbnailResult.data) {
        thumbnailBuffer = thumbnailResult.data
        thumbnailSize = thumbnailResult.size
      }
    }

    return {
      success: true,
      processedFile: processedBuffer,
      thumbnail: thumbnailBuffer,
      originalSize: params.buffer.length,
      processedSize: processedBuffer.length,
      compressionRatio,
      mimeType: finalMimeType,
      thumbnailSize,
    }
  } catch (error) {
    console.error('File Processing Error:', error)
    return {
      success: false,
      originalSize: params.buffer.length,
      processedSize: params.buffer.length,
      compressionRatio: 0,
      mimeType: params.mimeType,
      error: error instanceof Error ? error.message : 'Unknown processing error',
    }
  }
}
