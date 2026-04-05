-- =====================================================
-- ULAP PROFILE FIELDS FOR PHASE 2 FORM
-- Version: 1.0.0
-- Date: 2025-01-16
-- Purpose: Define all form fields for the 5-tab Phase 2 form structure
-- Tabs: 1. Applicant Details, 2. Loan Details, 3. Property Details, 4. Present Loan Details, 5. Documents
-- =====================================================

-- =====================================================
-- 1. CREATE PROFILE FIELDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_profile_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Field categorization
  subcategory_id UUID REFERENCES public.ulap_loan_subcategories(id) ON DELETE CASCADE,
  is_base_field BOOLEAN DEFAULT false, -- If true, applies to all loan types

  -- Field definition
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- text, email, phone, number, date, select, radio, checkbox, textarea, pan, aadhaar, pincode, currency, percentage, file
  field_section VARCHAR(50) NOT NULL, -- applicant, loan, property, present_loans, documents, coapplicant
  field_tab INTEGER NOT NULL DEFAULT 1, -- 1=Applicant, 2=Loan, 3=Property, 4=Present Loans, 5=Documents

  -- Field configuration
  placeholder VARCHAR(255),
  help_text TEXT,
  default_value TEXT,

  -- Validation
  is_required BOOLEAN DEFAULT false,
  is_required_for_phase INTEGER DEFAULT 2, -- Which phase this field is required for (1 or 2)
  validation_rules JSONB, -- {minLength, maxLength, min, max, pattern, patternMessage}

  -- Options for select/radio/checkbox
  options JSONB, -- [{value, label, description}]

  -- Conditional display
  depends_on VARCHAR(100), -- Field name this depends on
  depends_value TEXT, -- Value the dependent field must have

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  css_class VARCHAR(100), -- Optional CSS class for styling

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_subcategory ON public.ulap_profile_fields(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_base ON public.ulap_profile_fields(is_base_field);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_section ON public.ulap_profile_fields(field_section);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_tab ON public.ulap_profile_fields(field_tab);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_active ON public.ulap_profile_fields(is_active, display_order);

-- =====================================================
-- 2. TAB 1: APPLICANT DETAILS (Base fields for all loans)
-- =====================================================

-- Personal Information
INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order, validation_rules) VALUES
  (true, 'customer_name', 'Full Name (as per PAN)', 'text', 'applicant', 1, 'Enter full name', true, 1, 1, '{"minLength": 3, "maxLength": 100}'),
  (true, 'customer_mobile', 'Mobile Number', 'phone', 'applicant', 1, '10-digit mobile number', true, 1, 2, '{"pattern": "^[6-9]\\d{9}$", "patternMessage": "Enter valid 10-digit mobile number"}'),
  (true, 'customer_email', 'Email Address', 'email', 'applicant', 1, 'your.email@example.com', false, 2, 3, NULL),
  (true, 'customer_pan', 'PAN Number', 'pan', 'applicant', 1, 'ABCDE1234F', true, 2, 4, '{"pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", "patternMessage": "Enter valid PAN (e.g., ABCDE1234F)"}'),
  (true, 'customer_aadhaar', 'Aadhaar Number', 'aadhaar', 'applicant', 1, '1234 5678 9012', false, 2, 5, '{"pattern": "^\\d{12}$", "patternMessage": "Enter valid 12-digit Aadhaar number"}'),
  (true, 'customer_dob', 'Date of Birth', 'date', 'applicant', 1, NULL, true, 2, 6, NULL),
  (true, 'customer_gender', 'Gender', 'select', 'applicant', 1, 'Select gender', true, 2, 7, NULL),
  (true, 'customer_marital_status', 'Marital Status', 'select', 'applicant', 1, 'Select status', false, 2, 8, NULL)
ON CONFLICT DO NOTHING;

-- Set options for select fields
UPDATE public.ulap_profile_fields SET options = '[{"value": "male", "label": "Male"}, {"value": "female", "label": "Female"}, {"value": "other", "label": "Other"}]' WHERE field_name = 'customer_gender';
UPDATE public.ulap_profile_fields SET options = '[{"value": "single", "label": "Single"}, {"value": "married", "label": "Married"}, {"value": "divorced", "label": "Divorced"}, {"value": "widowed", "label": "Widowed"}]' WHERE field_name = 'customer_marital_status';

