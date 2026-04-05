export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { CPDisbursementBulkUploadResponse, LoanProductType } from '@/types/cp-profile'

/** Row shape for existing disbursement loan number lookup */
interface ExistingDisbursementRow {
  loan_account_number: string
}

/** Parsed record from CSV row before insertion */
interface BulkDisbursementRecord {
  partner_id: string
  lender_association_id: string
  loan_account_number: string
  customer_name: string
  co_applicant_name: string | null
  disbursement_date: string
  disbursement_amount: number
  product_type: string
  property_location: string | null
  loan_tenure_months: number | null
  roi: number | null
  validation_status: string
  commission_status: string
  submitted_via: string
  submitted_by: string
  submitted_ip: string
  created_at: string
}

/**
 * POST /api/partners/cp/disbursements/bulk-upload
 * Handle bulk disbursement data upload via file
 *
 * CP-exclusive feature:
 * - Accept CSV/Excel file with disbursement records
 * - Validate all records
 * - Return validation results (success/error counts)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const lenderAssociationId = formData.get('lender_association_id') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!lenderAssociationId) {
      return NextResponse.json(
        { success: false, error: 'Lender association ID is required' },
        { status: 400 }
      )
    }

    // Verify lender association belongs to this partner
    const { data: lenderAssociation, error: laError } = await supabase
      .from('cp_lender_associations')
      .select('id, code_status, lender_name')
      .eq('id', lenderAssociationId)
      .eq('partner_id', partner.id)
      .maybeSingle()

    if (laError || !lenderAssociation) {
      return NextResponse.json(
        { success: false, error: 'Invalid lender association' },
        { status: 400 }
      )
    }

    if (lenderAssociation.code_status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Lender code is not active. Cannot submit disbursements.' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload CSV or Excel file.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Read file content
    const fileContent = await file.text()
    const rows = parseCSV(fileContent)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File is empty or invalid format' },
        { status: 400 }
      )
    }

    // Expected headers
    const expectedHeaders = [
      'loan_account_number',
      'customer_name',
      'disbursement_date',
      'disbursement_amount',
      'product_type'
    ]

    // Validate headers
    const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'))
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h))

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required columns: ${missingHeaders.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Process data rows (skip header)
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim() !== ''))
    const errors: Array<{ row: number; field: string; error: string }> = []
    const validRecords: BulkDisbursementRecord[] = []

    // Get existing loan account numbers to check for duplicates
    const loanNumbers = dataRows.map(row => {
      const loanIndex = headers.indexOf('loan_account_number')
      return row[loanIndex]?.trim().toUpperCase()
    }).filter(Boolean)

    const { data: existingDisbursements } = await supabase
      .from('cp_disbursement_reports')
      .select('loan_account_number')
      .eq('partner_id', partner.id)
      .in('loan_account_number', loanNumbers)

    const existingLoanNumbers = new Set(
      (existingDisbursements || []).map((d: ExistingDisbursementRow) => d.loan_account_number)
    )

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Validate each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNumber = i + 2 // Account for header row and 0-indexing
      const record: Record<string, string> = {}

      // Map values to fields
      headers.forEach((header, index) => {
        record[header] = row[index]?.trim() || ''
      })

      // Validate loan account number
      if (!record.loan_account_number) {
        errors.push({ row: rowNumber, field: 'loan_account_number', error: 'Required' })
        continue
      }

      const loanNumber = record.loan_account_number.toUpperCase()
      if (existingLoanNumbers.has(loanNumber)) {
        errors.push({ row: rowNumber, field: 'loan_account_number', error: 'Duplicate - already submitted' })
        continue
      }

      // Validate customer name
      if (!record.customer_name) {
        errors.push({ row: rowNumber, field: 'customer_name', error: 'Required' })
        continue
      }

      // Validate disbursement date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}-\d{2}-\d{4}$/
      if (!record.disbursement_date || !dateRegex.test(record.disbursement_date)) {
        errors.push({ row: rowNumber, field: 'disbursement_date', error: 'Invalid date format (use YYYY-MM-DD)' })
        continue
      }

      // Parse and normalize date
      let disbursementDate = record.disbursement_date
      if (record.disbursement_date.includes('/')) {
        const parts = record.disbursement_date.split('/')
        disbursementDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      } else if (record.disbursement_date.includes('-') && record.disbursement_date.length === 10) {
        const parts = record.disbursement_date.split('-')
        if (parts[0].length === 2) {
          disbursementDate = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }

      // Validate disbursement amount
      const amount = parseFloat(record.disbursement_amount?.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) {
        errors.push({ row: rowNumber, field: 'disbursement_amount', error: 'Must be a positive number' })
        continue
      }

      // Validate product type
      const validProductTypes: LoanProductType[] = [
        'PERSONAL_LOAN', 'HOME_LOAN', 'BUSINESS_LOAN', 'LAP',
        'AUTO_LOAN', 'CREDIT_CARD', 'GOLD_LOAN', 'EDUCATION_LOAN',
        'WORKING_CAPITAL', 'MSME_LOAN', 'OTHERS'
      ]
      const productType = record.product_type.toUpperCase().replace(/\s+/g, '_')
      if (!validProductTypes.includes(productType as LoanProductType)) {
        errors.push({ row: rowNumber, field: 'product_type', error: `Invalid. Valid types: ${validProductTypes.join(', ')}` })
        continue
      }

      // Build valid record
      validRecords.push({
        partner_id: partner.id,
        lender_association_id: lenderAssociationId,
        loan_account_number: loanNumber,
        customer_name: record.customer_name,
        co_applicant_name: record.co_applicant_name || null,
        disbursement_date: disbursementDate,
        disbursement_amount: amount,
        product_type: productType,
        property_location: record.property_location || null,
        loan_tenure_months: record.loan_tenure_months ? parseInt(record.loan_tenure_months) : null,
        roi: record.roi ? parseFloat(record.roi) : null,
        validation_status: 'PENDING',
        commission_status: 'PENDING',
        submitted_via: 'FILE_UPLOAD',
        submitted_by: user.id,
        submitted_ip: ipAddress,
        created_at: new Date().toISOString()
      })

      // Track as existing to catch duplicates within same file
      existingLoanNumbers.add(loanNumber)
    }

    // Insert valid records
    let insertedCount = 0
    if (validRecords.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('cp_disbursement_reports')
        .insert(validRecords)
        .select('id')

      if (insertError) {
        apiLogger.error('Error inserting disbursements:', insertError)
        return NextResponse.json(
          { success: false, error: 'Failed to insert disbursements' },
          { status: 500 }
        )
      }

      insertedCount = (inserted || []).length
    }

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'DISBURSEMENT_BULK_UPLOAD',
      action_description: `Bulk uploaded ${insertedCount} disbursements for ${lenderAssociation.lender_name}. ${errors.length} rejected.`,
      section: 'disbursements',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    const response: CPDisbursementBulkUploadResponse = {
      success: true,
      total_records: dataRows.length,
      validated: insertedCount,
      rejected: errors.length,
      errors: errors.slice(0, 50) // Limit errors returned
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/partners/cp/disbursements/bulk-upload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Simple CSV parser
 */
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/)
  const result: string[][] = []

  for (const line of lines) {
    if (line.trim() === '') continue

    const row: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    row.push(current.trim())
    result.push(row)
  }

  return result
}

/**
 * GET /api/partners/cp/disbursements/bulk-upload
 * Get template for bulk upload
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Return template CSV content
  const template = `loan_account_number,customer_name,co_applicant_name,disbursement_date,disbursement_amount,product_type,property_location,loan_tenure_months,roi
LOAN123456,John Doe,Jane Doe,2024-01-15,5000000,HOME_LOAN,Mumbai,240,8.5
LOAN123457,Alice Smith,,2024-01-16,1000000,PERSONAL_LOAN,,36,12.5`

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="disbursement_template.csv"'
    }
  })
}
