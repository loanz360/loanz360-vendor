-- ============================================================================
-- Migration: Customer Referrals Module
-- Description: Creates tables for customer-to-customer referral system with points
-- Version: 011
-- Created: 2025-12-28
-- ============================================================================

-- ============================================================================
-- 1. CUSTOMER_REFERRALS TABLE
-- ============================================================================
-- Stores referral information when customers refer other potential customers
CREATE TABLE IF NOT EXISTS public.customer_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referrer information (existing customer)
  referrer_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Referral identification
  referral_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'CR-2025-000001'

  -- Referred person information
  referred_name VARCHAR(255),
  referred_mobile VARCHAR(15) NOT NULL,
  referred_email VARCHAR(255),
  referred_city VARCHAR(100),

  -- Loan details
  loan_type VARCHAR(100),
  required_loan_amount DECIMAL(15,2),

  -- Form submission tracking
  form_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, OPENED, FILLED, SUBMITTED
  form_submitted_at TIMESTAMPTZ,

  -- Link tracking
  short_link VARCHAR(255),
  short_code VARCHAR(20) UNIQUE,
  trace_token TEXT NOT NULL,

  -- WhatsApp tracking
  shared_via_whatsapp BOOLEAN DEFAULT FALSE,
  whatsapp_sent_count INTEGER DEFAULT 0,
  last_whatsapp_sent_at TIMESTAMPTZ,

  -- Referral status
  referral_status VARCHAR(50) DEFAULT 'NEW', -- NEW, LINK_OPENED, REGISTERED, APPLIED, CONVERTED

  -- Conversion tracking
  converted BOOLEAN DEFAULT FALSE,
  converted_to_customer_id UUID REFERENCES public.customers(id),
  converted_at TIMESTAMPTZ,

  -- Points tracking
  points_awarded INTEGER DEFAULT 0,
  points_awarded_at TIMESTAMPTZ,

  -- Metadata
  remarks TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT customer_referrals_mobile_check CHECK (referred_mobile ~ '^\+?[0-9]{10,15}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer ON public.customer_referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_user ON public.customer_referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_mobile ON public.customer_referrals(referred_mobile);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_status ON public.customer_referrals(referral_status);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_form_status ON public.customer_referrals(form_status);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_short_code ON public.customer_referrals(short_code);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_created ON public.customer_referrals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_trace_token ON public.customer_referrals(trace_token);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_customer_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_referrals_updated_at_trigger ON public.customer_referrals;
CREATE TRIGGER customer_referrals_updated_at_trigger
  BEFORE UPDATE ON public.customer_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_referrals_updated_at();

-- ============================================================================
-- 2. CUSTOMER_REFERRAL_POINTS TABLE
-- ============================================================================
-- Stores points balance for each customer
CREATE TABLE IF NOT EXISTS public.customer_referral_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer reference
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Points balances
  points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
  total_points_earned INTEGER DEFAULT 0 CHECK (total_points_earned >= 0),
  total_points_redeemed INTEGER DEFAULT 0 CHECK (total_points_redeemed >= 0),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_referral_points_customer ON public.customer_referral_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referral_points_user ON public.customer_referral_points(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_referral_points_balance ON public.customer_referral_points(points_balance DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_customer_referral_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_referral_points_updated_at_trigger ON public.customer_referral_points;
CREATE TRIGGER customer_referral_points_updated_at_trigger
  BEFORE UPDATE ON public.customer_referral_points
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_referral_points_updated_at();

-- ============================================================================
-- 3. CUSTOMER_POINTS_TRANSACTIONS TABLE
-- ============================================================================
-- Logs all points transactions (earn, redeem, expire)
CREATE TABLE IF NOT EXISTS public.customer_points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer reference
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type VARCHAR(50) NOT NULL, -- EARNED, REDEEMED, EXPIRED, BONUS
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  -- Reference to what triggered this transaction
  reference_type VARCHAR(50), -- REFERRAL_REGISTRATION, REFERRAL_APPLICATION, REFERRAL_CONVERSION, CONTEST, REDEMPTION
  reference_id UUID, -- referral_id, contest_id, or redemption_id

  -- Description
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_points_transactions_customer ON public.customer_points_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_points_transactions_user ON public.customer_points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_points_transactions_type ON public.customer_points_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_points_transactions_created ON public.customer_points_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_points_transactions_reference ON public.customer_points_transactions(reference_type, reference_id);

-- ============================================================================
-- 4. REFERRAL_POINTS_CONFIG TABLE
-- ============================================================================
-- Configurable points values for different referral milestones
CREATE TABLE IF NOT EXISTS public.referral_points_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Config key
  config_key VARCHAR(100) UNIQUE NOT NULL,

  -- Points value
  points_value INTEGER NOT NULL DEFAULT 0,

  -- Description
  description TEXT,

  -- Active status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration values
INSERT INTO public.referral_points_config (config_key, points_value, description)
VALUES
  ('REFERRAL_LINK_OPENED', 10, 'Points when referred person opens the link'),
  ('REFERRAL_REGISTRATION', 100, 'Points when referred person registers'),
  ('REFERRAL_APPLICATION', 200, 'Points when referred person applies for a loan'),
  ('REFERRAL_CONVERSION', 500, 'Points when referred person gets loan approved/disbursed')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- 5. REFERRAL_ID SEQUENCE
-- ============================================================================
-- Create sequence for generating customer referral IDs
CREATE SEQUENCE IF NOT EXISTS public.customer_referrals_sequence
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate customer referral ID
CREATE OR REPLACE FUNCTION generate_customer_referral_id()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_id INTEGER;
  year_part VARCHAR(4);
  referral_number VARCHAR(10);
BEGIN
  SELECT nextval('public.customer_referrals_sequence') INTO next_id;
  SELECT EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR INTO year_part;
  referral_number := LPAD(next_id::TEXT, 6, '0');
  RETURN 'CR-' || year_part || '-' || referral_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get points config value
CREATE OR REPLACE FUNCTION get_referral_points_value(p_config_key VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  points INTEGER;
BEGIN
  SELECT points_value INTO points
  FROM public.referral_points_config
  WHERE config_key = p_config_key AND is_active = TRUE;

  RETURN COALESCE(points, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award points to a customer
CREATE OR REPLACE FUNCTION award_referral_points(
  p_customer_id UUID,
  p_user_id UUID,
  p_points INTEGER,
  p_transaction_type VARCHAR,
  p_reference_type VARCHAR,
  p_reference_id UUID,
  p_description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- Ensure points record exists for customer
  INSERT INTO public.customer_referral_points (customer_id, user_id, points_balance, total_points_earned)
  VALUES (p_customer_id, p_user_id, 0, 0)
  ON CONFLICT (customer_id) DO NOTHING;

  -- Get current balance
  SELECT points_balance INTO current_balance
  FROM public.customer_referral_points
  WHERE customer_id = p_customer_id;

  new_balance := current_balance + p_points;

  -- Update points balance
  UPDATE public.customer_referral_points
  SET
    points_balance = new_balance,
    total_points_earned = total_points_earned + p_points,
    updated_at = NOW()
  WHERE customer_id = p_customer_id;

  -- Log transaction
  INSERT INTO public.customer_points_transactions (
    customer_id, user_id, transaction_type, points, balance_after,
    reference_type, reference_id, description
  )
  VALUES (
    p_customer_id, p_user_id, p_transaction_type, p_points, new_balance,
    p_reference_type, p_reference_id, p_description
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get customer referral statistics
CREATE OR REPLACE FUNCTION get_customer_referral_stats(p_customer_id UUID)
RETURNS TABLE (
  total_referrals BIGINT,
  pending_referrals BIGINT,
  opened_referrals BIGINT,
  registered_referrals BIGINT,
  applied_referrals BIGINT,
  converted_referrals BIGINT,
  total_points_earned INTEGER,
  points_balance INTEGER,
  conversion_rate NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_referrals,
    COUNT(*) FILTER (WHERE referral_status = 'NEW')::BIGINT AS pending_referrals,
    COUNT(*) FILTER (WHERE referral_status = 'LINK_OPENED')::BIGINT AS opened_referrals,
    COUNT(*) FILTER (WHERE referral_status = 'REGISTERED')::BIGINT AS registered_referrals,
    COUNT(*) FILTER (WHERE referral_status = 'APPLIED')::BIGINT AS applied_referrals,
    COUNT(*) FILTER (WHERE referral_status = 'CONVERTED')::BIGINT AS converted_referrals,
    COALESCE(crp.total_points_earned, 0) AS total_points_earned,
    COALESCE(crp.points_balance, 0) AS points_balance,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE converted = TRUE)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE
        0
    END AS conversion_rate
  FROM public.customer_referrals cr
  LEFT JOIN public.customer_referral_points crp ON crp.customer_id = cr.referrer_customer_id
  WHERE cr.referrer_customer_id = p_customer_id
  GROUP BY crp.total_points_earned, crp.points_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referral_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_points_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CUSTOMER_REFERRALS RLS POLICIES
-- ============================================================================

-- Customers can view their own referrals
DROP POLICY IF EXISTS "Customers can view own referrals" ON public.customer_referrals;
CREATE POLICY "Customers can view own referrals"
  ON public.customer_referrals
  FOR SELECT
  USING (referrer_user_id = auth.uid());

-- Customers can create referrals
DROP POLICY IF EXISTS "Customers can create referrals" ON public.customer_referrals;
CREATE POLICY "Customers can create referrals"
  ON public.customer_referrals
  FOR INSERT
  WITH CHECK (referrer_user_id = auth.uid());

-- System can update referrals (for status changes when referred person acts)
DROP POLICY IF EXISTS "System can update referrals" ON public.customer_referrals;
CREATE POLICY "System can update referrals"
  ON public.customer_referrals
  FOR UPDATE
  USING (true); -- Controlled by service role in backend

-- Super Admins can view all referrals
DROP POLICY IF EXISTS "Super admins can view all customer referrals" ON public.customer_referrals;
CREATE POLICY "Super admins can view all customer referrals"
  ON public.customer_referrals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- CUSTOMER_REFERRAL_POINTS RLS POLICIES
-- ============================================================================

-- Customers can view their own points
DROP POLICY IF EXISTS "Customers can view own points" ON public.customer_referral_points;
CREATE POLICY "Customers can view own points"
  ON public.customer_referral_points
  FOR SELECT
  USING (user_id = auth.uid());

-- Super Admins can view all points
DROP POLICY IF EXISTS "Super admins can view all points" ON public.customer_referral_points;
CREATE POLICY "Super admins can view all points"
  ON public.customer_referral_points
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- CUSTOMER_POINTS_TRANSACTIONS RLS POLICIES
-- ============================================================================

-- Customers can view their own transactions
DROP POLICY IF EXISTS "Customers can view own transactions" ON public.customer_points_transactions;
CREATE POLICY "Customers can view own transactions"
  ON public.customer_points_transactions
  FOR SELECT
  USING (user_id = auth.uid());

-- Super Admins can view all transactions
DROP POLICY IF EXISTS "Super admins can view all transactions" ON public.customer_points_transactions;
CREATE POLICY "Super admins can view all transactions"
  ON public.customer_points_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- REFERRAL_POINTS_CONFIG RLS POLICIES
-- ============================================================================

-- Everyone can read config (needed for display)
DROP POLICY IF EXISTS "Anyone can read points config" ON public.referral_points_config;
CREATE POLICY "Anyone can read points config"
  ON public.referral_points_config
  FOR SELECT
  USING (true);

-- Only Super Admins can modify config
DROP POLICY IF EXISTS "Super admins can modify points config" ON public.referral_points_config;
CREATE POLICY "Super admins can modify points config"
  ON public.referral_points_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.customer_referrals IS 'Stores referrals made by existing customers to refer new potential customers';
COMMENT ON TABLE public.customer_referral_points IS 'Stores points balance for customers earned through referrals';
COMMENT ON TABLE public.customer_points_transactions IS 'Logs all points transactions - earning, redeeming, and expiring';
COMMENT ON TABLE public.referral_points_config IS 'Configurable points values for different referral milestones';

COMMENT ON COLUMN public.customer_referrals.referral_status IS 'NEW, LINK_OPENED, REGISTERED, APPLIED, CONVERTED';
COMMENT ON COLUMN public.customer_referrals.form_status IS 'PENDING: Not opened, OPENED: Link clicked, FILLED: Partially filled, SUBMITTED: Completed';
COMMENT ON COLUMN public.customer_referrals.trace_token IS 'Encrypted referral token format: CUSTOMER_userID_customerID_timestamp_random';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
