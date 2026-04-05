-- =====================================================
-- MIGRATION: 016_unified_leads_single_table.sql
-- PURPOSE: Single unified leads table for complete lifecycle
-- DATE: 2025-01-16
-- AUTHOR: Senior Architect - World-Class Implementation
-- =====================================================
--
-- This migration creates a SINGLE TABLE architecture for all leads,
-- eliminating the need for partner_leads → unified_leads conversion.
-- All leads from all sources go directly into this table.
--
-- LIFECYCLE: NEW → PHASE_1 → PHASE_2 → CAM (optional) → ASSIGNED → ... → DISBURSED
-- =====================================================

-- =====================================================
-- 1. SYSTEM SETTINGS TABLE (for CAE toggle and other configs)
-- =====================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists (safe migration)
DO $$
BEGIN
  -- Add setting_type column if missing (REQUIRED by existing schema - NOT NULL)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'setting_type') THEN
    ALTER TABLE public.system_settings ADD COLUMN setting_type TEXT DEFAULT 'system';
  END IF;

  -- Add is_public column if missing (from existing schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'is_public') THEN
    ALTER TABLE public.system_settings ADD COLUMN is_public BOOLEAN DEFAULT false;
  END IF;

  -- Add category column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'category') THEN
    ALTER TABLE public.system_settings ADD COLUMN category VARCHAR(50);
  END IF;

  -- Add description column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'description') THEN
    ALTER TABLE public.system_settings ADD COLUMN description TEXT;
  END IF;

  -- Add is_active column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'is_active') THEN
    ALTER TABLE public.system_settings ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Add updated_by column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'updated_by') THEN
    ALTER TABLE public.system_settings ADD COLUMN updated_by UUID;
  END IF;

  -- Add updated_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.system_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'created_at') THEN
    ALTER TABLE public.system_settings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes (safe - IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- Insert CAE toggle setting (CIBIL as default, can be changed by super admin)
-- Include setting_type which is NOT NULL in existing schema
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, category, is_public)
VALUES (
  'CAE_ENABLED',
  '{
    "enabled": false,
    "default_provider": "CIBIL",
    "fallback_provider": "MOCK",
    "auto_assign_after_cam": true,
    "retry_on_failure": true,
    "max_retry_attempts": 3,
    "providers_priority": ["CIBIL", "EXPERIAN", "EQUIFAX", "MOCK"]
  }'::jsonb,
  'cae',
  'Credit Appraisal Engine global toggle. When enabled, all leads go through CAM preparation before BDE assignment. Super admin can change default provider.',
  'CAE',
  false
) ON CONFLICT (setting_key) DO NOTHING;

-- Insert default CAE provider settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, category, is_public)
VALUES (
  'CAE_PROVIDER_CONFIG',
  '{
    "CIBIL": {"enabled": true, "priority": 1, "timeout_ms": 30000},
    "EXPERIAN": {"enabled": true, "priority": 2, "timeout_ms": 30000},
    "EQUIFAX": {"enabled": true, "priority": 3, "timeout_ms": 30000},
    "MOCK": {"enabled": true, "priority": 99, "timeout_ms": 5000}
  }'::jsonb,
  'cae',
  'CAE provider-specific configuration. Super admin can enable/disable and set priorities.',
  'CAE',
  false
) ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE public.system_settings IS 'Global system settings including CAE toggle, provider configs, and other application-wide settings';

-- =====================================================
-- 2. LEADS TABLE - SINGLE TABLE FOR ALL LEADS
-- =====================================================

-- Drop existing leads table if it exists (user confirmed no data exists)
-- This is necessary because an old leads table may have incompatible schema
DROP TABLE IF EXISTS public.leads_documents CASCADE;
DROP TABLE IF EXISTS public.leads_notes CASCADE;
DROP TABLE IF EXISTS public.leads_sla_tracking CASCADE;
DROP TABLE IF EXISTS public.leads_assignment_history CASCADE;
DROP TABLE IF EXISTS public.leads_stage_history CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;

-- Drop existing views that depend on leads
DROP VIEW IF EXISTS public.leads_dashboard_summary CASCADE;
DROP VIEW IF EXISTS public.leads_by_source CASCADE;

