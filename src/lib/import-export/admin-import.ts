/**
 * Admin Import/Export Library
 *
 * Handles bulk admin data import/export with:
 * - CSV and Excel file parsing
 * - Data validation and normalization
 * - Duplicate detection
 * - Error reporting
 * - Progress tracking
 */

import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { z } from 'zod'

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * Admin import record schema
 */
export const adminImportSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'admin', 'manager', 'viewer']).default('viewer'),
  department: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export type AdminImportRecord = z.infer<typeof adminImportSchema>

/**
 * Import validation result
 */
export interface ImportValidationResult {
  valid: AdminImportRecord[]
  invalid: InvalidRecord[]
  duplicates: DuplicateRecord[]
  stats: ImportStats
}

export interface InvalidRecord {
  row: number
  data: Record<string, any>
  errors: string[]
}

export interface DuplicateRecord {
  row: number
  data: AdminImportRecord
  duplicateType: 'email' | 'phone'
  existingId?: string
}

export interface ImportStats {
  totalRows: number
  validRows: number
  invalidRows: number
  duplicateRows: number
  successRate: number
}

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'xlsx'

export interface ExportOptions {
  format: ExportFormat
  includeIds?: boolean
  includeDates?: boolean
  includeDeletedRecords?: boolean
  filters?: {
    role?: string[]
    department?: string[]
    status?: string[]
  }
}

// ============================================================================
// CSV PARSER
// ============================================================================

/**
 * Parse CSV file to admin records
 */
export async function parseCSV(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize headers
        return header.trim().toLowerCase().replace(/\s+/g, '_')
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`))
        } else {
          resolve(results.data as Record<string, any>[])
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

// ============================================================================
// EXCEL PARSER
// ============================================================================

/**
 * Parse Excel file to admin records
 */
export async function parseExcel(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('Failed to read file'))
          return
        }

        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

        // Convert to JSON with header normalization
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          raw: false,
          defval: '',
        })

        // Normalize keys
        const normalized = jsonData.map((row: any) => {
          const normalizedRow: Record<string, any> = {}
          Object.keys(row).forEach((key) => {
            const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_')
            normalizedRow[normalizedKey] = row[key]
          })
          return normalizedRow
        })

        resolve(normalized)
      } catch (error) {
        reject(new Error(`Excel parsing error: ${(error as Error).message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'))
    }

    reader.readAsBinaryString(file)
  })
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate and normalize import records
 */
export function validateImportRecords(
  records: Record<string, any>[],
  existingEmails: Set<string> = new Set(),
  existingPhones: Set<string> = new Set()
): ImportValidationResult {
  const valid: AdminImportRecord[] = []
  const invalid: InvalidRecord[] = []
  const duplicates: DuplicateRecord[] = []
  const seenEmails = new Set<string>()
  const seenPhones = new Set<string>()

  records.forEach((record, index) => {
    const row = index + 2 // Account for header row (Excel/CSV row numbering)

    // Validate against schema
    const result = adminImportSchema.safeParse(record)

    if (!result.success) {
      // Invalid record
      invalid.push({
        row,
        data: record,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      })
      return
    }

    const validRecord = result.data

    // Check for duplicate email
    if (existingEmails.has(validRecord.email.toLowerCase()) ||
        seenEmails.has(validRecord.email.toLowerCase())) {
      duplicates.push({
        row,
        data: validRecord,
        duplicateType: 'email',
      })
      return
    }

    // Check for duplicate phone (if provided)
    if (validRecord.phone) {
      const normalizedPhone = normalizePhone(validRecord.phone)
      if (existingPhones.has(normalizedPhone) || seenPhones.has(normalizedPhone)) {
        duplicates.push({
          row,
          data: validRecord,
          duplicateType: 'phone',
        })
        return
      }
      seenPhones.add(normalizedPhone)
    }

    // Valid and unique record
    seenEmails.add(validRecord.email.toLowerCase())
    valid.push(validRecord)
  })

  const totalRows = records.length
  const validRows = valid.length
  const invalidRows = invalid.length
  const duplicateRows = duplicates.length

  return {
    valid,
    invalid,
    duplicates,
    stats: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
      successRate: totalRows > 0 ? (validRows / totalRows) * 100 : 0,
    },
  }
}

// ============================================================================
// EXPORT GENERATORS
// ============================================================================

/**
 * Generate CSV export
 */
export function generateCSV(
  admins: any[],
  options: ExportOptions = { format: 'csv' }
): string {
  const headers = getExportHeaders(options)
  const rows = admins.map((admin) => formatAdminForExport(admin, options))

  // Generate CSV
  const csv = Papa.unparse({
    fields: headers,
    data: rows,
  })

  return csv
}

/**
 * Generate Excel export
 */
export function generateExcel(
  admins: any[],
  options: ExportOptions = { format: 'xlsx' }
): ArrayBuffer {
  const headers = getExportHeaders(options)
  const rows = admins.map((admin) => formatAdminForExport(admin, options))

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })

  // Auto-size columns
  const colWidths = headers.map((header) => ({ wch: header.length + 5 }))
  ws['!cols'] = colWidths

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Admins')

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })

  return excelBuffer
}

/**
 * Get export column headers based on options
 */
function getExportHeaders(options: ExportOptions): string[] {
  const baseHeaders = [
    'Full Name',
    'Email',
    'Phone',
    'Role',
    'Department',
    'Designation',
    'Status',
  ]

  if (options.includeIds) {
    baseHeaders.unshift('Admin ID', 'Unique ID')
  }

  if (options.includeDates) {
    baseHeaders.push('Created At', 'Updated At', 'Last Login')
  }

  return baseHeaders
}

/**
 * Format admin record for export
 */
function formatAdminForExport(admin: any, options: ExportOptions): Record<string, any> {
  const record: Record<string, any> = {
    'Full Name': admin.full_name || '',
    'Email': admin.email || '',
    'Phone': admin.phone || '',
    'Role': admin.role || '',
    'Department': admin.department || '',
    'Designation': admin.designation || '',
    'Status': admin.is_active ? 'active' : 'inactive',
  }

  if (options.includeIds) {
    record['Admin ID'] = admin.id || ''
    record['Unique ID'] = admin.admin_unique_id || ''
  }

  if (options.includeDates) {
    record['Created At'] = admin.created_at ? new Date(admin.created_at).toLocaleString() : ''
    record['Updated At'] = admin.updated_at ? new Date(admin.updated_at).toLocaleString() : ''
    record['Last Login'] = admin.last_login ? new Date(admin.last_login).toLocaleString() : ''
  }

  return record
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Detect file type from filename
 */
export function detectFileType(filename: string): 'csv' | 'xlsx' | 'unknown' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  return 'unknown'
}

/**
 * Parse import file (auto-detects format)
 */
export async function parseImportFile(file: File): Promise<Record<string, any>[]> {
  const fileType = detectFileType(file.name)

  if (fileType === 'csv') {
    return parseCSV(file)
  } else if (fileType === 'xlsx') {
    return parseExcel(file)
  } else {
    throw new Error('Unsupported file format. Please upload CSV or Excel (.xlsx) files.')
  }
}

/**
 * Download file helper
 */
export function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Export admins to file
 */
export function exportAdmins(
  admins: any[],
  options: ExportOptions
): void {
  if (options.format === 'csv') {
    const csv = generateCSV(admins, options)
    downloadFile(csv, `admins_export_${Date.now()}.csv`, 'text/csv')
  } else if (options.format === 'xlsx') {
    const excel = generateExcel(admins, options)
    downloadFile(
      excel,
      `admins_export_${Date.now()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  }
}
