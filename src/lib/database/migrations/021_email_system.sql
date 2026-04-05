-- ============================================================================
-- Email System Database Schema
-- Enterprise-grade Internal Email System for Loanz360
-- Version: 1.0.2 (Idempotent - drops indexes before tables)
-- ============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DROP EXISTING OBJECTS (Clean Slate)
-- ============================================================================

-- Drop all indexes first (in case tables were dropped but indexes remain orphaned)
DROP INDEX IF EXISTS idx_email_provider_config_active;
DROP INDEX IF EXISTS idx_email_accounts_user;
DROP INDEX IF EXISTS idx_email_accounts_email;
DROP INDEX IF EXISTS idx_email_accounts_status;
DROP INDEX IF EXISTS idx_email_accounts_employee;
DROP INDEX IF EXISTS idx_email_signatures_default;
DROP INDEX IF EXISTS idx_email_account_signatures_account;
DROP INDEX IF EXISTS idx_email_logs_account;
DROP INDEX IF EXISTS idx_email_logs_user;
DROP INDEX IF EXISTS idx_email_logs_action;
DROP INDEX IF EXISTS idx_email_logs_date;
DROP INDEX IF EXISTS idx_email_logs_message;
DROP INDEX IF EXISTS idx_email_quota_date;
DROP INDEX IF EXISTS idx_email_drafts_account;
DROP INDEX IF EXISTS idx_email_drafts_provider;
DROP INDEX IF EXISTS idx_email_templates_account;
DROP INDEX IF EXISTS idx_email_templates_global;
DROP INDEX IF EXISTS idx_email_templates_category;
DROP INDEX IF EXISTS idx_email_contacts_account;
DROP INDEX IF EXISTS idx_email_contacts_email;
DROP INDEX IF EXISTS idx_email_contacts_favorite;
DROP INDEX IF EXISTS idx_email_labels_account;
DROP INDEX IF EXISTS idx_email_message_labels_message;
DROP INDEX IF EXISTS idx_email_message_labels_label;
DROP INDEX IF EXISTS idx_email_scheduled_account;
DROP INDEX IF EXISTS idx_email_scheduled_status;

-- Drop tables (CASCADE will handle triggers, constraints, etc.)
DROP TABLE IF EXISTS email_scheduled_sends CASCADE;
DROP TABLE IF EXISTS email_message_labels CASCADE;
DROP TABLE IF EXISTS email_labels CASCADE;
DROP TABLE IF EXISTS email_contacts CASCADE;
DROP TABLE IF EXISTS email_quick_templates CASCADE;
DROP TABLE IF EXISTS email_admin_settings CASCADE;
DROP TABLE IF EXISTS email_drafts CASCADE;
DROP TABLE IF EXISTS email_quota_usage CASCADE;
DROP TABLE IF EXISTS email_activity_logs CASCADE;
DROP TABLE IF EXISTS email_account_signatures CASCADE;
DROP TABLE IF EXISTS email_signatures CASCADE;
DROP TABLE IF EXISTS email_accounts CASCADE;
DROP TABLE IF EXISTS email_provider_config CASCADE;

-- Drop views (in case they still exist)
DROP VIEW IF EXISTS email_admin_dashboard_stats CASCADE;
DROP VIEW IF EXISTS email_usage_stats CASCADE;
DROP VIEW IF EXISTS email_accounts_with_users CASCADE;