CREATE TABLE public.leads (
  -- ============================================
  -- IDENTITY
  -- ============================================
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number VARCHAR(30) UNIQUE NOT NULL,  -- UL-2025-000001

  -- ============================================
  -- SOURCE ATTRIBUTION (Phase 1 - Generator Tracking)
  -- ============================================
  source_type VARCHAR(50) NOT NULL,  -- Lead source type
  lead_generator_id UUID,            -- User ID who generated the lead
  lead_generator_name VARCHAR(255),  -- Name of generator
  lead_generator_role VARCHAR(50),   -- Role: BA, BP, CRO, DSE, etc.
  source_partner_id UUID,            -- Partner ID (for BA/BP)
  source_partner_code VARCHAR(50),   -- Partner code
  source_partner_name VARCHAR(255),  -- Partner name
  trace_token TEXT,                  -- Full attribution token

  -- ============================================
  -- CUSTOMER INFORMATION (Phase 1 + Phase 2)
  -- ============================================
  customer_id UUID,  -- REFERENCES public.customers(id) - Added later if customers table exists
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
  customer_subrole VARCHAR(50),  -- SALARIED, SELF_EMPLOYED, etc.
  residence_type VARCHAR(50),    -- SELF_OWNED, RENTED, PARENTAL
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
  property_type VARCHAR(50),          -- RESIDENTIAL, COMMERCIAL, INDUSTRIAL, LAND
  property_sub_type VARCHAR(50),      -- FLAT, HOUSE, VILLA, SHOP, etc.
  property_address TEXT,
  property_city VARCHAR(100),
  property_state VARCHAR(100),
  property_pincode VARCHAR(10),
  property_value DECIMAL(15,2),
  property_area_sqft INTEGER,
  land_area_sqft INTEGER,
  property_age_years INTEGER,
  property_ownership VARCHAR(50),     -- SELF_OWNED, JOINT, SPOUSE, PARENT
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
  existing_loans_details JSONB DEFAULT '[]',  -- Array of loan details
  has_credit_cards BOOLEAN DEFAULT false,
  total_credit_card_limit DECIMAL(15,2),
  total_credit_card_outstanding DECIMAL(15,2),
  credit_card_emi DECIMAL(15,2),

  -- ============================================
  -- FORM/PHASE TRACKING (ULAP Application)
  -- ============================================
  form_status VARCHAR(50) DEFAULT 'NEW',
  application_phase INTEGER DEFAULT 0,     -- 0=New, 1=Phase 1 Done, 2=Phase 2 Done
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
  cam_required BOOLEAN DEFAULT false,       -- Based on super admin toggle
  cam_status VARCHAR(50) DEFAULT 'NOT_REQUIRED',
  cam_id UUID,                              -- Reference to credit_appraisal_memos
  cam_initiated_at TIMESTAMPTZ,
  cam_completed_at TIMESTAMPTZ,
  cam_credit_score INTEGER,
  cam_risk_grade VARCHAR(5),                -- A, B, C, D, E, F
  cam_risk_score INTEGER,                   -- 0-100
  cam_recommendation VARCHAR(50),           -- APPROVE, APPROVE_WITH_CONDITIONS, REFER, DECLINE
  cam_eligible_amount DECIMAL(15,2),
  cam_foir DECIMAL(5,2),                    -- Fixed Obligations to Income Ratio
  cam_dti DECIMAL(5,2),                     -- Debt to Income ratio
  cam_provider VARCHAR(50),                 -- CIBIL, EXPERIAN, EQUIFAX, MOCK
  cam_error_message TEXT,
  cam_retry_count INTEGER DEFAULT 0,

  -- ============================================
  -- LEAD STATUS & QUALITY
  -- ============================================
  lead_status VARCHAR(50) DEFAULT 'NEW',  -- Complete lifecycle status
  previous_status VARCHAR(50),
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  status_changed_by UUID,
  status_changed_by_name VARCHAR(255),

  lead_priority VARCHAR(20) DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, URGENT
  lead_score INTEGER DEFAULT 50,
  lead_quality VARCHAR(20) DEFAULT 'WARM',     -- COLD, WARM, HOT

  -- ============================================
  -- BDE ASSIGNMENT (After CAM Stage or directly after Phase 2 if CAE disabled)
  -- ============================================
  assigned_bde_id UUID,  -- REFERENCES public.employee_profile(id)
  assigned_bde_name VARCHAR(255),
  assigned_at TIMESTAMPTZ,
  assignment_type VARCHAR(20),  -- AUTO, MANUAL, REASSIGN
  assignment_rule_id UUID,
  assignment_criteria JSONB,    -- { loan_type, location } used for assignment

  -- BDM (Team Lead)
  bde_team_lead_id UUID,  -- REFERENCES public.employee_profile(id)
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
  outcome VARCHAR(50),  -- DISBURSED, REJECTED, DROPPED
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
  collected_data JSONB DEFAULT '{}',  -- All dynamic form field data based on loan type
  phase_1_data JSONB DEFAULT '{}',    -- Phase 1 specific collected data
  phase_2_data JSONB DEFAULT '{}',    -- Phase 2 specific collected data
  property_data JSONB DEFAULT '{}',   -- Property-specific data for secured loans
  document_data JSONB DEFAULT '{}',   -- Document metadata
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
-- 3. INDEXES FOR PERFORMANCE
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

-- =====================================================
-- 4. LEADS STAGE HISTORY TABLE (Immutable Audit)
-- =====================================================

CREATE TABLE public.leads_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Stage Change
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,

  -- Actor
  changed_by_id UUID,
  changed_by_name VARCHAR(255),
  changed_by_role VARCHAR(50),

  -- Details
  change_reason TEXT,
  change_notes TEXT,

  -- Duration Tracking
  time_in_previous_status INTERVAL,
  was_sla_breached BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_stage_history_lead ON public.leads_stage_history(lead_id);
CREATE INDEX idx_leads_stage_history_created ON public.leads_stage_history(created_at DESC);
CREATE INDEX idx_leads_stage_history_to_status ON public.leads_stage_history(to_status);

COMMENT ON TABLE public.leads_stage_history IS 'Immutable audit trail for all status changes in leads';

-- =====================================================
-- 5. LEADS ASSIGNMENT HISTORY TABLE (Immutable)
-- =====================================================

CREATE TABLE public.leads_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Assignment Change
  from_bde_id UUID,
  from_bde_name VARCHAR(255),
  to_bde_id UUID NOT NULL,
  to_bde_name VARCHAR(255) NOT NULL,

  -- Actor
  assigned_by_id UUID,
  assigned_by_name VARCHAR(255),
  assigned_by_role VARCHAR(50),

  -- Type
  assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('AUTO', 'MANUAL', 'REASSIGN', 'ESCALATION')),
  assignment_rule_id UUID,
  reason TEXT,

  -- Assignment criteria used
  assignment_criteria JSONB,  -- { loan_type, location, etc. }

  -- BDE Workload at Assignment
  bde_workload_at_assignment INTEGER DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_assignment_history_lead ON public.leads_assignment_history(lead_id);
