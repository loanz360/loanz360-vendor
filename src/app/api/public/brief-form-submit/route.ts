export const dynamic = 'force-dynamic'

/**
 * Brief Form Submission API
 * Public endpoint for customer registration and brief form submission
 *
 * Flow:
 * 1. Validate request data
 * 2. Decode trace token (if provided) to get originator details
 * 3. Create customer record with auto-generated IDs
 * 4. Create partner_lead record
 * 5. Return customer IDs and next steps
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptTraceToken, decryptCustomerTraceToken, detectTraceTokenType } from '@/lib/utils/trace-token'
import { validateMobileNumber } from '@/lib/utils/otp'
import type {
  BriefFormRequest,
  BriefFormResponse,
  CustomerSubrole,
} from '@/types/enterprise-leads'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/public/brief-form-submit
 * Submit brief form and register customer
 */
export async function POST(request: NextRequest) {
  try {
    const body: BriefFormRequest = await request.json()

    // =====================================================
    // 1. VALIDATE REQUEST DATA
    // =====================================================

    // Validate required fields
    if (!body.customer_name || !body.customer_mobile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer name and mobile are required',
        } as BriefFormResponse,
        { status: 400 }
      )
    }

    if (!body.customer_subrole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer type (subrole) is required',
        } as BriefFormResponse,
        { status: 400 }
      )
    }

    if (!body.loan_type || !body.loan_amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Loan type and amount are required',
        } as BriefFormResponse,
        { status: 400 }
      )
    }

    // Validate mobile number
    const mobileValidation = validateMobileNumber(body.customer_mobile)
    if (!mobileValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: mobileValidation.error || 'Invalid mobile number',
        } as BriefFormResponse,
        { status: 400 }
      )
    }

    const formattedMobile = mobileValidation.formatted!

    // =====================================================
    // 2. DECODE TRACE TOKEN (IF PROVIDED)
    // =====================================================

    let originatorType: string = 'DIRECT' // Direct application without referral
    let originatorId: string | null = null
    let shortCode: string | null = null
    let isCustomerReferral: boolean = false
    let referrerCustomerId: string | null = null

    if (body.trace_token) {
      try {
        // First, detect if this is a customer or partner trace token
        const tokenType = detectTraceTokenType(body.trace_token)

        if (tokenType === 'CUSTOMER') {
          // Customer referral token
          const customerToken = decryptCustomerTraceToken(body.trace_token)
          if (customerToken) {
            originatorType = 'CUSTOMER_REFERRAL'
            originatorId = customerToken.userId
            referrerCustomerId = customerToken.customerId
            isCustomerReferral = true
          }
        } else if (tokenType === 'PARTNER') {
          // Partner referral token
          const decoded = decryptTraceToken(body.trace_token)
          if (decoded) {
            originatorType = decoded.role
            originatorId = decoded.partnerId
          }
        } else {
          // Try legacy format
          const decoded = decryptTraceToken(body.trace_token) as any
          if (decoded?.success && decoded?.data) {
            originatorType = decoded.data.originatorType
            originatorId = decoded.data.originatorId
            shortCode = decoded.data.shortCode || null
          }
        }
      } catch (error) {
        apiLogger.error('Trace token decode error', error)
        // Continue without trace token data
      }
    } else if (body.originator_type && body.originator_id) {
      originatorType = body.originator_type
      originatorId = body.originator_id
    }

    // =====================================================
    // 3. CHECK IF CUSTOMER EXISTS
    // =====================================================

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, customer_id, referral_id, name, email')
      .eq('phone', formattedMobile)
      .maybeSingle()

    let customerId: string
    let customerCustomerId: string
    let referralId: string
    let isNewCustomer = false

    if (existingCustomer) {
      // Customer exists - use existing IDs
      customerId = existingCustomer.id
      customerCustomerId = existingCustomer.customer_id
      referralId = existingCustomer.referral_id

      // =====================================================
      // 3A. CHECK FOR DUPLICATES (Internal Flow: Keep both + tag)
      // =====================================================
      // Customer submissions are treated as internal leads - we keep both and tag as duplicate

      // Note: Brief form is customer-initiated, so we don't block, just tag for review
    } else {
      // New customer - create record
      isNewCustomer = true

      // Generate customer ID using database function
      const { data: newCustomerIdData, error: customerIdError } = await supabase.rpc(
        'generate_customer_id'
      )

      if (customerIdError || !newCustomerIdData) {
        apiLogger.error('Customer ID generation error', customerIdError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to generate customer ID',
          } as BriefFormResponse,
          { status: 500 }
        )
      }

      customerCustomerId = newCustomerIdData

      // Generate referral ID using database function
      const { data: newReferralIdData, error: referralIdError } = await supabase.rpc(
        'generate_referral_id'
      )

      if (referralIdError || !newReferralIdData) {
        apiLogger.error('Referral ID generation error', referralIdError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to generate referral ID',
          } as BriefFormResponse,
          { status: 500 }
        )
      }

      referralId = newReferralIdData

      // Create customer record
      const { data: newCustomer, error: createCustomerError } = await supabase
        .from('customers')
        .insert({
          customer_id: customerCustomerId,
          referral_id: referralId,
          name: body.customer_name,
          phone: formattedMobile,
          email: body.customer_email || null,
          customer_subrole: body.customer_subrole,
          registration_source: 'BRIEF_FORM',
          registration_completed: true,
          profile_completed_percentage: 20, // Basic info filled
          can_share_referral_links: true,
          is_active: true,
        })
        .select()
        .maybeSingle()

      if (createCustomerError || !newCustomer) {
        apiLogger.error('Customer creation error', createCustomerError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to create customer record',
          } as BriefFormResponse,
          { status: 500 }
        )
      }

      customerId = newCustomer.id
    }

    // =====================================================
    // 4. CREATE PARTNER LEAD
    // =====================================================

    // Generate lead ID using existing function
    const { data: leadIdData, error: leadIdError } = await supabase.rpc(
      'generate_lead_id',
      { p_partner_type: originatorType }
    )

    if (leadIdError || !leadIdData) {
      apiLogger.error('Lead ID generation error', leadIdError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate lead ID',
        } as BriefFormResponse,
        { status: 500 }
      )
    }

    const leadLeadId = leadIdData

    // Prepare brief form data
    const briefFormData = {
      customer_name: body.customer_name,
      customer_mobile: formattedMobile,
      customer_email: body.customer_email,
      customer_city: body.customer_city,
      customer_subrole: body.customer_subrole,
      loan_type: body.loan_type,
      loan_amount: body.loan_amount,
      loan_purpose: body.loan_purpose,
      additional_data: body.additional_data,
      submitted_at: new Date().toISOString(),
    }

    // Determine referral ID for this lead
    // If no originator (direct application), use "LOANZ360"
    const leadReferralId = originatorId || 'LOANZ360'

    // =====================================================
    // 4A. CHECK FOR DUPLICATES (Internal Flow: Keep both + tag)
    // =====================================================
    // Customer brief form submissions are treated as internal leads

    const { data: duplicateCheck } = await supabase.rpc('find_duplicate_leads', {
      p_customer_name: body.customer_name,
      p_customer_mobile: formattedMobile,
      p_customer_email: body.customer_email || null,
      p_loan_type: body.loan_type,
      p_exclude_system: null,
      p_exclude_lead_id: null
    })

    let duplicateLeadIds: string[] = []
    let leadTags: string[] = []

    if (duplicateCheck && duplicateCheck.length > 0) {
      // Found duplicates - tag and link them
      duplicateLeadIds = duplicateCheck.map((dup: any) => dup.lead_identifier)
      leadTags.push('DUPLICATE')
    }

    // Create partner lead
    const { data: newLead, error: createLeadError } = await supabase
      .from('leads')
      .insert({
        partner_id: originatorId,
        partner_type: originatorType,
        referral_id: leadReferralId,
        lead_id: leadLeadId,
        form_type: 'BRIEF',
        form_status: 'BRIEF_SUBMITTED',
        lead_status: 'NEW',
        progress_percentage: 25,
        customer_id: customerId,
        customer_customer_id: customerCustomerId,
        customer_name: body.customer_name,
        customer_mobile: formattedMobile,
        customer_email: body.customer_email,
        customer_city: body.customer_city,
        customer_subrole: body.customer_subrole,
        loan_type: body.loan_type,
        loan_amount: body.loan_amount,
        loan_purpose: body.loan_purpose,
        brief_form_data: briefFormData,
        brief_submitted_at: new Date().toISOString(),
        can_proceed_to_detailed: true,
        trace_token: body.trace_token || null,
        short_code: shortCode,
        converted: false,
        tags: leadTags.length > 0 ? leadTags : null,  // Add DUPLICATE tag if applicable
        duplicate_lead_ids: duplicateLeadIds.length > 0 ? duplicateLeadIds : null,  // Store duplicate links
      })
      .select()
      .maybeSingle()

    if (createLeadError || !newLead) {
      apiLogger.error('Lead creation error', createLeadError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create lead record',
        } as BriefFormResponse,
        { status: 500 }
      )
    }

    // 4B. If duplicates found, link back to original leads
    if (duplicateCheck && duplicateCheck.length > 0) {
      for (const dup of duplicateCheck) {
        await supabase.rpc('add_duplicate_link', {
          p_lead_system: dup.system_name,
          p_lead_id: dup.lead_id,
          p_duplicate_lead_id: leadLeadId
        }).catch((err: any) => {
          apiLogger.error('Failed to link duplicate', err)
        })
      }
    }

    // =====================================================
    // 5. UPDATE REFERRAL RECORDS AND AWARD POINTS (IF CUSTOMER REFERRAL)
    // =====================================================

    if (isCustomerReferral && referrerCustomerId) {
      // Update customer_referrals record if exists
      const { data: existingReferral } = await supabase
        .from('customer_referrals')
        .select('id, referral_status, points_awarded')
        .eq('referrer_customer_id', referrerCustomerId)
        .eq('referred_mobile', formattedMobile)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingReferral && existingReferral.referral_status !== 'REGISTERED') {
        // Update referral status to REGISTERED
        await supabase
          .from('customer_referrals')
          .update({
            referral_status: 'REGISTERED',
            form_status: 'SUBMITTED',
            form_submitted_at: new Date().toISOString(),
            converted_to_customer_id: customerId,
          })
          .eq('id', existingReferral.id)

        // Award points for successful registration
        if (!existingReferral.points_awarded || existingReferral.points_awarded === 0) {
          try {
            // Get points value from config
            const { data: pointsConfig } = await supabase
              .from('referral_points_config')
              .select('points_value')
              .eq('config_key', 'REFERRAL_REGISTRATION')
              .eq('is_active', true)
              .maybeSingle()

            const pointsToAward = pointsConfig?.points_value || 100

            // Award points using the database function
            await supabase.rpc('award_referral_points', {
              p_customer_id: referrerCustomerId,
              p_user_id: originatorId,
              p_points: pointsToAward,
              p_transaction_type: 'EARNED',
              p_reference_type: 'REFERRAL_REGISTRATION',
              p_reference_id: existingReferral.id,
              p_description: `Points earned for referring ${body.customer_name || 'a friend'} who registered`,
            })

            // Update referral record with points awarded
            await supabase
              .from('customer_referrals')
              .update({
                points_awarded: pointsToAward,
                points_awarded_at: new Date().toISOString(),
              })
              .eq('id', existingReferral.id)
          } catch (pointsError) {
            apiLogger.error('Failed to award referral points', pointsError)
            // Continue without failing the registration
          }
        }
      }
    }

    // Legacy: Update referral count for old customer referral system
    if (originatorType === 'CUSTOMER' && originatorId) {
      await supabase
        .from('customers')
        .update({
          total_referrals_made: supabase.rpc('increment', { column: 'total_referrals_made' }),
        })
        .eq('id', originatorId)
    }

    // =====================================================
    // 6. CREATE STATUS HISTORY
    // =====================================================

    await supabase.from('status_history').insert({
      lead_id: newLead.id,
      from_status: null,
      to_status: 'BRIEF_SUBMITTED',
      status_type: 'FORM_STATUS',
      change_reason: 'Brief form submitted successfully',
      change_metadata: {
        is_new_customer: isNewCustomer,
        originator_type: originatorType,
      },
    })

    // =====================================================
    // 7. RETURN SUCCESS RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      customer_id: customerId,
      customer_customer_id: customerCustomerId,
      referral_id: referralId,
      lead_id: newLead.id,
      lead_lead_id: leadLeadId,
      message: isNewCustomer
        ? 'Customer registered and brief form submitted successfully'
        : 'Brief form submitted successfully',
      next_steps: {
        can_set_password: true,
        can_fill_detailed_form: true,
        detailed_form_url: `/apply/detailed/${newLead.id}`,
      },
    } as BriefFormResponse)
  } catch (error) {
    apiLogger.error('Brief form submission error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as BriefFormResponse,
      { status: 500 }
    )
  }
}
