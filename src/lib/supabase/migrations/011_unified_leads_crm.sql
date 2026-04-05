-- =====================================================
-- UNIFIED LEADS CRM SYSTEM - MASTER MIGRATION
-- Version: 1.0.0
-- Date: 2025-01-11
-- Purpose: Centralized CRM for all lead sources
-- =====================================================

-- =====================================================
-- 1. UNIFIED LEADS TABLE (Central CRM)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.unified_leads (
  -- Primary Keys
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number VARCHAR(20) UNIQUE NOT NULL,

  -- Source Attribution
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
    'CRO', 'DSE', 'DIGITAL_SALES', 'TELECALLER', 'FIELD_SALES',
    'PARTNER_BA', 'PARTNER_BP', 'CUSTOMER_DIRECT', 'CUSTOMER_REFERRAL'
  )),
  source_lead_id UUID, -- Reference to original lead in source table
  source_lead_table VARCHAR(100), -- e.g., 'crm_leads', 'dse_leads', 'partner_leads'
  source_user_id UUID, -- User who created/converted the lead
  source_user_name VARCHAR(255),
  source_partner_id UUID, -- Partner reference if applicable
  source_partner_name VARCHAR(255),
  trace_token TEXT, -- Full attribution token

  -- Customer Information
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile VARCHAR(15) NOT NULL,
  customer_alternate_mobile VARCHAR(15),
  customer_email VARCHAR(255),
  customer_city VARCHAR(100),
  customer_state VARCHAR(100),
  customer_pincode VARCHAR(10),
  customer_address TEXT,
  customer_subrole VARCHAR(50), -- SALARIED, SELF_EMPLOYED, etc.

  -- Loan Details
  loan_type VARCHAR(100) NOT NULL,
  loan_amount DECIMAL(15,2),
  loan_purpose TEXT,
  loan_tenure_months INTEGER,
  employment_type VARCHAR(50),
  monthly_income DECIMAL(15,2),
  company_name VARCHAR(255),

  -- Current Status (BDE Pipeline)
  current_stage VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED' CHECK (current_stage IN (
    'ASSIGNED', 'CONTACTED', 'DOC_COLLECTION', 'DOC_VERIFIED',
    'BANK_LOGIN', 'BANK_PROCESSING', 'SANCTIONED', 'DISBURSED',
    'REJECTED', 'DROPPED'
  )),
  previous_stage VARCHAR(50),
  stage_changed_at TIMESTAMPTZ DEFAULT NOW(),
  stage_changed_by UUID,
  stage_changed_by_name VARCHAR(255),

  -- Assignment
  assigned_bde_id UUID REFERENCES public.employee_profile(id) ON DELETE SET NULL,
  assigned_bde_name VARCHAR(255),
  assigned_at TIMESTAMPTZ,
  assignment_type VARCHAR(20) CHECK (assignment_type IN ('AUTO', 'MANUAL')),
  assignment_rule_id UUID,

  -- BDM (Team Lead)
  bde_team_lead_id UUID REFERENCES public.employee_profile(id) ON DELETE SET NULL,
  bde_team_lead_name VARCHAR(255),

  -- Processing Flags
  is_priority BOOLEAN DEFAULT false,
  priority_level VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority_level IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),

  -- Quality & Scoring
  lead_score INTEGER DEFAULT 50,
  lead_quality VARCHAR(20) DEFAULT 'WARM' CHECK (lead_quality IN ('COLD', 'WARM', 'HOT')),

  -- Document Tracking
  documents_required INTEGER DEFAULT 0,
  documents_uploaded INTEGER DEFAULT 0,
  documents_verified INTEGER DEFAULT 0,
  all_docs_complete BOOLEAN DEFAULT false,

  -- Communication
  last_contacted_at TIMESTAMPTZ,
  contact_attempts INTEGER DEFAULT 0,
  last_note_at TIMESTAMPTZ,
  notes_count INTEGER DEFAULT 0,

  -- Outcome
  outcome VARCHAR(50) CHECK (outcome IN ('DISBURSED', 'REJECTED', 'DROPPED')),
  outcome_at TIMESTAMPTZ,
  outcome_reason TEXT,
  outcome_reason_category VARCHAR(100),
  outcome_by UUID,
  outcome_by_name VARCHAR(255),

  -- Financial (Post-Sanction)
  sanctioned_amount DECIMAL(15,2),
  sanctioned_at TIMESTAMPTZ,
  sanctioned_bank VARCHAR(100),
  sanctioned_bank_branch VARCHAR(255),
  bank_login_id VARCHAR(100),
  bank_login_date DATE,
  disbursed_amount DECIMAL(15,2),
  disbursed_at TIMESTAMPTZ,
  disbursement_reference VARCHAR(100),

  -- SLA Tracking
  sla_stage_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  sla_breach_count INTEGER DEFAULT 0,

  -- Commission (for partners)
  commission_eligible BOOLEAN DEFAULT false,
  commission_amount DECIMAL(15,2),
  commission_status VARCHAR(50),
  commission_paid_at TIMESTAMPTZ,

  -- Referral Points (for customer referrals)
  referrer_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  referral_points_awarded INTEGER DEFAULT 0,

  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ DEFAULT NOW(), -- When source converted to unified

  -- Soft Delete
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  -- Constraints
  CONSTRAINT valid_mobile CHECK (customer_mobile ~ '^\+?[0-9]{10,15}$')
);

