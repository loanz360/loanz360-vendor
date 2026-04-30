/**
 * API Route: Profile Detail
 * GET /api/customers/profile/[id] - Get profile details with documents
 * PATCH /api/customers/profile/[id] - Update profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Fetch profile details
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('type') || 'INDIVIDUAL'

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let profile: any = null
    let documents: any[] = []

    if (profileType === 'INDIVIDUAL') {
      // Fetch individual profile from individuals table
      // The sidebar uses individuals.id, so we need to query that table
      const individualSelect = `
          id,
          unique_id,
          auth_user_id,
          full_name,
          date_of_birth,
          gender,
          email,
          phone,
          alternate_phone,
          pan_number,
          aadhaar_number,
          income_category_id,
          income_profile_id,
          current_address,
          permanent_address,
          employer_name,
          designation,
          employment_type,
          monthly_income,
          work_experience_years,
          kyc_status,
          is_default,
          status,
          created_at,
          updated_at
        `

      let individualData: Record<string, unknown> | null = null

      // Primary lookup: by individuals.id
      const { data: primaryData, error: primaryError } = await supabase
        .from('individuals')
        .select(individualSelect)
        .eq('id', id)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (primaryData) {
        individualData = primaryData
      } else {
        // Fallback: the profiles/all API creates placeholder profiles with id = auth userId
        // when no individuals record exists yet. Handle this by looking up via auth_user_id.
        if (id === user.id) {
          const { data: fallbackData } = await supabase
            .from('individuals')
            .select(individualSelect)
            .eq('auth_user_id', user.id)
            .maybeSingle()

          individualData = fallbackData
        }
      }

      if (!individualData) {
        return NextResponse.json(
          { success: false, error: 'Profile not found. Please complete your profile setup first.' },
          { status: 404 }
        )
      }

      // Fetch additional data from customer_profiles table
      const { data: customerProfileData } = await supabase
        .from('customer_profiles')
        .select('profile_photo_url, profile_completion, profile_completed')
        .eq('customer_id', user.id)
        .maybeSingle()

      // Fetch income category name
      let incomeCategoryName: string | null = null
      let incomeCategoryKey: string | null = null
      if (individualData.income_category_id) {
        const { data: categoryData } = await supabase
          .from('income_categories')
          .select('key, name')
          .eq('id', individualData.income_category_id)
          .maybeSingle()
        if (categoryData) {
          incomeCategoryName = categoryData.name
          incomeCategoryKey = categoryData.key
        }
      }

      // Fetch income profile name
      let profileTypeName: string | null = null
      let profileTypeKey: string | null = null
      if (individualData.income_profile_id) {
        const { data: profileData } = await supabase
          .from('income_profiles')
          .select('key, name')
          .eq('id', individualData.income_profile_id)
          .maybeSingle()
        if (profileData) {
          profileTypeName = profileData.name
          profileTypeKey = profileData.key
        }
      }

      // Fetch documents
      const { data: docsData } = await supabase
        .from('customer_documents')
        .select(`
          id,
          document_type,
          document_name,
          file_url,
          file_size,
          verification_status,
          created_at
        `)
        .eq('customer_id', user.id)

      documents = docsData || []

      // Map to expected format
      profile = {
        id: individualData.id,
        type: 'INDIVIDUAL',
        unique_id: individualData.unique_id,
        user_id: individualData.auth_user_id,
        full_name: individualData.full_name,
        date_of_birth: individualData.date_of_birth,
        gender: individualData.gender,
        email: individualData.email,
        phone: individualData.phone,
        alternate_phone: individualData.alternate_phone,
        pan_number: individualData.pan_number,
        aadhaar_number: individualData.aadhaar_number,
        income_category: incomeCategoryKey,
        income_category_name: incomeCategoryName,
        profile_type: profileTypeKey,
        profile_type_name: profileTypeName,
        current_address: individualData.current_address,
        permanent_address: individualData.permanent_address,
        employer_name: individualData.employer_name,
        designation: individualData.designation,
        employment_type: individualData.employment_type,
        monthly_income: individualData.monthly_income,
        work_experience_years: individualData.work_experience_years,
        profile_photo_url: customerProfileData?.profile_photo_url || null,
        profile_completion: customerProfileData?.profile_completion || 0,
        kyc_status: individualData.kyc_status,
        is_default: individualData.is_default,
        profile_completed: customerProfileData?.profile_completed || false,
        created_at: individualData.created_at,
        updated_at: individualData.updated_at,
        documents: documents.map(d => ({
          id: d.id,
          document_type: d.document_type,
          document_name: d.document_name,
          file_url: d.file_url,
          file_size: d.file_size,
          uploaded_at: d.created_at,
          verification_status: d.verification_status,
        })),
      }
    } else {
      // Fetch entity profile from entities table (sidebar uses entities.id)
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select(`
          id,
          unique_id,
          legal_name,
          trading_name,
          entity_type_id,
          pan_number,
          gstin,
          cin,
          logo_url,
          reg_address_line1,
          reg_address_line2,
          reg_city,
          reg_state,
          reg_pincode,
          reg_country,
          verification_status,
          status,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .maybeSingle()

      if (entityError) {
        apiLogger.error('Error fetching entity profile', entityError)
        return NextResponse.json(
          { success: false, error: 'Profile not found' },
          { status: 404 }
        )
      }

      // Get user's individual profile to check membership
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      // Verify user has access to this entity via entity_members
      const { data: membership } = await supabase
        .from('entity_members')
        .select('role_key, role_name')
        .eq('entity_id', id)
        .eq('individual_id', individualProfile?.id)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      // Fetch entity type name
      let entityTypeName: string | null = null
      if (entityData.entity_type_id) {
        const { data: typeData } = await supabase
          .from('entity_types')
          .select('name')
          .eq('id', entityData.entity_type_id)
          .maybeSingle()
        entityTypeName = typeData?.name || null
      }

      // Fetch entity documents
      const { data: docsData } = await supabase
        .from('entity_documents')
        .select(`
          id,
          document_type,
          document_name,
          file_url,
          file_size,
          verification_status,
          created_at
        `)
        .eq('entity_id', id)

      documents = docsData || []

      // Build business address object
      const businessAddress = {
        address_line1: entityData.reg_address_line1,
        address_line2: entityData.reg_address_line2,
        city: entityData.reg_city,
        state: entityData.reg_state,
        pincode: entityData.reg_pincode,
        country: entityData.reg_country || 'India',
      }

      // Map to expected format
      profile = {
        id: entityData.id,
        type: 'ENTITY',
        unique_id: entityData.unique_id,
        legal_name: entityData.legal_name,
        trading_name: entityData.trading_name,
        entity_type: entityData.entity_type_id,
        entity_type_name: entityTypeName,
        registration_number: entityData.cin,
        gst_number: entityData.gstin,
        pan_number: entityData.pan_number,
        incorporation_date: null, // Not in entities table
        business_address: businessAddress,
        logo_url: entityData.logo_url,
        profile_completion: calculateEntityCompletion(entityData),
        verification_status: entityData.verification_status,
        is_default: false,
        created_at: entityData.created_at,
        updated_at: entityData.updated_at,
        documents: documents.map(d => ({
          id: d.id,
          document_type: d.document_type,
          document_name: d.document_name,
          file_url: d.file_url,
          file_size: d.file_size,
          uploaded_at: d.created_at,
          verification_status: d.verification_status,
        })),
      }
    }

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    apiLogger.error('Profile detail error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// PATCH - Update profile
export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id } = await context.params
    const body = await request.json()
    const { type, ...updateData } = body

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let profile: any = null

    if (type === 'INDIVIDUAL') {
      // Verify ownership - check individuals table (where the ID comes from)
      let existingId: string | null = null

      const { data: existing } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', id)
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (existing) {
        existingId = existing.id
      } else if (id === user.id) {
        // Fallback: placeholder profile uses auth userId as id
        const { data: fallback } = await supabase
          .from('individuals')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        existingId = fallback?.id || null
      }

      if (!existingId) {
        return NextResponse.json(
          { success: false, error: 'Profile not found or access denied' },
          { status: 404 }
        )
      }

      // Fields that go to individuals table
      const individualsFields = [
        'full_name', 'date_of_birth', 'gender', 'email', 'phone', 'alternate_phone',
        'pan_number', 'aadhaar_number', 'current_address', 'permanent_address',
        'employer_name', 'designation', 'employment_type', 'monthly_income',
        'work_experience_years'
      ]

      // Fields that go to customer_profiles table
      const customerProfilesFields = ['profile_photo_url']

      // Prepare updates for individuals table
      const individualsUpdates: any = { updated_at: new Date().toISOString() }
      for (const field of individualsFields) {
        if (updateData[field] !== undefined) {
          individualsUpdates[field] = updateData[field]
        }
      }

      // Update individuals table (use existingId which is the real individuals.id)
      const { data, error } = await supabase
        .from('individuals')
        .update(individualsUpdates)
        .eq('id', existingId)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error updating individual profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      // Update customer_profiles table if needed (for profile_photo_url)
      const customerProfilesUpdates: any = {}
      for (const field of customerProfilesFields) {
        if (updateData[field] !== undefined) {
          customerProfilesUpdates[field] = updateData[field]
        }
      }

      if (Object.keys(customerProfilesUpdates).length > 0) {
        await supabase
          .from('customer_profiles')
          .update({ ...customerProfilesUpdates, updated_at: new Date().toISOString() })
          .eq('customer_id', user.id)
      }

      profile = {
        ...data,
        type: 'INDIVIDUAL',
        profile_photo_url: updateData.profile_photo_url,
      }
    } else {
      // Get user's individual profile to check membership
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      // Entity profile - verify membership with edit permission via individual_id
      const { data: membership } = await supabase
        .from('entity_members')
        .select('role_key')
        .eq('entity_id', id)
        .eq('individual_id', individualProfile?.id)
        .in('role_key', ['OWNER', 'ADMIN', 'DIRECTOR', 'PARTNER', 'MANAGING_PARTNER'])
        .maybeSingle()

      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'Access denied. You need edit permissions.' },
          { status: 403 }
        )
      }

      // Map frontend field names to database column names
      const fieldMapping: Record<string, string> = {
        'legal_name': 'legal_name',
        'trading_name': 'trading_name',
        'registration_number': 'cin',
        'gst_number': 'gstin',
        'logo_url': 'logo_url',
      }

      const updates: any = { updated_at: new Date().toISOString() }
      for (const [frontendField, dbField] of Object.entries(fieldMapping)) {
        if (updateData[frontendField] !== undefined) {
          updates[dbField] = updateData[frontendField]
        }
      }

      // Handle business_address separately
      if (updateData.business_address) {
        const addr = updateData.business_address
        if (addr.address_line1 !== undefined) updates.reg_address_line1 = addr.address_line1
        if (addr.address_line2 !== undefined) updates.reg_address_line2 = addr.address_line2
        if (addr.city !== undefined) updates.reg_city = addr.city
        if (addr.state !== undefined) updates.reg_state = addr.state
        if (addr.pincode !== undefined) updates.reg_pincode = addr.pincode
        if (addr.country !== undefined) updates.reg_country = addr.country
      }

      // Update entities table
      const { data, error } = await supabase
        .from('entities')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error updating entity profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      profile = {
        ...data,
        type: 'ENTITY',
      }
    }

    return NextResponse.json({
      success: true,
      profile,
    })
  } catch (error) {
    apiLogger.error('Profile update error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// Helper function to calculate entity profile completion
function calculateEntityCompletion(entity: Record<string, unknown>): number {
  const requiredFields = ['legal_name', 'entity_type_id', 'pan_number']
  const optionalFields = ['trading_name', 'gstin', 'reg_city', 'reg_state', 'logo_url']

  const requiredFilled = requiredFields.filter(f => entity[f] && String(entity[f]).trim() !== '').length
  const optionalFilled = optionalFields.filter(f => entity[f] && String(entity[f]).trim() !== '').length

  const requiredScore = (requiredFilled / requiredFields.length) * 70
  const optionalScore = (optionalFilled / optionalFields.length) * 30

  return Math.round(requiredScore + optionalScore)
}
