-- =====================================================
-- ULAP PARTNER LEADS EXTENSION
-- Version: 1.0.0
-- Date: 2025-01-15
-- Purpose: Extend partner_leads table for ULAP Phase 1 lead capture
-- =====================================================

-- =====================================================
-- 1. ADD ULAP FIELDS TO PARTNER_LEADS TABLE
-- =====================================================

-- Add ULAP-specific columns to partner_leads table
ALTER TABLE public.partner_leads
  -- Lead number with source prefix (BA-YYYYMMDD-XXXX, BP-YYYYMMDD-XXXX, etc.)
  ADD COLUMN IF NOT EXISTS lead_number VARCHAR(30),

  -- Extended customer details
  ADD COLUMN IF NOT EXISTS customer_pan VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_dob DATE,
  ADD COLUMN IF NOT EXISTS customer_gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_pincode VARCHAR(10),

  -- Co-applicant details
  ADD COLUMN IF NOT EXISTS has_co_applicant BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS co_applicant_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS co_applicant_mobile VARCHAR(15),
  ADD COLUMN IF NOT EXISTS co_applicant_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS co_applicant_relationship VARCHAR(50),

  -- Loan category tracking (for ULAP dynamic form)
  ADD COLUMN IF NOT EXISTS loan_category_id UUID,
  ADD COLUMN IF NOT EXISTS loan_category_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS loan_subcategory_id UUID,
  ADD COLUMN IF NOT EXISTS loan_subcategory_code VARCHAR(50),

  -- Source tracking
  ADD COLUMN IF NOT EXISTS form_source VARCHAR(50), -- ULAP_PARTNER_LINK, ULAP_EMPLOYEE, ULAP_CUSTOMER_REFERRAL, ULAP_PUBLIC_FORM
  ADD COLUMN IF NOT EXISTS source_partner_type VARCHAR(50), -- BA, BP, EMPLOYEE, CUSTOMER_REFERRAL, SELF
  ADD COLUMN IF NOT EXISTS partner_name VARCHAR(255), -- Denormalized for quick access

  -- Application phase tracking
  ADD COLUMN IF NOT EXISTS application_phase INTEGER DEFAULT 1;

-- Allow lead_id to be nullable since we now use lead_number
ALTER TABLE public.partner_leads ALTER COLUMN lead_id DROP NOT NULL;

-- Allow trace_token to be nullable for ULAP leads
ALTER TABLE public.partner_leads ALTER COLUMN trace_token DROP NOT NULL;

-- Allow partner_id to be nullable for public/self submissions
ALTER TABLE public.partner_leads ALTER COLUMN partner_id DROP NOT NULL;

-- Update partner_type constraint to include new types
ALTER TABLE public.partner_leads DROP CONSTRAINT IF EXISTS partner_leads_partner_type_check;
DO $$
BEGIN
  ALTER TABLE public.partner_leads ADD CONSTRAINT partner_leads_partner_type_check
    CHECK (partner_type IN (
      'BUSINESS_PARTNER', 'BUSINESS_ASSOCIATE',
      'EMPLOYEE', 'CUSTOMER_REFERRAL', 'SELF_APPLICATION'
    ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add partner_type constraint: %', SQLERRM;
END $$;

-- Create unique index on lead_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_leads_lead_number
  ON public.partner_leads(lead_number)
  WHERE lead_number IS NOT NULL;

-- Index for source tracking
CREATE INDEX IF NOT EXISTS idx_partner_leads_form_source
  ON public.partner_leads(form_source);

CREATE INDEX IF NOT EXISTS idx_partner_leads_source_partner_type
  ON public.partner_leads(source_partner_type);

CREATE INDEX IF NOT EXISTS idx_partner_leads_loan_category
  ON public.partner_leads(loan_category_id);

CREATE INDEX IF NOT EXISTS idx_partner_leads_loan_subcategory
  ON public.partner_leads(loan_subcategory_id);

-- =====================================================
-- 2. UPDATE LEAD_STATUS CONSTRAINT
-- =====================================================

-- Update lead_status to include ULAP statuses
ALTER TABLE public.partner_leads
  DROP CONSTRAINT IF EXISTS partner_leads_lead_status_check;

-- Add new constraint with ULAP statuses
DO $$
BEGIN
  -- Check if the constraint doesn't exist before adding
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_leads_lead_status_check'
  ) THEN
    ALTER TABLE public.partner_leads ADD CONSTRAINT partner_leads_lead_status_check
      CHECK (lead_status IN (
        -- Original statuses
        'NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DROPPED',
        -- ULAP statuses
        'NEW_UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'DOCS_PENDING',
        'DOCS_COLLECTED', 'BANK_SUBMITTED', 'APPROVED', 'DISBURSED', 'REJECTED'
      ));
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add lead_status constraint: %', SQLERRM;
END $$;

-- =====================================================
-- 3. ADD FORM_STATUS VALUES FOR ULAP
-- =====================================================

-- Update form_status constraint to include ULAP phases
ALTER TABLE public.partner_leads
  DROP CONSTRAINT IF EXISTS partner_leads_form_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_leads_form_status_check'
  ) THEN
    ALTER TABLE public.partner_leads ADD CONSTRAINT partner_leads_form_status_check
      CHECK (form_status IN (
        -- Original statuses
        'PENDING', 'OPENED', 'FILLED', 'SUBMITTED',
        -- ULAP phase statuses
        'PHASE_1_SUBMITTED', 'PHASE_2_IN_PROGRESS', 'PHASE_2_SUBMITTED',
        'PHASE_3_IN_PROGRESS', 'PHASE_3_SUBMITTED', 'COMPLETE'
      ));
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add form_status constraint: %', SQLERRM;
END $$;

