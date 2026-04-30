import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// Validation schema for approval/rejection
const approvalSchema = z.object({
  employee_onboarding_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
  rejection_reason: z.string().min(10).optional(),
}).refine(data => {
  // If action is reject, rejection_reason is required
  if (data.action === 'reject') {
    return !!data.rejection_reason;
  }
  return true;
}, {
  message: 'Rejection reason is required when rejecting',
  path: ['rejection_reason'],
});

// Helper function to check if user is HR or Super Admin
async function isHROrAdmin(supabase: unknown, adminClient: unknown): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await adminClient
    .from('employee_profile')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  return profile && ['hr', 'superadmin'].includes(profile.role);
}

/**
 * POST /api/hr/onboarding/approve
 * Approve or reject employee onboarding (HR only)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is HR or Admin
    const hasAccess = await isHROrAdmin(supabase, adminClient);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr;
    const validatedData = approvalSchema.parse(body);

    // Get employee onboarding record
    const { data: onboarding, error: onboardingError } = await adminClient
      .from('employee_onboarding')
      .select(`
        *,
        assigned_role:organizational_roles!assigned_role_id(role_name, role_code)
      `)
      .eq('id', validatedData.employee_onboarding_id)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Check if status allows approval
    if (!['pending', 'documents_submitted', 'hr_review'].includes(onboarding.onboarding_status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Onboarding cannot be processed in current status',
          current_status: onboarding.onboarding_status
        },
        { status: 400 }
      );
    }

    if (validatedData.action === 'approve') {
      // APPROVAL FLOW

      // Use optimistic locking: only update if status is still in an approvable state
      // This prevents concurrent approvals from creating duplicate employee profiles
      const { data: updatedRows, error: updateError } = await adminClient
        .from('employee_onboarding')
        .update({
          onboarding_status: 'approved',
          hr_reviewed_at: new Date().toISOString(),
          hr_reviewed_by: user.id,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', validatedData.employee_onboarding_id)
        .in('onboarding_status', ['pending', 'documents_submitted', 'hr_review'])
        .select('id')

      if (updateError) {
        apiLogger.error('Error approving onboarding', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to approve onboarding' },
          { status: 500 }
        );
      }

      // If no rows updated, another request already processed this record
      if (!updatedRows || updatedRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'This onboarding record has already been processed by another user' },
          { status: 409 }
        );
      }

      // Look up department name from UUID
      const { data: dept } = await adminClient
        .from('departments')
        .select('name')
        .eq('id', onboarding.assigned_department_id)
        .maybeSingle();

      // Generate employee_id if not present on onboarding record
      let employeeId = onboarding.employee_id
      if (!employeeId) {
        const { data: lastEmp } = await adminClient
          .from('employees')
          .select('employee_id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const lastNum = lastEmp?.employee_id ? parseInt(lastEmp.employee_id.replace(/\D/g, '')) : 0
        employeeId = `EMP${String((lastNum || 0) + 1).padStart(3, '0')}`
      }

      // Create employee profile record
      const { error: profileError } = await adminClient
        .from('employee_profile')
        .upsert({
          user_id: onboarding.user_id,
          employee_id: employeeId,
          first_name: onboarding.first_name,
          middle_name: onboarding.middle_name,
          last_name: onboarding.last_name,
          email: onboarding.email,
          phone: onboarding.phone,
          date_of_birth: onboarding.date_of_birth,
          gender: onboarding.gender,
          role: onboarding.assigned_role?.role_code || onboarding.assigned_role?.role_name || 'employee',
          department: dept?.name || '',
          reporting_manager: onboarding.reporting_manager_id,
          location: onboarding.assigned_location,
          status: 'active',
          date_of_joining: onboarding.date_of_joining,
          probation_end_date: onboarding.probation_end_date,
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        apiLogger.error('CRITICAL: Error creating employee profile after onboarding approval', {
          error: profileError,
          employee_id: onboarding.employee_id,
          user_id: onboarding.user_id
        });
        // Revert the approval since profile creation failed
        await adminClient
          .from('employee_onboarding')
          .update({ onboarding_status: 'hr_review' })
          .eq('id', validatedData.employee_onboarding_id);
        return NextResponse.json(
          { success: false, error: 'Failed to create employee profile. Approval has been reverted. Please try again.' },
          { status: 500 }
        );
      }

      // Update login credentials to mark first approval
      const { error: credentialsError } = await adminClient
        .from('employee_login_credentials')
        .update({
          account_locked: false,
        })
        .eq('user_id', onboarding.user_id);

      if (credentialsError) {
        apiLogger.error('Error updating login credentials', credentialsError);
      }

      // TODO: Send approval email to employee
      // TODO: Send welcome email with next steps

      return NextResponse.json({
        success: true,
        message: 'Employee onboarding approved successfully',
        data: {
          employee_id: onboarding.employee_id,
          employee_name: `${onboarding.first_name} ${onboarding.last_name}`,
          status: 'approved',
          approved_at: new Date().toISOString(),
        },
      });
    } else {
      // REJECTION FLOW

      // Update onboarding status to rejected
      const { error: updateError } = await adminClient
        .from('employee_onboarding')
        .update({
          onboarding_status: 'rejected',
          hr_reviewed_at: new Date().toISOString(),
          hr_reviewed_by: user.id,
          rejection_reason: validatedData.rejection_reason,
        })
        .eq('id', validatedData.employee_onboarding_id);

      if (updateError) {
        apiLogger.error('Error rejecting onboarding', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to reject onboarding' },
          { status: 500 }
        );
      }

      // TODO: Send rejection email to employee with reason
      // TODO: Optionally allow re-submission

      return NextResponse.json({
        success: true,
        message: 'Employee onboarding rejected',
        data: {
          employee_id: onboarding.employee_id,
          employee_name: `${onboarding.first_name} ${onboarding.last_name}`,
          status: 'rejected',
          rejection_reason: validatedData.rejection_reason,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const errorId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    apiLogger.error('Unexpected error', { errorId, error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    );
  }
}
