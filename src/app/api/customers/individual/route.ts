import { parseBody } from '@/lib/utils/parse-body'

/**
 * Individual Profile API
 * Customer endpoint for managing individual profile data
 * Works with the new Individual-Entity architecture
 *
 * GET  - Fetch individual profile with linked entities
 * POST - Create/Update individual profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for profile update
const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  marital_status: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional().nullable(),
  father_name: z.string().max(100).optional().nullable(),
  mother_name: z.string().max(100).optional().nullable(),
  spouse_name: z.string().max(100).optional().nullable(),
  alternate_mobile: z.string().max(15).optional().nullable(),
  alternate_email: z.string().email().optional().nullable(),
  // Address
  current_address_line1: z.string().max(255).optional().nullable(),
  current_address_line2: z.string().max(255).optional().nullable(),
  current_city: z.string().max(100).optional().nullable(),
  current_state: z.string().max(100).optional().nullable(),
  current_pincode: z.string().max(10).optional().nullable(),
  current_country: z.string().max(100).optional().nullable(),
  permanent_address_line1: z.string().max(255).optional().nullable(),
  permanent_address_line2: z.string().max(255).optional().nullable(),
  permanent_city: z.string().max(100).optional().nullable(),
  permanent_state: z.string().max(100).optional().nullable(),
  permanent_pincode: z.string().max(10).optional().nullable(),
  permanent_country: z.string().max(100).optional().nullable(),
  address_same_as_current: z.boolean().optional(),
  // Income
  income_category_id: z.string().uuid().optional().nullable(),
  income_profile_id: z.string().uuid().optional().nullable(),
  employment_data: z.record(z.any()).optional().nullable(),
  // Photo
  profile_photo_url: z.string().url().optional().nullable(),
})

/**
 * GET /api/customers/individual
 * Fetch individual profile with linked entities
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

    // Fetch individual profile
    const { data: individual, error: profileError } = await supabase
      .from('individuals')
      .select(`
        *,
        income_categories(id, code, name, color),
        income_profiles(id, code, name)
      `)
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      apiLogger.error('Error fetching individual', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If no individual profile exists yet, return empty but with user info
    if (!individual) {
      return NextResponse.json({
        success: true,
        individual: null,
        entities: [],
        needsOnboarding: true,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone
        }
      })
    }

    // Fetch linked entities
    const { data: entityLinks, error: linksError } = await supabase
      .from('individual_entity_links')
      .select(`
        id,
        role_code,
        role_name,
        ownership_percentage,
        is_primary_contact,
        can_apply_loan,
        can_view_financials,
        can_manage_members,
        can_sign_documents,
        consent_status,
        consent_date,
        joined_at,
        entities(
          id,
          display_id,
          entity_type_id,
          legal_name,
          trading_name,
          registration_number,
          date_of_incorporation,
          pan_number,
          gstin,
          business_address_line1,
          business_address_city,
          business_address_state,
          profile_completion_percentage,
          verification_status,
          is_active,
          created_at,
          entity_types(id, code, name, short_name, category, icon, color)
        )
      `)
      .eq('individual_id', individual.id)
      .eq('status', 'ACTIVE')

    if (linksError) {
      apiLogger.error('Error fetching entity links', linksError)
    }

    // Fetch bank accounts
    const { data: bankAccounts } = await supabase
      .from('individual_entity_bank_accounts')
      .select('*')
      .eq('owner_type', 'INDIVIDUAL')
      .eq('owner_id', individual.id)
      .eq('is_active', true)

    // Fetch documents
    const { data: documents } = await supabase
      .from('individual_entity_documents')
      .select('*')
      .eq('owner_type', 'INDIVIDUAL')
      .eq('owner_id', individual.id)
      .order('uploaded_at', { ascending: false })

    // Calculate profile completion
    const profileCompletion = calculateProfileCompletion(individual)

    return NextResponse.json({
      success: true,
      individual: {
        ...individual,
        profile_completion_percentage: profileCompletion
      },
      entities: entityLinks?.map(link => ({
        ...link,
        entity: link.entities
      })) || [],
      bankAccounts: bankAccounts || [],
      documents: documents || [],
      needsOnboarding: false
    })

  } catch (error) {
    apiLogger.error('Individual GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/individual
 * Create or update individual profile
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

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateProfileSchema.parse(body)

    // Check if individual profile exists
    const { data: existing } = await supabase
      .from('individuals')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let individual

    if (existing) {
      // Update existing profile
      const { data: updated, error: updateError } = await supabase
        .from('individuals')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Error updating individual', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      individual = updated
    } else {
      // Create new individual profile
      // Get user details from auth
      const { data: authUser } = await supabase.auth.getUser()

      const { data: created, error: createError } = await supabase
        .from('individuals')
        .insert({
          user_id: user.id,
          email: authUser.user?.email || '',
          mobile_number: authUser.user?.phone || '',
          ...validatedData
        })
        .select()
        .maybeSingle()

      if (createError) {
        apiLogger.error('Error creating individual', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create profile' },
          { status: 500 }
        )
      }

      individual = created
    }

    // Update profile completion percentage
    const completion = calculateProfileCompletion(individual)
    await supabase
      .from('individuals')
      .update({ profile_completion_percentage: completion })
      .eq('id', individual.id)

    return NextResponse.json({
      success: true,
      individual: {
        ...individual,
        profile_completion_percentage: completion
      },
      message: existing ? 'Profile updated successfully' : 'Profile created successfully'
    })

  } catch (error) {
    apiLogger.error('Individual POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate profile completion
function calculateProfileCompletion(individual: Record<string, unknown>): number {
  const requiredFields = [
    'full_name',
    'date_of_birth',
    'gender',
    'mobile_number',
    'email',
    'current_address_line1',
    'current_city',
    'current_state',
    'current_pincode',
    'pan_number',
    'income_category_id'
  ]

  const optionalFields = [
    'father_name',
    'mother_name',
    'alternate_mobile',
    'permanent_address_line1',
    'aadhaar_verified',
    'pan_verified',
    'income_profile_id'
  ]

  let completed = 0
  let total = requiredFields.length + optionalFields.length * 0.5

  for (const field of requiredFields) {
    if (individual[field]) completed++
  }

  for (const field of optionalFields) {
    if (individual[field]) completed += 0.5
  }

  return Math.round((completed / total) * 100)
}
