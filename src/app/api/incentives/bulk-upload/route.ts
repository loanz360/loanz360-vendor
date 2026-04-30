
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/incentives/bulk-upload
 * Process bulk target upload from Excel/CSV file
 * Access: HR, Superadmin
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    // Check user role from users table
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const allowedRoles = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER']
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN' || userData?.role === 'ADMIN'
    const isHR = allowedRoles.includes(userData?.sub_role || '')

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR or Admin access required' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const uploadType = formData.get('type') as string || 'incentive_targets'
    const batchName = formData.get('batch_name') as string || `Upload_${Date.now()}`

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const fileName = file.name
    const fileExtension = fileName.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Only .xlsx, .xls, and .csv files are supported' }, { status: 400 })
    }

    // Read file
    const fileBuffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()

    if (fileExtension === 'csv') {
      await workbook.csv.read(Buffer.from(fileBuffer))
    } else {
      await workbook.xlsx.load(fileBuffer)
    }

    // Get the "Data" sheet (or first sheet if "Data" doesn't exist)
    const dataSheet = workbook.worksheets.find(ws => ws.name === 'Data') || workbook.worksheets[0]
    if (!dataSheet) {
      return NextResponse.json({ success: false, error: 'No worksheet found in file' }, { status: 400 })
    }

    // Convert to JSON (array of arrays format)
    const rawData: any[][] = []
    dataSheet.eachRow((row, rowNumber) => {
      const rowData: any[] = []
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowData.push(cell.value)
      })
      rawData.push(rowData)
    })

    if (rawData.length < 2) {
      return NextResponse.json({ success: false, error: 'File is empty or contains only headers' }, { status: 400 })
    }

    // Extract headers and data rows
    const headers = rawData[0] as string[]
    const dataRows = rawData.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ''))

    if (dataRows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows found in file' }, { status: 400 })
    }

    // Get template for validation
    const { data: template, error: templateError } = await supabase
      .from('bulk_upload_templates')
      .select('*')
      .eq('template_type', uploadType)
      .eq('is_active', true)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: 'Template not found for upload type' }, { status: 404 })
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase.rpc('create_bulk_upload_batch', {
      p_batch_name: batchName,
      p_uploaded_by: user.id,
      p_upload_type: uploadType,
      p_file_name: fileName,
      p_file_size: file.size,
    })

    if (batchError || !batch) {
      throw new Error('Failed to create batch record')
    }

    const batchId = batch

    // Map column labels to field names
    const columns = template.columns as any[]
    const columnMap: { [key: string]: string } = {}
    columns.forEach((col: any) => {
      columnMap[col.label] = col.name
    })

    // Validate and prepare rows
    const validationResults: any[] = []
    const rowsToInsert: any[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNumber = i + 2 // +2 because: +1 for 0-index, +1 for header row

      // Map row to object
      const rowData: any = {}
      headers.forEach((header, index) => {
        const fieldName = columnMap[header]
        if (fieldName) {
          rowData[fieldName] = row[index]
        }
      })

      // Validate row
      const errors: string[] = []
      const warnings: string[] = []

      columns.forEach((col: any) => {
        const value = rowData[col.name]

        // Check required fields
        if (col.required && (value === null || value === undefined || value === '')) {
          errors.push(`${col.label} is required`)
        }

        // Type validation
        if (value !== null && value !== undefined && value !== '') {
          if (col.type === 'number' && isNaN(Number(value))) {
            errors.push(`${col.label} must be a number`)
          }
          if (col.type === 'email' && !String(value).includes('@')) {
            errors.push(`${col.label} must be a valid email`)
          }
          if (col.type === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) {
            errors.push(`${col.label} must be a valid UUID`)
          }

          // Custom validation
          if (col.validation) {
            if (col.validation.min !== undefined && Number(value) < col.validation.min) {
              errors.push(`${col.label} must be at least ${col.validation.min}`)
            }
            if (col.validation.max !== undefined && Number(value) > col.validation.max) {
              errors.push(`${col.label} must be at most ${col.validation.max}`)
            }
            if (col.validation.enum && !col.validation.enum.includes(value)) {
              errors.push(`${col.label} must be one of: ${col.validation.enum.join(', ')}`)
            }
            if (col.validation.pattern) {
              const regex = new RegExp(col.validation.pattern)
              if (!regex.test(String(value))) {
                errors.push(col.validation.message || `${col.label} format is invalid`)
              }
            }
          }
        }
      })

      const rowStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'pending'

      rowsToInsert.push({
        batch_id: batchId,
        row_number: rowNumber,
        raw_data: rowData,
        status: rowStatus,
        validation_errors: errors.length > 0 ? errors : null,
        validation_warnings: warnings.length > 0 ? warnings : null,
      })

      validationResults.push({
        row_number: rowNumber,
        status: rowStatus,
        data: rowData,
        errors,
        warnings,
      })
    }

    // Insert all rows
    const { error: rowsError } = await supabase.from('bulk_upload_rows').insert(rowsToInsert)

    if (rowsError) {
      throw new Error('Failed to insert rows: ' + rowsError.message)
    }

    // Update batch status
    await supabase
      .from('bulk_upload_batches')
      .update({
        status: 'validating',
        total_rows: dataRows.length,
      })
      .eq('id', batchId)

    // Calculate summary
    const errorCount = validationResults.filter((r) => r.status === 'error').length
    const warningCount = validationResults.filter((r) => r.status === 'warning').length
    const validCount = validationResults.filter((r) => r.status === 'pending').length

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      summary: {
        total_rows: dataRows.length,
        valid_rows: validCount,
        error_rows: errorCount,
        warning_rows: warningCount,
        can_process: errorCount === 0,
      },
      validation_results: validationResults,
      message: errorCount > 0
        ? `Validation failed: ${errorCount} rows have errors. Please fix and re-upload.`
        : `Validation successful: ${validCount} rows ready to process.`,
    })
  } catch (error) {
    apiLogger.error('Error processing bulk upload', error)
    return NextResponse.json({ success: false, error: 'Failed to process bulk upload',
      }, { status: 500 })
  }
}

/**
 * GET /api/incentives/bulk-upload
 * Get list of bulk upload batches
 * Access: HR, Superadmin
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role
    // Check user role from users table
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const allowedRoles = ['HR_EXECUTIVE', 'HR_MANAGER', 'ADMIN_EXECUTIVE', 'ADMIN_MANAGER']
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN' || userData?.role === 'ADMIN'
    const isHR = allowedRoles.includes(userData?.sub_role || '')

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR or Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch batches
    const { data: batches, error: batchesError, count } = await supabase
      .from('bulk_upload_batches')
      .select('*, employees:uploaded_by(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (batchesError) {
      throw batchesError
    }

    return NextResponse.json({
      success: true,
      data: batches,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching batches', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch batches' }, { status: 500 })
  }
}
