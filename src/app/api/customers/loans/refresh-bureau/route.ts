import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCreditBureauData } from '@/lib/credit-bureau/credit-bureau-service';
import type { RefreshBureauResponse } from '@/lib/credit-bureau/types';
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/loans/refresh-bureau
 * Trigger a fresh fetch of credit bureau data
 * Rate limited to once per 30 days (admins can force)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as RefreshBureauResponse,
        { status: 401 }
      );
    }

    // Parse request body
    let force = false;
    try {
      const bodySchema = z.object({

        force: z.string().optional(),

      })

      const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
      force = body.force === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Check if user is admin (only admins can force refresh)
    if (force) {
      const { data: userRole } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const isAdmin = userRole?.role && ['ADMIN', 'SUPER_ADMIN'].includes(userRole.role);
      if (!isAdmin) {
        force = false; // Non-admins cannot force refresh
      }
    }

    // Fetch credit bureau data
    const result = await fetchCreditBureauData(
      user.id,
      'MANUAL_REFRESH',
      force
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || 'Failed to fetch credit data',
          next_refresh_allowed_at: result.next_refresh_allowed_at
        } as RefreshBureauResponse,
        { status: result.error?.includes('not allowed') ? 429 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${result.loans_count} loans from credit bureau`,
      loans_found: result.loans_count,
      credit_score: result.credit_score,
      next_refresh_allowed_at: result.next_refresh_allowed_at
    } as RefreshBureauResponse);
  } catch (error) {
    apiLogger.error('Error refreshing bureau data', error);
    return NextResponse.json(
      {
        success: false,
      } as RefreshBureauResponse,
      { status: 500 }
    );
  }
}
