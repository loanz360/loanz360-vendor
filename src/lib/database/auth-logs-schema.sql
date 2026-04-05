-- Auth Logs Schema for LOANZ 360
-- Secure logging system for authentication events

CREATE TABLE IF NOT EXISTS auth_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
    event VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_logs_level ON auth_logs(level);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event ON auth_logs(event);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_logs_critical ON auth_logs(level) WHERE level IN ('critical', 'error');

-- Function to clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_auth_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    warn_deleted INTEGER := 0;
    info_deleted INTEGER := 0;
BEGIN
    -- Keep critical/error logs for 1 year
    DELETE FROM auth_logs
    WHERE level IN ('critical', 'error')
    AND created_at < NOW() - INTERVAL '1 year';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Keep warn logs for 6 months
    DELETE FROM auth_logs
    WHERE level = 'warn'
    AND created_at < NOW() - INTERVAL '6 months';

    GET DIAGNOSTICS warn_deleted = ROW_COUNT;

    -- Keep info/debug logs for 3 months
    DELETE FROM auth_logs
    WHERE level IN ('info', 'debug')
    AND created_at < NOW() - INTERVAL '3 months';

    GET DIAGNOSTICS info_deleted = ROW_COUNT;

    -- Add the counts together
    deleted_count := deleted_count + warn_deleted + info_deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get failed login attempts for a user
CREATE OR REPLACE FUNCTION get_failed_login_attempts(
    p_user_id UUID,
    p_since TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
    attempt_time TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        created_at,
        al.ip_address,
        al.user_agent,
        al.details
    FROM auth_logs al
    WHERE al.user_id = p_user_id
    AND al.event = 'LOGIN_FAILED'
    AND al.created_at >= p_since
    ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_auth_activity(
    p_time_window INTERVAL DEFAULT INTERVAL '1 hour'
)
RETURNS TABLE (
    user_id UUID,
    ip_address INET,
    event_count BIGINT,
    first_event TIMESTAMP WITH TIME ZONE,
    last_event TIMESTAMP WITH TIME ZONE,
    events TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH suspicious_activity AS (
        SELECT
            al.user_id,
            al.ip_address,
            COUNT(*) as event_count,
            MIN(al.created_at) as first_event,
            MAX(al.created_at) as last_event,
            array_agg(DISTINCT al.event) as events
        FROM auth_logs al
        WHERE al.created_at >= NOW() - p_time_window
        AND al.level IN ('warn', 'error', 'critical')
        GROUP BY al.user_id, al.ip_address
        HAVING COUNT(*) > 5  -- More than 5 warnings in time window
    )
    SELECT * FROM suspicious_activity
    ORDER BY event_count DESC, last_event DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get auth event statistics
CREATE OR REPLACE FUNCTION get_auth_statistics(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    event VARCHAR,
    event_count BIGINT,
    unique_users BIGINT,
    unique_ips BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        al.event,
        COUNT(*)::BIGINT as event_count,
        COUNT(DISTINCT al.user_id)::BIGINT as unique_users,
        COUNT(DISTINCT al.ip_address)::BIGINT as unique_ips
    FROM auth_logs al
    WHERE al.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY al.event
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Admin can view all auth logs" ON auth_logs;
DROP POLICY IF EXISTS "Users can view own auth logs" ON auth_logs;
DROP POLICY IF EXISTS "System can insert auth logs" ON auth_logs;

-- Policy: Admins can view all logs
CREATE POLICY "Admin can view all auth logs" ON auth_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Policy: Users can view their own logs
CREATE POLICY "Users can view own auth logs" ON auth_logs
    FOR SELECT USING (user_id = auth.uid());

-- Policy: System can insert logs
CREATE POLICY "System can insert auth logs" ON auth_logs
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON auth_logs TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_auth_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION get_failed_login_attempts(UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_auth_activity(INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Comments
COMMENT ON TABLE auth_logs IS 'Secure logging system for authentication events';
COMMENT ON FUNCTION cleanup_old_auth_logs() IS 'Removes old auth logs based on retention policy';
COMMENT ON FUNCTION get_failed_login_attempts(UUID, TIMESTAMP WITH TIME ZONE) IS 'Returns failed login attempts for a user';
COMMENT ON FUNCTION detect_suspicious_auth_activity(INTERVAL) IS 'Detects suspicious authentication patterns';
COMMENT ON FUNCTION get_auth_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Returns authentication event statistics';