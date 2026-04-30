
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

// Helper function to check if user is HR or Super Admin
async function isHROrSuperAdmin(supabase: any): Promise<boolean> {
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

    // Check if user is HR or Super Admin
    const isAuthorized = await isHROrSuperAdmin(supabase);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR or Super Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('employee_onboarding')
      .select(`
        *,
        department:departments(id, name, code),
        role:organizational_roles(id, role_name, role_code)
      `)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status) {
      const statuses = status.split(',');
      query = query.in('status', statuses);
    }

    const { data: records, error } = await query;

    if (error) {
      apiLogger.error('Error fetching onboarding records', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch onboarding records' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: records || [],
      count: records?.length || 0,
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