CREATE INDEX idx_leads_assignment_history_to_bde ON public.leads_assignment_history(to_bde_id);
CREATE INDEX idx_leads_assignment_history_created ON public.leads_assignment_history(created_at DESC);

COMMENT ON TABLE public.leads_assignment_history IS 'Immutable audit trail for all BDE assignments';

-- =====================================================
-- 6. LEADS SLA TRACKING TABLE
-- =====================================================

CREATE TABLE public.leads_sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Status Info
  lead_status VARCHAR(50) NOT NULL,
  status_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- SLA Configuration
  sla_hours INTEGER NOT NULL,
  sla_deadline TIMESTAMPTZ NOT NULL,

  -- Breach Tracking
  is_breached BOOLEAN DEFAULT false,
  breach_detected_at TIMESTAMPTZ,
  breach_duration INTERVAL,

  -- Escalation
  escalation_level INTEGER DEFAULT 0,
  escalated_to_id UUID,
  escalated_to_name VARCHAR(255),
  escalated_at TIMESTAMPTZ,
  escalation_notes TEXT,

  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_sla_tracking_lead ON public.leads_sla_tracking(lead_id);
CREATE INDEX idx_leads_sla_tracking_status ON public.leads_sla_tracking(lead_status);
CREATE INDEX idx_leads_sla_tracking_breached ON public.leads_sla_tracking(is_breached);
CREATE INDEX idx_leads_sla_tracking_deadline ON public.leads_sla_tracking(sla_deadline);

