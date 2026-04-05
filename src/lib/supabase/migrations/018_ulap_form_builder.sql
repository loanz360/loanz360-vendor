-- =====================================================
-- ULAP FORM BUILDER - PROFILES & FORM CONFIGURATIONS
-- Version: 1.0.0
-- Date: 2025-01-18
-- Purpose: Create tables for dynamic form builder with profiles and form configurations
-- =====================================================

-- =====================================================
-- 1. APPLICANT PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_applicant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL,  -- e.g., 'SALARIED', 'SELF_EMPLOYED_BUSINESS'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique key constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_applicant_profiles_key
  ON public.ulap_applicant_profiles(key);

-- Index for active profiles ordered by display
CREATE INDEX IF NOT EXISTS idx_ulap_applicant_profiles_active_order
  ON public.ulap_applicant_profiles(is_active, display_order);

-- =====================================================
-- 2. APPLICANT SUB-PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_applicant_sub_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.ulap_applicant_profiles(id) ON DELETE CASCADE,
  key VARCHAR(50) NOT NULL,  -- e.g., 'PRIVATE_SECTOR', 'GOVERNMENT'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique key within profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_sub_profiles_key
  ON public.ulap_applicant_sub_profiles(profile_id, key);

-- Index for profile lookup
CREATE INDEX IF NOT EXISTS idx_ulap_sub_profiles_profile
  ON public.ulap_applicant_sub_profiles(profile_id);

-- Index for active sub-profiles
CREATE INDEX IF NOT EXISTS idx_ulap_sub_profiles_active
  ON public.ulap_applicant_sub_profiles(is_active, display_order);

