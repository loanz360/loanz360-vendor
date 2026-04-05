export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { CONTEST_UPLOAD_CONFIG } from '@/lib/constants/contest-config'

// Use centralized config for file upload settings
const MAX_FILE_SIZE = CONTEST_UPLOAD_CONFIG.MAX_FILE_SIZE
const ALLOWED_MIME_TYPES = [...CONTEST_UPLOAD_CONFIG.ALLOWED_MIME_TYPES, 'image/gif']
const STORAGE_BUCKET = CONTEST_UPLOAD_CONFIG.STORAGE_BUCKET

/**
 * POST /api/contests/upload-image
 * Upload contest image to Supabase Storage
 * Access: Users with CONTEST_CREATE or CONTEST_UPDATE permission
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_CREATE)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'contests'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', message: 'Please provide a file to upload' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `Only images are allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const adminSupabase = createSupabaseAdmin()
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      logger.error('Error uploading to Supabase Storage', uploadError)
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = adminSupabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName)

    if (!urlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image')
    }

    logger.info(`Image uploaded successfully: ${fileName} by ${user.id}`)

    return NextResponse.json({
      success: true,
      data: {
        fileName: uploadData.path,
        fileSize: file.size,
        mimeType: file.type,
        publicUrl: urlData.publicUrl,
      },
      message: 'Image uploaded successfully',
    })
  } catch (error) {
    logger.error('Error in POST /api/contests/upload-image', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'uploadContestImage' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to upload image',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * DELETE /api/contests/upload-image
 * Delete contest image from Supabase Storage
 * Access: Users with CONTEST_DELETE permission
 */
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_DELETE)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    // Get file path from query params
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('filePath')

    if (!filePath) {
      return NextResponse.json(
        { error: 'No file path provided', message: 'Please provide filePath parameter' },
        { status: 400 }
      )
    }

    // Delete from Supabase Storage
    const adminSupabase = createSupabaseAdmin()
    const { error: deleteError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])

    if (deleteError) {
      logger.error('Error deleting from Supabase Storage', deleteError)
      throw new Error(`Failed to delete image: ${deleteError.message}`)
    }

    logger.info(`Image deleted successfully: ${filePath} by ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    })
  } catch (error) {
    logger.error('Error in DELETE /api/contests/upload-image', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'deleteContestImage' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to delete image',
      message: errorMessage,
    }, { status: 500 })
  }
}
