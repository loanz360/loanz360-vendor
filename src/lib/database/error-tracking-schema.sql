-- Error Tracking Database Schema for LOANZ 360
-- This schema creates tables for tracking client-side and server-side errors

-- Client-side errors table
CREATE TABLE IF NOT EXISTS client_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    error_id VARCHAR(255) NOT NULL UNIQUE,
    error_type VARCHAR(50) NOT NULL CHECK (error_type IN ('javascript', 'unhandled_rejection', 'network', 'api', 'auth')),
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT NOT NULL,
    user_agent TEXT,
    ip_address INET,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    additional_data JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT
);

-- Server-side errors table
CREATE TABLE IF NOT EXISTS server_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    error_id VARCHAR(255) NOT NULL UNIQUE,
    error_type VARCHAR(50) NOT NULL CHECK (error_type IN ('api', 'database', 'auth', 'middleware', 'system')),
    message TEXT NOT NULL,
    stack TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    request_data JSONB,
    response_data JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT
);

-- Error patterns table for identifying recurring issues
CREATE TABLE IF NOT EXISTS error_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_name VARCHAR(255) NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    message_pattern TEXT NOT NULL,
    stack_pattern TEXT,
    url_pattern TEXT,
    frequency_threshold INTEGER DEFAULT 5,
    time_window_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error pattern matches table
CREATE TABLE IF NOT EXISTS error_pattern_matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_id UUID REFERENCES error_patterns(id) ON DELETE CASCADE,
    client_error_id UUID REFERENCES client_errors(id) ON DELETE CASCADE,
    server_error_id UUID REFERENCES server_errors(id) ON DELETE CASCADE,
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT error_pattern_matches_single_error CHECK (
        (client_error_id IS NOT NULL AND server_error_id IS NULL) OR
        (client_error_id IS NULL AND server_error_id IS NOT NULL)
    )
);

-- Error notifications table for alerting
CREATE TABLE IF NOT EXISTS error_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    error_type VARCHAR(50) NOT NULL,
    pattern_id UUID REFERENCES error_patterns(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'slack', 'webhook')),
    recipients JSONB NOT NULL,
    threshold_count INTEGER DEFAULT 1,
    time_window_minutes INTEGER DEFAULT 60,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_errors_error_type ON client_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_client_errors_occurred_at ON client_errors(occurred_at);
CREATE INDEX IF NOT EXISTS idx_client_errors_user_id ON client_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_client_errors_resolved ON client_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_client_errors_url ON client_errors USING gin(to_tsvector('english', url));
CREATE INDEX IF NOT EXISTS idx_client_errors_message ON client_errors USING gin(to_tsvector('english', message));

CREATE INDEX IF NOT EXISTS idx_server_errors_error_type ON server_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_server_errors_occurred_at ON server_errors(occurred_at);
CREATE INDEX IF NOT EXISTS idx_server_errors_endpoint ON server_errors(endpoint);
CREATE INDEX IF NOT EXISTS idx_server_errors_status_code ON server_errors(status_code);
CREATE INDEX IF NOT EXISTS idx_server_errors_user_id ON server_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_server_errors_resolved ON server_errors(resolved);

CREATE INDEX IF NOT EXISTS idx_error_pattern_matches_pattern_id ON error_pattern_matches(pattern_id);
CREATE INDEX IF NOT EXISTS idx_error_pattern_matches_client_error_id ON error_pattern_matches(client_error_id);
CREATE INDEX IF NOT EXISTS idx_error_pattern_matches_server_error_id ON error_pattern_matches(server_error_id);

