export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/notifications/upload/attachment
 * Upload notification attachment to Supabase Storage
 *
 * Body: FormData with 'file' field
 * - Accepts: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP, TXT, CSV
 * - Max size: 10MB
 *
 * Returns: { name, url, path, size, type }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/zip',
      'application/x-zip-compressed',
      'text/plain', // .txt
      'text/csv' // .csv
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ZIP, TXT, CSV' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 10MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      )
    }

    // Sanitize filename
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileExt = originalName.split('.').pop()
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage (private bucket)
    const { data, error } = await supabase.storage
      .from('notification-attachments')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      apiLogger.error('Upload error', error)
      return NextResponse.json(
        { error: 'Failed to upload attachment' },
        { status: 500 }
      )
    }

    // Get signed URL (valid for 1 year for private bucket)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('notification-attachments')
      .createSignedUrl(fileName, 31536000) // 1 year in seconds

    if (urlError) {
      apiLogger.error('Signed URL error', urlError)
      return NextResponse.json(
        { error: 'Failed to generate file URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Attachment uploaded successfully',
      name: originalName,
      url: signedUrlData.signedUrl,
      path: data.path,
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString()
    })
  } catch (error: unknown) {
    apiLogger.error('Unexpected error uploading attachment', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/upload/attachment
 * Delete uploaded attachment from storage
 *
 * Body: { path: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { path } = await request.json()

    if (!path) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    // Delete from storage
    const { error } = await supabase.storage
      .from('notification-attachments')
      .remove([path])

    if (error) {
      apiLogger.error('Delete error', error)
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Attachment deleted successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Unexpected error deleting attachment', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
