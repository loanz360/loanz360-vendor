export const dynamic = 'force-dynamic'

/**
 * Email Aliases API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getAliasService } from '@/lib/email/aliases';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/aliases
 * List aliases
 * Query params: type, accountId, isActive
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'personal' | 'department' | 'distribution' | 'catchall' | null;
    const accountId = searchParams.get('accountId');
    const isActive = searchParams.get('isActive') === 'true' ? true :
                     searchParams.get('isActive') === 'false' ? false : undefined;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const aliasService = getAliasService();
    const aliases = await aliasService.getAliases({
      type: type || undefined,
      accountId: accountId || undefined,
      isActive,
    });

    return NextResponse.json({ aliases });
  } catch (error) {
    apiLogger.error('[Aliases API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch aliases' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/aliases
 * Create a new alias
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

    if (!body.aliasAddress || !body.aliasType) {
      return NextResponse.json(
        { error: 'aliasAddress and aliasType are required' },
        { status: 400 }
      );
    }

    const aliasService = getAliasService();
    const result = await aliasService.createAlias(body, user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { aliasId: result.aliasId, message: 'Alias created successfully' },
      { status: 201 }
    );
  } catch (error) {
    apiLogger.error('[Aliases API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to create alias' },
      { status: 500 }
    );
  }
}
