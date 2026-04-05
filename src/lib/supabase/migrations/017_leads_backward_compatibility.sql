-- =====================================================
-- MIGRATION: 017_leads_backward_compatibility.sql
-- PURPOSE: Backward compatibility views for legacy table references
-- DATE: 2025-01-16
-- AUTHOR: Senior Architect - World-Class Implementation
-- =====================================================
--
-- This migration creates views that maintain compatibility with
-- existing code that references partner_leads and unified_leads tables.
-- These views point to the new unified leads table.
-- =====================================================

-- =====================================================
-- 0. DROP EXISTING VIEWS (to handle column type changes)
-- =====================================================
DROP VIEW IF EXISTS public.partner_leads_view CASCADE;
DROP VIEW IF EXISTS public.unified_leads_view CASCADE;
DROP VIEW IF EXISTS public.unified_crm_leads CASCADE;
DROP VIEW IF EXISTS public.source_lead_status_view CASCADE;
DROP VIEW IF EXISTS public.customer_applications_view CASCADE;
DROP VIEW IF EXISTS public.bde_assigned_leads_view CASCADE;
DROP VIEW IF EXISTS public.cam_pending_leads_view CASCADE;
DROP VIEW IF EXISTS public.leads_pipeline_analytics CASCADE;

-- =====================================================
-- 1. PARTNER_LEADS COMPATIBILITY VIEW
-- =====================================================
-- This view mimics the old partner_leads table structure

CREATE VIEW public.partner_leads_view AS
SELECT
  l.id,
  l.lead_generator_id AS partner_id,
  CASE
    WHEN l.source_type IN ('ULAP_BA') THEN 'BUSINESS_ASSOCIATE'
    WHEN l.source_type IN ('ULAP_BP') THEN 'BUSINESS_PARTNER'
    WHEN l.source_type IN ('ULAP_EMPLOYEE') THEN 'EMPLOYEE'
    WHEN l.source_type IN ('ULAP_CUSTOMER_REFERRAL') THEN 'CUSTOMER_REFERRAL'
    ELSE 'SELF_APPLICATION'
  END AS partner_type,
  l.lead_number AS lead_id,
  l.lead_number,
  l.customer_name,
  l.customer_mobile,
  l.customer_email,
  l.customer_city,
  l.customer_pincode,
  l.customer_pan,
  l.customer_dob,
  l.customer_gender,
  l.has_co_applicant,
  l.co_applicant_name,
  l.co_applicant_mobile,
  l.co_applicant_email,
  l.co_applicant_relationship,
  l.loan_type,
  l.loan_amount AS required_loan_amount,
  l.loan_category_id,
  l.loan_category_code,
  l.loan_subcategory_id,
  l.loan_subcategory_code,
  l.form_status,
  l.form_completion_percentage,
  l.phase_1_submitted_at AS form_submitted_at,
  l.application_phase,
  l.source_type AS form_source,
  l.lead_generator_role AS source_partner_type,
  l.source_partner_name AS partner_name,
  l.short_link,
  l.short_code,
  l.trace_token,
  l.shared_via_whatsapp,
  l.whatsapp_sent_count,
  l.last_whatsapp_sent_at,
  l.lead_status,
  l.lead_priority,
  -- Conversion tracking - now points to same table
  CASE WHEN l.assigned_bde_id IS NOT NULL THEN true ELSE false END AS converted,
  l.customer_id AS converted_to_customer_id,
  NULL::UUID AS converted_to_application_id,
  l.assigned_at AS converted_at,
  -- Unified tracking
  CASE WHEN l.assigned_bde_id IS NOT NULL THEN true ELSE false END AS is_converted_to_unified,
  l.id AS unified_lead_id,
  l.assigned_at AS converted_to_unified_at,
  -- CAM tracking
  l.cam_status,
  l.cam_completed_at AS cam_generated_at,
  -- Metadata
  l.collected_data,
  l.remarks,
  l.tags,
  l.created_at,
  l.updated_at
FROM public.leads l
WHERE l.source_type IN (
  'ULAP_BA', 'ULAP_BP', 'ULAP_EMPLOYEE',
  'ULAP_CUSTOMER_REFERRAL', 'ULAP_PUBLIC'
)
AND l.is_active = true;

