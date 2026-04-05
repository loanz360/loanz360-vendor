-- =====================================================
-- PHASE 3: CUSTOMER PROFILE KYC RESTRUCTURING
-- Version: 1.0.0
-- Date: 2026-01-26
-- Purpose: Add KYC fields, address proofs, and profile completion tracking
-- =====================================================

-- =====================================================
-- 1. ADD KYC & PERSONAL DETAILS COLUMNS
-- =====================================================

DO $$
BEGIN
  -- Personal Details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN full_name VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'father_name'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN father_name VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'mother_name'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN mother_name VARCHAR(255);
  END IF;

  -- Contact
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN email VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'mobile_primary'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN mobile_primary VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'mobile_secondary'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN mobile_secondary VARCHAR(20);
  END IF;

  -- Current Address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_address_line1'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_address_line1 VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_address_line2'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_address_line2 VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_city'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_city VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_state'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_state VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_pincode'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_pincode VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_address_proof_type'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_address_proof_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'current_address_proof_url'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN current_address_proof_url TEXT;
  END IF;

  -- Permanent Address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_address_line1'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_address_line1 VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_address_line2'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_address_line2 VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_city'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_city VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_state'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_state VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_pincode'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_pincode VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_address_proof_type'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_address_proof_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_address_proof_url'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_address_proof_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'permanent_same_as_current'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN permanent_same_as_current BOOLEAN DEFAULT false;
  END IF;

  -- PAN Verification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'pan_verified'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN pan_verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'pan_verified_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN pan_verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'pan_document_url'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN pan_document_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'pan_holder_name'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN pan_holder_name VARCHAR(255);
  END IF;

  -- Aadhaar Verification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'aadhaar_number'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN aadhaar_number VARCHAR(12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'aadhaar_verified'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN aadhaar_verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'aadhaar_verified_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN aadhaar_verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'aadhaar_document_url'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN aadhaar_document_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'aadhaar_holder_name'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN aadhaar_holder_name VARCHAR(255);
  END IF;

  -- Profile Photo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'profile_photo_updated_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_photo_updated_at TIMESTAMPTZ;
  END IF;

  -- KYC Completion Status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'kyc_completed_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN kyc_completed_at TIMESTAMPTZ;
  END IF;

  -- Profile Completion (NEW - replaces income_category check)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_completed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'profile_completed_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN profile_completed_at TIMESTAMPTZ;
  END IF;

  -- Credit Score (cached from bureau)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'credit_score'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN credit_score INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'credit_score_source'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN credit_score_source VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'credit_score_fetched_at'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN credit_score_fetched_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'active_loans_count'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN active_loans_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_profiles' AND column_name = 'total_loan_amount'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN total_loan_amount DECIMAL(15,2) DEFAULT 0;
  END IF;

END $$;

-- =====================================================
-- 2. ADD INDEXES FOR NEW COLUMNS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customer_profiles_pan ON public.customer_profiles(pan_number);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_aadhaar ON public.customer_profiles(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_kyc_status ON public.customer_profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_profile_completed ON public.customer_profiles(profile_completed);

-- =====================================================
-- 3. CREATE CREDIT ASSESSMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.credit_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Credit Score
  credit_score INTEGER,
  credit_score_range VARCHAR(20),  -- EXCELLENT, GOOD, FAIR, POOR
  score_source VARCHAR(50),  -- CIBIL, EXPERIAN, EQUIFAX, CRIF

  -- Loan Summary
  active_loans_count INTEGER DEFAULT 0,
  closed_loans_count INTEGER DEFAULT 0,
  total_outstanding DECIMAL(15,2) DEFAULT 0,
  total_sanctioned DECIMAL(15,2) DEFAULT 0,

  -- Loan Details (JSONB for flexibility)
  loan_details JSONB DEFAULT '[]',

  -- Enquiry History
  enquiry_count_last_6_months INTEGER DEFAULT 0,
  enquiry_count_last_12_months INTEGER DEFAULT 0,

  -- Payment History
  on_time_payment_percentage DECIMAL(5,2),
  dpd_30_count INTEGER DEFAULT 0,
  dpd_60_count INTEGER DEFAULT 0,
  dpd_90_count INTEGER DEFAULT 0,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Raw response (for debugging)
  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for credit_assessments
CREATE INDEX IF NOT EXISTS idx_credit_assessments_customer ON public.credit_assessments(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_assessments_fetched ON public.credit_assessments(fetched_at);

-- Enable RLS
ALTER TABLE public.credit_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_assessments
DROP POLICY IF EXISTS "Customers can view own credit assessment" ON public.credit_assessments;
CREATE POLICY "Customers can view own credit assessment"
  ON public.credit_assessments FOR SELECT
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "System can manage credit assessments" ON public.credit_assessments;
CREATE POLICY "System can manage credit assessments"
  ON public.credit_assessments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

-- =====================================================
-- 4. COMMENTS
-- =====================================================

COMMENT ON COLUMN public.customer_profiles.profile_completed IS 'TRUE when customer has completed all KYC steps (personal details, addresses, PAN, Aadhaar)';
COMMENT ON COLUMN public.customer_profiles.pan_verified IS 'TRUE when PAN has been verified via third-party API';
COMMENT ON COLUMN public.customer_profiles.aadhaar_verified IS 'TRUE when Aadhaar has been verified via third-party API';
COMMENT ON TABLE public.credit_assessments IS 'Credit bureau data fetched based on verified PAN';

-- =====================================================
-- 5. MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('customer_profile_kyc_phase3', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
