-- ============================================================================
-- Email System Enterprise Enhancements
-- Version: 2.0.0
-- Features:
-- - Extensible Third-Party Provider Integration
-- - Account Lifecycle Management
-- - Department Policies
-- - Approval Workflows
-- - Shared Mailboxes & Aliases
-- - Compliance Features
-- ============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. THIRD-PARTY PROVIDER API KEYS (Extensible Provider System)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_provider_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Provider Identification
  provider_name VARCHAR(100) NOT NULL, -- 'zoho', 'google', 'microsoft', 'sendgrid', 'mailgun', 'custom_smtp'
  provider_type VARCHAR(50) NOT NULL DEFAULT 'email_service', -- 'email_service', 'transactional', 'marketing', 'smtp_relay'
  display_name VARCHAR(255), -- User-friendly name
  description TEXT,

  -- API Credentials (All encrypted using KMS)
  api_key_encrypted TEXT, -- Primary API key
  api_secret_encrypted TEXT, -- API secret/client secret
  api_endpoint TEXT, -- Custom API endpoint URL

  -- OAuth Credentials (for providers using OAuth)
  oauth_client_id TEXT,
  oauth_client_secret_encrypted TEXT,
  oauth_redirect_uri TEXT,
  oauth_scopes TEXT[], -- Array of OAuth scopes
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_token_expires_at TIMESTAMPTZ,

  -- SMTP/IMAP Credentials
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password_encrypted TEXT,
  smtp_use_tls BOOLEAN DEFAULT true,
  smtp_use_ssl BOOLEAN DEFAULT false,
  imap_host VARCHAR(255),
  imap_port INTEGER,
  imap_username TEXT,
  imap_password_encrypted TEXT,
  imap_use_ssl BOOLEAN DEFAULT true,

  -- Webhook Configuration
  webhook_url TEXT,
  webhook_secret_encrypted TEXT,
  webhook_events TEXT[], -- Events to receive

  -- Custom Configuration (JSON for provider-specific settings)
  custom_config JSONB DEFAULT '{}',

  -- Rate Limits & Quotas
  rate_limit_per_second INTEGER,
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,
  rate_limit_per_day INTEGER,
  monthly_quota INTEGER,
  current_month_usage INTEGER DEFAULT 0,

  -- Status & Health
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- Primary provider for sending
  is_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'failed', 'expired'
  health_status VARCHAR(50) DEFAULT 'unknown', -- 'healthy', 'degraded', 'down', 'unknown'
  last_health_check TIMESTAMPTZ,

  -- Priority & Failover
  priority INTEGER DEFAULT 100, -- Lower = higher priority
  failover_provider_id UUID REFERENCES email_provider_credentials(id),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  -- Constraints
  CONSTRAINT unique_provider_name UNIQUE(provider_name, is_active) WHERE is_active = true
);

-- Index for active providers
CREATE INDEX idx_provider_credentials_active ON email_provider_credentials(is_active, priority) WHERE is_active = true;
CREATE INDEX idx_provider_credentials_type ON email_provider_credentials(provider_type, is_active);

-- ============================================================================
-- 2. PROVIDER USAGE LOGS (Track API usage per provider)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_provider_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES email_provider_credentials(id) ON DELETE CASCADE,

  -- Request Details
  request_type VARCHAR(50) NOT NULL, -- 'send', 'receive', 'sync', 'webhook', 'api_call'
  request_method VARCHAR(20), -- 'POST', 'GET', etc.
  request_endpoint TEXT,
  request_payload_size INTEGER,

  -- Response Details
  response_status INTEGER, -- HTTP status code
  response_time_ms INTEGER, -- Response time in milliseconds
  response_payload_size INTEGER,

  -- Error Information
  is_success BOOLEAN DEFAULT true,
  error_code VARCHAR(100),
  error_message TEXT,

  -- Email-specific (if applicable)
  email_account_id UUID REFERENCES email_accounts(id),
  message_count INTEGER DEFAULT 1,
  recipient_count INTEGER DEFAULT 1,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage logs
CREATE INDEX idx_provider_usage_provider ON email_provider_usage_logs(provider_id, created_at DESC);
CREATE INDEX idx_provider_usage_date ON email_provider_usage_logs(created_at DESC);
CREATE INDEX idx_provider_usage_type ON email_provider_usage_logs(request_type, created_at DESC);

