
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

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

    // Get counts for each status
    const { count: totalCount } = await supabase
      .from('employee_onboarding')
      .select('*', { count: 'exact', head: true });

    const { count: pendingCount } = await supabase
      .from('employee_onboarding')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: inProgressCount } = await supabase
      .from('employee_onboarding')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress');

    const { count: completedCount } = await supabase
      .from('employee_onboarding')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    return NextResponse.json({
      success: true,
      data: {
        total: totalCount || 0,
        pending: pendingCount || 0,
        in_progress: inProgressCount || 0,
        completed: completedCount || 0,
      },
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
