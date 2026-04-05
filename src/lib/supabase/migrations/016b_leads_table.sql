-- =====================================================
-- MIGRATION: 016b_leads_table.sql
-- PURPOSE: Create main leads table
-- RUN ORDER: 2 of 5
-- =====================================================

-- Drop existing leads-related tables if they exist (user confirmed no data exists)
DROP TABLE IF EXISTS public.leads_documents CASCADE;
DROP TABLE IF EXISTS public.leads_notes CASCADE;
DROP TABLE IF EXISTS public.leads_sla_tracking CASCADE;
DROP TABLE IF EXISTS public.leads_assignment_history CASCADE;
DROP TABLE IF EXISTS public.leads_stage_history CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;

-- Drop existing views that depend on leads
DROP VIEW IF EXISTS public.leads_dashboard_summary CASCADE;
DROP VIEW IF EXISTS public.leads_by_source CASCADE;

-- Create the main leads table
CREATE TABLE public.leads (
  -- ============================================
  -- IDENTITY
  -- ============================================
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number VARCHAR(30) UNIQUE NOT NULL,

  -- ============================================
  -- SOURCE ATTRIBUTION (Phase 1 - Generator Tracking)
  -- ============================================
  source_type VARCHAR(50) NOT NULL,
  lead_generator_id UUID,
  lead_generator_name VARCHAR(255),
  lead_generator_role VARCHAR(50),
  source_partner_id UUID,
  source_partner_code VARCHAR(50),
  source_partner_name VARCHAR(255),
  trace_token TEXT,

  -- ============================================
  -- CUSTOMER INFORMATION (Phase 1 + Phase 2)
  -- ============================================
  customer_id UUID,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile VARCHAR(15) NOT NULL,
  customer_alternate_mobile VARCHAR(15),
  customer_email VARCHAR(255),
  customer_city VARCHAR(100),
  customer_state VARCHAR(100),
  customer_pincode VARCHAR(10),
  customer_address TEXT,
  customer_pan VARCHAR(20),
  customer_aadhaar VARCHAR(20),
  customer_dob DATE,
  customer_gender VARCHAR(20),
  customer_marital_status VARCHAR(20),
  customer_subrole VARCHAR(50),
  residence_type VARCHAR(50),
  years_at_current_address INTEGER,

  -- ============================================
  -- CO-APPLICANT DETAILS (Phase 2)
  -- ============================================
  has_co_applicant BOOLEAN DEFAULT false,
  co_applicant_name VARCHAR(255),
  co_applicant_mobile VARCHAR(15),
  co_applicant_email VARCHAR(255),
  co_applicant_pan VARCHAR(20),
  co_applicant_relationship VARCHAR(50),
  co_applicant_income DECIMAL(15,2),

  -- ============================================
  -- EMPLOYMENT DETAILS (Phase 2)
  -- ============================================
  employment_type VARCHAR(50),
  company_name VARCHAR(255),
  designation VARCHAR(100),
  work_experience_years INTEGER,
  current_company_years INTEGER,
  office_address TEXT,
  office_pincode VARCHAR(10),

  -- ============================================
  -- INCOME DETAILS (Phase 2)
  -- ============================================
  monthly_income DECIMAL(15,2),
  annual_income DECIMAL(15,2),
  other_income DECIMAL(15,2),
  income_proof_type VARCHAR(100),

  -- ============================================
  -- LOAN DETAILS (Phase 1 + Phase 2)
  -- ============================================
  loan_type VARCHAR(100),
  loan_category_id UUID,
  loan_category_code VARCHAR(50),
  loan_subcategory_id UUID,
  loan_subcategory_code VARCHAR(50),
  loan_amount DECIMAL(15,2),
  loan_purpose VARCHAR(100),
  loan_purpose_detail TEXT,
  loan_tenure_months INTEGER,
  preferred_bank VARCHAR(100),
  existing_relationship_bank VARCHAR(255),

  -- ============================================
  -- PROPERTY DETAILS (Phase 2 - Conditional for secured loans)
  -- ============================================
  property_type VARCHAR(50),
  property_sub_type VARCHAR(50),
  property_address TEXT,
  property_city VARCHAR(100),
  property_state VARCHAR(100),
  property_pincode VARCHAR(10),
  property_value DECIMAL(15,2),
  property_area_sqft INTEGER,
  land_area_sqft INTEGER,
  property_age_years INTEGER,
  property_ownership VARCHAR(50),
  property_owner_name VARCHAR(255),
  is_property_mortgaged BOOLEAN DEFAULT false,
  existing_mortgage_bank VARCHAR(100),
  existing_mortgage_amount DECIMAL(15,2),
  property_documents_available TEXT[],

  -- ============================================
  -- EXISTING LOANS (Phase 2)
  -- ============================================
  has_existing_loans BOOLEAN DEFAULT false,
  total_existing_emis DECIMAL(15,2),
  total_outstanding_loans DECIMAL(15,2),
  existing_loans_details JSONB DEFAULT '[]',
  has_credit_cards BOOLEAN DEFAULT false,
  total_credit_card_limit DECIMAL(15,2),
  total_credit_card_outstanding DECIMAL(15,2),
  credit_card_emi DECIMAL(15,2),

  -- ============================================
  -- FORM/PHASE TRACKING (ULAP Application)
  -- ============================================
  form_status VARCHAR(50) DEFAULT 'NEW',
  application_phase INTEGER DEFAULT 0,
  form_completion_percentage INTEGER DEFAULT 0,
  phase_1_submitted_at TIMESTAMPTZ,
  phase_2_submitted_at TIMESTAMPTZ,

  -- ============================================
  -- LINK TRACKING (ULAP Short Links)
  -- ============================================
  short_link VARCHAR(255),
  short_code VARCHAR(20),
  shared_via_whatsapp BOOLEAN DEFAULT false,
  whatsapp_sent_count INTEGER DEFAULT 0,
  last_whatsapp_sent_at TIMESTAMPTZ,

  -- ============================================
  -- CAM (Credit Appraisal Memo) TRACKING
  -- ============================================
  cam_required BOOLEAN DEFAULT false,
  cam_status VARCHAR(50) DEFAULT 'NOT_REQUIRED',
  cam_id UUID,
  cam_initiated_at TIMESTAMPTZ,
  cam_completed_at TIMESTAMPTZ,
  cam_credit_score INTEGER,
  cam_risk_grade VARCHAR(5),
  cam_risk_score INTEGER,
  cam_recommendation VARCHAR(50),
  cam_eligible_amount DECIMAL(15,2),
  cam_foir DECIMAL(5,2),
  cam_dti DECIMAL(5,2),
  cam_provider VARCHAR(50),
  cam_error_message TEXT,
  cam_retry_count INTEGER DEFAULT 0,

  -- ============================================
  -- LEAD STATUS & QUALITY
  -- ============================================
  lead_status VARCHAR(50) DEFAULT 'NEW',
  previous_status VARCHAR(50),
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  status_changed_by UUID,
  status_changed_by_name VARCHAR(255),
  lead_priority VARCHAR(20) DEFAULT 'MEDIUM',
  lead_score INTEGER DEFAULT 50,
  lead_quality VARCHAR(20) DEFAULT 'WARM',

  -- ============================================
  -- BDE ASSIGNMENT
  -- ============================================
  assigned_bde_id UUID,
  assigned_bde_name VARCHAR(255),
  assigned_at TIMESTAMPTZ,
  assignment_type VARCHAR(20),
  assignment_rule_id UUID,
  assignment_criteria JSONB,
  bde_team_lead_id UUID,
  bde_team_lead_name VARCHAR(255),

  -- ============================================
  -- DOCUMENT TRACKING
  -- ============================================
  documents_required INTEGER DEFAULT 0,
  documents_uploaded INTEGER DEFAULT 0,
  documents_verified INTEGER DEFAULT 0,
  all_docs_complete BOOLEAN DEFAULT false,

  -- ============================================
  -- COMMUNICATION TRACKING
  -- ============================================
  last_contacted_at TIMESTAMPTZ,
  contact_attempts INTEGER DEFAULT 0,
  last_note_at TIMESTAMPTZ,
  notes_count INTEGER DEFAULT 0,

  -- ============================================
  -- OUTCOME
  -- ============================================
  outcome VARCHAR(50),
  outcome_at TIMESTAMPTZ,
  outcome_reason TEXT,
  outcome_reason_category VARCHAR(100),
  outcome_by UUID,
  outcome_by_name VARCHAR(255),

  -- ============================================
  -- FINANCIAL (Post-Sanction)
  -- ============================================
  sanctioned_amount DECIMAL(15,2),
  sanctioned_at TIMESTAMPTZ,
  sanctioned_bank VARCHAR(100),
  sanctioned_bank_branch VARCHAR(255),
  bank_login_id VARCHAR(100),
  bank_login_date DATE,
  disbursed_amount DECIMAL(15,2),
  disbursed_at TIMESTAMPTZ,
  disbursement_reference VARCHAR(100),

  -- ============================================
  -- SLA TRACKING
  -- ============================================
  sla_stage_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  sla_breach_count INTEGER DEFAULT 0,

  -- ============================================
  -- COMMISSION/REFERRAL (Partner Payout)
  -- ============================================
  commission_eligible BOOLEAN DEFAULT false,
  commission_amount DECIMAL(15,2),
  commission_status VARCHAR(50),
  commission_paid_at TIMESTAMPTZ,
  referrer_customer_id UUID,
  referral_points_awarded INTEGER DEFAULT 0,

  -- ============================================
  -- DYNAMIC FIELDS (JSONB for flexibility)
  -- ============================================
  collected_data JSONB DEFAULT '{}',
  phase_1_data JSONB DEFAULT '{}',
  phase_2_data JSONB DEFAULT '{}',
  property_data JSONB DEFAULT '{}',
  document_data JSONB DEFAULT '{}',
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  remarks TEXT,

  -- ============================================
  -- TIMESTAMPS & SOFT DELETE
  -- ============================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  -- ============================================
  -- CONSTRAINTS
  -- ============================================
  CONSTRAINT leads_valid_mobile CHECK (customer_mobile ~ '^\+?[0-9]{10,15}$'),
  CONSTRAINT leads_valid_source_type CHECK (source_type IN (
    'ULAP_BA', 'ULAP_BP', 'ULAP_EMPLOYEE', 'ULAP_CUSTOMER_REFERRAL', 'ULAP_PUBLIC',
    'CRO', 'DSE', 'DIGITAL_SALES', 'TELECALLER', 'FIELD_SALES', 'CUSTOMER_DIRECT',
    'WEBSITE', 'WALK_IN', 'IVR', 'CHATBOT'
  )),
  CONSTRAINT leads_valid_lead_status CHECK (lead_status IN (
    'NEW',
    'PHASE_1_SUBMITTED', 'PHASE_2_IN_PROGRESS', 'PHASE_2_SUBMITTED',
    'CAM_PENDING', 'CAM_PROCESSING', 'CAM_COMPLETED', 'CAM_FAILED', 'CAM_SKIPPED',
    'PENDING_ASSIGNMENT', 'ASSIGNED', 'CONTACTED',
    'DOC_COLLECTION', 'DOC_VERIFIED',
    'BANK_LOGIN', 'BANK_PROCESSING', 'SANCTIONED', 'DISBURSED',
    'REJECTED', 'DROPPED', 'ON_HOLD'
  )),
  CONSTRAINT leads_valid_cam_status CHECK (cam_status IN (
    'NOT_REQUIRED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'
  )),
  CONSTRAINT leads_valid_form_status CHECK (form_status IN (
    'NEW', 'PHASE_1_SUBMITTED', 'PHASE_2_IN_PROGRESS', 'PHASE_2_SUBMITTED', 'COMPLETE'
  ))
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookups
CREATE INDEX IF NOT EXISTS idx_leads_lead_number ON public.leads(lead_number);
CREATE INDEX IF NOT EXISTS idx_leads_customer_mobile ON public.leads(customer_mobile);
CREATE INDEX IF NOT EXISTS idx_leads_customer_email ON public.leads(customer_email) WHERE customer_email IS NOT NULL;

-- Source tracking
CREATE INDEX IF NOT EXISTS idx_leads_source_type ON public.leads(source_type);
CREATE INDEX IF NOT EXISTS idx_leads_lead_generator ON public.leads(lead_generator_id) WHERE lead_generator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source_partner ON public.leads(source_partner_id) WHERE source_partner_id IS NOT NULL;

-- Status and phase
CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON public.leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_form_status ON public.leads(form_status);
CREATE INDEX IF NOT EXISTS idx_leads_application_phase ON public.leads(application_phase);

-- CAM tracking
CREATE INDEX IF NOT EXISTS idx_leads_cam_status ON public.leads(cam_status) WHERE cam_required = true;
CREATE INDEX IF NOT EXISTS idx_leads_cam_id ON public.leads(cam_id) WHERE cam_id IS NOT NULL;

-- BDE assignment
CREATE INDEX IF NOT EXISTS idx_leads_assigned_bde ON public.leads(assigned_bde_id) WHERE assigned_bde_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_bde_team_lead ON public.leads(bde_team_lead_id) WHERE bde_team_lead_id IS NOT NULL;

-- Loan details
CREATE INDEX IF NOT EXISTS idx_leads_loan_type ON public.leads(loan_type);
CREATE INDEX IF NOT EXISTS idx_leads_loan_category ON public.leads(loan_category_id) WHERE loan_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_loan_subcategory ON public.leads(loan_subcategory_id) WHERE loan_subcategory_id IS NOT NULL;

-- Location
CREATE INDEX IF NOT EXISTS idx_leads_customer_city ON public.leads(customer_city);
CREATE INDEX IF NOT EXISTS idx_leads_customer_state ON public.leads(customer_state);
CREATE INDEX IF NOT EXISTS idx_leads_customer_pincode ON public.leads(customer_pincode);

-- Timestamps
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads(updated_at DESC);

-- Outcome
CREATE INDEX IF NOT EXISTS idx_leads_outcome ON public.leads(outcome) WHERE outcome IS NOT NULL;

-- Active leads
CREATE INDEX IF NOT EXISTS idx_leads_active ON public.leads(is_active) WHERE is_active = true;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status_bde ON public.leads(lead_status, assigned_bde_id) WHERE assigned_bde_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source_status ON public.leads(source_type, lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_loan_location ON public.leads(loan_type, customer_city);

COMMENT ON TABLE public.leads IS 'Central unified leads table for all lead sources. Complete lifecycle from Phase 1 to Disbursement.';

-- =====================================================
-- END OF MIGRATION 016b
-- =====================================================
