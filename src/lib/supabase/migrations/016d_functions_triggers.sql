-- =====================================================
-- MIGRATION: 016d_functions_triggers.sql
-- PURPOSE: Database functions and triggers
-- RUN ORDER: 4 of 5
-- =====================================================

-- =====================================================
-- DATABASE FUNCTIONS
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
    WHEN 'PHASE_1_SUBMITTED' THEN 24
    WHEN 'PHASE_2_SUBMITTED' THEN 4
    WHEN 'CAM_PENDING' THEN 4
    WHEN 'PENDING_ASSIGNMENT' THEN 2
    WHEN 'ASSIGNED' THEN 24
    WHEN 'CONTACTED' THEN 48
    WHEN 'DOC_COLLECTION' THEN 168
    WHEN 'DOC_VERIFIED' THEN 24
    WHEN 'BANK_LOGIN' THEN 24
    WHEN 'BANK_PROCESSING' THEN 360
    WHEN 'SANCTIONED' THEN 48
    ELSE 48
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

-- Function: Get Next BDE for Assignment (safe version)
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
      AND (p_loan_type IS NULL OR array_length(bac.loan_types, 1) IS NULL
           OR p_loan_type = ANY(bac.loan_types))
      AND (p_city IS NULL OR array_length(bac.locations, 1) IS NULL
           OR p_city = ANY(bac.locations))
    ORDER BY
      CASE
        WHEN p_loan_type = ANY(bac.loan_types) AND p_city = ANY(bac.locations) THEN 0
        WHEN p_loan_type = ANY(bac.loan_types) THEN 1
        WHEN p_city = ANY(bac.locations) THEN 2
        ELSE 3
      END,
      get_bde_leads_workload(bac.bde_id) ASC,
      bac.priority_weight DESC,
      bac.success_rate DESC NULLS LAST
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_bde_for_lead_assignment(VARCHAR, VARCHAR) IS 'Gets next BDE for assignment based on loan type, location, and workload';

-- =====================================================
-- TRIGGERS
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
      NULL,
      NEW.status_changed_at - OLD.status_changed_at
    );

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
-- END OF MIGRATION 016d
-- =====================================================
