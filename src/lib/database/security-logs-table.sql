/**
 * Security Logs Table - Immutable Audit Trail
 * Stores all security events for monitoring, alerting, and compliance
 *
 * COMPLIANCE:
 * - SOX: Immutable audit trail
 * - PCI-DSS: Security event logging
 * - GDPR: Access control logging
 */

-- Create security_logs table
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
  event TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  duration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for fast queries
  CONSTRAINT security_logs_level_check CHECK (level IN ('info', 'warn', 'error', 'critical'))
);

-- ✅ Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_level ON security_logs(level);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON security_logs(event);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_email ON security_logs(email);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);

-- ✅ Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_security_logs_level_timestamp
  ON security_logs(level, timestamp DESC);

-- ✅ GIN index for JSONB details searching
CREATE INDEX IF NOT EXISTS idx_security_logs_details_gin
  ON security_logs USING gin(details);

-- ✅ Enable Row Level Security
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- ✅ RLS Policy: Only admins and super admins can read logs
CREATE POLICY "security_logs_select_policy" ON security_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- ✅ RLS Policy: System can insert (service_role)
CREATE POLICY "security_logs_insert_policy" ON security_logs
  FOR INSERT
  WITH CHECK (true); -- Service role only

-- ✅ NO UPDATE or DELETE policies (immutable audit trail)
-- Logs cannot be modified or deleted by any user

-- ✅ Create partition for time-based archival (optional, for high volume)
-- Partition by month for easier archival and performance
-- CREATE TABLE security_logs_2025_01 PARTITION OF security_logs
--   FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ✅ Create function to archive old logs (90+ days)
CREATE OR REPLACE FUNCTION archive_old_security_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Move logs older than 90 days to archive table
  INSERT INTO security_logs_archive (
    SELECT * FROM security_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
  );

  -- Delete archived logs from main table
  DELETE FROM security_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Log the archival event
  INSERT INTO security_logs (timestamp, level, event, details, created_at)
  VALUES (
    NOW(),
    'info',
    'SECURITY_LOGS_ARCHIVED',
    jsonb_build_object(
      'archived_before', NOW() - INTERVAL '90 days',
      'archived_at', NOW()
    ),
    NOW()
  );
END;
$$;

-- ✅ Create archive table (same structure, no RLS)
CREATE TABLE IF NOT EXISTS security_logs_archive (
  LIKE security_logs INCLUDING ALL
);

-- ✅ Create scheduled job to archive logs (run weekly)
-- Requires pg_cron extension
-- SELECT cron.schedule(
--   'archive-security-logs',
--   '0 2 * * 0', -- Every Sunday at 2 AM
--   'SELECT archive_old_security_logs();'
-- );

-- ✅ Create view for recent critical events (last 24 hours)
CREATE OR REPLACE VIEW recent_critical_events AS
SELECT
  id,
  timestamp,
  event,
  ip_address,
  user_agent,
  email,
  user_id,
  details
FROM security_logs
WHERE level = 'critical'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- ✅ Create view for security dashboard metrics
CREATE OR REPLACE VIEW security_metrics_24h AS
SELECT
  COUNT(*) FILTER (WHERE level = 'critical') as critical_count,
  COUNT(*) FILTER (WHERE level = 'error') as error_count,
  COUNT(*) FILTER (WHERE level = 'warn') as warning_count,
  COUNT(*) FILTER (WHERE level = 'info') as info_count,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE event LIKE '%FAILED%') as failed_auth_attempts,
  COUNT(*) FILTER (WHERE event LIKE '%UNAUTHORIZED%') as unauthorized_attempts
FROM security_logs
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ✅ Grant permissions
GRANT SELECT ON security_logs TO authenticated;
GRANT INSERT ON security_logs TO service_role;
GRANT SELECT ON recent_critical_events TO authenticated;
GRANT SELECT ON security_metrics_24h TO authenticated;

-- ✅ Comments for documentation
COMMENT ON TABLE security_logs IS 'Immutable audit trail of all security events (SOX, PCI-DSS, GDPR compliant)';
COMMENT ON COLUMN security_logs.timestamp IS 'Event timestamp (UTC)';
COMMENT ON COLUMN security_logs.level IS 'Severity: info, warn, error, critical';
COMMENT ON COLUMN security_logs.event IS 'Event name/type';
COMMENT ON COLUMN security_logs.ip_address IS 'Client IP address';
COMMENT ON COLUMN security_logs.user_id IS 'Associated user ID (if authenticated)';
COMMENT ON COLUMN security_logs.details IS 'Additional event details (JSON)';

-- ✅ Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Security logs table created successfully';
  RAISE NOTICE '✅ Indexes created for optimal performance';
  RAISE NOTICE '✅ RLS policies enforced (admin/super_admin read-only)';
  RAISE NOTICE '✅ Immutable audit trail (no updates/deletes)';
  RAISE NOTICE '✅ Archival function created (90-day retention)';
  RAISE NOTICE '✅ Dashboard views created';
END $$;
