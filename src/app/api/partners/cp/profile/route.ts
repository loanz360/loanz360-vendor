export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partners/cp/profile
 * Fetches CP partner profile
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

    // Fetch profile from partners table (new schema)
    const { data: partner, error: profileError } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      apiLogger.error('Error fetching CP profile', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If no profile exists, return empty profile with user data
    if (!partner) {
      return NextResponse.json({
        success: true,
        profile: {
          partner_id: '',
          partner_type: 'CP',
          profile_picture_url: null,
          full_name: user.user_metadata?.full_name || '',
          mobile_number: '',
          work_email: user.email || '',
          present_address: '',
          present_address_proof_url: null,
          present_address_proof_type: null,
          state_name: '',
          state_code: '',
          pincode: '',
          permanent_address: '',
          permanent_address_proof_url: null,
          permanent_address_proof_type: null,
          bio_description: '',
          bank_name: '',
          branch_name: '',
          account_number: '',
          ifsc_code: '',
          micr_code: null,
          account_holder_name: '',
          cancelled_cheque_url: null,
        }
      })
    }

    // Return existing profile
    return NextResponse.json({
      success: true,
      profile: {
        partner_id: partner.partner_id,
        partner_type: 'CP',
        profile_picture_url: partner.profile_picture_url,
        full_name: partner.full_name,
        mobile_number: partner.mobile_number,
        work_email: partner.work_email,
        present_address: partner.present_address,
        present_address_proof_url: partner.present_address_proof_url,
        present_address_proof_type: partner.present_address_proof_type,
        state_name: partner.state_name,
        state_code: partner.state_code,
        pincode: partner.pincode,
        permanent_address: partner.permanent_address,
        permanent_address_proof_url: partner.permanent_address_proof_url,
        permanent_address_proof_type: partner.permanent_address_proof_type,
        bio_description: partner.bio_description,
        bank_name: partner.bank_name,
        branch_name: partner.branch_name,
        account_number: partner.account_number,
        ifsc_code: partner.ifsc_code,
        micr_code: partner.micr_code,
        account_holder_name: partner.account_holder_name,
        cancelled_cheque_url: partner.cancelled_cheque_url,
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/cp/profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/cp/profile
 * Updates CP partner profile
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
    const body = await request.json()

    // Map request data to database schema
    const profileData = {
      user_id: user.id,
      partner_type: 'CHANNEL_PARTNER',
      profile_picture_url: body.profile_picture_url,
      full_name: body.full_name,
      mobile_number: body.mobile_number,
      work_email: body.work_email || user.email,
      present_address: body.present_address,
      present_address_proof_url: body.present_address_proof_url,
      present_address_proof_type: body.present_address_proof_type,
      state_name: body.state_name,
      state_code: body.state_code,
      pincode: body.pincode,
      permanent_address: body.permanent_address,
      permanent_address_proof_url: body.permanent_address_proof_url,
      permanent_address_proof_type: body.permanent_address_proof_type,
      bio_description: body.bio_description || '',
      bank_name: body.bank_name,
      branch_name: body.branch_name,
      account_number: body.account_number,
      ifsc_code: body.ifsc_code,
      micr_code: body.micr_code,
      account_holder_name: body.account_holder_name,
      cancelled_cheque_url: body.cancelled_cheque_url,
      updated_at: new Date().toISOString()
    }

    // Upsert profile (insert or update)
    // Note: partner_id is auto-generated by trigger on INSERT
    const { data, error } = await supabase
      .from('partners')
      .upsert(profileData, {
        onConflict: 'user_id,partner_type'
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error upserting CP profile', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update profile'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        partner_id: data.partner_id,
        partner_type: 'CP',
        profile_picture_url: data.profile_picture_url,
        full_name: data.full_name,
        mobile_number: data.mobile_number,
        work_email: data.work_email,
        present_address: data.present_address,
        present_address_proof_url: data.present_address_proof_url,
        present_address_proof_type: data.present_address_proof_type,
        state_name: data.state_name,
        state_code: data.state_code,
        pincode: data.pincode,
        permanent_address: data.permanent_address,
        permanent_address_proof_url: data.permanent_address_proof_url,
        permanent_address_proof_type: data.permanent_address_proof_type,
        bio_description: data.bio_description,
        bank_name: data.bank_name,
        branch_name: data.branch_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code,
        micr_code: data.micr_code,
        account_holder_name: data.account_holder_name,
        cancelled_cheque_url: data.cancelled_cheque_url,
      }
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/partners/cp/profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
