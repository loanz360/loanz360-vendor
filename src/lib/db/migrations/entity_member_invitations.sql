-- Entity Member Invitations Table
-- This table tracks invitations sent to potential entity members (partners, directors, etc.)
-- Run this migration in Supabase SQL Editor

-- Create the entity_member_invitations table
CREATE TABLE IF NOT EXISTS entity_member_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity being invited to
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Invitation details
  invite_code VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255),
  mobile VARCHAR(20),
  full_name VARCHAR(255) NOT NULL,

  -- Role details
  role_key VARCHAR(50) NOT NULL,
  role_name VARCHAR(100) NOT NULL,

  -- Permissions to grant on acceptance
  can_sign_documents BOOLEAN DEFAULT false,
  can_apply_for_loans BOOLEAN DEFAULT false,
  can_manage_entity BOOLEAN DEFAULT false,
  shareholding_percentage DECIMAL(5,2),

  -- Invitation status
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,

  -- Who sent the invitation
  invited_by UUID NOT NULL REFERENCES auth.users(id),

  -- Who accepted (links to individuals table after acceptance)
  accepted_by_individual_id UUID REFERENCES individuals(id),

  -- Notification tracking
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,

  -- Optional message from inviter
  personal_message TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invitations_entity_id ON entity_member_invitations(entity_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON entity_member_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_mobile ON entity_member_invitations(mobile);
CREATE INDEX IF NOT EXISTS idx_invitations_invite_code ON entity_member_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON entity_member_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON entity_member_invitations(expires_at);

-- Add RLS policies
ALTER TABLE entity_member_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Entity admins can view their entity's invitations
CREATE POLICY "Entity admins can view invitations"
  ON entity_member_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entity_members em
      JOIN individuals i ON em.individual_id = i.id
      WHERE em.entity_id = entity_member_invitations.entity_id
      AND i.auth_user_id = auth.uid()
      AND em.can_manage_entity = true
      AND em.status = 'ACTIVE'
    )
  );

-- Policy: Entity admins can create invitations
CREATE POLICY "Entity admins can create invitations"
  ON entity_member_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entity_members em
      JOIN individuals i ON em.individual_id = i.id
      WHERE em.entity_id = entity_member_invitations.entity_id
      AND i.auth_user_id = auth.uid()
      AND em.can_manage_entity = true
      AND em.status = 'ACTIVE'
    )
  );

-- Policy: Entity admins can update invitations (cancel)
CREATE POLICY "Entity admins can update invitations"
  ON entity_member_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM entity_members em
      JOIN individuals i ON em.individual_id = i.id
      WHERE em.entity_id = entity_member_invitations.entity_id
      AND i.auth_user_id = auth.uid()
      AND em.can_manage_entity = true
      AND em.status = 'ACTIVE'
    )
  );

-- Policy: Anyone with invite code can view their invitation (for acceptance page)
CREATE POLICY "Invitees can view their invitation by code"
  ON entity_member_invitations
  FOR SELECT
  USING (true); -- Will be filtered by invite_code in the application

-- Function to auto-expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE entity_member_invitations
  SET status = 'EXPIRED', updated_at = now()
  WHERE status = 'PENDING' AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run daily
-- SELECT cron.schedule('expire-invitations', '0 0 * * *', 'SELECT expire_old_invitations()');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_invitation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invitation_timestamp
  BEFORE UPDATE ON entity_member_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_invitation_timestamp();

-- Comment for documentation
COMMENT ON TABLE entity_member_invitations IS 'Tracks invitations sent to potential entity members (partners, directors, shareholders)';
COMMENT ON COLUMN entity_member_invitations.invite_code IS 'Unique code for invitation acceptance link';
COMMENT ON COLUMN entity_member_invitations.status IS 'PENDING, ACCEPTED, REJECTED, EXPIRED, or CANCELLED';
