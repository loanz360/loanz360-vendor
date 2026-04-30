import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

const createOnboardingSchema = z.object({
  employee_id: z.string().optional(),
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  date_of_joining: z.string(),
  department_id: z.string().uuid(),
  role_id: z.string().uuid(),
  employment_type: z.string(),
  salary_ctc: z.string().optional(),
  reporting_manager_id: z.string().uuid().optional(),
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

// Generate employee ID
function generateEmployeeId(): string {
  const prefix = 'EMP';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
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
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr;
    const validatedData = createOnboardingSchema.parse(body);

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('employee_onboarding')
      .select('id')
      .eq('email', validatedData.email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'An employee with this email already exists' },
        { status: 400 }
      );
    }

    // Generate employee ID if not provided
    const employeeId = validatedData.employee_id || generateEmployeeId();

    // Check if employee ID already exists
    if (validatedData.employee_id) {
      const { data: existingId } = await supabase
        .from('employee_onboarding')
        .select('id')
        .eq('employee_id', validatedData.employee_id)
        .maybeSingle();

      if (existingId) {
        return NextResponse.json(
          { success: false, error: 'Employee ID already exists' },
          { status: 400 }
        );
      }
    }

    // Prepare onboarding data
    const onboardingData = {
      employee_id: employeeId,
      first_name: validatedData.first_name,
      last_name: validatedData.last_name,
      email: validatedData.email,
      phone: validatedData.phone || null,
      date_of_birth: validatedData.date_of_birth || null,
      gender: validatedData.gender || null,
      address: validatedData.address || null,
      city: validatedData.city || null,
      state: validatedData.state || null,
      pincode: validatedData.pincode || null,
      emergency_contact_name: validatedData.emergency_contact_name || null,
      emergency_contact_phone: validatedData.emergency_contact_phone || null,
      date_of_joining: validatedData.date_of_joining,
      department_id: validatedData.department_id,
      role_id: validatedData.role_id,
      employment_type: validatedData.employment_type,
      salary_ctc: validatedData.salary_ctc ? parseFloat(validatedData.salary_ctc) : null,
      reporting_manager_id: validatedData.reporting_manager_id || null,
      status: 'in_progress', // Set to in_progress so employee can complete their profile
      profile_completion_percentage: 60, // Basic info is provided by HR
      documents_completion_percentage: 0,
      first_login_completed: false,
      created_by_hr: user.id,
    };

    // Create onboarding record
    const { data: newOnboarding, error: insertError } = await supabase
      .from('employee_onboarding')
      .insert(onboardingData)
      .select()
      .maybeSingle();

    if (insertError) {
      apiLogger.error('Error creating onboarding', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create onboarding record' },
        { status: 500 }
      );
    }

    // Create initial status log
    await supabase.from('employee_onboarding_status_log').insert({
      onboarding_id: newOnboarding.id,
      old_status: null,
      new_status: 'in_progress',
      change_reason: 'Onboarding initiated by HR',
      changed_by: user.id,
    });

    // TODO: Send welcome email to employee with login credentials

    return NextResponse.json({
      success: true,
      message: 'Employee onboarding created successfully',
      data: newOnboarding,
    }, { status: 201 });
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
