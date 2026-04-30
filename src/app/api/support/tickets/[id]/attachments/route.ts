
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/support/tickets/[id]/attachments
 * Get all attachments for a ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params

    // Get ticket to verify access
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('employee_id')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Get employee profile to check role
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = employee?.role === 'super_admin'

    // Check access: ticket owner, HR, or Super Admin
    if (ticket.employee_id !== user.id && !isHR && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get all attachments for this ticket
    const { data: attachments, error: attachmentsError } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (attachmentsError) {
      apiLogger.error('Error fetching attachments', attachmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      )
    }

    return NextResponse.json({ attachments })
  } catch (error) {
    apiLogger.error('Error in GET /api/support/tickets/[id]/attachments', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/support/tickets/[id]/attachments
 * Upload attachment(s) for a ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: ticketId } = await params

    // Get ticket to verify access
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('employee_id')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Get employee profile to check role
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = employee?.role === 'super_admin'

    // Check access: ticket owner, HR, or Super Admin
    if (ticket.employee_id !== user.id && !isHR && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const messageId = formData.get('message_id') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 })
    }

    // Determine uploader type
    let uploaderType: 'employee' | 'hr' | 'super_admin' = 'employee'
    if (isSuperAdmin) {
      uploaderType = 'super_admin'
    } else if (isHR) {
      uploaderType = 'hr'
    }

    const uploadedAttachments = []

    // Upload each file
    for (const file of files) {
      // Validate file
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        )
      }

      // Generate unique file name
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const fileExt = file.name.split('.').pop()
      const uniqueFileName = `${ticketId}/${timestamp}-${randomStr}.${fileExt}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('support-ticket-attachments')
        .upload(uniqueFileName, file, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) {
        apiLogger.error('Error uploading file', uploadError)
        return NextResponse.json(
          { error: `Failed to upload file ${file.name}` },
          { status: 500 }
        )
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('support-ticket-attachments')
        .getPublicUrl(uniqueFileName)

      // Insert attachment record
      const { data: attachment, error: insertError } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          message_id: messageId || null,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
          uploaded_by_type: uploaderType
        })
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Error inserting attachment record', insertError)
        // Try to delete the uploaded file
        await supabase.storage
          .from('support-ticket-attachments')
          .remove([uniqueFileName])

        return NextResponse.json(
          { error: `Failed to save attachment ${file.name}` },
          { status: 500 }
        )
      }

      uploadedAttachments.push(attachment)
    }

    return NextResponse.json({ attachments: uploadedAttachments })
  } catch (error) {
    apiLogger.error('Error in POST /api/support/tickets/[id]/attachments', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/support/tickets/[id]/attachments
 * Delete an attachment
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachment_id')

    if (!attachmentId) {
      return NextResponse.json({ success: false, error: 'Attachment ID required' }, { status: 400 })
    }

    // Get attachment to verify access
    const { data: attachment, error: attachmentError } = await supabase
      .from('ticket_attachments')
      .select('*, support_tickets!inner(employee_id)')
      .eq('id', attachmentId)
      .maybeSingle()

    if (attachmentError || !attachment) {
      return NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
    }

    // Get employee profile to check role
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isHR = employee?.role === 'hr' || employee?.role === 'HR'
    const isSuperAdmin = employee?.role === 'super_admin'

    // Check access: uploader, ticket owner, HR, or Super Admin
    const ticket = (attachment as unknown).support_tickets
    if (
      attachment.uploaded_by !== user.id &&
      ticket.employee_id !== user.id &&
      !isHR &&
      !isSuperAdmin
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Extract file path from URL
    const urlParts = attachment.file_url.split('support-ticket-attachments/')
    const filePath = urlParts[urlParts.length - 1]

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('support-ticket-attachments')
      .remove([filePath])

    if (storageError) {
      apiLogger.error('Error deleting file from storage', storageError)
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('ticket_attachments')
      .delete()
      .eq('id', attachmentId)

    if (deleteError) {
      apiLogger.error('Error deleting attachment record', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/support/tickets/[id]/attachments', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