-- Indexes for unified_leads
CREATE INDEX idx_unified_leads_number ON public.unified_leads(lead_number);
CREATE INDEX idx_unified_leads_source ON public.unified_leads(source_type);
CREATE INDEX idx_unified_leads_source_user ON public.unified_leads(source_user_id);
CREATE INDEX idx_unified_leads_stage ON public.unified_leads(current_stage);
CREATE INDEX idx_unified_leads_bde ON public.unified_leads(assigned_bde_id);
CREATE INDEX idx_unified_leads_bdm ON public.unified_leads(bde_team_lead_id);
CREATE INDEX idx_unified_leads_customer ON public.unified_leads(customer_id);
CREATE INDEX idx_unified_leads_mobile ON public.unified_leads(customer_mobile);
CREATE INDEX idx_unified_leads_loan_type ON public.unified_leads(loan_type);
CREATE INDEX idx_unified_leads_city ON public.unified_leads(customer_city);
CREATE INDEX idx_unified_leads_created ON public.unified_leads(created_at DESC);
CREATE INDEX idx_unified_leads_outcome ON public.unified_leads(outcome);
CREATE INDEX idx_unified_leads_priority ON public.unified_leads(priority_level);
CREATE INDEX idx_unified_leads_active ON public.unified_leads(is_active);
CREATE INDEX idx_unified_leads_source_lead ON public.unified_leads(source_lead_id);

-- Comments
COMMENT ON TABLE public.unified_leads IS 'Central CRM table for all converted leads from all sources';
COMMENT ON COLUMN public.unified_leads.source_type IS 'Origin source: CRO, DSE, DIGITAL_SALES, TELECALLER, FIELD_SALES, PARTNER_BA, PARTNER_BP, CUSTOMER_DIRECT, CUSTOMER_REFERRAL';
COMMENT ON COLUMN public.unified_leads.current_stage IS 'BDE Pipeline stage: ASSIGNED → CONTACTED → DOC_COLLECTION → DOC_VERIFIED → BANK_LOGIN → BANK_PROCESSING → SANCTIONED → DISBURSED';

-- =====================================================
-- 2. LEAD STAGE HISTORY (Immutable Audit)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.unified_leads(id) ON DELETE CASCADE,

  -- Stage Change
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,

  -- Actor
  changed_by_id UUID NOT NULL,
  changed_by_name VARCHAR(255) NOT NULL,
  changed_by_role VARCHAR(50) NOT NULL,

  -- Details
  change_reason TEXT,
  change_notes TEXT,

  -- Duration Tracking
  time_in_previous_stage INTERVAL,
  was_sla_breached BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stage_history_lead ON public.lead_stage_history(lead_id);
CREATE INDEX idx_stage_history_created ON public.lead_stage_history(created_at DESC);
CREATE INDEX idx_stage_history_to_stage ON public.lead_stage_history(to_stage);

COMMENT ON TABLE public.lead_stage_history IS 'Immutable audit trail for all stage changes in unified leads';

-- =====================================================
-- 3. LEAD ASSIGNMENT HISTORY (Immutable)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.unified_leads(id) ON DELETE CASCADE,

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

  -- BDE Workload at Assignment
  bde_workload_at_assignment INTEGER DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignment_history_lead ON public.lead_assignment_history(lead_id);
CREATE INDEX idx_assignment_history_to_bde ON public.lead_assignment_history(to_bde_id);
CREATE INDEX idx_assignment_history_created ON public.lead_assignment_history(created_at DESC);

COMMENT ON TABLE public.lead_assignment_history IS 'Immutable audit trail for all BDE assignments';

