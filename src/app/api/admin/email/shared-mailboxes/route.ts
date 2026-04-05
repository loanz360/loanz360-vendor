export const dynamic = 'force-dynamic'

/**
 * Shared Mailboxes API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getAliasService } from '@/lib/email/aliases';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/shared-mailboxes
 * List shared mailboxes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'shared' | 'room' | 'equipment' | 'team' | null;
    const departmentId = searchParams.get('departmentId');
    const isActive = searchParams.get('isActive') === 'true' ? true :
                     searchParams.get('isActive') === 'false' ? false : undefined;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const aliasService = getAliasService();
    const mailboxes = await aliasService.getSharedMailboxes({
      type: type || undefined,
      departmentId: departmentId || undefined,
      isActive,
    });

    return NextResponse.json({ mailboxes });
  } catch (error) {
    apiLogger.error('[Shared Mailboxes API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared mailboxes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/shared-mailboxes
 * Create a shared mailbox
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('user')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['super_admin', 'admin', 'email_admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.emailAddress || !body.displayName || !body.mailboxType) {
      return NextResponse.json(
        { error: 'emailAddress, displayName, and mailboxType are required' },
        { status: 400 }
      );
    }

    const aliasService = getAliasService();
    const result = await aliasService.createSharedMailbox(body, user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { mailboxId: result.mailboxId, message: 'Shared mailbox created successfully' },
      { status: 201 }
    );
  } catch (error) {
    apiLogger.error('[Shared Mailboxes API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to create shared mailbox' },
      { status: 500 }
    );
  }
}
