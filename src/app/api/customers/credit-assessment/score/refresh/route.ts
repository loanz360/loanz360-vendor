export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCreditBureauData } from '@/lib/credit-bureau/credit-bureau-service';
import type { BureauName } from '@/lib/credit-bureau/types';
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/credit-assessment/score/refresh
 *
 * Triggers a refresh of credit score from the specified bureau.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bureau } = body as { bureau?: BureauName };

    // Trigger credit bureau data fetch
    const result = await fetchCreditBureauData(
      user.id,
      'CUSTOMER_REQUEST',
      false // Don't force - respect cooldown
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        loans_count: result.loans_count,
        credit_score: result.credit_score,
        next_refresh_at: result.next_refresh_allowed_at
      }
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/customers/credit-assessment/score/refresh', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