-- ============================================================================
-- 3. ACCOUNT LIFECYCLE MANAGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_account_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Event Information
  event_type VARCHAR(50) NOT NULL, -- See CHECK constraint below
  triggered_by VARCHAR(50) NOT NULL, -- 'admin', 'system', 'policy', 'employee_exit', 'inactivity', 'scheduled'
  triggered_by_user_id UUID,

  -- State Change
  previous_state VARCHAR(50),
  new_state VARCHAR(50),

  -- Reason & Notes
  reason TEXT,
  admin_notes TEXT,

  -- Scheduled Action Reference
  scheduled_action_id UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_event_type CHECK (event_type IN (
    'created', 'activated', 'suspended', 'reactivated', 'disabled',
    'pending_offboard', 'archived', 'terminated', 'deleted',
    'quota_exceeded', 'quota_warning', 'storage_exceeded',
    'inactivity_warning', 'password_reset', 'security_lock',
    'compliance_hold', 'legal_hold_applied', 'legal_hold_released',
    'approval_requested', 'approval_granted', 'approval_denied'
  ))
);

-- Index for lifecycle events
CREATE INDEX idx_lifecycle_account ON email_account_lifecycle_events(email_account_id, created_at DESC);
CREATE INDEX idx_lifecycle_type ON email_account_lifecycle_events(event_type, created_at DESC);

-- ============================================================================
-- 4. DEPARTMENT EMAIL POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_department_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Department Reference
  department_id UUID, -- Reference to department table
  department_name VARCHAR(255) NOT NULL,

  -- Policy Details
  policy_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Quota Settings
  storage_quota_mb INTEGER DEFAULT 5120,
  daily_send_limit INTEGER DEFAULT 500,
  max_attachment_size_mb INTEGER DEFAULT 25,
  max_recipients_per_email INTEGER DEFAULT 50,
  monthly_send_limit INTEGER,

  -- Domain Restrictions
  allowed_external_domains TEXT[], -- Domains allowed to send to (empty = all)
  blocked_external_domains TEXT[], -- Domains blocked from sending to
  allow_external_emails BOOLEAN DEFAULT true,
  require_approval_for_external BOOLEAN DEFAULT false,

  -- Feature Toggles
  allow_attachments BOOLEAN DEFAULT true,
  allow_scheduled_sends BOOLEAN DEFAULT true,
  allow_auto_reply BOOLEAN DEFAULT true,
  max_auto_reply_days INTEGER DEFAULT 30,

  -- Signature Settings
  signature_id UUID REFERENCES email_signatures(id),
  require_signature BOOLEAN DEFAULT true,

  -- Compliance Settings
  auto_bcc_enabled BOOLEAN DEFAULT false,
  auto_bcc_email VARCHAR(255),
  retention_days INTEGER DEFAULT 365,
  enable_archiving BOOLEAN DEFAULT true,

  -- Policy Priority
  priority INTEGER DEFAULT 100, -- Lower = higher priority

  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Index for department policies
CREATE INDEX idx_dept_policy_dept ON email_department_policies(department_id, is_active);
CREATE INDEX idx_dept_policy_active ON email_department_policies(is_active, priority);

-- ============================================================================
-- 5. APPROVAL WORKFLOWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Workflow Definition
  workflow_name VARCHAR(100) NOT NULL,
  workflow_type VARCHAR(50) NOT NULL, -- 'account_creation', 'quota_increase', 'external_access', 'offboarding'
  description TEXT,

  -- Approval Steps (JSON array of approval chain)
  -- Example: [{"step": 1, "approver_type": "manager"}, {"step": 2, "approver_type": "email_admin"}]
  approval_chain JSONB NOT NULL DEFAULT '[]',

  -- Conditions for workflow trigger
  trigger_conditions JSONB DEFAULT '{}', -- e.g., {"department": ["finance", "hr"], "quota_increase_above": 10000}

  -- Settings
  require_all_approvers BOOLEAN DEFAULT true, -- All must approve vs. any one
  auto_approve_timeout_hours INTEGER, -- Auto-approve after X hours if no response
  auto_deny_timeout_hours INTEGER, -- Auto-deny after X hours

  -- Notifications
  notify_on_submit BOOLEAN DEFAULT true,
  notify_on_approve BOOLEAN DEFAULT true,
  notify_on_deny BOOLEAN DEFAULT true,
  notification_email_template_id UUID,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Approval requests table
