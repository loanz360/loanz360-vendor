
/**
 * Email Signatures Management API
 * Super Admin only - Manage company email signatures
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { validateSignatureTemplate, previewSignature } from '@/lib/email/signature-renderer';
import type { CreateEmailSignatureRequest, EmailSignature } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/signatures - List all signatures
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') === 'true';

    const adminSupabase = createSupabaseAdmin();

    let query = adminSupabase
      .from('email_signatures')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: signatures, error } = await query;

    if (error) {
      apiLogger.error('Error fetching signatures', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch signatures' },
        { status: 500 }
      );
    }

    // Add preview for each signature
    const signaturesWithPreview = signatures.map((sig: EmailSignature) => ({
      ...sig,
      preview: previewSignature(sig),
    }));

    return NextResponse.json({
      success: true,
      data: signaturesWithPreview,
      total: signatures.length,
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/signatures', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/signatures - Create new signature
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      );
    }

    const body: CreateEmailSignatureRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.signature_html || !body.signature_text) {
      return NextResponse.json(
        { success: false, error: 'name, signature_html, and signature_text are required' },
        { status: 400 }
      );
    }

    // Validate signature template
    const validation = validateSignatureTemplate(body.signature_html, body.signature_text);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid signature template',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    const adminSupabase = createSupabaseAdmin();

    // If this is set as default, unset other defaults first
    if (body.is_default) {
      await adminSupabase
        .from('email_signatures')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Get highest sort order
    const { data: lastSignature } = await adminSupabase
      .from('email_signatures')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (lastSignature?.sort_order || 0) + 1;

    // Create signature
    const { data: newSignature, error: createError } = await adminSupabase
      .from('email_signatures')
      .insert({
        name: body.name,
        description: body.description || null,
        signature_html: body.signature_html,
        signature_text: body.signature_text,
        is_default: body.is_default || false,
        is_mandatory: body.is_mandatory || false,
        applies_to_roles: body.applies_to_roles || [],
        applies_to_departments: body.applies_to_departments || [],
        include_logo: body.include_logo ?? true,
        logo_url: body.logo_url || null,
        logo_width: body.logo_width || 150,
        social_links: body.social_links || {},
        primary_color: body.primary_color || '#FF6700',
        secondary_color: body.secondary_color || '#1a1a1a',
        is_active: true,
        sort_order: nextSortOrder,
        created_by: user.id,
      })
      .select()
      .maybeSingle();

    if (createError) {
      apiLogger.error('Error creating signature', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create signature' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...newSignature,
        preview: previewSignature(newSignature),
      },
      message: 'Signature created successfully',
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/admin/email/signatures', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
