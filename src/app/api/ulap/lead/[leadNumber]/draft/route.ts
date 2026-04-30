import { parseBody } from '@/lib/utils/parse-body'

/**
 * ULAP Lead Draft API
 * PUT /api/ulap/lead/[leadNumber]/draft
 *
 * Save draft of Phase 2 application
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ leadNumber: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { leadNumber } = await params;
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;

    if (!leadNumber) {
      return NextResponse.json(
        { error: 'Lead number is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch existing lead from unified leads table
    const { data: existingLead, error: fetchError } = await supabase
      .from('leads')
      .select('id, collected_data, form_status')
      .eq('lead_number', leadNumber)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Don't allow draft save if already submitted
    if (existingLead.form_status === 'PHASE_2_SUBMITTED') {
      return NextResponse.json(
        { error: 'Cannot save draft for submitted application' },
        { status: 400 }
      );
    }

    // Merge new data with existing collected_data
    const currentData = (existingLead.collected_data as Record<string, unknown>) || {};
    const newData = body.collected_data || {};

    const mergedData = {
      ...currentData,
      ...newData,
      draft_saved_at: new Date().toISOString(),
    };

    // Update lead in unified leads table
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        collected_data: mergedData,
        form_status: 'PHASE_2_IN_PROGRESS',
        lead_status: 'PHASE_2_IN_PROGRESS',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLead.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to save draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft saved successfully',
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    apiLogger.error('Save draft error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
