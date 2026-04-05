export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default basic lead fields
const DEFAULT_BASIC_FIELDS = [
  { field_key: 'full_name', label: 'Full Name', field_type: 'text', placeholder: 'Enter full name as per ID', is_required: true, is_default: true, display_order: 1, validation_rules: { minLength: 2, maxLength: 100 } },
  { field_key: 'mobile', label: 'Mobile Number', field_type: 'phone', placeholder: '10-digit mobile number', is_required: true, is_default: true, display_order: 2, validation_rules: { pattern: '^[6-9]\\d{9}$' } },
  { field_key: 'email', label: 'Email Address', field_type: 'email', placeholder: 'email@example.com', is_required: false, is_default: true, display_order: 3, validation_rules: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' } },
  { field_key: 'loan_amount', label: 'Loan Amount Required', field_type: 'currency', placeholder: 'Enter amount in INR', is_required: true, is_default: true, display_order: 4, validation_rules: { min: 10000 } },
  { field_key: 'city', label: 'City', field_type: 'text', placeholder: 'Enter your city', is_required: true, is_default: true, display_order: 5, validation_rules: { minLength: 2 } },
  { field_key: 'pincode', label: 'Pincode', field_type: 'text', placeholder: '6-digit pincode', is_required: false, is_default: true, display_order: 6, validation_rules: { pattern: '^[1-9][0-9]{5}$' } },
  { field_key: 'employment_type', label: 'Employment Type', field_type: 'select', placeholder: 'Select employment type', is_required: false, is_default: true, display_order: 7, validation_rules: {} },
  { field_key: 'monthly_income', label: 'Monthly Income', field_type: 'currency', placeholder: 'Gross monthly income', is_required: false, is_default: false, display_order: 8, validation_rules: { min: 0 } },
  { field_key: 'company_name', label: 'Company/Business Name', field_type: 'text', placeholder: 'Current employer or business', is_required: false, is_default: false, display_order: 9, validation_rules: {} },
  { field_key: 'existing_loans', label: 'Existing Loan EMI', field_type: 'currency', placeholder: 'Total monthly EMI payments', is_required: false, is_default: false, display_order: 10, validation_rules: { min: 0 } },
];

// POST - Seed basic lead fields
export async function POST(request: NextRequest) {
  try {
    // Verify authorization token
    const authHeader = request.headers.get('Authorization');
    const expectedToken = process.env.SEED_API_TOKEN || 'ulap-seed-token';

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing token' },
        { status: 401 }
      );
    }

    // Check existing fields
    const { data: existingFields, error: checkError } = await supabase
      .from('ulap_basic_lead_fields')
      .select('field_key');

    if (checkError) {
      apiLogger.error('Error checking existing fields', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing fields' },
        { status: 500 }
      );
    }

    const existingKeys = new Set(existingFields?.map(f => f.field_key) || []);

    // Filter fields to insert
    const fieldsToInsert = DEFAULT_BASIC_FIELDS.filter(f => !existingKeys.has(f.field_key));

    let insertedFields = 0;

    if (fieldsToInsert.length > 0) {
      const { data: newFields, error: insertError } = await supabase
        .from('ulap_basic_lead_fields')
        .insert(fieldsToInsert.map(f => ({
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          placeholder: f.placeholder,
          is_required: f.is_required,
          is_default: f.is_default,
          display_order: f.display_order,
          validation_rules: f.validation_rules,
          is_active: true,
        })))
        .select();

      if (insertError) {
        apiLogger.error('Error inserting fields', insertError);
        return NextResponse.json(
          { error: 'Failed to insert fields' },
          { status: 500 }
        );
      }

      insertedFields = newFields?.length || 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Seed completed',
      inserted: insertedFields,
      skipped: DEFAULT_BASIC_FIELDS.length - fieldsToInsert.length,
    });
  } catch (error) {
    apiLogger.error('Error in seed basic fields API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get seed status
export async function GET() {
  try {
    const { count, error } = await supabase
      .from('ulap_basic_lead_fields')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to check seed status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
      expected: DEFAULT_BASIC_FIELDS.length,
      needs_seeding: (count || 0) < DEFAULT_BASIC_FIELDS.length,
    });
  } catch (error) {
    apiLogger.error('Error checking seed status', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