-- =====================================================
-- 4. CREATE VIEW FOR ULAP LEADS
-- =====================================================

-- View for querying ULAP leads with partner info
CREATE OR REPLACE VIEW public.unified_crm_leads AS
SELECT
  pl.id,
  pl.lead_number,
  pl.customer_name,
  pl.customer_mobile,
  pl.customer_email,
  pl.customer_city,
  pl.customer_pincode,
  pl.customer_gender,
  pl.loan_type,
  pl.loan_category_code,
  pl.loan_subcategory_code,
  pl.lead_status,
  pl.form_status,
  pl.application_phase,
  pl.form_source,
  pl.source_partner_type,
  pl.partner_id,
  pl.partner_name,
  pl.has_co_applicant,
  pl.created_at,
  pl.updated_at,
  -- Simplified status for display
  CASE
    WHEN pl.lead_status = 'NEW_UNASSIGNED' THEN 'New Lead'
    WHEN pl.lead_status = 'ASSIGNED' THEN 'Assigned'
    WHEN pl.lead_status = 'IN_PROGRESS' THEN 'In Progress'
    WHEN pl.lead_status = 'DOCS_PENDING' THEN 'Documents Pending'
    WHEN pl.lead_status = 'DOCS_COLLECTED' THEN 'Documents Collected'
    WHEN pl.lead_status = 'BANK_SUBMITTED' THEN 'Submitted to Bank'
    WHEN pl.lead_status = 'APPROVED' THEN 'Loan Approved'
    WHEN pl.lead_status = 'DISBURSED' THEN 'Loan Disbursed'
    WHEN pl.lead_status = 'REJECTED' THEN 'Application Rejected'
    WHEN pl.lead_status = 'DROPPED' THEN 'Dropped'
    ELSE pl.lead_status
  END AS display_status
FROM public.partner_leads pl
WHERE pl.form_source LIKE 'ULAP%';

COMMENT ON VIEW public.unified_crm_leads IS 'View for ULAP leads from partner_leads table with display-friendly status';

-- =====================================================
-- 5. RLS POLICY FOR PUBLIC LEAD SUBMISSION
-- =====================================================

-- Allow anonymous/public lead submissions for ULAP public forms
DROP POLICY IF EXISTS "Allow public ULAP lead submission" ON public.partner_leads;
CREATE POLICY "Allow public ULAP lead submission"
  ON public.partner_leads
  FOR INSERT
  WITH CHECK (
    form_source IN ('ULAP_PUBLIC_FORM', 'ULAP_CUSTOMER_REFERRAL')
    OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
  );

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON COLUMN public.partner_leads.lead_number IS 'ULAP lead number format: {SOURCE}-YYYYMMDD-XXXX (e.g., BA-20250115-A1B2)';
COMMENT ON COLUMN public.partner_leads.form_source IS 'ULAP form source: ULAP_PARTNER_LINK, ULAP_EMPLOYEE, ULAP_CUSTOMER_REFERRAL, ULAP_PUBLIC_FORM';
COMMENT ON COLUMN public.partner_leads.source_partner_type IS 'Partner type: BA, BP, EMPLOYEE, CUSTOMER_REFERRAL, SELF';
COMMENT ON COLUMN public.partner_leads.application_phase IS 'ULAP application phase: 1=Basic Info, 2=Documents, 3=Verification';

-- =====================================================
-- 7. MIGRATION TRACKING
-- =====================================================

-- Add migration tracking (if migrations table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('013_ulap_partner_leads_extension', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
