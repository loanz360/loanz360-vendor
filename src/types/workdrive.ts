/**
 * WorkDrive Type Definitions
 * Enterprise-grade document management system types
 */

// ============================================================================
// ENUMS
// ============================================================================

export type WorkspaceType = 'personal' | 'team' | 'department' | 'organization'
export type PermissionLevel = 'viewer' | 'commenter' | 'editor' | 'admin' | 'owner'
export type GranteeType = 'user' | 'team' | 'department' | 'role'
export type ShareType = 'link' | 'email' | 'internal'
export type ResourceType = 'workspace' | 'folder' | 'file'
export type FileCategory = 'document' | 'image' | 'spreadsheet' | 'presentation' | 'archive' | 'other'
export type AuditAction =
  | 'upload' | 'download' | 'view' | 'preview'
  | 'delete' | 'restore' | 'permanent_delete'
  | 'move' | 'copy' | 'rename'
  | 'share' | 'unshare' | 'share_link_create' | 'share_link_access'
  | 'permission_grant' | 'permission_revoke' | 'permission_update'
  | 'lock' | 'unlock'
  | 'comment_add' | 'comment_delete' | 'comment_resolve'
  | 'version_create' | 'version_restore'
  | 'folder_create' | 'folder_delete'
  | 'quota_update' | 'settings_update'
  | 'login' | 'logout'

export type QuotaAlertLevel = 'normal' | 'warning' | 'critical' | 'exceeded'

// ============================================================================
// WORKSPACE
// ============================================================================

export interface WorkDriveWorkspace {
  id: string
  name: string
  type: WorkspaceType
  owner_id: string
  parent_workspace_id?: string
  storage_used_bytes: number
  storage_limit_bytes: number
  settings: WorkspaceSettings
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  default_permission?: PermissionLevel
  allow_external_sharing?: boolean
  require_approval_for_external?: boolean
  auto_versioning?: boolean
  max_file_size_mb?: number
  allowed_file_types?: string[]
}

// ============================================================================
// FOLDER
// ============================================================================

export interface WorkDriveFolder {
  id: string
  workspace_id: string
  parent_folder_id?: string
  name: string
  color: string
  path: string
  depth: number
  created_by: string
  is_shared: boolean
  is_template: boolean
  metadata: FolderMetadata
  created_at: string
  updated_at: string
  // Computed fields
  file_count?: number
  folder_count?: number
  total_size?: number
}

export interface FolderMetadata {
  description?: string
  tags?: string[]
  icon?: string
}

// ============================================================================
// FILE
// ============================================================================

export interface WorkDriveFile {
  id: string
  workspace_id: string
  folder_id?: string
  name: string
  original_name: string
  file_type: string
  file_category: FileCategory
  mime_type: string
  file_size_bytes: number
  s3_key: string
  s3_bucket: string
  s3_region: string
  thumbnail_s3_key?: string
  version_number: number
  is_current_version: boolean
  previous_version_id?: string
  checksum?: string
  is_compressed: boolean
  compression_ratio: number
  created_by: string
  modified_by: string
  is_locked: boolean
  locked_by?: string
  locked_at?: string
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
  permanent_delete_at?: string
  metadata: FileMetadata
  tags: string[]
  created_at: string
  updated_at: string
  // Computed/joined fields
  created_by_name?: string
  modified_by_name?: string
  download_url?: string
  thumbnail_url?: string
  permissions?: WorkDrivePermission[]
  is_favorite?: boolean
  comment_count?: number
}

export interface FileMetadata {
  description?: string
  original_file_name?: string
  upload_source?: 'web' | 'mobile' | 'api' | 'email'
  dimensions?: { width: number; height: number }
  duration?: number // for audio/video
  page_count?: number // for documents
  extracted_text?: string // for search
}

// ============================================================================
// PERMISSIONS
// ============================================================================

export interface WorkDrivePermission {
  id: string
  resource_type: ResourceType
  resource_id: string
  grantee_type: GranteeType
  grantee_id: string
  permission_level: PermissionLevel
  can_download: boolean
  can_share: boolean
  can_delete: boolean
  can_manage_permissions: boolean
  granted_by: string
  expires_at?: string
  is_inherited: boolean
  inherited_from?: string
  created_at: string
  // Computed fields
  grantee_name?: string
  grantee_email?: string
  granted_by_name?: string
}

export interface PermissionCheck {
  can_view: boolean
  can_download: boolean
  can_edit: boolean
  can_delete: boolean
  can_share: boolean
  can_manage_permissions: boolean
  permission_level: PermissionLevel
  is_owner: boolean
}

// ============================================================================
// SHARING
// ============================================================================

