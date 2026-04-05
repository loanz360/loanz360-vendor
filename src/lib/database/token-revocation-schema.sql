-- Token Revocation and Session Management Schema for LOANZ 360
-- Provides token blacklist and session tracking capabilities

-- Token blacklist table
CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_agent TEXT,
    ip_address INET,
    device_fingerprint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason TEXT,
    refresh_token_hash VARCHAR(64),
    access_token_hash VARCHAR(64),
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Security audit log for token/session events
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_hash ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_session_id ON token_blacklist(session_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(revoked) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at);

-- Function to automatically cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    sessions_deleted INTEGER := 0;
BEGIN
    -- Delete expired blacklist entries
    DELETE FROM token_blacklist
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Delete expired sessions
    DELETE FROM user_sessions
    WHERE expires_at < NOW() AND revoked = TRUE;

    GET DIAGNOSTICS sessions_deleted = ROW_COUNT;

    -- Add the counts together
    deleted_count := deleted_count + sessions_deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke all sessions for a user
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_revoked_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER := 0;
BEGIN
    -- Revoke all active sessions
    UPDATE user_sessions
    SET
        revoked = TRUE,
        revoked_at = NOW(),
        revoke_reason = p_reason
    WHERE user_id = p_user_id
    AND revoked = FALSE;

    GET DIAGNOSTICS revoked_count = ROW_COUNT;

    -- Log the event
    INSERT INTO security_audit_log (
        event_type,
        user_id,
        performed_by,
        details,
        created_at
    ) VALUES (
        'ALL_SESSIONS_REVOKED',
        p_user_id,
        p_revoked_by,
        jsonb_build_object(
            'reason', p_reason,
            'sessions_revoked', revoked_count
        ),
        NOW()
    );

    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if session is valid
CREATE OR REPLACE FUNCTION is_session_valid(p_session_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    session_record RECORD;
BEGIN
    SELECT * INTO session_record
    FROM user_sessions
    WHERE session_id = p_session_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if revoked
    IF session_record.revoked THEN
        RETURN FALSE;
    END IF;

    -- Check if expired
    IF session_record.expires_at < NOW() THEN
        RETURN FALSE;
    END IF;

    -- Update last activity
    UPDATE user_sessions
    SET last_activity = NOW()
    WHERE session_id = p_session_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get session statistics
CREATE OR REPLACE FUNCTION get_session_statistics(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_sessions BIGINT,
    active_sessions BIGINT,
    revoked_sessions BIGINT,
    expired_sessions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_sessions,
        COUNT(*) FILTER (WHERE revoked = FALSE AND expires_at > NOW())::BIGINT as active_sessions,
        COUNT(*) FILTER (WHERE revoked = TRUE)::BIGINT as revoked_sessions,
        COUNT(*) FILTER (WHERE expires_at < NOW())::BIGINT as expired_sessions
    FROM user_sessions
    WHERE p_user_id IS NULL OR user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Admin can view all blacklist entries" ON token_blacklist;
DROP POLICY IF EXISTS "System can insert blacklist entries" ON token_blacklist;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "System can manage sessions" ON user_sessions;
DROP POLICY IF EXISTS "Admin can view audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON security_audit_log;

-- Policy: Admins can view all token blacklist entries
CREATE POLICY "Admin can view all blacklist entries" ON token_blacklist
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Policy: System can insert blacklist entries
CREATE POLICY "System can insert blacklist entries" ON token_blacklist
    FOR INSERT WITH CHECK (true);

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Policy: System can manage sessions
CREATE POLICY "System can manage sessions" ON user_sessions
    FOR ALL USING (true);

-- Policy: Admins can view all audit logs
CREATE POLICY "Admin can view audit logs" ON security_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Policy: Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON security_audit_log
    FOR SELECT USING (user_id = auth.uid());

-- Policy: System can insert audit logs
CREATE POLICY "System can insert audit logs" ON security_audit_log
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON token_blacklist TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated;
GRANT SELECT, INSERT ON security_audit_log TO authenticated;

-- Trigger to update last_activity on session access
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    WHEN (OLD.last_activity IS DISTINCT FROM NEW.last_activity)
    EXECUTE FUNCTION update_session_activity();

-- Comments
COMMENT ON TABLE token_blacklist IS 'Stores revoked JWT tokens for security';
COMMENT ON TABLE user_sessions IS 'Tracks all active user sessions across devices';
COMMENT ON TABLE security_audit_log IS 'Audit trail for security-related events';
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Removes expired tokens and sessions';
COMMENT ON FUNCTION revoke_all_user_sessions(UUID, TEXT, UUID) IS 'Revokes all sessions for a user (emergency logout)';
COMMENT ON FUNCTION is_session_valid(VARCHAR) IS 'Checks if a session is valid and updates last activity';
COMMENT ON FUNCTION get_session_statistics(UUID) IS 'Returns session statistics for a user or all users';