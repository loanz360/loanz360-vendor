
/**
 * Email Quota Check API Route
 * Check if an account can send email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getQuotaService } from '@/lib/email/quota';
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin/email/quota/check
 * Check if an account can send email
 * Body: { accountId, recipientCount?, attachmentSizeMb? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, recipientCount, attachmentSizeMb } = body;

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'Account ID is required' }, { status: 400 });
    }

    const quotaService = getQuotaService();
    const result = await quotaService.canSendEmail(
      accountId,
      recipientCount || 1,
      attachmentSizeMb || 0
    );

    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason,
      quotaUsage: result.quotaUsage,
    });
  } catch (error) {
    apiLogger.error('[Quota Check API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to check quota' },
      { status: 500 }
    );
  }
}
