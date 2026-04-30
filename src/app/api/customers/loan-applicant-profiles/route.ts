
/**
 * Loan Applicant Profiles API
 * Fetch available profiles (individual + entities) for loan application
 *
 * GET - Fetch individual profile and linked entities for applicant selection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/loan-applicant-profiles
 * Fetch profiles available for loan application
 * Returns individual profile + all entities where user can apply for loans
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
    const { data: individual, error: indError } = await supabase
      .from('individuals')
      .select(`
        id,
        display_id,
        full_name,
        email,
        mobile_number,
        date_of_birth,
        pan_number,
        aadhaar_verified,
        pan_verified,
        current_address_city,
        current_address_state,
        profile_completion_percentage,
        verification_status,
        income_categories(id, code, name, color),
        income_profiles(id, code, name)
      `)
      .eq('user_id', user.id)
      .maybeSingle()

    if (indError && indError.code !== 'PGRST116') {
      apiLogger.error('Error fetching individual', indError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If no individual profile, user cannot apply for loans
    if (!individual) {
      return NextResponse.json({
        success: false,
        error: 'Please complete your profile before applying for a loan',
        requiresProfile: true
      }, { status: 400 })
    }

    // Fetch entities where user can apply for loans
    const { data: entityLinks, error: linksError } = await supabase
      .from('individual_entity_links')
      .select(`
        id,
        role_code,
        role_name,
        ownership_percentage,
        is_primary_contact,
        can_apply_loan,
        entities(
          id,
          display_id,
          legal_name,
          trading_name,
          pan_number,
          gstin,
          business_address_city,
          business_address_state,
          profile_completion_percentage,
          verification_status,
          is_active,
          entity_types(id, code, name, short_name, category, color)
        )
      `)
      .eq('individual_id', individual.id)
      .eq('status', 'ACTIVE')
      .eq('can_apply_loan', true)
      .eq('consent_status', 'GRANTED')

    if (linksError) {
      apiLogger.error('Error fetching entity links', linksError)
    }

    // Build applicant profiles list
    const applicantProfiles = []

    // Add individual as first option (Personal/Self)
    applicantProfiles.push({
      type: 'INDIVIDUAL',
      id: individual.id,
      display_id: individual.display_id,
      name: individual.full_name || 'Self',
      label: 'Apply as Individual',
      subtitle: individual.income_profiles?.name || individual.income_categories?.name || 'Personal Loan',
      pan: individual.pan_number,
      location: individual.current_address_city
        ? `${individual.current_address_city}${individual.current_address_state ? ', ' + individual.current_address_state : ''}`
        : null,
      completion: individual.profile_completion_percentage || 0,
      verificationStatus: individual.verification_status,
      verified: {
        aadhaar: individual.aadhaar_verified,
        pan: individual.pan_verified
      },
      incomeCategory: individual.income_categories,
      incomeProfile: individual.income_profiles,
      canApply: (individual.profile_completion_percentage || 0) >= 50, // Minimum 50% completion required
      message: (individual.profile_completion_percentage || 0) < 50
        ? 'Complete at least 50% of your profile to apply'
        : null
    })

    // Add entities
    if (entityLinks) {
      for (const link of entityLinks) {
        const entity = link.entities
        if (!entity || !entity.is_active) continue

        applicantProfiles.push({
          type: 'ENTITY',
          id: entity.id,
          display_id: entity.display_id,
          linkId: link.id,
          name: entity.legal_name,
          label: `Apply for ${entity.trading_name || entity.legal_name}`,
          subtitle: entity.entity_types?.name || 'Business',
          entityType: entity.entity_types,
          role: {
            code: link.role_code,
            name: link.role_name
          },
          ownership: link.ownership_percentage,
          isPrimaryContact: link.is_primary_contact,
          pan: entity.pan_number,
          gstin: entity.gstin,
          location: entity.business_address_city
            ? `${entity.business_address_city}${entity.business_address_state ? ', ' + entity.business_address_state : ''}`
            : null,
          completion: entity.profile_completion_percentage || 0,
          verificationStatus: entity.verification_status,
          canApply: (entity.profile_completion_percentage || 0) >= 30, // Minimum 30% completion for entities
          message: (entity.profile_completion_percentage || 0) < 30
            ? 'Complete at least 30% of entity profile to apply'
            : null
        })
      }
    }

    // Get count of eligible profiles
    const eligibleCount = applicantProfiles.filter(p => p.canApply).length

    return NextResponse.json({
      success: true,
      profiles: applicantProfiles,
      statistics: {
        total: applicantProfiles.length,
        eligible: eligibleCount,
        individual: 1,
        entities: applicantProfiles.length - 1
      },
      individual: {
        id: individual.id,
        name: individual.full_name,
        completion: individual.profile_completion_percentage
      }
    })

  } catch (error) {
    apiLogger.error('Loan Applicant Profiles GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
