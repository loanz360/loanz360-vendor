import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/customers/register/individual
 *
 * Creates a customer_profile record after successful signup.
 * Called after Supabase auth signup to complete individual registration.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please sign in first' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { primaryCategory, employmentType } = body

    if (!primaryCategory) {
      return NextResponse.json(
        { success: false, error: 'Primary category is required' },
        { status: 400 }
      )
    }

    // Validate employment type if provided
    const validEmploymentTypes = ['SALARIED', 'SELF_EMPLOYED', 'OTHER']
    if (employmentType && !validEmploymentTypes.includes(employmentType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid employment type' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for profile creation
    const supabaseAdmin = createSupabaseAdmin()

    // Check if customer profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('customer_profiles')
      .select('id')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({
        success: true,
        message: 'Customer profile already exists',
        profileId: existingProfile.id
      })
    }

    // Determine customer_type from primary_category
    // Map primary_category to customer_type for database constraint
    const getCustomerType = (category: string): string => {
      const businessTypes = ['BUSINESS_ENTITY', 'LLP', 'PRIVATE_LIMITED_COMPANY', 'PUBLIC_LIMITED_COMPANY', 'PARTNERSHIP', 'PROPRIETOR']
      if (businessTypes.includes(category)) return category
      return 'INDIVIDUAL' // Default for salaried, self-employed professionals, etc.
    }

    const customerType = getCustomerType(primaryCategory)

    // Create customer profile record using admin client
    // Note: customer_profiles table requires customer_type (NOT NULL)
    // and does NOT have email, full_name, mobile_number columns
    const { data: profile, error: insertError } = await supabaseAdmin
      .from('customer_profiles')
      .insert({
        customer_id: user.id,
        customer_type: customerType,
        primary_category: primaryCategory,
        employment_type: employmentType || null
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating customer profile', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create customer profile' },
        { status: 500 }
      )
    }

    // Map primary_category to customer_category enum value for customers table
    const getCustomerCategory = (category: string): string => {
      const categoryMap: Record<string, string> = {
        'SALARIED': 'SALARIED',
        'SELF_EMPLOYED': 'INDIVIDUAL',
        'BUSINESS_ENTITY': 'CORPORATE',
        'LLP': 'LLP',
        'PRIVATE_LIMITED_COMPANY': 'CORPORATE',
        'PUBLIC_LIMITED_COMPANY': 'CORPORATE',
        'PARTNERSHIP': 'PARTNERSHIPS',
        'PROPRIETOR': 'INDIVIDUAL',
        'NRI': 'NRI',
        'HUF': 'HUF',
        'AGRICULTURAL': 'AGRICULTURAL'
      }
      return categoryMap[category] || 'INDIVIDUAL'
    }

    // Also create record in customers table (required for wallet, referrals, etc.)
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        user_id: user.id,
        customer_category: getCustomerCategory(primaryCategory),
        kyc_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (customerError) {
      apiLogger.error('Error creating customers record', customerError)
      // Don't fail registration, just log the error
      // The customer record can be created later if needed
    }

    return NextResponse.json({
      success: true,
      message: 'Registration completed successfully',
      profileId: profile.id,
      customerId: customer?.id,
      profile
    })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/register/individual', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