-- =====================================================
-- 4. UNIFIED LEAD NOTES (BDE Daily Updates)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.unified_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.unified_leads(id) ON DELETE CASCADE,

  -- Author
  author_id UUID NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  author_role VARCHAR(50) NOT NULL,

  -- Note Content
  note_type VARCHAR(50) NOT NULL CHECK (note_type IN (
    'DAILY_UPDATE', 'CALL_LOG', 'MEETING', 'DOCUMENT', 'STATUS_CHANGE',
    'ESCALATION', 'GENERAL', 'FOLLOW_UP', 'CUSTOMER_RESPONSE'
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

  -- Mandatory Note Tracking
  is_mandatory BOOLEAN DEFAULT false,
  note_date DATE DEFAULT CURRENT_DATE,

  -- Attachments
  attachments JSONB DEFAULT '[]',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for mandatory daily notes
  CONSTRAINT unique_mandatory_daily_note UNIQUE (lead_id, author_id, note_date, is_mandatory)
);

CREATE INDEX idx_unified_notes_lead ON public.unified_lead_notes(lead_id);
CREATE INDEX idx_unified_notes_author ON public.unified_lead_notes(author_id);
CREATE INDEX idx_unified_notes_date ON public.unified_lead_notes(note_date);
CREATE INDEX idx_unified_notes_type ON public.unified_lead_notes(note_type);
CREATE INDEX idx_unified_notes_mandatory ON public.unified_lead_notes(lead_id, is_mandatory);
CREATE INDEX idx_unified_notes_follow_up ON public.unified_lead_notes(next_action_date);

COMMENT ON TABLE public.unified_lead_notes IS 'Notes and updates for unified leads, including mandatory daily BDE updates';

-- =====================================================
-- 5. UNIFIED LEAD DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.unified_lead_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.unified_leads(id) ON DELETE CASCADE,

  -- Document Info
  document_type VARCHAR(100) NOT NULL,
  document_category VARCHAR(50) CHECK (document_category IN (
    'IDENTITY', 'ADDRESS', 'INCOME', 'BANK', 'PROPERTY', 'BUSINESS', 'OTHER'
  )),
  document_name VARCHAR(255) NOT NULL,

  -- File Details
  file_name VARCHAR(500) NOT NULL,
  original_file_name VARCHAR(500),
  file_size_bytes BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  mime_type VARCHAR(200),

  -- Storage
  s3_bucket VARCHAR(255) NOT NULL,
  s3_key VARCHAR(1000) NOT NULL,
  s3_url TEXT,

  -- Compression
  is_compressed BOOLEAN DEFAULT false,
  compression_ratio DECIMAL(5, 2),

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

  -- Expiry
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unified_docs_lead ON public.unified_lead_documents(lead_id);
CREATE INDEX idx_unified_docs_type ON public.unified_lead_documents(document_type);
CREATE INDEX idx_unified_docs_category ON public.unified_lead_documents(document_category);
CREATE INDEX idx_unified_docs_verified ON public.unified_lead_documents(is_verified);
CREATE INDEX idx_unified_docs_required ON public.unified_lead_documents(is_required);

COMMENT ON TABLE public.unified_lead_documents IS 'Documents uploaded for unified leads with S3 storage';

-- =====================================================
-- 6. SLA TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.unified_leads(id) ON DELETE CASCADE,

  -- Stage Info
  stage VARCHAR(50) NOT NULL,
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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

CREATE INDEX idx_sla_tracking_lead ON public.lead_sla_tracking(lead_id);
CREATE INDEX idx_sla_tracking_stage ON public.lead_sla_tracking(stage);
CREATE INDEX idx_sla_tracking_breached ON public.lead_sla_tracking(is_breached);
CREATE INDEX idx_sla_tracking_deadline ON public.lead_sla_tracking(sla_deadline);

COMMENT ON TABLE public.lead_sla_tracking IS 'SLA tracking and breach detection for unified leads';

-- =====================================================
-- 7. FIELD SALES LEADS TABLE (New)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.field_sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(50) UNIQUE NOT NULL, -- FS-2025-000001

  -- Field Sales Rep
  field_sales_id UUID NOT NULL REFERENCES public.employee_profile(id) ON DELETE CASCADE,
  field_sales_name VARCHAR(255) NOT NULL,

  -- Customer Information
  customer_name VARCHAR(255) NOT NULL,
  customer_mobile VARCHAR(15) NOT NULL,
  customer_alternate_mobile VARCHAR(15),
  customer_email VARCHAR(255),
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_state VARCHAR(100),
  customer_pincode VARCHAR(10),
  customer_subrole VARCHAR(50),

  -- Location (Future - Mobile App)
  visit_latitude DECIMAL(10, 8),
  visit_longitude DECIMAL(11, 8),
  visit_address TEXT,
  visit_photos JSONB DEFAULT '[]', -- Array of S3 URLs

  -- Loan Details
  loan_type VARCHAR(100),
  loan_amount DECIMAL(15,2),
  loan_purpose TEXT,
  employment_type VARCHAR(50),
  monthly_income DECIMAL(15,2),
  company_name VARCHAR(255),

  -- Pipeline Stage
  stage VARCHAR(50) NOT NULL DEFAULT 'PROSPECT' CHECK (stage IN (
    'PROSPECT', 'INTERESTED', 'QUALIFIED', 'CONVERTED', 'LOST', 'ON_HOLD'
  )),
  stage_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Notes
  notes_timeline JSONB DEFAULT '[]',

  -- Conversion
  is_converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  unified_lead_id UUID REFERENCES public.unified_leads(id) ON DELETE SET NULL,

  -- Drop Tracking
  is_dropped BOOLEAN DEFAULT false,
  dropped_at TIMESTAMPTZ,
  drop_reason VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_fs_mobile CHECK (customer_mobile ~ '^\+?[0-9]{10,15}$')
);