-- Address Details
INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order) VALUES
  (true, 'customer_address', 'Current Address', 'textarea', 'applicant', 1, 'Enter current residential address', true, 2, 10),
  (true, 'customer_city', 'City', 'text', 'applicant', 1, 'Enter city', true, 1, 11),
  (true, 'customer_state', 'State', 'select', 'applicant', 1, 'Select state', true, 2, 12),
  (true, 'customer_pincode', 'PIN Code', 'pincode', 'applicant', 1, '6-digit PIN code', true, 1, 13),
  (true, 'residence_type', 'Residence Type', 'select', 'applicant', 1, 'Select type', true, 2, 14),
  (true, 'years_at_current_address', 'Years at Current Address', 'number', 'applicant', 1, 'Years', false, 2, 15)
ON CONFLICT DO NOTHING;

-- Set state options
UPDATE public.ulap_profile_fields SET options = '[
  {"value": "AP", "label": "Andhra Pradesh"},
  {"value": "AR", "label": "Arunachal Pradesh"},
  {"value": "AS", "label": "Assam"},
  {"value": "BR", "label": "Bihar"},
  {"value": "CG", "label": "Chhattisgarh"},
  {"value": "GA", "label": "Goa"},
  {"value": "GJ", "label": "Gujarat"},
  {"value": "HR", "label": "Haryana"},
  {"value": "HP", "label": "Himachal Pradesh"},
  {"value": "JH", "label": "Jharkhand"},
  {"value": "KA", "label": "Karnataka"},
  {"value": "KL", "label": "Kerala"},
  {"value": "MP", "label": "Madhya Pradesh"},
  {"value": "MH", "label": "Maharashtra"},
  {"value": "MN", "label": "Manipur"},
  {"value": "ML", "label": "Meghalaya"},
  {"value": "MZ", "label": "Mizoram"},
  {"value": "NL", "label": "Nagaland"},
  {"value": "OD", "label": "Odisha"},
  {"value": "PB", "label": "Punjab"},
  {"value": "RJ", "label": "Rajasthan"},
  {"value": "SK", "label": "Sikkim"},
  {"value": "TN", "label": "Tamil Nadu"},
  {"value": "TS", "label": "Telangana"},
  {"value": "TR", "label": "Tripura"},
  {"value": "UP", "label": "Uttar Pradesh"},
  {"value": "UK", "label": "Uttarakhand"},
  {"value": "WB", "label": "West Bengal"},
  {"value": "DL", "label": "Delhi"},
  {"value": "CH", "label": "Chandigarh"},
  {"value": "PY", "label": "Puducherry"}
]' WHERE field_name = 'customer_state';

UPDATE public.ulap_profile_fields SET options = '[{"value": "owned", "label": "Self Owned"}, {"value": "rented", "label": "Rented"}, {"value": "parental", "label": "Parental"}, {"value": "company_provided", "label": "Company Provided"}]' WHERE field_name = 'residence_type';

-- Employment Details (for Applicant tab)
INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order) VALUES
  (true, 'employment_type', 'Employment Type', 'select', 'applicant', 1, 'Select type', true, 2, 20),
  (true, 'company_name', 'Company / Business Name', 'text', 'applicant', 1, 'Enter company/business name', true, 2, 21),
  (true, 'designation', 'Designation', 'text', 'applicant', 1, 'Enter designation', false, 2, 22),
  (true, 'work_experience_years', 'Total Work Experience (Years)', 'number', 'applicant', 1, 'Years', true, 2, 23),
  (true, 'current_company_years', 'Years in Current Company', 'number', 'applicant', 1, 'Years', false, 2, 24),
  (true, 'office_address', 'Office Address', 'textarea', 'applicant', 1, 'Enter office address', false, 2, 25),
  (true, 'office_pincode', 'Office PIN Code', 'pincode', 'applicant', 1, '6-digit PIN code', false, 2, 26)
ON CONFLICT DO NOTHING;

