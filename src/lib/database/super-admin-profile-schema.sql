-- Super Admin Profile Enhancement Schema for LOANZ 360
-- Enterprise-Grade Profile Management System
-- Version: 2.0

-- =====================================================
-- EXTEND PROFILES TABLE FOR SUPER ADMIN ENHANCED FIELDS
-- =====================================================

-- Add extended profile fields to existing profiles table
-- Run these ALTER statements if the columns don't exist

DO $$
BEGIN
    -- Personal Information Extensions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
        ALTER TABLE profiles ADD COLUMN display_name VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'secondary_email') THEN
        ALTER TABLE profiles ADD COLUMN secondary_email VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'secondary_mobile') THEN
        ALTER TABLE profiles ADD COLUMN secondary_mobile VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'country_code') THEN
        ALTER TABLE profiles ADD COLUMN country_code VARCHAR(10) DEFAULT '+91';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'timezone') THEN
        ALTER TABLE profiles ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'language') THEN
        ALTER TABLE profiles ADD COLUMN language VARCHAR(10) DEFAULT 'en';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'date_of_birth') THEN
        ALTER TABLE profiles ADD COLUMN date_of_birth DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'digital_signature_url') THEN
        ALTER TABLE profiles ADD COLUMN digital_signature_url TEXT;
    END IF;

    -- Organization Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'department') THEN
        ALTER TABLE profiles ADD COLUMN department VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'designation') THEN
        ALTER TABLE profiles ADD COLUMN designation VARCHAR(100);
    END IF;

    -- Security & Authentication
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_enabled') THEN
        ALTER TABLE profiles ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_method') THEN
        ALTER TABLE profiles ADD COLUMN two_factor_method VARCHAR(20); -- '2fa_sms', '2fa_email', '2fa_app'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_at') THEN
        ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_ip') THEN
        ALTER TABLE profiles ADD COLUMN last_login_ip INET;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'login_alerts_enabled') THEN
        ALTER TABLE profiles ADD COLUMN login_alerts_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'suspicious_activity_alerts') THEN
        ALTER TABLE profiles ADD COLUMN suspicious_activity_alerts BOOLEAN DEFAULT TRUE;
    END IF;

    -- Preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme_preference') THEN
        ALTER TABLE profiles ADD COLUMN theme_preference VARCHAR(20) DEFAULT 'dark'; -- 'light', 'dark', 'system'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'grid_layout') THEN
        ALTER TABLE profiles ADD COLUMN grid_layout VARCHAR(20) DEFAULT 'comfortable'; -- 'compact', 'comfortable', 'spacious'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notification_preferences') THEN
        ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "inApp": true, "push": false}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'accessibility_settings') THEN
        ALTER TABLE profiles ADD COLUMN accessibility_settings JSONB DEFAULT '{"highContrast": false, "reducedMotion": false, "largeText": false}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'default_dashboard') THEN
        ALTER TABLE profiles ADD COLUMN default_dashboard VARCHAR(50) DEFAULT 'main';
    END IF;

END $$;

-- =====================================================
-- COMPLIANCE DOCUMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'pan_card', 'aadhaar', 'passport', 'driving_license', etc.
    document_name VARCHAR(255) NOT NULL,
    document_url TEXT NOT NULL,
    document_hash TEXT, -- For integrity verification
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'expired'
    verification_notes TEXT,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    expiry_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'rejected', 'expired'))
);

-- Indexes for compliance documents
CREATE INDEX IF NOT EXISTS idx_compliance_docs_user_id ON compliance_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_status ON compliance_documents(status);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON compliance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_expiry ON compliance_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- =====================================================
-- PROFILE VERSIONS TABLE (For History Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS profile_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    profile_snapshot JSONB NOT NULL, -- Complete profile at this version
    changed_fields TEXT[], -- List of fields that were changed
    change_summary TEXT,
    changed_by UUID REFERENCES auth.users(id),
    change_reason VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_user_version UNIQUE (user_id, version_number)
);

-- Indexes for profile versions
CREATE INDEX IF NOT EXISTS idx_profile_versions_user_id ON profile_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_versions_created_at ON profile_versions(created_at);

-- =====================================================
-- DELEGATED ACCESS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS delegated_admin_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delegator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Super Admin granting access
    delegate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User receiving access
    access_level VARCHAR(50) NOT NULL, -- 'full', 'read_only', 'limited'
    permissions JSONB DEFAULT '{}'::jsonb, -- Specific permissions granted
    reason TEXT NOT NULL,
    is_temporary BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_access_level CHECK (access_level IN ('full', 'read_only', 'limited')),
    CONSTRAINT different_users CHECK (delegator_id != delegate_id)
);

-- Indexes for delegated access
CREATE INDEX IF NOT EXISTS idx_delegated_access_delegator ON delegated_admin_access(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegated_access_delegate ON delegated_admin_access(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegated_access_active ON delegated_admin_access(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_delegated_access_expires ON delegated_admin_access(expires_at) WHERE is_temporary = TRUE;

-- =====================================================
-- API TOKENS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_name VARCHAR(100) NOT NULL,
    token_hash TEXT NOT NULL, -- Hashed token for security
    token_prefix VARCHAR(10) NOT NULL, -- First few chars for identification
    scopes TEXT[] DEFAULT '{}', -- API scopes/permissions
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_token_name_per_user UNIQUE (user_id, token_name)
);

-- Indexes for API tokens
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_active ON api_tokens(is_active) WHERE is_active = TRUE;

-- =====================================================
-- SECURITY QUESTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS security_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL, -- References predefined question list
    answer_hash TEXT NOT NULL, -- Hashed answer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_question_per_user UNIQUE (user_id, question_id)
);

-- Index for security questions
CREATE INDEX IF NOT EXISTS idx_security_questions_user_id ON security_questions(user_id);

-- =====================================================
-- PROFILE LOCK TABLE (For Approval Workflows)
-- =====================================================

CREATE TABLE IF NOT EXISTS profile_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    locked_by UUID NOT NULL REFERENCES auth.users(id),
    lock_reason TEXT NOT NULL,
    lock_type VARCHAR(50) DEFAULT 'pending_approval', -- 'pending_approval', 'security_review', 'compliance_hold'
    pending_changes JSONB, -- Changes awaiting approval
    is_locked BOOLEAN DEFAULT TRUE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_lock_type CHECK (lock_type IN ('pending_approval', 'security_review', 'compliance_hold'))
);

