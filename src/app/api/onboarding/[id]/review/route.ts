import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional(),
});

// Helper function to check if user is HR or Super Admin
async function isHROrSuperAdmin(supabase: unknown): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('employee_profile')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  return profile && ['hr', 'superadmin'].includes(profile.role);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if user is HR or Super Admin
    const isAuthorized = await isHROrSuperAdmin(supabase);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR or Super Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const { action, rejection_reason } = reviewSchema.parse(body);

    // Get the onboarding record
    const { data: onboarding, error: fetchError } = await supabase
      .from('employee_onboarding')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (fetchError || !onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Create user account and employee profile
      // First, create auth user
      const tempPassword = generateTemporaryPassword();

      const { data: authUser, error: authUserError } = await supabase.auth.admin.createUser({
        email: onboarding.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: onboarding.first_name,
          last_name: onboarding.last_name,
        },
      });

      if (authUserError) {
        apiLogger.error('Error creating auth user', authUserError);
        return NextResponse.json(
          { success: false, error: 'Failed to create user account' },
          { status: 500 }
        );
      }

      // Create employee profile
      const { error: profileError } = await supabase.from('employee_profile').insert({
        user_id: authUser.user.id,
        employee_id: onboarding.employee_id,
        first_name: onboarding.first_name,
        last_name: onboarding.last_name,
        email: onboarding.email,
        phone: onboarding.phone,
        date_of_birth: onboarding.date_of_birth,
        gender: onboarding.gender,
        address: onboarding.address,
        city: onboarding.city,
        state: onboarding.state,
        pincode: onboarding.pincode,
        date_of_joining: onboarding.date_of_joining,
        department_id: onboarding.department_id,
        role_id: onboarding.role_id,
        employment_type: onboarding.employment_type,
        reporting_manager_id: onboarding.reporting_manager_id,
        status: 'active',
        role: 'employee',
      });

      if (profileError) {
        apiLogger.error('Error creating employee profile', profileError);
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json(
          { success: false, error: 'Failed to create employee profile' },
          { status: 500 }
        );
      }

      // Update onboarding record
      await supabase
        .from('employee_onboarding')
        .update({
          status: 'completed',
          user_id: authUser.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      // Log status change
      await supabase.from('employee_onboarding_status_log').insert({
        onboarding_id: params.id,
        old_status: onboarding.status,
        new_status: 'completed',
        change_reason: 'Approved by HR and account created',
        changed_by: user.id,
      });

      // TODO: Send welcome email with credentials via secure channel (email/SMS)
      // temp_password should NEVER be returned in the API response

      return NextResponse.json({
        success: true,
        message: 'Onboarding approved and employee account created successfully. Login credentials will be sent to the employee via email.',
      });
    } else {
      // Reject onboarding
      await supabase
        .from('employee_onboarding')
        .update({
          status: 'rejected',
          rejection_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      // Log status change
      await supabase.from('employee_onboarding_status_log').insert({
        onboarding_id: params.id,
        old_status: onboarding.status,
        new_status: 'rejected',
        change_reason: rejection_reason || 'Rejected by HR',
        changed_by: user.id,
      });

      // TODO: Send rejection email to employee

      return NextResponse.json({
        success: true,
        message: 'Onboarding rejected successfully',
      });
    }
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

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