export interface WorkDriveShare {
  id: string
  file_id?: string
  folder_id?: string
  share_type: ShareType
  share_token?: string
  share_url?: string
  password_hash?: string
  is_password_protected: boolean
  expires_at?: string
  max_downloads?: number
  download_count: number
  max_views?: number
  view_count: number
  allow_download: boolean
  watermark_enabled: boolean
  notify_on_access: boolean
  shared_by: string
  shared_with_emails?: string[]
  is_active: boolean
  created_at: string
  // Computed fields
  shared_by_name?: string
  resource_name?: string
  resource_type?: 'file' | 'folder'
  is_expired?: boolean
}

export interface CreateShareRequest {
  file_id?: string
  folder_id?: string
  share_type: ShareType
  password?: string
  expires_in_days?: number
  max_downloads?: number
  max_views?: number
  allow_download?: boolean
  watermark_enabled?: boolean
  notify_on_access?: boolean
  shared_with_emails?: string[]
  permission_level?: PermissionLevel
}

// ============================================================================
// STORAGE & QUOTAS
// ============================================================================

export interface WorkDriveStorageQuota {
  id: string
  entity_type: 'user' | 'team' | 'department'
  entity_id: string
  storage_limit_bytes: number
  storage_used_bytes: number
  file_count: number
  alert_threshold_percent: number
  last_calculated_at: string
  created_at: string
  updated_at: string
  // Computed fields
  entity_name?: string
  usage_percent?: number
  alert_level?: QuotaAlertLevel
  available_bytes?: number
}

