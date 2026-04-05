export const dynamic = 'force-dynamic'

/**
 * Single Email Signature Management API
 * Super Admin only - Get, update, delete individual signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { validateSignatureTemplate, previewSignature } from '@/lib/email/signature-renderer';
import type { UpdateEmailSignatureRequest, EmailSignature } from '@/types/email';
import { apiLogger } from '@/lib/utils/logger'

// GET /api/admin/email/signatures/[id] - Get single signature
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const adminSupabase = createSupabaseAdmin();

    const { data: signature, error } = await adminSupabase
      .from('email_signatures')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !signature) {
      return NextResponse.json(
        { success: false, error: 'Signature not found' },
        { status: 404 }
      );
    }

    // Get accounts using this signature
    const { data: accountsUsing } = await adminSupabase
      .from('email_account_signatures')
      .select('email_account_id')
      .eq('signature_id', id);

    return NextResponse.json({
      success: true,
      data: {
        ...signature,
        preview: previewSignature(signature as EmailSignature),
        accounts_using: accountsUsing?.length || 0,
      },
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/admin/email/signatures/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email/signatures/[id] - Update signature
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body: UpdateEmailSignatureRequest = await request.json();
    const adminSupabase = createSupabaseAdmin();

    // Get existing signature
    const { data: existingSignature, error: fetchError } = await adminSupabase
      .from('email_signatures')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existingSignature) {
      return NextResponse.json(
        { success: false, error: 'Signature not found' },
        { status: 404 }
      );
    }

    // Validate if template content is being updated
    const htmlToValidate = body.signature_html || existingSignature.signature_html;
    const textToValidate = body.signature_text || existingSignature.signature_text;

    const validation = validateSignatureTemplate(htmlToValidate, textToValidate);
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

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    // Allowed fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.signature_html !== undefined) updateData.signature_html = body.signature_html;
    if (body.signature_text !== undefined) updateData.signature_text = body.signature_text;
    if (body.is_mandatory !== undefined) updateData.is_mandatory = body.is_mandatory;
    if (body.applies_to_roles !== undefined) updateData.applies_to_roles = body.applies_to_roles;
    if (body.applies_to_departments !== undefined) updateData.applies_to_departments = body.applies_to_departments;
    if (body.include_logo !== undefined) updateData.include_logo = body.include_logo;
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
    if (body.logo_width !== undefined) updateData.logo_width = body.logo_width;
    if (body.social_links !== undefined) updateData.social_links = body.social_links;
    if (body.primary_color !== undefined) updateData.primary_color = body.primary_color;
    if (body.secondary_color !== undefined) updateData.secondary_color = body.secondary_color;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    // Handle default flag
    if (body.is_default === true && !existingSignature.is_default) {
      // Unset other defaults
      await adminSupabase
        .from('email_signatures')
        .update({ is_default: false })
        .neq('id', id);
      updateData.is_default = true;
    } else if (body.is_default === false) {
      updateData.is_default = false;
    }

    // Update signature
    const { data: updatedSignature, error: updateError } = await adminSupabase
      .from('email_signatures')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating signature', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update signature' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedSignature,
        preview: previewSignature(updatedSignature as EmailSignature),
      },
      message: 'Signature updated successfully',
    });
  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/email/signatures/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/email/signatures/[id] - Delete signature
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const adminSupabase = createSupabaseAdmin();

    // Check if signature exists and is not default
    const { data: signature, error: fetchError } = await adminSupabase
      .from('email_signatures')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !signature) {
      return NextResponse.json(
        { success: false, error: 'Signature not found' },
        { status: 404 }
      );
    }

    if (signature.is_default) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete default signature. Set another signature as default first.' },
        { status: 400 }
      );
    }

    // Check if signature is in use
    const { data: accountsUsing } = await adminSupabase
      .from('email_account_signatures')
      .select('id')
      .eq('signature_id', id);

    if (accountsUsing && accountsUsing.length > 0) {
      // Option to soft delete
      const force = request.nextUrl.searchParams.get('force') === 'true';

      if (!force) {
        return NextResponse.json(
          {
            success: false,
            error: `Signature is assigned to ${accountsUsing.length} account(s). Use force=true to delete anyway.`,
            accounts_using: accountsUsing.length,
          },
          { status: 400 }
        );
      }

      // Remove assignments first
      await adminSupabase
        .from('email_account_signatures')
        .delete()
        .eq('signature_id', id);
    }

    // Delete signature
    const { error: deleteError } = await adminSupabase
      .from('email_signatures')
      .delete()
      .eq('id', id);

    if (deleteError) {
      apiLogger.error('Error deleting signature', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete signature' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Signature deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Error in DELETE /api/admin/email/signatures/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