-- =====================================================
-- 3. FORM CONFIGURATIONS TABLE
-- (The 4-dimensional key: category + loan type + profile + sub-profile)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_form_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- 4-dimensional key
  category_id UUID NOT NULL REFERENCES public.ulap_loan_categories(id) ON DELETE CASCADE,
  loan_type_id UUID NOT NULL REFERENCES public.ulap_loan_subcategories(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.ulap_applicant_profiles(id) ON DELETE CASCADE,
  sub_profile_id UUID NOT NULL REFERENCES public.ulap_applicant_sub_profiles(id) ON DELETE CASCADE,

  -- Status & versioning
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT false,

  -- Audit
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Unique constraint for active configuration per combination (only one published per combo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_form_config_unique_combo
  ON public.ulap_form_configurations(category_id, loan_type_id, profile_id, sub_profile_id)
  WHERE status = 'published';

-- Index for lookup by category
CREATE INDEX IF NOT EXISTS idx_ulap_form_config_category
  ON public.ulap_form_configurations(category_id);

-- Index for lookup by loan type
CREATE INDEX IF NOT EXISTS idx_ulap_form_config_loan_type
  ON public.ulap_form_configurations(loan_type_id);

-- Index for status filter
CREATE INDEX IF NOT EXISTS idx_ulap_form_config_status
  ON public.ulap_form_configurations(status);

-- =====================================================
-- 4. FORM CONFIGURATION TABS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_form_configuration_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_configuration_id UUID NOT NULL REFERENCES public.ulap_form_configurations(id) ON DELETE CASCADE,
  tab_key VARCHAR(50) NOT NULL,  -- e.g., 'personal_info', 'employment', 'documents'
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique tab key within configuration
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_form_tabs_unique_key
  ON public.ulap_form_configuration_tabs(form_configuration_id, tab_key);

-- Index for form configuration lookup
CREATE INDEX IF NOT EXISTS idx_ulap_form_tabs_config
  ON public.ulap_form_configuration_tabs(form_configuration_id);

-- =====================================================
-- 5. FORM CONFIGURATION FIELDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_form_configuration_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_configuration_id UUID NOT NULL REFERENCES public.ulap_form_configurations(id) ON DELETE CASCADE,
  tab_id UUID NOT NULL REFERENCES public.ulap_form_configuration_tabs(id) ON DELETE CASCADE,

  -- Field definition
  field_key VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL,  -- text, select, file, ocr_pan, etc.
  label VARCHAR(200) NOT NULL,
  placeholder VARCHAR(200),
  helper_text TEXT,
  default_value TEXT,

  -- Layout
  column_span INTEGER DEFAULT 1 CHECK (column_span BETWEEN 1 AND 4),
  display_order INTEGER DEFAULT 0,

  -- Validation
  is_required BOOLEAN DEFAULT false,
  validation_rules JSONB DEFAULT '{}',  -- {min, max, pattern, minLength, maxLength, etc.}

  -- Options (for select, radio, checkbox)
  options JSONB DEFAULT '[]',  -- [{value, label}, ...]

  -- Conditional logic
  conditional_logic JSONB DEFAULT '{}',  -- {show_when: {field, operator, value}}

  -- Field-specific config (OCR settings, file types, etc.)
  field_config JSONB DEFAULT '{}',

  -- Visibility
  is_visible BOOLEAN DEFAULT true,
  is_read_only BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique field key within tab
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_form_fields_unique_key
  ON public.ulap_form_configuration_fields(tab_id, field_key);

-- Index for tab lookup
CREATE INDEX IF NOT EXISTS idx_ulap_form_fields_tab
  ON public.ulap_form_configuration_fields(tab_id);

-- Index for form configuration lookup
CREATE INDEX IF NOT EXISTS idx_ulap_form_fields_config
  ON public.ulap_form_configuration_fields(form_configuration_id);

-- =====================================================
-- 6. BASIC LEAD FIELDS TABLE (Phase 1 - Lead Capture)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_basic_lead_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  field_type VARCHAR(30) NOT NULL,
  placeholder VARCHAR(100),
  helper_text TEXT,
  is_required BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT true,  -- shown by default in lead capture
  display_order INTEGER DEFAULT 0,
  validation_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique field key
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_basic_fields_key
  ON public.ulap_basic_lead_fields(field_key);

-- Index for active fields
CREATE INDEX IF NOT EXISTS idx_ulap_basic_fields_active
  ON public.ulap_basic_lead_fields(is_active, display_order);

-- =====================================================
-- 7. INSERT DEFAULT APPLICANT PROFILES (8 profiles)
-- =====================================================

INSERT INTO public.ulap_applicant_profiles (key, name, description, icon, color, display_order, is_active) VALUES
  ('SALARIED', 'Salaried Individual', 'Employees working in private or government sector', 'briefcase', '#3B82F6', 1, true),
  ('SELF_EMPLOYED_PROFESSIONAL', 'Self Employed Professional', 'Doctors, lawyers, CAs, architects, consultants', 'user-tie', '#8B5CF6', 2, true),
  ('SELF_EMPLOYED_BUSINESS', 'Self Employed Business', 'Business owners, traders, manufacturers', 'store', '#10B981', 3, true),
  ('BUSINESS_ENTITY', 'Business Entity', 'Companies, partnerships, LLPs, trusts', 'building', '#F59E0B', 4, true),
  ('AGRICULTURE', 'Agriculture', 'Farmers, agri-business owners', 'wheat', '#84CC16', 5, true),
  ('NRI', 'NRI / PIO', 'Non-Resident Indians and Persons of Indian Origin', 'globe', '#14B8A6', 6, true),
  ('PENSIONER', 'Pensioner', 'Retired individuals receiving pension', 'user-clock', '#6366F1', 7, true),
  ('STUDENT', 'Student', 'Students applying for education loans', 'graduation-cap', '#EC4899', 8, true)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 8. INSERT DEFAULT SUB-PROFILES (25+ sub-profiles)
-- =====================================================

-- Salaried Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('PRIVATE_SECTOR', 'Private Sector Employee', 'Working in private companies', 'building-office', 1),
  ('GOVERNMENT', 'Government Employee', 'Central/State government employees', 'landmark', 2),
  ('PSU', 'PSU Employee', 'Public Sector Undertaking employees', 'building-2', 3),
  ('DEFENSE', 'Defense Personnel', 'Army, Navy, Air Force personnel', 'shield', 4),
  ('MNC', 'MNC Employee', 'Working in multinational companies', 'globe-2', 5)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'SALARIED'
ON CONFLICT (profile_id, key) DO NOTHING;

-- Self Employed Professional Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('DOCTOR', 'Doctor / Medical Professional', 'Doctors, dentists, medical practitioners', 'stethoscope', 1),
  ('CHARTERED_ACCOUNTANT', 'Chartered Accountant', 'CA, CS, CMA professionals', 'calculator', 2),
  ('LAWYER', 'Lawyer / Advocate', 'Legal professionals', 'scale', 3),
  ('ARCHITECT', 'Architect / Engineer', 'Architects, civil engineers, consultants', 'ruler', 4),
  ('CONSULTANT', 'Consultant', 'Management, IT, and other consultants', 'user-tie', 5)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'SELF_EMPLOYED_PROFESSIONAL'
ON CONFLICT (profile_id, key) DO NOTHING;

-- Self Employed Business Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('PROPRIETORSHIP', 'Proprietorship', 'Sole proprietor business', 'user', 1),
  ('PARTNERSHIP', 'Partnership Firm', 'Partnership business', 'users', 2),
  ('TRADER', 'Trader', 'Wholesale/retail traders', 'shopping-cart', 3),
  ('MANUFACTURER', 'Manufacturer', 'Manufacturing business', 'factory', 4),
  ('SERVICE_PROVIDER', 'Service Provider', 'Service-based business', 'briefcase', 5)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'SELF_EMPLOYED_BUSINESS'
ON CONFLICT (profile_id, key) DO NOTHING;

-- Business Entity Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('PRIVATE_LIMITED', 'Private Limited Company', 'Pvt. Ltd. companies', 'building', 1),
  ('PUBLIC_LIMITED', 'Public Limited Company', 'Public Ltd. companies', 'building-office-2', 2),
  ('LLP', 'Limited Liability Partnership', 'LLP registered firms', 'handshake', 3),
  ('TRUST', 'Trust / Society', 'Registered trusts and societies', 'heart-handshake', 4),
  ('HUF', 'Hindu Undivided Family', 'HUF business entities', 'home', 5)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'BUSINESS_ENTITY'
ON CONFLICT (profile_id, key) DO NOTHING;

-- Agriculture Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('FARMER_INDIVIDUAL', 'Individual Farmer', 'Individual land-owning farmers', 'wheat', 1),
  ('AGRI_BUSINESS', 'Agri-Business', 'Agricultural business entities', 'tractor', 2),
  ('DAIRY_FARMER', 'Dairy Farmer', 'Dairy and animal husbandry', 'milk', 3)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'AGRICULTURE'
ON CONFLICT (profile_id, key) DO NOTHING;

-- NRI Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('NRI_EMPLOYED', 'NRI Salaried', 'NRIs working abroad', 'briefcase', 1),
  ('NRI_BUSINESS', 'NRI Business', 'NRIs running business abroad', 'building', 2),
  ('PIO', 'Person of Indian Origin', 'PIOs and OCIs', 'user', 3)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'NRI'
ON CONFLICT (profile_id, key) DO NOTHING;

-- Pensioner Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('GOVT_PENSIONER', 'Government Pensioner', 'Retired government employees', 'landmark', 1),
  ('PRIVATE_PENSIONER', 'Private Pensioner', 'Retired from private sector', 'building-office', 2),
  ('DEFENSE_PENSIONER', 'Defense Pensioner', 'Retired defense personnel', 'shield', 3)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'PENSIONER'
ON CONFLICT (profile_id, key) DO NOTHING;

-- Student Sub-Profiles
INSERT INTO public.ulap_applicant_sub_profiles (profile_id, key, name, description, icon, display_order, is_active)
SELECT p.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.ulap_applicant_profiles p
CROSS JOIN (VALUES
  ('UNDERGRADUATE', 'Undergraduate Student', 'Pursuing bachelor degree', 'book', 1),
  ('POSTGRADUATE', 'Postgraduate Student', 'Pursuing master/doctoral degree', 'graduation-cap', 2),
  ('PROFESSIONAL_COURSE', 'Professional Course', 'MBA, engineering, medical students', 'certificate', 3)
) AS v(key, name, description, icon, display_order)
WHERE p.key = 'STUDENT'
ON CONFLICT (profile_id, key) DO NOTHING;

-- =====================================================
-- 9. INSERT DEFAULT BASIC LEAD FIELDS (Phase 1)
-- =====================================================

INSERT INTO public.ulap_basic_lead_fields (field_key, label, field_type, placeholder, is_required, is_default, display_order, is_active, validation_rules) VALUES
  ('full_name', 'Full Name', 'text', 'Enter full name as per ID', true, true, 1, true, '{"minLength": 2, "maxLength": 100}'),
  ('mobile', 'Mobile Number', 'phone', '10-digit mobile number', true, true, 2, true, '{"pattern": "^[6-9]\\d{9}$"}'),
  ('email', 'Email Address', 'email', 'email@example.com', false, true, 3, true, '{"pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"}'),
  ('loan_amount', 'Loan Amount Required', 'currency', 'Enter amount in INR', true, true, 4, true, '{"min": 10000}'),
  ('city', 'City', 'text', 'Enter your city', true, true, 5, true, '{"minLength": 2}'),
  ('pincode', 'Pincode', 'text', '6-digit pincode', false, true, 6, true, '{"pattern": "^[1-9][0-9]{5}$"}'),
  ('employment_type', 'Employment Type', 'select', 'Select employment type', false, true, 7, true, '{}'),
  ('monthly_income', 'Monthly Income', 'currency', 'Gross monthly income', false, false, 8, true, '{"min": 0}'),
  ('company_name', 'Company/Business Name', 'text', 'Current employer or business', false, false, 9, true, '{}'),
  ('existing_loans', 'Existing Loan EMI', 'currency', 'Total monthly EMI payments', false, false, 10, true, '{"min": 0}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_ulap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applicant Profiles trigger
DROP TRIGGER IF EXISTS trigger_ulap_profiles_updated ON public.ulap_applicant_profiles;
CREATE TRIGGER trigger_ulap_profiles_updated
  BEFORE UPDATE ON public.ulap_applicant_profiles
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- Sub-Profiles trigger
DROP TRIGGER IF EXISTS trigger_ulap_sub_profiles_updated ON public.ulap_applicant_sub_profiles;
CREATE TRIGGER trigger_ulap_sub_profiles_updated
  BEFORE UPDATE ON public.ulap_applicant_sub_profiles
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- Form Configurations trigger
DROP TRIGGER IF EXISTS trigger_ulap_form_configs_updated ON public.ulap_form_configurations;
CREATE TRIGGER trigger_ulap_form_configs_updated
  BEFORE UPDATE ON public.ulap_form_configurations
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- Form Tabs trigger
DROP TRIGGER IF EXISTS trigger_ulap_form_tabs_updated ON public.ulap_form_configuration_tabs;
CREATE TRIGGER trigger_ulap_form_tabs_updated
  BEFORE UPDATE ON public.ulap_form_configuration_tabs
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- Form Fields trigger
DROP TRIGGER IF EXISTS trigger_ulap_form_fields_updated ON public.ulap_form_configuration_fields;
CREATE TRIGGER trigger_ulap_form_fields_updated
  BEFORE UPDATE ON public.ulap_form_configuration_fields
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- Basic Lead Fields trigger
DROP TRIGGER IF EXISTS trigger_ulap_basic_fields_updated ON public.ulap_basic_lead_fields;
CREATE TRIGGER trigger_ulap_basic_fields_updated
  BEFORE UPDATE ON public.ulap_basic_lead_fields
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- =====================================================
-- 11. RLS POLICIES
-- =====================================================

ALTER TABLE public.ulap_applicant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulap_applicant_sub_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulap_form_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulap_form_configuration_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulap_form_configuration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulap_basic_lead_fields ENABLE ROW LEVEL SECURITY;

-- Public read access for profiles (needed for form rendering)
DROP POLICY IF EXISTS "Public can view active profiles" ON public.ulap_applicant_profiles;
CREATE POLICY "Public can view active profiles"
  ON public.ulap_applicant_profiles FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active sub-profiles" ON public.ulap_applicant_sub_profiles;
CREATE POLICY "Public can view active sub-profiles"
  ON public.ulap_applicant_sub_profiles FOR SELECT
  USING (is_active = true);

-- Public read access for published form configurations
DROP POLICY IF EXISTS "Public can view published form configurations" ON public.ulap_form_configurations;
CREATE POLICY "Public can view published form configurations"
  ON public.ulap_form_configurations FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Public can view form tabs" ON public.ulap_form_configuration_tabs;
CREATE POLICY "Public can view form tabs"
  ON public.ulap_form_configuration_tabs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ulap_form_configurations fc
      WHERE fc.id = form_configuration_id AND fc.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Public can view form fields" ON public.ulap_form_configuration_fields;
CREATE POLICY "Public can view form fields"
  ON public.ulap_form_configuration_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ulap_form_configurations fc
      WHERE fc.id = form_configuration_id AND fc.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Public can view active basic fields" ON public.ulap_basic_lead_fields;
CREATE POLICY "Public can view active basic fields"
  ON public.ulap_basic_lead_fields FOR SELECT
  USING (is_active = true);

-- Super admin can manage all
DROP POLICY IF EXISTS "Super admin can manage profiles" ON public.ulap_applicant_profiles;
CREATE POLICY "Super admin can manage profiles"
  ON public.ulap_applicant_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Super admin can manage sub-profiles" ON public.ulap_applicant_sub_profiles;
CREATE POLICY "Super admin can manage sub-profiles"
  ON public.ulap_applicant_sub_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Super admin can manage form configurations" ON public.ulap_form_configurations;
CREATE POLICY "Super admin can manage form configurations"
  ON public.ulap_form_configurations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Super admin can manage form tabs" ON public.ulap_form_configuration_tabs;
CREATE POLICY "Super admin can manage form tabs"
  ON public.ulap_form_configuration_tabs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Super admin can manage form fields" ON public.ulap_form_configuration_fields;
CREATE POLICY "Super admin can manage form fields"
  ON public.ulap_form_configuration_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Super admin can manage basic fields" ON public.ulap_basic_lead_fields;
CREATE POLICY "Super admin can manage basic fields"
  ON public.ulap_basic_lead_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 12. COMMENTS
-- =====================================================

COMMENT ON TABLE public.ulap_applicant_profiles IS 'Master table for applicant profile categories (Salaried, Self Employed, etc.)';
COMMENT ON TABLE public.ulap_applicant_sub_profiles IS 'Sub-profiles within each profile category';
COMMENT ON TABLE public.ulap_form_configurations IS 'Form configurations for each combination of loan category + loan type + profile + sub-profile';
COMMENT ON TABLE public.ulap_form_configuration_tabs IS 'Tabs/sections within a form configuration';
COMMENT ON TABLE public.ulap_form_configuration_fields IS 'Fields within each tab of a form configuration';
COMMENT ON TABLE public.ulap_basic_lead_fields IS 'Basic lead capture fields for Phase 1';

-- =====================================================
-- 13. MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('018_ulap_form_builder', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
