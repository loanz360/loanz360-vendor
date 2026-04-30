/**
 * WorkDrive Security Scanner
 * File security validation, malware detection, and compliance checking
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Dangerous file extensions that should be blocked
const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'js', 'jse', 'ws', 'wsf', 'wsc', 'wsh',
  'ps1', 'ps1xml', 'ps2', 'ps2xml', 'psc1', 'psc2',
  'reg', 'inf', 'lnk', 'jar', 'dll', 'sys',
]

// High-risk file extensions that require additional scanning
const HIGH_RISK_EXTENSIONS = [
  'doc', 'docx', 'docm', 'xls', 'xlsx', 'xlsm', 'xlsb',
  'ppt', 'pptx', 'pptm', 'pdf', 'zip', 'rar', '7z',
  'tar', 'gz', 'bz2', 'xz',
]

// File type categories for compliance
const COMPLIANCE_CATEGORIES = {
  pii: ['csv', 'xlsx', 'xls', 'json', 'xml', 'txt'], // Potentially contains PII
  financial: ['xlsx', 'xls', 'csv', 'pdf', 'qbw', 'qbb'],
  medical: ['pdf', 'dcm', 'dicom', 'hl7'],
  legal: ['pdf', 'doc', 'docx'],
}

// Magic bytes for file type verification
const FILE_SIGNATURES: Record<string, string[]> = {
  'pdf': ['25504446'], // %PDF
  'zip': ['504B0304', '504B0506', '504B0708'],
  'png': ['89504E47'],
  'jpg': ['FFD8FFE0', 'FFD8FFE1', 'FFD8FFE8'],
  'gif': ['47494638'],
  'doc': ['D0CF11E0'],
  'docx': ['504B0304'],
  'xlsx': ['504B0304'],
  'rar': ['52617221'],
  '7z': ['377ABCAF'],
}

// Suspicious patterns in file content
const SUSPICIOUS_PATTERNS = [
  /powershell/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /document\.write/i,
  /<script/i,
  /javascript:/i,
  /vbscript:/i,
  /data:text\/html/i,
  /base64,/i,
]

export interface ScanResult {
  safe: boolean
  blocked: boolean
  warnings: string[]
  errors: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  complianceFlags: string[]
  scanDetails: {
    extensionCheck: boolean
    signatureCheck: boolean
    contentCheck: boolean
    sizeCheck: boolean
    nameCheck: boolean
  }
}

export interface FileMetadata {
  fileName: string
  fileSize: number
  mimeType: string
  fileBuffer?: Buffer
}

/**
 * Perform comprehensive security scan on a file
 */
export async function scanFile(metadata: FileMetadata): Promise<ScanResult> {
  const result: ScanResult = {
    safe: true,
    blocked: false,
    warnings: [],
    errors: [],
    riskLevel: 'low',
    complianceFlags: [],
    scanDetails: {
      extensionCheck: true,
      signatureCheck: true,
      contentCheck: true,
      sizeCheck: true,
      nameCheck: true,
    },
  }

  const extension = getFileExtension(metadata.fileName).toLowerCase()

  // 1. Check blocked extensions
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    result.safe = false
    result.blocked = true
    result.errors.push(`File type .${extension} is not allowed for security reasons`)
    result.riskLevel = 'critical'
    result.scanDetails.extensionCheck = false
    return result
  }

  // 2. Check file name for suspicious patterns
  const fileNameIssues = checkFileName(metadata.fileName)
  if (fileNameIssues.length > 0) {
    result.warnings.push(...fileNameIssues)
    result.scanDetails.nameCheck = false
    if (result.riskLevel === 'low') result.riskLevel = 'medium'
  }

  // 3. Check file size
  const sizeIssues = checkFileSize(metadata.fileSize)
  if (sizeIssues.length > 0) {
    result.warnings.push(...sizeIssues)
    result.scanDetails.sizeCheck = false
  }

  // 4. Check for high-risk extensions
  if (HIGH_RISK_EXTENSIONS.includes(extension)) {
    result.warnings.push(`File type .${extension} requires additional security review`)
    if (result.riskLevel === 'low') result.riskLevel = 'medium'
  }

  // 5. Verify file signature matches extension (if buffer provided)
  if (metadata.fileBuffer) {
    const signatureValid = verifyFileSignature(metadata.fileBuffer, extension)
    if (!signatureValid) {
      result.warnings.push('File signature does not match declared file type')
      result.scanDetails.signatureCheck = false
      result.riskLevel = 'high'
    }

    // 6. Check for suspicious content patterns
    const contentIssues = await scanFileContent(metadata.fileBuffer, extension)
    if (contentIssues.length > 0) {
      result.warnings.push(...contentIssues)
      result.scanDetails.contentCheck = false
      result.riskLevel = 'high'
    }
  }

  // 7. Check compliance categories
  for (const [category, extensions] of Object.entries(COMPLIANCE_CATEGORIES)) {
    if (extensions.includes(extension)) {
      result.complianceFlags.push(category)
    }
  }

  // 8. Set overall safe status
  if (result.errors.length > 0 || result.riskLevel === 'critical') {
    result.safe = false
  }

  return result
}

/**
 * Check file name for suspicious patterns
 */
