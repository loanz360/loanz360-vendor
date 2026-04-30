/**
 * Employee Bulk Import/Export Library
 *
 * Handles bulk employee data import with:
 * - CSV and Excel file parsing
 * - Data validation (Zod schema)
 * - Duplicate detection (email, mobile)
 * - Error reporting per row
 * - Template generation for download
 */

import Papa from 'papaparse'
import { z } from 'zod'

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

const VALID_SUB_ROLES = [
  'CRO', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER',
  'BUSINESS_DEVELOPMENT_EXECUTIVE', 'BUSINESS_DEVELOPMENT_MANAGER',
  'DIGITAL_SALES', 'DIRECT_SALES_EXECUTIVE', 'DIRECT_SALES_MANAGER',
  'TELE_SALES', 'FIELD_SALES', 'FIELD_SALES_MANAGER',
  'CHANNEL_PARTNER_EXECUTIVE', 'CHANNEL_PARTNER_MANAGER', 'PARTNERSHIP_MANAGER',
  'FINANCE_EXECUTIVE', 'ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER', 'PAYOUT_SPECIALIST',
  'CUSTOMER_SUPPORT_EXECUTIVE', 'CUSTOMER_SUPPORT_MANAGER',
  'PARTNER_SUPPORT_EXECUTIVE', 'PARTNER_SUPPORT_MANAGER',
  'TECHNICAL_SUPPORT_EXECUTIVE', 'TECHNICAL_SUPPORT_MANAGER',
  'COMPLIANCE_OFFICER', 'TRAINING_DEVELOPMENT_EXECUTIVE',
  'ADMIN_EXECUTIVE', 'ADMIN_MANAGER', 'OPERATIONS_EXECUTIVE', 'OPERATIONS_MANAGER',
  'HR_EXECUTIVE', 'HR_MANAGER',
] as const

export const employeeImportSchema = z.object({
  full_name: z.string().min(2, 'Full name is required (min 2 chars)'),
  work_email: z.string().email('Invalid work email'),
  personal_email: z.string().email('Invalid personal email'),
  mobile_number: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  sub_role: z.string().refine(
    (val) => VALID_SUB_ROLES.includes(val.toUpperCase() as unknown),
    'Invalid sub role'
  ).transform(v => v.toUpperCase()),
  department_id: z.string().optional(),
  department_name: z.string().optional(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  present_address: z.string().min(5, 'Present address is required'),
  permanent_address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  pincode: z.string().optional().default(''),
  emergency_contact_name: z.string().optional().default(''),
  emergency_contact_number: z.string().optional().default(''),
  emergency_contact_relation: z.string().optional().default(''),
  qualification: z.string().optional(),
  experience_years: z.string().optional(),
  previous_company: z.string().optional(),
})

export type EmployeeImportRecord = z.infer<typeof employeeImportSchema>

export interface EmployeeImportValidationResult {
  valid: EmployeeImportRecord[]
  invalid: EmployeeInvalidRecord[]
  duplicates: EmployeeDuplicateRecord[]
  stats: EmployeeImportStats
}

export interface EmployeeInvalidRecord {
  row: number
  data: Record<string, unknown>
  errors: string[]
}

export interface EmployeeDuplicateRecord {
  row: number
  data: EmployeeImportRecord
  duplicateType: 'work_email' | 'personal_email' | 'mobile_number'
}

export interface EmployeeImportStats {
  totalRows: number
  validRows: number
  invalidRows: number
  duplicateRows: number
  successRate: number
}

// ============================================================================
// CSV PARSER
// ============================================================================

export async function parseEmployeeCSV(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        return header.trim().toLowerCase().replace(/\s+/g, '_')
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`))
        } else {
          resolve(results.data as Record<string, unknown>[])
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateEmployeeRecords(
  records: Record<string, unknown>[],
  existingEmails: Set<string> = new Set(),
  existingMobiles: Set<string> = new Set()
): EmployeeImportValidationResult {
  const valid: EmployeeImportRecord[] = []
  const invalid: EmployeeInvalidRecord[] = []
  const duplicates: EmployeeDuplicateRecord[] = []
  const seenWorkEmails = new Set<string>()
  const seenPersonalEmails = new Set<string>()
  const seenMobiles = new Set<string>()

  records.forEach((record, index) => {
    const row = index + 2 // Header row = 1

    // Normalize mobile: strip spaces, dashes, country code
    if (record.mobile_number) {
      record.mobile_number = record.mobile_number.toString().replace(/[\s\-+]/g, '').slice(-10)
    }

    // Validate
    const result = employeeImportSchema.safeParse(record)

    if (!result.success) {
      invalid.push({
        row,
        data: record,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      })
      return
    }

    const validRecord = result.data
    const workEmail = validRecord.work_email.toLowerCase()
    const personalEmail = validRecord.personal_email.toLowerCase()
    const mobile = validRecord.mobile_number

    // Duplicate work_email
    if (existingEmails.has(workEmail) || seenWorkEmails.has(workEmail)) {
      duplicates.push({ row, data: validRecord, duplicateType: 'work_email' })
      return
    }

    // Duplicate personal_email
    if (existingEmails.has(personalEmail) || seenPersonalEmails.has(personalEmail)) {
      duplicates.push({ row, data: validRecord, duplicateType: 'personal_email' })
      return
    }

    // Duplicate mobile
    if (existingMobiles.has(mobile) || seenMobiles.has(mobile)) {
      duplicates.push({ row, data: validRecord, duplicateType: 'mobile_number' })
      return
    }

    seenWorkEmails.add(workEmail)
    seenPersonalEmails.add(personalEmail)
    seenMobiles.add(mobile)
    valid.push(validRecord)
  })

  const totalRows = records.length
  return {
    valid,
    invalid,
    duplicates,
    stats: {
      totalRows,
      validRows: valid.length,
      invalidRows: invalid.length,
      duplicateRows: duplicates.length,
      successRate: totalRows > 0 ? (valid.length / totalRows) * 100 : 0,
    },
  }
}

// ============================================================================
// TEMPLATE GENERATION
// ============================================================================

export function generateImportTemplate(): string {
  const headers = [
    'full_name',
    'work_email',
    'personal_email',
    'mobile_number',
    'sub_role',
    'department_name',
    'date_of_joining',
    'present_address',
    'permanent_address',
    'city',
    'state',
    'pincode',
    'emergency_contact_name',
    'emergency_contact_number',
    'emergency_contact_relation',
    'qualification',
    'experience_years',
    'previous_company',
  ]

  const sampleRow = [
    'John Doe',
    'john.doe@company.com',
    'john.doe@gmail.com',
    '9876543210',
    'CRO',
    'Sales',
    '2026-03-01',
    '123 Main Street, City',
    '123 Main Street, City',
    'Mumbai',
    'Maharashtra',
    '400001',
    'Jane Doe',
    '9876543211',
    'Spouse',
    "Bachelor's in Commerce",
    '3',
    'Previous Corp Ltd',
  ]

  return Papa.unparse({
    fields: headers,
    data: [sampleRow],
  })
}

export function downloadTemplate() {
  const csv = generateImportTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'employee_import_template.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}
