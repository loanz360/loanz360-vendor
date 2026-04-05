-- ============================================================================
-- WorkDrive Database Schema
-- Enterprise-grade Document Management System
-- Version: 1.0.0
-- ============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. WORKSPACES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('personal', 'team', 'department', 'organization')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_workspace_id UUID REFERENCES workdrive_workspaces(id) ON DELETE CASCADE,
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10GB default
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for workspaces
CREATE INDEX IF NOT EXISTS idx_workdrive_workspaces_owner ON workdrive_workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_workspaces_type ON workdrive_workspaces(type);
CREATE INDEX IF NOT EXISTS idx_workdrive_workspaces_parent ON workdrive_workspaces(parent_workspace_id);

-- ============================================================================
-- 2. FOLDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workdrive_workspaces(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES workdrive_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280',
  path TEXT NOT NULL,
  depth INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_shared BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, parent_folder_id, name)
);

-- Indexes for folders
CREATE INDEX IF NOT EXISTS idx_workdrive_folders_workspace ON workdrive_folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_folders_parent ON workdrive_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_folders_path ON workdrive_folders(path);
CREATE INDEX IF NOT EXISTS idx_workdrive_folders_created_by ON workdrive_folders(created_by);

-- ============================================================================
-- 3. FILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workdrive_workspaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES workdrive_folders(id) ON DELETE SET NULL,
  name VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_category VARCHAR(50) DEFAULT 'other' CHECK (file_category IN ('document', 'image', 'spreadsheet', 'presentation', 'archive', 'other')),
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  s3_key VARCHAR(1000) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  s3_region VARCHAR(50) NOT NULL,
  thumbnail_s3_key VARCHAR(1000),
  version_number INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  previous_version_id UUID REFERENCES workdrive_files(id) ON DELETE SET NULL,
  checksum VARCHAR(64),
  is_compressed BOOLEAN DEFAULT false,
  compression_ratio DECIMAL(5,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_locked BOOLEAN DEFAULT false,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  permanent_delete_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for files
CREATE INDEX IF NOT EXISTS idx_workdrive_files_workspace ON workdrive_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_folder ON workdrive_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_created_by ON workdrive_files(created_by);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_deleted ON workdrive_files(is_deleted, permanent_delete_at);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_type ON workdrive_files(file_type);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_category ON workdrive_files(file_category);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_name ON workdrive_files(name);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_checksum ON workdrive_files(checksum);
CREATE INDEX IF NOT EXISTS idx_workdrive_files_tags ON workdrive_files USING GIN(tags);

-- ============================================================================
-- 4. PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('workspace', 'folder', 'file')),
  resource_id UUID NOT NULL,
  grantee_type VARCHAR(20) NOT NULL CHECK (grantee_type IN ('user', 'team', 'department', 'role')),
  grantee_id UUID NOT NULL,
  permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('viewer', 'commenter', 'editor', 'admin', 'owner')),
  can_download BOOLEAN DEFAULT true,
  can_share BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_manage_permissions BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  is_inherited BOOLEAN DEFAULT false,
  inherited_from UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_type, resource_id, grantee_type, grantee_id)
);

-- Indexes for permissions
CREATE INDEX IF NOT EXISTS idx_workdrive_permissions_resource ON workdrive_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_permissions_grantee ON workdrive_permissions(grantee_type, grantee_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_permissions_expires ON workdrive_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 5. SHARES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES workdrive_files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES workdrive_folders(id) ON DELETE CASCADE,
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('link', 'email', 'internal')),
  share_token VARCHAR(64) UNIQUE,
  share_url TEXT,
  password_hash VARCHAR(255),
  is_password_protected BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  allow_download BOOLEAN DEFAULT true,
  watermark_enabled BOOLEAN DEFAULT false,
  notify_on_access BOOLEAN DEFAULT false,
  shared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_with_emails TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT share_has_resource CHECK (file_id IS NOT NULL OR folder_id IS NOT NULL)
);

-- Indexes for shares
CREATE INDEX IF NOT EXISTS idx_workdrive_shares_file ON workdrive_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_shares_folder ON workdrive_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_shares_token ON workdrive_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_workdrive_shares_shared_by ON workdrive_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_workdrive_shares_active ON workdrive_shares(is_active, expires_at);

