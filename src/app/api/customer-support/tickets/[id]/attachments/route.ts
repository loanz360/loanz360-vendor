
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customer-support/tickets/[id]/attachments
 * Upload attachment to a ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting for uploads
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    // Get ticket
    const { data: ticket } = await supabase
      .from('customer_support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Determine user role by checking tables directly
    const { data: attCustomerData } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const isCustomer = !!attCustomerData
    let isEmployee = false

    // Check permissions
    if (isCustomer && ticket.customer_id !== attCustomerData.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const messageId = formData.get('message_id') as string
    const isConfidential = formData.get('is_confidential') === 'true'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${ticketId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const bucketName = 'customer-ticket-attachments'

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      apiLogger.error('Error uploading file', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get uploader name
    let uploaderName = 'Unknown'
    let uploaderType = 'customer'

    if (isCustomer) {
      uploaderName = attCustomerData.full_name
      uploaderType = 'customer'
    } else {
      const { data: employeeData } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (employeeData) {
        isEmployee = true
        uploaderName = employeeData.full_name
        uploaderType = 'employee'
      }
    }

    // Save attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from('customer_ticket_attachments')
      .insert({
        ticket_id: ticketId,
        message_id: messageId || null,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: uploadData.path,
        storage_bucket: bucketName,
        uploaded_by: user.id,
        uploader_type: uploaderType,
        uploader_name: uploaderName,
        is_confidential: isConfidential
      })
      .select()
      .maybeSingle()

    if (attachmentError) {
      // Rollback: delete the uploaded file
      await supabase.storage.from(bucketName).remove([fileName])
      apiLogger.error('Error saving attachment record', attachmentError)
      return NextResponse.json(
        { error: 'Failed to save attachment' },
        { status: 500 }
      )
    }

    // Create activity log
    await supabase.from('customer_ticket_activity_log').insert({
      ticket_id: ticketId,
      action_type: 'attachment_added',
      action_by: user.id,
      action_by_type: uploaderType,
      action_by_name: uploaderName,
      description: `Uploaded attachment: ${file.name}`
    })

    // Get signed URL for the file
    const { data: signedUrlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(uploadData.path, 3600) // 1 hour expiry

    return NextResponse.json({
      success: true,
      attachment: {
        ...attachment,
        signed_url: signedUrlData?.signedUrl
      }
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'uploadCustomerTicketAttachment', ticketId: params.id })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