COMMENT ON VIEW public.partner_leads_view IS 'Backward compatibility view for partner_leads table. Points to unified leads table.';

-- =====================================================
-- 2. UNIFIED_LEADS COMPATIBILITY VIEW
-- =====================================================
-- This view mimics the old unified_leads table structure

CREATE VIEW public.unified_leads_view AS
SELECT
  l.id,
  l.lead_number,
  l.source_type,
  NULL::UUID AS source_lead_id,  -- No longer needed - same table
  'leads' AS source_lead_table,
  l.lead_generator_id AS source_user_id,
  l.lead_generator_name AS source_user_name,
  l.source_partner_id,
  l.source_partner_name,
  l.trace_token,
  l.customer_id,
  l.customer_name,
  l.customer_mobile,
  l.customer_alternate_mobile,
  l.customer_email,
  l.customer_city,
  l.customer_state,
  l.customer_pincode,
  l.customer_address,
  l.customer_subrole,
  l.loan_type,
  l.loan_amount,
  l.loan_purpose,
  l.loan_tenure_months,
  l.employment_type,
  l.monthly_income,
  l.company_name,
  -- Map lead_status to current_stage
  CASE
    WHEN l.lead_status IN ('ASSIGNED', 'CONTACTED', 'DOC_COLLECTION', 'DOC_VERIFIED',
                           'BANK_LOGIN', 'BANK_PROCESSING', 'SANCTIONED', 'DISBURSED',
                           'REJECTED', 'DROPPED') THEN l.lead_status
    WHEN l.lead_status = 'PENDING_ASSIGNMENT' THEN 'ASSIGNED'
    ELSE 'ASSIGNED'
  END AS current_stage,
  l.previous_status AS previous_stage,
  l.status_changed_at AS stage_changed_at,
  l.status_changed_by AS stage_changed_by,
  l.status_changed_by_name AS stage_changed_by_name,
  l.assigned_bde_id,
  l.assigned_bde_name,
  l.assigned_at,
  l.assignment_type,
  l.assignment_rule_id,
  l.bde_team_lead_id,
  l.bde_team_lead_name,
  CASE WHEN l.lead_priority = 'URGENT' OR l.lead_priority = 'HIGH' THEN true ELSE false END AS is_priority,
  l.lead_priority AS priority_level,
  l.lead_score,
  l.lead_quality,
  l.documents_required,
  l.documents_uploaded,
  l.documents_verified,
  l.all_docs_complete,
  l.last_contacted_at,
  l.contact_attempts,
  l.last_note_at,
  l.notes_count,
  l.outcome,
  l.outcome_at,
  l.outcome_reason,
  l.outcome_reason_category,
  l.outcome_by,
  l.outcome_by_name,
  l.sanctioned_amount,
  l.sanctioned_at,
  l.sanctioned_bank,
  l.sanctioned_bank_branch,
  l.bank_login_id,
  l.bank_login_date,
  l.disbursed_amount,
  l.disbursed_at,
  l.disbursement_reference,
  l.sla_stage_deadline,
  l.sla_breached,
  l.sla_breach_count,
  l.commission_eligible,
  l.commission_amount,
  l.commission_status,
  l.commission_paid_at,
  l.referrer_customer_id,
  l.referral_points_awarded,
  l.tags,
  l.custom_fields,
  l.created_at,
  l.updated_at,
  l.assigned_at AS converted_at,
  l.is_active,
  l.deleted_at,
  l.deleted_by
FROM public.leads l
WHERE l.assigned_bde_id IS NOT NULL  -- Only assigned leads
  AND l.is_active = true;

COMMENT ON VIEW public.unified_leads_view IS 'Backward compatibility view for unified_leads table. Points to unified leads table.';

-- =====================================================
-- 3. UNIFIED CRM LEADS VIEW (Updated from migration 013)
-- =====================================================

