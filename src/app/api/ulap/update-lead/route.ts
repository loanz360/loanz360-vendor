import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * API Route: ULAP Lead Update (Phase 2)
 * PATCH /api/ulap/update-lead - Update an existing lead with Phase 2 data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyStatusChange } from '@/lib/notifications/ulap-lead-notifications';
import { apiLogger } from '@/lib/utils/logger'

export async function PATCH(request: NextRequest) {
  try {
    const bodySchema = z.object({

      lead_id: z.string().uuid(),

      is_complete: z.boolean().optional(),

      property_data: z.string().optional(),

      document_data: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;

    // Required: lead_id to update
    if (!body.lead_id) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the existing lead to verify ownership (include fields for notification)
    const { data: existingLead, error: fetchError } = await supabase
      .from('leads')
      .select('id, lead_number, lead_generator_id, form_status, phase_1_data, customer_name, customer_mobile, customer_email, loan_type, required_loan_amount, partner_id')
      .eq('id', body.lead_id)
      .maybeSingle();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Verify the user owns this lead (is the lead generator)
    if (existingLead.lead_generator_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this lead' },
        { status: 403 }
      );
    }

    // Build phase_2_data with all submitted fields
    const phase2Data: Record<string, unknown> = {
      submitted_at: new Date().toISOString(),
    };

    // System fields to exclude from phase_2_data
    const systemFields = new Set([
      'lead_id', 'form_source', 'source_partner_type', 'partner_name',
    ]);

    for (const [key, value] of Object.entries(body)) {
      if (!systemFields.has(key) && value !== undefined) {
        phase2Data[key] = value;
      }
    }

    // Field mapping for Phase 2 (maps form fields to CRM columns)
    const fieldToCrmColumn: Record<string, string> = {
      // Extended customer fields
      customer_address: 'customer_address',
      customer_gender: 'customer_gender',
      customer_marital_status: 'customer_marital_status',
      customer_aadhaar: 'customer_aadhaar',
      // Income fields
      monthly_income: 'monthly_income',
      annual_income: 'annual_income',
      other_income: 'other_income',
      income_proof_type: 'income_proof_type',
      // Loan fields
      loan_tenure_months: 'loan_tenure_months',
      loan_purpose_detail: 'loan_purpose_detail',
      // Co-applicant fields
      co_applicant_income: 'co_applicant_income',
    };

    // Prepare update data
    const updateData: Record<string, unknown> = {
      // Update form status
      form_status: body.is_complete ? 'PHASE_2_SUBMITTED' : 'PHASE_2_IN_PROGRESS',
      lead_status: body.is_complete ? 'PHASE_2_SUBMITTED' : 'PHASE_2_IN_PROGRESS',
      application_phase: 2,
      form_completion_percentage: body.is_complete ? 100 : 60,
      phase_2_submitted_at: body.is_complete ? new Date().toISOString() : null,

      // Store phase 2 data in JSONB
      phase_2_data: phase2Data,

      // Update timestamp
      updated_at: new Date().toISOString(),
    };

    // Dynamically map form fields to CRM columns
    for (const [formField, crmColumn] of Object.entries(fieldToCrmColumn)) {
      if (body[formField] !== undefined && body[formField] !== null && body[formField] !== '') {
        updateData[crmColumn] = body[formField];
      }
    }

    // If property data is provided, store in property_data JSONB
    if (body.property_data) {
      updateData.property_data = body.property_data;
    }

    // If document data is provided, store in document_data JSONB
    if (body.document_data) {
      updateData.document_data = body.document_data;
    }

    // Update the lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', body.lead_id)
      .select('id, lead_number, form_status, lead_status')
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating lead', updateError);
      return NextResponse.json(
        { success: false, error: `Failed to update lead: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Send status change notification when Phase 2 is completed (non-blocking)
    if (body.is_complete) {
      notifyStatusChange(
        body.lead_id,
        existingLead.lead_number || body.lead_id,
        existingLead.customer_name || '',
        existingLead.customer_mobile || '',
        existingLead.customer_email || undefined,
        existingLead.loan_type || 'Not Specified',
        existingLead.required_loan_amount || 0,
        existingLead.form_status || 'PHASE_1_SUBMITTED',
        'PHASE_2_SUBMITTED',
        existingLead.partner_id || undefined
      ).catch(error => {
        apiLogger.error('Failed to send Phase 2 completion notification', error);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedLead.id,
        lead_number: updatedLead.lead_number,
        form_status: updatedLead.form_status,
        lead_status: updatedLead.lead_status,
        is_complete: body.is_complete || false,
      },
      message: body.is_complete
        ? 'Lead application completed successfully!'
        : 'Lead updated successfully. You can continue later.',
    });
  } catch (error) {
    apiLogger.error('Error in ULAP update-lead API', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