-- Drop functions (CASCADE handles dependent triggers)
DROP FUNCTION IF EXISTS trigger_update_label_counts() CASCADE;
DROP FUNCTION IF EXISTS trigger_create_default_labels() CASCADE;
DROP FUNCTION IF EXISTS update_email_label_counts(UUID) CASCADE;
DROP FUNCTION IF EXISTS log_email_activity(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT[], BOOLEAN, INTEGER, VARCHAR, INET, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS increment_email_sent(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_email_quota(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_email_address(VARCHAR, VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS reset_daily_email_quotas() CASCADE;
DROP FUNCTION IF EXISTS create_default_email_labels(UUID) CASCADE;

-- ============================================================================
-- 1. EMAIL PROVIDER CONFIGURATION (Super Admin Managed)
-- ============================================================================
CREATE TABLE email_provider_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL DEFAULT 'zoho' CHECK (provider IN ('zoho', 'google', 'microsoft', 'hostinger')),
  domain VARCHAR(255) NOT NULL, -- 'loanz360.com'

  -- API Credentials (encrypted)
  api_client_id TEXT,
  api_client_secret_encrypted TEXT,
  api_refresh_token_encrypted TEXT,
  api_access_token_encrypted TEXT,
  api_token_expires_at TIMESTAMPTZ,

  -- IMAP Settings
  imap_host VARCHAR(255) DEFAULT 'imap.zoho.com',
  imap_port INTEGER DEFAULT 993,
  imap_use_ssl BOOLEAN DEFAULT true,

  -- SMTP Settings
  smtp_host VARCHAR(255) DEFAULT 'smtp.zoho.com',
  smtp_port INTEGER DEFAULT 465,
  smtp_use_ssl BOOLEAN DEFAULT true,

  -- Limits & Settings
  daily_send_limit_per_user INTEGER DEFAULT 500,
  max_attachment_size_mb INTEGER DEFAULT 25,
  max_recipients_per_email INTEGER DEFAULT 50,
  max_total_attachments_mb INTEGER DEFAULT 50,

  is_active BOOLEAN DEFAULT true,
  setup_completed BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Only one active config allowed
CREATE UNIQUE INDEX idx_email_provider_config_active ON email_provider_config(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. EMPLOYEE EMAIL ACCOUNTS
-- ============================================================================
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  employee_profile_id UUID,

  -- Email Address
  email_address VARCHAR(255) UNIQUE NOT NULL, -- firstname.lastname@loanz360.com
  email_local_part VARCHAR(100) NOT NULL, -- firstname.lastname
  display_name VARCHAR(255), -- Full name for display

  -- Provider Account Info
  zoho_account_id VARCHAR(255),
  zoho_zuid VARCHAR(255),
  provider_user_id VARCHAR(255), -- Generic provider user ID

  -- Credentials (encrypted for IMAP access)
  email_password_encrypted TEXT,
  app_password_encrypted TEXT, -- For IMAP if 2FA enabled

  -- Quota & Usage
  storage_quota_mb INTEGER DEFAULT 5120, -- 5GB default
  storage_used_mb INTEGER DEFAULT 0,
  daily_send_limit INTEGER DEFAULT 500,
  emails_sent_today INTEGER DEFAULT 0,
  last_send_reset_at DATE DEFAULT CURRENT_DATE,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'suspended', 'disabled', 'pending', 'creating')),
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  suspension_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspended_by UUID,

  -- Sync Info
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
  sync_error TEXT,

  -- Settings
  auto_reply_enabled BOOLEAN DEFAULT false,
  auto_reply_message TEXT,
  auto_reply_start_date DATE,
  auto_reply_end_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT unique_user_email_account UNIQUE(user_id)
);

-- Indexes for email_accounts
CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_email ON email_accounts(email_address);
CREATE INDEX idx_email_accounts_status ON email_accounts(status);
CREATE INDEX idx_email_accounts_employee ON email_accounts(employee_profile_id);

-- ============================================================================
-- 3. EMAIL SIGNATURES (Company Templates)
-- ============================================================================
CREATE TABLE email_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Signature Content (supports variables: {{full_name}}, {{designation}}, {{department}}, {{phone}}, {{email}}, {{company}})
  signature_html TEXT NOT NULL,
  signature_text TEXT NOT NULL,

  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_mandatory BOOLEAN DEFAULT false, -- If true, employees cannot remove
  applies_to_roles TEXT[] DEFAULT '{}', -- Empty = all roles
  applies_to_departments TEXT[] DEFAULT '{}', -- Empty = all departments

  -- Branding
  include_logo BOOLEAN DEFAULT true,
  logo_url TEXT,
  logo_width INTEGER DEFAULT 150,
  social_links JSONB DEFAULT '{}', -- {"linkedin": "", "twitter": "", "website": "", "facebook": ""}

  -- Colors
  primary_color VARCHAR(20) DEFAULT '#FF6700',
  secondary_color VARCHAR(20) DEFAULT '#1a1a1a',

  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Index for default signature
CREATE UNIQUE INDEX idx_email_signatures_default ON email_signatures(is_default) WHERE is_default = true AND is_active = true;

-- ============================================================================
-- 4. EMPLOYEE SIGNATURE ASSIGNMENTS
-- ============================================================================
CREATE TABLE email_account_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  signature_id UUID NOT NULL REFERENCES email_signatures(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_account_id, signature_id)
);

-- Index
CREATE INDEX idx_email_account_signatures_account ON email_account_signatures(email_account_id);

-- ============================================================================
-- 5. EMAIL ACTIVITY LOGS (Audit Trail)
-- ============================================================================
CREATE TABLE email_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  user_id UUID,

  -- Action Info
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'sent', 'received', 'read', 'unread', 'deleted', 'restored',
    'attachment_download', 'attachment_upload', 'forwarded', 'replied',
    'starred', 'unstarred', 'archived', 'spam_marked', 'spam_unmarked',
    'draft_saved', 'draft_deleted', 'account_created', 'account_suspended',
    'account_activated', 'password_reset', 'settings_changed', 'login', 'logout'
  )),

  -- Email Details (sanitized, no body content for privacy)
  message_id VARCHAR(500),
  thread_id VARCHAR(255),
  subject VARCHAR(500),
  from_address VARCHAR(255),
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  has_attachments BOOLEAN DEFAULT false,
  attachment_count INTEGER DEFAULT 0,
  total_attachment_size_bytes BIGINT DEFAULT 0,

  -- Metadata
  folder VARCHAR(50), -- 'inbox', 'sent', 'drafts', 'trash', 'spam'
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50),
  geo_location JSONB,

  -- Additional Details
  details JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for logs