UPDATE public.ulap_profile_fields SET options = '[
  {"value": "salaried", "label": "Salaried"},
  {"value": "self_employed_business", "label": "Self Employed - Business"},
  {"value": "self_employed_professional", "label": "Self Employed - Professional"},
  {"value": "pensioner", "label": "Pensioner"},
  {"value": "housewife", "label": "Housewife"},
  {"value": "student", "label": "Student"},
  {"value": "other", "label": "Other"}
]' WHERE field_name = 'employment_type';

-- Income Details (for Applicant tab)
INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order, help_text) VALUES
  (true, 'monthly_income', 'Monthly Income', 'currency', 'applicant', 1, '₹', true, 2, 30, 'Net monthly salary or average monthly business income'),
  (true, 'annual_income', 'Annual Income', 'currency', 'applicant', 1, '₹', false, 2, 31, 'Total annual income from all sources'),
  (true, 'other_income', 'Other Monthly Income', 'currency', 'applicant', 1, '₹', false, 2, 32, 'Rental income, investments, etc.'),
  (true, 'income_proof_type', 'Income Proof Available', 'select', 'applicant', 1, 'Select type', true, 2, 33, NULL)
ON CONFLICT DO NOTHING;

UPDATE public.ulap_profile_fields SET options = '[
  {"value": "salary_slip", "label": "Salary Slips (Last 3 months)"},
  {"value": "bank_statement", "label": "Bank Statement (Last 6 months)"},
  {"value": "itr", "label": "ITR (Last 2 years)"},
  {"value": "form_16", "label": "Form 16"},
  {"value": "gst_returns", "label": "GST Returns"},
  {"value": "audit_report", "label": "Audited Financial Statements"}
]' WHERE field_name = 'income_proof_type';

-- Co-Applicant Details
INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order) VALUES
  (true, 'has_co_applicant', 'Do you have a Co-Applicant?', 'radio', 'applicant', 1, NULL, false, 2, 40),
  (true, 'co_applicant_name', 'Co-Applicant Name', 'text', 'coapplicant', 1, 'Enter full name', false, 2, 41),
  (true, 'co_applicant_mobile', 'Co-Applicant Mobile', 'phone', 'coapplicant', 1, '10-digit mobile', false, 2, 42),
  (true, 'co_applicant_relationship', 'Relationship with Applicant', 'select', 'coapplicant', 1, 'Select relationship', false, 2, 43),
  (true, 'co_applicant_pan', 'Co-Applicant PAN', 'pan', 'coapplicant', 1, 'ABCDE1234F', false, 2, 44),
  (true, 'co_applicant_income', 'Co-Applicant Monthly Income', 'currency', 'coapplicant', 1, '₹', false, 2, 45)
ON CONFLICT DO NOTHING;

UPDATE public.ulap_profile_fields SET options = '[{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]' WHERE field_name = 'has_co_applicant';
UPDATE public.ulap_profile_fields SET options = '[
  {"value": "spouse", "label": "Spouse"},
  {"value": "father", "label": "Father"},
  {"value": "mother", "label": "Mother"},
  {"value": "son", "label": "Son"},
  {"value": "daughter", "label": "Daughter"},
  {"value": "brother", "label": "Brother"},
  {"value": "sister", "label": "Sister"},
  {"value": "business_partner", "label": "Business Partner"},
  {"value": "other", "label": "Other"}
]' WHERE field_name = 'co_applicant_relationship';

-- Set depends_on for co-applicant fields
UPDATE public.ulap_profile_fields SET depends_on = 'has_co_applicant', depends_value = 'yes' WHERE field_name IN ('co_applicant_name', 'co_applicant_mobile', 'co_applicant_relationship', 'co_applicant_pan', 'co_applicant_income');

-- =====================================================
-- 3. TAB 2: LOAN DETAILS (Base fields for all loans)
-- =====================================================

INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order, help_text) VALUES
  (true, 'loan_amount_required', 'Loan Amount Required', 'currency', 'loan', 2, '₹', true, 2, 1, 'Enter the loan amount you need'),
  (true, 'loan_tenure_months', 'Preferred Tenure (Months)', 'number', 'loan', 2, 'Months', true, 2, 2, 'Loan repayment period in months'),
  (true, 'loan_purpose', 'Purpose of Loan', 'select', 'loan', 2, 'Select purpose', true, 2, 3, NULL),
  (true, 'loan_purpose_detail', 'Purpose Details', 'textarea', 'loan', 2, 'Describe the purpose in detail', false, 2, 4, 'Provide more details about how you plan to use the loan'),
  (true, 'preferred_bank', 'Preferred Bank (if any)', 'text', 'loan', 2, 'Enter bank name', false, 2, 5, NULL),
  (true, 'existing_relationship_bank', 'Do you have existing relationship with any bank?', 'text', 'loan', 2, 'Bank names where you have accounts', false, 2, 6, NULL)
ON CONFLICT DO NOTHING;

UPDATE public.ulap_profile_fields SET options = '[
  {"value": "home_purchase", "label": "Home Purchase"},
  {"value": "home_construction", "label": "Home Construction"},
  {"value": "home_renovation", "label": "Home Renovation"},
  {"value": "debt_consolidation", "label": "Debt Consolidation"},
  {"value": "business_expansion", "label": "Business Expansion"},
  {"value": "working_capital", "label": "Working Capital"},
  {"value": "equipment_purchase", "label": "Equipment/Machinery Purchase"},
  {"value": "vehicle_purchase", "label": "Vehicle Purchase"},
  {"value": "education", "label": "Education"},
  {"value": "medical_emergency", "label": "Medical Emergency"},
  {"value": "wedding", "label": "Wedding"},
  {"value": "travel", "label": "Travel"},
  {"value": "personal_use", "label": "Personal Use"},
  {"value": "other", "label": "Other"}
]' WHERE field_name = 'loan_purpose';

-- =====================================================
-- 4. TAB 3: PROPERTY DETAILS (Only for secured loans)
-- =====================================================

INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order, help_text) VALUES
  -- Property Type & Location
  (true, 'property_type', 'Property Type', 'select', 'property', 3, 'Select type', true, 2, 1, 'Type of property to be mortgaged'),
  (true, 'property_sub_type', 'Property Sub-Type', 'select', 'property', 3, 'Select sub-type', true, 2, 2, NULL),
  (true, 'property_address', 'Property Address', 'textarea', 'property', 3, 'Complete property address', true, 2, 3, NULL),
  (true, 'property_city', 'Property City', 'text', 'property', 3, 'City', true, 2, 4, NULL),
  (true, 'property_state', 'Property State', 'select', 'property', 3, 'Select state', true, 2, 5, NULL),
  (true, 'property_pincode', 'Property PIN Code', 'pincode', 'property', 3, '6-digit PIN', true, 2, 6, NULL),

  -- Property Valuation
  (true, 'property_value', 'Estimated Property Value', 'currency', 'property', 3, '₹', true, 2, 10, 'Current market value of the property'),
  (true, 'property_area_sqft', 'Built-up Area (Sq. Ft.)', 'number', 'property', 3, 'Sq. Ft.', true, 2, 11, NULL),
  (true, 'land_area_sqft', 'Land Area (Sq. Ft.)', 'number', 'property', 3, 'Sq. Ft.', false, 2, 12, 'For independent houses/plots'),
  (true, 'property_age_years', 'Property Age (Years)', 'number', 'property', 3, 'Years', true, 2, 13, 'Age of construction'),

  -- Ownership Details
  (true, 'property_ownership', 'Property Ownership', 'select', 'property', 3, 'Select ownership', true, 2, 20, NULL),
  (true, 'property_owner_name', 'Property Owner Name', 'text', 'property', 3, 'Name as in property documents', true, 2, 21, NULL),
  (true, 'is_property_mortgaged', 'Is Property Already Mortgaged?', 'radio', 'property', 3, NULL, true, 2, 22, NULL),
  (true, 'existing_mortgage_bank', 'Existing Mortgage Bank', 'text', 'property', 3, 'Bank name', false, 2, 23, 'If property is already mortgaged'),
  (true, 'existing_mortgage_amount', 'Outstanding Mortgage Amount', 'currency', 'property', 3, '₹', false, 2, 24, NULL),

  -- Document Status
  (true, 'property_documents_available', 'Documents Available', 'checkbox', 'property', 3, NULL, false, 2, 30, 'Select all documents you have')
ON CONFLICT DO NOTHING;

