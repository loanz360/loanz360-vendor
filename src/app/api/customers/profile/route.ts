
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/profile
 *
 * Fetches the customer profile for the authenticated user.
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

    // Use admin client to bypass RLS for profile operations
    const supabaseAdmin = createSupabaseAdmin()

    // Fetch customer profile
    const { data: profile, error } = await supabaseAdmin
      .from('customer_profiles')
      .select('*')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      apiLogger.error('Error fetching customer profile', error, 'userId:', user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If no profile exists, create one
    if (!profile) {
      const userMetadata = user.user_metadata || {}

      // Check if user is a customer (registered via customer portal)
      if (userMetadata.role !== 'CUSTOMER') {
        return NextResponse.json({
          success: true,
          profile: null,
          message: 'No customer profile found'
        })
      }

      // Determine customer_type from primary_category
      const primaryCategory = userMetadata.primary_category || 'SALARIED'
      const getCustomerType = (category: string): string => {
        const businessTypes = ['BUSINESS_ENTITY', 'LLP', 'PRIVATE_LIMITED_COMPANY', 'PUBLIC_LIMITED_COMPANY', 'PARTNERSHIP', 'PROPRIETOR']
        if (businessTypes.includes(category)) return category
        return 'INDIVIDUAL'
      }
      const customerType = getCustomerType(primaryCategory)

      // Create customer profile using admin client
      // Note: customer_profiles table requires customer_type (NOT NULL)
      // and does NOT have email, full_name, mobile_number columns
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('customer_profiles')
        .insert({
          customer_id: user.id,
          customer_type: customerType,
          primary_category: primaryCategory,
          employment_type: userMetadata.employment_type || null
        })
        .select()
        .maybeSingle()

      if (createError) {
        apiLogger.error('Error creating customer profile', createError, 'userId:', user.id)
        return NextResponse.json(
          { success: false, error: 'Failed to create profile' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        profile: newProfile,
        customerType: customerType,
        isNewProfile: true
      })
    }

    return NextResponse.json({
      success: true,
      profile: profile,
      customerType: profile.customer_type || 'INDIVIDUAL'
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/profile
 *
 * Updates the customer profile for the authenticated user.
 */
export async function POST(request: NextRequest) {
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

    // Use admin client to bypass RLS for profile operations
    const supabaseAdmin = createSupabaseAdmin()

    // Check if customer profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('customer_profiles')
      .select('id')
      .eq('customer_id', user.id)
      .maybeSingle()

    // Build update object with only fields that exist in customer_profiles table
    // Note: customer_profiles does NOT have: email, full_name, mobile_number, address, city, state, pincode, profile_photo_url, entity_type
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Personal Details (only columns that exist in the table)
    if (body.date_of_birth !== undefined) updateData.date_of_birth = body.date_of_birth
    if (body.gender !== undefined) updateData.gender = body.gender
    if (body.marital_status !== undefined) updateData.marital_status = body.marital_status
    if (body.alternate_mobile !== undefined) updateData.alternate_mobile = body.alternate_mobile

    // Identity Documents
    if (body.pan_number !== undefined) updateData.pan_number = body.pan_number

    // Banking details
    if (body.bank_ifsc_code !== undefined) updateData.bank_ifsc_code = body.bank_ifsc_code
    if (body.bank_name !== undefined) updateData.bank_name = body.bank_name
    if (body.bank_branch !== undefined) updateData.bank_branch = body.bank_branch

    // Address fields that exist
    if (body.address_line_2 !== undefined) updateData.address_line_2 = body.address_line_2
    if (body.landmark !== undefined) updateData.landmark = body.landmark
    if (body.country !== undefined) updateData.country = body.country

    // Category/Profile Type
    if (body.primary_category !== undefined) updateData.primary_category = body.primary_category
    if (body.sub_category !== undefined) updateData.sub_category = body.sub_category
    if (body.specific_profile !== undefined) updateData.specific_profile = body.specific_profile
    if (body.employment_type !== undefined) updateData.employment_type = body.employment_type
    if (body.customer_type !== undefined) updateData.customer_type = body.customer_type

    // Category-specific data (JSONB)
    if (body.category_specific_data !== undefined) updateData.category_specific_data = body.category_specific_data

    // KYC status
    if (body.kyc_status !== undefined) updateData.kyc_status = body.kyc_status

    if (!existingProfile) {
      // Create new profile if doesn't exist
      updateData.customer_id = user.id

      // Ensure customer_type is set (required NOT NULL field)
      if (!updateData.customer_type) {
        const primaryCategory = (updateData.primary_category as string) || 'SALARIED'
        const businessTypes = ['BUSINESS_ENTITY', 'LLP', 'PRIVATE_LIMITED_COMPANY', 'PUBLIC_LIMITED_COMPANY', 'PARTNERSHIP', 'PROPRIETOR']
        updateData.customer_type = businessTypes.includes(primaryCategory) ? primaryCategory : 'INDIVIDUAL'
      }

      const { data, error } = await supabaseAdmin
        .from('customer_profiles')
        .insert(updateData)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error creating customer profile', error, 'userId:', user.id)
        return NextResponse.json(
          { success: false, error: 'Failed to create profile' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        profile: data,
        isNewProfile: true
      })
    }

    // Update existing profile
    const { data, error } = await supabaseAdmin
      .from('customer_profiles')
      .update(updateData)
      .eq('id', existingProfile.id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating customer profile', error, 'userId:', user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to save profile' },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      profile: data,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
