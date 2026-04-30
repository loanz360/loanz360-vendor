/**
 * API Route: Individual BA Lead Management
 * GET /api/partners/ba/leads/[id] - Get lead details
 * PUT /api/partners/ba/leads/[id] - Update lead
 * DELETE /api/partners/ba/leads/[id] - Delete lead
 *
 * Rate Limits:
 * - GET: 60 requests per minute (read operation)
 * - PUT/DELETE: 30 requests per minute (write operation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyStatusChange } from '@/lib/notifications/ulap-lead-notifications'
import { apiLogger } from '@/lib/utils/logger'
import type {
  GetLeadResponse,
  UpdateLeadRequest,
  UpdateLeadResponse,
} from '@/types/partner-leads'


interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// ============================================================================
// GET - Get single lead details
// ============================================================================
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { id } = await params

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as GetLeadResponse,
        { status: 401 }
      )
    }

    // 2. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, full_name, partner_type')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as GetLeadResponse,
        { status: 404 }
      )
    }

    // 3. Fetch lead with partner verification
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('partner_id', partner.id) // Ensure lead belongs to this partner
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' } as GetLeadResponse,
        { status: 404 }
      )
    }

    // 4. Fetch referral tracking (optional)
    const { data: tracking } = await supabase
      .from('lead_referral_tracking')
      .select('*')
      .eq('lead_id', id)
      .maybeSingle()

    // 5. Return response with enriched data
    return NextResponse.json({
      success: true,
      data: {
        ...lead,
        referral_tracking: tracking || undefined,
        partner_info: {
          partner_id: partner.partner_id,
          full_name: partner.full_name,
          partner_type: partner.partner_type,
        },
      },
    } as GetLeadResponse)
  } catch (error) {
    apiLogger.error('Get lead error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as GetLeadResponse,
      { status: 500 }
    )
  }
}

// ============================================================================
// PUT - Update lead
// ============================================================================
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { id } = await params

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as UpdateLeadResponse,
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body: UpdateLeadRequest = await request.json()

    // 3. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' } as UpdateLeadResponse,
        { status: 404 }
      )
    }

    // 4. Verify lead ownership (include fields for notification)
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, lead_id, lead_status, customer_name, customer_mobile, customer_email, loan_type, required_loan_amount')
      .eq('id', id)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (checkError || !existingLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found or unauthorized' } as UpdateLeadResponse,
        { status: 404 }
      )
    }

    // 5. Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {}

    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name
    if (body.customer_mobile !== undefined) {
      // Normalize mobile
      let normalized = body.customer_mobile.trim()
      if (!normalized.startsWith('+')) {
        normalized = '+91' + normalized.replace(/^0+/, '')
      }
      updateData.customer_mobile = normalized
    }
    if (body.customer_email !== undefined) updateData.customer_email = body.customer_email
    if (body.customer_city !== undefined) updateData.customer_city = body.customer_city
    if (body.loan_type !== undefined) updateData.loan_type = body.loan_type
    if (body.required_loan_amount !== undefined)
      updateData.required_loan_amount = body.required_loan_amount
    if (body.lead_status !== undefined) updateData.lead_status = body.lead_status
    if (body.lead_priority !== undefined) updateData.lead_priority = body.lead_priority
    if (body.remarks !== undefined) updateData.remarks = body.remarks
    if (body.tags !== undefined) updateData.tags = body.tags

    // 6. Update lead (include partner_id filter to prevent IDOR)
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .eq('partner_id', partner.id)
      .select()
      .maybeSingle()

    if (updateError || !updatedLead) {
      apiLogger.error('Lead update error', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update lead' } as UpdateLeadResponse,
        { status: 500 }
      )
    }

    // 7. Send status change notification if status was updated (non-blocking)
    if (body.lead_status !== undefined && existingLead.lead_status !== body.lead_status) {
      notifyStatusChange(
        id,
        existingLead.lead_id || id,
        existingLead.customer_name || '',
        existingLead.customer_mobile || '',
        existingLead.customer_email || undefined,
        existingLead.loan_type || 'Not Specified',
        existingLead.required_loan_amount || 0,
        existingLead.lead_status || '',
        body.lead_status,
        partner.id
      ).catch(error => {
        apiLogger.error('Failed to send status change notification', error)
      })
    }

    // 8. Return response
    return NextResponse.json({
      success: true,
      data: updatedLead as any,
    } as UpdateLeadResponse)
  } catch (error) {
    apiLogger.error('Update lead error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as UpdateLeadResponse,
      { status: 500 }
    )
  }
}

// ============================================================================
// DELETE - Delete lead
// ============================================================================
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Apply rate limiting (ADDED)
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { id } = await params

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get partner information
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // 3. Delete lead (RLS will ensure ownership)
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('partner_id', partner.id)

    if (deleteError) {
      apiLogger.error('Lead delete error', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete lead' }, { status: 500 })
    }

    // 4. Return success
    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Delete lead error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
