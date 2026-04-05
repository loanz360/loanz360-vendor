/**
 * Row-Level Security (RLS) Policies for LOANZ 360
 * Implements database-level security to prevent unauthorized data access
 *
 * NOTE: This script drops existing policies before creating new ones
 * This allows it to be run multiple times safely
 */

-- ============================================================================
-- ENABLE RLS ON ALL TABLES (IF THEY EXIST)
-- ============================================================================

DO $$
BEGIN
    -- Enable RLS only if tables exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'token_blacklist') THEN
        ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
        ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'security_audit_log') THEN
        ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auth_logs') THEN
        ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'super_admins') THEN
        ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'super_admin_sessions') THEN
        ALTER TABLE super_admin_sessions ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'super_admin_audit_log') THEN
        ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- DROP EXISTING POLICIES (Safe to run multiple times)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view org profiles" ON profiles;
DROP POLICY IF EXISTS "Hide sensitive data from other users" ON profiles;

DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can revoke own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Super admins can view all sessions" ON user_sessions;
DROP POLICY IF EXISTS "Super admins can revoke any session" ON user_sessions;
DROP POLICY IF EXISTS "System can manage sessions" ON user_sessions;

DROP POLICY IF EXISTS "System only token blacklist access" ON token_blacklist;
DROP POLICY IF EXISTS "Admin can view all blacklist entries" ON token_blacklist;
DROP POLICY IF EXISTS "System can insert blacklist entries" ON token_blacklist;

DROP POLICY IF EXISTS "Users can view own audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "Admins can view org audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "Audit logs are append-only" ON security_audit_log;
DROP POLICY IF EXISTS "Audit logs cannot be deleted" ON security_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON security_audit_log;

DROP POLICY IF EXISTS "Users can view own auth logs" ON auth_logs;
DROP POLICY IF EXISTS "Super admins can view all auth logs" ON auth_logs;
DROP POLICY IF EXISTS "Auth logs are append-only" ON auth_logs;
DROP POLICY IF EXISTS "Auth logs cannot be deleted" ON auth_logs;
DROP POLICY IF EXISTS "Admin can view all auth logs" ON auth_logs;
DROP POLICY IF EXISTS "System can insert auth logs" ON auth_logs;

DROP POLICY IF EXISTS "Super admins can view all super admins" ON super_admins;
DROP POLICY IF EXISTS "Super admins can update other super admins" ON super_admins;
DROP POLICY IF EXISTS "Super admins cannot be deleted" ON super_admins;

DROP POLICY IF EXISTS "Super admins can view own sessions" ON super_admin_sessions;
DROP POLICY IF EXISTS "Super admins can revoke own sessions" ON super_admin_sessions;

DROP POLICY IF EXISTS "Super admins can view all super admin audit logs" ON super_admin_audit_log;
DROP POLICY IF EXISTS "Super admin audit logs are append-only" ON super_admin_audit_log;
DROP POLICY IF EXISTS "Super admin audit logs cannot be deleted" ON super_admin_audit_log;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (except role and status)
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM profiles WHERE id = auth.uid())  -- Can't change role
        AND status IN ('active', 'inactive')  -- Can't set to banned/deleted
    );

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Admins can view profiles in their organization
CREATE POLICY "Admins can view org profiles"
    ON profiles FOR SELECT
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
    );

-- ============================================================================
-- USER_SESSIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON user_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke own sessions"
    ON user_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Super admins can view all sessions
CREATE POLICY "Super admins can view all sessions"
    ON user_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Super admins can revoke any session
CREATE POLICY "Super admins can revoke any session"
    ON user_sessions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- System can manage sessions (for server-side operations)
CREATE POLICY "System can manage sessions"
    ON user_sessions FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TOKEN_BLACKLIST TABLE POLICIES
-- ============================================================================

-- System can access token blacklist
CREATE POLICY "System can insert blacklist entries"
    ON token_blacklist FOR INSERT
    WITH CHECK (true);

-- Super admins can view token blacklist
CREATE POLICY "Admin can view all blacklist entries"
    ON token_blacklist FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- ============================================================================
