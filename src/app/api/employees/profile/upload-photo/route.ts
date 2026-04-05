export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import sharp from 'sharp'

export const runtime = 'nodejs'

/**
 * Verify employee authentication
 */
async function verifyEmployee(_request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  // Allow both EMPLOYEE and HR roles to access employee self-service features
  const roleUpper = sessionData.role?.toUpperCase()
  if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
    return { authorized: false, error: 'Forbidden - Employee access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * POST /api/employees/profile/upload-photo
 * Upload employee profile photo to Supabase Storage
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
    if (rateLimitResponse) return rateLimitResponse
    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('photo') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPG, PNG, and WebP are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Convert file to buffer and compress
    const bytes = await file.arrayBuffer()
    const rawBuffer = Buffer.from(bytes)

    // Compress and resize: max 500x500, JPEG at 80% quality
    const buffer = await sharp(rawBuffer)
      .resize(500, 500, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()

    // Generate unique file name (always .jpg after compression)
    const fileName = `${auth.userId}-${Date.now()}.jpg`
    const filePath = `employee-photos/${fileName}`

    // Delete old photo if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (profile?.avatar_url) {
      // Extract file path from URL
      const oldPath = profile.avatar_url.split('/').slice(-2).join('/')
      await supabase.storage.from('profiles').remove([oldPath])
    }

    // Upload compressed image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      logger.error('Error uploading photo to storage', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload photo' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profiles')
      .getPublicUrl(uploadData.path)

    const publicUrl = urlData.publicUrl

    // Update profile with avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', auth.userId)

    if (updateError) {
      logger.error('Error updating profile with avatar URL', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    logger.info('Profile photo uploaded successfully', { userId: auth.userId })

    return NextResponse.json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        url: publicUrl
      }
    })
  } catch (error) {
    logger.error('Error in POST /api/employees/profile/upload-photo', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/profile/upload-photo
 * Delete employee profile photo
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Get current avatar URL
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (!profile?.avatar_url) {
      return NextResponse.json(
        { success: false, error: 'No photo to delete' },
        { status: 404 }
      )
    }

    // Extract file path from URL
    const filePath = profile.avatar_url.split('/').slice(-2).join('/')

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('profiles')
      .remove([filePath])

    if (deleteError) {
      logger.error('Error deleting photo from storage', deleteError)
    }

    // Update profile to remove avatar URL
    await supabase
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', auth.userId)

    logger.info('Profile photo deleted successfully', { userId: auth.userId })

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully'
    })
  } catch (error) {
    logger.error('Error in DELETE /api/employees/profile/upload-photo', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
