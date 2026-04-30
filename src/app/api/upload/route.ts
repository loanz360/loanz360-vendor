
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  // Apply rate limiting
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
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate image dimensions (must be 1200x300)
    try {
      const metadata = await sharp(buffer).metadata()

      if (metadata.width !== 1200 || metadata.height !== 300) {
        return NextResponse.json(
          {
            error: `Invalid image dimensions. Expected 1200x300, got ${metadata.width}x${metadata.height}. Please resize your image to exactly 1200x300 pixels.`
          },
          { status: 400 }
        )
      }
    } catch (error) {
      apiLogger.error('Error validating image dimensions', error)
    logApiError(error as Error, request, { action: 'post' })
      return NextResponse.json(
        { error: 'Failed to validate image. Please ensure it is a valid image file.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const filename = `banner-upload-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `banners/${filename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('public')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      apiLogger.error('Upload error', error)
      throw new Error('Failed to upload file')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('public')
      .getPublicUrl(filePath)

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
      success: true
    })

  } catch (error: unknown) {
    apiLogger.error('Error uploading file', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
