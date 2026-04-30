
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
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
    const { data: onboarding } = await supabase
      .from('employee_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding record not found' },
        { status: 404 }
      );
    }

    // Fetch uploaded documents
    const { data: documents, error } = await supabase
      .from('employee_onboarding_documents')
      .select('*')
      .eq('onboarding_id', onboarding.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      apiLogger.error('Error fetching documents', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: documents || [],
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
