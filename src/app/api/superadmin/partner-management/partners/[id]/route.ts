import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter, writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { logPartnerUpdated, sanitizeForAudit } from '@/lib/audit/audit-logger'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/superadmin/partner-management/partners/[id]
 * Fetch detailed partner profile information
 *
 * Rate Limit: 60 requests per minute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return readRateLimiter(request, async (req) => {
    return await getPartnerDetailsHandler(req, id)
  })
}

async function getPartnerDetailsHandler(
  request: NextRequest,
  partnerId: string
) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Fetch partner details
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      )
    }

    // Fetch login history (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: loginHistory, error: loginError } = await supabase
      .from('partner_login_history')
      .select('*')
      .eq('partner_id', partnerId)
      .gte('login_timestamp', thirtyDaysAgo.toISOString())
      .order('login_timestamp', { ascending: false })
      .limit(50)

    // Fetch leads data
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Fetch commission disbursements
    const { data: disbursements, error: disbursementsError } = await supabase
      .from('partner_commission_disbursements')
      .select('*')
      .eq('partner_id', partnerId)
      .order('disbursement_date', { ascending: false })

    // Calculate month-wise performance
    const monthWisePerformance: Record<string, unknown> = {}

    leads?.forEach((lead: unknown) => {
      const month = new Date(lead.created_at).toISOString().slice(0, 7) // YYYY-MM
      if (!monthWisePerformance[month]) {
        monthWisePerformance[month] = {
          month,
          total_leads: 0,
          in_progress: 0,
          sanctioned: 0,
          dropped: 0,
          logins: 0
        }
      }
      monthWisePerformance[month].total_leads += 1
      if (lead.status === 'in_progress') monthWisePerformance[month].in_progress += 1
      if (lead.status === 'sanctioned') monthWisePerformance[month].sanctioned += 1
      if (lead.status === 'dropped') monthWisePerformance[month].dropped += 1
    })

    loginHistory?.forEach((login: unknown) => {
      const month = new Date(login.login_timestamp).toISOString().slice(0, 7)
      if (monthWisePerformance[month]) {
        monthWisePerformance[month].logins += 1
      }
    })

    const monthWiseData = Object.values(monthWisePerformance).sort((a: unknown, b: unknown) =>
      b.month.localeCompare(a.month)
    )

    // Format profile data
    const profileData = {
      basic_details: {
        id: partner.id,
        partner_id: partner.partner_id,
        full_name: partner.full_name,
        mobile_number: partner.mobile_number,
        work_email: partner.work_email,
        personal_email: partner.personal_email,
        partner_type: partner.partner_type,
        status: partner.status,
        present_address: partner.present_address,
        city: partner.city,
        state: partner.state,
        pincode: partner.pincode,
        address_proof_url: partner.address_proof_url,
        address_proof_type: partner.address_proof_type,
        joining_date: partner.joining_date,
        registration_source: partner.registration_source
      },
      performance_insights: {
        total_logins: partner.total_logins || 0,
        last_login_at: partner.last_login_at,
        total_leads: partner.total_leads || 0,
        leads_in_progress: partner.leads_in_progress || 0,
        leads_sanctioned: partner.leads_sanctioned || 0,
        leads_dropped: partner.leads_dropped || 0,
        conversion_rate: partner.total_leads > 0
          ? ((partner.leads_sanctioned / partner.total_leads) * 100).toFixed(2)
          : '0.00'
      },
      commission_details: {
        lifetime_earnings: parseFloat(partner.lifetime_earnings || 0).toFixed(2),
        estimated_payout: parseFloat(partner.estimated_payout || 0).toFixed(2),
        actual_payout: parseFloat(partner.actual_payout || 0).toFixed(2),
        disbursements: disbursements?.map((d: Record<string, unknown>) => ({
          id: d.id,
          disbursement_number: d.disbursement_number,
          amount: parseFloat(d.amount).toFixed(2),
          disbursement_date: d.disbursement_date,
          month: d.month,
          year: d.year,
          payment_status: d.payment_status,
          payment_method: d.payment_method,
          payment_reference: d.payment_reference
        })) || []
      },
      month_wise_performance: monthWiseData,
      recent_activity: {
        recent_logins: loginHistory?.slice(0, 10).map((l: unknown) => ({
          login_timestamp: l.login_timestamp,
          logout_timestamp: l.logout_timestamp,
          session_duration_minutes: l.session_duration_minutes,
          ip_address: l.ip_address
        })) || [],
        recent_leads: leads?.slice(0, 10).map((l: unknown) => ({
          id: l.id,
          lead_number: l.lead_number,
          customer_name: l.customer_name,
          loan_type: l.loan_type,
          loan_amount: parseFloat(l.loan_amount).toFixed(2),
          status: l.status,
          created_at: l.created_at
        })) || []
      }
    }

    return NextResponse.json({
      success: true,
      data: profileData
    })

  } catch (error) {
    apiLogger.error('Partner profile API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/partner-management/partners/[id]
 * Update partner information
 *
 * Rate Limit: 30 requests per minute
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return writeRateLimiter(request, async (req) => {
    return await updatePartnerHandler(req, id)
  })
}

async function updatePartnerHandler(
  request: NextRequest,
  partnerId: string
) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      full_name: z.string().optional(),


      mobile_number: z.string().min(10).optional(),


      work_email: z.string().email().optional(),


      personal_email: z.string().email().optional(),


      present_address: z.string().optional(),


      city: z.string().optional(),


      state: z.string().optional(),


      pincode: z.string().optional(),


      status: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Fetch current partner data for audit trail
    const { data: oldPartner, error: fetchError } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle()

    if (fetchError || !oldPartner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      )
    }

    // Extract updatable fields
    const {
      full_name,
      mobile_number,
      work_email,
      personal_email,
      present_address,
      city,
      state,
      pincode,
      status
    } = body

    // Validate email format if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (work_email && !emailRegex.test(work_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid work email format' },
        { status: 400 }
      )
    }

    if (personal_email && personal_email.trim() && !emailRegex.test(personal_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid personal email format' },
        { status: 400 }
      )
    }

    // Validate mobile number format (10 digits, starts with 6-9)
    const mobileRegex = /^[6-9]\d{9}$/
    if (mobile_number && !mobileRegex.test(mobile_number)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number format. Must be 10 digits starting with 6-9' },
        { status: 400 }
      )
    }

    // Validate pincode if provided
    if (pincode && pincode.trim() && !/^\d{6}$/.test(pincode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid pincode format. Must be 6 digits' },
        { status: 400 }
      )
    }

    // Validate status if provided
    const validStatuses = ['ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'SUSPENDED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be ACTIVE, INACTIVE, PENDING_APPROVAL, or SUSPENDED' },
        { status: 400 }
      )
    }

    // Check for duplicate email (if changing email)
    if (work_email && work_email !== oldPartner.work_email) {
      const { data: existingByEmail } = await supabase
        .from('partners')
        .select('id')
        .eq('work_email', work_email)
        .neq('id', partnerId)
        .maybeSingle()

      if (existingByEmail) {
        return NextResponse.json(
          { success: false, error: 'Another partner with this work email already exists' },
          { status: 409 }
        )
      }
    }

    if (personal_email && personal_email.trim() && personal_email !== oldPartner.personal_email) {
      const { data: existingByPersonalEmail } = await supabase
        .from('partners')
        .select('id')
        .eq('personal_email', personal_email)
        .neq('id', partnerId)
        .maybeSingle()

      if (existingByPersonalEmail) {
        return NextResponse.json(
          { success: false, error: 'Another partner with this personal email already exists' },
          { status: 409 }
        )
      }
    }

    // Check for duplicate mobile (if changing mobile)
    if (mobile_number && mobile_number !== oldPartner.mobile_number) {
      const { data: existingByMobile } = await supabase
        .from('partners')
        .select('id')
        .eq('mobile_number', mobile_number)
        .neq('id', partnerId)
        .maybeSingle()

      if (existingByMobile) {
        return NextResponse.json(
          { success: false, error: 'Another partner with this mobile number already exists' },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}

    if (full_name) updateData.full_name = full_name
    if (mobile_number) updateData.mobile_number = mobile_number
    if (work_email) updateData.work_email = work_email
    if (personal_email !== undefined) updateData.personal_email = personal_email
    if (present_address) updateData.present_address = present_address
    if (city) updateData.city = city
    if (state) updateData.state = state
    if (pincode !== undefined) updateData.pincode = pincode
    if (status) updateData.status = status

    updateData.updated_at = new Date().toISOString()

    // Update partner
    const { data: updatedPartner, error: updateError } = await supabase
      .from('partners')
      .update(updateData)
      .eq('id', partnerId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Partner update error', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update partner' },
        { status: 500 }
      )
    }

    // Log audit trail for partner update
    try {
      await logPartnerUpdated(
        partnerId,
        sanitizeForAudit(oldPartner),
        sanitizeForAudit(updatedPartner),
        auth.userId!,
        request
      )
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      apiLogger.error('Audit logging failed for partner update', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Partner updated successfully',
      data: updatedPartner
    })

  } catch (error) {
    apiLogger.error('Update partner API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
