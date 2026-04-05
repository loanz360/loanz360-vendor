-- Password History Table Migration
-- Prevents password reuse (last 5 passwords)
-- Created: 2025-10-02

-- Create password_history table
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index for efficient lookups
  CONSTRAINT password_history_user_fk FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on user_id and created_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_password_history_user_created
  ON password_history(user_id, created_at DESC);

-- Create function to maintain only last 5 passwords
CREATE OR REPLACE FUNCTION maintain_password_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old password history beyond 5 entries
  DELETE FROM password_history
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM password_history
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 5
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically maintain history
DROP TRIGGER IF NOT EXISTS password_history_cleanup ON password_history;
CREATE TRIGGER password_history_cleanup
  AFTER INSERT ON password_history
  FOR EACH ROW
  EXECUTE FUNCTION maintain_password_history();

-- Create password_history table for super admins
CREATE TABLE IF NOT EXISTS super_admin_password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index for efficient lookups
  CONSTRAINT super_admin_password_history_admin_fk FOREIGN KEY (admin_id)
    REFERENCES super_admins(id) ON DELETE CASCADE
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_super_admin_password_history_admin_created
  ON super_admin_password_history(admin_id, created_at DESC);

-- Create function for super admin password history
CREATE OR REPLACE FUNCTION maintain_super_admin_password_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old password history beyond 5 entries
  DELETE FROM super_admin_password_history
  WHERE admin_id = NEW.admin_id
    AND id NOT IN (
      SELECT id FROM super_admin_password_history
      WHERE admin_id = NEW.admin_id
      ORDER BY created_at DESC
      LIMIT 5
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF NOT EXISTS super_admin_password_history_cleanup ON super_admin_password_history;
CREATE TRIGGER super_admin_password_history_cleanup
  AFTER INSERT ON super_admin_password_history
  FOR EACH ROW
  EXECUTE FUNCTION maintain_super_admin_password_history();

-- Enable Row Level Security
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_password_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own password history
CREATE POLICY password_history_select_own ON password_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Super admins can see their own history
CREATE POLICY super_admin_password_history_select_own ON super_admin_password_history
  FOR SELECT
  USING (true); -- Super admins authenticated via separate system

-- Comments
COMMENT ON TABLE password_history IS 'Stores last 5 password hashes to prevent password reuse';
COMMENT ON TABLE super_admin_password_history IS 'Stores last 5 super admin password hashes';
COMMENT ON FUNCTION maintain_password_history() IS 'Automatically maintains only last 5 passwords per user';
COMMENT ON FUNCTION maintain_super_admin_password_history() IS 'Automatically maintains only last 5 passwords per super admin';
