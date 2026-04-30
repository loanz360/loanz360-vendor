/**
 * Bank Payout Sheets API
 * Super Admin uploads bank disbursement sheets (CSV/XLSX)
 * System parses entries and auto-matches against payout applications
 *
 * GET: List uploaded sheets
 * POST: Upload new sheet + parse entries + auto-match
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import { createInAppNotification } from '@/lib/notifications/notification-service'
import ExcelJS from 'exceljs'


// =====================================================
// GET: List all uploaded bank payout sheets
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify Super Admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const bankName = searchParams.get('bank_name') || ''
    const status = searchParams.get('status') || 'ALL'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    let query = supabase
      .from('bank_payout_sheets')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (bankName) {
      query = query.ilike('bank_name', `%${bankName}%`)
    }
    if (status !== 'ALL') {
      query = query.eq('status', status)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: sheets, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching bank sheets:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch bank sheets' }, { status: 500 })
    }

    // Stats
    const [totalSheets, pendingReconciliation, fullyReconciled] = await Promise.all([
      supabase.from('bank_payout_sheets').select('id', { count: 'exact', head: true }),
      supabase.from('bank_payout_sheets').select('id', { count: 'exact', head: true }).in('status', ['UPLOADED', 'PROCESSING', 'PROCESSED']),
      supabase.from('bank_payout_sheets').select('id', { count: 'exact', head: true }).eq('status', 'RECONCILED'),
    ])

    return NextResponse.json({
      success: true,
      sheets: sheets || [],
      stats: {
        total: totalSheets.count || 0,
        pending_reconciliation: pendingReconciliation.count || 0,
        fully_reconciled: fullyReconciled.count || 0,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Error in bank sheets GET:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// POST: Upload new bank payout sheet
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminSupabase = createSupabaseAdmin()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const bankName = formData.get('bank_name') as string
    const periodFrom = formData.get('period_from') as string | null
    const periodTo = formData.get('period_to') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 })
    }
    if (!bankName) {
      return NextResponse.json({ success: false, error: 'Bank name is required' }, { status: 400 })
    }

    // Validate file size (max 10 MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size of 10 MB`,
      }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, error: 'File is empty' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

    if (!isCSV && !isExcel) {
      return NextResponse.json({ success: false, error: 'Only CSV and Excel (.xlsx/.xls) files are accepted' }, { status: 400 })
    }

    // File size limit (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File size must be less than 10 MB' }, { status: 400 })
    }

    // Check for duplicate file name + bank combination
    const { data: existingSheet } = await adminSupabase
      .from('bank_payout_sheets')
      .select('id, sheet_number, created_at')
      .eq('file_name', file.name)
      .ilike('bank_name', bankName)
      .limit(1)
      .maybeSingle()

    if (existingSheet) {
      return NextResponse.json({
        success: false,
        error: `A sheet with this file name already exists for ${bankName} (${existingSheet.sheet_number}, uploaded ${new Date(existingSheet.created_at).toLocaleDateString('en-IN')}). Please rename the file or use a different one.`,
      }, { status: 409 })
    }

    // Upload file to storage
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `bank-sheets/${timestamp}_${sanitizedName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminSupabase.storage
      .from('bank-payout-sheets')
      .upload(storagePath, buffer, {
        contentType: file.type || (isCSV ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        upsert: false,
      })

    if (uploadError) {
      apiLogger.error('Storage upload error:', uploadError)
      return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 })
    }

    // Get file URL
    const { data: urlData } = adminSupabase.storage
      .from('bank-payout-sheets')
      .getPublicUrl(storagePath)

    // Create sheet record
    const { data: sheet, error: sheetError } = await adminSupabase
      .from('bank_payout_sheets')
      .insert({
        bank_name: bankName,
        period_from: periodFrom || null,
        period_to: periodTo || null,
        file_url: urlData.publicUrl || storagePath,
        file_name: file.name,
        file_type: isCSV ? 'csv' : 'xlsx',
        status: 'PROCESSING',
        uploaded_by: user.id,
        uploaded_by_name: userData.full_name || 'Super Admin',
      })
      .select()
      .maybeSingle()

    if (sheetError) {
      apiLogger.error('Error creating sheet record:', sheetError)
      return NextResponse.json({ success: false, error: 'Failed to create sheet record' }, { status: 500 })
    }

    // Parse file
    const entries = await parseFile(buffer, isCSV, sheet.id)

    if (entries.length === 0) {
      await adminSupabase
        .from('bank_payout_sheets')
        .update({ status: 'PROCESSED', total_entries: 0, processing_notes: 'No valid entries found in file' })
        .eq('id', sheet.id)

      return NextResponse.json({
        success: true,
        sheet,
        summary: { total: 0, matched: 0, unmatched: 0, discrepancies: 0 },
        message: 'File uploaded but no valid entries found',
      })
    }

    // Insert entries
    const { error: entriesError } = await adminSupabase
      .from('bank_payout_sheet_entries')
      .insert(entries)

    if (entriesError) {
      apiLogger.error('Error inserting entries:', entriesError)
      await adminSupabase
        .from('bank_payout_sheets')
        .update({ status: 'UPLOADED', processing_notes: 'Failed to process entries' })
        .eq('id', sheet.id)

      return NextResponse.json({ success: false, error: 'Failed to process file entries' }, { status: 500 })
    }

    // Auto-match entries against payout applications
    const matchResult = await autoMatchEntries(adminSupabase, sheet.id, bankName)

    // Update sheet stats
    await adminSupabase
      .from('bank_payout_sheets')
      .update({
        status: 'PROCESSED',
        total_entries: entries.length,
        total_amount: entries.reduce((sum, e) => sum + (e.payout_amount || 0), 0),
        matched_count: matchResult.matched,
        unmatched_count: matchResult.unmatched,
        discrepancy_count: matchResult.discrepancies,
      })
      .eq('id', sheet.id)

    // Notify Accounts team about new bank sheet (non-blocking)
    const supabaseForUsers = await createClient()
    supabaseForUsers.from('users').select('id, full_name')
      .eq('role', 'EMPLOYEE')
      .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
      .then(({ data: accountsTeam }) => {
        if (accountsTeam) {
          for (const member of accountsTeam) {
            createInAppNotification({
              adminId: member.id,
              type: 'info',
              category: 'payout',
              title: 'New Bank Payout Sheet Uploaded',
              message: `Bank payout sheet ${sheet.sheet_number} (${bankName}) uploaded with ${entries.length} entries. ${matchResult.matched} auto-matched, ${matchResult.unmatched} need manual review.`,
              actionUrl: '/employees/accounts-executive/ba-applications',
              actionLabel: 'Review Applications',
              icon: '📄',
              metadata: { sheetId: sheet.id, sheetNumber: sheet.sheet_number, bankName },
            }).catch(() => { /* Non-critical side effect */ })
          }
        }
      })

    return NextResponse.json({
      success: true,
      sheet: { ...sheet, total_entries: entries.length },
      summary: {
        total: entries.length,
        matched: matchResult.matched,
        unmatched: matchResult.unmatched,
        discrepancies: matchResult.discrepancies,
      },
      message: `Successfully processed ${entries.length} entries. ${matchResult.matched} matched, ${matchResult.unmatched} unmatched.`,
    })
  } catch (error) {
    apiLogger.error('Error in bank sheets POST:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// =====================================================
// Parse CSV/Excel file into entry records
// =====================================================
async function parseFile(buffer: Buffer, isCSV: boolean, sheetId: string) {
  const workbook = new ExcelJS.Workbook()

  if (isCSV) {
    // ExcelJS csv.read expects a stream
    const { Readable } = require('stream')
    const stream = Readable.from(buffer)
    await workbook.csv.read(stream)
  } else {
    await workbook.xlsx.load(buffer)
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  // Find column mappings (flexible header matching)
  const headerRow = worksheet.getRow(1)
  const columnMap: Record<string, number> = {}

  const COLUMN_ALIASES: Record<string, string[]> = {
    loan_account_number: ['loan account number', 'loan account no', 'loan a/c', 'account number', 'account no', 'lan'],
    customer_name: ['customer name', 'borrower name', 'name', 'applicant name', 'customer'],
    loan_type: ['loan type', 'product type', 'product', 'scheme', 'loan product'],
    disbursed_amount: ['disbursed amount', 'disbursement amount', 'loan amount', 'disbursement', 'amount disbursed'],
    disbursement_date: ['disbursement date', 'disb date', 'date of disbursement', 'disbursal date'],
    payout_percentage: ['payout percentage', 'payout %', 'commission %', 'dsa commission %', 'percentage'],
    payout_amount: ['payout amount', 'commission amount', 'dsa payout', 'payout', 'commission'],
    bank_reference: ['bank reference', 'reference', 'ref no', 'reference number', 'utr', 'transaction id'],
    remarks: ['remarks', 'remark', 'notes', 'comment', 'comments'],
  }

  headerRow.eachCell((cell, colNumber) => {
    const headerValue = String(cell.value || '').toLowerCase().trim()
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some(alias => headerValue.includes(alias) || alias.includes(headerValue))) {
        columnMap[field] = colNumber
      }
    }
  })

  const entries: Array<Record<string, unknown>> = []
  let rowNum = 0

  worksheet.eachRow((row, rowIndex) => {
    if (rowIndex <= 1) return // Skip header

    rowNum++
    const getValue = (field: string) => {
      const col = columnMap[field]
      if (!col) return null
      const cellValue = row.getCell(col).value
      if (cellValue === null || cellValue === undefined) return null
      return String(cellValue).trim()
    }

    const getNumericValue = (field: string) => {
      const val = getValue(field)
      if (!val) return null
      const num = parseFloat(val.replace(/[^0-9.-]/g, ''))
      return isNaN(num) ? null : num
    }

    const getDateValue = (field: string) => {
      const val = getValue(field)
      if (!val) return null
      const cellCol = columnMap[field]
      if (cellCol) {
        const cellValue = row.getCell(cellCol).value
        if (cellValue instanceof Date) return cellValue.toISOString().split('T')[0]
      }
      // Try parsing string date
      const parsed = new Date(val)
      return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0]
    }

    const loanAccountNumber = getValue('loan_account_number')
    const customerName = getValue('customer_name')
    const payoutAmount = getNumericValue('payout_amount')

    // Skip rows with no meaningful data
    if (!loanAccountNumber && !customerName && !payoutAmount) return

    entries.push({
      sheet_id: sheetId,
      loan_account_number: loanAccountNumber,
      customer_name: customerName,
      loan_type: getValue('loan_type'),
      disbursed_amount: getNumericValue('disbursed_amount'),
      disbursement_date: getDateValue('disbursement_date'),
      payout_percentage: getNumericValue('payout_percentage'),
      payout_amount: payoutAmount,
      bank_reference: getValue('bank_reference'),
      remarks: getValue('remarks'),
      match_status: 'PENDING',
      row_number: rowNum,
    })
  })

  return entries
}

