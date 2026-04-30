import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// Validation schema for employee creation
const createEmployeeSchema = z.object({
  first_name: z.string().min(2).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  assigned_role_id: z.string().uuid(),
  assigned_sub_role_id: z.string().uuid().optional(),
  assigned_department_id: z.string().uuid().optional(),
  reporting_manager_id: z.string().uuid(),
  assigned_location: z.string().min(1),
  assigned_city: z.string().optional(),
  assigned_state: z.string().optional(),
  assigned_loan_types: z.array(z.string()).optional(),
  date_of_joining: z.string(),
  probation_period_months: z.number().int().positive().optional().default(6),
  // Salary information
  basic_salary: z.number().positive(),
  hra: z.number().min(0).optional(),
  special_allowance: z.number().min(0).optional(),
  transport_allowance: z.number().min(0).optional(),
  medical_allowance: z.number().min(0).optional(),
  other_allowances: z.number().min(0).optional(),
  pf_contribution: z.number().min(0).optional(),
  esi_contribution: z.number().min(0).optional(),
  professional_tax: z.number().min(0).optional(),
  tds: z.number().min(0).optional(),
  benefits: z.array(z.any()).optional(),
  ctc_annual: z.number().positive(),
  payment_frequency: z.enum(['weekly', 'bi-weekly', 'monthly']).optional().default('monthly'),
});

// Helper function to check if user is HR or Super Admin
async function isHROrAdmin(supabase: any): Promise<boolean> {
  const { checkHRAccess } = await import('@/lib/auth/hr-access');
  return checkHRAccess(supabase);
}

// Generate temporary password
function generateTemporaryPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
}

/**
 * GET /api/hr/onboarding/employees
 * Get all employee onboarding records with filters
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient();
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
    const hasAccess = await isHROrAdmin(supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const departmentId = searchParams.get('department_id');
    const reportingManagerId = searchParams.get('reporting_manager_id');

    // Build query
    let query = adminClient
      .from('employee_onboarding')
      .select(`
        *,
        assigned_role:organizational_roles!assigned_role_id(
          id,
          role_name,
          role_code
        ),
        assigned_sub_role:organizational_sub_roles!assigned_sub_role_id(
          id,
          sub_role_name,
          sub_role_code
        ),
        assigned_department:departments!assigned_department_id(
          id,
          name,
          code
        ),
        reporting_manager:employee_profile!reporting_manager_id(
          user_id,
          first_name,
          last_name,
          email
        ),
        created_by_user:employee_profile!created_by(
          user_id,
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('onboarding_status', status);
    }

    if (departmentId) {
      query = query.eq('assigned_department_id', departmentId);
    }

    if (reportingManagerId) {
      query = query.eq('reporting_manager_id', reportingManagerId);
    }

    const { data: employees, error } = await query;

    if (error) {
      apiLogger.error('Error fetching employees', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Transform the data
    const transformedEmployees = employees?.map(emp => ({
      ...emp,
      reporting_manager: emp.reporting_manager ? {
        id: emp.reporting_manager.user_id,
        name: `${emp.reporting_manager.first_name} ${emp.reporting_manager.last_name}`,
        email: emp.reporting_manager.email,
      } : null,
      created_by_user: emp.created_by_user ? {
        id: emp.created_by_user.user_id,
        name: `${emp.created_by_user.first_name} ${emp.created_by_user.last_name}`,
      } : null,
      // Don't expose temporary password in list view
      temporary_password: undefined,
    }));

    return NextResponse.json({
      success: true,
      data: transformedEmployees,
      count: transformedEmployees?.length || 0,
    });
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Unexpected error', { errorId, error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hr/onboarding/employees
 * Create new employee and initiate onboarding (HR only)
 */