-- ============================================================================
-- 6. STORAGE QUOTAS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_storage_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'team', 'department')),
  entity_id UUID NOT NULL,
  storage_limit_bytes BIGINT NOT NULL,
  storage_used_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  alert_threshold_percent INTEGER DEFAULT 80,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

-- Indexes for storage quotas
CREATE INDEX IF NOT EXISTS idx_workdrive_quotas_entity ON workdrive_storage_quotas(entity_type, entity_id);

-- ============================================================================
-- 7. AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(20) NOT NULL,
  resource_id UUID NOT NULL,
  resource_name VARCHAR(500),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  geo_location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_workdrive_audit_user ON workdrive_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workdrive_audit_resource ON workdrive_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_audit_action ON workdrive_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_workdrive_audit_created ON workdrive_audit_logs(created_at DESC);

-- ============================================================================
-- 8. COMMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES workdrive_files(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES workdrive_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_workdrive_comments_file ON workdrive_comments(file_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_comments_parent ON workdrive_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_comments_user ON workdrive_comments(user_id);

-- ============================================================================
-- 9. FAVORITES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('workspace', 'folder', 'file')),
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_type, resource_id)
);

-- Indexes for favorites
CREATE INDEX IF NOT EXISTS idx_workdrive_favorites_user ON workdrive_favorites(user_id);

-- ============================================================================
-- 10. RECENT FILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_recent_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES workdrive_files(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_type VARCHAR(20) DEFAULT 'view' CHECK (access_type IN ('view', 'edit', 'download')),
  UNIQUE(user_id, file_id)
);

-- Indexes for recent files
CREATE INDEX IF NOT EXISTS idx_workdrive_recent_user ON workdrive_recent_files(user_id, accessed_at DESC);