CREATE VIEW public.unified_crm_leads AS
SELECT
  l.id,
  l.lead_number,
  l.customer_name,
  l.customer_mobile,
  l.customer_email,
  l.customer_city,
  l.customer_pincode,
  l.customer_gender,
  l.loan_type,
  l.loan_category_code,
  l.loan_subcategory_code,
  l.lead_status,
  l.form_status,
  l.application_phase,
  l.source_type AS form_source,
  l.lead_generator_role AS source_partner_type,
  l.source_partner_id AS partner_id,
  l.source_partner_name AS partner_name,
  l.has_co_applicant,
  l.assigned_bde_id,
  l.assigned_bde_name,
  l.cam_status,
  l.cam_credit_score,
  l.cam_risk_grade,
  l.cam_recommendation,
  l.created_at,
  l.updated_at,
  -- Simplified status for display
  CASE
    WHEN l.lead_status = 'NEW' THEN 'New Lead'
    WHEN l.lead_status = 'PHASE_1_SUBMITTED' THEN 'Phase 1 Complete'
    WHEN l.lead_status = 'PHASE_2_IN_PROGRESS' THEN 'Phase 2 In Progress'
    WHEN l.lead_status = 'PHASE_2_SUBMITTED' THEN 'Phase 2 Complete'
    WHEN l.lead_status = 'CAM_PENDING' THEN 'CAM Pending'
    WHEN l.lead_status = 'CAM_PROCESSING' THEN 'CAM Processing'
    WHEN l.lead_status = 'CAM_COMPLETED' THEN 'CAM Completed'
    WHEN l.lead_status = 'CAM_FAILED' THEN 'CAM Failed'
    WHEN l.lead_status = 'PENDING_ASSIGNMENT' THEN 'Pending Assignment'
    WHEN l.lead_status = 'ASSIGNED' THEN 'Assigned to BDE'
    WHEN l.lead_status = 'CONTACTED' THEN 'Customer Contacted'
    WHEN l.lead_status = 'DOC_COLLECTION' THEN 'Collecting Documents'
    WHEN l.lead_status = 'DOC_VERIFIED' THEN 'Documents Verified'
    WHEN l.lead_status = 'BANK_LOGIN' THEN 'Submitted to Bank'
    WHEN l.lead_status = 'BANK_PROCESSING' THEN 'Bank Processing'
    WHEN l.lead_status = 'SANCTIONED' THEN 'Loan Approved'
    WHEN l.lead_status = 'DISBURSED' THEN 'Loan Disbursed'
    WHEN l.lead_status = 'REJECTED' THEN 'Application Rejected'
    WHEN l.lead_status = 'DROPPED' THEN 'Dropped'
    WHEN l.lead_status = 'ON_HOLD' THEN 'On Hold'
    ELSE l.lead_status
  END AS display_status
FROM public.leads l
WHERE l.is_active = true;

COMMENT ON VIEW public.unified_crm_leads IS 'View for all leads in Unified CRM with display-friendly status';

-- =====================================================
-- 4. SOURCE LEAD STATUS VIEW (For stakeholders)
-- =====================================================
-- Read-only view for lead sources to track their converted leads

CREATE VIEW public.source_lead_status_view AS
SELECT
  l.id,
  l.lead_number,
  l.source_type,
  l.lead_generator_id AS source_user_id,
  l.lead_generator_name AS source_user_name,
  l.source_partner_id,
  l.source_partner_name,
  l.customer_name,
  l.customer_mobile,
  l.loan_type,
  l.loan_amount,
  l.lead_status,
  CASE
    WHEN l.lead_status IN ('ASSIGNED', 'CONTACTED', 'DOC_COLLECTION', 'DOC_VERIFIED',
                           'BANK_LOGIN', 'BANK_PROCESSING', 'SANCTIONED', 'DISBURSED',
                           'REJECTED', 'DROPPED') THEN l.lead_status
    ELSE 'IN_PROGRESS'
  END AS current_stage,
  l.assigned_bde_name,
  l.outcome,
  l.outcome_reason_category,
  l.sanctioned_amount,
  l.disbursed_amount,
  l.created_at,
  l.updated_at,
  l.assigned_at AS converted_at,
  l.outcome_at,
  -- Simplified status for display
  CASE
    WHEN l.outcome = 'DISBURSED' THEN 'Loan Disbursed'
    WHEN l.outcome = 'REJECTED' THEN 'Application Rejected'
    WHEN l.outcome = 'DROPPED' THEN 'Application Closed'
    WHEN l.lead_status IN ('CAM_PENDING', 'CAM_PROCESSING') THEN 'Under Review'
    WHEN l.lead_status = 'PENDING_ASSIGNMENT' THEN 'Processing'
    WHEN l.lead_status = 'ASSIGNED' THEN 'Assigned to Executive'
    WHEN l.lead_status = 'CONTACTED' THEN 'In Contact'
    WHEN l.lead_status = 'DOC_COLLECTION' THEN 'Collecting Documents'
    WHEN l.lead_status = 'DOC_VERIFIED' THEN 'Documents Verified'
    WHEN l.lead_status = 'BANK_LOGIN' THEN 'Submitted to Bank'
    WHEN l.lead_status = 'BANK_PROCESSING' THEN 'Bank Processing'
    WHEN l.lead_status = 'SANCTIONED' THEN 'Loan Approved'
    ELSE 'In Progress'
  END AS display_status