CREATE INDEX idx_field_sales_leads_id ON public.field_sales_leads(lead_id);
CREATE INDEX idx_field_sales_leads_rep ON public.field_sales_leads(field_sales_id);
CREATE INDEX idx_field_sales_leads_stage ON public.field_sales_leads(stage);
CREATE INDEX idx_field_sales_leads_mobile ON public.field_sales_leads(customer_mobile);
CREATE INDEX idx_field_sales_leads_city ON public.field_sales_leads(customer_city);
CREATE INDEX idx_field_sales_leads_created ON public.field_sales_leads(created_at DESC);
CREATE INDEX idx_field_sales_leads_converted ON public.field_sales_leads(is_converted);

COMMENT ON TABLE public.field_sales_leads IS 'Leads generated by Field Sales from physical visits';
COMMENT ON COLUMN public.field_sales_leads.stage IS 'Field Sales pipeline: PROSPECT → INTERESTED → QUALIFIED → CONVERTED';

-- =====================================================
-- 8. UPDATE DSE_LEADS TABLE (Add New Stages)
-- =====================================================

-- Add new columns to dse_leads for the 6-stage pipeline
ALTER TABLE public.dse_leads
  ADD COLUMN IF NOT EXISTS is_converted_to_unified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS unified_lead_id UUID REFERENCES public.unified_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_to_unified_at TIMESTAMPTZ;

