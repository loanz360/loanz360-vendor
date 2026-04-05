export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { optimizeImage, validateImage } from '@/lib/image-optimizer'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  // Apply rate limiting for uploads
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB for offers)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // STEP 1: Validate image using advanced validator
    try {
      const validation = await validateImage(buffer)

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'Invalid image file' },
          { status: 400 }
        )
      }

      // STEP 2: Optimize image with multi-format, responsive sizes
      const optimizationResult = await optimizeImage(buffer, file.name, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 85,
        formats: ['webp', 'avif'], // Modern formats for best compression
        generateResponsive: true, // Generate all responsive sizes
        preserveOriginal: false // Don't keep original (save storage)
      })

      // STEP 3: Upload all optimized images to Supabase Storage
      const uploadedImages = []
      const uploadErrors = []

      for (const image of optimizationResult.images) {
        const filePath = `offers/${image.filename}`

        const { error } = await supabase
          .storage
          .from('public')
          .upload(filePath, image.buffer, {
            contentType: `image/${image.format}`,
            cacheControl: '31536000', // Cache for 1 year (immutable)
            upsert: false
          })

        if (error) {
          apiLogger.error(`Upload error for ${image.filename}:`, error)
          uploadErrors.push({ filename: image.filename, error: 'Operation failed' })
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('public')
          .getPublicUrl(filePath)

        uploadedImages.push({
          url: publicUrl,
          filename: image.filename,
          format: image.format,
          size: image.size,
          width: image.width,
          height: image.height,
          sizeInBytes: image.sizeInBytes,
          sizeInKB: Math.round(image.sizeInBytes / 1024)
        })
      }

      // At least one image must upload successfully
      if (uploadedImages.length === 0) {
        apiLogger.error('All uploads failed', uploadErrors)
        throw new Error('Failed to upload any optimized images')
      }

      // Find the primary image (WebP medium or first available)
      const primaryImage = uploadedImages.find(
        img => img.format === 'webp' && img.size === 'medium'
      ) || uploadedImages[0]

      return NextResponse.json({
        success: true,
        // Primary image (backward compatible with existing code)
        url: primaryImage.url,
        filename: primaryImage.filename,

        // Performance metrics
        originalSize: optimizationResult.originalSize,
        totalOptimizedSize: optimizationResult.totalOptimizedSize,
        savings: optimizationResult.savingsPercent,
        savingsInBytes: optimizationResult.savings,

        // Image metadata
        dimensions: {
          width: optimizationResult.metadata.width,
          height: optimizationResult.metadata.height,
          aspectRatio: optimizationResult.metadata.aspectRatio,
          format: optimizationResult.metadata.format,
          hasAlpha: optimizationResult.metadata.hasAlpha
        },

        // All uploaded images (for responsive/multi-format usage)
        images: uploadedImages,

        // Upload summary
        upload_summary: {
          total_images_generated: optimizationResult.images.length,
          total_images_uploaded: uploadedImages.length,
          upload_errors: uploadErrors.length,
          formats: [...new Set(uploadedImages.map(img => img.format))],
          sizes: [...new Set(uploadedImages.map(img => img.size))]
        },

        // Errors (if any non-critical)
        errors: uploadErrors.length > 0 ? uploadErrors : undefined
      })

    } catch (error: unknown) {
      apiLogger.error('Error processing image', error)
      logApiError(error as Error, request, { action: 'process_image' })
      return NextResponse.json(
        { error: 'Failed to process image. Please ensure it is a valid image file.' },
        { status: 400 }
      )
    }

  } catch (error: unknown) {
    apiLogger.error('Error uploading offer image', error)
    logApiError(error as Error, request, { action: 'upload_offer_image' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete offer image from storage
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('filePath')

    if (!filePath) {
      return NextResponse.json({ success: false, error: 'File path required' }, { status: 400 })
    }

    // Validate that it's an offer image path
    if (!filePath.startsWith('offers/')) {
      return NextResponse.json({ success: false, error: 'Invalid file path' }, { status: 400 })
    }

    const { error } = await supabase
      .storage
      .from('public')
      .remove([filePath])

    if (error) {
      apiLogger.error('Delete error', error)
      logApiError(error as Error, request, { action: 'delete', filePath })
      throw new Error('Failed to delete file from storage')
    }

    return NextResponse.json({ success: true })

  } catch (error: unknown) {
    apiLogger.error('Error deleting offer image', error)
    logApiError(error as Error, request, { action: 'delete_offer_image' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
