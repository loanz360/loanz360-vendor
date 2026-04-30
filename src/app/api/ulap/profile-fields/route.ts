
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default fields when database tables don't exist
const DEFAULT_FIELDS = [
  // Tab 1: Applicant Details
  { id: '1', field_name: 'customer_name', field_label: 'Full Name (as per PAN)', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'Enter full name', is_required: true, is_required_for_phase: 1, display_order: 1, validation_rules: { minLength: 3, maxLength: 100 } },
  { id: '2', field_name: 'customer_mobile', field_label: 'Mobile Number', field_type: 'phone', field_section: 'applicant', field_tab: 1, placeholder: '10-digit mobile', is_required: true, is_required_for_phase: 1, display_order: 2, validation_rules: { pattern: '^[6-9]\\d{9}$', patternMessage: 'Enter valid 10-digit mobile number' } },
  { id: '3', field_name: 'customer_email', field_label: 'Email Address', field_type: 'email', field_section: 'applicant', field_tab: 1, placeholder: 'your.email@example.com', is_required: false, is_required_for_phase: 2, display_order: 3 },
  { id: '4', field_name: 'customer_pan', field_label: 'PAN Number', field_type: 'pan', field_section: 'applicant', field_tab: 1, placeholder: 'ABCDE1234F', is_required: true, is_required_for_phase: 2, display_order: 4, validation_rules: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', patternMessage: 'Enter valid PAN (e.g., ABCDE1234F)' } },
  { id: '5', field_name: 'customer_aadhaar', field_label: 'Aadhaar Number', field_type: 'aadhaar', field_section: 'applicant', field_tab: 1, placeholder: '1234 5678 9012', is_required: false, is_required_for_phase: 2, display_order: 5, validation_rules: { pattern: '^\\d{12}$', patternMessage: 'Enter valid 12-digit Aadhaar number' } },
  { id: '6', field_name: 'customer_dob', field_label: 'Date of Birth', field_type: 'date', field_section: 'applicant', field_tab: 1, is_required: true, is_required_for_phase: 2, display_order: 6 },
  { id: '7', field_name: 'customer_gender', field_label: 'Gender', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select gender', is_required: true, is_required_for_phase: 2, display_order: 7, options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }] },
  { id: '8', field_name: 'customer_marital_status', field_label: 'Marital Status', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select status', is_required: false, is_required_for_phase: 2, display_order: 8, options: [{ value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }, { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' }] },
  { id: '9', field_name: 'customer_address', field_label: 'Current Address', field_type: 'textarea', field_section: 'applicant', field_tab: 1, placeholder: 'Enter current residential address', is_required: true, is_required_for_phase: 2, display_order: 10 },
  { id: '10', field_name: 'customer_city', field_label: 'City', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'Enter city', is_required: true, is_required_for_phase: 1, display_order: 11 },
  { id: '11', field_name: 'customer_state', field_label: 'State', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select state', is_required: true, is_required_for_phase: 2, display_order: 12, options: [{ value: 'MH', label: 'Maharashtra' }, { value: 'KA', label: 'Karnataka' }, { value: 'TN', label: 'Tamil Nadu' }, { value: 'DL', label: 'Delhi' }, { value: 'UP', label: 'Uttar Pradesh' }, { value: 'GJ', label: 'Gujarat' }, { value: 'RJ', label: 'Rajasthan' }, { value: 'WB', label: 'West Bengal' }, { value: 'KL', label: 'Kerala' }, { value: 'TS', label: 'Telangana' }, { value: 'AP', label: 'Andhra Pradesh' }, { value: 'PB', label: 'Punjab' }, { value: 'HR', label: 'Haryana' }, { value: 'MP', label: 'Madhya Pradesh' }, { value: 'BR', label: 'Bihar' }] },
  { id: '12', field_name: 'customer_pincode', field_label: 'PIN Code', field_type: 'pincode', field_section: 'applicant', field_tab: 1, placeholder: '6-digit PIN code', is_required: true, is_required_for_phase: 1, display_order: 13 },
  { id: '13', field_name: 'residence_type', field_label: 'Residence Type', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select type', is_required: true, is_required_for_phase: 2, display_order: 14, options: [{ value: 'owned', label: 'Self Owned' }, { value: 'rented', label: 'Rented' }, { value: 'parental', label: 'Parental' }, { value: 'company_provided', label: 'Company Provided' }] },
  { id: '14', field_name: 'employment_type', field_label: 'Employment Type', field_type: 'select', field_section: 'applicant', field_tab: 1, placeholder: 'Select type', is_required: true, is_required_for_phase: 2, display_order: 20, options: [{ value: 'salaried', label: 'Salaried' }, { value: 'self_employed_business', label: 'Self Employed - Business' }, { value: 'self_employed_professional', label: 'Self Employed - Professional' }, { value: 'pensioner', label: 'Pensioner' }] },
  { id: '15', field_name: 'company_name', field_label: 'Company / Business Name', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'Enter company/business name', is_required: true, is_required_for_phase: 2, display_order: 21 },
  { id: '16', field_name: 'designation', field_label: 'Designation', field_type: 'text', field_section: 'applicant', field_tab: 1, placeholder: 'Enter designation', is_required: false, is_required_for_phase: 2, display_order: 22 },
  { id: '17', field_name: 'work_experience_years', field_label: 'Total Work Experience (Years)', field_type: 'number', field_section: 'applicant', field_tab: 1, placeholder: 'Years', is_required: true, is_required_for_phase: 2, display_order: 23 },
  { id: '18', field_name: 'monthly_income', field_label: 'Monthly Income', field_type: 'currency', field_section: 'applicant', field_tab: 1, placeholder: '₹', is_required: true, is_required_for_phase: 2, display_order: 30, help_text: 'Net monthly salary or average monthly business income' },
  { id: '19', field_name: 'has_co_applicant', field_label: 'Do you have a Co-Applicant?', field_type: 'radio', field_section: 'applicant', field_tab: 1, is_required: false, is_required_for_phase: 2, display_order: 40, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { id: '20', field_name: 'co_applicant_name', field_label: 'Co-Applicant Name', field_type: 'text', field_section: 'coapplicant', field_tab: 1, placeholder: 'Enter full name', is_required: false, is_required_for_phase: 2, display_order: 41, depends_on: 'has_co_applicant', depends_value: 'yes' },
  { id: '21', field_name: 'co_applicant_mobile', field_label: 'Co-Applicant Mobile', field_type: 'phone', field_section: 'coapplicant', field_tab: 1, placeholder: '10-digit mobile', is_required: false, is_required_for_phase: 2, display_order: 42, depends_on: 'has_co_applicant', depends_value: 'yes' },
  { id: '22', field_name: 'co_applicant_relationship', field_label: 'Relationship with Applicant', field_type: 'select', field_section: 'coapplicant', field_tab: 1, placeholder: 'Select relationship', is_required: false, is_required_for_phase: 2, display_order: 43, depends_on: 'has_co_applicant', depends_value: 'yes', options: [{ value: 'spouse', label: 'Spouse' }, { value: 'father', label: 'Father' }, { value: 'mother', label: 'Mother' }, { value: 'son', label: 'Son' }, { value: 'daughter', label: 'Daughter' }, { value: 'brother', label: 'Brother' }, { value: 'sister', label: 'Sister' }] },

  // Tab 2: Loan Details
  { id: '30', field_name: 'loan_amount_required', field_label: 'Loan Amount Required', field_type: 'currency', field_section: 'loan', field_tab: 2, placeholder: '₹', is_required: true, is_required_for_phase: 2, display_order: 1, help_text: 'Enter the loan amount you need' },
  { id: '31', field_name: 'loan_tenure_months', field_label: 'Preferred Tenure (Months)', field_type: 'number', field_section: 'loan', field_tab: 2, placeholder: 'Months', is_required: true, is_required_for_phase: 2, display_order: 2, help_text: 'Loan repayment period in months' },
  { id: '32', field_name: 'loan_purpose', field_label: 'Purpose of Loan', field_type: 'select', field_section: 'loan', field_tab: 2, placeholder: 'Select purpose', is_required: true, is_required_for_phase: 2, display_order: 3, options: [{ value: 'home_purchase', label: 'Home Purchase' }, { value: 'home_construction', label: 'Home Construction' }, { value: 'home_renovation', label: 'Home Renovation' }, { value: 'debt_consolidation', label: 'Debt Consolidation' }, { value: 'business_expansion', label: 'Business Expansion' }, { value: 'working_capital', label: 'Working Capital' }, { value: 'equipment_purchase', label: 'Equipment/Machinery Purchase' }, { value: 'vehicle_purchase', label: 'Vehicle Purchase' }, { value: 'education', label: 'Education' }, { value: 'medical_emergency', label: 'Medical Emergency' }, { value: 'wedding', label: 'Wedding' }, { value: 'personal_use', label: 'Personal Use' }, { value: 'other', label: 'Other' }] },
  { id: '33', field_name: 'loan_purpose_detail', field_label: 'Purpose Details', field_type: 'textarea', field_section: 'loan', field_tab: 2, placeholder: 'Describe the purpose in detail', is_required: false, is_required_for_phase: 2, display_order: 4, help_text: 'Provide more details about how you plan to use the loan' },
  { id: '34', field_name: 'preferred_bank', field_label: 'Preferred Bank (if any)', field_type: 'text', field_section: 'loan', field_tab: 2, placeholder: 'Enter bank name', is_required: false, is_required_for_phase: 2, display_order: 5 },

  // Tab 3: Property Details
  { id: '40', field_name: 'property_type', field_label: 'Property Type', field_type: 'select', field_section: 'property', field_tab: 3, placeholder: 'Select type', is_required: true, is_required_for_phase: 2, display_order: 1, options: [{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }, { value: 'industrial', label: 'Industrial' }, { value: 'land', label: 'Land/Plot' }] },
  { id: '41', field_name: 'property_sub_type', field_label: 'Property Sub-Type', field_type: 'select', field_section: 'property', field_tab: 3, placeholder: 'Select sub-type', is_required: true, is_required_for_phase: 2, display_order: 2, options: [{ value: 'flat', label: 'Flat/Apartment' }, { value: 'independent_house', label: 'Independent House' }, { value: 'villa', label: 'Villa' }, { value: 'row_house', label: 'Row House' }, { value: 'builder_floor', label: 'Builder Floor' }, { value: 'shop', label: 'Shop' }, { value: 'office', label: 'Office Space' }, { value: 'warehouse', label: 'Warehouse' }, { value: 'plot', label: 'Plot/Land' }] },
  { id: '42', field_name: 'property_address', field_label: 'Property Address', field_type: 'textarea', field_section: 'property', field_tab: 3, placeholder: 'Complete property address', is_required: true, is_required_for_phase: 2, display_order: 3 },
  { id: '43', field_name: 'property_city', field_label: 'Property City', field_type: 'text', field_section: 'property', field_tab: 3, placeholder: 'City', is_required: true, is_required_for_phase: 2, display_order: 4 },
  { id: '44', field_name: 'property_pincode', field_label: 'Property PIN Code', field_type: 'pincode', field_section: 'property', field_tab: 3, placeholder: '6-digit PIN', is_required: true, is_required_for_phase: 2, display_order: 5 },
  { id: '45', field_name: 'property_value', field_label: 'Estimated Property Value', field_type: 'currency', field_section: 'property', field_tab: 3, placeholder: '₹', is_required: true, is_required_for_phase: 2, display_order: 10, help_text: 'Current market value of the property' },
  { id: '46', field_name: 'property_area_sqft', field_label: 'Built-up Area (Sq. Ft.)', field_type: 'number', field_section: 'property', field_tab: 3, placeholder: 'Sq. Ft.', is_required: true, is_required_for_phase: 2, display_order: 11 },
  { id: '47', field_name: 'property_age_years', field_label: 'Property Age (Years)', field_type: 'number', field_section: 'property', field_tab: 3, placeholder: 'Years', is_required: true, is_required_for_phase: 2, display_order: 12, help_text: 'Age of construction' },
  { id: '48', field_name: 'property_ownership', field_label: 'Property Ownership', field_type: 'select', field_section: 'property', field_tab: 3, placeholder: 'Select ownership', is_required: true, is_required_for_phase: 2, display_order: 20, options: [{ value: 'self', label: 'Self Owned' }, { value: 'joint', label: 'Joint Ownership' }, { value: 'spouse', label: 'Spouse Owned' }, { value: 'parent', label: 'Parent Owned' }] },
  { id: '49', field_name: 'property_owner_name', field_label: 'Property Owner Name', field_type: 'text', field_section: 'property', field_tab: 3, placeholder: 'Name as in property documents', is_required: true, is_required_for_phase: 2, display_order: 21 },
  { id: '50', field_name: 'is_property_mortgaged', field_label: 'Is Property Already Mortgaged?', field_type: 'radio', field_section: 'property', field_tab: 3, is_required: true, is_required_for_phase: 2, display_order: 22, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { id: '51', field_name: 'existing_mortgage_bank', field_label: 'Existing Mortgage Bank', field_type: 'text', field_section: 'property', field_tab: 3, placeholder: 'Bank name', is_required: false, is_required_for_phase: 2, display_order: 23, depends_on: 'is_property_mortgaged', depends_value: 'yes' },
  { id: '52', field_name: 'existing_mortgage_amount', field_label: 'Outstanding Mortgage Amount', field_type: 'currency', field_section: 'property', field_tab: 3, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 24, depends_on: 'is_property_mortgaged', depends_value: 'yes' },

  // Tab 4: Present Loans
  { id: '60', field_name: 'has_existing_loans', field_label: 'Do you have any existing loans?', field_type: 'radio', field_section: 'present_loans', field_tab: 4, is_required: true, is_required_for_phase: 2, display_order: 1, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { id: '61', field_name: 'total_existing_emis', field_label: 'Total Monthly EMI Amount', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 2, depends_on: 'has_existing_loans', depends_value: 'yes', help_text: 'Sum of all existing EMIs' },
  { id: '62', field_name: 'total_outstanding_loans', field_label: 'Total Outstanding Loan Amount', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 3, depends_on: 'has_existing_loans', depends_value: 'yes', help_text: 'Sum of all outstanding loan amounts' },
  { id: '63', field_name: 'loan1_type', field_label: 'Loan 1 - Type', field_type: 'select', field_section: 'present_loans', field_tab: 4, placeholder: 'Select loan type', is_required: false, is_required_for_phase: 2, display_order: 10, depends_on: 'has_existing_loans', depends_value: 'yes', options: [{ value: 'home_loan', label: 'Home Loan' }, { value: 'personal_loan', label: 'Personal Loan' }, { value: 'car_loan', label: 'Car Loan' }, { value: 'two_wheeler_loan', label: 'Two Wheeler Loan' }, { value: 'education_loan', label: 'Education Loan' }, { value: 'business_loan', label: 'Business Loan' }, { value: 'gold_loan', label: 'Gold Loan' }, { value: 'lap', label: 'Loan Against Property' }, { value: 'overdraft', label: 'Overdraft/CC' }, { value: 'other', label: 'Other' }] },
  { id: '64', field_name: 'loan1_bank', field_label: 'Loan 1 - Bank/Lender Name', field_type: 'text', field_section: 'present_loans', field_tab: 4, placeholder: 'Bank name', is_required: false, is_required_for_phase: 2, display_order: 11, depends_on: 'has_existing_loans', depends_value: 'yes' },
  { id: '65', field_name: 'loan1_emi', field_label: 'Loan 1 - Monthly EMI', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 12, depends_on: 'has_existing_loans', depends_value: 'yes' },
  { id: '66', field_name: 'loan1_outstanding', field_label: 'Loan 1 - Outstanding Amount', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 13, depends_on: 'has_existing_loans', depends_value: 'yes' },
  { id: '67', field_name: 'has_credit_cards', field_label: 'Do you have credit cards?', field_type: 'radio', field_section: 'present_loans', field_tab: 4, is_required: false, is_required_for_phase: 2, display_order: 40, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
  { id: '68', field_name: 'total_credit_card_limit', field_label: 'Total Credit Card Limit', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 41, depends_on: 'has_credit_cards', depends_value: 'yes' },
  { id: '69', field_name: 'total_credit_card_outstanding', field_label: 'Total Credit Card Outstanding', field_type: 'currency', field_section: 'present_loans', field_tab: 4, placeholder: '₹', is_required: false, is_required_for_phase: 2, display_order: 42, depends_on: 'has_credit_cards', depends_value: 'yes' },

  // Tab 5: Documents
  { id: '70', field_name: 'doc_pan_card', field_label: 'PAN Card', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 1, help_text: 'Clear copy of PAN card (PDF/JPG, max 5MB)' },
  { id: '71', field_name: 'doc_aadhaar_front', field_label: 'Aadhaar Card (Front)', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 2, help_text: 'Clear copy of Aadhaar card front side' },
  { id: '72', field_name: 'doc_aadhaar_back', field_label: 'Aadhaar Card (Back)', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 3, help_text: 'Clear copy of Aadhaar card back side' },
  { id: '73', field_name: 'doc_photo', field_label: 'Passport Size Photo', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 4, help_text: 'Recent passport size photograph' },
  { id: '74', field_name: 'doc_bank_statement', field_label: 'Bank Statement (6 months)', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: true, is_required_for_phase: 2, display_order: 10, help_text: '6 months bank statement with salary credits' },
  { id: '75', field_name: 'doc_salary_slip_1', field_label: 'Salary Slip (Latest Month)', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: false, is_required_for_phase: 2, display_order: 11, help_text: 'Latest month salary slip', depends_on: 'employment_type', depends_value: 'salaried' },
  { id: '76', field_name: 'doc_form_16', field_label: 'Form 16 / ITR', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: false, is_required_for_phase: 2, display_order: 12, help_text: 'Latest Form 16 or ITR acknowledgment' },
  { id: '77', field_name: 'doc_gst_certificate', field_label: 'GST Certificate', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: false, is_required_for_phase: 2, display_order: 20, depends_on: 'employment_type', depends_value: 'self_employed_business', help_text: 'GST registration certificate' },
  { id: '78', field_name: 'doc_business_proof', field_label: 'Business Proof', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: false, is_required_for_phase: 2, display_order: 21, depends_on: 'employment_type', depends_value: 'self_employed_business', help_text: 'Shop establishment, trade license, etc.' },
  { id: '79', field_name: 'doc_sale_deed', field_label: 'Sale Deed', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: false, is_required_for_phase: 2, display_order: 30, help_text: 'Property sale deed (for secured loans)' },
  { id: '80', field_name: 'doc_ec', field_label: 'Encumbrance Certificate', field_type: 'file', field_section: 'documents', field_tab: 5, is_required: false, is_required_for_phase: 2, display_order: 31, help_text: 'Latest encumbrance certificate (for secured loans)' },
];

// GET - Fetch profile fields (base fields + subcategory-specific fields)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subcategoryId = searchParams.get('subcategory_id');
    const subcategoryCode = searchParams.get('subcategory_code');

    // Build query for profile fields
    let query = supabase
      .from('ulap_profile_fields')
      .select('*')
      .eq('is_active', true)
      .order('field_tab')
      .order('display_order');

    if (subcategoryId) {
      // Get base fields + subcategory-specific fields
      query = query.or(`is_base_field.eq.true,subcategory_id.eq.${subcategoryId}`);
    } else {
      // Get only base fields
      query = query.eq('is_base_field', true);
    }

    const { data: fields, error } = await query;

    if (error) {
      apiLogger.error('Error fetching profile fields', error);
      // Return fallback data on error
      return NextResponse.json({
        fields: DEFAULT_FIELDS,
        count: DEFAULT_FIELDS.length,
        usingFallback: true,
      });
    }

    // If no data from DB, use fallback
    if (!fields || fields.length === 0) {
      return NextResponse.json({
        fields: DEFAULT_FIELDS,
        count: DEFAULT_FIELDS.length,
        usingFallback: true,
      });
    }

    return NextResponse.json({
      fields: fields,
      count: fields.length,
    });
  } catch (error) {
    apiLogger.error('Error in profile fields API', error);
    // Return fallback data on any error
    return NextResponse.json({
      fields: DEFAULT_FIELDS,
      count: DEFAULT_FIELDS.length,
      usingFallback: true,
    });
  }
}
