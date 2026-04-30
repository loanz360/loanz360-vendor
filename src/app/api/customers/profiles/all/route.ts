
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // Verify auth using unified auth (no second parameter needed)
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminSupabase = createSupabaseAdmin()
    const userId = auth.userId

    // Build user object from auth result
    const user = {
      id: auth.userId,
      email: auth.email,
      role: auth.role,
      full_name: auth.email?.split('@')[0] || 'Customer',
      avatar_url: null as string | null,
      sub_role: auth.role
    }

    // Fetch individual profile from individuals table (use admin client to bypass RLS)
    // Auth is already verified above, so this is safe
    const { data: individualProfile, error: indError} = await adminSupabase
      .from('individuals')
      .select(`
        id,
        unique_id,
        full_name,
        income_category_id,
        income_profile_id,
        kyc_status,
        status,
        pan_number,
        is_default,
        pan_verified,
        aadhaar_verified,
        bank_verified,
        profile_completion_percentage
      `)
      .eq('auth_user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (indError && indError.code !== 'PGRST116') {
      apiLogger.error('Error fetching individual profile', indError)
    }

    // Get verification data primarily from individuals table (authoritative source)
    // Fall back to customer_profiles for profile photo and legacy data
    let profilePhotoUrl: string | null = null
    let profileCompleted = false
    let panVerified = false
    let aadhaarVerified = false

    // Use individuals table as primary source for verification
    if (individualProfile) {
      panVerified = individualProfile.pan_verified || false
      aadhaarVerified = individualProfile.aadhaar_verified || false
      // If profile_completion_percentage is 100, treat as completed
      if (individualProfile.profile_completion_percentage >= 100) {
        profileCompleted = true
      }
    }

    // Try customer_profiles with admin client (bypasses RLS type mismatch on customer_id)
    try {
      const { data: customerProfile } = await adminSupabase
        .from('customer_profiles')
        .select('profile_photo_url, profile_completed, pan_verified, aadhaar_verified')
        .eq('customer_id', userId)
        .maybeSingle()

      if (customerProfile) {
        profilePhotoUrl = customerProfile.profile_photo_url || null
        // Use customer_profiles values if individuals didn't have them
        if (!profileCompleted && customerProfile.profile_completed) {
          profileCompleted = true
        }
        if (!panVerified && customerProfile.pan_verified) {
          panVerified = true
        }
        if (!aadhaarVerified && customerProfile.aadhaar_verified) {
          aadhaarVerified = true
        }
      }
    } catch {
      // customer_profiles query may fail if columns don't exist - that's OK
      // We already have verification data from individuals table
    }

    // Fetch income category separately if profile exists
    let incomeCategory: { key: string; name: string } | null = null
    if (individualProfile && individualProfile.income_category_id) {
      const { data: categoryData } = await adminSupabase
        .from('income_categories')
        .select('key, name')
        .eq('id', individualProfile.income_category_id)
        .maybeSingle()

      incomeCategory = categoryData
    }

    // Build profiles array
    // Phase 3: Include profile_completed, pan_verified, aadhaar_verified
    const profiles: Array<{
      id: string
      type: 'INDIVIDUAL' | 'ENTITY'
      unique_id: string
      full_name?: string
      legal_name?: string
      trading_name?: string | null
      profile_photo_url?: string | null
      logo_url?: string | null
      income_category?: string | null
      income_profile?: string | null
      entity_type?: string
      entity_type_name?: string | null
      role_in_entity?: string
      profile_completion: number
      kyc_status?: string
      verification_status?: string
      is_default: boolean
      profile_completed?: boolean
      pan_verified?: boolean
      aadhaar_verified?: boolean
    }> = []

    // Add individual profile if exists, otherwise create a placeholder from user data
    // Phase 3: Include profile_completed, pan_verified, aadhaar_verified
    if (individualProfile) {
      profiles.push({
        id: individualProfile.id,
        type: 'INDIVIDUAL',
        unique_id: individualProfile.unique_id,
        full_name: individualProfile.full_name,
        profile_photo_url: profilePhotoUrl, // Use photo from customer_profiles table
        income_category: incomeCategory?.key || null,
        income_profile: null,
        kyc_status: individualProfile.kyc_status || 'NOT_STARTED',
        profile_completion: calculateIndividualCompletion(individualProfile, profilePhotoUrl, profileCompleted),
        is_default: individualProfile.is_default ?? true,
        profile_completed: profileCompleted,
        pan_verified: panVerified,
        aadhaar_verified: aadhaarVerified
      })
    } else {
      // Create a placeholder profile from the user data when no individual profile exists yet
      // This ensures the dropdown always shows the user's profile
      profiles.push({
        id: userId, // Use user id as fallback
        type: 'INDIVIDUAL',
        unique_id: 'Pending',
        full_name: user.full_name || user.email?.split('@')[0] || 'Customer',
        profile_photo_url: user.avatar_url || null,
        income_category: user.sub_role || null,
        income_profile: null,
        kyc_status: 'NOT_STARTED',
        profile_completion: profileCompleted ? 100 : 0,
        is_default: true,
        profile_completed: profileCompleted,
        pan_verified: panVerified,
        aadhaar_verified: aadhaarVerified
      })
    }

    // Fetch entity memberships using two separate queries (avoids PostgREST join issues)
    if (individualProfile?.id) {
      // Query 1: Get entity links for this individual
      const { data: links, error: linksErr } = await adminSupabase
        .from('individual_entity_links')
        .select('id, entity_id, role_key, designation, is_primary_contact')
        .eq('individual_id', individualProfile.id)
        .eq('invitation_status', 'ACTIVE')

      if (linksErr) {
        apiLogger.error('Error fetching entity links', linksErr)
      }

      if (links && links.length > 0) {
        // Query 2: Get entities by IDs
        const entityIds = links.map(l => l.entity_id).filter(Boolean)
        const { data: entities, error: entitiesErr } = await adminSupabase
          .from('entities')
          .select('id, unique_id, legal_name, trade_name, entity_type_id, logo_url, verification_status, pan_number, gstin, reg_city, reg_state, status, profile_completion_percentage')
          .in('id', entityIds)
          .eq('status', 'ACTIVE')

        if (entitiesErr) {
          apiLogger.error('Error fetching entities', entitiesErr)
        }

        // Query 3: Get entity type names
        const { data: entityTypes } = await adminSupabase
          .from('entity_types')
          .select('id, key, name')

        const entityTypeMap: Record<string, string> = {}
        entityTypes?.forEach(et => { entityTypeMap[et.id] = et.name })

        // Build entity map for quick lookup
        const entityMap = new Map<string, Record<string, unknown>>()
        entities?.forEach(e => entityMap.set(e.id, e as unknown as Record<string, unknown>))

        // Add entity profiles (deduplicate by entity_id to prevent showing same entity multiple times)
        const addedEntityIds = new Set<string>()
        for (const link of links) {
          const e = entityMap.get(link.entity_id)
          if (e && !addedEntityIds.has(e.id as string)) {
            addedEntityIds.add(e.id as string)
            profiles.push({
              id: e.id as string,
              type: 'ENTITY',
              unique_id: e.unique_id as string,
              legal_name: e.legal_name as string,
              trading_name: (e.trade_name as string) || null,
              logo_url: (e.logo_url as string) || null,
              entity_type: e.entity_type_id as string,
              entity_type_name: entityTypeMap[e.entity_type_id as string] || null,
              role_in_entity: link.designation || link.role_key,
              verification_status: (e.verification_status as string) || 'PENDING',
              profile_completion: (e.profile_completion_percentage as number) || calculateEntityCompletion(e),
              is_default: false
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      profiles
    })
  } catch (error) {
    apiLogger.error('Error in profiles/all API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function calculateIndividualCompletion(
  profile: Record<string, unknown>,
  profilePhotoUrl: string | null = null,
  profileCompleted: boolean = false
): number {
  // Phase 3: If profile_completed is true, return 100%
  if (profileCompleted) {
    return 100
  }

  // Use stored profile_completion_percentage if available
  const storedCompletion = profile.profile_completion_percentage as number | null
  if (storedCompletion != null && storedCompletion > 0) {
    return storedCompletion
  }

  // Check these fields for completion (legacy calculation)
  const fieldsToCheck = ['full_name', 'income_category_id', 'pan_number']
  let filled = fieldsToCheck.filter(f => profile[f] && String(profile[f]).trim() !== '').length

  // Add profile photo as separate check (it's stored in customer_profiles table)
  if (profilePhotoUrl) {
    filled++
  }

  const totalFields = fieldsToCheck.length + 1 // +1 for profile photo
  return Math.round((filled / totalFields) * 100)
}

function calculateEntityCompletion(entity: Record<string, unknown>): number {
  const requiredFields = ['legal_name', 'entity_type_id', 'pan_number']
  const optionalFields = ['trading_name', 'gstin', 'reg_city', 'reg_state', 'logo_url']

  const requiredFilled = requiredFields.filter(f => entity[f] && String(entity[f]).trim() !== '').length
  const optionalFilled = optionalFields.filter(f => entity[f] && String(entity[f]).trim() !== '').length

  const requiredScore = (requiredFilled / requiredFields.length) * 70
  const optionalScore = (optionalFilled / optionalFields.length) * 30

  return Math.round(requiredScore + optionalScore)
}
