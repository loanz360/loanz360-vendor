export const dynamic = 'force-dynamic'

/**
 * Customer Profile Selection API (Simplified 2-Step Flow)
 * Step 1: Select Subrole (13 categories)
 * Step 2: Select Profile (under the subrole)
 * Once selected, the profile is LOCKED and cannot be changed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/profile/sub-category
 * Returns current profile selection status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS for profile fetch
    const supabaseAdmin = createSupabaseAdmin()

    // Get customer profile
    const { data: profile, error } = await supabaseAdmin
      .from('customer_profiles')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      apiLogger.error('Error fetching profile', error, 'userId:', user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No profile found'
      })
    }

    // Check if profile is locked
    const isLocked = profile.sub_category_locked ?? (profile.subrole && profile.profile_key ? true : false)
    return NextResponse.json({
      success: true,
      data: {
        subrole: profile.subrole || null,
        profile: profile.profile_key || null,
        custom_profile_name: profile.custom_profile_name || null,
        is_locked: isLocked,
        locked_at: profile.sub_category_locked_at || null,
        // Legacy fields for backward compatibility
        primary_category: profile.primary_category || profile.subrole || null,
        sub_category: profile.sub_category || profile.subrole || null,
        specific_profile: profile.specific_profile || profile.profile_key || null,
        employment_type: profile.employment_type || null
      }
    })

  } catch (error) {
    apiLogger.error('Sub-category GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/profile/sub-category
 * Sets the subrole and profile for the customer (2-step simplified flow)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { subrole, profile, custom_profile_name } = body

    // Also support legacy format for backward compatibility
    const finalSubrole = subrole || body.primary_category
    const finalProfile = profile || body.specific_profile

    // Validate required fields
    if (!finalSubrole || !finalProfile) {
      return NextResponse.json(
        { success: false, error: 'Subrole and profile are required' },
        { status: 400 }
      )
    }

    // Validate custom_profile_name if provided
    let finalCustomProfileName: string | null = null
    if (custom_profile_name && typeof custom_profile_name === 'string') {
      const trimmedName = custom_profile_name.trim()
      if (trimmedName.length >= 3 && trimmedName.length <= 100) {
        finalCustomProfileName = trimmedName
      }
    }

    // Valid subroles (20 categories - updated to include all new categories)
    const validSubroles = [
      'INDIVIDUAL', 'SALARIED', 'PROFESSIONAL', 'SERVICE', 'MANUFACTURER',
      'TRADER', 'AGRICULTURE', 'PENSIONER', 'RETIRED', 'NRI',
      'WOMEN', 'STUDENT', 'GIG_ECONOMY', 'INSTITUTIONAL', 'SPECIAL',
      'STARTUP', 'REAL_ESTATE', 'MICRO_ENTERPRISE', 'ARTISAN_CRAFTSMEN', 'MSME',
      // Legacy categories for backward compatibility
      'BUSINESS'
    ]

    if (!validSubroles.includes(finalSubrole)) {
      return NextResponse.json(
        { success: false, error: 'Invalid subrole. Must be one of the 13 valid categories.' },
        { status: 400 }
      )
    }

    // Determine customer_type from subrole
    const getCustomerType = (subroleKey: string): string => {
      const businessSubroles = ['BUSINESS', 'MSME', 'INSTITUTIONAL']
      if (businessSubroles.includes(subroleKey)) return 'BUSINESS_ENTITY'
      return 'INDIVIDUAL'
    }

    const customerType = getCustomerType(finalSubrole)

    // Use admin client to bypass RLS for profile creation
    const supabaseAdmin = createSupabaseAdmin()

    // Check if profile exists
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('customer_profiles')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle()

    // If no profile exists, create one
    if (profileError && profileError.code === 'PGRST116') {

      const insertData = {
        customer_id: user.id,
        customer_type: customerType,
        subrole: finalSubrole,
        profile_key: finalProfile,
        custom_profile_name: finalCustomProfileName,
        // Also set legacy fields for backward compatibility
        primary_category: finalSubrole,
        sub_category: finalSubrole,
        specific_profile: finalProfile,
        sub_category_locked: true,
        sub_category_locked_at: new Date().toISOString()
      }

      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('customer_profiles')
        .insert(insertData)
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Profile insert failed', insertError.message, insertError.code, insertError.details)
        return NextResponse.json(
          { success: false, error: 'Failed to create customer profile. Please contact support.' },
          { status: 500 }
        )
      }

      // Also update user metadata with subrole
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          sub_role: finalSubrole,
          profile_key: finalProfile,
          custom_profile_name: finalCustomProfileName
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          subrole: newProfile.subrole,
          profile: newProfile.profile_key,
          custom_profile_name: newProfile.custom_profile_name,
          is_locked: true,
          locked_at: newProfile.sub_category_locked_at
        },
        message: 'Profile created and locked successfully'
      })
    }

    if (profileError) {
      apiLogger.error('Error checking profile', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to check profile' },
        { status: 500 }
      )
    }

    // Check if already locked
    const isAlreadyLocked = existingProfile.sub_category_locked ??
                           (existingProfile.subrole && existingProfile.profile_key ? true : false)

    if (isAlreadyLocked) {
      return NextResponse.json(
        { success: false, error: 'Profile is already locked and cannot be changed' },
        { status: 400 }
      )
    }

    // Update existing profile
    const updateData = {
      customer_type: customerType,
      subrole: finalSubrole,
      profile_key: finalProfile,
      custom_profile_name: finalCustomProfileName,
      // Also set legacy fields for backward compatibility
      primary_category: finalSubrole,
      sub_category: finalSubrole,
      specific_profile: finalProfile,
      sub_category_locked: true,
      sub_category_locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('customer_profiles')
      .update(updateData)
      .eq('id', existingProfile.id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Profile update failed', updateError.message, updateError.code, updateError.details)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile. Please contact support.' },
        { status: 500 }
      )
    }

    // Also update user metadata with subrole
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        sub_role: finalSubrole,
        profile_key: finalProfile,
        custom_profile_name: finalCustomProfileName
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        subrole: updated.subrole,
        profile: updated.profile_key,
        custom_profile_name: updated.custom_profile_name,
        is_locked: true,
        locked_at: updated.sub_category_locked_at
      },
      message: 'Profile has been set and locked successfully'
    })

  } catch (error) {
    apiLogger.error('Sub-category POST error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
