-- =====================================================
-- MIGRATION: 016e_rls_views.sql
-- PURPOSE: RLS policies and views
-- RUN ORDER: 5 of 5
-- =====================================================

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- is_super_admin FUNCTION (only create if not exists)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin') THEN
    EXECUTE $func$
      CREATE FUNCTION is_super_admin(user_uuid UUID)
      RETURNS BOOLEAN AS $body$
      DECLARE
        is_admin BOOLEAN := false;
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
          SELECT EXISTS(SELECT 1 FROM public.users WHERE id = user_uuid AND role = 'SUPER_ADMIN') INTO is_admin;
          IF is_admin THEN RETURN true; END IF;
        END IF;

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

-- =====================================================
-- LEADS RLS POLICIES
-- =====================================================

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

-- Customer: View own applications
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

DO $$
BEGIN
  DROP POLICY IF EXISTS "Super admin full access on system_settings" ON public.system_settings;
  DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.system_settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Super admin full access on system_settings"
  ON public.system_settings FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can read settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- HISTORY TABLES RLS POLICIES
-- =====================================================

-- Stage history
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

-- Assignment history
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

-- SLA tracking
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

-- Notes
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

-- Documents
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
-- VIEWS FOR COMMON QUERIES
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
-- MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('016_unified_leads_single_table', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.leads.lead_number IS 'Unique lead identifier: UL-YYYY-XXXXXX';
COMMENT ON COLUMN public.leads.source_type IS 'Lead source: ULAP_BA, ULAP_BP, CRO, DSE, etc.';
COMMENT ON COLUMN public.leads.lead_generator_id IS 'User ID of the person who generated/submitted the lead';
COMMENT ON COLUMN public.leads.lead_status IS 'Current lifecycle status: NEW → PHASE_1 → PHASE_2 → CAM → ASSIGNED → ... → DISBURSED';
COMMENT ON COLUMN public.leads.cam_status IS 'CAM processing status: NOT_REQUIRED, PENDING, PROCESSING, COMPLETED, FAILED, SKIPPED';
COMMENT ON COLUMN public.leads.collected_data IS 'JSONB field for dynamic form data based on loan type/category';
COMMENT ON COLUMN public.leads.phase_1_data IS 'Phase 1 specific collected data';
COMMENT ON COLUMN public.leads.phase_2_data IS 'Phase 2 specific collected data based on loan type profile';

-- =====================================================
-- END OF MIGRATION 016e
-- =====================================================
