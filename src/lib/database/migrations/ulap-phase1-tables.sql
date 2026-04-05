-- ULAP Phase 1 Tables
-- Run this AFTER ulap-tables.sql and ulap-seed-data.sql
-- These tables enable dynamic form fields, lead management, OTP verification, and shareable links

-- =====================================================
-- Drop old functions if they exist (cleanup from previous attempts)
-- Note: Triggers will be dropped automatically via CASCADE
-- =====================================================
DROP FUNCTION IF EXISTS generate_lead_id() CASCADE;
DROP FUNCTION IF EXISTS generate_ulap_lead_id() CASCADE;
DROP FUNCTION IF EXISTS generate_short_code() CASCADE;
DROP FUNCTION IF EXISTS generate_ulap_short_code() CASCADE;

-- =====================================================
-- 1. Profile Fields Table (Dynamic Form Fields)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_profile_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID REFERENCES ulap_loan_subcategories(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'email', 'phone', 'number', 'date', 'select', 'radio', 'checkbox', 'textarea', 'pan', 'aadhaar', 'pincode', 'currency', 'percentage', 'file')),
  placeholder TEXT,
  is_required BOOLEAN DEFAULT false,
  validation_rules JSONB DEFAULT '{}'::JSONB,
  options JSONB DEFAULT '[]'::JSONB,
  display_order INT DEFAULT 0,
  field_section VARCHAR(50) NOT NULL DEFAULT 'applicant' CHECK (field_section IN ('applicant', 'coapplicant', 'loan', 'other')),
  is_base_field BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. Leads Table (Lead Management)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(20) NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES ulap_loan_categories(id),
  subcategory_id UUID NOT NULL REFERENCES ulap_loan_subcategories(id),
  customer_name VARCHAR(255),
  customer_mobile VARCHAR(20),
  customer_email VARCHAR(255),
  customer_id UUID,
  applicant_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  coapplicant_data JSONB DEFAULT NULL,
  loan_data JSONB DEFAULT '{}'::JSONB,
  selected_banks JSONB DEFAULT '[]'::JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'OTP_PENDING', 'OTP_VERIFIED', 'LINK_SHARED', 'FORM_OPENED',
    'FORM_COMPLETED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED'
  )),
  otp_verified BOOLEAN DEFAULT false,
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  created_by_type VARCHAR(50) NOT NULL CHECK (created_by_type IN ('SUPER_ADMIN', 'CHANNEL_PARTNER', 'BA', 'CUSTOMER', 'PUBLIC')),
  created_by_id UUID,
  created_by_name VARCHAR(255),
  created_by_mobile VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  internal_notes TEXT,
  customer_notes TEXT
);