CREATE TABLE IF NOT EXISTS email_approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Workflow Reference
  workflow_id UUID REFERENCES email_approval_workflows(id),

  -- Request Details
  request_type VARCHAR(50) NOT NULL,
  requester_id UUID NOT NULL, -- User who submitted request
  target_account_id UUID REFERENCES email_accounts(id),

  -- Request Data
  request_data JSONB NOT NULL DEFAULT '{}', -- Original request data

  -- Approval Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'cancelled', 'expired'
  current_step INTEGER DEFAULT 1,

  -- Approval History
  approval_history JSONB DEFAULT '[]', -- Array of approval/denial actions

  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Notes
  requester_notes TEXT,
  final_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for approval requests
CREATE INDEX idx_approval_requests_status ON email_approval_requests(status, submitted_at DESC);
CREATE INDEX idx_approval_requests_requester ON email_approval_requests(requester_id, status);

-- ============================================================================
-- 6. EMAIL ALIASES
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Alias Details
  alias_address VARCHAR(255) UNIQUE NOT NULL, -- e.g., 'sales@loanz360.com'
  alias_type VARCHAR(20) NOT NULL DEFAULT 'personal', -- 'personal', 'department', 'distribution', 'catchall'
  display_name VARCHAR(255),
  description TEXT,

  -- Owner
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  department_id UUID,

  -- Forwarding (for aliases that forward to multiple accounts)
  forward_to_accounts UUID[], -- Array of email_account_ids
  forward_to_external TEXT[], -- Array of external email addresses
  keep_copy BOOLEAN DEFAULT true, -- Keep copy in alias mailbox

  -- Settings
  is_active BOOLEAN DEFAULT true,
  allow_send_as BOOLEAN DEFAULT false, -- Allow sending emails as this alias

  -- Auto-reply (optional)
  auto_reply_enabled BOOLEAN DEFAULT false,
  auto_reply_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Index for aliases
CREATE INDEX idx_aliases_account ON email_aliases(email_account_id) WHERE email_account_id IS NOT NULL;
CREATE INDEX idx_aliases_type ON email_aliases(alias_type, is_active);

-- ============================================================================
-- 7. SHARED MAILBOXES
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_shared_mailboxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Mailbox Details
  email_address VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  mailbox_type VARCHAR(20) NOT NULL DEFAULT 'shared', -- 'shared', 'room', 'equipment', 'team'
  description TEXT,

  -- Department/Owner
  department_id UUID,
  owner_account_id UUID REFERENCES email_accounts(id),

  -- Quota
  storage_quota_mb INTEGER DEFAULT 10240, -- 10GB default for shared
  storage_used_mb INTEGER DEFAULT 0,

  -- Provider Integration
  provider_mailbox_id VARCHAR(255), -- ID from email provider

  -- Settings
  is_active BOOLEAN DEFAULT true,
  auto_mapping BOOLEAN DEFAULT false, -- Auto-map to Outlook/similar
  send_as_enabled BOOLEAN DEFAULT true,
  send_on_behalf_enabled BOOLEAN DEFAULT true,

  -- Booking (for room/equipment)
  allow_booking BOOLEAN DEFAULT false,
  booking_capacity INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Shared mailbox access table
CREATE TABLE IF NOT EXISTS email_shared_mailbox_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mailbox_id UUID NOT NULL REFERENCES email_shared_mailboxes(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Permission Level
  permission_level VARCHAR(20) NOT NULL DEFAULT 'read_only', -- 'full_access', 'send_as', 'send_on_behalf', 'read_only', 'editor'

  -- Audit
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  UNIQUE(mailbox_id, email_account_id)
);

-- Index for shared mailbox access
CREATE INDEX idx_shared_mailbox_access_mailbox ON email_shared_mailbox_access(mailbox_id);
CREATE INDEX idx_shared_mailbox_access_account ON email_shared_mailbox_access(email_account_id);

-- ============================================================================
-- 8. DISTRIBUTION LISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_distribution_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- List Details
  email_address VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  list_type VARCHAR(20) NOT NULL DEFAULT 'static', -- 'static', 'dynamic', 'security'
  description TEXT,

  -- Dynamic List Filter (for dynamic lists)
  -- Example: {"department": ["engineering"], "role": ["developer", "senior_developer"]}
  dynamic_filter JSONB,

  -- Ownership
  owner_account_id UUID REFERENCES email_accounts(id),
  department_id UUID,

  -- Moderation
  moderation_enabled BOOLEAN DEFAULT false,
  moderator_account_ids UUID[], -- Array of moderator account IDs
  moderation_notify_sender BOOLEAN DEFAULT true,

  -- Settings
  is_active BOOLEAN DEFAULT true,
  allow_external_senders BOOLEAN DEFAULT false,
  hide_from_gal BOOLEAN DEFAULT false, -- Hide from Global Address List
  require_sender_authentication BOOLEAN DEFAULT true,

  -- Delivery Report
  send_delivery_reports BOOLEAN DEFAULT false,

  -- Provider Integration
  provider_list_id VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Distribution list members
