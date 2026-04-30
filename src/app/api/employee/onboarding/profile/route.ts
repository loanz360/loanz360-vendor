import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for profile completion
const profileCompletionSchema = z.object({
  current_address: z.string().min(10),
  current_city: z.string().min(2),
  current_state: z.string().min(2),
  current_pincode: z.string().min(5).max(10),
  permanent_address: z.string().min(10).optional(),
  permanent_city: z.string().min(2).optional(),
  permanent_state: z.string().min(2).optional(),
  permanent_pincode: z.string().min(5).max(10).optional(),
  address_same_as_current: z.boolean().optional(),
  emergency_contact_name: z.string().min(2),
  emergency_contact_relationship: z.string().min(2),
  emergency_contact_phone: z.string().min(10).max(20),
  emergency_contact_email: z.string().email().optional(),
  bank_name: z.string().min(2),
  bank_account_number: z.string().min(5),
  bank_ifsc_code: z.string().min(11).max(11),
  bank_branch: z.string().min(2),
  highest_education: z.string().optional(),
  university_institute: z.string().optional(),
  year_of_passing: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
  total_experience_years: z.number().min(0).optional(),
  previous_employer: z.string().optional(),
  previous_designation: z.string().optional(),
});

/**
 * GET /api/employee/onboarding/profile
 * Get employee's own onboarding profile
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch employee's onboarding record
    const { data: profile, error } = await supabase
      .from('employee_onboarding')
      .select(`
        *,
        assigned_role:organizational_roles!assigned_role_id(
          id,
          role_name,
          role_code,
          description,
          responsibilities,
          duties_tasks
        ),
        assigned_sub_role:organizational_sub_roles!assigned_sub_role_id(
          id,
          sub_role_name,
          sub_role_code,
          description,
          responsibilities
        ),
        assigned_department:departments!assigned_department_id(
          id,
          name,
          code,
          description
        ),
        reporting_manager:employee_profile!reporting_manager_id(
          user_id,
          first_name,
          last_name,
          email,
          phone
        ),
        salary:employee_salary(
          basic_salary,
          hra,
          special_allowance,
          transport_allowance,
          medical_allowance,
          other_allowances,
          gross_salary,
          ctc_annual,
          payment_frequency,
          benefits
        ),
        documents:employee_onboarding_documents(
          id,
          document_type:onboarding_document_types(
            id,
            document_name,
            document_code,
            is_mandatory
          ),
          document_name,
          is_verified,
          verification_notes,
          uploaded_at
        )
      `)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      apiLogger.error('Error fetching profile', error);
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Transform reporting manager data
    const transformedProfile = {
      ...profile,
      reporting_manager: profile.reporting_manager ? {
        id: profile.reporting_manager.user_id,
        name: `${profile.reporting_manager.first_name} ${profile.reporting_manager.last_name}`,
        email: profile.reporting_manager.email,
        phone: profile.reporting_manager.phone,
      } : null,
      // Don't expose temporary password
      temporary_password: undefined,
    };

    return NextResponse.json({
      success: true,
      data: transformedProfile,
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employee/onboarding/profile
 * Complete employee profile (first-time login)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch current onboarding status
    const { data: currentProfile } = await supabase
      .from('employee_onboarding')
      .select('id, onboarding_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!currentProfile) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Only allow updates if status is pending or profile_incomplete
    if (!['pending', 'profile_incomplete', 'documents_pending'].includes(currentProfile.onboarding_status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile cannot be updated in current status',
          current_status: currentProfile.onboarding_status
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const validatedData = profileCompletionSchema.parse(body);

    // If address is same as current, copy current address to permanent
    let updateData = { ...validatedData };
    if (validatedData.address_same_as_current) {
      updateData.permanent_address = validatedData.current_address;
      updateData.permanent_city = validatedData.current_city;
      updateData.permanent_state = validatedData.current_state;
      updateData.permanent_pincode = validatedData.current_pincode;
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('employee_onboarding')
      .update({
        ...updateData,
        profile_completed_at: new Date().toISOString(),
        onboarding_status: 'documents_pending',
      })
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating profile', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile completed successfully',
      data: {
        ...updatedProfile,
        temporary_password: undefined,
      },
      next_step: 'documents_upload',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
