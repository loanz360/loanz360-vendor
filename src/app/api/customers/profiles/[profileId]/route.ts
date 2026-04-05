export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const supabase = await createClient()
    const userId = auth.userId

    // Determine profile type from query param or auto-detect
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('type')

    if (profileType === 'INDIVIDUAL' || !profileType) {
      // Try fetching as individual profile
      const { data: individualProfile, error: indError } = await supabase
        .from('individuals')
        .select(`
          *,
          income_categories (id, key, name, description),
          income_profiles (id, key, name)
        `)
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (individualProfile) {
        // Fetch documents for this individual
        const { data: documents } = await supabase
          .from('individual_entity_documents')
          .select('id, document_category, document_type, document_name, file_url, file_size_bytes, verification_status, verified_at, created_at')
          .eq('owner_type', 'INDIVIDUAL')
          .eq('individual_id', profileId)
          .order('created_at', { ascending: false })

        // Fetch profile photo from customer_profiles
        const { data: customerProfile } = await supabase
          .from('customer_profiles')
          .select('profile_photo_url, profile_completed')
          .eq('customer_id', userId)
          .maybeSingle()

        // Extract employment data from income_profile_data
        const ipd = (individualProfile.income_profile_data || {}) as Record<string, unknown>

        // Transform to frontend format
        const transformed = {
          id: individualProfile.id,
          type: 'INDIVIDUAL' as const,
          unique_id: individualProfile.unique_id,
          user_id: individualProfile.auth_user_id,
          full_name: individualProfile.full_name,
          date_of_birth: individualProfile.date_of_birth,
          gender: individualProfile.gender,
          marital_status: individualProfile.marital_status,
          father_name: individualProfile.father_name,
          mother_name: individualProfile.mother_name,
          spouse_name: individualProfile.spouse_name,
          email: individualProfile.email_primary,
          phone: individualProfile.mobile_primary,
          alternate_phone: individualProfile.mobile_alternate,
          pan_number: individualProfile.pan_number,
          aadhaar_number: individualProfile.aadhaar_last_4 ? `XXXX XXXX ${individualProfile.aadhaar_last_4}` : null,
          income_category: individualProfile.income_categories?.key || null,
          income_category_name: individualProfile.income_categories?.name || null,
          profile_type: individualProfile.income_profiles?.key || null,
          profile_type_name: individualProfile.income_profiles?.name || null,
          // Address
          current_address: {
            address_line1: individualProfile.current_address_line_1,
            address_line2: individualProfile.current_address_line_2,
            landmark: individualProfile.current_landmark,
            city: individualProfile.current_city,
            district: individualProfile.current_district,
            state: individualProfile.current_state,
            pincode: individualProfile.current_pincode,
            country: individualProfile.current_country || 'India',
            residence_type: individualProfile.current_residence_type,
            residence_since: individualProfile.current_residence_since,
          },
          permanent_address: individualProfile.permanent_same_as_current ? null : {
            address_line1: individualProfile.permanent_address_line_1,
            address_line2: individualProfile.permanent_address_line_2,
            landmark: individualProfile.permanent_landmark,
            city: individualProfile.permanent_city,
            district: individualProfile.permanent_district,
            state: individualProfile.permanent_state,
            pincode: individualProfile.permanent_pincode,
            country: individualProfile.permanent_country || 'India',
          },
          permanent_same_as_current: individualProfile.permanent_same_as_current,
          // Education
          highest_qualification: individualProfile.highest_qualification,
          qualification_stream: individualProfile.qualification_stream,
          institution_name: individualProfile.institution_name,
          year_of_passing: individualProfile.year_of_passing,
          // Employment (from income_profile_data)
          employer_name: ipd.employer_name as string || null,
          designation: ipd.designation as string || null,
          employment_type: ipd.employment_type as string || null,
          monthly_income: (ipd.gross_monthly_salary || ipd.average_monthly_income || ipd.monthly_pension || ipd.total_monthly_rental_income) as number || null,
          net_monthly_income: ipd.net_monthly_salary as number || null,
          work_experience_years: (ipd.total_experience_years || ipd.years_of_practice || ipd.years_in_business) as number || null,
          income_profile_data: ipd,
          // Financial
          total_monthly_income: individualProfile.total_monthly_income,
          total_monthly_obligations: individualProfile.total_monthly_obligations,
          net_monthly_surplus: individualProfile.net_monthly_surplus,
          existing_loans: individualProfile.existing_loans,
          cibil_score: individualProfile.cibil_score,
          // Verification
          kyc_status: individualProfile.kyc_status,
          pan_verified: individualProfile.pan_verified,
          aadhaar_verified: individualProfile.aadhaar_verified,
          bank_verified: individualProfile.bank_verified,
          itr_verified: individualProfile.itr_verified,
          // Profile
          profile_photo_url: customerProfile?.profile_photo_url || null,
          profile_completion: individualProfile.profile_completion_percentage || 0,
          is_default: individualProfile.is_default ?? true,
          profile_completed: customerProfile?.profile_completed || false,
          created_at: individualProfile.created_at,
          updated_at: individualProfile.updated_at,
          // Documents
          documents: (documents || []).map((d: Record<string, unknown>) => ({
            id: d.id,
            document_type: d.document_type,
            document_name: d.document_name || d.document_type,
            file_url: d.file_url,
            file_size: d.file_size_bytes,
            uploaded_at: d.created_at,
            verification_status: d.verification_status,
          })),
        }

        return NextResponse.json({ success: true, profile: transformed })
      }

      if (indError && indError.code !== 'PGRST116') {
        apiLogger.error('Error fetching individual profile', indError)
      }
    }

    if (profileType === 'ENTITY' || !profileType) {
      // Try fetching as entity profile
      // First try via entity_members (created via entity-profiles endpoint)
      let entityProfile: Record<string, unknown> | null = null

      const { data: entityViaMembers, error: entError } = await supabase
        .from('entities')
        .select(`
          *,
          entity_types (id, key, name, description),
          entity_members!inner (
            id,
            role_key,
            role_name,
            is_primary,
            can_sign_documents,
            can_apply_for_loans,
            can_manage_entity,
            individual:individuals!inner (
              auth_user_id
            )
          )
        `)
        .eq('id', profileId)
        .eq('entity_members.individual.auth_user_id', userId)
        .eq('entity_members.status', 'ACTIVE')
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (entityViaMembers) {
        entityProfile = entityViaMembers
      } else {
        // Fallback: try via individual_entity_links (created via individual/entities endpoint)
        // First get the individual profile for this user
        const { data: indProfile } = await supabase
          .from('individuals')
          .select('id')
          .eq('auth_user_id', userId)
          .eq('status', 'ACTIVE')
          .maybeSingle()

        if (indProfile) {
          const { data: entityLink } = await supabase
            .from('individual_entity_links')
            .select('id, role_key, role_code, role_name, is_primary_contact, can_apply_loan, can_sign_documents, can_manage_members')
            .eq('entity_id', profileId)
            .eq('individual_id', indProfile.id)
            .eq('invitation_status', 'ACTIVE')
            .maybeSingle()

          if (entityLink) {
            const { data: entityData } = await supabase
              .from('entities')
              .select('*, entity_types (id, key, name, description)')
              .eq('id', profileId)
              .eq('status', 'ACTIVE')
              .maybeSingle()

            if (entityData) {
              // Attach entity_members-compatible shape for downstream processing
              entityProfile = {
                ...entityData,
                entity_members: [{
                  id: entityLink.id,
                  role_key: entityLink.role_key || entityLink.role_code,
                  role_name: entityLink.role_name,
                  is_primary: entityLink.is_primary_contact,
                  can_sign_documents: entityLink.can_sign_documents,
                  can_apply_for_loans: entityLink.can_apply_loan,
                  can_manage_entity: entityLink.can_manage_members,
                  individual: { auth_user_id: userId }
                }]
              }
            }
          }
        }
      }

      if (entityProfile) {
        // Fetch documents for this entity
        const { data: documents } = await supabase
          .from('individual_entity_documents')
          .select('id, document_category, document_type, document_name, file_url, file_size_bytes, verification_status, verified_at, created_at')
          .eq('owner_type', 'ENTITY')
          .eq('entity_id', profileId)
          .order('created_at', { ascending: false })

        // Transform to frontend format
        const transformed = {
          id: entityProfile.id,
          type: 'ENTITY' as const,
          unique_id: entityProfile.unique_id,
          user_id: userId,
          legal_name: entityProfile.legal_name,
          trading_name: entityProfile.trade_name,
          description: entityProfile.description,
          entity_type: entityProfile.entity_types?.key || null,
          entity_type_name: entityProfile.entity_types?.name || null,
          entity_type_description: entityProfile.entity_types?.description || null,
          date_of_establishment: entityProfile.date_of_establishment,
          incorporation_date: entityProfile.date_of_incorporation,
          industry_category: entityProfile.industry_category,
          business_nature: entityProfile.business_nature,
          msme_category: entityProfile.msme_category,
          // Registrations
          pan_number: entityProfile.pan_number,
          gst_number: entityProfile.gstin,
          gst_status: entityProfile.gst_status,
          cin: entityProfile.cin,
          llpin: entityProfile.llpin,
          registration_number: entityProfile.registration_number,
          registration_authority: entityProfile.registration_authority,
          tan_number: entityProfile.tan_number,
          udyam_registration_number: entityProfile.udyam_registration_number,
          shop_establishment_number: entityProfile.shop_establishment_number,
          // Contact
          email: entityProfile.email_primary,
          phone: entityProfile.phone_primary,
          alternate_phone: entityProfile.phone_alternate,
          website: entityProfile.website,
          // Registered Address
          registered_address: {
            address_line1: entityProfile.reg_address_line_1,
            address_line2: entityProfile.reg_address_line_2,
            landmark: entityProfile.reg_landmark,
            city: entityProfile.reg_city,
            district: entityProfile.reg_district,
            state: entityProfile.reg_state,
            pincode: entityProfile.reg_pincode,
            country: entityProfile.reg_country || 'India',
          },
          // Business Address
          business_address_same_as_registered: entityProfile.biz_address_same_as_reg,
          business_address: entityProfile.biz_address_same_as_reg ? null : {
            address_line1: entityProfile.biz_address_line_1,
            address_line2: entityProfile.biz_address_line_2,
            landmark: entityProfile.biz_landmark,
            city: entityProfile.biz_city,
            district: entityProfile.biz_district,
            state: entityProfile.biz_state,
            pincode: entityProfile.biz_pincode,
            country: entityProfile.biz_country || 'India',
            premises_type: entityProfile.biz_premises_type,
            premises_since: entityProfile.biz_premises_since,
          },
          // Financial
          turnover_current_year: entityProfile.turnover_current_year,
          turnover_previous_year: entityProfile.turnover_previous_year,
          profit_current_year: entityProfile.profit_current_year,
          profit_previous_year: entityProfile.profit_previous_year,
          total_assets: entityProfile.total_assets,
          total_liabilities: entityProfile.total_liabilities,
          net_worth: entityProfile.net_worth,
          // Operations
          number_of_employees: entityProfile.number_of_employees,
          number_of_branches: entityProfile.number_of_branches,
          major_customers: entityProfile.major_customers,
          major_suppliers: entityProfile.major_suppliers,
          // Entity-type specific data
          entity_type_data: entityProfile.entity_type_data,
          // Verification
          verification_status: entityProfile.verification_status,
          pan_verified: entityProfile.pan_verified,
          gst_verified: entityProfile.gst_verified,
          cin_verified: entityProfile.cin_verified,
          // Profile
          logo_url: entityProfile.logo_url,
          profile_completion: entityProfile.profile_completion_percentage || 0,
          is_default: false,
          created_at: entityProfile.created_at,
          updated_at: entityProfile.updated_at,
          // Documents
          documents: (documents || []).map((d: Record<string, unknown>) => ({
            id: d.id,
            document_type: d.document_type,
            document_name: d.document_name || d.document_type,
            file_url: d.file_url,
            file_size: d.file_size_bytes,
            uploaded_at: d.created_at,
            verification_status: d.verification_status,
          })),
        }

        return NextResponse.json({ success: true, profile: transformed })
      }

      if (entError && entError.code !== 'PGRST116') {
        apiLogger.error('Error fetching entity profile', entError)
      }
    }

    return NextResponse.json(
      { success: false, error: 'Profile not found or access denied' },
      { status: 404 }
    )
  } catch (error) {
    apiLogger.error('Error in profile API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update profile details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const body = await request.json()
    const { profile_type, ...updateData } = body

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access and update profile
    if (profile_type === 'INDIVIDUAL') {
      // Verify access
      const { data: profile } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!profile) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      // Update individual profile
      const { data: updatedProfile, error } = await supabase
        .from('individuals')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error updating individual profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      // Log activity
      await supabase.from('profile_activity_log').insert({
        profile_id: profileId,
        profile_type: 'INDIVIDUAL',
        activity_type: 'PROFILE_UPDATED',
        activity_category: 'PROFILE',
        title: 'Profile Updated',
        description: 'Profile information was updated',
        performed_by: userId,
        changed_fields: Object.keys(updateData),
        metadata: { fields_updated: Object.keys(updateData) }
      })

      return NextResponse.json({
        success: true,
        profile: updatedProfile,
        message: 'Profile updated successfully'
      })
    } else if (profile_type === 'ENTITY') {
      // Verify user has permission to manage this entity
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individualProfile) {
        return NextResponse.json(
          { success: false, error: 'Individual profile not found' },
          { status: 404 }
        )
      }

      // Check entity_members first, then fallback to individual_entity_links
      const { data: membership } = await supabase
        .from('entity_members')
        .select('can_manage_entity')
        .eq('entity_id', profileId)
        .eq('individual_id', individualProfile.id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!membership) {
        // Fallback: check individual_entity_links
        const { data: entityLink } = await supabase
          .from('individual_entity_links')
          .select('can_manage_members')
          .eq('entity_id', profileId)
          .eq('individual_id', individualProfile.id)
          .eq('invitation_status', 'ACTIVE')
          .maybeSingle()

        if (!entityLink || !entityLink.can_manage_members) {
          return NextResponse.json(
            { success: false, error: 'Access denied - requires management permission' },
            { status: 403 }
          )
        }
      } else if (!membership.can_manage_entity) {
        return NextResponse.json(
          { success: false, error: 'Access denied - requires management permission' },
          { status: 403 }
        )
      }

      // Map frontend field names to DB column names
      const dbData = mapEntityFieldsToDB(updateData)

      // Update entity profile
      const { data: updatedProfile, error } = await supabase
        .from('entities')
        .update({
          ...dbData,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error updating entity profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      // Log activity
      await supabase.from('profile_activity_log').insert({
        profile_id: profileId,
        profile_type: 'ENTITY',
        activity_type: 'PROFILE_UPDATED',
        activity_category: 'PROFILE',
        title: 'Entity Updated',
        description: 'Entity information was updated',
        performed_by: userId,
        changed_fields: Object.keys(updateData),
        metadata: { fields_updated: Object.keys(updateData) }
      })

      return NextResponse.json({
        success: true,
        profile: updatedProfile,
        message: 'Entity updated successfully'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid profile type' },
        { status: 400 }
      )
    }
  } catch (error) {
    apiLogger.error('Error in profile update API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Soft delete a profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const supabase = await createClient()
    const userId = auth.userId

    // Determine profile type from query param
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('type') || 'INDIVIDUAL'

    if (profileType === 'INDIVIDUAL') {
      // Verify user owns this profile
      const { data: profile, error: fetchError } = await supabase
        .from('individuals')
        .select('id, is_default, full_name')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (fetchError || !profile) {
        return NextResponse.json(
          { success: false, error: 'Profile not found or access denied' },
          { status: 404 }
        )
      }

      // Prevent deletion of Golden Profile (default/primary)
      if (profile.is_default) {
        // Fetch connected profiles for the guard dialog
        const [{ data: otherIndividuals }, { data: otherEntities }] = await Promise.all([
          supabase
            .from('individuals')
            .select('id, full_name')
            .eq('auth_user_id', userId)
            .eq('status', 'ACTIVE')
            .neq('id', profileId),
          supabase
            .from('entities')
            .select('id, legal_name, trade_name')
            .eq('status', 'ACTIVE')
            .in('id',
              (await supabase
                .from('entity_members')
                .select('entity_id')
                .eq('individual_id', profileId)
                .eq('status', 'ACTIVE')
              ).data?.map(m => m.entity_id) || []
            )
        ])

        const connectedProfiles = [
          ...(otherIndividuals || []).map(p => ({
            id: p.id,
            type: 'INDIVIDUAL' as const,
            name: p.full_name || 'Individual Profile'
          })),
          ...(otherEntities || []).map(e => ({
            id: e.id,
            type: 'ENTITY' as const,
            name: (e as Record<string, string>).trade_name || (e as Record<string, string>).legal_name || 'Business Profile'
          }))
        ]

        return NextResponse.json(
          {
            success: false,
            error: 'Cannot delete your primary profile. Please delete all connected profiles first.',
            code: 'GOLDEN_PROFILE_PROTECTED',
            data: {
              connected_profiles_count: connectedProfiles.length,
              connected_profiles: connectedProfiles
            }
          },
          { status: 400 }
        )
      }

      // Soft delete: Update status to DELETED
      const { error: deleteError } = await supabase
        .from('individuals')
        .update({
          status: 'DELETED',
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)

      if (deleteError) {
        apiLogger.error('Error deleting individual profile', deleteError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete profile' },
          { status: 500 }
        )
      }

      // Log activity
      await supabase.from('profile_activity_log').insert({
        profile_id: profileId,
        profile_type: 'INDIVIDUAL',
        activity_type: 'PROFILE_DELETED',
        activity_category: 'PROFILE',
        title: 'Profile Deleted',
        description: `Individual profile "${profile.full_name}" was deleted`,
        performed_by: userId
      })

      return NextResponse.json({
        success: true,
        message: 'Profile deleted successfully'
      })

    } else if (profileType === 'ENTITY') {
      // Get user's individual profile
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individualProfile) {
        return NextResponse.json(
          { success: false, error: 'Individual profile not found' },
          { status: 404 }
        )
      }

      // Verify user is admin of this entity
      const { data: membership } = await supabase
        .from('entity_members')
        .select('can_manage_entity')
        .eq('entity_id', profileId)
        .eq('individual_id', individualProfile.id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!membership || !membership.can_manage_entity) {
        return NextResponse.json(
          { success: false, error: 'Only entity administrators can delete entities' },
          { status: 403 }
        )
      }

      // Get entity details
      const { data: entity } = await supabase
        .from('entities')
        .select('id, legal_name, trade_name')
        .eq('id', profileId)
        .maybeSingle()

      if (!entity) {
        return NextResponse.json(
          { success: false, error: 'Entity not found' },
          { status: 404 }
        )
      }

      // Check for active loans
      const { data: activeLoans } = await supabase
        .from('loan_applications')
        .select('id')
        .eq('entity_id', profileId)
        .in('status', ['PENDING', 'APPROVED', 'DISBURSED', 'IN_PROGRESS'])
        .limit(1)

      if (activeLoans && activeLoans.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete entity with active loan applications' },
          { status: 400 }
        )
      }

      // Soft delete entity
      const { error: deleteError } = await supabase
        .from('entities')
        .update({
          status: 'DELETED',
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)

      if (deleteError) {
        apiLogger.error('Error deleting entity', deleteError)
        return NextResponse.json(
          { success: false, error: 'Failed to delete entity' },
          { status: 500 }
        )
      }

      // Deactivate all entity members
      await supabase
        .from('entity_members')
        .update({
          status: 'DELETED',
          updated_at: new Date().toISOString()
        })
        .eq('entity_id', profileId)

      // Log activity
      await supabase.from('profile_activity_log').insert({
        profile_id: profileId,
        profile_type: 'ENTITY',
        activity_type: 'ENTITY_DELETED',
        activity_category: 'PROFILE',
        title: 'Entity Deleted',
        description: `Entity "${entity.legal_name}" was deleted`,
        performed_by: userId
      })

      return NextResponse.json({
        success: true,
        message: 'Entity deleted successfully'
      })

    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid profile type' },
        { status: 400 }
      )
    }
  } catch (error) {
    apiLogger.error('Error in profile delete API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// ══════════════════════════════════════════════
// Entity Field Mapping: Frontend → DB columns
// ══════════════════════════════════════════════
function mapEntityFieldsToDB(frontendData: Record<string, unknown>): Record<string, unknown> {
  const dbData: Record<string, unknown> = {}

  // Fields with same name in frontend and DB
  const directFields = [
    'legal_name', 'description', 'date_of_establishment', 'industry_category',
    'business_nature', 'msme_category', 'website', 'pan_number', 'cin', 'llpin',
    'registration_number', 'registration_authority', 'tan_number', 'udyam_registration_number',
    'shop_establishment_number', 'turnover_current_year', 'turnover_previous_year',
    'profit_current_year', 'profit_previous_year', 'total_assets', 'total_liabilities',
    'net_worth', 'number_of_employees', 'number_of_branches', 'major_customers',
    'major_suppliers', 'logo_url', 'verification_status', 'entity_type_data',
    'gst_status', 'profile_completion_percentage'
  ]
  for (const field of directFields) {
    if (field in frontendData) {
      dbData[field] = frontendData[field]
    }
  }

  // Renamed fields: frontend name → DB column name
  const renamedFields: Record<string, string> = {
    'trading_name': 'trade_name',
    'email': 'email_primary',
    'phone': 'phone_primary',
    'alternate_phone': 'phone_alternate',
    'gst_number': 'gstin',
    'incorporation_date': 'date_of_incorporation',
  }
  for (const [frontendKey, dbKey] of Object.entries(renamedFields)) {
    if (frontendKey in frontendData) {
      dbData[dbKey] = frontendData[frontendKey]
    }
  }

  // Registered address (nested object → flat columns)
  if ('registered_address' in frontendData && frontendData.registered_address) {
    const addr = frontendData.registered_address as Record<string, unknown>
    const addrMap: Record<string, string> = {
      'address_line1': 'reg_address_line_1', 'address_line2': 'reg_address_line_2',
      'landmark': 'reg_landmark', 'city': 'reg_city', 'district': 'reg_district',
      'state': 'reg_state', 'pincode': 'reg_pincode', 'country': 'reg_country',
    }
    for (const [k, v] of Object.entries(addrMap)) {
      if (k in addr) dbData[v] = addr[k]
    }
  }

  // Business address
  if ('business_address_same_as_registered' in frontendData) {
    dbData.biz_address_same_as_reg = frontendData.business_address_same_as_registered
  }
  if ('business_address' in frontendData && frontendData.business_address) {
    const addr = frontendData.business_address as Record<string, unknown>
    const addrMap: Record<string, string> = {
      'address_line1': 'biz_address_line_1', 'address_line2': 'biz_address_line_2',
      'landmark': 'biz_landmark', 'city': 'biz_city', 'district': 'biz_district',
      'state': 'biz_state', 'pincode': 'biz_pincode', 'country': 'biz_country',
      'premises_type': 'biz_premises_type', 'premises_since': 'biz_premises_since',
    }
    for (const [k, v] of Object.entries(addrMap)) {
      if (k in addr) dbData[v] = addr[k]
    }
  }

  return dbData
}