CREATE TABLE IF NOT EXISTS email_distribution_list_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES email_distribution_lists(id) ON DELETE CASCADE,

  -- Member Type
  member_type VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user', 'external', 'nested_list', 'shared_mailbox'

  -- Member Reference (one of these should be set)
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  nested_list_id UUID REFERENCES email_distribution_lists(id) ON DELETE CASCADE,
  shared_mailbox_id UUID REFERENCES email_shared_mailboxes(id) ON DELETE CASCADE,
  external_email VARCHAR(255),

  -- Status
  is_active BOOLEAN DEFAULT true,

  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID
);

-- Index for distribution list members
CREATE INDEX idx_dist_list_members_list ON email_distribution_list_members(list_id, is_active);
CREATE INDEX idx_dist_list_members_account ON email_distribution_list_members(email_account_id) WHERE email_account_id IS NOT NULL;

-- ============================================================================
-- 9. DELEGATION & PROXY ACCESS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_delegations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Delegator (person giving access)
  delegator_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Delegate (person receiving access)
  delegate_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Permissions
  permissions TEXT[] NOT NULL, -- Array of: 'read_email', 'send_as', 'send_on_behalf', 'manage_calendar', 'manage_contacts', 'full_access'

  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Reason & Approval
  reason TEXT,
  approved_by UUID,
  approval_request_id UUID REFERENCES email_approval_requests(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(delegator_account_id, delegate_account_id)
);

-- Index for delegations
CREATE INDEX idx_delegations_delegator ON email_delegations(delegator_account_id, is_active);
CREATE INDEX idx_delegations_delegate ON email_delegations(delegate_account_id, is_active);

-- ============================================================================
-- 10. COMPLIANCE - LEGAL HOLD
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_legal_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Matter Details
  matter_name VARCHAR(255) NOT NULL,
  matter_id VARCHAR(100) UNIQUE, -- External matter ID
  description TEXT,

  -- Hold Scope
  hold_type VARCHAR(20) NOT NULL DEFAULT 'in_place', -- 'in_place', 'preservation', 'litigation'

  -- Custodians (accounts under hold)
  custodian_account_ids UUID[] NOT NULL,

  -- Date Range (for time-based holds)
  content_start_date TIMESTAMPTZ,
  content_end_date TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'released', 'expired'

  -- Notes
  legal_counsel TEXT,
  internal_notes TEXT,

  -- Timestamps
  hold_placed_at TIMESTAMPTZ DEFAULT NOW(),
  hold_released_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  released_by UUID
);

-- Index for legal holds
CREATE INDEX idx_legal_holds_status ON email_legal_holds(status);
CREATE INDEX idx_legal_holds_custodians ON email_legal_holds USING GIN(custodian_account_ids);

-- ============================================================================
-- 11. COMPLIANCE - RETENTION POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Policy Details
  policy_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Scope
  scope_type VARCHAR(20) NOT NULL DEFAULT 'organization', -- 'organization', 'department', 'role', 'account'
  scope_ids UUID[], -- Department/account IDs if scoped

  -- Retention Settings
  retention_period_days INTEGER NOT NULL, -- 0 = keep forever
  retention_action VARCHAR(20) NOT NULL DEFAULT 'archive', -- 'archive', 'delete', 'move'

  -- Conditions (which emails this applies to)
  apply_to_folders TEXT[] DEFAULT ARRAY['all'], -- 'inbox', 'sent', 'all'
  exclude_labels TEXT[], -- Labels to exclude

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Index for retention policies
CREATE INDEX idx_retention_policies_active ON email_retention_policies(is_active, priority);