COMMENT ON TABLE public.leads_sla_tracking IS 'SLA tracking and breach detection for leads';

-- =====================================================
-- 7. LEADS NOTES TABLE
-- =====================================================

CREATE TABLE public.leads_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Author
  author_id UUID NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_role VARCHAR(50) NOT NULL,

  -- Note Content
  note_type VARCHAR(50) NOT NULL CHECK (note_type IN (
    'DAILY_UPDATE', 'CALL_LOG', 'MEETING', 'DOCUMENT', 'STATUS_CHANGE',
    'ESCALATION', 'GENERAL', 'FOLLOW_UP', 'CUSTOMER_RESPONSE', 'CAM_NOTE'
  )),
  note_text TEXT NOT NULL,

  -- Call Details (if applicable)
  call_duration_seconds INTEGER,
  call_outcome VARCHAR(50),

  -- Customer Response
  customer_response VARCHAR(50) CHECK (customer_response IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NO_RESPONSE')),

  -- Follow-up
  next_action VARCHAR(255),
  next_action_date DATE,
  next_action_time TIME,

  -- Attachments
  attachments JSONB DEFAULT '[]',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_notes_lead ON public.leads_notes(lead_id);
CREATE INDEX idx_leads_notes_author ON public.leads_notes(author_id);
CREATE INDEX idx_leads_notes_type ON public.leads_notes(note_type);
CREATE INDEX idx_leads_notes_created ON public.leads_notes(created_at DESC);

COMMENT ON TABLE public.leads_notes IS 'Notes and updates for leads including BDE daily updates';

-- =====================================================
-- 8. LEADS DOCUMENTS TABLE
-- =====================================================

CREATE TABLE public.leads_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Document Info
  document_type VARCHAR(100) NOT NULL,
  document_category VARCHAR(50) CHECK (document_category IN (
    'IDENTITY', 'ADDRESS', 'INCOME', 'BANK', 'PROPERTY', 'BUSINESS', 'CO_APPLICANT', 'OTHER'
  )),
  document_name VARCHAR(255) NOT NULL,

  -- File Details
  file_name VARCHAR(500) NOT NULL,
  original_file_name VARCHAR(500),
  file_size_bytes BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  mime_type VARCHAR(200),

  -- Storage
  storage_bucket VARCHAR(255) NOT NULL,
  storage_key VARCHAR(1000) NOT NULL,
  storage_url TEXT,

  -- Upload Details
  uploaded_by_id UUID NOT NULL,
  uploaded_by_name VARCHAR(255),
  uploaded_by_role VARCHAR(50),

  -- Verification
  is_required BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  verified_by_id UUID,
  verified_by_name VARCHAR(255),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,

  -- Rejection
  is_rejected BOOLEAN DEFAULT false,
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_documents_lead ON public.leads_documents(lead_id);
CREATE INDEX idx_leads_documents_type ON public.leads_documents(document_type);
CREATE INDEX idx_leads_documents_category ON public.leads_documents(document_category);
CREATE INDEX idx_leads_documents_verified ON public.leads_documents(is_verified);

COMMENT ON TABLE public.leads_documents IS 'Documents uploaded for leads with storage integration';

-- =====================================================
-- 9. DATABASE FUNCTIONS
-- =====================================================

-- Function: Generate Unique Lead Number
CREATE OR REPLACE FUNCTION generate_lead_number()
RETURNS VARCHAR(30) AS $$
DECLARE
  new_number VARCHAR(30);
  max_seq INTEGER;
  year_part VARCHAR(4);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(lead_number FROM 9) AS INTEGER
      )
    ),
    0
  ) INTO max_seq
  FROM public.leads
  WHERE lead_number LIKE 'UL-' || year_part || '-%';

  new_number := 'UL-' || year_part || '-' || LPAD((max_seq + 1)::TEXT, 6, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_lead_number() IS 'Generates sequential lead number: UL-2025-000001';

-- Function: Get CAE Enabled Status
CREATE OR REPLACE FUNCTION get_cae_enabled()
RETURNS BOOLEAN AS $$
DECLARE
  cae_enabled BOOLEAN;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO cae_enabled
  FROM public.system_settings
  WHERE setting_key = 'CAE_ENABLED'
    AND is_active = true;

  RETURN COALESCE(cae_enabled, false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_cae_enabled() IS 'Returns whether CAE is enabled globally';

-- Function: Get Default CAE Provider
CREATE OR REPLACE FUNCTION get_default_cae_provider()
RETURNS VARCHAR(50) AS $$
DECLARE
  default_provider VARCHAR(50);
BEGIN
  SELECT setting_value->>'default_provider' INTO default_provider
  FROM public.system_settings
  WHERE setting_key = 'CAE_ENABLED'
    AND is_active = true;

  RETURN COALESCE(default_provider, 'MOCK');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_default_cae_provider() IS 'Returns the default CAE provider (configurable by super admin)';

-- Function: Get SLA Hours for Status
CREATE OR REPLACE FUNCTION get_sla_hours_for_status(p_status VARCHAR(50))
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_status
    WHEN 'PHASE_1_SUBMITTED' THEN 24  -- 1 day to complete Phase 2
    WHEN 'PHASE_2_SUBMITTED' THEN 4   -- 4 hours for CAM processing
    WHEN 'CAM_PENDING' THEN 4         -- 4 hours for CAM
    WHEN 'PENDING_ASSIGNMENT' THEN 2  -- 2 hours to assign
    WHEN 'ASSIGNED' THEN 24           -- 1 day to contact
    WHEN 'CONTACTED' THEN 48          -- 2 days for doc collection
    WHEN 'DOC_COLLECTION' THEN 168    -- 7 days for docs
    WHEN 'DOC_VERIFIED' THEN 24       -- 1 day for bank login
    WHEN 'BANK_LOGIN' THEN 24         -- 1 day
    WHEN 'BANK_PROCESSING' THEN 360   -- 15 days
    WHEN 'SANCTIONED' THEN 48         -- 2 days for disbursal
    ELSE 48                           -- Default 2 days
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sla_hours_for_status(VARCHAR) IS 'Returns SLA hours for each lead status';

-- Function: Get BDE Workload
CREATE OR REPLACE FUNCTION get_bde_leads_workload(p_bde_id UUID)
RETURNS INTEGER AS $$
DECLARE
  workload INTEGER;
BEGIN
  SELECT COUNT(*) INTO workload
  FROM public.leads
  WHERE assigned_bde_id = p_bde_id
    AND outcome IS NULL
    AND is_active = true;

  RETURN COALESCE(workload, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bde_leads_workload(UUID) IS 'Returns count of active leads assigned to BDE';

-- Function: Get Next BDE for Assignment
-- NOTE: This function requires bde_assignment_config table to exist
-- If the table doesn't exist, the function will return empty results
CREATE OR REPLACE FUNCTION get_next_bde_for_lead_assignment(
  p_loan_type VARCHAR(100) DEFAULT NULL,
  p_city VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE(
  bde_id UUID,
  bde_name VARCHAR(255),
  bde_email VARCHAR(255),
  team_lead_id UUID,
  team_lead_name VARCHAR(255),
  current_workload INTEGER
) AS $$
BEGIN
  -- Check if required tables exist before querying
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bde_assignment_config') THEN
    RETURN QUERY
    SELECT
      bac.bde_id,
      COALESCE(u.full_name, u.email, 'Unknown')::VARCHAR(255) AS bde_name,
      u.email AS bde_email,
      ep.reports_to AS team_lead_id,
      COALESCE((SELECT e.name FROM public.employee_profile e WHERE e.id = ep.reports_to), 'Unknown')::VARCHAR(255) AS team_lead_name,
      get_bde_leads_workload(bac.bde_id) AS current_workload
    FROM public.bde_assignment_config bac
    LEFT JOIN public.users u ON u.id = bac.bde_id
    LEFT JOIN public.employee_profile ep ON ep.user_id = bac.bde_id
    WHERE bac.is_active = true
      AND bac.is_on_leave = false
      AND bac.auto_assign_enabled = true
      AND bac.current_active_deals < bac.max_active_deals
      -- Match loan type if provided and config has loan types
      AND (p_loan_type IS NULL OR array_length(bac.loan_types, 1) IS NULL
           OR p_loan_type = ANY(bac.loan_types))
      -- Match location if provided and config has locations
      AND (p_city IS NULL OR array_length(bac.locations, 1) IS NULL
           OR p_city = ANY(bac.locations))
    ORDER BY
      -- Priority 1: Both loan type and location match
      CASE
        WHEN p_loan_type = ANY(bac.loan_types) AND p_city = ANY(bac.locations) THEN 0
        WHEN p_loan_type = ANY(bac.loan_types) THEN 1
        WHEN p_city = ANY(bac.locations) THEN 2
        ELSE 3
      END,
      -- Priority 2: Lower workload
      get_bde_leads_workload(bac.bde_id) ASC,
      -- Priority 3: Priority weight
      bac.priority_weight DESC,
      -- Priority 4: Success rate
      bac.success_rate DESC NULLS LAST
    LIMIT 1;
  END IF;
  -- Returns empty if bde_assignment_config doesn't exist
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_bde_for_lead_assignment(VARCHAR, VARCHAR) IS 'Gets next BDE for assignment based on loan type, location, and workload';

-- =====================================================
-- 10. TRIGGERS
-- =====================================================

-- Trigger: Auto-generate lead number
CREATE OR REPLACE FUNCTION trigger_generate_lead_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_number IS NULL THEN
    NEW.lead_number := generate_lead_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_number ON public.leads;
CREATE TRIGGER trigger_leads_number
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_lead_number();

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION trigger_update_leads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_updated ON public.leads;
CREATE TRIGGER trigger_leads_updated
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_leads_timestamp();

-- Trigger: Track status changes in history
CREATE OR REPLACE FUNCTION trigger_leads_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    INSERT INTO public.leads_stage_history (
      lead_id,
      from_status,
      to_status,
      changed_by_id,
      changed_by_name,
      changed_by_role,
      time_in_previous_status
    ) VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      NEW.status_changed_by,
      NEW.status_changed_by_name,
      NULL, -- Role can be added later
      NEW.status_changed_at - OLD.status_changed_at
    );

    -- Update status changed timestamp
    NEW.previous_status := OLD.lead_status;
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_status_history ON public.leads;
CREATE TRIGGER trigger_leads_status_history
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_leads_status_history();

-- Trigger: Update notes count on leads
CREATE OR REPLACE FUNCTION trigger_update_leads_notes_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads
  SET
    notes_count = (SELECT COUNT(*) FROM public.leads_notes WHERE lead_id = NEW.lead_id),
    last_note_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_notes_count ON public.leads_notes;
CREATE TRIGGER trigger_leads_notes_count
  AFTER INSERT ON public.leads_notes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_leads_notes_count();

-- Trigger: Update document counts on leads
CREATE OR REPLACE FUNCTION trigger_update_leads_doc_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads
  SET
    documents_uploaded = (SELECT COUNT(*) FROM public.leads_documents WHERE lead_id = NEW.lead_id),
    documents_verified = (SELECT COUNT(*) FROM public.leads_documents WHERE lead_id = NEW.lead_id AND is_verified = true),
    all_docs_complete = (
      SELECT COUNT(*) = SUM(CASE WHEN is_verified THEN 1 ELSE 0 END)
      FROM public.leads_documents
      WHERE lead_id = NEW.lead_id AND is_required = true
    ),
    updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_leads_doc_count_insert ON public.leads_documents;
CREATE TRIGGER trigger_leads_doc_count_insert
  AFTER INSERT ON public.leads_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_leads_doc_count();

DROP TRIGGER IF EXISTS trigger_leads_doc_count_update ON public.leads_documents;
CREATE TRIGGER trigger_leads_doc_count_update
  AFTER UPDATE ON public.leads_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_leads_doc_count();

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LEADS RLS POLICIES
-- =====================================================
-- NOTE: These policies are designed to be resilient to missing tables
-- They use safe checks that won't fail if referenced tables don't exist

-- NOTE: is_super_admin(uuid) function already exists with parameter name 'user_uuid'
-- and has many dependent RLS policies. We reuse the existing function.
-- If it doesn't exist, create it (for fresh installations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin') THEN
    EXECUTE $func$
      CREATE FUNCTION is_super_admin(user_uuid UUID)
      RETURNS BOOLEAN AS $body$
      DECLARE
        is_admin BOOLEAN := false;
      BEGIN
        -- Check in users table if it exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
          SELECT EXISTS(SELECT 1 FROM public.users WHERE id = user_uuid AND role = 'SUPER_ADMIN') INTO is_admin;
          IF is_admin THEN RETURN true; END IF;
        END IF;

        -- Check in employee_profile table if it exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_profile') THEN
          SELECT EXISTS(SELECT 1 FROM public.employee_profile WHERE user_id = user_uuid AND role = 'SUPER_ADMIN') INTO is_admin;
          IF is_admin THEN RETURN true; END IF;
        END IF;

        RETURN false;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER;
    $func$;
  END IF;
END $$;

-- Super Admin: Full access
CREATE POLICY "Super admin full access on leads"
  ON public.leads FOR ALL
  USING (is_super_admin(auth.uid()));

-- BDE: View and edit assigned leads only
CREATE POLICY "BDE can view assigned leads"
  ON public.leads FOR SELECT
  USING (assigned_bde_id = auth.uid());

CREATE POLICY "BDE can update assigned leads"
  ON public.leads FOR UPDATE
  USING (assigned_bde_id = auth.uid());

-- BDM (Team Lead): View team leads
CREATE POLICY "BDM can view team leads"
  ON public.leads FOR SELECT
  USING (bde_team_lead_id = auth.uid());

-- Lead Generator (Partners, Employees): View own generated leads
CREATE POLICY "Lead generator can view own leads"
  ON public.leads FOR SELECT
  USING (lead_generator_id = auth.uid());

-- Customer: View own applications (simplified - uses customer_id directly)
CREATE POLICY "Customer can view own applications"
  ON public.leads FOR SELECT
  USING (customer_id = auth.uid());

-- Insert policy for authenticated users
CREATE POLICY "Authenticated users can create leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- SYSTEM SETTINGS RLS POLICIES
-- =====================================================

-- Drop existing policies if they exist (safe recreation)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Super admin full access on system_settings" ON public.system_settings;
  DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.system_settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Super Admin: Full access to settings
CREATE POLICY "Super admin full access on system_settings"
  ON public.system_settings FOR ALL
  USING (is_super_admin(auth.uid()));

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- HISTORY TABLES RLS POLICIES
-- =====================================================

-- Stage history: View for users with lead access
CREATE POLICY "Users can view stage history of accessible leads"
  ON public.leads_stage_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
      AND (l.assigned_bde_id = auth.uid()
           OR l.bde_team_lead_id = auth.uid()
           OR l.lead_generator_id = auth.uid())
    )
  );