-- Set options for property fields
UPDATE public.ulap_profile_fields SET options = '[
  {"value": "residential", "label": "Residential"},
  {"value": "commercial", "label": "Commercial"},
  {"value": "industrial", "label": "Industrial"},
  {"value": "land", "label": "Land/Plot"}
]' WHERE field_name = 'property_type';

UPDATE public.ulap_profile_fields SET options = '[
  {"value": "flat", "label": "Flat/Apartment"},
  {"value": "independent_house", "label": "Independent House"},
  {"value": "villa", "label": "Villa"},
  {"value": "row_house", "label": "Row House"},
  {"value": "builder_floor", "label": "Builder Floor"},
  {"value": "penthouse", "label": "Penthouse"},
  {"value": "shop", "label": "Shop"},
  {"value": "office", "label": "Office Space"},
  {"value": "warehouse", "label": "Warehouse"},
  {"value": "factory", "label": "Factory"},
  {"value": "plot", "label": "Plot/Land"}
]' WHERE field_name = 'property_sub_type';

-- Copy state options from customer_state
UPDATE public.ulap_profile_fields SET options = (
  SELECT options FROM public.ulap_profile_fields WHERE field_name = 'customer_state' LIMIT 1
) WHERE field_name = 'property_state';

UPDATE public.ulap_profile_fields SET options = '[
  {"value": "self", "label": "Self Owned"},
  {"value": "joint", "label": "Joint Ownership"},
  {"value": "spouse", "label": "Spouse Owned"},
  {"value": "parent", "label": "Parent Owned"},
  {"value": "company", "label": "Company Owned"}
]' WHERE field_name = 'property_ownership';

UPDATE public.ulap_profile_fields SET options = '[{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]' WHERE field_name = 'is_property_mortgaged';

UPDATE public.ulap_profile_fields SET options = '[
  {"value": "sale_deed", "label": "Sale Deed"},
  {"value": "mother_deed", "label": "Mother Deed / Chain Documents"},
  {"value": "encumbrance_certificate", "label": "Encumbrance Certificate"},
  {"value": "tax_receipts", "label": "Property Tax Receipts"},
  {"value": "building_plan", "label": "Approved Building Plan"},
  {"value": "occupancy_certificate", "label": "Occupancy Certificate"},
  {"value": "possession_letter", "label": "Possession Letter"},
  {"value": "noc", "label": "Society/Builder NOC"}
]' WHERE field_name = 'property_documents_available';

-- Set depends_on for existing mortgage fields
UPDATE public.ulap_profile_fields SET depends_on = 'is_property_mortgaged', depends_value = 'yes' WHERE field_name IN ('existing_mortgage_bank', 'existing_mortgage_amount');

-- =====================================================
-- 5. TAB 4: PRESENT LOAN DETAILS (Existing EMIs)
-- =====================================================

INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order, help_text) VALUES
  -- Existing Loan Summary
  (true, 'has_existing_loans', 'Do you have any existing loans?', 'radio', 'present_loans', 4, NULL, true, 2, 1, NULL),
  (true, 'total_existing_emis', 'Total Monthly EMI Amount', 'currency', 'present_loans', 4, '₹', false, 2, 2, 'Sum of all existing EMIs'),
  (true, 'total_outstanding_loans', 'Total Outstanding Loan Amount', 'currency', 'present_loans', 4, '₹', false, 2, 3, 'Sum of all outstanding loan amounts'),

  -- Loan 1
  (true, 'loan1_type', 'Loan 1 - Type', 'select', 'present_loans', 4, 'Select loan type', false, 2, 10, NULL),
  (true, 'loan1_bank', 'Loan 1 - Bank/Lender Name', 'text', 'present_loans', 4, 'Bank name', false, 2, 11, NULL),
  (true, 'loan1_emi', 'Loan 1 - Monthly EMI', 'currency', 'present_loans', 4, '₹', false, 2, 12, NULL),
  (true, 'loan1_outstanding', 'Loan 1 - Outstanding Amount', 'currency', 'present_loans', 4, '₹', false, 2, 13, NULL),
  (true, 'loan1_tenure_remaining', 'Loan 1 - Remaining Tenure (Months)', 'number', 'present_loans', 4, 'Months', false, 2, 14, NULL),

  -- Loan 2
  (true, 'loan2_type', 'Loan 2 - Type', 'select', 'present_loans', 4, 'Select loan type', false, 2, 20, NULL),
  (true, 'loan2_bank', 'Loan 2 - Bank/Lender Name', 'text', 'present_loans', 4, 'Bank name', false, 2, 21, NULL),
  (true, 'loan2_emi', 'Loan 2 - Monthly EMI', 'currency', 'present_loans', 4, '₹', false, 2, 22, NULL),
  (true, 'loan2_outstanding', 'Loan 2 - Outstanding Amount', 'currency', 'present_loans', 4, '₹', false, 2, 23, NULL),
  (true, 'loan2_tenure_remaining', 'Loan 2 - Remaining Tenure (Months)', 'number', 'present_loans', 4, 'Months', false, 2, 24, NULL),

  -- Loan 3
  (true, 'loan3_type', 'Loan 3 - Type', 'select', 'present_loans', 4, 'Select loan type', false, 2, 30, NULL),
  (true, 'loan3_bank', 'Loan 3 - Bank/Lender Name', 'text', 'present_loans', 4, 'Bank name', false, 2, 31, NULL),
  (true, 'loan3_emi', 'Loan 3 - Monthly EMI', 'currency', 'present_loans', 4, '₹', false, 2, 32, NULL),
  (true, 'loan3_outstanding', 'Loan 3 - Outstanding Amount', 'currency', 'present_loans', 4, '₹', false, 2, 33, NULL),
  (true, 'loan3_tenure_remaining', 'Loan 3 - Remaining Tenure (Months)', 'number', 'present_loans', 4, 'Months', false, 2, 34, NULL),

  -- Credit Card EMIs
  (true, 'has_credit_cards', 'Do you have credit cards?', 'radio', 'present_loans', 4, NULL, false, 2, 40, NULL),
  (true, 'total_credit_card_limit', 'Total Credit Card Limit', 'currency', 'present_loans', 4, '₹', false, 2, 41, NULL),
  (true, 'total_credit_card_outstanding', 'Total Credit Card Outstanding', 'currency', 'present_loans', 4, '₹', false, 2, 42, NULL),
  (true, 'credit_card_emi', 'Monthly Credit Card EMI (if any)', 'currency', 'present_loans', 4, '₹', false, 2, 43, 'EMI converted from credit card purchases')
ON CONFLICT DO NOTHING;

-- Set options
UPDATE public.ulap_profile_fields SET options = '[{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]' WHERE field_name IN ('has_existing_loans', 'has_credit_cards');

-- Loan type options for existing loans
UPDATE public.ulap_profile_fields SET options = '[
  {"value": "home_loan", "label": "Home Loan"},
  {"value": "personal_loan", "label": "Personal Loan"},
  {"value": "car_loan", "label": "Car Loan"},
  {"value": "two_wheeler_loan", "label": "Two Wheeler Loan"},
  {"value": "education_loan", "label": "Education Loan"},
  {"value": "business_loan", "label": "Business Loan"},
  {"value": "gold_loan", "label": "Gold Loan"},
  {"value": "lap", "label": "Loan Against Property"},
  {"value": "overdraft", "label": "Overdraft/CC"},
  {"value": "other", "label": "Other"}
]' WHERE field_name IN ('loan1_type', 'loan2_type', 'loan3_type');

-- Set depends_on for loan details
UPDATE public.ulap_profile_fields SET depends_on = 'has_existing_loans', depends_value = 'yes'
WHERE field_name IN ('total_existing_emis', 'total_outstanding_loans', 'loan1_type', 'loan1_bank', 'loan1_emi', 'loan1_outstanding', 'loan1_tenure_remaining', 'loan2_type', 'loan2_bank', 'loan2_emi', 'loan2_outstanding', 'loan2_tenure_remaining', 'loan3_type', 'loan3_bank', 'loan3_emi', 'loan3_outstanding', 'loan3_tenure_remaining');

UPDATE public.ulap_profile_fields SET depends_on = 'has_credit_cards', depends_value = 'yes'
WHERE field_name IN ('total_credit_card_limit', 'total_credit_card_outstanding', 'credit_card_emi');