CREATE INDEX idx_email_logs_account ON email_activity_logs(email_account_id, created_at DESC);
CREATE INDEX idx_email_logs_user ON email_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_email_logs_action ON email_activity_logs(action, created_at DESC);
CREATE INDEX idx_email_logs_date ON email_activity_logs(created_at DESC);
CREATE INDEX idx_email_logs_message ON email_activity_logs(message_id) WHERE message_id IS NOT NULL;

-- ============================================================================
-- 6. EMAIL QUOTA TRACKING (Daily Stats)
-- ============================================================================
CREATE TABLE email_quota_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Daily Stats
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  emails_sent INTEGER DEFAULT 0,
  emails_received INTEGER DEFAULT 0,
  emails_read INTEGER DEFAULT 0,
  emails_deleted INTEGER DEFAULT 0,
  attachments_sent INTEGER DEFAULT 0,
  attachments_received INTEGER DEFAULT 0,
  total_sent_size_bytes BIGINT DEFAULT 0,
  total_received_size_bytes BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(email_account_id, date)
);

-- Index
CREATE INDEX idx_email_quota_date ON email_quota_usage(email_account_id, date DESC);

-- ============================================================================
-- 7. EMAIL DRAFTS (Local Cache for better UX)
-- ============================================================================
CREATE TABLE email_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Draft Content
  subject VARCHAR(500),
  body_html TEXT,
  body_text TEXT,
  to_addresses TEXT[] DEFAULT '{}',
  cc_addresses TEXT[] DEFAULT '{}',
  bcc_addresses TEXT[] DEFAULT '{}',

  -- Reply/Forward Reference
  reply_to_message_id VARCHAR(500),
  forward_from_message_id VARCHAR(500),
  is_reply BOOLEAN DEFAULT false,
  is_forward BOOLEAN DEFAULT false,

  -- Attachments (stored temporarily in S3)
  attachments JSONB DEFAULT '[]', -- [{name, size, type, s3_key, uploaded_at}]

  -- Sync Status with Provider
  synced_to_provider BOOLEAN DEFAULT false,
  provider_draft_id VARCHAR(255),
  last_synced_at TIMESTAMPTZ,

  -- Auto-save tracking
  auto_saved BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_drafts_account ON email_drafts(email_account_id, updated_at DESC);
CREATE INDEX idx_email_drafts_provider ON email_drafts(provider_draft_id) WHERE provider_draft_id IS NOT NULL;