export async function POST(request: NextRequest) {
  try {
    // Using CREATE rate limit (permissive) intentionally: onboarding is an infrequent
    // HR-only action, and stricter limits could block batch onboarding workflows
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient();
    const adminClient = createSupabaseAdmin();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is HR or Admin
    const hasAccess = await isHROrAdmin(supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const validatedData = createEmployeeSchema.parse(body);

    // Check if email already exists across all tables
    const [
      { data: existingOnboarding },
      { data: existingProfile },
    ] = await Promise.all([
      adminClient
        .from('employee_onboarding')
        .select('id, email')
        .eq('email', validatedData.email)
        .maybeSingle(),
      adminClient
        .from('employee_profile')
        .select('user_id, email')
        .eq('email', validatedData.email)
        .maybeSingle(),
    ]);

    if (existingOnboarding) {
      return NextResponse.json(
        { success: false, error: 'An employee with this email already exists in onboarding records' },
        { status: 409 }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { success: false, error: 'An employee with this email already exists in the system' },
        { status: 409 }
      );
    }

    // Also check Supabase auth users by querying profiles table (linked to auth.users)
    try {
      const { data: existingAuthProfile } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('email', validatedData.email)
        .maybeSingle();

      if (existingAuthProfile) {
        return NextResponse.json(
          { success: false, error: 'A user account with this email already exists' },
          { status: 409 }
        );
      }
    } catch {
      // Non-blocking: if auth check fails, proceed (createUser will catch duplicates)
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create user in Supabase Auth
    const { data: newUser, error: signUpError } = await adminClient.auth.admin.createUser({
      email: validatedData.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        role: 'employee',
      },
    });

    if (signUpError || !newUser.user) {
      apiLogger.error('Error creating user', signUpError);
      return NextResponse.json(
        { success: false, error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Calculate probation end date
    const joiningDate = new Date(validatedData.date_of_joining);
    const probationMonths = validatedData.probation_period_months;
    const probationEndDate = new Date(joiningDate);
    probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
    // Handle month overflow: if day changed, set to last day of target month
    if (probationEndDate.getDate() !== new Date(joiningDate).getDate()) {
      probationEndDate.setDate(0); // Last day of previous month
    }

    // Create employee onboarding record
    const { data: onboardingRecord, error: onboardingError } = await adminClient
      .from('employee_onboarding')
      .insert({
        user_id: newUser.user.id,
        first_name: validatedData.first_name,
        middle_name: validatedData.middle_name,
        last_name: validatedData.last_name,
        email: validatedData.email,
        phone: validatedData.phone,
        date_of_birth: validatedData.date_of_birth,
        gender: validatedData.gender,
        assigned_role_id: validatedData.assigned_role_id,
        assigned_sub_role_id: validatedData.assigned_sub_role_id,
        assigned_department_id: validatedData.assigned_department_id,
        reporting_manager_id: validatedData.reporting_manager_id,
        assigned_location: validatedData.assigned_location,
        assigned_city: validatedData.assigned_city,
        assigned_state: validatedData.assigned_state,
        assigned_loan_types: JSON.stringify(validatedData.assigned_loan_types || []),
        date_of_joining: validatedData.date_of_joining,
        probation_period_months: validatedData.probation_period_months,
        probation_end_date: probationEndDate.toISOString().split('T')[0],
        temporary_password: hashedPassword, // Store hashed - plaintext only returned in response once
        password_changed: false,
        onboarding_status: 'pending',
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (onboardingError) {
      apiLogger.error('Error creating onboarding record', onboardingError);

      // Rollback: Delete the created user
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned auth user', { userId: newUser.user.id, error: rollbackErr });
      }

      return NextResponse.json(
        { success: false, error: 'Failed to create employee onboarding record' },
        { status: 500 }
      );
    }

    // Create salary record - rollback onboarding + auth user if fails
    const { error: salaryError } = await adminClient
      .from('employee_salary')
      .insert({
        employee_onboarding_id: onboardingRecord.id,
        user_id: newUser.user.id,
        basic_salary: validatedData.basic_salary,
        hra: validatedData.hra || 0,
        special_allowance: validatedData.special_allowance || 0,
        transport_allowance: validatedData.transport_allowance || 0,
        medical_allowance: validatedData.medical_allowance || 0,
        other_allowances: validatedData.other_allowances || 0,
        pf_contribution: validatedData.pf_contribution || 0,
        esi_contribution: validatedData.esi_contribution || 0,
        professional_tax: validatedData.professional_tax || 0,
        tds: validatedData.tds || 0,
        benefits: JSON.stringify(validatedData.benefits || []),
        ctc_annual: validatedData.ctc_annual,
        payment_frequency: validatedData.payment_frequency,
        effective_from: validatedData.date_of_joining,
        created_by: user.id,
      });

    if (salaryError) {
      apiLogger.error('Error creating salary record, rolling back', salaryError);
      // Rollback: delete onboarding record and auth user
      try {
        await adminClient.from('employee_onboarding').delete().eq('id', onboardingRecord.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned onboarding record', { id: onboardingRecord.id, error: rollbackErr });
      }
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned auth user', { userId: newUser.user.id, error: rollbackErr });
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create salary record' },
        { status: 500 }
      );
    }

    // Create login credentials record - rollback salary + onboarding + auth user if fails
    const { error: credentialsError } = await adminClient
      .from('employee_login_credentials')
      .insert({
        user_id: newUser.user.id,
        employee_onboarding_id: onboardingRecord.id,
        password_reset_required: true,
      });

    if (credentialsError) {
      apiLogger.error('Error creating credentials record, rolling back', credentialsError);
      try {
        await adminClient.from('employee_salary').delete().eq('employee_onboarding_id', onboardingRecord.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned salary record', { onboardingId: onboardingRecord.id, error: rollbackErr });
      }
      try {
        await adminClient.from('employee_onboarding').delete().eq('id', onboardingRecord.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned onboarding record', { id: onboardingRecord.id, error: rollbackErr });
      }
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned auth user', { userId: newUser.user.id, error: rollbackErr });
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create login credentials' },
        { status: 500 }
      );
    }

    // Create role assignment history - rollback all previous steps if fails
    const { error: roleHistoryError } = await adminClient
      .from('employee_role_assignment_history')
      .insert({
        user_id: newUser.user.id,
        role_id: validatedData.assigned_role_id,
        sub_role_id: validatedData.assigned_sub_role_id,
        department_id: validatedData.assigned_department_id,
        reporting_manager_id: validatedData.reporting_manager_id,
        effective_from: validatedData.date_of_joining,
        assignment_reason: 'Initial onboarding',
        is_current: true,
        assigned_by: user.id,
      });

    if (roleHistoryError) {
      apiLogger.error('Error creating role history, rolling back', roleHistoryError);
      try {
        await adminClient.from('employee_login_credentials').delete().eq('employee_onboarding_id', onboardingRecord.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned credentials record', { onboardingId: onboardingRecord.id, error: rollbackErr });
      }
      try {
        await adminClient.from('employee_salary').delete().eq('employee_onboarding_id', onboardingRecord.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned salary record', { onboardingId: onboardingRecord.id, error: rollbackErr });
      }
      try {
        await adminClient.from('employee_onboarding').delete().eq('id', onboardingRecord.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned onboarding record', { id: onboardingRecord.id, error: rollbackErr });
      }
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (rollbackErr) {
        apiLogger.error('CRITICAL: Rollback failed - orphaned auth user', { userId: newUser.user.id, error: rollbackErr });
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create role assignment history' },
        { status: 500 }
      );
    }

    // Look up actual role/sub-role/department names for the welcome email
    let subRoleName = 'Employee'
    let departmentName = 'Assigned Department'
    try {
      if (validatedData.assigned_sub_role_id) {
        const { data: subRoleData } = await adminClient
          .from('organizational_sub_roles')
          .select('sub_role_name')
          .eq('id', validatedData.assigned_sub_role_id)
          .maybeSingle();
        if (subRoleData?.sub_role_name) subRoleName = subRoleData.sub_role_name;
      }
      if (validatedData.assigned_department_id) {
        const { data: deptData } = await adminClient
          .from('departments')
          .select('name')
          .eq('id', validatedData.assigned_department_id)
          .maybeSingle();
        if (deptData?.name) departmentName = deptData.name;
      }
    } catch {
      // Non-blocking: use defaults if lookup fails
    }

    // Send welcome email with credentials
    try {
      const { sendEmployeeWelcomeEmail } = await import('@/lib/services/employee-email-service')
      await sendEmployeeWelcomeEmail({
        employee: {
          employee_id: onboardingRecord.id,
          full_name: `${validatedData.first_name} ${validatedData.last_name}`,
          work_email: validatedData.email,
          personal_email: validatedData.email,
          department: departmentName,
          sub_role: subRoleName,
          joining_date: validatedData.date_of_joining,
        },
        credentials: {
          username: validatedData.email,
          temporary_password: temporaryPassword,
          login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/employees/auth/login`,
        },
      })
    } catch (emailErr) {
      apiLogger.error('Failed to send welcome email (non-blocking):', emailErr)
    }

    // Password sent via email only, never in API response
    const { temporary_password: _omitPassword, ...safeOnboardingRecord } = onboardingRecord

    return NextResponse.json({
      success: true,
      message: 'Employee created successfully. Credentials have been sent via email.',
      data: {
        ...safeOnboardingRecord,
        login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'}/employees/auth/login`,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const errorId = crypto.randomUUID()
    apiLogger.error('Unexpected error', { errorId, error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    );
  }
}
