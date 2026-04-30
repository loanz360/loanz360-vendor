
/**
 * Email Accounts Management API
 * Super Admin only - Manage employee email accounts
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { generateUniqueEmail, type EmailExistsChecker } from '@/lib/email/email-generator';
import type {
  CreateEmailAccountRequest,
  BulkCreateEmailAccountsRequest,
  EmailAccountWithUser,
} from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/accounts - List all email accounts
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const department = searchParams.get('department');

    const adminSupabase = createSupabaseAdmin();

    // Build query
    let query = adminSupabase
      .from('email_accounts')
      .select(`
        *,
        user:users!email_accounts_user_id_fkey (
          id,
          email,
          raw_user_meta_data
        ),
        employee:employee_profile!email_accounts_employee_profile_id_fkey (
          id,
          role,
          subrole,
          department,
          designation,
          employee_id
        )
      `, { count: 'exact' });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`email_address.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    query = query.order('created_at', { ascending: false });

    const { data: accounts, error, count } = await query;

    if (error) {
      apiLogger.error('Error fetching email accounts', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    // Transform data for response
    const transformedAccounts: EmailAccountWithUser[] = accounts.map((account: Record<string, unknown>) => ({
      ...account,
      personal_email: (account.user as Record<string, unknown>)?.email || '',
      full_name: ((account.user as Record<string, unknown>)?.raw_user_meta_data as Record<string, unknown>)?.full_name || '',
      avatar_url: ((account.user as Record<string, unknown>)?.raw_user_meta_data as Record<string, unknown>)?.avatar_url || null,
      employee_role: (account.employee as Record<string, unknown>)?.role || 'EMPLOYEE',
      employee_subrole: (account.employee as Record<string, unknown>)?.subrole || null,
      department: (account.employee as Record<string, unknown>)?.department || null,
      designation: (account.employee as Record<string, unknown>)?.designation || null,
      emp_code: (account.employee as Record<string, unknown>)?.employee_id || null,
    }));

    return NextResponse.json({
      success: true,
      data: transformedAccounts,
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/accounts', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/accounts - Create a new email account
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

    const body: CreateEmailAccountRequest = await request.json();

    // Validate required fields
    if (!body.user_id || !body.first_name || !body.last_name) {
      return NextResponse.json(
        { success: false, error: 'user_id, first_name, and last_name are required' },
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

    // Check if user already has an email account
    const { data: existingAccount } = await adminSupabase
      .from('email_accounts')
      .select('id')
      .eq('user_id', body.user_id)
      .maybeSingle();

    if (existingAccount) {
      return NextResponse.json(
        { success: false, error: 'User already has an email account' },
        { status: 400 }
      );
    }

    // Check if email exists function
    const checkEmailExists: EmailExistsChecker = async (email: string) => {
      const { data } = await adminSupabase
        .from('email_accounts')
        .select('id')
        .eq('email_address', email.toLowerCase())
        .maybeSingle();
      return !!data;
    };

    // Generate unique email address
    const generatedEmail = await generateUniqueEmail(
      body.first_name,
      body.last_name,
      config.domain,
      'firstname.lastname',
      checkEmailExists
    );

    // Create email account
    const { data: newAccount, error: createError } = await adminSupabase
      .from('email_accounts')
      .insert({
        user_id: body.user_id,
        employee_profile_id: body.employee_profile_id || null,
        email_address: generatedEmail.email,
        email_local_part: generatedEmail.localPart,
        display_name: body.display_name || generatedEmail.displayName,
        storage_quota_mb: body.storage_quota_mb || 5120,
        daily_send_limit: body.daily_send_limit || config.daily_send_limit_per_user || 500,
        status: 'pending',
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (createError) {
      apiLogger.error('Error creating email account', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create email account' },
        { status: 500 }
      );
    }

    // Log the activity
    await adminSupabase.from('email_activity_logs').insert({
      email_account_id: newAccount.id,
      user_id: user.id,
      action: 'account_created',
      details: {
        created_by: user.id,
        email_address: generatedEmail.email,
      },
    });

    return NextResponse.json({
      success: true,
      data: newAccount,
      message: `Email account ${generatedEmail.email} created successfully`,
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/accounts', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
