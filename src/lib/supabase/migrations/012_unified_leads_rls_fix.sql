-- =====================================================
-- UNIFIED LEADS CRM - RLS POLICY FIX
-- Version: 1.0.1
-- Date: 2025-01-11
-- Purpose: Fix RLS policies to use employee_profile.user_id mapping
-- =====================================================

-- Drop existing policies that use incorrect column references
DROP POLICY IF EXISTS "BDE can view assigned unified_leads" ON public.unified_leads;
DROP POLICY IF EXISTS "BDE can update assigned unified_leads" ON public.unified_leads;
DROP POLICY IF EXISTS "BDM can view team unified_leads" ON public.unified_leads;
DROP POLICY IF EXISTS "BDM can update team unified_leads" ON public.unified_leads;
DROP POLICY IF EXISTS "Source can view own unified_leads" ON public.unified_leads;

-- =====================================================
-- 1. UNIFIED_LEADS - Fixed RLS Policies
-- =====================================================

-- BDE: View assigned leads (using employee_profile mapping)
CREATE POLICY "BDE can view assigned unified_leads"
  ON public.unified_leads FOR SELECT
  USING (
    assigned_bde_id IN (
      SELECT id FROM public.employee_profile WHERE user_id = auth.uid()
    )
  );

-- BDE: Update assigned leads
CREATE POLICY "BDE can update assigned unified_leads"
  ON public.unified_leads FOR UPDATE
  USING (
    assigned_bde_id IN (
      SELECT id FROM public.employee_profile WHERE user_id = auth.uid()
    )
  );

-- BDM/Team Lead: View team leads
CREATE POLICY "BDM can view team unified_leads"
  ON public.unified_leads FOR SELECT
  USING (
    bde_team_lead_id IN (
      SELECT id FROM public.employee_profile WHERE user_id = auth.uid()
    )
  );

-- BDM/Team Lead: Update team leads
CREATE POLICY "BDM can update team unified_leads"
  ON public.unified_leads FOR UPDATE
  USING (
    bde_team_lead_id IN (
      SELECT id FROM public.employee_profile WHERE user_id = auth.uid()
    )
  );

-- Source users: View their sourced leads (read-only)
CREATE POLICY "Source can view own unified_leads"
  ON public.unified_leads FOR SELECT
  USING (
    source_user_id = auth.uid()
    OR source_partner_id IN (
      SELECT id FROM public.partners WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 2. STAGE HISTORY - Add Super Admin Policy
-- =====================================================

DROP POLICY IF EXISTS "Users can view stage history of accessible leads" ON public.lead_stage_history;

-- Super Admin can view all stage history
CREATE POLICY "Super admin can view all stage history"
  ON public.lead_stage_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Users can view stage history of accessible leads
CREATE POLICY "Users can view stage history of accessible leads"
  ON public.lead_stage_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND (
        ul.assigned_bde_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
        OR ul.bde_team_lead_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
        OR ul.source_user_id = auth.uid()
        OR ul.source_partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
      )
    )
  );

-- =====================================================
-- 3. ASSIGNMENT HISTORY - Add Super Admin Policy
-- =====================================================

DROP POLICY IF EXISTS "Users can view assignment history of accessible leads" ON public.lead_assignment_history;

-- Super Admin can view all assignment history
CREATE POLICY "Super admin can view all assignment history"
  ON public.lead_assignment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Users can view assignment history of accessible leads
CREATE POLICY "Users can view assignment history of accessible leads"
  ON public.lead_assignment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND (
        ul.assigned_bde_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
        OR ul.bde_team_lead_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
        OR ul.source_user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- 4. NOTES - Add Super Admin and BDM Policies
-- =====================================================

DROP POLICY IF EXISTS "BDE can manage notes on assigned leads" ON public.unified_lead_notes;
DROP POLICY IF EXISTS "BDM can view team notes" ON public.unified_lead_notes;

-- Super Admin full access to notes
CREATE POLICY "Super admin full access on notes"
  ON public.unified_lead_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- BDE can manage notes on assigned leads
CREATE POLICY "BDE can manage notes on assigned leads"
  ON public.unified_lead_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND ul.assigned_bde_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
    )
  );

-- BDM can view and add notes for team leads
CREATE POLICY "BDM can manage team notes"
  ON public.unified_lead_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND ul.bde_team_lead_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- 5. DOCUMENTS - Add Super Admin and BDM Policies
-- =====================================================

DROP POLICY IF EXISTS "BDE can manage documents on assigned leads" ON public.unified_lead_documents;

-- Super Admin full access to documents
CREATE POLICY "Super admin full access on documents"
  ON public.unified_lead_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- BDE can manage documents on assigned leads
CREATE POLICY "BDE can manage documents on assigned leads"
  ON public.unified_lead_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND ul.assigned_bde_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
    )
  );

-- BDM can view documents for team leads
CREATE POLICY "BDM can view team documents"
  ON public.unified_lead_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND ul.bde_team_lead_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
    )
  );

-- =====================================================
-- 6. SLA TRACKING - Add Super Admin and User Policies
-- =====================================================

DROP POLICY IF EXISTS "BDE can view SLA on assigned leads" ON public.lead_sla_tracking;
DROP POLICY IF EXISTS "System can manage SLA tracking" ON public.lead_sla_tracking;

-- Super Admin full access to SLA tracking
CREATE POLICY "Super admin full access on SLA tracking"
  ON public.lead_sla_tracking FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profile WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- BDE can view SLA on assigned leads
CREATE POLICY "BDE can view SLA on assigned leads"
  ON public.lead_sla_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND ul.assigned_bde_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
    )
  );

-- BDM can view SLA for team leads
CREATE POLICY "BDM can view team SLA"
  ON public.lead_sla_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_leads ul
      WHERE ul.id = lead_id
      AND ul.bde_team_lead_id IN (SELECT id FROM public.employee_profile WHERE user_id = auth.uid())
    )
  );

-- System can insert/update SLA tracking (for automated processes)
CREATE POLICY "System can insert SLA tracking"
  ON public.lead_sla_tracking FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update SLA tracking"
  ON public.lead_sla_tracking FOR UPDATE
  USING (true);

-- =====================================================
-- 7. FIELD SALES LEADS - Add BDM Visibility
-- =====================================================

-- Note: BDM visibility for field_sales_leads requires profiles.reporting_manager_id
-- which links to employees table, not employee_profile.
-- For now, Super Admin has full access via the existing policy in 011_unified_leads_crm.sql
-- BDM access to field sales leads is handled via the unified_leads table after conversion

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE public.unified_leads IS 'Unified Leads CRM with proper RLS for BDE/BDM/Source isolation';
