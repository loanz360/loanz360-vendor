import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { maskRecord, shouldMaskForRole } from '@/lib/utils/data-masking'
import { CONTACT_STATUSES } from '@/lib/constants/sales-pipeline'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const { id } = await params

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Fetch contact
    const { data: contact, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      apiLogger.error('Error fetching contact', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch contact' },
        { status: 500 }
      )
    }

    if (!contact) {
      return NextResponse.json(
        { success: false, message: 'Contact not found' },
        { status: 404 }
      )
    }

    // Verify CRO has access to this contact
    if (contact.assigned_to_cro !== user.id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    // Mask PII based on user role
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || 'CRO'
    const maskedContact = maskRecord(contact as Record<string, unknown>, shouldMaskForRole(userRole))

    return NextResponse.json({ success: true, data: maskedContact })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Parse body with try-catch for malformed JSON
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { status, reason } = body as { status?: string; reason?: string }

    if (!status) {
      return NextResponse.json(
        { success: false, message: 'Status is required' },
        { status: 400 }
      )
    }

    // Validate status against allowed values
    if (!(CONTACT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { success: false, message: `Invalid status. Allowed: ${CONTACT_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    // Add reason if status is negative (not_interested, wrong_number)
    if (['not_interested', 'wrong_number'].includes(status) && reason) {
      updateData.status_reason = reason
    }

    // Update contact status
    const { data: updatedRows, error } = await supabase
      .from('crm_contacts')
      .update(updateData)
      .eq('id', id)
      .eq('assigned_to_cro', user.id)
      .select('id')

    if (error) {
      apiLogger.error('Error updating contact status', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update status' },
        { status: 500 }
      )
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Contact not found or not assigned to you' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Status updated successfully' })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'update_status' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
