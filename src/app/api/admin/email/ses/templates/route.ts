import { parseBody } from '@/lib/utils/parse-body'
/**
 * Amazon SES Templates Management API
 * CRUD operations for SES email templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { initializeSESService } from '@/lib/email/ses-service';
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email/ses/templates
 * List all SES templates or get a specific template
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
    const templateName = searchParams.get('name');

    const sesService = await initializeSESService();

    if (templateName) {
      // Get specific template
      const template = await sesService.getTemplate(templateName);
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ template });
    }

    // List all templates
    const templates = await sesService.listTemplates();
    return NextResponse.json({ templates });
  } catch (error: unknown) {
    apiLogger.error('[SES Templates] Error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/ses/templates
 * Create a new SES template
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const { templateName, subject, htmlBody, textBody, testRender, testData } = body;

    if (!templateName || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: templateName, subject' },
        { status: 400 }
      );
    }

    if (!htmlBody && !textBody) {
      return NextResponse.json(
        { error: 'At least one of htmlBody or textBody is required' },
        { status: 400 }
      );
    }

    const sesService = await initializeSESService();

    // If testRender is requested, render the template first
    if (testRender && testData) {
      // Create temporary template
      const tempName = `temp_${Date.now()}`;
      await sesService.createTemplate({
        templateName: tempName,
        subject,
        htmlBody,
        textBody,
      });

      const rendered = await sesService.testRenderTemplate(tempName, testData);
      await sesService.deleteTemplate(tempName);

      return NextResponse.json({
        success: true,
        preview: rendered,
      });
    }

    // Create the template
    const success = await sesService.createTemplate({
      templateName,
      subject,
      htmlBody,
      textBody,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    // Also store in database for reference
    await supabase.from('communication_templates').insert({
      name: templateName,
      type: 'email',
      provider: 'ses',
      subject,
      html_body: htmlBody,
      text_body: textBody,
      is_active: true,
      created_by: user.id,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      templateName,
      message: 'Template created successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Templates] Error creating', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email/ses/templates
 * Update an existing SES template (delete and recreate)
 */
export async function PUT(request: NextRequest) {
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

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2;
    const { templateName, subject, htmlBody, textBody } = body;

    if (!templateName) {
      return NextResponse.json(
        { error: 'Missing templateName' },
        { status: 400 }
      );
    }

    const sesService = await initializeSESService();

    // Delete existing template
    await sesService.deleteTemplate(templateName);

    // Create updated template
    const success = await sesService.createTemplate({
      templateName,
      subject,
      htmlBody,
      textBody,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      );
    }

    // Update in database
    await supabase
      .from('communication_templates')
      .update({
        subject,
        html_body: htmlBody,
        text_body: textBody,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('name', templateName)
      .eq('provider', 'ses');

    return NextResponse.json({
      success: true,
      templateName,
      message: 'Template updated successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Templates] Error updating', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email/ses/templates
 * Delete an SES template
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
    const templateName = searchParams.get('name');

    if (!templateName) {
      return NextResponse.json(
        { error: 'Missing templateName' },
        { status: 400 }
      );
    }

    const sesService = await initializeSESService();

    const success = await sesService.deleteTemplate(templateName);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      );
    }

    // Mark as inactive in database
    await supabase
      .from('communication_templates')
      .update({
        is_active: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('name', templateName)
      .eq('provider', 'ses');

    return NextResponse.json({
      success: true,
      templateName,
      message: 'Template deleted successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Templates] Error deleting', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
