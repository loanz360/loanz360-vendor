-- Rate Limiting Tables for LOANZ 360
-- These tables support distributed rate limiting across multiple server instances

-- Create rate_limit_attempts table
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip_address INET NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create rate_limit_blocks table for temporary blocks
CREATE TABLE IF NOT EXISTS rate_limit_blocks (
  id BIGSERIAL PRIMARY KEY,
  ip_address INET NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  block_type VARCHAR(50) NOT NULL, -- 'SOFT_LIMIT', 'HARD_LIMIT', 'SECURITY_BLOCK'
  blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  block_reason TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create rate_limit_config table for dynamic configuration
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id BIGSERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL DEFAULT 100,
  window_minutes INTEGER NOT NULL DEFAULT 60,
  block_duration_minutes INTEGER NOT NULL DEFAULT 60,
  progressive_penalty BOOLEAN NOT NULL DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create security_events table for comprehensive logging
CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL, -- 'info', 'warn', 'error', 'critical'
  ip_address INET,
  user_agent TEXT,
  user_email VARCHAR(255),
  endpoint VARCHAR(255),
  request_method VARCHAR(10),
  request_headers JSONB,
  event_data JSONB,
  message TEXT,
  stack_trace TEXT,
  session_id VARCHAR(255),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_ip_endpoint
  ON rate_limit_attempts(ip_address, endpoint);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_window_start
  ON rate_limit_attempts(window_start);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_last_attempt
  ON rate_limit_attempts(last_attempt_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_ip_endpoint
  ON rate_limit_blocks(ip_address, endpoint);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_blocked_until
  ON rate_limit_blocks(blocked_until);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_active
  ON rate_limit_blocks(ip_address, endpoint, blocked_until)
  WHERE blocked_until > NOW();

CREATE INDEX IF NOT EXISTS idx_security_events_created_at
  ON security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_security_events_ip_address
  ON security_events(ip_address);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type
  ON security_events(event_type);

CREATE INDEX IF NOT EXISTS idx_security_events_level
  ON security_events(level);

CREATE INDEX IF NOT EXISTS idx_security_events_user_email
  ON security_events(user_email);

-- Insert default rate limiting configurations
INSERT INTO rate_limit_config (endpoint, max_requests, window_minutes, block_duration_minutes, progressive_penalty)
VALUES
  -- Authentication endpoints (strict limits)
  ('/api/superadmin/auth', 5, 15, 60, true),
  ('/api/auth/login', 10, 15, 30, true),
  ('/api/auth/register', 3, 60, 120, true),
  ('/api/auth/reset-password', 3, 60, 60, true),

  -- API endpoints (moderate limits)
  ('/api/admin/*', 100, 60, 15, false),
  ('/api/partner/*', 200, 60, 10, false),
  ('/api/customer/*', 300, 60, 5, false),

  -- Public endpoints (generous limits)
  ('/api/public/*', 1000, 60, 5, false),

  -- Default catch-all
  ('*', 500, 60, 10, false)
ON CONFLICT (endpoint) DO NOTHING;

-- Create cleanup function for old records
CREATE OR REPLACE FUNCTION cleanup_rate_limit_records()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete old attempts (older than 24 hours)
  DELETE FROM rate_limit_attempts
  WHERE last_attempt_at < NOW() - INTERVAL '24 hours';

  -- Delete expired blocks
  DELETE FROM rate_limit_blocks
  WHERE blocked_until < NOW();

  -- Delete old security events (older than 90 days)
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Update statistics
  VACUUM ANALYZE rate_limit_attempts;
  VACUUM ANALYZE rate_limit_blocks;
  VACUUM ANALYZE security_events;
END;
$$;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_rate_limit_attempts_updated_at
  BEFORE UPDATE ON rate_limit_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_blocks_updated_at
  BEFORE UPDATE ON rate_limit_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_config_updated_at
  BEFORE UPDATE ON rate_limit_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_attempts TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_blocks TO app_user;
-- GRANT SELECT ON rate_limit_config TO app_user;
-- GRANT INSERT ON security_events TO app_user;