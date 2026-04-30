
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch lead data for public apply page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 });
    }

    // Try to find by UUID first, then by lead_id string
    let query = supabase
      .from('ulap_leads')
      .select(`
        id,
        lead_id,
        status,
        customer_name,
        customer_mobile,
        customer_email,
        applicant_data,
        coapplicant_data,
        otp_verified,
        category_id,
        subcategory_id,
        ulap_loan_categories (id, name, slug),
        ulap_loan_subcategories (id, name, slug)
      `);

    // Check if it's a UUID or lead_id string
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId);

    if (isUUID) {
      query = query.eq('id', leadId);
    } else {
      query = query.eq('lead_id', leadId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    // Check if lead is in a valid state for public access
    const validStatuses = ['OTP_PENDING', 'OTP_VERIFIED', 'LINK_SHARED', 'FORM_OPENED', 'SUBMITTED'];
    if (!validStatuses.includes(data.status)) {
      return NextResponse.json({ success: false, error: 'This application is not accessible' }, { status: 400 });
    }

    // Format response
    const response = {
      lead: {
        id: data.id,
        lead_id: data.lead_id,
        status: data.status,
        customer_name: data.customer_name,
        customer_mobile: data.customer_mobile,
        customer_email: data.customer_email,
        applicant_data: data.applicant_data,
        coapplicant_data: data.coapplicant_data,
        otp_verified: data.otp_verified,
        category: data.ulap_loan_categories,
        subcategory: data.ulap_loan_subcategories,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    apiLogger.error('Error', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
