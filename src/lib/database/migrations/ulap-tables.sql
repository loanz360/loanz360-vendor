-- ULAP (Unified Loan Application Platform) Database Tables
-- Run this migration in Supabase SQL Editor

-- =====================================================
-- 1. Banks and NBFCs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(50) NOT NULL UNIQUE,
  logo_url TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('BANK', 'NBFC', 'HFC', 'FINTECH')),
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. Loan Categories Table
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_loan_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  icon VARCHAR(100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. Loan Subcategories Table
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_loan_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ulap_loan_categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. Loan Details Table (eligibility, documents, features)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_loan_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID NOT NULL REFERENCES ulap_loan_subcategories(id) ON DELETE CASCADE UNIQUE,
  eligibility JSONB DEFAULT '[]'::JSONB, -- Array of eligibility criteria
  documents JSONB DEFAULT '[]'::JSONB, -- Array of required documents
  features JSONB DEFAULT '[]'::JSONB, -- Array of loan features
  min_amount VARCHAR(50),
  max_amount VARCHAR(50),
  tenure VARCHAR(100),
  interest_range VARCHAR(100),
  additional_info JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. Bank Loan Rates Table (interest rates per bank per loan type)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_bank_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL REFERENCES ulap_banks(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES ulap_loan_subcategories(id) ON DELETE CASCADE,
  interest_rate_min DECIMAL(5,2) NOT NULL,
  interest_rate_max DECIMAL(5,2) NOT NULL,
  processing_fee VARCHAR(100),
  max_amount VARCHAR(50),
  max_tenure VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bank_id, subcategory_id)
);

-- =====================================================
-- 6. Rate History Table (for audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS ulap_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_rate_id UUID NOT NULL REFERENCES ulap_bank_rates(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES ulap_banks(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES ulap_loan_subcategories(id) ON DELETE CASCADE,
  old_rate_min DECIMAL(5,2),
  old_rate_max DECIMAL(5,2),
  new_rate_min DECIMAL(5,2) NOT NULL,
  new_rate_max DECIMAL(5,2) NOT NULL,
  old_processing_fee VARCHAR(100),
  new_processing_fee VARCHAR(100),
  changed_by UUID,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes for better performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ulap_banks_active ON ulap_banks(is_active);
CREATE INDEX IF NOT EXISTS idx_ulap_loan_categories_active ON ulap_loan_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_ulap_loan_subcategories_category ON ulap_loan_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_ulap_loan_subcategories_active ON ulap_loan_subcategories(is_active);
CREATE INDEX IF NOT EXISTS idx_ulap_loan_details_subcategory ON ulap_loan_details(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_ulap_bank_rates_bank ON ulap_bank_rates(bank_id);
CREATE INDEX IF NOT EXISTS idx_ulap_bank_rates_subcategory ON ulap_bank_rates(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_ulap_bank_rates_active ON ulap_bank_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_ulap_rate_history_bank_rate ON ulap_rate_history(bank_rate_id);
CREATE INDEX IF NOT EXISTS idx_ulap_rate_history_created ON ulap_rate_history(created_at);

-- =====================================================
-- Triggers for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_ulap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for re-running migration)
DROP TRIGGER IF EXISTS update_ulap_banks_updated_at ON ulap_banks;
DROP TRIGGER IF EXISTS update_ulap_loan_categories_updated_at ON ulap_loan_categories;
DROP TRIGGER IF EXISTS update_ulap_loan_subcategories_updated_at ON ulap_loan_subcategories;
DROP TRIGGER IF EXISTS update_ulap_loan_details_updated_at ON ulap_loan_details;

CREATE TRIGGER update_ulap_banks_updated_at
  BEFORE UPDATE ON ulap_banks
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

CREATE TRIGGER update_ulap_loan_categories_updated_at
  BEFORE UPDATE ON ulap_loan_categories
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

CREATE TRIGGER update_ulap_loan_subcategories_updated_at
  BEFORE UPDATE ON ulap_loan_subcategories
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

CREATE TRIGGER update_ulap_loan_details_updated_at
  BEFORE UPDATE ON ulap_loan_details
  FOR EACH ROW EXECUTE FUNCTION update_ulap_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE ulap_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_loan_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_loan_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_loan_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_bank_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ulap_rate_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Allow public read for active banks" ON ulap_banks;
DROP POLICY IF EXISTS "Allow public read for active categories" ON ulap_loan_categories;
DROP POLICY IF EXISTS "Allow public read for active subcategories" ON ulap_loan_subcategories;
DROP POLICY IF EXISTS "Allow public read for loan details" ON ulap_loan_details;
DROP POLICY IF EXISTS "Allow public read for active rates" ON ulap_bank_rates;
DROP POLICY IF EXISTS "Allow admin full access to banks" ON ulap_banks;
DROP POLICY IF EXISTS "Allow admin full access to categories" ON ulap_loan_categories;
DROP POLICY IF EXISTS "Allow admin full access to subcategories" ON ulap_loan_subcategories;
DROP POLICY IF EXISTS "Allow admin full access to loan details" ON ulap_loan_details;
DROP POLICY IF EXISTS "Allow admin full access to bank rates" ON ulap_bank_rates;
DROP POLICY IF EXISTS "Allow admin read rate history" ON ulap_rate_history;
DROP POLICY IF EXISTS "Allow admin insert rate history" ON ulap_rate_history;

-- Public read access for loan info (partners need to see this)
CREATE POLICY "Allow public read for active banks" ON ulap_banks
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read for active categories" ON ulap_loan_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read for active subcategories" ON ulap_loan_subcategories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read for loan details" ON ulap_loan_details
  FOR SELECT USING (true);

CREATE POLICY "Allow public read for active rates" ON ulap_bank_rates
  FOR SELECT USING (is_active = true);

-- Admin write access (using service role key for admin operations)
CREATE POLICY "Allow admin full access to banks" ON ulap_banks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to categories" ON ulap_loan_categories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to subcategories" ON ulap_loan_subcategories
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to loan details" ON ulap_loan_details
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to bank rates" ON ulap_bank_rates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin read rate history" ON ulap_rate_history
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin insert rate history" ON ulap_rate_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