function checkFileName(fileName: string): string[] {
  const issues: string[] = []

  // Check for double extensions
  const parts = fileName.split('.')
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2)
    if (BLOCKED_EXTENSIONS.includes(lastTwo[0].toLowerCase())) {
      issues.push('File has suspicious double extension')
    }
  }

  // Check for hidden file indicators
  if (fileName.startsWith('.')) {
    issues.push('File name starts with dot (hidden file)')
  }

  // Check for unicode tricks
  if (/[\u200B-\u200D\u2060\uFEFF]/.test(fileName)) {
    issues.push('File name contains invisible unicode characters')
  }

  // Check for very long names
  if (fileName.length > 255) {
    issues.push('File name exceeds maximum length')
  }

  // Check for special characters that might cause issues
  if (/[<>:"|?*\\]/.test(fileName)) {
    issues.push('File name contains potentially problematic characters')
  }

  return issues
}

/**
 * Check file size for issues
 */
function checkFileSize(size: number): string[] {
  const issues: string[] = []
  const maxSize = 5 * 1024 * 1024 * 1024 // 5 GB
  const warningSize = 100 * 1024 * 1024 // 100 MB

  if (size > maxSize) {
    issues.push(`File size exceeds maximum allowed size of 5 GB`)
  } else if (size > warningSize) {
    issues.push(`Large file detected (${formatBytes(size)})`)
  }

  if (size === 0) {
    issues.push('File is empty')
  }

  return issues
}

/**
 * Verify file signature matches extension
 */
function verifyFileSignature(buffer: Buffer, extension: string): boolean {
  const signatures = FILE_SIGNATURES[extension]
  if (!signatures) return true // No signature to check

  const headerHex = buffer.slice(0, 8).toString('hex').toUpperCase()
  return signatures.some(sig => headerHex.startsWith(sig))
}

/**
 * Scan file content for suspicious patterns
 */
async function scanFileContent(buffer: Buffer, extension: string): Promise<string[]> {
  const issues: string[] = []

  // Skip binary files
  if (['jpg', 'png', 'gif', 'pdf', 'zip', 'rar', '7z', 'doc', 'xls', 'ppt'].includes(extension)) {
    return issues
  }

  try {
    const content = buffer.toString('utf-8')

    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        issues.push(`Potentially dangerous content pattern detected`)
        break // One warning is enough
      }
    }
  } catch {
    // Intentionally empty: binary content cannot be decoded as UTF-8, skip text scanning
  }

  return issues
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Log security event
 */
export async function logSecurityEvent(params: {
  userId: string
  eventType: 'scan_blocked' | 'scan_warning' | 'scan_passed' | 'access_denied' | 'suspicious_activity'
  fileId?: string
  fileName?: string
  details: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  try {
    await supabase.from('workdrive_security_logs').insert({
      user_id: params.userId,
      event_type: params.eventType,
      file_id: params.fileId,
      file_name: params.fileName,
      details: params.details,
      ip_address: params.ipAddress,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

/**
 * Check if user has suspicious activity
 */
export async function checkUserActivity(userId: string): Promise<{
  suspicious: boolean
  reasons: string[]
}> {
  const result = { suspicious: false, reasons: [] as string[] }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Check for excessive downloads in last hour
    const { count: downloadCount } = await supabase
      .from('workdrive_audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'download')
      .gte('created_at', oneHourAgo)

    if ((downloadCount || 0) > 50) {
      result.suspicious = true
      result.reasons.push('Excessive downloads in last hour')
    }

    // Check for blocked file upload attempts
    const { count: blockedCount } = await supabase
      .from('workdrive_security_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'scan_blocked')
      .gte('created_at', oneDayAgo)

    if ((blockedCount || 0) > 5) {
      result.suspicious = true
      result.reasons.push('Multiple blocked file upload attempts')
    }

    // Check for access denied events
    const { count: deniedCount } = await supabase
      .from('workdrive_security_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'access_denied')
      .gte('created_at', oneDayAgo)

    if ((deniedCount || 0) > 10) {
      result.suspicious = true
      result.reasons.push('Repeated access denied attempts')
    }
  } catch (error) {
    console.error('Error checking user activity:', error)
  }

  return result
}

/**
 * Get compliance report for files
 */
export async function getComplianceReport(params: {
  startDate?: string
  endDate?: string
  complianceCategory?: string
}): Promise<{
  totalFiles: number
  flaggedFiles: number
  byCategory: Record<string, number>
  recentAlerts: unknown[]
}> {
  try {
    // This would query actual compliance data
    // For now, return a template structure
    return {
      totalFiles: 0,
      flaggedFiles: 0,
      byCategory: {
        pii: 0,
        financial: 0,
        medical: 0,
        legal: 0,
      },
      recentAlerts: [],
    }
  } catch (error) {
    console.error('Error generating compliance report:', error)
    return {
      totalFiles: 0,
      flaggedFiles: 0,
      byCategory: {},
      recentAlerts: [],
    }
  }
}

export default {
  scanFile,
  logSecurityEvent,
  checkUserActivity,
  getComplianceReport,
  BLOCKED_EXTENSIONS,
  HIGH_RISK_EXTENSIONS,
}