CREATE POLICY "Super admin full access on leads_stage_history"
  ON public.leads_stage_history FOR ALL
  USING (is_super_admin(auth.uid()));

-- Assignment history policies
CREATE POLICY "Users can view assignment history of accessible leads"
  ON public.leads_assignment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
      AND (l.assigned_bde_id = auth.uid()
           OR l.bde_team_lead_id = auth.uid()
           OR l.lead_generator_id = auth.uid())
    )
  );

CREATE POLICY "Super admin full access on leads_assignment_history"
  ON public.leads_assignment_history FOR ALL
  USING (is_super_admin(auth.uid()));

-- SLA tracking policies
CREATE POLICY "Super admin full access on leads_sla_tracking"
  ON public.leads_sla_tracking FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "BDE can view SLA on assigned leads"
  ON public.leads_sla_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND l.assigned_bde_id = auth.uid()
    )
  );

-- Notes policies
CREATE POLICY "BDE can manage notes on assigned leads"
  ON public.leads_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND l.assigned_bde_id = auth.uid()
    )
  );

CREATE POLICY "Super admin full access on leads_notes"
  ON public.leads_notes FOR ALL
  USING (is_super_admin(auth.uid()));

-- Documents policies
CREATE POLICY "BDE can manage documents on assigned leads"
  ON public.leads_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id AND l.assigned_bde_id = auth.uid()
    )
  );

