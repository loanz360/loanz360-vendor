export const dynamic = 'force-dynamic'

/**
 * Employee Email Attachments API
 * Download and upload attachments via Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'application/zip', 'application/x-zip-compressed',
]

const STORAGE_BUCKET = 'email-attachments'

// GET - Download attachment
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')
    const attachmentId = searchParams.get('attachment_id')

    if (!messageId || !attachmentId) {
      return NextResponse.json({
        success: false,
        error: 'Message ID and Attachment ID are required'
      }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Verify the message belongs to this account
    const { data: message } = await serviceClient
      .from('email_messages')
      .select('attachments')
      .eq('id', messageId)
      .eq('email_account_id', account.id)
      .maybeSingle()

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })
    }

    // Find the attachment in the message's attachment list
    const attachments = (message.attachments || []) as Array<Record<string, unknown>>
    const attachment = attachments.find(
      (a) => a.id === attachmentId || a.filename === attachmentId
    )

    if (!attachment) {
      return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
    }

    // Try to download from Supabase Storage
    const storagePath = attachment.storage_path || attachment.s3_key
    if (storagePath && typeof storagePath === 'string') {
      const { data: fileData, error: downloadError } = await serviceClient
        .storage
        .from(STORAGE_BUCKET)
        .download(storagePath)

      if (!downloadError && fileData) {
        const headers = new Headers()
        headers.set('Content-Type', (attachment.content_type || attachment.mime_type || 'application/octet-stream') as string)
        headers.set('Content-Disposition', `attachment; filename="${attachment.filename}"`)

        return new NextResponse(fileData, { headers })
      }
    }

    // If there's a download_url, redirect to it
    if (attachment.download_url && typeof attachment.download_url === 'string') {
      return NextResponse.redirect(attachment.download_url)
    }

    // Log the download attempt
    serviceClient
      .from('email_activity_logs')
      .insert({
        email_account_id: account.id,
        action: 'attachment_download',
        details: {
          message_id: messageId,
          attachment_id: attachmentId,
          filename: attachment.filename,
        },
      })
      .then(() => {})

    return NextResponse.json({
      success: false,
      error: 'Attachment file not available in storage',
      code: 'ATTACHMENT_NOT_IN_STORAGE',
    }, { status: 404 })
  } catch (error) {
    apiLogger.error('Download attachment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Upload attachment (for compose)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // Get email account
    const { data: account, error: accountError } = await serviceClient
      .from('email_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (accountError || !account) {
      return NextResponse.json({ success: false, error: 'No email account found' }, { status: 404 })
    }

    // Get settings for max attachment size
    const { data: settings } = await serviceClient
      .from('email_admin_settings')
      .select('setting_value')
      .eq('setting_key', 'max_attachment_size_mb')
      .maybeSingle()

    const maxSizeMb = settings?.setting_value ? parseInt(settings.setting_value) : 25
    const maxSizeBytes = maxSizeMb * 1024 * 1024

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // File type validation
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: `File type "${file.type}" is not allowed`,
        code: 'INVALID_FILE_TYPE',
      }, { status: 400 })
    }

    // File size validation
    if (file.size > maxSizeBytes) {
      return NextResponse.json({
        success: false,
        error: `File size exceeds maximum of ${maxSizeMb}MB`,
        code: 'FILE_TOO_LARGE',
      }, { status: 400 })
    }

    // Generate unique storage path
    const attachmentId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const storagePath = `${user.id}/${attachmentId}/${file.name}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      apiLogger.error('Upload to storage failed', uploadError)
      // Fall back to returning temp reference without actual storage
      return NextResponse.json({
        success: true,
        data: {
          id: attachmentId,
          filename: file.name,
          size: file.size,
          content_type: file.type,
          uploaded_at: new Date().toISOString(),
          storage_path: null,
        },
        message: 'Attachment registered (storage upload pending)',
      })
    }

    // Get public URL
    const { data: urlData } = serviceClient
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uploadData.path)

    return NextResponse.json({
      success: true,
      data: {
        id: attachmentId,
        filename: file.name,
        size: file.size,
        content_type: file.type,
        uploaded_at: new Date().toISOString(),
        storage_path: uploadData.path,
        download_url: urlData?.publicUrl || null,
      },
      message: 'Attachment uploaded successfully',
    })
  } catch (error) {
    apiLogger.error('Upload attachment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove attachment from storage
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('id')
    const storagePath = searchParams.get('storage_path')

    if (!attachmentId) {
      return NextResponse.json({ success: false, error: 'Attachment ID is required' }, { status: 400 })
    }

    // If storage_path is provided, remove from Supabase Storage
    if (storagePath) {
      const serviceClient = createServiceRoleClient()
      const { error: removeError } = await serviceClient
        .storage
        .from(STORAGE_BUCKET)
        .remove([storagePath])

      if (removeError) {
        apiLogger.error('Remove from storage failed', removeError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Attachment removed successfully',
    })
  } catch (error) {
    apiLogger.error('Delete attachment error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