-- Update lead_stage check constraint for DSE 6-stage pipeline
-- Note: This needs to be done carefully to not break existing data
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.dse_leads DROP CONSTRAINT IF EXISTS dse_leads_lead_stage_check;

  -- Add new constraint with 6 stages
  ALTER TABLE public.dse_leads ADD CONSTRAINT dse_leads_lead_stage_check
    CHECK (lead_stage IN (
      'New', 'Contacted', 'Follow_up', 'Qualified', 'Followup', 'Doc_Collection',
      'Converted', 'Lost', 'On_Hold', 'Nurturing',
      -- Keep old stages for backward compatibility during migration
      'Proposal Sent', 'Negotiation', 'Won'
    ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update dse_leads constraint: %', SQLERRM;
END $$;

-- =====================================================
-- 9. UPDATE ONLINE_LEADS TABLE (Add IVR Source)
-- =====================================================

-- Add columns for IVR integration and unified CRM tracking (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'online_leads') THEN
    ALTER TABLE public.online_leads
      ADD COLUMN IF NOT EXISTS source_channel VARCHAR(50) DEFAULT 'chatbot',
      ADD COLUMN IF NOT EXISTS is_ivr_lead BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS ivr_call_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS ivr_call_time TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ivr_provider VARCHAR(50),
      ADD COLUMN IF NOT EXISTS is_converted_to_unified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS unified_lead_id UUID REFERENCES public.unified_leads(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS converted_to_unified_at TIMESTAMPTZ;

    -- Add index for IVR leads
    CREATE INDEX IF NOT EXISTS idx_online_leads_ivr ON public.online_leads(is_ivr_lead);
    CREATE INDEX IF NOT EXISTS idx_online_leads_source_channel ON public.online_leads(source_channel);

    RAISE NOTICE 'Updated online_leads table with unified CRM columns';
  ELSE
    RAISE NOTICE 'online_leads table does not exist - skipping';
  END IF;
END $$;

-- =====================================================
-- 10. UPDATE PARTNER_LEADS TABLE
-- =====================================================

-- Add unified CRM tracking to partner_leads (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partner_leads') THEN
    ALTER TABLE public.partner_leads
      ADD COLUMN IF NOT EXISTS is_converted_to_unified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS unified_lead_id UUID REFERENCES public.unified_leads(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS converted_to_unified_at TIMESTAMPTZ;

    RAISE NOTICE 'Updated partner_leads table with unified CRM columns';
  ELSE
    RAISE NOTICE 'partner_leads table does not exist - skipping';
  END IF;
END $$;

-- =====================================================
-- 11. UPDATE CRM_LEADS TABLE (CRO)
-- =====================================================

-- Check if crm_leads exists and add columns
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_leads') THEN
    ALTER TABLE public.crm_leads
      ADD COLUMN IF NOT EXISTS is_converted_to_unified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS unified_lead_id UUID REFERENCES public.unified_leads(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS converted_to_unified_at TIMESTAMPTZ;

    RAISE NOTICE 'Updated crm_leads table with unified CRM columns';
  ELSE
    RAISE NOTICE 'crm_leads table does not exist - skipping';
  END IF;
END $$;

-- =====================================================
-- 12. SOURCE LEAD TRACKING VIEW
-- =====================================================

-- View for sources to track their converted leads (read-only)
CREATE OR REPLACE VIEW public.source_lead_status_view AS
SELECT
  ul.id,
  ul.lead_number,
  ul.source_type,
  ul.source_lead_id,
  ul.source_user_id,
  ul.source_user_name,
  ul.source_partner_id,
  ul.source_partner_name,
  ul.customer_name,
  ul.customer_mobile,
  ul.loan_type,
  ul.loan_amount,
  ul.current_stage,
  ul.assigned_bde_name,
  ul.outcome,
  ul.outcome_reason_category,
  ul.sanctioned_amount,
  ul.disbursed_amount,
  ul.created_at,
  ul.updated_at,
  ul.converted_at,
  ul.outcome_at,
  -- Simplified status for display
  CASE
    WHEN ul.outcome = 'DISBURSED' THEN 'Loan Disbursed'
    WHEN ul.outcome = 'REJECTED' THEN 'Application Rejected'
    WHEN ul.outcome = 'DROPPED' THEN 'Application Closed'
    WHEN ul.current_stage = 'ASSIGNED' THEN 'Assigned to Executive'
    WHEN ul.current_stage = 'CONTACTED' THEN 'In Contact'
    WHEN ul.current_stage = 'DOC_COLLECTION' THEN 'Collecting Documents'
    WHEN ul.current_stage = 'DOC_VERIFIED' THEN 'Documents Verified'
    WHEN ul.current_stage = 'BANK_LOGIN' THEN 'Submitted to Bank'
    WHEN ul.current_stage = 'BANK_PROCESSING' THEN 'Bank Processing'
    WHEN ul.current_stage = 'SANCTIONED' THEN 'Loan Approved'
    ELSE ul.current_stage
  END AS display_status
FROM public.unified_leads ul
WHERE ul.is_active = true;

COMMENT ON VIEW public.source_lead_status_view IS 'Read-only view for lead sources to track their converted leads';

-- =====================================================
-- 13. DATABASE FUNCTIONS
-- =====================================================

-- Function: Generate Unified Lead Number
CREATE OR REPLACE FUNCTION generate_unified_lead_number()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_number VARCHAR(20);
  max_seq INTEGER;
  year_part VARCHAR(4);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(lead_number FROM 8) AS INTEGER
      )
    ),
    0
  ) INTO max_seq
  FROM public.unified_leads
  WHERE lead_number LIKE 'UL-' || year_part || '-%';

  new_number := 'UL-' || year_part || '-' || LPAD((max_seq + 1)::TEXT, 6, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_unified_lead_number() IS 'Generates sequential unified lead number: UL-2025-000001';

-- Function: Generate Field Sales Lead ID
CREATE OR REPLACE FUNCTION generate_field_sales_lead_id()
RETURNS VARCHAR(50) AS $$
DECLARE
  new_id VARCHAR(50);
  max_seq INTEGER;
  year_part VARCHAR(4);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(lead_id FROM 9) AS INTEGER
      )
    ),
    0
  ) INTO max_seq
  FROM public.field_sales_leads
  WHERE lead_id LIKE 'FS-' || year_part || '-%';

  new_id := 'FS-' || year_part || '-' || LPAD((max_seq + 1)::TEXT, 6, '0');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_field_sales_lead_id() IS 'Generates sequential field sales lead ID: FS-2025-000001';

-- Function: Get SLA Hours for Stage
CREATE OR REPLACE FUNCTION get_sla_hours_for_stage(p_stage VARCHAR(50))
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_stage
    WHEN 'ASSIGNED' THEN 24
    WHEN 'CONTACTED' THEN 48
    WHEN 'DOC_COLLECTION' THEN 168 -- 7 days
    WHEN 'DOC_VERIFIED' THEN 24
    WHEN 'BANK_LOGIN' THEN 24
    WHEN 'BANK_PROCESSING' THEN 360 -- 15 days
    WHEN 'SANCTIONED' THEN 48
    ELSE 48 -- Default 48 hours
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_sla_hours_for_stage(VARCHAR) IS 'Returns SLA hours for each BDE pipeline stage';

-- Function: Get BDE Workload (Unified Leads)
CREATE OR REPLACE FUNCTION get_bde_unified_workload(p_bde_id UUID)
RETURNS INTEGER AS $$
DECLARE
  workload INTEGER;
BEGIN
  SELECT COUNT(*) INTO workload
  FROM public.unified_leads
  WHERE assigned_bde_id = p_bde_id
    AND outcome IS NULL
    AND is_active = true;

  RETURN COALESCE(workload, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bde_unified_workload(UUID) IS 'Returns count of active unified leads assigned to BDE';

-- Function: Get Next BDE for Assignment (Unified)
CREATE OR REPLACE FUNCTION get_next_bde_for_unified_assignment(
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
  RETURN QUERY
  SELECT
    ep.id AS bde_id,
    ep.name AS bde_name,
    ep.email AS bde_email,
    ep.reports_to AS team_lead_id,
    (SELECT name FROM public.employee_profile WHERE id = ep.reports_to) AS team_lead_name,
    get_bde_unified_workload(ep.id) AS current_workload
  FROM public.employee_profile ep
  WHERE ep.subrole = 'BDE'
    AND ep.is_active = true
  ORDER BY get_bde_unified_workload(ep.id) ASC, ep.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_bde_for_unified_assignment(VARCHAR, VARCHAR) IS 'Gets next BDE for assignment based on workload';

-- Function: Convert Lead to Unified CRM
CREATE OR REPLACE FUNCTION convert_to_unified_lead(
  p_source_type VARCHAR(50),
  p_source_lead_id UUID,
  p_source_table VARCHAR(100),
  p_source_user_id UUID,
  p_source_user_name VARCHAR(255),
  p_customer_name VARCHAR(255),
  p_customer_mobile VARCHAR(15),
  p_customer_email VARCHAR(255),
  p_customer_city VARCHAR(100),
  p_customer_state VARCHAR(100),
  p_loan_type VARCHAR(100),
  p_loan_amount DECIMAL(15,2),
  p_employment_type VARCHAR(50) DEFAULT NULL,
  p_monthly_income DECIMAL(15,2) DEFAULT NULL,
  p_source_partner_id UUID DEFAULT NULL,
  p_source_partner_name VARCHAR(255) DEFAULT NULL,
  p_assign_bde_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_referrer_customer_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_unified_lead_id UUID;
  v_lead_number VARCHAR(20);
  v_bde_record RECORD;
  v_sla_hours INTEGER;
BEGIN
  -- Generate lead number
  v_lead_number := generate_unified_lead_number();

  -- Get BDE for assignment if not provided
  IF p_assign_bde_id IS NULL THEN
    SELECT * INTO v_bde_record FROM get_next_bde_for_unified_assignment(p_loan_type, p_customer_city);
  ELSE
    SELECT
      id AS bde_id,
      name AS bde_name,
      reports_to AS team_lead_id,
      (SELECT name FROM public.employee_profile WHERE id = ep.reports_to) AS team_lead_name
    INTO v_bde_record
    FROM public.employee_profile ep
    WHERE id = p_assign_bde_id;
  END IF;

  -- Create unified lead
  INSERT INTO public.unified_leads (
    lead_number,
    source_type,
    source_lead_id,
    source_lead_table,
    source_user_id,
    source_user_name,
    source_partner_id,
    source_partner_name,
    customer_id,
    customer_name,
    customer_mobile,
    customer_email,
    customer_city,
    customer_state,
    loan_type,
    loan_amount,
    employment_type,
    monthly_income,
    current_stage,
    assigned_bde_id,
    assigned_bde_name,
    assigned_at,
    assignment_type,
    bde_team_lead_id,
    bde_team_lead_name,
    referrer_customer_id,
    converted_at
  ) VALUES (
    v_lead_number,
    p_source_type,
    p_source_lead_id,
    p_source_table,
    p_source_user_id,
    p_source_user_name,
    p_source_partner_id,
    p_source_partner_name,
    p_customer_id,
    p_customer_name,
    p_customer_mobile,
    p_customer_email,
    p_customer_city,
    p_customer_state,
    p_loan_type,
    p_loan_amount,
    p_employment_type,
    p_monthly_income,
    'ASSIGNED',
    v_bde_record.bde_id,
    v_bde_record.bde_name,
    NOW(),
    CASE WHEN p_assign_bde_id IS NULL THEN 'AUTO' ELSE 'MANUAL' END,
    v_bde_record.team_lead_id,
    v_bde_record.team_lead_name,
    p_referrer_customer_id,
    NOW()
  )
  RETURNING id INTO v_unified_lead_id;

  -- Create assignment history
  INSERT INTO public.lead_assignment_history (
    lead_id,
    to_bde_id,
    to_bde_name,
    assigned_by_id,
    assigned_by_name,
    assigned_by_role,
    assignment_type,
    bde_workload_at_assignment
  ) VALUES (
    v_unified_lead_id,
    v_bde_record.bde_id,
    v_bde_record.bde_name,
    p_source_user_id,
    p_source_user_name,
    p_source_type,
    CASE WHEN p_assign_bde_id IS NULL THEN 'AUTO' ELSE 'MANUAL' END,
    get_bde_unified_workload(v_bde_record.bde_id) - 1
  );

  -- Create initial stage history
  INSERT INTO public.lead_stage_history (
    lead_id,
    to_stage,
    changed_by_id,
    changed_by_name,
    changed_by_role,
    change_reason
  ) VALUES (
    v_unified_lead_id,
    'ASSIGNED',
    p_source_user_id,
    p_source_user_name,
    p_source_type,
    'Lead converted from ' || p_source_type || ' to Unified CRM'
  );

  -- Create SLA tracking
  v_sla_hours := get_sla_hours_for_stage('ASSIGNED');
  INSERT INTO public.lead_sla_tracking (
    lead_id,
    stage,
    sla_hours,
    sla_deadline
  ) VALUES (
    v_unified_lead_id,
    'ASSIGNED',
    v_sla_hours,
    NOW() + (v_sla_hours || ' hours')::INTERVAL
  );

  RETURN v_unified_lead_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION convert_to_unified_lead IS 'Converts a lead from any source to unified CRM with auto/manual BDE assignment';

-- Function: Update Unified Lead Stage
CREATE OR REPLACE FUNCTION update_unified_lead_stage(
  p_lead_id UUID,
  p_new_stage VARCHAR(50),
  p_changed_by_id UUID,
  p_changed_by_name VARCHAR(255),
  p_changed_by_role VARCHAR(50),
  p_reason TEXT DEFAULT NULL,
  p_outcome_reason_category VARCHAR(100) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_stage VARCHAR(50);
  v_stage_entered_at TIMESTAMPTZ;
  v_time_in_stage INTERVAL;
  v_was_sla_breached BOOLEAN;
  v_sla_hours INTEGER;
BEGIN
  -- Get current stage info
  SELECT current_stage, stage_changed_at INTO v_current_stage, v_stage_entered_at
  FROM public.unified_leads WHERE id = p_lead_id;

  IF v_current_stage IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  -- Calculate time in previous stage
  v_time_in_stage := NOW() - v_stage_entered_at;

  -- Check if SLA was breached
  SELECT is_breached INTO v_was_sla_breached
  FROM public.lead_sla_tracking
  WHERE lead_id = p_lead_id AND stage = v_current_stage
  ORDER BY created_at DESC LIMIT 1;

  -- Update unified lead
  UPDATE public.unified_leads
  SET
    previous_stage = current_stage,
    current_stage = p_new_stage,
    stage_changed_at = NOW(),
    stage_changed_by = p_changed_by_id,
    stage_changed_by_name = p_changed_by_name,
    updated_at = NOW(),
    -- Set outcome fields for terminal stages
    outcome = CASE
      WHEN p_new_stage IN ('DISBURSED', 'REJECTED', 'DROPPED') THEN p_new_stage
      ELSE outcome
    END,
    outcome_at = CASE
      WHEN p_new_stage IN ('DISBURSED', 'REJECTED', 'DROPPED') THEN NOW()
      ELSE outcome_at
    END,
    outcome_reason = CASE
      WHEN p_new_stage IN ('REJECTED', 'DROPPED') THEN p_reason
      ELSE outcome_reason
    END,
    outcome_reason_category = CASE
      WHEN p_new_stage IN ('REJECTED', 'DROPPED') THEN p_outcome_reason_category
      ELSE outcome_reason_category
    END,
    outcome_by = CASE
      WHEN p_new_stage IN ('DISBURSED', 'REJECTED', 'DROPPED') THEN p_changed_by_id
      ELSE outcome_by
    END,
    outcome_by_name = CASE
      WHEN p_new_stage IN ('DISBURSED', 'REJECTED', 'DROPPED') THEN p_changed_by_name
      ELSE outcome_by_name
    END
  WHERE id = p_lead_id;

  -- Create stage history
  INSERT INTO public.lead_stage_history (
    lead_id,
    from_stage,
    to_stage,
    changed_by_id,
    changed_by_name,
    changed_by_role,
    change_reason,
    time_in_previous_stage,
    was_sla_breached
  ) VALUES (
    p_lead_id,
    v_current_stage,
    p_new_stage,
    p_changed_by_id,
    p_changed_by_name,
    p_changed_by_role,
    p_reason,
    v_time_in_stage,
    COALESCE(v_was_sla_breached, false)
  );

  -- Resolve old SLA tracking
  UPDATE public.lead_sla_tracking
  SET is_resolved = true, resolved_at = NOW()
  WHERE lead_id = p_lead_id AND stage = v_current_stage AND is_resolved = false;

  -- Create new SLA tracking (if not terminal stage)
  IF p_new_stage NOT IN ('DISBURSED', 'REJECTED', 'DROPPED') THEN
    v_sla_hours := get_sla_hours_for_stage(p_new_stage);
    INSERT INTO public.lead_sla_tracking (
      lead_id,
      stage,
      sla_hours,
      sla_deadline
    ) VALUES (
      p_lead_id,
      p_new_stage,
      v_sla_hours,
      NOW() + (v_sla_hours || ' hours')::INTERVAL
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_unified_lead_stage IS 'Updates lead stage with full audit trail and SLA tracking';

-- =====================================================
-- 14. TRIGGERS
-- =====================================================

-- Trigger: Auto-generate unified lead number
CREATE OR REPLACE FUNCTION trigger_generate_unified_lead_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_number IS NULL THEN
    NEW.lead_number := generate_unified_lead_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unified_lead_number ON public.unified_leads;
CREATE TRIGGER trigger_unified_lead_number
  BEFORE INSERT ON public.unified_leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_unified_lead_number();

-- Trigger: Auto-generate field sales lead ID
CREATE OR REPLACE FUNCTION trigger_generate_fs_lead_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN
    NEW.lead_id := generate_field_sales_lead_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fs_lead_id ON public.field_sales_leads;
CREATE TRIGGER trigger_fs_lead_id
  BEFORE INSERT ON public.field_sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_fs_lead_id();

-- Trigger: Update timestamps on unified_leads
CREATE OR REPLACE FUNCTION trigger_update_unified_leads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unified_leads_updated ON public.unified_leads;
CREATE TRIGGER trigger_unified_leads_updated
  BEFORE UPDATE ON public.unified_leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_unified_leads_timestamp();

-- Trigger: Update timestamps on field_sales_leads
DROP TRIGGER IF EXISTS trigger_fs_leads_updated ON public.field_sales_leads;
CREATE TRIGGER trigger_fs_leads_updated
  BEFORE UPDATE ON public.field_sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_unified_leads_timestamp();

-- Trigger: Update notes count on unified_leads
CREATE OR REPLACE FUNCTION trigger_update_unified_notes_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.unified_leads
  SET
    notes_count = (SELECT COUNT(*) FROM public.unified_lead_notes WHERE lead_id = NEW.lead_id),
    last_note_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unified_notes_count ON public.unified_lead_notes;
CREATE TRIGGER trigger_unified_notes_count
  AFTER INSERT ON public.unified_lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_unified_notes_count();

-- Trigger: Update document counts on unified_leads
CREATE OR REPLACE FUNCTION trigger_update_unified_doc_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.unified_leads
  SET
    documents_uploaded = (SELECT COUNT(*) FROM public.unified_lead_documents WHERE lead_id = NEW.lead_id),
    documents_verified = (SELECT COUNT(*) FROM public.unified_lead_documents WHERE lead_id = NEW.lead_id AND is_verified = true),
    all_docs_complete = (
      SELECT COUNT(*) = SUM(CASE WHEN is_verified THEN 1 ELSE 0 END)
      FROM public.unified_lead_documents
      WHERE lead_id = NEW.lead_id AND is_required = true
    ),
    updated_at = NOW()
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unified_doc_count_insert ON public.unified_lead_documents;
CREATE TRIGGER trigger_unified_doc_count_insert
  AFTER INSERT ON public.unified_lead_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_unified_doc_count();

DROP TRIGGER IF EXISTS trigger_unified_doc_count_update ON public.unified_lead_documents;
CREATE TRIGGER trigger_unified_doc_count_update
  AFTER UPDATE ON public.unified_lead_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_unified_doc_count();

-- =====================================================
-- 15. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.unified_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_lead_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_sales_leads ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access to unified_leads
-- Note: super_admins uses 'id' as PK (not linked to auth.users), so we check employee_profile for role-based access
CREATE POLICY "Super admin full access on unified_leads"
  ON public.unified_leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- BDE: View and edit own assigned leads
CREATE POLICY "BDE can view assigned unified_leads"
  ON public.unified_leads FOR SELECT
  USING (assigned_bde_id = auth.uid());

CREATE POLICY "BDE can update assigned unified_leads"
  ON public.unified_leads FOR UPDATE
  USING (assigned_bde_id = auth.uid());

-- BDM: View and manage team leads
CREATE POLICY "BDM can view team unified_leads"
  ON public.unified_leads FOR SELECT
  USING (bde_team_lead_id = auth.uid());

CREATE POLICY "BDM can update team unified_leads"
  ON public.unified_leads FOR UPDATE
  USING (bde_team_lead_id = auth.uid());

-- Source users: View only their sourced leads
CREATE POLICY "Source can view own unified_leads"
  ON public.unified_leads FOR SELECT
  USING (source_user_id = auth.uid() OR source_partner_id = auth.uid());

-- Stage history: View for relevant users
CREATE POLICY "Users can view stage history of accessible leads"
  ON public.lead_stage_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND (ul.assigned_bde_id = auth.uid()
           OR ul.bde_team_lead_id = auth.uid()
           OR ul.source_user_id = auth.uid()
           OR ul.source_partner_id = auth.uid())
    )
  );

-- System can insert stage history
CREATE POLICY "System can insert stage history"
  ON public.lead_stage_history FOR INSERT
  WITH CHECK (true);

-- Assignment history policies
CREATE POLICY "Users can view assignment history of accessible leads"
  ON public.lead_assignment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND (ul.assigned_bde_id = auth.uid()
           OR ul.bde_team_lead_id = auth.uid()
           OR ul.source_user_id = auth.uid())
    )
  );

CREATE POLICY "System can insert assignment history"
  ON public.lead_assignment_history FOR INSERT
  WITH CHECK (true);

-- Notes policies
CREATE POLICY "BDE can manage notes on assigned leads"
  ON public.unified_lead_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id AND ul.assigned_bde_id = auth.uid()
    )
  );

