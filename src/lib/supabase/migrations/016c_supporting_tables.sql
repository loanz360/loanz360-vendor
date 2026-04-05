-- =====================================================
-- MIGRATION: 016c_supporting_tables.sql
-- PURPOSE: Create supporting tables (history, notes, documents, SLA)
-- RUN ORDER: 3 of 5
-- =====================================================

-- =====================================================
-- LEADS STAGE HISTORY TABLE (Immutable Audit)
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
-- LEADS ASSIGNMENT HISTORY TABLE (Immutable)
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
  assignment_criteria JSONB,

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
-- LEADS SLA TRACKING TABLE
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
-- LEADS NOTES TABLE
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
-- LEADS DOCUMENTS TABLE
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
-- END OF MIGRATION 016c
-- =====================================================