-- =====================================================
-- 6. TAB 5: DOCUMENTS (Document upload fields)
-- =====================================================

INSERT INTO public.ulap_profile_fields (is_base_field, field_name, field_label, field_type, field_section, field_tab, placeholder, is_required, is_required_for_phase, display_order, help_text) VALUES
  -- Identity Documents
  (true, 'doc_pan_card', 'PAN Card', 'file', 'documents', 5, 'Upload PAN Card', true, 2, 1, 'Clear copy of PAN card (PDF/JPG, max 5MB)'),
  (true, 'doc_aadhaar_front', 'Aadhaar Card (Front)', 'file', 'documents', 5, 'Upload Aadhaar front', true, 2, 2, 'Clear copy of Aadhaar card front side'),
  (true, 'doc_aadhaar_back', 'Aadhaar Card (Back)', 'file', 'documents', 5, 'Upload Aadhaar back', true, 2, 3, 'Clear copy of Aadhaar card back side'),
  (true, 'doc_photo', 'Passport Size Photo', 'file', 'documents', 5, 'Upload photo', true, 2, 4, 'Recent passport size photograph'),

  -- Address Proof
  (true, 'doc_address_proof', 'Address Proof', 'file', 'documents', 5, 'Upload address proof', false, 2, 10, 'Utility bill, passport, voter ID, etc.'),

  -- Income Documents
  (true, 'doc_salary_slip_1', 'Salary Slip (Month 1)', 'file', 'documents', 5, 'Upload salary slip', false, 2, 20, 'Latest month salary slip'),
  (true, 'doc_salary_slip_2', 'Salary Slip (Month 2)', 'file', 'documents', 5, 'Upload salary slip', false, 2, 21, 'Second latest month salary slip'),
  (true, 'doc_salary_slip_3', 'Salary Slip (Month 3)', 'file', 'documents', 5, 'Upload salary slip', false, 2, 22, 'Third latest month salary slip'),
  (true, 'doc_bank_statement', 'Bank Statement (6 months)', 'file', 'documents', 5, 'Upload bank statement', true, 2, 25, '6 months bank statement with salary credits'),
  (true, 'doc_form_16', 'Form 16 / ITR', 'file', 'documents', 5, 'Upload Form 16 or ITR', false, 2, 26, 'Latest Form 16 or ITR acknowledgment'),

  -- Business Documents (for self-employed)
  (true, 'doc_gst_certificate', 'GST Certificate', 'file', 'documents', 5, 'Upload GST certificate', false, 2, 30, 'GST registration certificate'),
  (true, 'doc_gst_returns', 'GST Returns (12 months)', 'file', 'documents', 5, 'Upload GST returns', false, 2, 31, 'Last 12 months GST returns'),
  (true, 'doc_business_proof', 'Business Proof', 'file', 'documents', 5, 'Upload business proof', false, 2, 32, 'Shop establishment, trade license, etc.'),
  (true, 'doc_financial_statements', 'Financial Statements', 'file', 'documents', 5, 'Upload financials', false, 2, 33, 'Audited financial statements (2 years)'),

  -- Property Documents (for secured loans)
  (true, 'doc_sale_deed', 'Sale Deed', 'file', 'documents', 5, 'Upload sale deed', false, 2, 40, 'Property sale deed'),
  (true, 'doc_chain_documents', 'Chain Documents / Mother Deed', 'file', 'documents', 5, 'Upload chain documents', false, 2, 41, 'Complete chain of ownership documents'),
  (true, 'doc_ec', 'Encumbrance Certificate', 'file', 'documents', 5, 'Upload EC', false, 2, 42, 'Latest encumbrance certificate'),
  (true, 'doc_tax_receipts', 'Property Tax Receipts', 'file', 'documents', 5, 'Upload tax receipts', false, 2, 43, 'Latest property tax paid receipts'),
  (true, 'doc_building_plan', 'Approved Building Plan', 'file', 'documents', 5, 'Upload building plan', false, 2, 44, 'Sanctioned building plan'),
  (true, 'doc_completion_certificate', 'Completion Certificate', 'file', 'documents', 5, 'Upload CC', false, 2, 45, 'Building completion certificate'),

  -- Co-applicant Documents
  (true, 'doc_co_applicant_pan', 'Co-Applicant PAN Card', 'file', 'documents', 5, 'Upload PAN Card', false, 2, 50, 'Co-applicant PAN card'),
  (true, 'doc_co_applicant_aadhaar', 'Co-Applicant Aadhaar', 'file', 'documents', 5, 'Upload Aadhaar', false, 2, 51, 'Co-applicant Aadhaar card'),
  (true, 'doc_co_applicant_income', 'Co-Applicant Income Proof', 'file', 'documents', 5, 'Upload income proof', false, 2, 52, 'Co-applicant salary slips or ITR')
