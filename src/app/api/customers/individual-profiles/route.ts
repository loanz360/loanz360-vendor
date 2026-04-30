import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/individual-profiles
 *
 * Creates a new individual profile for the authenticated customer.
 * Supports both ID-based and key-based lookups for flexibility.
 *
 * Request Body:
 * {
 *   "income_category_id": "uuid" (optional if key provided),
 *   "income_category_key": "INDIVIDUAL" (fallback if id not provided),
 *   "income_profile_id": "uuid" (optional if key provided),
 *   "income_profile_key": "INDIVIDUAL_GENERAL" (fallback if id not provided),
 *   "income_profile_name": "General Individual" (used if profile not in DB),
 *   "profile_data": { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const customerId = auth.user.id
    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const {
      income_category_id,
      income_category_key,
      income_profile_id,
      income_profile_key,
      income_profile_name,
      profile_data
    } = body

    // Validate profile_data is provided
    if (!profile_data || typeof profile_data !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'profile_data is required and must be an object'
      }, { status: 400 })
    }

    // Resolve income category - try ID first, then key
    let resolvedCategoryId = income_category_id
    let resolvedCategoryKey = income_category_key || 'INDIVIDUAL'

    if (!resolvedCategoryId && resolvedCategoryKey) {
      // Lookup by key
      const { data: categoryByKey } = await supabase
        .from('income_categories')
        .select('id, key')
        .eq('key', resolvedCategoryKey)
        .maybeSingle()

      if (categoryByKey) {
        resolvedCategoryId = categoryByKey.id
      }
    }

    // Validate we have a category ID
    if (!resolvedCategoryId) {
      return NextResponse.json({
        success: false,
        error: 'Could not resolve income category. Please provide income_category_id or income_category_key.'
      }, { status: 400 })
    }

    // Verify the category exists
    const { data: incomeCategory, error: categoryError } = await supabase
      .from('income_categories')
      .select('*')
      .eq('id', resolvedCategoryId)
      .maybeSingle()

    if (categoryError || !incomeCategory) {
      return NextResponse.json({
        success: false,
        error: 'Invalid income category'
      }, { status: 400 })
    }

    // Resolve income profile - try ID first, then key
    let resolvedProfileId = income_profile_id
    let resolvedProfileKey = income_profile_key
    let resolvedProfileName = income_profile_name
    let incomeProfile = null

    if (resolvedProfileId) {
      // Lookup by ID
      const { data: profileById } = await supabase
        .from('income_profiles')
        .select('*')
        .eq('id', resolvedProfileId)
        .eq('category_id', resolvedCategoryId)
        .maybeSingle()

      if (profileById) {
        incomeProfile = profileById
        resolvedProfileKey = profileById.key
        resolvedProfileName = profileById.name
      }
    }

    if (!incomeProfile && resolvedProfileKey) {
      // Lookup by key
      const { data: profileByKey } = await supabase
        .from('income_profiles')
        .select('*')
        .eq('key', resolvedProfileKey)
        .eq('category_id', resolvedCategoryId)
        .maybeSingle()

      if (profileByKey) {
        incomeProfile = profileByKey
        resolvedProfileId = profileByKey.id
        resolvedProfileName = profileByKey.name
      }
    }

    // If profile not found in DB, use the provided key and name
    // This allows creation even if income_profiles table is not fully seeded
    if (!resolvedProfileKey && !resolvedProfileName) {
      return NextResponse.json({
        success: false,
        error: 'Could not resolve income profile. Please provide income_profile_key or income_profile_name.'
      }, { status: 400 })
    }

    // Extract common fields from profile_data
    const {
      full_name,
      date_of_birth,
      gender,
      marital_status,
      email_primary,
      mobile_primary,
      pan_number,
      aadhaar_number,
      current_address_line_1,
      current_address_line_2,
      current_city,
      current_state,
      current_pincode,
      ...additionalData
    } = profile_data

    // Build income_profile_data with category-specific fields
    const incomeProfileData: Record<string, unknown> = {
      income_profile_id: resolvedProfileId || null,
      income_profile_key: resolvedProfileKey,
      income_profile_name: resolvedProfileName,
      ...additionalData
    }

    // Create the individual profile
    const { data: newProfile, error: insertError } = await supabase
      .from('individuals')
      .insert({
        auth_user_id: customerId,
        income_category_id: resolvedCategoryId,

        // Basic Info
        full_name,
        date_of_birth,
        gender,
        marital_status,

        // Contact
        email_primary: email_primary,
        mobile_primary: mobile_primary,

        // Identity
        pan_number,
        aadhaar_last_4: aadhaar_number ? aadhaar_number.slice(-4) : null,

        // Current Address
        current_address_line_1,
        current_address_line_2,
        current_city,
        current_state,
        current_pincode,

        // Category-specific data stored in JSONB column
        income_profile_data: incomeProfileData,

        // Profile status
        profile_completion_percentage: 0,
        profile_sections_status: {},
        kyc_status: 'PENDING',
        status: 'ACTIVE'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating individual profile', insertError)

      // Check for duplicate PAN
      if (insertError.code === '23505' && insertError.message?.includes('pan_number')) {
        return NextResponse.json({
          success: false,
          error: 'An individual profile with this PAN number already exists'
        }, { status: 409 })
      }

      return NextResponse.json({
        success: false,
        error: `Failed to create individual profile: ${insertError.message}`
      }, { status: 500 })
    }

    // Calculate profile completion
    const totalRequiredFields = 10
    const completedFields = Object.values(profile_data).filter(v => v !== null && v !== '').length
    const completionPercentage = Math.min(Math.round((completedFields / totalRequiredFields) * 100), 100)

    // Update profile completion
    await supabase
      .from('individuals')
      .update({ profile_completion_percentage: completionPercentage })
      .eq('id', newProfile.id)

    return NextResponse.json({
      success: true,
      data: {
        profile: newProfile,
        message: 'Individual profile created successfully'
      }
    })
  } catch (error) {
    apiLogger.error('Error in individual-profiles API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/customers/individual-profiles
 *
 * Fetches all individual profiles for the authenticated customer.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const customerId = auth.user.id
    const supabase = await createClient()

    const { data: profiles, error } = await supabase
      .from('individuals')
      .select('*')
      .eq('auth_user_id', customerId)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching individual profiles', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch individual profiles'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: profiles || []
    })
  } catch (error) {
    apiLogger.error('Error in individual-profiles GET API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
