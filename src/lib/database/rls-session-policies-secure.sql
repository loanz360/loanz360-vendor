/**
 * Secure RLS Policies for Session and Blacklist Tables
 * These policies ensure anon key can ONLY read session status, not modify
 */

-- ============================================================================
-- DROP EXISTING PERMISSIVE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "System can manage sessions" ON user_sessions;
DROP POLICY IF EXISTS "System can insert blacklist entries" ON token_blacklist;

-- ============================================================================
-- SUPER ADMIN SESSIONS - Read-only for session validation
-- ============================================================================

-- Allow reading session status for validation (edge middleware needs this)
CREATE POLICY "Allow session status check"
    ON super_admin_sessions FOR SELECT
    USING (true);  -- Allow reading session status

-- Prevent any modifications via anon key
CREATE POLICY "Prevent anon key modifications"
    ON super_admin_sessions FOR ALL
    USING (false)
    WITH CHECK (false);

-- ============================================================================
-- USER SESSIONS - Read-only for session validation
-- ============================================================================

-- Allow reading session status for validation
CREATE POLICY "Allow user session status check"
    ON user_sessions FOR SELECT
    USING (true);

-- Prevent modifications via anon key
CREATE POLICY "Prevent user session anon modifications"
    ON user_sessions FOR ALL
    USING (false)
    WITH CHECK (false);

-- ============================================================================
-- TOKEN BLACKLIST - Read-only for checking
-- ============================================================================

-- Allow reading blacklist for token validation
CREATE POLICY "Allow blacklist read for validation"
    ON token_blacklist FOR SELECT
    USING (true);

-- Prevent modifications via anon key
CREATE POLICY "Prevent blacklist anon modifications"
    ON token_blacklist FOR ALL
    USING (false)
    WITH CHECK (false);

-- ============================================================================
-- NOTES
-- ============================================================================

/**
 * SECURITY NOTES:
 *
 * 1. Anon key can ONLY read session/blacklist status
 * 2. Anon key CANNOT create, update, or delete sessions
 * 3. All modifications must use service role key from server-side API routes
 * 4. This allows edge middleware to validate sessions safely
 * 5. Even if anon key is exposed, it cannot modify critical data
 *
 * IMPORTANT:
 * - Session creation/updates must happen in API routes (server-side)
 * - API routes use service role key (never exposed to client)
 * - Edge middleware uses anon key (safe to expose)
 */
