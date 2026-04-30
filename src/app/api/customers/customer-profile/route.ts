
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/customer-profile
 *
 * Fetches the complete customer profile for the authenticated user.
 * Returns all KYC fields including personal details, addresses, and documents.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createSupabaseAdmin()

    // Fetch customer profile with all KYC fields
    const { data: profile, error } = await supabaseAdmin
      .from('customer_profiles')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      apiLogger.error('Error fetching customer profile', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If no profile exists, return minimal data from auth
    if (!profile) {
      return NextResponse.json({
        success: true,
        profile: null,
        auth_email: user.email,
        auth_phone: user.phone,
        auth_name: user.user_metadata?.full_name || user.user_metadata?.name
      })
    }

    // Return profile with auth data for prefilling
    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        // Ensure email/phone from auth if not in profile
        email: profile.email || user.email,
        mobile_primary: profile.mobile_primary || user.phone,
        full_name: profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name
      },
      auth_email: user.email,
      auth_phone: user.phone,
      auth_name: user.user_metadata?.full_name || user.user_metadata?.name
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/customer-profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/customer-profile
 *
 * Updates the customer profile with KYC information.
 * Supports partial updates and profile completion marking.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const supabaseAdmin = createSupabaseAdmin()

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('customer_profiles')
      .select('id, profile_completed')
      .eq('customer_id', user.id)
      .maybeSingle()

    // Build update object with all allowed fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // Personal Details
    if (body.full_name !== undefined) updateData.full_name = body.full_name
    if (body.date_of_birth !== undefined) updateData.date_of_birth = body.date_of_birth
    if (body.gender !== undefined) updateData.gender = body.gender
    if (body.father_name !== undefined) updateData.father_name = body.father_name
    if (body.mother_name !== undefined) updateData.mother_name = body.mother_name
    if (body.marital_status !== undefined) updateData.marital_status = body.marital_status

    // Contact
    if (body.email !== undefined) updateData.email = body.email
    if (body.mobile_primary !== undefined) updateData.mobile_primary = body.mobile_primary
    if (body.mobile_secondary !== undefined) updateData.mobile_secondary = body.mobile_secondary

    // Current Address
    if (body.current_address_line1 !== undefined) updateData.current_address_line1 = body.current_address_line1
    if (body.current_address_line2 !== undefined) updateData.current_address_line2 = body.current_address_line2
    if (body.current_city !== undefined) updateData.current_city = body.current_city
    if (body.current_state !== undefined) updateData.current_state = body.current_state
    if (body.current_pincode !== undefined) updateData.current_pincode = body.current_pincode
    if (body.current_address_proof_type !== undefined) updateData.current_address_proof_type = body.current_address_proof_type
    if (body.current_address_proof_url !== undefined) updateData.current_address_proof_url = body.current_address_proof_url

    // Permanent Address
    if (body.permanent_same_as_current !== undefined) updateData.permanent_same_as_current = body.permanent_same_as_current
    if (body.permanent_address_line1 !== undefined) updateData.permanent_address_line1 = body.permanent_address_line1
    if (body.permanent_address_line2 !== undefined) updateData.permanent_address_line2 = body.permanent_address_line2
    if (body.permanent_city !== undefined) updateData.permanent_city = body.permanent_city
    if (body.permanent_state !== undefined) updateData.permanent_state = body.permanent_state
    if (body.permanent_pincode !== undefined) updateData.permanent_pincode = body.permanent_pincode
    if (body.permanent_address_proof_type !== undefined) updateData.permanent_address_proof_type = body.permanent_address_proof_type
    if (body.permanent_address_proof_url !== undefined) updateData.permanent_address_proof_url = body.permanent_address_proof_url

    // PAN
    if (body.pan_number !== undefined) updateData.pan_number = body.pan_number?.toUpperCase()
    if (body.pan_verified !== undefined) updateData.pan_verified = body.pan_verified
    if (body.pan_document_url !== undefined) updateData.pan_document_url = body.pan_document_url
    if (body.pan_holder_name !== undefined) updateData.pan_holder_name = body.pan_holder_name
    if (body.pan_verified === true) updateData.pan_verified_at = new Date().toISOString()

    // Aadhaar
    if (body.aadhaar_number !== undefined) updateData.aadhaar_number = body.aadhaar_number?.replace(/\s/g, '')
    if (body.aadhaar_verified !== undefined) updateData.aadhaar_verified = body.aadhaar_verified
    if (body.aadhaar_document_url !== undefined) updateData.aadhaar_document_url = body.aadhaar_document_url
    if (body.aadhaar_holder_name !== undefined) updateData.aadhaar_holder_name = body.aadhaar_holder_name
    if (body.aadhaar_verified === true) updateData.aadhaar_verified_at = new Date().toISOString()

    // Profile Photo
    if (body.profile_photo_url !== undefined) {
      updateData.profile_photo_url = body.profile_photo_url
      if (body.profile_photo_url) {
        updateData.profile_photo_updated_at = new Date().toISOString()
      }
    }

    // KYC Status
    if (body.kyc_status !== undefined) updateData.kyc_status = body.kyc_status

    // Profile Completion
    if (body.mark_complete === true) {
      updateData.profile_completed = true
      updateData.profile_completed_at = new Date().toISOString()
      updateData.kyc_completed_at = new Date().toISOString()
      updateData.kyc_status = 'VERIFIED'
    } else if (body.profile_completed !== undefined) {
      updateData.profile_completed = body.profile_completed
      if (body.profile_completed) {
        updateData.profile_completed_at = new Date().toISOString()
      }
    }

    // Legacy fields (for backward compatibility)
    if (body.primary_category !== undefined) updateData.primary_category = body.primary_category
    if (body.sub_category !== undefined) updateData.sub_category = body.sub_category
    if (body.customer_type !== undefined) updateData.customer_type = body.customer_type

    let result
    if (!existingProfile) {
      // Create new profile
      updateData.customer_id = user.id
      if (!updateData.customer_type) {
        updateData.customer_type = 'INDIVIDUAL'
      }
      if (!updateData.kyc_status) {
        updateData.kyc_status = 'IN_PROGRESS'
      }

      const { data, error: createError } = await supabaseAdmin
        .from('customer_profiles')
        .insert(updateData)
        .select()
        .maybeSingle()

      if (createError) {
        apiLogger.error('Error creating customer profile', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create profile' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Update existing profile
      const { data, error: updateError } = await supabaseAdmin
        .from('customer_profiles')
        .update(updateData)
        .eq('id', existingProfile.id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Error updating customer profile', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      result = data
    }

    // If profile was just completed, trigger credit assessment fetch in background
    if (body.mark_complete === true && result.pan_number) {
      // Fire and forget - don't wait for credit assessment
      fetchCreditAssessment(user.id, result.pan_number).catch(err => {
        apiLogger.error('Background credit assessment failed', err)
      })
    }

    return NextResponse.json({
      success: true,
      profile: result,
      isNewProfile: !existingProfile
    })
  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/customers/customer-profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Background function to fetch credit assessment after profile completion.
 * This is a fire-and-forget operation.
 */
async function fetchCreditAssessment(userId: string, panNumber: string): Promise<void> {
  try {
    // This would call the credit bureau API
    // For now, just log it

    // TODO: Implement actual credit bureau API call
    // const response = await fetch(`${process.env.CREDIT_BUREAU_API_URL}/...`)
    // Store result in credit_assessments table
  } catch (error) {
    apiLogger.error('[Credit Assessment] Error', error)
  }
}
