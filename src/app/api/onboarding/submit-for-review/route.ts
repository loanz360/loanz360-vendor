
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

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

    // Get user's onboarding record
    const { data: onboarding, error: onboardingError } = await supabase
      .from('employee_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (onboardingError || !onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Check if profile is complete
    if (onboarding.profile_completion_percentage < 100) {
      return NextResponse.json(
        { success: false, error: 'Please complete your profile before submitting' },
        { status: 400 }
      );
    }

    // Check if all mandatory documents are uploaded
    if (onboarding.documents_completion_percentage < 100) {
      return NextResponse.json(
        { success: false, error: 'Please upload all mandatory documents before submitting' },
        { status: 400 }
      );
    }

    // Update onboarding status to pending review
    const { error: updateError } = await supabase
      .from('employee_onboarding')
      .update({
        status: 'pending',
        first_login_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboarding.id);

    if (updateError) {
      apiLogger.error('Error updating onboarding status', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to submit for review' },
        { status: 500 }
      );
    }

    // Log status change
    await supabase.from('employee_onboarding_status_log').insert({
      onboarding_id: onboarding.id,
      old_status: onboarding.status,
      new_status: 'pending',
      change_reason: 'Employee completed profile and submitted for HR review',
      changed_by: user.id,
    });

    // TODO: Send notification to HR

    return NextResponse.json({
      success: true,
      message: 'Profile submitted for HR review successfully',
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
