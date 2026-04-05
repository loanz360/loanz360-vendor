-- =====================================================
-- CUSTOMER PORTAL SUBROLES & PROFILES
-- Version: 1.0.0
-- Date: 2026-01-18
-- Purpose: Create tables for customer portal restructuring with Subrole -> Profile hierarchy
-- =====================================================

-- =====================================================
-- 1. CUSTOMER SUBROLES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_subroles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  route VARCHAR(50) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  show_entity_profile BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique key constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_subroles_key
  ON public.customer_subroles(key);

-- Unique route constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_subroles_route
  ON public.customer_subroles(route);

-- Index for active subroles ordered by display
CREATE INDEX IF NOT EXISTS idx_customer_subroles_active_order
  ON public.customer_subroles(is_active, display_order);

-- =====================================================
-- 2. CUSTOMER PROFILE DEFINITIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_profile_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subrole_id UUID NOT NULL REFERENCES public.customer_subroles(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique key constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profile_definitions_key
  ON public.customer_profile_definitions(key);

-- Unique key within subrole
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profile_definitions_subrole_key
  ON public.customer_profile_definitions(subrole_id, key);

-- Index for subrole lookup
CREATE INDEX IF NOT EXISTS idx_customer_profile_definitions_subrole
  ON public.customer_profile_definitions(subrole_id);

-- Index for active profiles
CREATE INDEX IF NOT EXISTS idx_customer_profile_definitions_active
  ON public.customer_profile_definitions(is_active, display_order);

-- =====================================================
-- 3. ADD COLUMNS TO CUSTOMER_PROFILES TABLE (if exists)
-- =====================================================

DO $$
BEGIN
  -- Add subrole_key column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'customer_profiles'
    AND column_name = 'subrole_key'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN subrole_key VARCHAR(50);
  END IF;

  -- Add profile_key column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'customer_profiles'
    AND column_name = 'profile_key'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_key VARCHAR(100);
  END IF;

  -- Add profile_locked column if not exists (renamed from sub_category_locked)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'customer_profiles'
    AND column_name = 'profile_locked'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_locked BOOLEAN DEFAULT false;
  END IF;

  -- Add profile_locked_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'customer_profiles'
    AND column_name = 'profile_locked_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_locked_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add index for subrole_key lookup
CREATE INDEX IF NOT EXISTS idx_customer_profiles_subrole_key
  ON public.customer_profiles(subrole_key);

-- Add index for profile_key lookup
CREATE INDEX IF NOT EXISTS idx_customer_profiles_profile_key
  ON public.customer_profiles(profile_key);

-- =====================================================
-- 4. INSERT 13 CUSTOMER SUBROLES
-- =====================================================

INSERT INTO public.customer_subroles (key, name, description, icon, color, route, display_order, is_active, show_entity_profile) VALUES
  ('INDIVIDUAL', 'Individual', 'Individual customers without specific category', 'user', '#6B7280', 'individual', 1, true, false),
  ('SALARIED', 'Salaried', 'Individuals with fixed salary income from employment', 'briefcase', '#3B82F6', 'salaried', 2, true, false),
  ('PROFESSIONAL', 'Self-Employed Professional', 'Self-employed professionals with qualifications', 'user-tie', '#8B5CF6', 'professional', 3, true, false),
  ('BUSINESS', 'Self-Employed Business', 'Business owners and entities', 'building', '#10B981', 'business', 4, true, true),
  ('MSME', 'MSME', 'Micro, Small and Medium Enterprises', 'factory', '#F59E0B', 'msme', 5, true, true),
  ('AGRICULTURE', 'Agriculture & Allied', 'Farmers and agricultural activities', 'wheat', '#84CC16', 'agriculture', 6, true, false),
  ('PENSIONER', 'Pensioner', 'Retired individuals receiving pension', 'user-clock', '#6366F1', 'pensioner', 7, true, false),
  ('NRI', 'NRI', 'Non-Resident Indians', 'globe', '#14B8A6', 'nri', 8, true, false),
  ('WOMEN', 'Women-Specific', 'Women entrepreneurs and professionals', 'user-female', '#EC4899', 'women', 9, true, false),
  ('STUDENT', 'Student', 'Students pursuing education', 'graduation-cap', '#F97316', 'student', 10, true, false),
  ('GIG_ECONOMY', 'Gig Economy & Freelancer', 'Freelancers and gig workers', 'laptop', '#06B6D4', 'gig-economy', 11, true, false),
  ('INSTITUTIONAL', 'Institutional', 'Schools, hospitals, NGOs, trusts', 'landmark', '#8B5CF6', 'institutional', 12, true, true),
  ('SPECIAL', 'Special Categories', 'Homemakers, rental income, senior citizens, etc.', 'star', '#EF4444', 'special', 13, true, false)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  route = EXCLUDED.route,
  display_order = EXCLUDED.display_order,
  show_entity_profile = EXCLUDED.show_entity_profile,
  updated_at = NOW();

-- =====================================================
-- 5. INSERT PROFILES FOR EACH SUBROLE
-- =====================================================

-- INDIVIDUAL Profiles (3)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('INDIVIDUAL_GENERAL', 'General Individual', 'General individual customer', 'user', 1),
  ('INDIVIDUAL_FIRST_TIME', 'First Time Borrower', 'Individual with no credit history', 'user-plus', 2),
  ('INDIVIDUAL_EXISTING', 'Existing Customer', 'Returning customer with credit history', 'user-check', 3)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'INDIVIDUAL'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- SALARIED Profiles (10)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('SALARIED_CENTRAL_GOVT', 'Central Government', 'Central government ministry/department employee', 'landmark', 1),
  ('SALARIED_STATE_GOVT', 'State Government', 'State government body employee', 'building-columns', 2),
  ('SALARIED_PSU', 'PSU', 'Public Sector Undertaking employee', 'building-2', 3),
  ('SALARIED_DEFENCE', 'Defence', 'Army, Navy, Air Force, Paramilitary', 'shield', 4),
  ('SALARIED_PRIVATE', 'Private', 'Private company employee', 'building-office', 5),
  ('SALARIED_MNC', 'MNC', 'Multinational company employee', 'globe-2', 6),
  ('SALARIED_BANK', 'Bank', 'Public/Private bank employee', 'landmark', 7),
  ('SALARIED_TEACHER', 'Teacher', 'Educational institution employee', 'graduation-cap', 8),
  ('SALARIED_HEALTHCARE', 'Healthcare', 'Hospital/clinic employee', 'heart-pulse', 9),
  ('SALARIED_IT', 'IT', 'IT/Software company employee', 'laptop', 10)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'SALARIED'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- PROFESSIONAL Profiles (15)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('PROFESSIONAL_DOCTOR', 'Doctor', 'MBBS, MD, BDS, MDS, BAMS, BHMS', 'stethoscope', 1),
  ('PROFESSIONAL_DENTIST', 'Dentist', 'Dental practitioners', 'tooth', 2),
  ('PROFESSIONAL_CA', 'Chartered Accountant', 'CA professionals', 'calculator', 3),
  ('PROFESSIONAL_CS', 'Company Secretary', 'CS professionals', 'file-text', 4),
  ('PROFESSIONAL_CMA', 'Cost Accountant', 'CMA/ICWA professionals', 'calculator', 5),
  ('PROFESSIONAL_LAWYER', 'Lawyer', 'Legal professionals', 'scale', 6),
  ('PROFESSIONAL_ARCHITECT', 'Architect', 'Architecture professionals', 'ruler', 7),
  ('PROFESSIONAL_ENGINEER', 'Engineer', 'Consulting engineers', 'settings', 8),
  ('PROFESSIONAL_CONSULTANT', 'Consultant', 'Management consultants', 'user-tie', 9),
  ('PROFESSIONAL_TAX_CONSULTANT', 'Tax Consultant', 'Tax advisory professionals', 'receipt', 10),
  ('PROFESSIONAL_FINANCIAL_ADVISOR', 'Financial Advisor', 'Investment advisors', 'trending-up', 11),
  ('PROFESSIONAL_INTERIOR_DESIGNER', 'Interior Designer', 'Interior design professionals', 'palette', 12),
  ('PROFESSIONAL_PHOTOGRAPHER', 'Photographer', 'Professional photographers', 'camera', 13),
  ('PROFESSIONAL_FASHION_DESIGNER', 'Fashion Designer', 'Fashion design professionals', 'shirt', 14),
  ('PROFESSIONAL_VETERINARIAN', 'Veterinarian', 'Animal healthcare professionals', 'paw-print', 15)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'PROFESSIONAL'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- BUSINESS Profiles (20) - Entity + Sector Combined
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  -- Entity-Based (1-10)
  ('BUSINESS_PROPRIETOR', 'Proprietorship', 'Sole proprietor business', 'user', 1),
  ('BUSINESS_PARTNERSHIP', 'Partnership', 'Partnership firm', 'users', 2),
  ('BUSINESS_LLP', 'LLP', 'Limited Liability Partnership', 'handshake', 3),
  ('BUSINESS_PVT_LTD', 'Pvt Ltd', 'Private Limited Company', 'building', 4),
  ('BUSINESS_PUBLIC_LTD', 'Public Ltd', 'Public Limited Company', 'building-2', 5),
  ('BUSINESS_OPC', 'OPC', 'One Person Company', 'user-circle', 6),
  ('BUSINESS_HUF', 'HUF', 'Hindu Undivided Family', 'home', 7),
  ('BUSINESS_TRUST', 'Trust', 'Private/Charitable Trust', 'heart-handshake', 8),
  ('BUSINESS_SOCIETY', 'Society', 'Registered Society', 'users-round', 9),
  ('BUSINESS_COOPERATIVE', 'Cooperative', 'Cooperative Society', 'network', 10),
  -- Sector-Based (11-20)
  ('BUSINESS_RETAILER', 'Retailer', 'Retail store owners', 'store', 11),
  ('BUSINESS_WHOLESALER', 'Wholesaler', 'Wholesale traders', 'warehouse', 12),
  ('BUSINESS_MANUFACTURER', 'Manufacturer', 'Manufacturing units', 'factory', 13),
  ('BUSINESS_TRADER', 'Trader', 'Trading business', 'shopping-cart', 14),
  ('BUSINESS_SERVICE_PROVIDER', 'Service Provider', 'Service business', 'briefcase', 15),
  ('BUSINESS_CONTRACTOR', 'Contractor', 'Construction contractors', 'hard-hat', 16),
  ('BUSINESS_TRANSPORTER', 'Transporter', 'Fleet/Logistics', 'truck', 17),
  ('BUSINESS_EXPORTER', 'Exporter', 'Export business', 'plane', 18),
  ('BUSINESS_IMPORTER', 'Importer', 'Import business', 'ship', 19),
  ('BUSINESS_ECOMMERCE', 'E-Commerce', 'Online business', 'shopping-bag', 20)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'BUSINESS'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- MSME Profiles (4)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('MSME_MICRO', 'Micro Enterprise', 'Investment < 1 Cr, Turnover < 5 Cr', 'zap', 1),
  ('MSME_SMALL', 'Small Enterprise', 'Investment < 10 Cr, Turnover < 50 Cr', 'bar-chart-2', 2),
  ('MSME_MEDIUM', 'Medium Enterprise', 'Investment < 50 Cr, Turnover < 250 Cr', 'bar-chart-3', 3),
  ('MSME_STARTUP', 'Startup', 'DPIIT registered startup', 'rocket', 4)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'MSME'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- AGRICULTURE Profiles (10)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('AGRICULTURE_FARMER_SMALL', 'Farmer (Small)', 'Land < 2 hectares', 'wheat', 1),
  ('AGRICULTURE_FARMER_MEDIUM', 'Farmer (Medium)', 'Land 2-10 hectares', 'wheat', 2),
  ('AGRICULTURE_FARMER_LARGE', 'Farmer (Large)', 'Land > 10 hectares', 'wheat', 3),
  ('AGRICULTURE_TENANT', 'Tenant Farmer', 'Cultivating leased land', 'home', 4),
  ('AGRICULTURE_DAIRY', 'Dairy', 'Cattle/Milk production', 'milk', 5),
  ('AGRICULTURE_POULTRY', 'Poultry', 'Chicken/Egg production', 'egg', 6),
  ('AGRICULTURE_FISHERY', 'Fishery', 'Fishing/Aquaculture', 'fish', 7),
  ('AGRICULTURE_HORTICULTURE', 'Horticulture', 'Fruits/Vegetables/Flowers', 'flower', 8),
  ('AGRICULTURE_LIVESTOCK', 'Livestock', 'Goat, Sheep, Pig farming', 'paw-print', 9),
  ('AGRICULTURE_AGRI_BUSINESS', 'Agri Business', 'Food processing, cold storage', 'factory', 10)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'AGRICULTURE'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- PENSIONER Profiles (8)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('PENSIONER_CENTRAL', 'Central Govt', 'Retired central government', 'landmark', 1),
  ('PENSIONER_STATE', 'State Govt', 'Retired state government', 'building-columns', 2),
  ('PENSIONER_DEFENCE', 'Defence', 'Retired defence personnel', 'shield', 3),
  ('PENSIONER_PARAMILITARY', 'Paramilitary', 'Retired CRPF/BSF/CISF', 'shield-check', 4),
  ('PENSIONER_PSU', 'PSU', 'Retired PSU employees', 'building-2', 5),
  ('PENSIONER_BANK', 'Bank', 'Retired bank employees', 'landmark', 6),
  ('PENSIONER_FAMILY', 'Family', 'Spouse/dependent pension', 'users', 7),
  ('PENSIONER_PRIVATE', 'Private', 'Private pension recipients', 'building-office', 8)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'PENSIONER'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- NRI Profiles (6)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('NRI_SALARIED', 'Salaried', 'Employed abroad', 'briefcase', 1),
  ('NRI_SELF_EMPLOYED', 'Self-Employed', 'Self-employed abroad', 'store', 2),
  ('NRI_PROFESSIONAL', 'Professional', 'Professional working abroad', 'user-tie', 3),
  ('NRI_PIO', 'PIO', 'Person of Indian Origin', 'user', 4),
  ('NRI_OCI', 'OCI', 'Overseas Citizen of India', 'id-card', 5),
  ('NRI_SEAFARER', 'Seafarer', 'Merchant Navy/Shipping', 'ship', 6)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'NRI'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- WOMEN Profiles (5)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('WOMEN_ENTREPRENEUR', 'Entrepreneur', 'Women-owned business (51%+)', 'store', 1),
  ('WOMEN_PROFESSIONAL', 'Professional', 'Women professionals', 'user-tie', 2),
  ('WOMEN_FARMER', 'Farmer', 'Women in agriculture', 'wheat', 3),
  ('WOMEN_SHG', 'SHG Member', 'Self Help Group member', 'users', 4),
  ('WOMEN_ARTISAN', 'Artisan', 'Women artisans/craftswomen', 'palette', 5)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'WOMEN'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- STUDENT Profiles (7)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('STUDENT_UG', 'Undergraduate', 'UG student', 'book', 1),
  ('STUDENT_PG', 'Postgraduate', 'PG student', 'book-open', 2),
  ('STUDENT_PHD', 'PhD', 'Doctoral student', 'graduation-cap', 3),
  ('STUDENT_PROFESSIONAL', 'Professional Course', 'MBA/Medical/Engineering', 'certificate', 4),
  ('STUDENT_ABROAD', 'Study Abroad', 'Studying overseas', 'globe', 5),
  ('STUDENT_SKILL', 'Skill Development', 'Vocational training', 'wrench', 6),
  ('STUDENT_WORKING', 'Working Student', 'Part-time employed', 'briefcase', 7)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'STUDENT'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- GIG_ECONOMY Profiles (6)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('GIG_FREELANCER', 'Freelancer', 'Independent contractors', 'laptop', 1),
  ('GIG_WORKER', 'Gig Worker', 'App-based delivery/ride', 'bike', 2),
  ('GIG_CONTENT_CREATOR', 'Content Creator', 'YouTubers, bloggers, influencers', 'video', 3),
  ('GIG_CONSULTANT', 'Consultant', 'Gig-based consultants', 'user-tie', 4),
  ('GIG_PROFESSIONAL', 'Gig Professional', 'Project-based professionals', 'briefcase', 5),
  ('GIG_ARTIST', 'Artist/Performer', 'Musicians, artists, performers', 'music', 6)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'GIG_ECONOMY'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- INSTITUTIONAL Profiles (6)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('INSTITUTIONAL_SCHOOL', 'School', 'Educational institution', 'school', 1),
  ('INSTITUTIONAL_HOSPITAL', 'Hospital', 'Healthcare institution', 'hospital', 2),
  ('INSTITUTIONAL_NGO', 'NGO', 'Non-governmental organization', 'heart', 3),
  ('INSTITUTIONAL_TRUST', 'Trust', 'Charitable trust', 'heart-handshake', 4),
  ('INSTITUTIONAL_HOUSING_SOCIETY', 'Housing Society', 'Residential society', 'home', 5),
  ('INSTITUTIONAL_RELIGIOUS', 'Religious', 'Religious institution', 'church', 6)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'INSTITUTIONAL'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- SPECIAL Profiles (10)
INSERT INTO public.customer_profile_definitions (subrole_id, key, name, description, icon, display_order, is_active)
SELECT s.id, v.key, v.name, v.description, v.icon, v.display_order, true
FROM public.customer_subroles s
CROSS JOIN (VALUES
  ('SPECIAL_HOMEMAKER', 'Homemaker', 'Non-earning spouse', 'home', 1),
  ('SPECIAL_RENTAL_INCOME', 'Rental Income', 'Income from rent only', 'key', 2),
  ('SPECIAL_SENIOR_CITIZEN', 'Senior Citizen', 'Elderly without pension', 'user', 3),
  ('SPECIAL_DIVIDEND_INCOME', 'Dividend Income', 'Investment income', 'trending-up', 4),
  ('SPECIAL_EX_SERVICEMEN', 'Ex-Servicemen', 'Former defence personnel', 'medal', 5),
  ('SPECIAL_DISABLED', 'Differently Abled', 'Persons with disabilities', 'accessibility', 6),
  ('SPECIAL_MINORITY', 'Minority', 'Minority community members', 'users', 7),
  ('SPECIAL_SC_ST', 'SC/ST', 'Scheduled Caste/Tribe', 'users', 8),
  ('SPECIAL_OBC', 'OBC', 'Other Backward Classes', 'users', 9),
  ('SPECIAL_FIRST_TIME_BORROWER', 'First Time Borrower', 'No credit history', 'user-plus', 10)
) AS v(key, name, description, icon, display_order)
WHERE s.key = 'SPECIAL'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- 6. ADD CUSTOMER SUBROLES TO ROLE_DEFINITIONS TABLE
-- =====================================================

INSERT INTO public.role_definitions (role_key, role_name, role_type, description, is_active, display_order) VALUES
  ('INDIVIDUAL', 'Individual', 'CUSTOMER', 'Individual customers without specific category', true, 100),
  ('SALARIED', 'Salaried', 'CUSTOMER', 'Salaried employees', true, 101),
  ('PROFESSIONAL', 'Professional', 'CUSTOMER', 'Self-employed professionals', true, 102),
  ('BUSINESS', 'Business', 'CUSTOMER', 'Business owners and entities', true, 103),
  ('MSME', 'MSME', 'CUSTOMER', 'Micro, Small and Medium Enterprises', true, 104),
  ('AGRICULTURE', 'Agriculture', 'CUSTOMER', 'Agriculture and allied activities', true, 105),
  ('PENSIONER', 'Pensioner', 'CUSTOMER', 'Retired individuals receiving pension', true, 106),
  ('NRI', 'NRI', 'CUSTOMER', 'Non-Resident Indians', true, 107),
  ('WOMEN', 'Women', 'CUSTOMER', 'Women-specific categories', true, 108),
  ('STUDENT', 'Student', 'CUSTOMER', 'Students pursuing education', true, 109),
  ('GIG_ECONOMY', 'Gig Economy', 'CUSTOMER', 'Freelancers and gig workers', true, 110),
  ('INSTITUTIONAL', 'Institutional', 'CUSTOMER', 'Schools, hospitals, NGOs, trusts', true, 111),
  ('SPECIAL', 'Special', 'CUSTOMER', 'Special categories', true, 112)
ON CONFLICT (role_key) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- 7. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_customer_subrole_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Customer Subroles trigger
DROP TRIGGER IF EXISTS trigger_customer_subroles_updated ON public.customer_subroles;
CREATE TRIGGER trigger_customer_subroles_updated
  BEFORE UPDATE ON public.customer_subroles
  FOR EACH ROW EXECUTE FUNCTION update_customer_subrole_updated_at();

-- Customer Profile Definitions trigger
DROP TRIGGER IF EXISTS trigger_customer_profile_definitions_updated ON public.customer_profile_definitions;
CREATE TRIGGER trigger_customer_profile_definitions_updated
  BEFORE UPDATE ON public.customer_profile_definitions
  FOR EACH ROW EXECUTE FUNCTION update_customer_subrole_updated_at();

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================

ALTER TABLE public.customer_subroles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profile_definitions ENABLE ROW LEVEL SECURITY;

-- Public read access for active subroles (needed for registration)
DROP POLICY IF EXISTS "Public can view active subroles" ON public.customer_subroles;
CREATE POLICY "Public can view active subroles"
  ON public.customer_subroles FOR SELECT
  USING (is_active = true);

-- Public read access for active profiles (needed for registration)
DROP POLICY IF EXISTS "Public can view active profiles" ON public.customer_profile_definitions;
CREATE POLICY "Public can view active profiles"
  ON public.customer_profile_definitions FOR SELECT
  USING (is_active = true);

-- Super admin can manage all subroles
DROP POLICY IF EXISTS "Super admin can manage subroles" ON public.customer_subroles;
CREATE POLICY "Super admin can manage subroles"
  ON public.customer_subroles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

-- Super admin can manage all profile definitions
DROP POLICY IF EXISTS "Super admin can manage profile definitions" ON public.customer_profile_definitions;
CREATE POLICY "Super admin can manage profile definitions"
  ON public.customer_profile_definitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE public.customer_subroles IS 'Master table for customer subrole categories (Salaried, Professional, Business, etc.)';
COMMENT ON TABLE public.customer_profile_definitions IS 'Profiles within each customer subrole';
COMMENT ON COLUMN public.customer_subroles.show_entity_profile IS 'If true, show Entity Profile instead of My Profile in sidebar';
COMMENT ON COLUMN public.customer_profiles.subrole_key IS 'Customer subrole key (e.g., SALARIED, PROFESSIONAL)';
COMMENT ON COLUMN public.customer_profiles.profile_key IS 'Customer profile key (e.g., SALARIED_CENTRAL_GOVT)';

-- =====================================================
-- 10. MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('019_customer_portal_subroles', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
