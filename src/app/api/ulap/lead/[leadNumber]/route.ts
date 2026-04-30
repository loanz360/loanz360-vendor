
/**
 * ULAP Lead API
 * GET /api/ulap/lead/[leadNumber]
 *
 * Get lead details by lead number (for Phase 2 form)
 * Uses the unified `leads` table
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ leadNumber: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { leadNumber } = await params;

    if (!leadNumber) {
      return NextResponse.json(
        { error: 'Lead number is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch lead data from unified leads table
    const { data: lead, error } = await supabase
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
        customer_gender,
        loan_type,
        loan_amount,
        loan_category_id,
        loan_category_code,
        loan_subcategory_id,
        loan_subcategory_code,
        loan_purpose,
        form_status,
        lead_status,
        application_phase,
        form_completion_percentage,
        phase_1_data,
        phase_2_data,
        collected_data,
        source_type,
        lead_generator_id,
        lead_generator_name,
        has_co_applicant,
        co_applicant_name,
        co_applicant_mobile,
        co_applicant_email,
        co_applicant_relationship,
        short_link,
        short_code,
        cam_required,
        cam_status,
        created_at,
        updated_at
      `)
      .eq('lead_number', leadNumber)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Check if property details are required based on loan subcategory
    let requiresPropertyDetails = false;
    if (lead.loan_subcategory_code) {
      const { data: subcategory } = await supabase
        .from('ulap_loan_subcategories')
        .select('requires_property_details')
        .eq('code', lead.loan_subcategory_code)
        .maybeSingle();

      if (subcategory) {
        requiresPropertyDetails = subcategory.requires_property_details;
      }
    }

    return NextResponse.json({
      success: true,
      lead: {
        ...lead,
        requires_property_details: requiresPropertyDetails,
      },
    });
  } catch (error) {
    apiLogger.error('Get lead error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
