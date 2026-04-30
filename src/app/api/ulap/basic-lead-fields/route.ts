
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default basic lead fields (fallback if database is empty)
const DEFAULT_BASIC_LEAD_FIELDS = [
  { field_key: 'full_name', label: 'Full Name', field_type: 'text', placeholder: 'Enter full name as per ID', is_required: true, is_default: true, display_order: 1, is_visible: true, validation_rules: { minLength: 2, maxLength: 100 } },
  { field_key: 'mobile', label: 'Mobile Number', field_type: 'phone', placeholder: '10-digit mobile number', is_required: true, is_default: true, display_order: 2, is_visible: true, validation_rules: { pattern: '^[6-9]\\d{9}$' } },
  { field_key: 'email', label: 'Email Address', field_type: 'email', placeholder: 'email@example.com', is_required: false, is_default: true, display_order: 3, is_visible: true, validation_rules: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' } },
  { field_key: 'loan_amount', label: 'Loan Amount Required', field_type: 'currency', placeholder: 'Enter amount in INR', is_required: true, is_default: true, display_order: 4, is_visible: true, validation_rules: { min: 10000 } },
  { field_key: 'city', label: 'City', field_type: 'text', placeholder: 'Enter your city', is_required: true, is_default: true, display_order: 5, is_visible: true, validation_rules: { minLength: 2 } },
  { field_key: 'pincode', label: 'Pincode', field_type: 'text', placeholder: '6-digit pincode', is_required: false, is_default: true, display_order: 6, is_visible: true, validation_rules: { pattern: '^[1-9][0-9]{5}$' } },
  { field_key: 'employment_type', label: 'Employment Type', field_type: 'select', placeholder: 'Select employment type', is_required: false, is_default: true, display_order: 7, is_visible: true, validation_rules: {} },
  { field_key: 'monthly_income', label: 'Monthly Income', field_type: 'currency', placeholder: 'Gross monthly income', is_required: false, is_default: false, display_order: 8, is_visible: true, validation_rules: { min: 0 } },
  { field_key: 'company_name', label: 'Company/Business Name', field_type: 'text', placeholder: 'Current employer or business', is_required: false, is_default: false, display_order: 9, is_visible: true, validation_rules: {} },
  { field_key: 'existing_loans', label: 'Existing Loan EMI', field_type: 'currency', placeholder: 'Total monthly EMI payments', is_required: false, is_default: false, display_order: 10, is_visible: true, validation_rules: { min: 0 } },
];

// GET - Fetch all basic lead fields
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const defaultOnly = searchParams.get('default_only') === 'true';

    let query = supabase
      .from('ulap_basic_lead_fields')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (defaultOnly) {
      query = query.eq('is_default', true);
    }

    const { data: fields, error } = await query;

    if (error) {
      apiLogger.error('Error fetching basic lead fields', error);
      // Return default fields as fallback
      return NextResponse.json({
        success: true,
        fields: defaultOnly
          ? DEFAULT_BASIC_LEAD_FIELDS.filter(f => f.is_default)
          : DEFAULT_BASIC_LEAD_FIELDS,
        count: DEFAULT_BASIC_LEAD_FIELDS.length,
        source: 'fallback',
      });
    }

    // If no fields in database, return defaults
    if (!fields || fields.length === 0) {
      return NextResponse.json({
        success: true,
        fields: defaultOnly
          ? DEFAULT_BASIC_LEAD_FIELDS.filter(f => f.is_default)
          : DEFAULT_BASIC_LEAD_FIELDS,
        count: DEFAULT_BASIC_LEAD_FIELDS.length,
        source: 'fallback',
      });
    }

    return NextResponse.json({
      success: true,
      fields,
      count: fields.length,
      source: 'database',
    });
  } catch (error) {
    apiLogger.error('Error in basic lead fields API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
