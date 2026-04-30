import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

const createApplicationSchema = z.object({
  application_number: z.string().min(1, 'Application number is required').max(50),
  customer_name: z.string().min(1, 'Customer name is required').max(100),
  customer_mobile: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid mobile number').optional().or(z.literal('')),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
  loan_amount_disbursed: z.number().positive('Loan amount must be a positive number'),
  bank_name: z.string().min(1, 'Bank name is required').max(100),
  loan_type: z.string().min(1, 'Loan type is required').max(100),
  disbursement_date: z.string().min(1, 'Disbursement date is required'),
  notes: z.string().max(500).optional(),
})

/**
 * GET /api/partners/cp/applications
 * Fetches all applications for the authenticated Channel Partner
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('cp_applications')
      .select('*', { count: 'exact' })
      .eq('cp_user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply status filter if provided
    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: applications, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching CP applications', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Get statistics
    const { data: stats } = await supabase
      .rpc('get_cp_application_stats', { user_id_param: user.id })

    return NextResponse.json({
      success: true,
      applications: applications || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      stats: stats?.[0] || {
        total_applications: 0,
        pending_count: 0,
        approved_count: 0,
        rejected_count: 0,
        payout_processed_count: 0,
        total_loan_amount: 0,
        total_expected_payout: 0,
        total_processed_payout: 0
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/cp/applications', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/cp/applications
 * Creates a new application for the authenticated Channel Partner
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const rawBody = await request.json()
    const validation = createApplicationSchema.safeParse(rawBody)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }
    const body = validation.data
    const loanAmount = body.loan_amount_disbursed

    // Get partner ID if available
    const { data: partner } = await supabase
      .from('partners')
      .select('partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    // Priority 1: Check CP lender association for bank-specific rate
    let expectedPayoutPercentage: number | null = null
    let rateSource: string | null = null

    if (partner?.partner_id) {
      const { data: lenderAssoc } = await supabase
        .from('cp_lender_associations')
        .select('payout_percentage, payout_model')
        .eq('partner_id', partner.partner_id)
        .ilike('lender_name', body.bank_name)
        .eq('code_status', 'ACTIVE')
        .limit(1)
        .maybeSingle()

      if (lenderAssoc?.payout_percentage && lenderAssoc.payout_model === 'PERCENTAGE') {
        expectedPayoutPercentage = lenderAssoc.payout_percentage
        rateSource = 'lender_association'
      }
    }

    // Priority 2: Fall back to payout grid (payout_cp_percentages)
    if (!expectedPayoutPercentage) {
      const { data: payoutData } = await supabase
        .from('payout_cp_percentages')
        .select('cp_commission_percentage')
        .ilike('bank_name', body.bank_name)
        .ilike('loan_type', body.loan_type)
        .limit(1)
        .maybeSingle()

      if (payoutData?.cp_commission_percentage) {
        expectedPayoutPercentage = payoutData.cp_commission_percentage
        rateSource = 'payout_grid'
      }
    }

    const expectedPayoutAmount = expectedPayoutPercentage
      ? Math.round((loanAmount * expectedPayoutPercentage / 100) * 100) / 100
      : null

    // Create application
    const applicationData = {
      cp_user_id: user.id,
      cp_partner_id: partner?.partner_id || null,
      application_number: body.application_number.trim(),
      customer_name: body.customer_name.trim(),
      customer_mobile: body.customer_mobile?.trim() || null,
      customer_email: body.customer_email?.trim() || null,
      loan_amount_disbursed: loanAmount,
      bank_name: body.bank_name.trim(),
      loan_type: body.loan_type.trim(),
      disbursement_date: body.disbursement_date,
      expected_payout_percentage: expectedPayoutPercentage,
      expected_payout_amount: expectedPayoutAmount,
      notes: body.notes?.trim() || null,
      supporting_document_url: body.supporting_document_url || null,
      status: 'PENDING'
    }

    const { data: application, error } = await supabase
      .from('cp_applications')
      .insert(applicationData)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating CP application', error)

      // Check for duplicate application number
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An application with this number already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to create application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      application
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/partners/cp/applications', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/cp/applications
 * Updates an existing application
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Application ID is required' },
        { status: 400 }
      )
    }

    // Check if application exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('cp_applications')
      .select('id, status, cp_user_id, bank_name, loan_type')
      .eq('id', body.id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (existing.cp_user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only update your own applications' },
        { status: 403 }
      )
    }

    // Check if application can be edited (only PENDING or REJECTED)
    if (!['PENDING', 'REJECTED'].includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: 'Only pending or rejected applications can be edited' },
        { status: 400 }
      )
    }

    // Validate loan amount if provided
    let loanAmount = body.loan_amount_disbursed
    if (loanAmount !== undefined) {
      loanAmount = parseFloat(loanAmount)
      if (isNaN(loanAmount) || loanAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Loan amount must be a positive number' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // Only include fields that are provided
    if (body.application_number) updateData.application_number = body.application_number.trim()
    if (body.customer_name) updateData.customer_name = body.customer_name.trim()
    if (body.customer_mobile !== undefined) updateData.customer_mobile = body.customer_mobile?.trim() || null
    if (body.customer_email !== undefined) updateData.customer_email = body.customer_email?.trim() || null
    if (loanAmount) updateData.loan_amount_disbursed = loanAmount
    if (body.bank_name) updateData.bank_name = body.bank_name.trim()
    if (body.loan_type) updateData.loan_type = body.loan_type.trim()
    if (body.disbursement_date) updateData.disbursement_date = body.disbursement_date
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null
    if (body.supporting_document_url !== undefined) updateData.supporting_document_url = body.supporting_document_url || null

    // If resubmitting a rejected application, reset status to PENDING
    if (existing.status === 'REJECTED') {
      updateData.status = 'PENDING'
      updateData.status_reason = null
    }

    // Recalculate payout if bank/loan_type/amount changed
    if (body.bank_name || body.loan_type || loanAmount) {
      const bankName = body.bank_name || existing.bank_name
      const loanType = body.loan_type || existing.loan_type

      // Priority 1: Check lender association rate
      let recalcRate: number | null = null

      if (partner?.partner_id) {
        const { data: lenderAssoc } = await supabase
          .from('cp_lender_associations')
          .select('payout_percentage, payout_model')
          .eq('partner_id', partner.partner_id)
          .ilike('lender_name', bankName)
          .eq('code_status', 'ACTIVE')
          .limit(1)
          .maybeSingle()

        if (lenderAssoc?.payout_percentage && lenderAssoc.payout_model === 'PERCENTAGE') {
          recalcRate = lenderAssoc.payout_percentage
        }
      }

      // Priority 2: Fall back to payout grid
      if (!recalcRate) {
        const { data: payoutData } = await supabase
          .from('payout_cp_percentages')
          .select('cp_commission_percentage')
          .ilike('bank_name', bankName)
          .ilike('loan_type', loanType)
          .limit(1)
          .maybeSingle()

        if (payoutData?.cp_commission_percentage) {
          recalcRate = payoutData.cp_commission_percentage
        }
      }

      if (recalcRate && loanAmount) {
        updateData.expected_payout_percentage = recalcRate
        updateData.expected_payout_amount = Math.round((loanAmount * recalcRate / 100) * 100) / 100
      }
    }

    // Update application
    const { data: application, error } = await supabase
      .from('cp_applications')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating CP application', error)

      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'An application with this number already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Failed to update application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Application updated successfully',
      application
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/partners/cp/applications', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/partners/cp/applications
 * Deletes an application (only PENDING status)
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get application ID from query params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Application ID is required' },
        { status: 400 }
      )
    }

    // Check if application exists, belongs to user, and is PENDING
    const { data: existing, error: fetchError } = await supabase
      .from('cp_applications')
      .select('id, status, cp_user_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    if (existing.cp_user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own applications' },
        { status: 403 }
      )
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Only pending applications can be deleted' },
        { status: 400 }
      )
    }

    // Delete application
    const { error } = await supabase
      .from('cp_applications')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting CP application', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Application deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/partners/cp/applications', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