CREATE POLICY "Super admin full access on leads_documents"
  ON public.leads_documents FOR ALL
  USING (is_super_admin(auth.uid()));

-- =====================================================
-- 12. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Active leads summary for dashboard
CREATE OR REPLACE VIEW public.leads_dashboard_summary AS
SELECT
  COUNT(*) FILTER (WHERE lead_status = 'NEW') AS new_leads,
  COUNT(*) FILTER (WHERE lead_status = 'PHASE_1_SUBMITTED') AS phase_1_completed,
  COUNT(*) FILTER (WHERE lead_status = 'PHASE_2_SUBMITTED') AS phase_2_completed,
  COUNT(*) FILTER (WHERE lead_status IN ('CAM_PENDING', 'CAM_PROCESSING')) AS cam_in_progress,
  COUNT(*) FILTER (WHERE lead_status = 'PENDING_ASSIGNMENT') AS pending_assignment,
  COUNT(*) FILTER (WHERE lead_status = 'ASSIGNED') AS assigned,
  COUNT(*) FILTER (WHERE lead_status = 'CONTACTED') AS contacted,
  COUNT(*) FILTER (WHERE lead_status = 'DOC_COLLECTION') AS doc_collection,
  COUNT(*) FILTER (WHERE lead_status = 'DOC_VERIFIED') AS doc_verified,
  COUNT(*) FILTER (WHERE lead_status IN ('BANK_LOGIN', 'BANK_PROCESSING')) AS bank_processing,
  COUNT(*) FILTER (WHERE lead_status = 'SANCTIONED') AS sanctioned,
  COUNT(*) FILTER (WHERE outcome = 'DISBURSED') AS disbursed,
  COUNT(*) FILTER (WHERE outcome = 'REJECTED') AS rejected,
  COUNT(*) FILTER (WHERE outcome = 'DROPPED') AS dropped,
  COUNT(*) AS total_leads
