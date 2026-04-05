export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/monitoring/logger'
import { CONTEST_UPLOAD_CONFIG } from '@/lib/constants/contest-config'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (superAdminError || !superAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    // Get the form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!CONTEST_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > CONTEST_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      const maxSizeMB = Math.round(CONTEST_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024))
      return NextResponse.json({ success: false, error: `File size must be less than ${maxSizeMB}MB` }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop()
    const filename = `contest-banner-${timestamp}-${randomString}.${extension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CONTEST_UPLOAD_CONFIG.STORAGE_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: CONTEST_UPLOAD_CONFIG.CACHE_CONTROL_SECONDS,
        upsert: false,
      })

    if (uploadError) {
      logger.error('Contest banner upload error', { error: uploadError, userId: user.id })
      return NextResponse.json({ success: false, error: 'Failed to upload image: ' + uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(CONTEST_UPLOAD_CONFIG.STORAGE_BUCKET).getPublicUrl(filename)

    if (!urlData?.publicUrl) {
      logger.error('Failed to get public URL for uploaded image', { filename, userId: user.id })
      return NextResponse.json(
        { error: 'Image uploaded but failed to get public URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      filename: filename,
    })
  } catch (error) {
    logger.error('Contest banner upload failed', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
