-- =====================================================
-- ULAP SMS Templates Migration
-- Creates communication_templates table if not exists
-- and seeds ULAP-specific templates
-- =====================================================

-- Create communication_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(100) NOT NULL UNIQUE,
  template_name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('sms', 'email', 'whatsapp', 'push')),
  category VARCHAR(100) DEFAULT 'general',
  subject VARCHAR(500), -- For email templates
  content TEXT NOT NULL,
  content_html TEXT, -- For email templates
  variables TEXT[] DEFAULT '{}',
  dlt_template_id VARCHAR(100), -- For DLT compliance (India)
  default_sender_id VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_communication_templates_code ON communication_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_communication_templates_type ON communication_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_communication_templates_category ON communication_templates(category);
CREATE INDEX IF NOT EXISTS idx_communication_templates_active ON communication_templates(is_active);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_communication_templates_updated_at ON communication_templates;
CREATE OR REPLACE FUNCTION update_communication_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_communication_templates_updated_at
  BEFORE UPDATE ON communication_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_templates_updated_at();

-- =====================================================
-- ULAP SMS Templates
-- =====================================================

-- Insert ULAP OTP Verification Template
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'ULAP_OTP_VERIFICATION',
  'ULAP Loan Application OTP',
  'sms',
  'otp',
  'Your OTP for Loan Application is {{otp}}. Valid for {{validity}} minutes. Do not share this with anyone. - Loanz360',
  ARRAY['otp', 'validity'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert ULAP Lead Created SMS Template (for BA/BP notification)
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'ULAP_LEAD_CREATED',
  'ULAP Lead Created Notification',
  'sms',
  'notification',
  'New loan lead created! Lead ID: {{lead_id}}. Customer: {{customer_name}}. Share the application link with your customer. - Loanz360',
  ARRAY['lead_id', 'customer_name'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert ULAP Application Link SMS Template (sent to customer)
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'ULAP_APPLICATION_LINK',
  'ULAP Application Link to Customer',
  'sms',
  'notification',
  'Complete your loan application: {{short_url}}. This link expires in 7 days. For queries, contact your advisor {{advisor_name}}. - Loanz360',
  ARRAY['short_url', 'advisor_name'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert ULAP Application Submitted SMS Template
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'ULAP_APPLICATION_SUBMITTED',
  'ULAP Application Submitted',
  'sms',
  'notification',
  'Your loan application ({{lead_id}}) has been submitted successfully! Our team will review and contact you shortly. - Loanz360',
  ARRAY['lead_id'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert ULAP Status Update SMS Template
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'ULAP_STATUS_UPDATE',
  'ULAP Application Status Update',
  'sms',
  'notification',
  'Your loan application ({{lead_id}}) status: {{status}}. {{message}} - Loanz360',
  ARRAY['lead_id', 'status', 'message'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert fallback OTP_LOGIN template (used by existing OTP utils)
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'OTP_LOGIN',
  'Login OTP',
  'sms',
  'otp',
  'Your OTP is {{otp}}. Valid for {{validity}} minutes. Do not share this with anyone. - Loanz360',
  ARRAY['otp', 'validity'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Insert OTP_PASSWORD_RESET template
INSERT INTO communication_templates (
  template_code,
  template_name,
  template_type,
  category,
  content,
  variables,
  default_sender_id,
  is_active
) VALUES (
  'OTP_PASSWORD_RESET',
  'Password Reset OTP',
  'sms',
  'otp',
  'Your OTP for password reset is {{otp}}. Valid for {{validity}} minutes. If you did not request this, please ignore. - Loanz360',
  ARRAY['otp', 'validity'],
  'LOANZ3',
  true
)
ON CONFLICT (template_code)
DO UPDATE SET
  template_name = EXCLUDED.template_name,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