// =====================================================
// Auto-match entries against payout applications
// =====================================================
async function autoMatchEntries(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  sheetId: string,
  bankName: string
) {
  let matched = 0
  let unmatched = 0
  let discrepancies = 0

  // Fetch all unmatched entries for this sheet
  const { data: entries } = await supabase
    .from('bank_payout_sheet_entries')
    .select('*')
    .eq('sheet_id', sheetId)
    .eq('match_status', 'PENDING')

  if (!entries || entries.length === 0) return { matched: 0, unmatched: 0, discrepancies: 0 }

  // Fetch all pending partner payout applications for this bank
  const { data: partnerApps } = await supabase
    .from('partner_payout_applications')
    .select('id, app_id, partner_type, customer_name, customer_mobile, disbursed_amount, expected_commission_amount, bank_name, loan_type, bank_sheet_matched')
    .ilike('bank_name', `%${bankName}%`)
    .eq('bank_sheet_matched', false)

  // Fetch all pending CP applications for this bank
  const { data: cpApps } = await supabase
    .from('cp_applications')
    .select('id, app_id, customer_name, customer_mobile, loan_amount_disbursed, expected_payout_amount, bank_name, loan_type')
    .ilike('bank_name', `%${bankName}%`)

  for (const entry of entries) {
    let matchedApp: { id: string; type: string; expectedAmount: number } | null = null

    // Try matching against partner payout applications by customer name + disbursed amount
    if (partnerApps) {
      for (const app of partnerApps) {
        if (app.bank_sheet_matched) continue

        const nameMatch = entry.customer_name && app.customer_name &&
          entry.customer_name.toLowerCase().trim() === app.customer_name.toLowerCase().trim()
        const amountMatch = entry.disbursed_amount && app.disbursed_amount &&
          Math.abs(entry.disbursed_amount - app.disbursed_amount) < 1 // Allow ₹1 tolerance

        if (nameMatch && amountMatch) {
          matchedApp = { id: app.id, type: app.partner_type, expectedAmount: app.expected_commission_amount }
          break
        }
      }
    }

    // Try matching against CP applications if no partner match found
    if (!matchedApp && cpApps) {
      for (const app of cpApps) {
        const nameMatch = entry.customer_name && app.customer_name &&
          entry.customer_name.toLowerCase().trim() === app.customer_name.toLowerCase().trim()
        const amountMatch = entry.disbursed_amount && app.loan_amount_disbursed &&
          Math.abs(entry.disbursed_amount - app.loan_amount_disbursed) < 1

        if (nameMatch && amountMatch) {
          matchedApp = { id: app.id, type: 'CP', expectedAmount: app.expected_payout_amount || 0 }
          break
        }
      }
    }

    if (matchedApp) {
      // Check for amount discrepancy
      const amountDiff = entry.payout_amount && matchedApp.expectedAmount
        ? Math.round((entry.payout_amount - matchedApp.expectedAmount) * 100) / 100
        : null
      const hasDiscrepancy = amountDiff !== null && Math.abs(amountDiff) > 1

      const matchStatus = hasDiscrepancy ? 'DISCREPANCY' : 'MATCHED'

      // Update entry with match info
      await supabase
        .from('bank_payout_sheet_entries')
        .update({
          match_status: matchStatus,
          matched_application_id: matchedApp.id,
          matched_application_type: matchedApp.type,
          amount_discrepancy: amountDiff,
          matched_at: new Date().toISOString(),
        })
        .eq('id', entry.id)

      // Update the payout application with bank sheet match
      if (matchedApp.type === 'BA' || matchedApp.type === 'BP') {
        await supabase
          .from('partner_payout_applications')
          .update({
            bank_sheet_entry_id: entry.id,
            bank_sheet_matched: true,
            bank_sheet_matched_at: new Date().toISOString(),
            bank_confirmed_amount: entry.payout_amount,
          })
          .eq('id', matchedApp.id)
      }

      if (hasDiscrepancy) {
        discrepancies++
      } else {
        matched++
      }
    } else {
      // No match found
      await supabase
        .from('bank_payout_sheet_entries')
        .update({ match_status: 'UNMATCHED' })
        .eq('id', entry.id)

      unmatched++
    }
  }

  return { matched, unmatched, discrepancies }
}