-- ============================================================================
-- 8. EMAIL ADMIN SETTINGS
-- ============================================================================
CREATE TABLE email_admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  is_editable BOOLEAN DEFAULT true,
  requires_restart BOOLEAN DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO email_admin_settings (setting_key, setting_value, setting_type, description, category) VALUES
  ('email_format', '"firstname.lastname"', 'string', 'Email address format pattern', 'account'),
  ('default_daily_limit', '500', 'number', 'Default daily send limit per user', 'limits'),
  ('default_storage_quota_mb', '5120', 'number', 'Default storage quota in MB (5GB)', 'limits'),
  ('max_attachment_size_mb', '25', 'number', 'Maximum single attachment size in MB', 'limits'),
  ('max_total_attachments_mb', '50', 'number', 'Maximum total attachments per email in MB', 'limits'),
  ('max_recipients', '50', 'number', 'Maximum recipients per email (to + cc + bcc)', 'limits'),
  ('allowed_attachment_types', '["pdf","doc","docx","xls","xlsx","ppt","pptx","jpg","jpeg","png","gif","txt","csv","zip","rar"]', 'array', 'Allowed attachment file types', 'security'),
  ('blocked_attachment_types', '["exe","bat","sh","cmd","ps1","vbs","js","dll","sys","msi","scr"]', 'array', 'Blocked attachment file types', 'security'),
  ('allow_external_emails', 'true', 'boolean', 'Allow sending to external (non-company) addresses', 'policy'),
  ('external_email_warning', 'true', 'boolean', 'Show warning when sending to external addresses', 'policy'),
  ('require_signature', 'true', 'boolean', 'Require company signature on all emails', 'signature'),
  ('signature_position', '"bottom"', 'string', 'Signature position: top or bottom of email', 'signature'),
  ('signature_separator', '"--"', 'string', 'Separator line before signature', 'signature'),
  ('auto_bcc_admin', 'false', 'boolean', 'Auto BCC admin on all outgoing emails', 'compliance'),
  ('admin_bcc_email', '""', 'string', 'Admin BCC email address', 'compliance'),
  ('retention_days', '365', 'number', 'Email retention period in days', 'compliance'),
  ('spam_filter_enabled', 'true', 'boolean', 'Enable spam filtering', 'security'),
  ('virus_scan_enabled', 'true', 'boolean', 'Enable virus scanning on attachments', 'security'),
  ('audit_log_retention_days', '730', 'number', 'Audit log retention in days (2 years)', 'compliance'),
  ('auto_reply_max_days', '30', 'number', 'Maximum auto-reply duration in days', 'policy'),
  ('email_recall_enabled', 'false', 'boolean', 'Allow email recall (if supported by provider)', 'features'),
  ('read_receipt_enabled', 'true', 'boolean', 'Allow read receipts', 'features'),
  ('schedule_send_enabled', 'true', 'boolean', 'Allow scheduled email sending', 'features'),
  ('undo_send_seconds', '10', 'number', 'Seconds to undo send (0 to disable)', 'features'),
  ('default_font_family', '"Arial, sans-serif"', 'string', 'Default email font family', 'appearance'),
  ('default_font_size', '14', 'number', 'Default email font size in pixels', 'appearance')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- 9. EMAIL QUICK TEMPLATES (Canned Responses)
-- ============================================================================
CREATE TABLE email_quick_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE, -- NULL = global template

  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',

  -- Template Content (supports variables: {{recipient_name}}, {{sender_name}}, {{date}}, {{company}})
  subject VARCHAR(500),
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,

  -- Template Metadata
  is_global BOOLEAN DEFAULT false, -- Super Admin created, available to all
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Tags for searchability
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Indexes
CREATE INDEX idx_email_templates_account ON email_quick_templates(email_account_id) WHERE email_account_id IS NOT NULL;
CREATE INDEX idx_email_templates_global ON email_quick_templates(is_global, is_active) WHERE is_global = true;
CREATE INDEX idx_email_templates_category ON email_quick_templates(category);

-- ============================================================================
-- 10. EMAIL CONTACTS (Address Book)
-- ============================================================================
CREATE TABLE email_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  email_address VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company VARCHAR(255),
  department VARCHAR(100),
  phone VARCHAR(50),
  notes TEXT,

  -- Contact Type
  contact_type VARCHAR(20) DEFAULT 'manual' CHECK (contact_type IN ('manual', 'auto', 'internal', 'external')),
  is_favorite BOOLEAN DEFAULT false,

  -- Interaction Stats
  emails_sent_count INTEGER DEFAULT 0,
  emails_received_count INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(email_account_id, email_address)
);

-- Indexes
CREATE INDEX idx_email_contacts_account ON email_contacts(email_account_id);
CREATE INDEX idx_email_contacts_email ON email_contacts(email_address);
CREATE INDEX idx_email_contacts_favorite ON email_contacts(email_account_id, is_favorite) WHERE is_favorite = true;