ON CONFLICT DO NOTHING;

-- Set depends_on for business documents
UPDATE public.ulap_profile_fields SET depends_on = 'employment_type', depends_value = 'self_employed_business' WHERE field_name IN ('doc_gst_certificate', 'doc_gst_returns', 'doc_business_proof', 'doc_financial_statements');

-- Set depends_on for co-applicant documents
UPDATE public.ulap_profile_fields SET depends_on = 'has_co_applicant', depends_value = 'yes' WHERE field_name IN ('doc_co_applicant_pan', 'doc_co_applicant_aadhaar', 'doc_co_applicant_income');

-- =====================================================
-- 7. CREATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_ulap_profile_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ulap_profile_fields_updated ON public.ulap_profile_fields;
CREATE TRIGGER trigger_ulap_profile_fields_updated
  BEFORE UPDATE ON public.ulap_profile_fields
  FOR EACH ROW EXECUTE FUNCTION update_ulap_profile_fields_updated_at();

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

ALTER TABLE public.ulap_profile_fields ENABLE ROW LEVEL SECURITY;

-- Allow public read access (needed for form rendering)
DROP POLICY IF EXISTS "Public can view active profile fields" ON public.ulap_profile_fields;
CREATE POLICY "Public can view active profile fields"
  ON public.ulap_profile_fields FOR SELECT
  USING (is_active = true);

-- Super admin can manage
DROP POLICY IF EXISTS "Super admin can manage profile fields" ON public.ulap_profile_fields;
CREATE POLICY "Super admin can manage profile fields"
  ON public.ulap_profile_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 9. HELPER FUNCTION TO GET FIELDS FOR A SUBCATEGORY
-- =====================================================

CREATE OR REPLACE FUNCTION get_ulap_form_fields(p_subcategory_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  field_name VARCHAR(100),
  field_label VARCHAR(255),
  field_type VARCHAR(50),
  field_section VARCHAR(50),
  field_tab INTEGER,
  placeholder VARCHAR(255),
  help_text TEXT,
  default_value TEXT,
  is_required BOOLEAN,
  is_required_for_phase INTEGER,
  validation_rules JSONB,
  options JSONB,
  depends_on VARCHAR(100),
  depends_value TEXT,
  display_order INTEGER,
  css_class VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.field_name,
    f.field_label,
    f.field_type,
    f.field_section,
    f.field_tab,
    f.placeholder,
    f.help_text,
    f.default_value,
    f.is_required,
    f.is_required_for_phase,
    f.validation_rules,
    f.options,
    f.depends_on,
    f.depends_value,
    f.display_order,
    f.css_class
  FROM public.ulap_profile_fields f
  WHERE f.is_active = true
    AND (f.is_base_field = true OR f.subcategory_id = p_subcategory_id)
  ORDER BY f.field_tab, f.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. COMMENTS
-- =====================================================

COMMENT ON TABLE public.ulap_profile_fields IS 'Dynamic form fields for ULAP Phase 2 application form';
COMMENT ON COLUMN public.ulap_profile_fields.field_tab IS '1=Applicant, 2=Loan, 3=Property, 4=Present Loans, 5=Documents';
COMMENT ON COLUMN public.ulap_profile_fields.is_base_field IS 'True if field applies to all loan types';
COMMENT ON COLUMN public.ulap_profile_fields.depends_on IS 'Field name this field depends on for conditional display';
COMMENT ON COLUMN public.ulap_profile_fields.depends_value IS 'Value the dependent field must have for this field to show';

-- =====================================================
-- 11. MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('015_ulap_profile_fields', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
