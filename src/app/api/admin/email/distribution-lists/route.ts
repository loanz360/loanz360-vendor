import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Distribution Lists API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getAliasService } from '@/lib/email/aliases';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin/email/distribution-lists
 * List distribution lists
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'static' | 'dynamic' | 'security' | null;
    const departmentId = searchParams.get('departmentId');
    const isActive = searchParams.get('isActive') === 'true' ? true :
                     searchParams.get('isActive') === 'false' ? false : undefined;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const aliasService = getAliasService();
    const lists = await aliasService.getDistributionLists({
      type: type || undefined,
      departmentId: departmentId || undefined,
      isActive,
    });

    return NextResponse.json({ lists });
  } catch (error) {
    apiLogger.error('[Distribution Lists API] GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch distribution lists' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/distribution-lists
 * Create a distribution list
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

    const bodySchema = z.object({


      emailAddress: z.string().email().optional(),


      displayName: z.string().optional(),


      listType: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;

    if (!body.emailAddress || !body.displayName || !body.listType) {
      return NextResponse.json(
        { error: 'emailAddress, displayName, and listType are required' },
        { status: 400 }
      );
    }

    const aliasService = getAliasService();
    const result = await aliasService.createDistributionList(body, user.id);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { listId: result.listId, message: 'Distribution list created successfully' },
      { status: 201 }
    );
  } catch (error) {
    apiLogger.error('[Distribution Lists API] POST error', error);
    return NextResponse.json(
      { error: 'Failed to create distribution list' },
      { status: 500 }
    );
  }
}
