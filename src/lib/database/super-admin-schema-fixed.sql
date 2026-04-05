-- Super Admin Management Schema for LOANZ 360 (Fixed Version)
-- Safe to run multiple times

-- Super admins table
CREATE TABLE IF NOT EXISTS super_admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMP WITH TIME ZONE,
    lock_reason TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    password_must_change BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT[],
    permissions JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Super admin sessions
CREATE TABLE IF NOT EXISTS super_admin_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    super_admin_id UUID REFERENCES super_admins(id) ON DELETE CASCADE NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason TEXT
);

-- Super admin audit log
CREATE TABLE IF NOT EXISTS super_admin_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes (CREATE IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);
CREATE INDEX IF NOT EXISTS idx_super_admins_is_active ON super_admins(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_super_admins_is_locked ON super_admins(is_locked) WHERE is_locked = TRUE;
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_super_admin_id ON super_admin_sessions(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_session_id ON super_admin_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_is_active ON super_admin_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_expires_at ON super_admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_super_admin_id ON super_admin_audit_log(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_action ON super_admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_created_at ON super_admin_audit_log(created_at);

-- Function: verify_super_admin
CREATE OR REPLACE FUNCTION verify_super_admin(
    p_email VARCHAR,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    password_hash TEXT,
    full_name VARCHAR,
    is_active BOOLEAN,
    is_locked BOOLEAN,
    two_factor_enabled BOOLEAN,
    password_must_change BOOLEAN,
    last_login TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_admin RECORD;
BEGIN
    SELECT * INTO v_admin FROM super_admins WHERE super_admins.email = p_email;

    IF NOT FOUND THEN
        INSERT INTO super_admin_audit_log (action, details, ip_address, user_agent, success, created_at)
        VALUES ('LOGIN_FAILED', jsonb_build_object('email', p_email, 'reason', 'Email not found'),
                p_ip_address, p_user_agent, FALSE, NOW());
        RETURN;
    END IF;

    IF v_admin.is_locked THEN
        INSERT INTO super_admin_audit_log (super_admin_id, action, details, ip_address, user_agent, success, created_at)
        VALUES (v_admin.id, 'LOGIN_BLOCKED', jsonb_build_object('reason', 'Account locked', 'lock_reason', v_admin.lock_reason),
                p_ip_address, p_user_agent, FALSE, NOW());
        RETURN;
    END IF;

    IF NOT v_admin.is_active THEN
        INSERT INTO super_admin_audit_log (super_admin_id, action, details, ip_address, user_agent, success, created_at)
        VALUES (v_admin.id, 'LOGIN_BLOCKED', jsonb_build_object('reason', 'Account inactive'),
                p_ip_address, p_user_agent, FALSE, NOW());
        RETURN;
    END IF;

    RETURN QUERY
    SELECT v_admin.id, v_admin.email, v_admin.password_hash, v_admin.full_name,
           v_admin.is_active, v_admin.is_locked, v_admin.two_factor_enabled,
           v_admin.password_must_change, v_admin.last_login;
END;
$$ LANGUAGE plpgsql;

-- Function: record_super_admin_login (THE CRITICAL MISSING FUNCTION!)
CREATE OR REPLACE FUNCTION record_super_admin_login(
    p_super_admin_id UUID,
    p_session_id VARCHAR,
    p_token_hash TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Update last login
    UPDATE super_admins
    SET last_login = NOW(),
        failed_login_attempts = 0,
        last_failed_login = NULL
    WHERE id = p_super_admin_id;

    -- Create session
    INSERT INTO super_admin_sessions (
        super_admin_id, session_id, token_hash, ip_address, user_agent, expires_at
    ) VALUES (
        p_super_admin_id, p_session_id, p_token_hash, p_ip_address, p_user_agent, p_expires_at
    ) RETURNING id INTO v_session_id;

    -- Log successful login
    INSERT INTO super_admin_audit_log (
        super_admin_id, action, details, ip_address, user_agent, success, created_at
    ) VALUES (
        p_super_admin_id, 'LOGIN_SUCCESS', jsonb_build_object('session_id', p_session_id),
        p_ip_address, p_user_agent, TRUE, NOW()
    );

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function: record_super_admin_failed_login
CREATE OR REPLACE FUNCTION record_super_admin_failed_login(
    p_email VARCHAR,
    p_super_admin_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'Invalid credentials'
)
RETURNS VOID AS $$
DECLARE
    v_attempts INTEGER;
BEGIN
    IF p_super_admin_id IS NOT NULL THEN
        UPDATE super_admins
        SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW()
        WHERE id = p_super_admin_id
        RETURNING failed_login_attempts INTO v_attempts;

        IF v_attempts >= 5 THEN
            UPDATE super_admins
            SET is_locked = TRUE, locked_at = NOW(), lock_reason = 'Too many failed login attempts'
            WHERE id = p_super_admin_id;

            INSERT INTO super_admin_audit_log (super_admin_id, action, details, ip_address, user_agent, created_at)
            VALUES (p_super_admin_id, 'ACCOUNT_LOCKED',
                    jsonb_build_object('reason', 'Too many failed login attempts', 'attempts', v_attempts),
                    p_ip_address, p_user_agent, NOW());
        END IF;
    END IF;

    INSERT INTO super_admin_audit_log (super_admin_id, action, details, ip_address, user_agent, success, error_message, created_at)
    VALUES (p_super_admin_id, 'LOGIN_FAILED', jsonb_build_object('email', p_email, 'reason', p_reason),
            p_ip_address, p_user_agent, FALSE, p_reason, NOW());
END;
$$ LANGUAGE plpgsql;

-- Function: revoke_super_admin_session
CREATE OR REPLACE FUNCTION revoke_super_admin_session(
    p_session_id VARCHAR,
    p_reason TEXT DEFAULT 'Manual logout'
)
RETURNS VOID AS $$
BEGIN
    UPDATE super_admin_sessions
    SET is_active = FALSE, revoked_at = NOW(), revoke_reason = p_reason
    WHERE session_id = p_session_id;

    INSERT INTO super_admin_audit_log (super_admin_id, action, details, created_at)
    VALUES (
        (SELECT super_admin_id FROM super_admin_sessions WHERE session_id = p_session_id),
        'SESSION_REVOKED', jsonb_build_object('session_id', p_session_id, 'reason', p_reason), NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies (safe to run multiple times)
DROP POLICY IF EXISTS "Super admins can view all super admins" ON super_admins;
DROP POLICY IF EXISTS "System can manage super admins" ON super_admins;
DROP POLICY IF EXISTS "Super admins can view sessions" ON super_admin_sessions;
DROP POLICY IF EXISTS "System can manage sessions" ON super_admin_sessions;
DROP POLICY IF EXISTS "Super admins can view audit log" ON super_admin_audit_log;
DROP POLICY IF EXISTS "System can insert audit log" ON super_admin_audit_log;

CREATE POLICY "Super admins can view all super admins" ON super_admins FOR SELECT USING (true);
CREATE POLICY "System can manage super admins" ON super_admins FOR ALL USING (true);
CREATE POLICY "Super admins can view sessions" ON super_admin_sessions FOR SELECT USING (true);
CREATE POLICY "System can manage sessions" ON super_admin_sessions FOR ALL USING (true);
CREATE POLICY "Super admins can view audit log" ON super_admin_audit_log FOR SELECT USING (true);
CREATE POLICY "System can insert audit log" ON super_admin_audit_log FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON super_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON super_admin_sessions TO authenticated;
GRANT SELECT, INSERT ON super_admin_audit_log TO authenticated;