FROM public.leads l
WHERE l.is_active = true;

COMMENT ON VIEW public.source_lead_status_view IS 'Read-only view for lead sources (stakeholders) to track their leads';

-- =====================================================
-- 5. CUSTOMER MY APPLICATIONS VIEW
-- =====================================================
-- View for customers to see their loan applications

CREATE VIEW public.customer_applications_view AS
SELECT
  l.id AS application_id,
  l.lead_number,
  l.loan_type,
  l.loan_amount,
  l.loan_purpose,
  l.lead_status AS status,
  l.form_status,
  l.form_completion_percentage AS progress_percentage,
  l.created_at AS applied_at,
  l.updated_at AS last_updated,
  l.assigned_bde_name,
  l.documents_uploaded AS document_count,
  l.notes_count AS note_count,
  -- Can customer continue application
  CASE
    WHEN l.lead_status IN ('NEW', 'PHASE_1_SUBMITTED', 'PHASE_2_IN_PROGRESS') THEN true
    ELSE false
  END AS can_proceed_to_detailed,
  -- Simplified status for display
  CASE
    WHEN l.outcome = 'DISBURSED' THEN 'Loan Disbursed'
    WHEN l.outcome = 'REJECTED' THEN 'Application Rejected'
    WHEN l.outcome = 'DROPPED' THEN 'Application Closed'
    WHEN l.lead_status = 'NEW' THEN 'Application Started'
    WHEN l.lead_status = 'PHASE_1_SUBMITTED' THEN 'Basic Info Submitted'
    WHEN l.lead_status = 'PHASE_2_IN_PROGRESS' THEN 'Completing Details'
    WHEN l.lead_status = 'PHASE_2_SUBMITTED' THEN 'Application Submitted'
    WHEN l.lead_status IN ('CAM_PENDING', 'CAM_PROCESSING') THEN 'Under Review'
    WHEN l.lead_status = 'PENDING_ASSIGNMENT' THEN 'Processing'
    WHEN l.lead_status = 'ASSIGNED' THEN 'Assigned to Executive'
    WHEN l.lead_status = 'CONTACTED' THEN 'Executive Contacted'
    WHEN l.lead_status = 'DOC_COLLECTION' THEN 'Documents Needed'
    WHEN l.lead_status = 'DOC_VERIFIED' THEN 'Documents Verified'
    WHEN l.lead_status = 'BANK_LOGIN' THEN 'Submitted to Bank'
    WHEN l.lead_status = 'BANK_PROCESSING' THEN 'Bank Processing'
    WHEN l.lead_status = 'SANCTIONED' THEN 'Loan Approved!'
    ELSE 'In Progress'
  END AS display_status,
  -- Customer info (for verification)
  l.customer_id,
  l.customer_mobile,
  l.customer_name
FROM public.leads l
WHERE l.is_active = true;

COMMENT ON VIEW public.customer_applications_view IS 'View for customers to track their loan applications';

-- =====================================================
-- 6. BDE ASSIGNED LEADS VIEW
-- =====================================================
-- View for BDEs to see their assigned leads

