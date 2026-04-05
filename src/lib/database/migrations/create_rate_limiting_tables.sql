-- Rate limiting tables for enhanced security

-- Table to track login and other attempts
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- email, phone, or IP address
  type TEXT NOT NULL, -- 'login', 'password_reset', 'otp_verification', etc.
  successful BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_rate_limit_attempts_identifier_type (identifier, type),
  INDEX idx_rate_limit_attempts_created_at (created_at)
);

-- Table to track account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- email, phone, or IP address
  type TEXT NOT NULL, -- 'login', 'password_reset', 'otp_verification', etc.
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_account_lockouts_identifier_type (identifier, type),
  INDEX idx_account_lockouts_expires_at (expires_at),

  -- Ensure only one active lockout per identifier+type
  UNIQUE(identifier, type)
);

-- Enable Row Level Security
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rate_limit_attempts
CREATE POLICY "Service role can manage rate limit attempts" ON rate_limit_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for account_lockouts
CREATE POLICY "Service role can manage account lockouts" ON account_lockouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to cleanup old rate limit data
CREATE OR REPLACE FUNCTION cleanup_rate_limit_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete attempts older than 24 hours
  DELETE FROM rate_limit_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';

  -- Delete expired lockouts
  DELETE FROM account_lockouts
  WHERE expires_at < NOW();
END;
$$;

-- Create a scheduled job to run cleanup daily (if pg_cron is available)
-- SELECT cron.schedule('cleanup-rate-limits', '0 2 * * *', 'SELECT cleanup_rate_limit_data();');