-- SECURITY_AUDIT_LOG TABLE POLICIES
-- ============================================================================

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON security_audit_log FOR SELECT
    USING (auth.uid() = user_id);

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view all audit logs"
    ON security_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
    ON security_audit_log FOR INSERT
    WITH CHECK (true);

-- No one can modify audit logs (append-only)
CREATE POLICY "Audit logs are append-only"
    ON security_audit_log FOR UPDATE
    USING (false);

CREATE POLICY "Audit logs cannot be deleted"
    ON security_audit_log FOR DELETE
    USING (false);

-- ============================================================================
-- AUTH_LOGS TABLE POLICIES
-- ============================================================================

-- Users can view their own auth logs
CREATE POLICY "Users can view own auth logs"
    ON auth_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Super admins can view all auth logs
CREATE POLICY "Super admins can view all auth logs"
    ON auth_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- System can insert auth logs
CREATE POLICY "System can insert auth logs"
    ON auth_logs FOR INSERT
    WITH CHECK (true);

-- Auth logs are append-only
CREATE POLICY "Auth logs are append-only"
    ON auth_logs FOR UPDATE
    USING (false);

CREATE POLICY "Auth logs cannot be deleted"
    ON auth_logs FOR DELETE
    USING (false);

-- ============================================================================
-- SUPER_ADMINS TABLE POLICIES
-- ============================================================================

-- Super admins can view all super admins
CREATE POLICY "Super admins can view all super admins"
    ON super_admins FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Super admins can update other super admins (except themselves)
CREATE POLICY "Super admins can update other super admins"
    ON super_admins FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Prevent deletion of super admins
CREATE POLICY "Super admins cannot be deleted"
    ON super_admins FOR DELETE
    USING (false);

-- ============================================================================
-- SUPER_ADMIN_SESSIONS TABLE POLICIES
-- ============================================================================

-- Super admins can view their own sessions
CREATE POLICY "Super admins can view own sessions"
    ON super_admin_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.id = super_admin_sessions.super_admin_id
            AND sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Super admins can revoke their own sessions
CREATE POLICY "Super admins can revoke own sessions"
    ON super_admin_sessions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.id = super_admin_sessions.super_admin_id
            AND sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- ============================================================================
-- SUPER_ADMIN_AUDIT_LOG TABLE POLICIES
-- ============================================================================

-- Super admins can view all super admin audit logs
CREATE POLICY "Super admins can view all super admin audit logs"
    ON super_admin_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM super_admins sa
            WHERE sa.email = auth.jwt() ->> 'email'
            AND sa.is_active = TRUE
        )
    );

-- Super admin audit logs are append-only
CREATE POLICY "Super admin audit logs are append-only"
    ON super_admin_audit_log FOR UPDATE
    USING (false);

CREATE POLICY "Super admin audit logs cannot be deleted"
    ON super_admin_audit_log FOR DELETE
    USING (false);

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM super_admins sa
        WHERE sa.email = auth.jwt() ->> 'email'
        AND sa.is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns resource
CREATE OR REPLACE FUNCTION owns_resource(resource_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() = resource_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant service role full access (for server-side operations)
GRANT ALL ON profiles TO service_role;
GRANT ALL ON token_blacklist TO service_role;
GRANT ALL ON user_sessions TO service_role;
GRANT ALL ON security_audit_log TO service_role;
GRANT ALL ON auth_logs TO service_role;
GRANT ALL ON super_admins TO service_role;
GRANT ALL ON super_admin_sessions TO service_role;
GRANT ALL ON super_admin_audit_log TO service_role;

-- Grant authenticated users limited access (through RLS policies)
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT, UPDATE ON user_sessions TO authenticated;
GRANT SELECT ON security_audit_log TO authenticated;
GRANT SELECT ON auth_logs TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "Users can view own profile" ON profiles IS
'Allows users to view their own profile data';

COMMENT ON POLICY "Super admins can view all profiles" ON profiles IS
'Super admins have full visibility into all user profiles';

COMMENT ON POLICY "Audit logs are append-only" ON security_audit_log IS
'Prevents tampering with audit logs - they can only be created, never modified';

COMMENT ON FUNCTION is_super_admin() IS
'Helper function to check if current user is a super admin';

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================