CREATE VIEW public.bde_assigned_leads_view AS
SELECT
  l.id,
  l.lead_number,
  l.customer_name,
  l.customer_mobile,
  l.customer_email,
  l.customer_city,
  l.loan_type,
  l.loan_amount,
  l.lead_status,
  l.lead_priority,
  l.lead_quality,
  l.lead_score,
  l.assigned_at,
  l.last_contacted_at,
  l.contact_attempts,
  l.notes_count,
  l.documents_uploaded,
  l.documents_verified,
  l.all_docs_complete,
  l.sla_stage_deadline,
  l.sla_breached,
  l.cam_credit_score,
  l.cam_risk_grade,
  l.cam_recommendation,
  l.source_type,
  l.source_partner_name,
  l.created_at,
  l.updated_at,
  -- Days since assignment
  EXTRACT(DAY FROM (NOW() - l.assigned_at)) AS days_since_assignment,
  -- SLA status
  CASE
    WHEN l.sla_stage_deadline < NOW() THEN 'BREACHED'
    WHEN l.sla_stage_deadline < NOW() + INTERVAL '2 hours' THEN 'AT_RISK'
    ELSE 'ON_TRACK'
  END AS sla_status,
  l.assigned_bde_id,
  l.assigned_bde_name,
  l.bde_team_lead_id,
  l.bde_team_lead_name
FROM public.leads l
WHERE l.assigned_bde_id IS NOT NULL
  AND l.outcome IS NULL
  AND l.is_active = true;

COMMENT ON VIEW public.bde_assigned_leads_view IS 'View for BDEs to see their active assigned leads with SLA status';

-- =====================================================
-- 7. CAM PENDING LEADS VIEW
-- =====================================================
-- View for CAE processing queue

CREATE VIEW public.cam_pending_leads_view AS
SELECT
  l.id,
  l.lead_number,
  l.customer_name,
  l.customer_mobile,
  l.customer_pan,
  l.customer_email,
  l.customer_city,
  l.customer_state,
  l.loan_type,
  l.loan_amount,
  l.employment_type,
  l.monthly_income,
  l.company_name,
  l.cam_status,
  l.cam_initiated_at,
  l.cam_retry_count,
  l.cam_error_message,
  l.source_type,
  l.source_partner_name,
  l.lead_generator_name,
  l.created_at,
  l.phase_2_submitted_at,
  -- Time waiting for CAM
  EXTRACT(EPOCH FROM (NOW() - COALESCE(l.cam_initiated_at, l.phase_2_submitted_at))) / 60 AS minutes_waiting
FROM public.leads l
WHERE l.cam_required = true
  AND l.cam_status IN ('PENDING', 'PROCESSING', 'FAILED')
  AND l.is_active = true
ORDER BY
  -- Priority: Failed first (for retry), then oldest pending
  CASE l.cam_status WHEN 'FAILED' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,
  l.phase_2_submitted_at ASC;

COMMENT ON VIEW public.cam_pending_leads_view IS 'Queue of leads pending CAM processing';

-- =====================================================
-- 8. LEADS PIPELINE ANALYTICS VIEW
-- =====================================================
-- View for pipeline analytics

CREATE VIEW public.leads_pipeline_analytics AS
SELECT
  DATE_TRUNC('day', l.created_at) AS date,
  l.source_type,
  l.loan_type,
  l.customer_city,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE l.lead_status = 'PHASE_2_SUBMITTED') AS phase_2_completed,
  COUNT(*) FILTER (WHERE l.cam_status = 'COMPLETED') AS cam_completed,
  COUNT(*) FILTER (WHERE l.assigned_bde_id IS NOT NULL) AS assigned_to_bde,
  COUNT(*) FILTER (WHERE l.outcome = 'DISBURSED') AS disbursed,
  COUNT(*) FILTER (WHERE l.outcome = 'REJECTED') AS rejected,
  COUNT(*) FILTER (WHERE l.outcome = 'DROPPED') AS dropped,
  SUM(l.loan_amount) AS total_loan_amount,
  SUM(l.disbursed_amount) FILTER (WHERE l.outcome = 'DISBURSED') AS total_disbursed_amount,
  AVG(EXTRACT(EPOCH FROM (l.outcome_at - l.created_at)) / 86400) FILTER (WHERE l.outcome = 'DISBURSED') AS avg_days_to_disbursal
FROM public.leads l
WHERE l.is_active = true
GROUP BY
  DATE_TRUNC('day', l.created_at),
  l.source_type,
  l.loan_type,
  l.customer_city;

COMMENT ON VIEW public.leads_pipeline_analytics IS 'Analytics view for leads pipeline performance';

-- =====================================================
-- 9. MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('017_leads_backward_compatibility', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
