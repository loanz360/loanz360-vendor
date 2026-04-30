import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/emi-inquiries/[inquiryId]
 * Get a specific inquiry with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inquiryId } = params

    // Get the inquiry
    const { data: inquiry, error: fetchError } = await supabase
      .from('customer_emi_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .eq('created_by_employee_id', user.id)
      .maybeSingle()

    if (fetchError || !inquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found or access denied' },
        { status: 404 }
      )
    }

    // Get related shares
    const { data: shares } = await supabase
      .from('inquiry_shares')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: false })

    // Get related follow-ups
    const { data: followUps } = await supabase
      .from('inquiry_follow_ups')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: false })

    // Get audit trail
    const { data: auditLog } = await supabase
      .from('inquiry_audit_log')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      success: true,
      inquiry,
      shares: shares || [],
      follow_ups: followUps || [],
      audit_log: auditLog || []
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/emi-inquiries/[inquiryId]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/emi-inquiries/[inquiryId]
 * Update an inquiry
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inquiryId } = params
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr

    // Verify the inquiry belongs to the user
    const { data: existingInquiry, error: fetchError } = await supabase
      .from('customer_emi_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .eq('created_by_employee_id', user.id)
      .maybeSingle()

    if (fetchError || !existingInquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found or access denied' },
        { status: 404 }
      )
    }

    // Fields that can be updated
    const allowedFields = [
      'customer_name',
      'customer_email',
      'customer_phone',
      'customer_requirements',
      'customer_concerns',
      'internal_notes',
      'status',
      'next_follow_up_date',
      'follow_up_priority',
      'hot_lead',
      'tags',
      'customer_income_range',
      'customer_credit_score_range',
      'customer_feedback',
      'competitor_rate_offered',
      'competitor_name',
      'estimated_commission',
      'probability_score',
      'lost_reason'
    ]

    // Filter only allowed fields from body
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update the inquiry
    const { data: updatedInquiry, error: updateError } = await supabase
      .from('customer_emi_inquiries')
      .update(updateData)
      .eq('id', inquiryId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating inquiry', updateError)
      return NextResponse.json(
        { error: 'Failed to update inquiry' },
        { status: 500 }
      )
    }

    // Log audit trail
    await supabase
      .from('inquiry_audit_log')
      .insert({
        inquiry_id: inquiryId,
        action_type: 'updated',
        action_by_employee_id: user.id,
        action_metadata: {
          updated_fields: Object.keys(updateData),
          status_changed: updateData.status !== undefined
        }
      })

    return NextResponse.json({
      success: true,
      inquiry: updatedInquiry
    })

  } catch (error) {
    apiLogger.error('Error in PATCH /api/emi-inquiries/[inquiryId]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/emi-inquiries/[inquiryId]
 * Archive/soft delete an inquiry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { inquiryId: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { inquiryId } = params

    // Verify the inquiry belongs to the user
    const { data: inquiry, error: fetchError } = await supabase
      .from('customer_emi_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .eq('created_by_employee_id', user.id)
      .maybeSingle()

    if (fetchError || !inquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found or access denied' },
        { status: 404 }
      )
    }

    // Don't allow deletion of converted inquiries
    if (inquiry.loan_application_id) {
      return NextResponse.json(
        { error: 'Cannot delete inquiry linked to a loan application' },
        { status: 400 }
      )
    }

    // Soft delete (archive)
    const { error: deleteError } = await supabase
      .from('customer_emi_inquiries')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', inquiryId)

    if (deleteError) {
      apiLogger.error('Error archiving inquiry', deleteError)
      return NextResponse.json(
        { error: 'Failed to archive inquiry' },
        { status: 500 }
      )
    }

    // Log audit trail
    await supabase
      .from('inquiry_audit_log')
      .insert({
        inquiry_id: inquiryId,
        action_type: 'archived',
        action_by_employee_id: user.id
      })

    return NextResponse.json({
      success: true,
      message: 'Inquiry archived successfully'
    })

  } catch (error) {
    apiLogger.error('Error in DELETE /api/emi-inquiries/[inquiryId]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