FROM public.leads
WHERE is_active = true;

COMMENT ON VIEW public.leads_dashboard_summary IS 'Summary counts for leads dashboard';

-- View: Source-wise lead counts
CREATE OR REPLACE VIEW public.leads_by_source AS
SELECT
  source_type,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE outcome = 'DISBURSED') AS disbursed,
  COUNT(*) FILTER (WHERE outcome = 'REJECTED') AS rejected,
  COUNT(*) FILTER (WHERE outcome IS NULL AND is_active = true) AS active,
  ROUND(
    (COUNT(*) FILTER (WHERE outcome = 'DISBURSED')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2
  ) AS conversion_rate
FROM public.leads
WHERE is_active = true
GROUP BY source_type
ORDER BY total_leads DESC;

COMMENT ON VIEW public.leads_by_source IS 'Lead counts and conversion rates by source';

-- =====================================================
-- 13. MIGRATION TRACKING
-- =====================================================

-- Add migration tracking if migrations table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('016_unified_leads_single_table', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- 14. COMMENTS
-- =====================================================

COMMENT ON TABLE public.leads IS 'Central unified leads table for all lead sources. Complete lifecycle from Phase 1 to Disbursement.';
COMMENT ON COLUMN public.leads.lead_number IS 'Unique lead identifier: UL-YYYY-XXXXXX';
COMMENT ON COLUMN public.leads.source_type IS 'Lead source: ULAP_BA, ULAP_BP, CRO, DSE, etc.';
COMMENT ON COLUMN public.leads.lead_generator_id IS 'User ID of the person who generated/submitted the lead';
COMMENT ON COLUMN public.leads.lead_status IS 'Current lifecycle status: NEW → PHASE_1 → PHASE_2 → CAM → ASSIGNED → ... → DISBURSED';
COMMENT ON COLUMN public.leads.cam_status IS 'CAM processing status: NOT_REQUIRED, PENDING, PROCESSING, COMPLETED, FAILED, SKIPPED';
COMMENT ON COLUMN public.leads.collected_data IS 'JSONB field for dynamic form data based on loan type/category';
COMMENT ON COLUMN public.leads.phase_1_data IS 'Phase 1 specific collected data';
COMMENT ON COLUMN public.leads.phase_2_data IS 'Phase 2 specific collected data based on loan type profile';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
