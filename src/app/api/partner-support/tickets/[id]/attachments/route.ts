
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partner-support/tickets/[id]/attachments
 * Fetch all attachments for a ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('partner_support_ticket_attachments')
      .select('*, uploaded_by_user:users!uploaded_by(id, full_name, email)')
      .eq('ticket_id', id)
      .order('uploaded_at', { ascending: false })

    if (attachmentsError) {
      apiLogger.error('Error fetching attachments', attachmentsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch attachments' }, { status: 500 })
    }

    return NextResponse.json({ attachments: attachments || [] }, { status: 200 })

  } catch (error) {
    apiLogger.error('Attachments fetch error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * POST /api/partner-support/tickets/[id]/attachments
 * Upload attachment to a ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const messageId = formData.get('message_id') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: 'File too large. Maximum size is 10MB'
      }, { status: 400 })
    }

    // Validate file type (allow common document and image types)
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'File type not allowed. Allowed types: images, PDF, Word, Excel, text files'
      }, { status: 400 })
    }

    // Verify ticket exists and user has access
    const { data: ticket, error: ticketError } = await supabase
      .from('partner_support_tickets')
      .select('id, partner_id')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Check if user is partner owner or employee
    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isEmployee = userData?.role && ['EMPLOYEE', 'SUPER_ADMIN'].includes(userData.role)
    const isOwner = ticket.partner_id === user.id

    if (!isEmployee && !isOwner) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Generate unique file name
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const uniqueFileName = `${ticketId}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Upload to Supabase storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('partner-support-attachments')
      .upload(uniqueFileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      apiLogger.error('Storage upload error', uploadError)
      return NextResponse.json({ success: false, error: 'Failed to upload file',
      }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('partner-support-attachments')
      .getPublicUrl(uniqueFileName)

    // Save attachment record to database
    const { data: attachment, error: dbError } = await supabase
      .from('partner_support_ticket_attachments')
      .insert({
        ticket_id: ticketId,
        message_id: messageId || null,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: urlData.publicUrl,
        storage_path: uniqueFileName,
        uploaded_by: user.id,
      })
      .select('*, uploaded_by_user:users!uploaded_by(id, full_name, email)')
      .maybeSingle()

    if (dbError) {
      apiLogger.error('Database insert error', dbError)
      // Try to delete uploaded file if database insert fails
      await supabase.storage
        .from('partner-support-attachments')
        .remove([uniqueFileName])

      return NextResponse.json({ success: false, error: 'Failed to save attachment record',
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'File uploaded successfully',
      attachment
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Attachment upload error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * DELETE /api/partner-support/tickets/[id]/attachments
 * Delete an attachment (Super Admin only)
 * Query params: attachment_id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachment_id')

    if (!attachmentId) {
      return NextResponse.json({ success: false, error: 'Attachment ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication and Super Admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    // Get attachment details
    const { data: attachment, error: fetchError } = await supabase
      .from('partner_support_ticket_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .eq('ticket_id', ticketId)
      .maybeSingle()

    if (fetchError || !attachment) {
      return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('partner-support-attachments')
      .remove([attachment.storage_path])

    if (storageError) {
      apiLogger.error('Storage delete error', storageError)
    }

    // Delete from database (RLS will handle this automatically)
    const { error: dbError } = await supabase
      .from('partner_support_ticket_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('ticket_id', ticketId)

    if (dbError) {
      apiLogger.error('Database delete error', dbError)
      return NextResponse.json({ success: false, error: 'Failed to delete attachment',
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Attachment deleted successfully'
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Attachment delete error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error',
    }, { status: 500 })
  }
}