-- ============================================================================
-- 12. PROVIDER HEALTH MONITORING
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_provider_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES email_provider_credentials(id) ON DELETE CASCADE,

  -- Health Check Details
  check_type VARCHAR(50) NOT NULL, -- 'connectivity', 'authentication', 'send_test', 'receive_test', 'api_health'

  -- Results
  status VARCHAR(20) NOT NULL, -- 'healthy', 'degraded', 'down', 'unknown'
  latency_ms INTEGER,

  -- Error Details
  error_code VARCHAR(100),
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for health checks
CREATE INDEX idx_provider_health_provider ON email_provider_health(provider_id, checked_at DESC);
CREATE INDEX idx_provider_health_status ON email_provider_health(status, checked_at DESC);

-- ============================================================================
-- 13. UPDATE email_accounts TABLE - Add new columns
-- ============================================================================
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  account_type VARCHAR(20) DEFAULT 'standard'; -- 'standard', 'service', 'admin', 'external'

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  lifecycle_state VARCHAR(50) DEFAULT 'active'; -- Full lifecycle state

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  last_activity_at TIMESTAMPTZ;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  inactivity_warning_sent_at TIMESTAMPTZ;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  scheduled_offboard_date DATE;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  offboard_initiated_by UUID;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  department_policy_id UUID REFERENCES email_department_policies(id);

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  primary_provider_id UUID REFERENCES email_provider_credentials(id);

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  legal_hold_applied BOOLEAN DEFAULT false;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS
  compliance_flags JSONB DEFAULT '{}';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get effective quota for an account (hierarchical)
CREATE OR REPLACE FUNCTION get_effective_email_quota(p_account_id UUID)
RETURNS TABLE (
  storage_quota_mb INTEGER,
  daily_send_limit INTEGER,
  max_attachment_size_mb INTEGER,
  max_recipients_per_email INTEGER,
  source VARCHAR(50)
) AS $$
DECLARE
  v_account RECORD;
  v_dept_policy RECORD;