-- ============================================================================
-- 11. EMAIL LABELS (Custom Folders/Tags)
-- ============================================================================
CREATE TABLE email_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280',
  icon VARCHAR(50),

  is_system BOOLEAN DEFAULT false, -- System labels (Inbox, Sent, etc.) cannot be deleted
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- Stats (cached)
  total_count INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(email_account_id, name)
);

-- Index
CREATE INDEX idx_email_labels_account ON email_labels(email_account_id, sort_order);

-- ============================================================================
-- 12. EMAIL MESSAGE LABELS (Many-to-Many)
-- ============================================================================
CREATE TABLE email_message_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(500) NOT NULL, -- Provider message ID
  label_id UUID NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_account_id, message_id, label_id)
);

-- Index
CREATE INDEX idx_email_message_labels_message ON email_message_labels(email_account_id, message_id);
CREATE INDEX idx_email_message_labels_label ON email_message_labels(label_id);

-- ============================================================================
-- 13. EMAIL SCHEDULED SENDS
-- ============================================================================
CREATE TABLE email_scheduled_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES email_drafts(id) ON DELETE SET NULL,

  -- Email Content (snapshot at schedule time)
  subject VARCHAR(500),
  body_html TEXT,
  body_text TEXT,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[] DEFAULT '{}',
  bcc_addresses TEXT[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',

  -- Schedule Info
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',

  -- Status
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_scheduled_account ON email_scheduled_sends(email_account_id);
CREATE INDEX idx_email_scheduled_status ON email_scheduled_sends(status, scheduled_at) WHERE status = 'scheduled';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to reset daily email quotas (run via cron job)
CREATE OR REPLACE FUNCTION reset_daily_email_quotas()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE email_accounts
  SET emails_sent_today = 0,
      last_send_reset_at = CURRENT_DATE,
      updated_at = NOW()
  WHERE last_send_reset_at < CURRENT_DATE;

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique email address
CREATE OR REPLACE FUNCTION generate_email_address(
  p_first_name VARCHAR,
  p_last_name VARCHAR,
  p_domain VARCHAR DEFAULT 'loanz360.com'
)
RETURNS VARCHAR AS $$
DECLARE
  base_email VARCHAR;
  final_email VARCHAR;
  counter INTEGER := 0;
  clean_first VARCHAR;
  clean_last VARCHAR;
BEGIN
  -- Clean and lowercase names (remove special characters)
  clean_first := LOWER(REGEXP_REPLACE(TRIM(p_first_name), '[^a-zA-Z]', '', 'g'));
  clean_last := LOWER(REGEXP_REPLACE(TRIM(p_last_name), '[^a-zA-Z]', '', 'g'));

  -- Handle empty names
  IF clean_first = '' THEN clean_first := 'user'; END IF;
  IF clean_last = '' THEN clean_last := 'employee'; END IF;

  -- Generate base email
  base_email := clean_first || '.' || clean_last;
  final_email := base_email || '@' || p_domain;

  -- Check for duplicates and add number if needed
  WHILE EXISTS (SELECT 1 FROM email_accounts WHERE email_address = final_email) LOOP
    counter := counter + 1;
    final_email := base_email || counter::VARCHAR || '@' || p_domain;
  END LOOP;

  RETURN final_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check email send quota
CREATE OR REPLACE FUNCTION check_email_quota(p_email_account_id UUID)
RETURNS TABLE (
  can_send BOOLEAN,
  emails_sent INTEGER,
  daily_limit INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  account_record RECORD;
BEGIN
  SELECT ea.daily_send_limit, ea.emails_sent_today, ea.last_send_reset_at
  INTO account_record
  FROM email_accounts ea
  WHERE ea.id = p_email_account_id;

  -- Reset if new day
  IF account_record.last_send_reset_at < CURRENT_DATE THEN
    UPDATE email_accounts
    SET emails_sent_today = 0,
        last_send_reset_at = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = p_email_account_id;

    RETURN QUERY SELECT
      true,
      0,
      account_record.daily_send_limit,
      account_record.daily_send_limit;
  END IF;

  -- Return quota status
  RETURN QUERY SELECT
    account_record.emails_sent_today < account_record.daily_send_limit,
    account_record.emails_sent_today,
    account_record.daily_send_limit,
    account_record.daily_send_limit - account_record.emails_sent_today;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment sent email count
CREATE OR REPLACE FUNCTION increment_email_sent(
  p_email_account_id UUID,
  p_recipient_count INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Update account counter
  UPDATE email_accounts
  SET emails_sent_today = emails_sent_today + 1,
      updated_at = NOW()
  WHERE id = p_email_account_id;

  -- Update/insert quota usage record
  INSERT INTO email_quota_usage (email_account_id, date, emails_sent)
  VALUES (p_email_account_id, CURRENT_DATE, 1)
  ON CONFLICT (email_account_id, date)
  DO UPDATE SET
    emails_sent = email_quota_usage.emails_sent + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log email activity
CREATE OR REPLACE FUNCTION log_email_activity(
  p_email_account_id UUID,
  p_user_id UUID,
  p_action VARCHAR,
  p_message_id VARCHAR DEFAULT NULL,
  p_subject VARCHAR DEFAULT NULL,
  p_from_address VARCHAR DEFAULT NULL,
  p_to_addresses TEXT[] DEFAULT NULL,
  p_has_attachments BOOLEAN DEFAULT false,
  p_attachment_count INTEGER DEFAULT 0,
  p_folder VARCHAR DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO email_activity_logs (
    email_account_id, user_id, action, message_id, subject,
    from_address, to_addresses, has_attachments, attachment_count,
    folder, ip_address, user_agent, details
  ) VALUES (
    p_email_account_id, p_user_id, p_action, p_message_id, p_subject,
    p_from_address, p_to_addresses, p_has_attachments, p_attachment_count,
    p_folder, p_ip_address, p_user_agent, p_details
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update label counts
CREATE OR REPLACE FUNCTION update_email_label_counts(p_label_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE email_labels
  SET total_count = (
        SELECT COUNT(*) FROM email_message_labels WHERE label_id = p_label_id
      ),
      updated_at = NOW()
  WHERE id = p_label_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for label count updates
CREATE OR REPLACE FUNCTION trigger_update_label_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM update_email_label_counts(NEW.label_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_email_label_counts(OLD.label_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for label count updates
CREATE TRIGGER trigger_email_label_counts
AFTER INSERT OR DELETE ON email_message_labels
FOR EACH ROW EXECUTE FUNCTION trigger_update_label_counts();

-- Function to create default labels for new account
CREATE OR REPLACE FUNCTION create_default_email_labels(p_email_account_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO email_labels (email_account_id, name, color, icon, is_system, sort_order) VALUES
    (p_email_account_id, 'Inbox', '#3B82F6', 'inbox', true, 1),
    (p_email_account_id, 'Sent', '#10B981', 'send', true, 2),
    (p_email_account_id, 'Drafts', '#F59E0B', 'file-text', true, 3),
    (p_email_account_id, 'Starred', '#EAB308', 'star', true, 4),
    (p_email_account_id, 'Spam', '#EF4444', 'alert-triangle', true, 5),
    (p_email_account_id, 'Trash', '#6B7280', 'trash-2', true, 6),
    (p_email_account_id, 'Archive', '#8B5CF6', 'archive', true, 7)
  ON CONFLICT (email_account_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default labels on new account
CREATE OR REPLACE FUNCTION trigger_create_default_labels()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_email_labels(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_email_account_labels
AFTER INSERT ON email_accounts
FOR EACH ROW EXECUTE FUNCTION trigger_create_default_labels();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE email_provider_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_account_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_quick_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_message_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_scheduled_sends ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "Service role full access to email_provider_config"
ON email_provider_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_accounts"
ON email_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_signatures"
ON email_signatures FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_account_signatures"
ON email_account_signatures FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_activity_logs"
ON email_activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_quota_usage"
ON email_quota_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_drafts"
ON email_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_admin_settings"
ON email_admin_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_quick_templates"
ON email_quick_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_contacts"
ON email_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_labels"
ON email_labels FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_message_labels"
ON email_message_labels FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to email_scheduled_sends"
ON email_scheduled_sends FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated user policies (users can only access their own data)
CREATE POLICY "Users can view their own email account"
ON email_accounts FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own email account settings"
ON email_accounts FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view active signatures"
ON email_signatures FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "Users can view their signature assignments"
ON email_account_signatures FOR SELECT TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their activity logs"
ON email_activity_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view their quota usage"
ON email_quota_usage FOR SELECT TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their drafts"
ON email_drafts FOR ALL TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can view email settings"
ON email_admin_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can manage their templates"
ON email_quick_templates FOR ALL TO authenticated
USING (
  email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid())
  OR is_global = true
);

CREATE POLICY "Users can manage their contacts"
ON email_contacts FOR ALL TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their labels"
ON email_labels FOR ALL TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their message labels"
ON email_message_labels FOR ALL TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their scheduled sends"
ON email_scheduled_sends FOR ALL TO authenticated
USING (email_account_id IN (SELECT id FROM email_accounts WHERE user_id = auth.uid()));

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for email usage statistics
CREATE OR REPLACE VIEW email_usage_stats AS
SELECT
  ea.id as email_account_id,
  ea.email_address,
  ea.display_name,
  ea.storage_quota_mb,
  ea.storage_used_mb,
  ea.daily_send_limit,
  ea.emails_sent_today,
  ea.status,
  ROUND((ea.storage_used_mb::DECIMAL / NULLIF(ea.storage_quota_mb, 0)) * 100, 2) as storage_percent_used,
  ROUND((ea.emails_sent_today::DECIMAL / NULLIF(ea.daily_send_limit, 0)) * 100, 2) as daily_quota_percent_used,
  COALESCE((
    SELECT SUM(equ.emails_sent)
    FROM email_quota_usage equ
    WHERE equ.email_account_id = ea.id
    AND equ.date > CURRENT_DATE - INTERVAL '30 days'
  ), 0) as emails_sent_30d,
  COALESCE((
    SELECT SUM(equ.emails_received)
    FROM email_quota_usage equ
    WHERE equ.email_account_id = ea.id
    AND equ.date > CURRENT_DATE - INTERVAL '30 days'
  ), 0) as emails_received_30d,
  ea.last_sync_at,
  ea.created_at
FROM email_accounts ea;

-- View for admin dashboard stats
CREATE OR REPLACE VIEW email_admin_dashboard_stats AS
SELECT
  COUNT(*) as total_accounts,
  COUNT(*) FILTER (WHERE status = 'active') as active_accounts,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_accounts,
  COUNT(*) FILTER (WHERE status = 'suspended') as suspended_accounts,
  COALESCE(SUM(storage_used_mb), 0) as total_storage_used_mb,
  COALESCE(SUM(storage_quota_mb), 0) as total_storage_quota_mb,
  COALESCE(SUM(emails_sent_today), 0) as emails_sent_today,
  ROUND(AVG(emails_sent_today), 2) as avg_emails_per_user_today
FROM email_accounts;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_provider_config IS 'Email provider configuration (Zoho, Google, Microsoft)';
COMMENT ON TABLE email_accounts IS 'Employee email accounts with company domain';
COMMENT ON TABLE email_signatures IS 'Company email signature templates';
COMMENT ON TABLE email_account_signatures IS 'Assignment of signatures to email accounts';
COMMENT ON TABLE email_activity_logs IS 'Audit trail for all email activities';
COMMENT ON TABLE email_quota_usage IS 'Daily email quota and usage tracking';
COMMENT ON TABLE email_drafts IS 'Locally cached email drafts';
COMMENT ON TABLE email_admin_settings IS 'Super Admin configurable email settings';
COMMENT ON TABLE email_quick_templates IS 'Quick response templates for employees';
COMMENT ON TABLE email_contacts IS 'Personal address book for each email account';
COMMENT ON TABLE email_labels IS 'Custom labels/folders for email organization';
COMMENT ON TABLE email_message_labels IS 'Many-to-many relationship between messages and labels';
COMMENT ON TABLE email_scheduled_sends IS 'Scheduled emails queue';

COMMENT ON FUNCTION generate_email_address IS 'Generates unique email address in firstname.lastname@domain format';
COMMENT ON FUNCTION check_email_quota IS 'Checks if user can send email based on daily quota';
COMMENT ON FUNCTION increment_email_sent IS 'Increments sent email counter for quota tracking';
COMMENT ON FUNCTION log_email_activity IS 'Logs email activity for audit trail';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Email system schema created successfully!';
  RAISE NOTICE 'Tables: email_provider_config, email_accounts, email_signatures, email_account_signatures, email_activity_logs, email_quota_usage, email_drafts, email_admin_settings, email_quick_templates, email_contacts, email_labels, email_message_labels, email_scheduled_sends';
END $$;
