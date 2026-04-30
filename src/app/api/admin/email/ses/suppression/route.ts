import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Amazon SES Suppression List Management API
 * Manage bounced and complained email addresses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { initializeSESService } from '@/lib/email/ses-service';
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email/ses/suppression
 * List suppressed email addresses
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const reason = searchParams.get('reason') as 'BOUNCE' | 'COMPLAINT' | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const sesService = await initializeSESService();

    // Check specific email
    if (email) {
      const isSuppressed = await sesService.isEmailSuppressed(email);
      return NextResponse.json({
        email,
        suppressed: isSuppressed,
      });
    }

    // List all suppressed emails
    const suppressedList = await sesService.listSuppressedEmails({
      reason: reason || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json({
      count: suppressedList.length,
      suppressedEmails: suppressedList,
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Suppression] Error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/ses/suppression
 * Add email to suppression list
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const bodySchema = z.object({


      email: z.string().email(),


      reason: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { email, reason } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email' },
        { status: 400 }
      );
    }

    if (!reason || !['BOUNCE', 'COMPLAINT'].includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid reason. Must be BOUNCE or COMPLAINT' },
        { status: 400 }
      );
    }

    const sesService = await initializeSESService();

    const success = await sesService.suppressEmail(email, reason);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add email to suppression list' },
        { status: 500 }
      );
    }

    // Also add to our opt-out table
    await supabase.from('communication_optouts').upsert(
      {
        identifier: email,
        identifier_type: 'email',
        channel: 'email',
        reason: reason.toLowerCase(),
        source: 'admin_manual',
        is_active: true,
        opted_out_at: new Date().toISOString(),
      },
      {
        onConflict: 'identifier,channel',
      }
    );

    return NextResponse.json({
      success: true,
      email,
      reason,
      message: 'Email added to suppression list',
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Suppression] Error adding', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email/ses/suppression
 * Remove email from suppression list
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email' },
        { status: 400 }
      );
    }

    const sesService = await initializeSESService();

    const success = await sesService.unsuppressEmail(email);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove email from suppression list' },
        { status: 500 }
      );
    }

    // Also update our opt-out table
    await supabase
      .from('communication_optouts')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('identifier', email)
      .eq('channel', 'email');

    return NextResponse.json({
      success: true,
      email,
      message: 'Email removed from suppression list',
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Suppression] Error removing', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