-- ============================================================================
-- 11. ADMIN SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_editable BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO workdrive_admin_settings (setting_key, setting_value, description, is_editable) VALUES
  ('max_file_size_mb', '15', 'Maximum file size in MB', true),
  ('default_user_quota_gb', '10', 'Default storage quota for users in GB', true),
  ('total_org_storage_tb', '2', 'Total organization storage in TB', true),
  ('compression_enabled', 'true', 'Enable automatic file compression', true),
  ('thumbnail_generation_enabled', 'true', 'Enable thumbnail generation for images', true),
  ('allowed_file_types', '["pdf","doc","docx","xls","xlsx","ppt","pptx","jpg","jpeg","png","gif","webp","txt","csv"]', 'Allowed file extensions', true),
  ('blocked_file_extensions', '["exe","bat","sh","cmd","ps1","vbs","js","dll","sys","msi","scr"]', 'Blocked file extensions', true),
  ('trash_retention_days', '30', 'Days to retain deleted files in trash', true),
  ('auto_empty_trash', 'true', 'Automatically empty trash after retention period', true),
  ('max_versions_per_file', '10', 'Maximum versions to keep per file', true),
  ('version_retention_days', '90', 'Days to retain old versions', true),
  ('auto_versioning', 'true', 'Automatically create versions on edit', true),
  ('allow_internal_sharing', 'true', 'Allow sharing within organization', true),
  ('allow_external_sharing', 'true', 'Allow sharing with external users', true),
  ('require_password_for_external', 'false', 'Require password for external links', true),
  ('require_approval_for_external', 'true', 'Require admin approval for external shares', true),
  ('default_link_expiry_days', '30', 'Default expiry days for share links', true),
  ('allow_anonymous_downloads', 'false', 'Allow anonymous downloads from public links', true),
  ('watermark_downloads', 'false', 'Add watermark to downloaded files', true),
  ('virus_scanning_enabled', 'true', 'Enable virus scanning on uploads', true),
  ('session_timeout_minutes', '30', 'Session timeout in minutes', true),
  ('audit_log_retention_days', '365', 'Days to retain audit logs', true),
  ('log_all_downloads', 'true', 'Log all file downloads', true),
  ('log_all_views', 'true', 'Log all file views', true),
  ('log_ip_location', 'true', 'Log IP and location information', true)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- 12. FILE LOCKS TABLE (for collaborative editing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_file_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES workdrive_files(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  lock_type VARCHAR(20) DEFAULT 'edit' CHECK (lock_type IN ('edit', 'exclusive')),
  UNIQUE(file_id)
);

-- Index for file locks
CREATE INDEX IF NOT EXISTS idx_workdrive_locks_file ON workdrive_file_locks(file_id);
CREATE INDEX IF NOT EXISTS idx_workdrive_locks_user ON workdrive_file_locks(locked_by);

-- ============================================================================
-- 13. SHARE APPROVAL QUEUE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workdrive_share_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id UUID REFERENCES workdrive_shares(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  file_id UUID REFERENCES workdrive_files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES workdrive_folders(id) ON DELETE CASCADE,
  share_type VARCHAR(20) NOT NULL,
  shared_with_emails TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for share approvals
CREATE INDEX IF NOT EXISTS idx_workdrive_approvals_status ON workdrive_share_approvals(status);
CREATE INDEX IF NOT EXISTS idx_workdrive_approvals_requested_by ON workdrive_share_approvals(requested_by);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update workspace storage usage
CREATE OR REPLACE FUNCTION update_workspace_storage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE workdrive_workspaces
    SET storage_used_bytes = storage_used_bytes + NEW.file_size_bytes,
        updated_at = NOW()
    WHERE id = NEW.workspace_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workdrive_workspaces
    SET storage_used_bytes = storage_used_bytes - OLD.file_size_bytes,
        updated_at = NOW()
    WHERE id = OLD.workspace_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.file_size_bytes != NEW.file_size_bytes THEN
    UPDATE workdrive_workspaces
    SET storage_used_bytes = storage_used_bytes - OLD.file_size_bytes + NEW.file_size_bytes,
        updated_at = NOW()
    WHERE id = NEW.workspace_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workspace storage
DROP TRIGGER IF EXISTS trigger_update_workspace_storage ON workdrive_files;
CREATE TRIGGER trigger_update_workspace_storage
AFTER INSERT OR UPDATE OR DELETE ON workdrive_files
FOR EACH ROW EXECUTE FUNCTION update_workspace_storage();

-- Function to update user quota usage
CREATE OR REPLACE FUNCTION update_user_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO workdrive_storage_quotas (entity_type, entity_id, storage_limit_bytes, storage_used_bytes, file_count)
    VALUES ('user', NEW.created_by, 10737418240, NEW.file_size_bytes, 1)
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
      storage_used_bytes = workdrive_storage_quotas.storage_used_bytes + NEW.file_size_bytes,
      file_count = workdrive_storage_quotas.file_count + 1,
      last_calculated_at = NOW(),
      updated_at = NOW();
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE workdrive_storage_quotas
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - OLD.file_size_bytes),
        file_count = GREATEST(0, file_count - 1),
        last_calculated_at = NOW(),
        updated_at = NOW()
    WHERE entity_type = 'user' AND entity_id = OLD.created_by;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user quota
DROP TRIGGER IF EXISTS trigger_update_user_quota ON workdrive_files;
CREATE TRIGGER trigger_update_user_quota
AFTER INSERT OR DELETE ON workdrive_files
FOR EACH ROW EXECUTE FUNCTION update_user_quota();

-- Function to update folder path
CREATE OR REPLACE FUNCTION update_folder_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF NEW.parent_folder_id IS NULL THEN
    NEW.path := '/' || NEW.name;
    NEW.depth := 0;
  ELSE
    SELECT path, depth INTO parent_path FROM workdrive_folders WHERE id = NEW.parent_folder_id;
    NEW.path := parent_path || '/' || NEW.name;
    NEW.depth := (SELECT depth + 1 FROM workdrive_folders WHERE id = NEW.parent_folder_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for folder path
DROP TRIGGER IF EXISTS trigger_update_folder_path ON workdrive_folders;
CREATE TRIGGER trigger_update_folder_path
BEFORE INSERT OR UPDATE ON workdrive_folders
FOR EACH ROW EXECUTE FUNCTION update_folder_path();

-- Function to auto-set permanent delete date
CREATE OR REPLACE FUNCTION set_permanent_delete_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    NEW.deleted_at := NOW();
    NEW.permanent_delete_at := NOW() + INTERVAL '30 days';
  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    NEW.deleted_at := NULL;
    NEW.permanent_delete_at := NULL;
    NEW.deleted_by := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for permanent delete date
DROP TRIGGER IF EXISTS trigger_set_permanent_delete_date ON workdrive_files;
CREATE TRIGGER trigger_set_permanent_delete_date
BEFORE UPDATE ON workdrive_files
FOR EACH ROW EXECUTE FUNCTION set_permanent_delete_date();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE workdrive_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_storage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_recent_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE workdrive_admin_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API)
CREATE POLICY "Service role has full access to workspaces"
ON workdrive_workspaces FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to folders"
ON workdrive_folders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to files"
ON workdrive_files FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to permissions"
ON workdrive_permissions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to shares"
ON workdrive_shares FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to quotas"
ON workdrive_storage_quotas FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to audit logs"
ON workdrive_audit_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to comments"
ON workdrive_comments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to favorites"
ON workdrive_favorites FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to recent files"
ON workdrive_recent_files FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access to admin settings"
ON workdrive_admin_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for file with creator info
CREATE OR REPLACE VIEW workdrive_files_with_users AS
SELECT
  f.*,
  u1.email as created_by_email,
  u1.raw_user_meta_data->>'full_name' as created_by_name,
  u2.email as modified_by_email,
  u2.raw_user_meta_data->>'full_name' as modified_by_name
FROM workdrive_files f
LEFT JOIN auth.users u1 ON f.created_by = u1.id
LEFT JOIN auth.users u2 ON f.modified_by = u2.id;

-- View for storage summary by user
CREATE OR REPLACE VIEW workdrive_user_storage_summary AS
SELECT
  created_by as user_id,
  COUNT(*) as file_count,
  SUM(file_size_bytes) as total_size_bytes,
  MAX(created_at) as last_upload_at
FROM workdrive_files
WHERE is_deleted = false
GROUP BY created_by;

-- View for audit logs with user info
CREATE OR REPLACE VIEW workdrive_audit_logs_with_users AS
SELECT
  a.*,
  u.email as user_email,
  u.raw_user_meta_data->>'full_name' as user_name,
  u.raw_user_meta_data->>'role' as user_role
FROM workdrive_audit_logs a
LEFT JOIN auth.users u ON a.user_id = u.id;

-- ============================================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to permanently delete expired trash items
CREATE OR REPLACE FUNCTION cleanup_expired_trash()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM workdrive_files
  WHERE is_deleted = true
    AND permanent_delete_at IS NOT NULL
    AND permanent_delete_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired share links
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE workdrive_shares
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate user quotas
CREATE OR REPLACE FUNCTION recalculate_all_quotas()
RETURNS VOID AS $$
BEGIN
  -- Update existing quotas
  UPDATE workdrive_storage_quotas q
  SET
    storage_used_bytes = COALESCE(s.total_size, 0),
    file_count = COALESCE(s.file_count, 0),
    last_calculated_at = NOW(),
    updated_at = NOW()
  FROM (
    SELECT
      created_by,
      SUM(file_size_bytes) as total_size,
      COUNT(*) as file_count
    FROM workdrive_files
    WHERE is_deleted = false
    GROUP BY created_by
  ) s
  WHERE q.entity_type = 'user' AND q.entity_id = s.created_by;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant usage to authenticated users (for RLS policies)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE workdrive_workspaces IS 'WorkDrive workspaces - organizational containers for files';
COMMENT ON TABLE workdrive_folders IS 'WorkDrive folder hierarchy';
COMMENT ON TABLE workdrive_files IS 'WorkDrive file metadata and storage references';
COMMENT ON TABLE workdrive_permissions IS 'Granular access permissions for WorkDrive resources';
COMMENT ON TABLE workdrive_shares IS 'File and folder sharing records';
COMMENT ON TABLE workdrive_storage_quotas IS 'Storage quota tracking per entity';
COMMENT ON TABLE workdrive_audit_logs IS 'Comprehensive audit trail for all WorkDrive operations';
COMMENT ON TABLE workdrive_comments IS 'File comments and discussions';
COMMENT ON TABLE workdrive_favorites IS 'User bookmarked files and folders';
COMMENT ON TABLE workdrive_recent_files IS 'Recently accessed files per user';
COMMENT ON TABLE workdrive_admin_settings IS 'Global WorkDrive configuration settings';
