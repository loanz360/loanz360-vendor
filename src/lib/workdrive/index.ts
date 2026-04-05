/**
 * WorkDrive Library
 * Central export for all WorkDrive functionality
 */

// Storage operations
export {
  uploadWorkDriveFile,
  downloadWorkDriveFile,
  deleteWorkDriveFile,
  getWorkDriveFileUrl,
  copyWorkDriveFile,
  listWorkDriveFiles,
  workDriveFileExists,
  calculateUserStorageUsage,
  validateFileType,
  generateUniqueFileName,
  formatFileSize,
  getFileCategory,
  getFileExtension,
  generateWorkDriveS3Key,
  generateThumbnailS3Key,
} from './workdrive-storage'

// Permission operations
export {
  isSuperAdmin,
  isAdmin,
  isManager,
  getUserRole,
  getUserDefaultQuota,
  checkPermission,
  grantPermission,
  revokePermission,
  getResourcePermissions,
  canPerformAction,
  inheritFolderPermissions,
  getResourceAccessList,
} from './workdrive-permissions'

// API operations
export {
  // Workspaces
  getOrCreatePersonalWorkspace,
  getUserWorkspaces,

  // Files
  listFiles,
  uploadFile,
  getFile,
  deleteFile,
  restoreFile,
  renameFile,

  // Folders
  createFolder,
  deleteFolder,

  // Sharing
  createShare,
  getShareByToken,
  revokeShare,

  // Audit
  logAudit,
  getAuditLogs,

  // Favorites & Recent
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  getRecentFiles,
  trackFileAccess,

  // Trash
  getTrashFiles,
  emptyTrash,
} from './workdrive-api'

// Admin operations
export {
  // Storage management
  getStorageOverview,
  getUserStorageStats,
  getDepartmentStorageStats,
  updateUserQuota,

  // User management
  getAllUsersWithStorage,
  enableUserWorkDrive,
  disableUserWorkDrive,

  // Settings
  getAdminSettings,
  updateAdminSetting,

  // Shares management
  getAllActiveShares,
  revokeAllUserShares,

  // Audit
  getFullAuditLogs,
  exportAuditLogs,

  // Cleanup
  cleanupExpiredTrash,
  cleanupExpiredShares,
  recalculateAllQuotas,
} from './workdrive-admin'