CREATE POLICY "BDM can view team notes"
  ON public.unified_lead_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id AND ul.bde_team_lead_id = auth.uid()
    )
  );

-- Documents policies
CREATE POLICY "BDE can manage documents on assigned leads"
  ON public.unified_lead_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id AND ul.assigned_bde_id = auth.uid()
    )
  );

-- SLA tracking policies
CREATE POLICY "BDE can view SLA on assigned leads"
  ON public.lead_sla_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id AND ul.assigned_bde_id = auth.uid()
    )
  );

CREATE POLICY "System can manage SLA tracking"
  ON public.lead_sla_tracking FOR ALL
  USING (true);

-- Field Sales leads policies
CREATE POLICY "Field Sales can manage own leads"
  ON public.field_sales_leads FOR ALL
  USING (field_sales_id = auth.uid());

CREATE POLICY "Super admin full access on field_sales_leads"
  ON public.field_sales_leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- =====================================================
-- 16. MIGRATION COMPLETE
-- =====================================================

-- Add migration tracking
INSERT INTO public.migrations (name, executed_at)
VALUES ('011_unified_leads_crm', NOW())
ON CONFLICT DO NOTHING;

COMMENT ON SCHEMA public IS 'Unified Leads CRM System v1.0.0 - Centralized lead management';
