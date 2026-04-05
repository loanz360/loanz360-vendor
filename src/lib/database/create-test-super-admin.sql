-- Create Test Super Admin Account for LOANZ 360
-- This script creates a test super admin account for development/testing
-- SECURITY WARNING: Change credentials before production deployment

-- Insert test super admin
-- Email: superadmin@loanz360.com
-- Password: bq7ia0VhS1Q$QPcPWm8M (from .env.local SUPER_ADMIN_PASSWORD_HASH)
-- Password Hash: $2b$12$s6QBMoLoE/xy8V9n0ao6AO82zHvVHGr7xSIg5Qe3.CE1ll9Ct4SZi

INSERT INTO super_admins (
    id,
    email,
    password_hash,
    full_name,
    is_active,
    two_factor_enabled,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'superadmin@loanz360.com',
    '$2b$12$s6QBMoLoE/xy8V9n0ao6AO82zHvVHGr7xSIg5Qe3.CE1ll9Ct4SZi',
    'System Super Admin',
    true,
    false,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Verify the super admin was created
SELECT
    id,
    email,
    full_name,
    is_active,
    two_factor_enabled,
    created_at
FROM super_admins
WHERE email = 'superadmin@loanz360.com';

-- Expected result:
-- The query should return 1 row with the super admin details
-- If no rows are returned, the email already exists or there was an error