-- =====================================================
-- 3. Short Links Table (Shareable URLs)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES ulap_leads(id) ON DELETE CASCADE,
  short_code VARCHAR(20) NOT NULL UNIQUE,
  full_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INT DEFAULT NULL,
  use_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 4. OTP Verifications Table
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES ulap_leads(id) ON DELETE CASCADE,
  mobile_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  otp_type VARCHAR(50) NOT NULL CHECK (otp_type IN ('VERIFICATION', 'LOGIN', 'SUBMISSION')),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. Lead Activity Table (Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_lead_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES ulap_leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL,
  activity_data JSONB DEFAULT '{}'::JSONB,
  performed_by_type VARCHAR(50),
  performed_by_id UUID,
  performed_by_name VARCHAR(255),
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_subcategory ON ulap_profile_fields(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_section ON ulap_profile_fields(field_section);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_base ON ulap_profile_fields(is_base_field);
CREATE INDEX IF NOT EXISTS idx_ulap_profile_fields_active ON ulap_profile_fields(is_active);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_lead_id ON ulap_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_status ON ulap_leads(status);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_customer_mobile ON ulap_leads(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_category ON ulap_leads(category_id);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_subcategory ON ulap_leads(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_created_by ON ulap_leads(created_by_type, created_by_id);
CREATE INDEX IF NOT EXISTS idx_ulap_leads_created_at ON ulap_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_ulap_short_links_code ON ulap_short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_ulap_short_links_lead ON ulap_short_links(lead_id);
CREATE INDEX IF NOT EXISTS idx_ulap_short_links_active ON ulap_short_links(is_active);
CREATE INDEX IF NOT EXISTS idx_ulap_otp_mobile ON ulap_otp_verifications(mobile_number);
CREATE INDEX IF NOT EXISTS idx_ulap_otp_lead ON ulap_otp_verifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_ulap_otp_expires ON ulap_otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_ulap_lead_activity_lead ON ulap_lead_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_ulap_lead_activity_type ON ulap_lead_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_ulap_lead_activity_created ON ulap_lead_activity(created_at);

-- =====================================================
-- Triggers for updated_at
-- =====================================================
CREATE TRIGGER update_ulap_profile_fields_updated_at
  BEFORE UPDATE ON ulap_profile_fields
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

CREATE TRIGGER update_ulap_leads_updated_at
  BEFORE UPDATE ON ulap_leads
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- =====================================================
-- Function to generate Lead ID
-- =====================================================
CREATE OR REPLACE FUNCTION generate_ulap_lead_id()
RETURNS TRIGGER AS $lead_func$
DECLARE
  year_part VARCHAR(4);
  seq_num INT;
  new_lead_id VARCHAR(20);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(lead_id FROM 11 FOR 6) AS INT)), 0) + 1
  INTO seq_num
  FROM ulap_leads
  WHERE lead_id LIKE 'LEAD-' || year_part || '-%';
  new_lead_id := 'LEAD-' || year_part || '-' || LPAD(seq_num::TEXT, 6, '0');
  NEW.lead_id := new_lead_id;
  RETURN NEW;
END;
$lead_func$ LANGUAGE plpgsql;

CREATE TRIGGER generate_lead_id_trigger
  BEFORE INSERT ON ulap_leads
  FOR EACH ROW
  WHEN (NEW.lead_id IS NULL OR NEW.lead_id = '')
  EXECUTE FUNCTION generate_ulap_lead_id();

-- =====================================================
-- Function to generate Short Code
-- =====================================================
CREATE OR REPLACE FUNCTION generate_ulap_short_code()
RETURNS TRIGGER AS $short_func$
DECLARE
  chars VARCHAR(62) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  new_code VARCHAR(8) := '';
  i INT;
BEGIN
  IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
    FOR i IN 1..8 LOOP
      new_code := new_code || SUBSTR(chars, FLOOR(RANDOM() * 62)::INT + 1, 1);
    END LOOP;
    NEW.short_code := new_code;
  END IF;
  RETURN NEW;
END;
$short_func$ LANGUAGE plpgsql;

CREATE TRIGGER generate_short_code_trigger
  BEFORE INSERT ON ulap_short_links
  FOR EACH ROW
  EXECUTE FUNCTION generate_ulap_short_code();

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE ulap_profile_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_lead_activity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Allow public read for active profile fields" ON ulap_profile_fields;
DROP POLICY IF EXISTS "Allow admin full access to profile fields" ON ulap_profile_fields;
DROP POLICY IF EXISTS "Allow admin full access to leads" ON ulap_leads;
DROP POLICY IF EXISTS "Allow admin full access to short links" ON ulap_short_links;
DROP POLICY IF EXISTS "Allow admin full access to otp verifications" ON ulap_otp_verifications;
DROP POLICY IF EXISTS "Allow admin full access to lead activity" ON ulap_lead_activity;
DROP POLICY IF EXISTS "Allow public read for active short links" ON ulap_short_links;
DROP POLICY IF EXISTS "Allow public read own lead" ON ulap_leads;

CREATE POLICY "Allow public read for active profile fields" ON ulap_profile_fields
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow admin full access to profile fields" ON ulap_profile_fields
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to leads" ON ulap_leads
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to short links" ON ulap_short_links
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to otp verifications" ON ulap_otp_verifications
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to lead activity" ON ulap_lead_activity
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow public read for active short links" ON ulap_short_links
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read own lead" ON ulap_leads
  FOR SELECT USING (true);

-- =====================================================
-- Seed Base Profile Fields (Common to all loan types)
-- =====================================================

-- Applicant Base Fields
INSERT INTO ulap_profile_fields (field_name, field_label, field_type, placeholder, is_required, validation_rules, display_order, field_section, is_base_field) VALUES
('full_name', 'Full Name (as per PAN)', 'text', 'Enter your full name', true, '{"minLength": 3, "maxLength": 100}'::JSONB, 1, 'applicant', true),
('mobile', 'Mobile Number', 'phone', '10-digit mobile number', true, '{"pattern": "^[6-9][0-9]{9}$"}'::JSONB, 2, 'applicant', true),
('email', 'Email Address', 'email', 'your.email@example.com', false, '{}'::JSONB, 3, 'applicant', true),
('pan_number', 'PAN Number', 'pan', 'ABCDE1234F', true, '{"pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"}'::JSONB, 4, 'applicant', true),
('date_of_birth', 'Date of Birth', 'date', 'DD/MM/YYYY', true, '{"minAge": 18, "maxAge": 65}'::JSONB, 5, 'applicant', true),
('gender', 'Gender', 'select', 'Select gender', true, '{}'::JSONB, 6, 'applicant', true),
('marital_status', 'Marital Status', 'select', 'Select marital status', false, '{}'::JSONB, 7, 'applicant', true),
('employment_type', 'Employment Type', 'select', 'Select employment type', true, '{}'::JSONB, 8, 'applicant', true),
('monthly_income', 'Monthly Income', 'currency', 'Enter monthly income', true, '{"min": 10000}'::JSONB, 9, 'applicant', true),
('current_address', 'Current Address', 'textarea', 'Enter your current address', true, '{"minLength": 10, "maxLength": 500}'::JSONB, 10, 'applicant', true),
('pincode', 'Pincode', 'pincode', '6-digit pincode', true, '{"pattern": "^[1-9][0-9]{5}$"}'::JSONB, 11, 'applicant', true),
('city', 'City', 'text', 'Enter city name', true, '{}'::JSONB, 12, 'applicant', true),
('state', 'State', 'select', 'Select state', true, '{}'::JSONB, 13, 'applicant', true)
ON CONFLICT DO NOTHING;

-- Update options for select fields
UPDATE ulap_profile_fields SET options = '[{"value": "male", "label": "Male"}, {"value": "female", "label": "Female"}, {"value": "other", "label": "Other"}]'::JSONB WHERE field_name = 'gender' AND is_base_field = true;

UPDATE ulap_profile_fields SET options = '[{"value": "single", "label": "Single"}, {"value": "married", "label": "Married"}, {"value": "divorced", "label": "Divorced"}, {"value": "widowed", "label": "Widowed"}]'::JSONB WHERE field_name = 'marital_status' AND is_base_field = true;

UPDATE ulap_profile_fields SET options = '[{"value": "salaried", "label": "Salaried"}, {"value": "self_employed_professional", "label": "Self Employed Professional"}, {"value": "self_employed_business", "label": "Self Employed Business"}, {"value": "retired", "label": "Retired"}, {"value": "student", "label": "Student"}, {"value": "homemaker", "label": "Homemaker"}]'::JSONB WHERE field_name = 'employment_type' AND is_base_field = true;

UPDATE ulap_profile_fields SET options = '[{"value": "andhra_pradesh", "label": "Andhra Pradesh"}, {"value": "arunachal_pradesh", "label": "Arunachal Pradesh"}, {"value": "assam", "label": "Assam"}, {"value": "bihar", "label": "Bihar"}, {"value": "chhattisgarh", "label": "Chhattisgarh"}, {"value": "goa", "label": "Goa"}, {"value": "gujarat", "label": "Gujarat"}, {"value": "haryana", "label": "Haryana"}, {"value": "himachal_pradesh", "label": "Himachal Pradesh"}, {"value": "jharkhand", "label": "Jharkhand"}, {"value": "karnataka", "label": "Karnataka"}, {"value": "kerala", "label": "Kerala"}, {"value": "madhya_pradesh", "label": "Madhya Pradesh"}, {"value": "maharashtra", "label": "Maharashtra"}, {"value": "manipur", "label": "Manipur"}, {"value": "meghalaya", "label": "Meghalaya"}, {"value": "mizoram", "label": "Mizoram"}, {"value": "nagaland", "label": "Nagaland"}, {"value": "odisha", "label": "Odisha"}, {"value": "punjab", "label": "Punjab"}, {"value": "rajasthan", "label": "Rajasthan"}, {"value": "sikkim", "label": "Sikkim"}, {"value": "tamil_nadu", "label": "Tamil Nadu"}, {"value": "telangana", "label": "Telangana"}, {"value": "tripura", "label": "Tripura"}, {"value": "uttar_pradesh", "label": "Uttar Pradesh"}, {"value": "uttarakhand", "label": "Uttarakhand"}, {"value": "west_bengal", "label": "West Bengal"}, {"value": "delhi", "label": "Delhi"}, {"value": "chandigarh", "label": "Chandigarh"}]'::JSONB WHERE field_name = 'state' AND is_base_field = true;

-- Co-applicant Base Fields
INSERT INTO ulap_profile_fields (field_name, field_label, field_type, placeholder, is_required, validation_rules, display_order, field_section, is_base_field) VALUES
('coapplicant_full_name', 'Co-applicant Full Name', 'text', 'Enter co-applicant name', false, '{"minLength": 3, "maxLength": 100}'::JSONB, 1, 'coapplicant', true),
('coapplicant_mobile', 'Co-applicant Mobile', 'phone', '10-digit mobile number', false, '{"pattern": "^[6-9][0-9]{9}$"}'::JSONB, 2, 'coapplicant', true),
('coapplicant_relationship', 'Relationship with Applicant', 'select', 'Select relationship', false, '{}'::JSONB, 3, 'coapplicant', true),
('coapplicant_pan', 'Co-applicant PAN', 'pan', 'ABCDE1234F', false, '{"pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"}'::JSONB, 4, 'coapplicant', true),
('coapplicant_income', 'Co-applicant Monthly Income', 'currency', 'Enter monthly income', false, '{"min": 0}'::JSONB, 5, 'coapplicant', true)
ON CONFLICT DO NOTHING;

UPDATE ulap_profile_fields SET options = '[{"value": "spouse", "label": "Spouse"}, {"value": "parent", "label": "Parent"}, {"value": "sibling", "label": "Sibling"}, {"value": "child", "label": "Son/Daughter"}, {"value": "business_partner", "label": "Business Partner"}, {"value": "other", "label": "Other"}]'::JSONB WHERE field_name = 'coapplicant_relationship' AND is_base_field = true;

-- Loan Amount Base Field
INSERT INTO ulap_profile_fields (field_name, field_label, field_type, placeholder, is_required, validation_rules, display_order, field_section, is_base_field) VALUES
('loan_amount_required', 'Loan Amount Required', 'currency', 'Enter required loan amount', true, '{"min": 10000}'::JSONB, 1, 'loan', true),
('loan_tenure_preferred', 'Preferred Tenure (months)', 'number', 'Enter tenure in months', false, '{"min": 6, "max": 360}'::JSONB, 2, 'loan', true),
('loan_purpose', 'Purpose of Loan', 'textarea', 'Briefly describe the purpose', false, '{"maxLength": 500}'::JSONB, 3, 'loan', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Done!
-- =====================================================
