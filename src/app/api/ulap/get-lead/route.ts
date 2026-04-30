
/**
 * API Route: ULAP Get Lead
 * GET /api/ulap/get-lead?id=xxx - Get a specific lead by ID for resuming
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('id');
    const leadNumber = searchParams.get('lead_number');

    if (!leadId && !leadNumber) {
      return NextResponse.json(
        { success: false, error: 'Lead ID or Lead Number is required' },
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

    // Build query
    let query = supabase
      .from('leads')
      .select(`
        id,
        lead_number,
        customer_name,
        customer_mobile,
        customer_email,
        customer_city,
        customer_state,
        customer_pincode,
        customer_pan,
        customer_dob,
        customer_subrole,
        loan_type,
        loan_category_id,
        loan_category_code,
        loan_subcategory_id,
        loan_subcategory_code,
        loan_amount,
        loan_purpose,
        monthly_income,
        has_co_applicant,
        co_applicant_name,
        co_applicant_mobile,
        co_applicant_email,
        co_applicant_relationship,
        form_status,
        lead_status,
        application_phase,
        form_completion_percentage,
        short_link,
        short_code,
        phase_1_data,
        phase_2_data,
        property_data,
        document_data,
        collected_data,
        source_type,
        lead_generator_id,
        lead_generator_name,
        source_partner_id,
        source_partner_code,
        created_at,
        updated_at
      `);

    if (leadId) {
      query = query.eq('id', leadId);
    } else if (leadNumber) {
      query = query.eq('lead_number', leadNumber);
    }

    const { data: lead, error: fetchError } = await query.maybeSingle();

    if (fetchError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Verify the user owns this lead (is the lead generator)
    if (lead.lead_generator_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this lead' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    apiLogger.error('Error in ULAP get-lead API', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
