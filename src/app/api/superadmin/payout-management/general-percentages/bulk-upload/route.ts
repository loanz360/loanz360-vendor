
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import { apiLogger } from '@/lib/utils/logger'

interface PayoutRow {
  bank_name: string
  location: string
  loan_type: string
  commission_percentage: number
}

interface ValidationError {
  row: number
  field: string
  message: string
}

// POST - Bulk upload payout percentages from Excel
export async function POST(request: NextRequest) {
  try {
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload .xlsx, .xls, or .csv file' },
        { status: 400 }
      )
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel file
    const workbook = new ExcelJS.Workbook()
    try {
      if (file.type === 'text/csv') {
        await workbook.csv.read(buffer)
      } else {
        await workbook.xlsx.load(buffer)
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse Excel file' },
        { status: 400 }
      )
    }

    // Get first sheet
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json(
        { error: 'No worksheet found in file' },
        { status: 400 }
      )
    }

    // Convert to JSON
    const rawData: any[] = []
    const headers: string[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Get headers from first row
        row.eachCell((cell) => {
          headers.push(cell.value?.toString() || '')
        })
      } else {
        // Convert data rows to objects
        const rowData: any = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1]
          if (header) {
            rowData[header] = cell.value || ''
          }
        })
        if (Object.keys(rowData).length > 0) {
          rawData.push(rowData)
        }
      }
    })

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      )
    }

    // Expected columns (case-insensitive)
    const requiredColumns = ['bank_name', 'location', 'loan_type', 'commission_percentage']
    const alternateColumnNames: { [key: string]: string[] } = {
      bank_name: ['bank name', 'bank', 'bankname'],
      location: ['location', 'region', 'area', 'city'],
      loan_type: ['loan type', 'loan_type', 'loantype', 'product type'],
      commission_percentage: ['commission percentage', 'commission', 'percentage', 'rate', 'commission_percentage', 'commission%']
    }

    // Normalize column names
    const normalizedData: PayoutRow[] = []
    const validationErrors: ValidationError[] = []

    rawData.forEach((row: any, index: number) => {
      const rowNumber = index + 2 // +2 because Excel rows start at 1 and first row is header

      // Normalize keys to lowercase
      const normalizedRow: any = {}
      Object.keys(row).forEach(key => {
        normalizedRow[key.toLowerCase().trim()] = row[key]
      })

      // Map to expected column names
      const mappedRow: any = {}

      for (const [expectedCol, alternates] of Object.entries(alternateColumnNames)) {
        let found = false
        for (const alt of [expectedCol, ...alternates]) {
          if (normalizedRow[alt] !== undefined) {
            mappedRow[expectedCol] = normalizedRow[alt]
            found = true
            break
          }
        }
        if (!found) {
          validationErrors.push({
            row: rowNumber,
            field: expectedCol,
            message: `Missing required column: ${expectedCol}`
          })
        }
      }

      // Skip if missing required fields
      if (validationErrors.some(e => e.row === rowNumber)) {
        return
      }

      // Validate data types and values
      const payoutRow: PayoutRow = {
        bank_name: String(mappedRow.bank_name || '').trim(),
        location: String(mappedRow.location || '').trim(),
        loan_type: String(mappedRow.loan_type || '').trim(),
        commission_percentage: 0
      }

      // Validate bank_name
      if (!payoutRow.bank_name) {
        validationErrors.push({
          row: rowNumber,
          field: 'bank_name',
          message: 'Bank name cannot be empty'
        })
      }

      // Validate location
      if (!payoutRow.location) {
        validationErrors.push({
          row: rowNumber,
          field: 'location',
          message: 'Location cannot be empty'
        })
      }

      // Validate loan_type
      if (!payoutRow.loan_type) {
        validationErrors.push({
          row: rowNumber,
          field: 'loan_type',
          message: 'Loan type cannot be empty'
        })
      }

      // Validate commission_percentage
      const percentage = parseFloat(mappedRow.commission_percentage)
      if (isNaN(percentage)) {
        validationErrors.push({
          row: rowNumber,
          field: 'commission_percentage',
          message: 'Commission percentage must be a number'
        })
      } else if (percentage < 0 || percentage > 100) {
        validationErrors.push({
          row: rowNumber,
          field: 'commission_percentage',
          message: 'Commission percentage must be between 0 and 100'
        })
      } else {
        payoutRow.commission_percentage = percentage
      }

      // Only add valid rows
      if (!validationErrors.some(e => e.row === rowNumber)) {
        normalizedData.push(payoutRow)
      }
    })

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return NextResponse.json({ success: false, error: 'Validation failed',
        validationErrors,
        totalRows: rawData.length,
        validRows: normalizedData.length,
        invalidRows: validationErrors.length
      }, { status: 400 })
    }

    // Insert data in bulk (no need to set created_by for Super Admin)
    const { data, error } = await supabase
      .from('payout_general_percentages')
      .upsert(normalizedData, {
        onConflict: 'bank_name,location,loan_type',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      apiLogger.error('Error bulk uploading payout percentages', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Bulk upload successful',
      totalRows: rawData.length,
      uploadedRows: data?.length || 0,
      data
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in bulk upload', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