-- Functions for error analysis
CREATE OR REPLACE FUNCTION get_error_summary(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    error_type TEXT,
    error_count BIGINT,
    unique_users BIGINT,
    most_common_message TEXT,
    first_occurrence TIMESTAMP WITH TIME ZONE,
    last_occurrence TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH combined_errors AS (
        SELECT
            ce.error_type::TEXT as error_type,
            ce.message,
            ce.user_id,
            ce.occurred_at
        FROM client_errors ce
        WHERE ce.occurred_at BETWEEN start_date AND end_date

        UNION ALL

        SELECT
            se.error_type::TEXT as error_type,
            se.message,
            se.user_id,
            se.occurred_at
        FROM server_errors se
        WHERE se.occurred_at BETWEEN start_date AND end_date
    ),
    error_stats AS (
        SELECT
            ce.error_type,
            COUNT(*) as error_count,
            COUNT(DISTINCT ce.user_id) as unique_users,
            MIN(ce.occurred_at) as first_occurrence,
            MAX(ce.occurred_at) as last_occurrence,
            MODE() WITHIN GROUP (ORDER BY ce.message) as most_common_message
        FROM combined_errors ce
        GROUP BY ce.error_type
    )
    SELECT
        es.error_type,
        es.error_count,
        es.unique_users,
        es.most_common_message,
        es.first_occurrence,
        es.last_occurrence
    FROM error_stats es
    ORDER BY es.error_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect error patterns
CREATE OR REPLACE FUNCTION detect_error_patterns()
RETURNS TABLE (
    pattern_name TEXT,
    error_count BIGINT,
    affected_users BIGINT,
    time_span INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    WITH client_error_groups AS (
        SELECT
            SUBSTRING(message FROM 1 FOR 100) as pattern_key,
            error_type,
            COUNT(*) as error_count,
            COUNT(DISTINCT user_id) as affected_users,
            MAX(occurred_at) - MIN(occurred_at) as time_span
        FROM client_errors
        WHERE occurred_at >= NOW() - INTERVAL '24 hours'
        AND resolved = FALSE
        GROUP BY SUBSTRING(message FROM 1 FOR 100), error_type
        HAVING COUNT(*) >= 3
    ),
    server_error_groups AS (
        SELECT
            SUBSTRING(message FROM 1 FOR 100) as pattern_key,
            error_type,
            COUNT(*) as error_count,
            COUNT(DISTINCT user_id) as affected_users,
            MAX(occurred_at) - MIN(occurred_at) as time_span
        FROM server_errors
        WHERE occurred_at >= NOW() - INTERVAL '24 hours'
        AND resolved = FALSE
        GROUP BY SUBSTRING(message FROM 1 FOR 100), error_type
        HAVING COUNT(*) >= 3
    ),
    combined_patterns AS (
        SELECT * FROM client_error_groups
        UNION ALL
        SELECT * FROM server_error_groups
    )
    SELECT
        cp.error_type || ': ' || cp.pattern_key as pattern_name,
        cp.error_count,
        cp.affected_users,
        cp.time_span
    FROM combined_patterns cp
    ORDER BY cp.error_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old resolved errors
CREATE OR REPLACE FUNCTION cleanup_old_errors()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    server_resolved INTEGER := 0;
    client_unresolved INTEGER := 0;
    server_unresolved INTEGER := 0;
BEGIN
    -- Delete resolved errors older than 90 days
    DELETE FROM client_errors
    WHERE resolved = TRUE
    AND resolved_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    DELETE FROM server_errors
    WHERE resolved = TRUE
    AND resolved_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS server_resolved = ROW_COUNT;

    -- Delete unresolved errors older than 1 year
    DELETE FROM client_errors
    WHERE resolved = FALSE
    AND created_at < NOW() - INTERVAL '1 year';

    GET DIAGNOSTICS client_unresolved = ROW_COUNT;

    DELETE FROM server_errors
    WHERE resolved = FALSE
    AND created_at < NOW() - INTERVAL '1 year';

    GET DIAGNOSTICS server_unresolved = ROW_COUNT;

    -- Add all counts together
    deleted_count := deleted_count + server_resolved + client_unresolved + server_unresolved;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_pattern_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for admin and super admin access
CREATE POLICY "Admin can view all errors" ON client_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Admin can update all errors" ON client_errors
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "System can insert client errors" ON client_errors
    FOR INSERT WITH CHECK (true);

-- Similar policies for server_errors
CREATE POLICY "Admin can view all server errors" ON server_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Admin can update all server errors" ON server_errors
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "System can insert server errors" ON server_errors
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON client_errors TO authenticated;
GRANT SELECT, INSERT ON server_errors TO authenticated;
GRANT ALL ON error_patterns TO authenticated;
GRANT ALL ON error_pattern_matches TO authenticated;
GRANT ALL ON error_notifications TO authenticated;

-- Create a scheduled job to clean up old errors (if pg_cron is available)
-- SELECT cron.schedule('cleanup-old-errors', '0 2 * * 0', 'SELECT cleanup_old_errors();');

COMMENT ON TABLE client_errors IS 'Stores client-side JavaScript errors and exceptions';
COMMENT ON TABLE server_errors IS 'Stores server-side API and system errors';
COMMENT ON TABLE error_patterns IS 'Defines patterns for identifying recurring error types';
COMMENT ON TABLE error_pattern_matches IS 'Links specific errors to identified patterns';
COMMENT ON TABLE error_notifications IS 'Configuration for error alerting and notifications';