-- Indexes for profile locks
CREATE INDEX IF NOT EXISTS idx_profile_locks_user_id ON profile_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_locks_active ON profile_locks(is_locked) WHERE is_locked = TRUE;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to create a profile version snapshot
CREATE OR REPLACE FUNCTION create_profile_version(
    p_user_id UUID,
    p_changed_fields TEXT[],
    p_change_summary TEXT,
    p_changed_by UUID DEFAULT NULL,
    p_change_reason VARCHAR DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_version_number INTEGER;
    v_profile_snapshot JSONB;
BEGIN
    -- Get the next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM profile_versions
    WHERE user_id = p_user_id;

    -- Get current profile data
    SELECT row_to_json(p.*)::jsonb INTO v_profile_snapshot
    FROM profiles p
    WHERE p.user_id = p_user_id;

    -- Insert version record
    INSERT INTO profile_versions (
        user_id,
        version_number,
        profile_snapshot,
        changed_fields,
        change_summary,
        changed_by,
        change_reason,
        ip_address,
        user_agent
    ) VALUES (
        p_user_id,
        v_version_number,
        v_profile_snapshot,
        p_changed_fields,
        p_change_summary,
        p_changed_by,
        p_change_reason,
        p_ip_address,
        p_user_agent
    );

    RETURN v_version_number;
END;
$$ LANGUAGE plpgsql;

-- Function to check for expiring documents
CREATE OR REPLACE FUNCTION get_expiring_documents(p_days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
    document_id UUID,
    user_id UUID,
    document_type VARCHAR,
    document_name VARCHAR,
    expiry_date DATE,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.id,
        cd.user_id,
        cd.document_type,
        cd.document_name,
        cd.expiry_date,
        (cd.expiry_date - CURRENT_DATE)::INTEGER AS days_until_expiry
    FROM compliance_documents cd
    WHERE cd.expiry_date IS NOT NULL
    AND cd.expiry_date <= (CURRENT_DATE + p_days_ahead)
    AND cd.expiry_date >= CURRENT_DATE
    AND cd.status = 'verified'
    ORDER BY cd.expiry_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke expired delegated access
CREATE OR REPLACE FUNCTION revoke_expired_delegated_access()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE delegated_admin_access
    SET
        is_active = FALSE,
        revoked_at = NOW(),
        revoke_reason = 'Auto-revoked: Access period expired'
    WHERE is_active = TRUE
    AND is_temporary = TRUE
    AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegated_admin_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_locks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own documents" ON compliance_documents;
DROP POLICY IF EXISTS "Users can view their own profile versions" ON profile_versions;
DROP POLICY IF EXISTS "Users can view delegated access involving them" ON delegated_admin_access;
DROP POLICY IF EXISTS "Users can view their own API tokens" ON api_tokens;
DROP POLICY IF EXISTS "Users can view their own security questions" ON security_questions;
DROP POLICY IF EXISTS "Users can view their own profile locks" ON profile_locks;

-- Create policies
CREATE POLICY "Users can view their own documents" ON compliance_documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile versions" ON profile_versions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view delegated access involving them" ON delegated_admin_access
    FOR SELECT USING (auth.uid() = delegator_id OR auth.uid() = delegate_id);

CREATE POLICY "Users can view their own API tokens" ON api_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own security questions" ON security_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile locks" ON profile_locks
    FOR SELECT USING (auth.uid() = user_id);

-- System-level policies for admin operations
CREATE POLICY "System can manage all compliance documents" ON compliance_documents FOR ALL USING (true);
CREATE POLICY "System can manage all profile versions" ON profile_versions FOR ALL USING (true);
CREATE POLICY "System can manage all delegated access" ON delegated_admin_access FOR ALL USING (true);
CREATE POLICY "System can manage all API tokens" ON api_tokens FOR ALL USING (true);
CREATE POLICY "System can manage all security questions" ON security_questions FOR ALL USING (true);
CREATE POLICY "System can manage all profile locks" ON profile_locks FOR ALL USING (true);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_documents TO authenticated;
GRANT SELECT, INSERT ON profile_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON delegated_admin_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profile_locks TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE compliance_documents IS 'Stores KYC and compliance documents for users with verification status';
COMMENT ON TABLE profile_versions IS 'Maintains version history of profile changes for audit trail';
COMMENT ON TABLE delegated_admin_access IS 'Manages temporary or permanent delegated access to admin functions';
COMMENT ON TABLE api_tokens IS 'Stores API tokens for programmatic access';
COMMENT ON TABLE security_questions IS 'Stores hashed security question answers for account recovery';
COMMENT ON TABLE profile_locks IS 'Manages profile locks for approval workflows';

COMMENT ON FUNCTION create_profile_version IS 'Creates a new profile version snapshot for history tracking';
COMMENT ON FUNCTION get_expiring_documents IS 'Returns documents expiring within specified days';
COMMENT ON FUNCTION revoke_expired_delegated_access IS 'Auto-revokes expired temporary delegated access';