BEGIN
  -- Get account details
  SELECT ea.*, ep.department
  INTO v_account
  FROM email_accounts ea
  LEFT JOIN employee_profile ep ON ea.employee_profile_id = ep.id
  WHERE ea.id = p_account_id;

  -- Check for individual override (account level)
  IF v_account.storage_quota_mb IS NOT NULL THEN
    RETURN QUERY SELECT
      v_account.storage_quota_mb,
      v_account.daily_send_limit,
      25::INTEGER, -- Default attachment size
      50::INTEGER, -- Default max recipients
      'account'::VARCHAR(50);
    RETURN;
  END IF;

  -- Check for department policy
  SELECT * INTO v_dept_policy
  FROM email_department_policies
  WHERE department_name = v_account.department
    AND is_active = true
    AND (effective_until IS NULL OR effective_until > NOW())
  ORDER BY priority
  LIMIT 1;

  IF v_dept_policy IS NOT NULL THEN
    RETURN QUERY SELECT
      v_dept_policy.storage_quota_mb,
      v_dept_policy.daily_send_limit,
      v_dept_policy.max_attachment_size_mb,
      v_dept_policy.max_recipients_per_email,
      'department'::VARCHAR(50);
    RETURN;
  END IF;

  -- Return organization defaults from admin settings
  RETURN QUERY SELECT
    5120::INTEGER,
    500::INTEGER,
    25::INTEGER,
    50::INTEGER,
    'organization'::VARCHAR(50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account is under legal hold
CREATE OR REPLACE FUNCTION is_under_legal_hold(p_account_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_legal_holds
    WHERE status = 'active'
      AND p_account_id = ANY(custodian_account_ids)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get provider by priority
CREATE OR REPLACE FUNCTION get_active_email_provider()
RETURNS email_provider_credentials AS $$
DECLARE
  v_provider email_provider_credentials;
BEGIN
  SELECT * INTO v_provider
  FROM email_provider_credentials
  WHERE is_active = true
    AND is_verified = true
    AND health_status != 'down'
  ORDER BY
    CASE WHEN is_primary THEN 0 ELSE 1 END,
    priority
  LIMIT 1;

  RETURN v_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log provider usage
CREATE OR REPLACE FUNCTION log_provider_usage(
  p_provider_id UUID,
  p_request_type VARCHAR,
  p_is_success BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_error_code VARCHAR DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_email_account_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO email_provider_usage_logs (
    provider_id, request_type, is_success, response_time_ms,
    error_code, error_message, email_account_id, metadata
  ) VALUES (
    p_provider_id, p_request_type, p_is_success, p_response_time_ms,
    p_error_code, p_error_message, p_email_account_id, p_metadata
  )
  RETURNING id INTO v_log_id;

  -- Update monthly usage counter
  UPDATE email_provider_credentials
  SET current_month_usage = current_month_usage + 1,
      updated_at = NOW()
  WHERE id = p_provider_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check provider rate limits
CREATE OR REPLACE FUNCTION check_provider_rate_limit(p_provider_id UUID)
RETURNS TABLE (
  can_send BOOLEAN,
  remaining_per_minute INTEGER,
  remaining_per_hour INTEGER,
  remaining_per_day INTEGER
) AS $$
DECLARE
  v_provider RECORD;
  v_last_minute INTEGER;
  v_last_hour INTEGER;
  v_last_day INTEGER;
BEGIN
  SELECT * INTO v_provider
  FROM email_provider_credentials
  WHERE id = p_provider_id;

  -- Count requests in different time windows
  SELECT COUNT(*) INTO v_last_minute
  FROM email_provider_usage_logs
  WHERE provider_id = p_provider_id
    AND created_at > NOW() - INTERVAL '1 minute';

  SELECT COUNT(*) INTO v_last_hour
  FROM email_provider_usage_logs
  WHERE provider_id = p_provider_id
    AND created_at > NOW() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO v_last_day
  FROM email_provider_usage_logs
  WHERE provider_id = p_provider_id
    AND created_at > NOW() - INTERVAL '1 day';

  RETURN QUERY SELECT
    (v_last_minute < COALESCE(v_provider.rate_limit_per_minute, 1000) AND
     v_last_hour < COALESCE(v_provider.rate_limit_per_hour, 10000) AND
     v_last_day < COALESCE(v_provider.rate_limit_per_day, 100000)),
    COALESCE(v_provider.rate_limit_per_minute, 1000) - v_last_minute,
    COALESCE(v_provider.rate_limit_per_hour, 10000) - v_last_hour,
    COALESCE(v_provider.rate_limit_per_day, 100000) - v_last_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE email_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_provider_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_account_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_department_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_shared_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_shared_mailbox_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_distribution_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_distribution_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_provider_health ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service role full access to email_provider_credentials"
ON email_provider_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_provider_usage_logs"
ON email_provider_usage_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_account_lifecycle_events"
ON email_account_lifecycle_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_department_policies"
ON email_department_policies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_approval_workflows"
ON email_approval_workflows FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_approval_requests"
ON email_approval_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_aliases"
ON email_aliases FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_shared_mailboxes"
ON email_shared_mailboxes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_shared_mailbox_access"
ON email_shared_mailbox_access FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_distribution_lists"
ON email_distribution_lists FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_distribution_list_members"
ON email_distribution_list_members FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_delegations"
ON email_delegations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_legal_holds"
ON email_legal_holds FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_retention_policies"
ON email_retention_policies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_provider_health"
ON email_provider_health FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_provider_credentials IS 'Third-party email provider API credentials and configuration';
COMMENT ON TABLE email_provider_usage_logs IS 'Track API usage and performance for each provider';
COMMENT ON TABLE email_account_lifecycle_events IS 'Complete audit trail of account lifecycle changes';
COMMENT ON TABLE email_department_policies IS 'Department-specific email policies and quotas';
COMMENT ON TABLE email_approval_workflows IS 'Configurable approval workflow definitions';
COMMENT ON TABLE email_approval_requests IS 'Pending and completed approval requests';
COMMENT ON TABLE email_aliases IS 'Email aliases for accounts and departments';
COMMENT ON TABLE email_shared_mailboxes IS 'Shared mailboxes for teams and departments';
COMMENT ON TABLE email_distribution_lists IS 'Email distribution lists and groups';
COMMENT ON TABLE email_delegations IS 'Delegation and proxy access permissions';
COMMENT ON TABLE email_legal_holds IS 'Legal hold matters for compliance';
COMMENT ON TABLE email_retention_policies IS 'Email retention policies for compliance';
COMMENT ON TABLE email_provider_health IS 'Provider health monitoring data';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Email enterprise enhancements migration completed successfully!';
  RAISE NOTICE 'New tables created: email_provider_credentials, email_provider_usage_logs, email_account_lifecycle_events, email_department_policies, email_approval_workflows, email_approval_requests, email_aliases, email_shared_mailboxes, email_shared_mailbox_access, email_distribution_lists, email_distribution_list_members, email_delegations, email_legal_holds, email_retention_policies, email_provider_health';
END $$;
