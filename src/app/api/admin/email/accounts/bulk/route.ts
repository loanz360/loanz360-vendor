
/**
 * Bulk Email Account Creation API
 * Super Admin only - Create email accounts for multiple employees at once
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { batchGenerateEmails, type EmailExistsChecker } from '@/lib/email/email-generator';
import type { BulkCreateEmailAccountsRequest } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// POST /api/admin/email/accounts/bulk - Bulk create email accounts
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      );
    }

    const body: BulkCreateEmailAccountsRequest = await request.json();

    if (!body.employee_ids || body.employee_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'employee_ids array is required' },
        { status: 400 }
      );
    }

    const adminSupabase = createSupabaseAdmin();

    // Get email provider config
    const { data: config } = await adminSupabase
      .from('email_provider_config')
      .select('domain, daily_send_limit_per_user')
      .eq('is_active', true)
      .maybeSingle();

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Email provider not configured' },
        { status: 400 }
      );
    }

    // Get employee profiles with user info
    const { data: employees, error: fetchError } = await adminSupabase
      .from('employee_profile')
      .select(`
        id,
        user_id,
        employee_id,
        department,
        designation,
        user:users!employee_profile_user_id_fkey (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .in('id', body.employee_ids);

    if (fetchError || !employees || employees.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid employees found' },
        { status: 400 }
      );
    }

    // Check which employees already have email accounts
    const { data: existingAccounts } = await adminSupabase
      .from('email_accounts')
      .select('user_id')
      .in('user_id', employees.map(e => e.user_id));

    const existingUserIds = new Set(existingAccounts?.map(a => a.user_id) || []);

    // Filter out employees who already have accounts
    const eligibleEmployees = employees.filter(e => !existingUserIds.has(e.user_id));

    if (eligibleEmployees.length === 0) {
      return NextResponse.json(
        { success: false, error: 'All selected employees already have email accounts' },
        { status: 400 }
      );
    }

    // Prepare employee data for batch email generation
    const employeeData = eligibleEmployees.map(emp => {
      const fullName = (emp.user as Record<string, unknown>)?.raw_user_meta_data?.full_name as string || '';
      const nameParts = fullName.split(' ');
      return {
        firstName: nameParts[0] || 'employee',
        lastName: nameParts.slice(1).join(' ') || emp.employee_id || 'user',
        employeeId: emp.employee_id,
        originalData: emp,
      };
    });

    // Check if email exists function
    const checkEmailExists: EmailExistsChecker = async (email: string) => {
      const { data } = await adminSupabase
        .from('email_accounts')
        .select('id')
        .eq('email_address', email.toLowerCase())
        .maybeSingle();
      return !!data;
    };

    // Batch generate emails
    const generatedEmails = await batchGenerateEmails(
      employeeData,
      config.domain,
      'firstname.lastname',
      checkEmailExists
    );

    // Create accounts
    const results = {
      created: [] as string[],
      failed: [] as { employee_id: string; error: string }[],
      skipped: [] as string[],
    };

    for (const empData of employeeData) {
      const key = `${empData.firstName}_${empData.lastName}_${empData.employeeId || ''}`;
      const generatedEmail = generatedEmails.get(key);

      if (!generatedEmail) {
        results.failed.push({
          employee_id: empData.originalData.employee_id,
          error: 'Failed to generate email address',
        });
        continue;
      }

      const { data: newAccount, error: createError } = await adminSupabase
        .from('email_accounts')
        .insert({
          user_id: empData.originalData.user_id,
          employee_profile_id: empData.originalData.id,
          email_address: generatedEmail.email,
          email_local_part: generatedEmail.localPart,
          display_name: generatedEmail.displayName,
          storage_quota_mb: body.storage_quota_mb || 5120,
          daily_send_limit: body.daily_send_limit || config.daily_send_limit_per_user || 500,
          status: 'pending',
          created_by: user.id,
        })
        .select()
        .maybeSingle();

      if (createError) {
        apiLogger.error('Error creating account for', empData.originalData.employee_id, createError);
        results.failed.push({
          employee_id: empData.originalData.employee_id,
          error: createError.message,
        });
      } else {
        results.created.push(generatedEmail.email);

        // Log activity
        await adminSupabase.from('email_activity_logs').insert({
          email_account_id: newAccount.id,
          user_id: user.id,
          action: 'account_created',
          details: {
            created_by: user.id,
            email_address: generatedEmail.email,
            bulk_creation: true,
          },
        });
      }
    }

    // Add skipped employees (already have accounts)
    results.skipped = employees
      .filter(e => existingUserIds.has(e.user_id))
      .map(e => e.employee_id);

    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        requested: body.employee_ids.length,
        created: results.created.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
      },
      message: `Created ${results.created.length} email accounts`,
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/accounts/bulk', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/admin/email/accounts/bulk - Get employees without email accounts
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const adminSupabase = createSupabaseAdmin();

    // Get all employees
    const { data: employees, error: empError } = await adminSupabase
      .from('employee_profile')
      .select(`
        id,
        user_id,
        employee_id,
        role,
        subrole,
        department,
        designation,
        status,
        user:users!employee_profile_user_id_fkey (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('status', 'active');

    if (empError) {
      apiLogger.error('Error fetching employees', empError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Get employees who already have email accounts
    const { data: existingAccounts } = await adminSupabase
      .from('email_accounts')
      .select('user_id');

    const existingUserIds = new Set(existingAccounts?.map(a => a.user_id) || []);

    // Filter to employees without email accounts
    const employeesWithoutEmail = employees?.filter(e => !existingUserIds.has(e.user_id)) || [];

    // Transform for response
    const transformedEmployees = employeesWithoutEmail.map(emp => ({
      id: emp.id,
      user_id: emp.user_id,
      employee_id: emp.employee_id,
      full_name: (emp.user as Record<string, unknown>)?.raw_user_meta_data?.full_name || 'Unknown',
      personal_email: (emp.user as Record<string, unknown>)?.email || '',
      role: emp.role,
      subrole: emp.subrole,
      department: emp.department,
      designation: emp.designation,
    }));

    return NextResponse.json({
      success: true,
      data: transformedEmployees,
      total: transformedEmployees.length,
      total_employees: employees?.length || 0,
      with_email: existingAccounts?.length || 0,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/accounts/bulk', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
