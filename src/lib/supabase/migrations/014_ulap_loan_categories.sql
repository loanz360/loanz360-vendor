-- =====================================================
-- ULAP LOAN CATEGORIES AND SUBCATEGORIES
-- Version: 1.0.0
-- Date: 2025-01-16
-- Purpose: Create loan categories and subcategories tables for ULAP dynamic forms
-- =====================================================

-- =====================================================
-- 1. CREATE LOAN CATEGORIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_loan_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_secured BOOLEAN DEFAULT false, -- Whether this category requires property/collateral
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on name
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_loan_categories_name
  ON public.ulap_loan_categories(name);

-- Index for active categories ordered by display
CREATE INDEX IF NOT EXISTS idx_ulap_loan_categories_active_order
  ON public.ulap_loan_categories(is_active, display_order);

-- =====================================================
-- 2. CREATE LOAN SUBCATEGORIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ulap_loan_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.ulap_loan_categories(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  image_url TEXT,
  min_amount DECIMAL(15, 2),
  max_amount DECIMAL(15, 2),
  min_tenure_months INTEGER,
  max_tenure_months INTEGER,
  interest_rate_range VARCHAR(50),
  processing_fee_range VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  requires_property_details BOOLEAN DEFAULT false, -- Whether property tab should show
  requires_vehicle_details BOOLEAN DEFAULT false, -- For vehicle loans
  requires_business_details BOOLEAN DEFAULT false, -- For business loans
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique code within category
CREATE UNIQUE INDEX IF NOT EXISTS idx_ulap_subcategories_code
  ON public.ulap_loan_subcategories(code);

-- Index for category lookup
CREATE INDEX IF NOT EXISTS idx_ulap_subcategories_category
  ON public.ulap_loan_subcategories(category_id);

-- Index for active subcategories
CREATE INDEX IF NOT EXISTS idx_ulap_subcategories_active
  ON public.ulap_loan_subcategories(is_active, display_order);

-- =====================================================
-- 3. INSERT DEFAULT LOAN CATEGORIES (15 categories)
-- =====================================================

INSERT INTO public.ulap_loan_categories (id, name, description, icon, color, display_order, is_active, is_secured) VALUES
  ('cat-01-personal', 'Personal Loans', 'Unsecured personal loans for salaried and self-employed individuals', 'user', '#3B82F6', 1, true, false),
  ('cat-02-business', 'Business Loans', 'Working capital and business expansion loans', 'briefcase', '#8B5CF6', 2, true, false),
  ('cat-03-home', 'Home Loans', 'Loans for purchasing, constructing, or renovating homes', 'home', '#10B981', 3, true, true),
  ('cat-04-mortgage', 'Mortgage / LAP', 'Loan against residential, commercial, or industrial property', 'building', '#F59E0B', 4, true, true),
  ('cat-05-vehicle', 'Vehicle Loans', 'Loans for cars, bikes, commercial vehicles', 'car', '#EF4444', 5, true, false),
  ('cat-06-machinery', 'Machinery / Equipment', 'Financing for industrial machinery and equipment', 'cog', '#6366F1', 6, true, false),
  ('cat-07-professional', 'Professional Loans', 'Specialized loans for doctors, CAs, lawyers', 'user-tie', '#EC4899', 7, true, false),
  ('cat-08-nri', 'NRI Loans', 'Home and property loans for Non-Resident Indians', 'globe', '#14B8A6', 8, true, true),
  ('cat-09-education', 'Educational Loans', 'Loans for domestic and international education', 'book', '#06B6D4', 9, true, false),
  ('cat-10-institution', 'Institution Loans', 'Loans for schools, hospitals, trusts', 'library', '#A855F7', 10, true, true),
  ('cat-11-working-capital', 'Working Capital', 'Cash credit, overdraft, LC, BG facilities', 'currency-rupee', '#F97316', 11, true, false),
  ('cat-12-rentals', 'Loan Against Rentals', 'Loans against rental income from properties', 'key', '#84CC16', 12, true, true),
  ('cat-13-builder', 'Builder Loans', 'Project finance for builders and developers', 'building-office', '#0EA5E9', 13, true, true),
  ('cat-14-women', 'Women Professional', 'Special schemes for women entrepreneurs', 'user-female', '#D946EF', 14, true, false),
  ('cat-15-govt', 'Govt Schemes', 'Government-backed loan schemes', 'flag', '#22C55E', 15, true, false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. INSERT DEFAULT LOAN SUBCATEGORIES (66 subcategories)
-- =====================================================

-- 1. Personal Loans (5 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-01-personal', 'PL_SALARIED', 'Salaried Personal Loan', 'Personal loan for salaried individuals', 'user', 50000, 4000000, 12, 60, 1, true, false),
  ('cat-01-personal', 'PL_SELF_EMPLOYED', 'Self Employed Personal Loan', 'Personal loan for self-employed individuals', 'briefcase', 100000, 5000000, 12, 60, 2, true, false),
  ('cat-01-personal', 'PL_PENSION', 'Pensioner Personal Loan', 'Personal loan for pensioners', 'user-clock', 50000, 2000000, 12, 48, 3, true, false),
  ('cat-01-personal', 'PL_BALANCE_TRANSFER', 'Personal Loan Balance Transfer', 'Transfer existing personal loan for better rates', 'refresh', 50000, 4000000, 12, 60, 4, true, false),
  ('cat-01-personal', 'PL_TOP_UP', 'Personal Loan Top Up', 'Additional loan on existing personal loan', 'plus-circle', 25000, 2000000, 12, 48, 5, true, false)
ON CONFLICT DO NOTHING;

-- 2. Business Loans (7 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details, requires_business_details) VALUES
  ('cat-02-business', 'BL_SME', 'SME / MSME Loan', 'Loan for small and medium enterprises', 'building', 500000, 50000000, 12, 84, 1, true, false, true),
  ('cat-02-business', 'BL_UNSECURED', 'Unsecured Business Loan', 'Business loan without collateral', 'shield-off', 100000, 5000000, 12, 48, 2, true, false, true),
  ('cat-02-business', 'BL_SECURED', 'Secured Business Loan', 'Business loan with collateral', 'shield', 500000, 100000000, 12, 180, 3, true, true, true),
  ('cat-02-business', 'BL_STARTUP', 'Startup Loan', 'Loan for new business ventures', 'rocket', 500000, 20000000, 12, 84, 4, true, false, true),
  ('cat-02-business', 'BL_INVOICE', 'Invoice Discounting', 'Financing against unpaid invoices', 'file-invoice', 100000, 10000000, 1, 12, 5, true, false, true),
  ('cat-02-business', 'BL_MERCHANT', 'Merchant Cash Advance', 'Advance based on card sales', 'credit-card', 50000, 5000000, 3, 24, 6, true, false, true),
  ('cat-02-business', 'BL_OVERDRAFT', 'Business Overdraft', 'Flexible overdraft facility', 'wallet', 100000, 10000000, 12, 36, 7, true, false, true)
ON CONFLICT DO NOTHING;

-- 3. Home Loans (6 subcategories) - All require property details
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-03-home', 'HL_PURCHASE', 'Home Purchase Loan', 'Loan for buying a ready home', 'home', 500000, 100000000, 60, 360, 1, true, true),
  ('cat-03-home', 'HL_CONSTRUCTION', 'Home Construction Loan', 'Loan for constructing a home', 'building', 500000, 50000000, 60, 240, 2, true, true),
  ('cat-03-home', 'HL_EXTENSION', 'Home Extension Loan', 'Loan for extending existing home', 'expand', 200000, 20000000, 36, 180, 3, true, true),
  ('cat-03-home', 'HL_IMPROVEMENT', 'Home Improvement Loan', 'Loan for renovating your home', 'paint-brush', 100000, 10000000, 24, 120, 4, true, true),
  ('cat-03-home', 'HL_BALANCE_TRANSFER', 'Home Loan Balance Transfer', 'Transfer existing home loan', 'refresh', 500000, 100000000, 60, 360, 5, true, true),
  ('cat-03-home', 'HL_TOP_UP', 'Home Loan Top Up', 'Additional loan on existing home loan', 'plus-circle', 200000, 30000000, 36, 180, 6, true, true)
ON CONFLICT DO NOTHING;

-- 4. Mortgage / LAP (5 subcategories) - All require property details
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-04-mortgage', 'LAP_RESIDENTIAL', 'LAP Residential Property', 'Loan against residential property', 'home', 500000, 100000000, 36, 180, 1, true, true),
  ('cat-04-mortgage', 'LAP_COMMERCIAL', 'LAP Commercial Property', 'Loan against commercial property', 'building', 1000000, 200000000, 36, 180, 2, true, true),
  ('cat-04-mortgage', 'LAP_INDUSTRIAL', 'LAP Industrial Property', 'Loan against industrial property', 'factory', 2000000, 500000000, 36, 180, 3, true, true),
  ('cat-04-mortgage', 'LAP_BALANCE_TRANSFER', 'LAP Balance Transfer', 'Transfer existing LAP', 'refresh', 500000, 100000000, 36, 180, 4, true, true),
  ('cat-04-mortgage', 'LAP_TOP_UP', 'LAP Top Up', 'Additional loan on existing LAP', 'plus-circle', 200000, 50000000, 36, 120, 5, true, true)
ON CONFLICT DO NOTHING;

-- 5. Vehicle Loans (6 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_vehicle_details) VALUES
  ('cat-05-vehicle', 'VL_NEW_CAR', 'New Car Loan', 'Loan for purchasing a new car', 'car', 100000, 10000000, 12, 84, 1, true, true),
  ('cat-05-vehicle', 'VL_USED_CAR', 'Used Car Loan', 'Loan for purchasing a used car', 'car-side', 50000, 5000000, 12, 60, 2, true, true),
  ('cat-05-vehicle', 'VL_TWO_WHEELER', 'Two Wheeler Loan', 'Loan for bikes and scooters', 'motorcycle', 20000, 500000, 12, 48, 3, true, true),
  ('cat-05-vehicle', 'VL_COMMERCIAL', 'Commercial Vehicle Loan', 'Loan for trucks, buses, tempos', 'truck', 500000, 50000000, 12, 84, 4, true, true),
  ('cat-05-vehicle', 'VL_THREE_WHEELER', 'Three Wheeler Loan', 'Loan for auto-rickshaws', 'auto', 50000, 500000, 12, 48, 5, true, true),
  ('cat-05-vehicle', 'VL_REFINANCE', 'Vehicle Refinance', 'Loan against existing vehicle', 'refresh', 50000, 5000000, 12, 48, 6, true, true)
ON CONFLICT DO NOTHING;

-- 6. Machinery / Equipment (4 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_business_details) VALUES
  ('cat-06-machinery', 'ML_NEW', 'New Machinery Loan', 'Loan for purchasing new machinery', 'cog', 500000, 100000000, 12, 84, 1, true, true),
  ('cat-06-machinery', 'ML_USED', 'Used Machinery Loan', 'Loan for purchasing used machinery', 'cog', 200000, 50000000, 12, 60, 2, true, true),
  ('cat-06-machinery', 'ML_EQUIPMENT', 'Equipment Finance', 'Financing for business equipment', 'tools', 100000, 20000000, 12, 60, 3, true, true),
  ('cat-06-machinery', 'ML_MEDICAL', 'Medical Equipment Loan', 'Loan for medical equipment', 'stethoscope', 200000, 50000000, 12, 84, 4, true, true)
ON CONFLICT DO NOTHING;

-- 7. Professional Loans (5 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active) VALUES
  ('cat-07-professional', 'PRF_DOCTOR', 'Doctor Loan', 'Loan for medical professionals', 'stethoscope', 200000, 30000000, 12, 84, 1, true),
  ('cat-07-professional', 'PRF_CA', 'CA / CS Loan', 'Loan for chartered accountants', 'calculator', 100000, 20000000, 12, 84, 2, true),
  ('cat-07-professional', 'PRF_ARCHITECT', 'Architect / Engineer Loan', 'Loan for architects and engineers', 'ruler', 100000, 20000000, 12, 84, 3, true),
  ('cat-07-professional', 'PRF_LAWYER', 'Lawyer Loan', 'Loan for legal professionals', 'scale', 100000, 15000000, 12, 84, 4, true),
  ('cat-07-professional', 'PRF_CONSULTANT', 'Consultant Loan', 'Loan for consultants', 'user-tie', 100000, 10000000, 12, 60, 5, true)
ON CONFLICT DO NOTHING;

-- 8. NRI Loans (4 subcategories) - Most require property details
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-08-nri', 'NRI_HOME', 'NRI Home Loan', 'Home loan for NRIs', 'home', 1000000, 100000000, 60, 240, 1, true, true),
  ('cat-08-nri', 'NRI_LAP', 'NRI LAP', 'Loan against property for NRIs', 'building', 1000000, 100000000, 36, 180, 2, true, true),
  ('cat-08-nri', 'NRI_PLOT', 'NRI Plot Loan', 'Plot purchase loan for NRIs', 'map', 500000, 50000000, 36, 180, 3, true, true),
  ('cat-08-nri', 'NRI_BALANCE_TRANSFER', 'NRI Balance Transfer', 'Transfer existing NRI loan', 'refresh', 1000000, 100000000, 60, 240, 4, true, true)
ON CONFLICT DO NOTHING;

-- 9. Educational Loans (4 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active) VALUES
  ('cat-09-education', 'EL_DOMESTIC', 'Domestic Education Loan', 'Education loan for studies in India', 'book', 100000, 5000000, 36, 180, 1, true),
  ('cat-09-education', 'EL_ABROAD', 'Abroad Education Loan', 'Education loan for studies abroad', 'globe', 500000, 20000000, 36, 180, 2, true),
  ('cat-09-education', 'EL_SKILL', 'Skill Development Loan', 'Loan for professional courses', 'certificate', 50000, 1000000, 12, 60, 3, true),
  ('cat-09-education', 'EL_EXECUTIVE', 'Executive Education Loan', 'Loan for MBA/executive programs', 'graduation-cap', 500000, 15000000, 36, 120, 4, true)
ON CONFLICT DO NOTHING;

-- 10. Institution Loans (4 subcategories) - All require property details
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-10-institution', 'INST_SCHOOL', 'School Infrastructure Loan', 'Loan for school infrastructure', 'school', 1000000, 100000000, 36, 180, 1, true, true),
  ('cat-10-institution', 'INST_COLLEGE', 'College / University Loan', 'Loan for higher education institutions', 'university', 5000000, 500000000, 36, 240, 2, true, true),
  ('cat-10-institution', 'INST_HOSPITAL', 'Hospital / Healthcare Loan', 'Loan for healthcare facilities', 'hospital', 5000000, 500000000, 36, 240, 3, true, true),
  ('cat-10-institution', 'INST_TRUST', 'Trust / NGO Loan', 'Loan for trusts and NGOs', 'hands-heart', 500000, 50000000, 36, 120, 4, true, true)
ON CONFLICT DO NOTHING;

-- 11. Working Capital (4 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_business_details) VALUES
  ('cat-11-working-capital', 'WC_CC', 'Cash Credit', 'Cash credit facility', 'currency-rupee', 500000, 100000000, 12, 12, 1, true, true),
  ('cat-11-working-capital', 'WC_OD', 'Overdraft Facility', 'Overdraft against collateral', 'wallet', 500000, 50000000, 12, 12, 2, true, true),
  ('cat-11-working-capital', 'WC_LC', 'Letter of Credit', 'LC facility for trade', 'file-text', 100000, 50000000, 1, 12, 3, true, true),
  ('cat-11-working-capital', 'WC_BG', 'Bank Guarantee', 'Bank guarantee facility', 'shield-check', 100000, 100000000, 1, 36, 4, true, true)
ON CONFLICT DO NOTHING;

-- 12. Loan Against Rentals (3 subcategories) - All require property details
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-12-rentals', 'LAR_RESIDENTIAL', 'Residential Rental Loan', 'Loan against residential rentals', 'home', 500000, 50000000, 36, 180, 1, true, true),
  ('cat-12-rentals', 'LAR_COMMERCIAL', 'Commercial Rental Loan', 'Loan against commercial rentals', 'building', 1000000, 100000000, 36, 180, 2, true, true),
  ('cat-12-rentals', 'LAR_LRD', 'Lease Rental Discounting', 'LRD for rental income', 'file-contract', 5000000, 200000000, 36, 180, 3, true, true)
ON CONFLICT DO NOTHING;

-- 13. Builder Loans (4 subcategories) - All require property details
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_property_details) VALUES
  ('cat-13-builder', 'BLD_CONSTRUCTION', 'Builder Construction Finance', 'Loan for project construction', 'building', 10000000, 1000000000, 12, 48, 1, true, true),
  ('cat-13-builder', 'BLD_LAND', 'Builder Land Purchase', 'Loan for land acquisition', 'map', 5000000, 500000000, 12, 36, 2, true, true),
  ('cat-13-builder', 'BLD_PLOTTED', 'Plotted Development Loan', 'Loan for plotted development', 'grid', 5000000, 200000000, 12, 36, 3, true, true),
  ('cat-13-builder', 'BLD_COMMERCIAL', 'Commercial Project Finance', 'Loan for commercial projects', 'building-office', 10000000, 1000000000, 12, 60, 4, true, true)
ON CONFLICT DO NOTHING;

-- 14. Women Professional (3 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_business_details) VALUES
  ('cat-14-women', 'WPF_BUSINESS', 'Women Entrepreneur Loan', 'Business loan for women', 'user-female', 100000, 20000000, 12, 84, 1, true, true),
  ('cat-14-women', 'WPF_PROFESSIONAL', 'Women Professional Loan', 'Professional loan for women', 'briefcase', 100000, 15000000, 12, 84, 2, true, false),
  ('cat-14-women', 'WPF_MUDRA', 'Women Mudra Loan', 'Mudra loan for women', 'hand-holding-usd', 10000, 1000000, 12, 60, 3, true, true)
ON CONFLICT DO NOTHING;

-- 15. Govt Schemes (4 subcategories)
INSERT INTO public.ulap_loan_subcategories (category_id, code, name, description, icon, min_amount, max_amount, min_tenure_months, max_tenure_months, display_order, is_active, requires_business_details) VALUES
  ('cat-15-govt', 'GOVT_MUDRA', 'Mudra Loan', 'Pradhan Mantri Mudra Yojana', 'flag', 10000, 1000000, 12, 60, 1, true, true),
  ('cat-15-govt', 'GOVT_STANDUP', 'Stand Up India', 'Stand Up India scheme', 'flag', 1000000, 10000000, 12, 84, 2, true, true),
  ('cat-15-govt', 'GOVT_PMEGP', 'PMEGP Loan', 'Prime Minister Employment Generation', 'flag', 100000, 5000000, 12, 84, 3, true, true),
  ('cat-15-govt', 'GOVT_CGTMSE', 'CGTMSE Scheme', 'Credit Guarantee Trust scheme', 'shield', 100000, 20000000, 12, 84, 4, true, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_ulap_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ulap_categories_updated ON public.ulap_loan_categories;
CREATE TRIGGER trigger_ulap_categories_updated
  BEFORE UPDATE ON public.ulap_loan_categories
  FOR EACH ROW EXECUTE FUNCTION update_ulap_categories_updated_at();

DROP TRIGGER IF EXISTS trigger_ulap_subcategories_updated ON public.ulap_loan_subcategories;
CREATE TRIGGER trigger_ulap_subcategories_updated
  BEFORE UPDATE ON public.ulap_loan_subcategories
  FOR EACH ROW EXECUTE FUNCTION update_ulap_categories_updated_at();

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE public.ulap_loan_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ulap_loan_subcategories ENABLE ROW LEVEL SECURITY;

-- Allow public read access for categories (needed for form rendering)
DROP POLICY IF EXISTS "Public can view active loan categories" ON public.ulap_loan_categories;
CREATE POLICY "Public can view active loan categories"
  ON public.ulap_loan_categories FOR SELECT
  USING (is_active = true);

-- Allow public read access for subcategories (needed for form rendering)
DROP POLICY IF EXISTS "Public can view active loan subcategories" ON public.ulap_loan_subcategories;
CREATE POLICY "Public can view active loan subcategories"
  ON public.ulap_loan_subcategories FOR SELECT
  USING (is_active = true);

-- Super admin can manage all
DROP POLICY IF EXISTS "Super admin can manage loan categories" ON public.ulap_loan_categories;
CREATE POLICY "Super admin can manage loan categories"
  ON public.ulap_loan_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Super admin can manage loan subcategories" ON public.ulap_loan_subcategories;
CREATE POLICY "Super admin can manage loan subcategories"
  ON public.ulap_loan_subcategories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE public.ulap_loan_categories IS 'Master table for loan categories in ULAP system';
COMMENT ON TABLE public.ulap_loan_subcategories IS 'Loan subcategories with specific requirements and amounts';
COMMENT ON COLUMN public.ulap_loan_categories.is_secured IS 'Whether this loan category requires collateral/property';
COMMENT ON COLUMN public.ulap_loan_subcategories.requires_property_details IS 'Whether Property Details tab should be shown';
COMMENT ON COLUMN public.ulap_loan_subcategories.requires_vehicle_details IS 'Whether Vehicle Details tab should be shown';
COMMENT ON COLUMN public.ulap_loan_subcategories.requires_business_details IS 'Whether Business Details tab should be shown';

-- =====================================================
-- 8. MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('014_ulap_loan_categories', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