export interface StorageStats {
  total_storage_bytes: number
  used_storage_bytes: number
  available_storage_bytes: number
  usage_percent: number
  total_files: number
  total_folders: number
  by_file_type: { type: string; count: number; size: number }[]
  by_department: { department: string; size: number; users: number }[]
  growth_trend: { date: string; size: number }[]
  largest_files: WorkDriveFile[]
  recent_uploads: WorkDriveFile[]
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export interface WorkDriveAuditLog {
  id: string
  user_id: string
  action: AuditAction
  resource_type: ResourceType
  resource_id: string
  resource_name?: string
  details: AuditDetails
  ip_address?: string
  user_agent?: string
  geo_location?: GeoLocation
  created_at: string
  // Computed fields
  user_name?: string
  user_email?: string
  user_role?: string
}

export interface AuditDetails {
  old_value?: any
  new_value?: any
  shared_with?: string[]
  permission_level?: PermissionLevel
  file_size?: number
  download_type?: 'single' | 'bulk'
  version_number?: number
  error?: string
  additional_info?: Record<string, any>
}

export interface GeoLocation {
  country?: string
  city?: string
  region?: string
  latitude?: number
  longitude?: number
}

// ============================================================================
// COMMENTS
// ============================================================================

export interface WorkDriveComment {
  id: string
  file_id: string
  parent_comment_id?: string
  user_id: string
  content: string
  mentions: string[]
  is_resolved: boolean
  resolved_by?: string
  resolved_at?: string
  is_deleted: boolean
  created_at: string
  updated_at: string
  // Computed fields
  user_name?: string
  user_avatar?: string
  replies?: WorkDriveComment[]
  resolved_by_name?: string
}

// ============================================================================
// FAVORITES & RECENT
// ============================================================================

export interface WorkDriveFavorite {
  id: string
  user_id: string
  resource_type: ResourceType
  resource_id: string
  created_at: string
  // Computed fields
  resource?: WorkDriveFile | WorkDriveFolder
}

export interface WorkDriveRecentFile {
  id: string
  user_id: string
  file_id: string
  accessed_at: string
  access_type: 'view' | 'edit' | 'download'
  // Computed fields
  file?: WorkDriveFile
}

// ============================================================================
// ADMIN SETTINGS
// ============================================================================

export interface WorkDriveAdminSettings {
  id: string
  setting_key: string
  setting_value: any
  description?: string
  is_editable: boolean
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface GlobalSettings {
  // Storage
  max_file_size_mb: number
  default_user_quota_gb: number
  total_org_storage_tb: number
  compression_enabled: boolean
  thumbnail_generation_enabled: boolean

  // File Types
  allowed_file_types: string[]
  blocked_file_extensions: string[]

  // Trash
  trash_retention_days: number
  auto_empty_trash: boolean

  // Versioning
  max_versions_per_file: number
  version_retention_days: number
  auto_versioning: boolean

  // Sharing
  allow_internal_sharing: boolean
  allow_external_sharing: boolean
  require_password_for_external: boolean
  require_approval_for_external: boolean
  default_link_expiry_days: number
  allow_anonymous_downloads: boolean
  watermark_downloads: boolean

  // Security
  virus_scanning_enabled: boolean
  session_timeout_minutes: number
  max_failed_login_attempts: number
  require_2fa_for_external_share: boolean

  // Audit
  audit_log_retention_days: number
  log_all_downloads: boolean
  log_all_views: boolean
  log_ip_location: boolean
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ListFilesRequest {
  workspace_id?: string
  folder_id?: string
  page?: number
  limit?: number
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'file_size_bytes'
  sort_order?: 'asc' | 'desc'
  file_type?: string
  search?: string
  include_deleted?: boolean
}

export interface ListFilesResponse {
  files: WorkDriveFile[]
  folders: WorkDriveFolder[]
  total_files: number
  total_folders: number
  page: number
  limit: number
  has_more: boolean
  breadcrumb: BreadcrumbItem[]
  current_folder?: WorkDriveFolder
}

export interface BreadcrumbItem {
  id: string
  name: string
  type: 'workspace' | 'folder'
}

export interface UploadFileRequest {
  folder_id?: string
  workspace_id: string
  file: File
  on_progress?: (percent: number) => void
}

export interface UploadFileResponse {
  success: boolean
  file?: WorkDriveFile
  error?: string
}

export interface CreateFolderRequest {
  workspace_id: string
  parent_folder_id?: string
  name: string
  color?: string
}

export interface MoveItemRequest {
  item_id: string
  item_type: 'file' | 'folder'
  destination_folder_id?: string
  destination_workspace_id?: string
}

export interface CopyItemRequest {
  item_id: string
  item_type: 'file' | 'folder'
  destination_folder_id?: string
  destination_workspace_id?: string
  new_name?: string
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface WorkDriveState {
  currentWorkspace?: WorkDriveWorkspace
  currentFolder?: WorkDriveFolder
  selectedItems: SelectedItem[]
  viewMode: 'grid' | 'list'
  sortBy: 'name' | 'created_at' | 'updated_at' | 'file_size_bytes'
  sortOrder: 'asc' | 'desc'
  searchQuery: string
  isLoading: boolean
  error?: string
}

export interface SelectedItem {
  id: string
  type: 'file' | 'folder'
  name: string
}

export interface ContextMenuAction {
  id: string
  label: string
  icon: string
  action: () => void
  disabled?: boolean
  divider?: boolean
  danger?: boolean
}

// ============================================================================
// ROLE-BASED QUOTA DEFAULTS
// ============================================================================

export const ROLE_QUOTA_DEFAULTS: Record<string, number> = {
  SUPER_ADMIN: -1, // Unlimited
  ADMIN: 50 * 1024 * 1024 * 1024, // 50 GB
  CRO: 20 * 1024 * 1024 * 1024, // 20 GB
  BUSINESS_DEVELOPMENT_MANAGER: 20 * 1024 * 1024 * 1024,
  CHANNEL_PARTNER_MANAGER: 20 * 1024 * 1024 * 1024,
  ACCOUNTS_MANAGER: 20 * 1024 * 1024 * 1024,
  HR_MANAGER: 20 * 1024 * 1024 * 1024,
  BUSINESS_DEVELOPMENT_EXECUTIVE: 10 * 1024 * 1024 * 1024, // 10 GB
  CHANNEL_PARTNER_EXECUTIVE: 10 * 1024 * 1024 * 1024,
  FINANCE_EXECUTIVE: 10 * 1024 * 1024 * 1024,
  ACCOUNTS_EXECUTIVE: 10 * 1024 * 1024 * 1024,
  DIGITAL_SALES_EXECUTIVE: 10 * 1024 * 1024 * 1024,
  DIRECT_SALES_EXECUTIVE: 10 * 1024 * 1024 * 1024,
  TELE_SALES_EXECUTIVE: 10 * 1024 * 1024 * 1024,
  PAYOUT_SPECIALIST: 10 * 1024 * 1024 * 1024,
  CUSTOMER_SUPPORT_EXECUTIVE: 5 * 1024 * 1024 * 1024, // 5 GB
  TECHNICAL_SUPPORT_EXECUTIVE: 5 * 1024 * 1024 * 1024,
  PARTNER: 5 * 1024 * 1024 * 1024,
  CUSTOMER: 2 * 1024 * 1024 * 1024, // 2 GB
}

// ============================================================================
// FILE TYPE MAPPINGS
// ============================================================================

export const FILE_CATEGORY_MAP: Record<string, FileCategory> = {
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'text/rtf': 'document',

  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/svg+xml': 'image',

  // Spreadsheets
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'text/csv': 'spreadsheet',

  // Presentations
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',

  // Archives
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
}

export const FILE_ICONS: Record<FileCategory, string> = {
  document: 'FileText',
  image: 'Image',
  spreadsheet: 'Table',
  presentation: 'Presentation',
  archive: 'Archive',
  other: 'File',
}

// ============================================================================
// PERMISSION HIERARCHY
// ============================================================================

export const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  admin: 4,
  owner: 5,
}

export function hasPermission(
  userLevel: PermissionLevel,
  requiredLevel: PermissionLevel
): boolean {
  return PERMISSION_HIERARCHY[userLevel] >= PERMISSION_HIERARCHY[requiredLevel]
}
