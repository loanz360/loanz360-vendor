
// =====================================================
// BULK SALARY UPLOAD API
// CSV/Excel upload for bulk salary management
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { employeeSalarySchema } from '@/lib/validations/payroll-schemas'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { checkHRAccess } from '@/lib/auth/hr-access'
import Papa from 'papaparse'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface CSVRow {
  employee_id: string
  user_id?: string
  basic_salary: number
  hra: number
  da: number
  special_allowance: number
  medical_allowance: number
  conveyance_allowance: number
  education_allowance: number
  performance_bonus: number
  other_allowances: number
  effective_from: string
  payment_mode?: string
  bank_account_number?: string
  bank_name?: string
  bank_ifsc?: string
}

const NUMERIC_FIELDS = new Set([
  'basic_salary', 'hra', 'da', 'special_allowance', 'medical_allowance',
  'conveyance_allowance', 'education_allowance', 'performance_bonus',
  'other_allowances'
])

function parseCSV(csvContent: string): CSVRow[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    transform: (value: string) => value.trim()
  })

  return result.data.map(row => {
    const parsed: any = {}
    for (const [key, value] of Object.entries(row)) {
      parsed[key] = NUMERIC_FIELDS.has(key) ? (parseFloat(value) || 0) : value
    }
    return parsed as CSVRow
  })
}

// POST /api/hr/payroll/bulk-upload
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.UPLOAD)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can perform bulk uploads' },
        { status: 403 }
      )
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name?.toLowerCase() || ''
    if (!fileName.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are supported' },
        { status: 400 }
      )
    }

    // Read file content
    const csvContent = await file.text()

    // Parse CSV
    const rows = parseCSV(csvContent)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data found in CSV file' },
        { status: 400 }
      )
    }

    if (rows.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 1000 records allowed per upload' },
        { status: 400 }
      )
    }

    // Resolve employee_id to user_id
    const employeeIds = rows.map(r => r.employee_id)

    const { data: employees } = await adminClient
      .from('employee_profile')
      .select('employee_id, user_id')
      .in('employee_id', employeeIds)

    const employeeMap = new Map(
      employees?.map(e => [e.employee_id, e.user_id]) || []
    )

    // Validate and prepare salary records
    const salaryRecords = []
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const userId = employeeMap.get(row.employee_id)

      if (!userId) {
        errors.push({ row: i + 2, error: `Employee ID ${row.employee_id} not found` })
        continue
      }

      try {
        // Validate with Zod schema
        const validated = employeeSalarySchema.parse({
          user_id: userId,
          basic_salary: row.basic_salary,
          hra: row.hra || 0,
          da: row.da || 0,
          special_allowance: row.special_allowance || 0,
          medical_allowance: row.medical_allowance || 0,
          conveyance_allowance: row.conveyance_allowance || 0,
          education_allowance: row.education_allowance || 0,
          performance_bonus: row.performance_bonus || 0,
          other_allowances: row.other_allowances || 0,
          effective_from: row.effective_from,
          payment_mode: row.payment_mode || 'bank_transfer',
          bank_account_number: row.bank_account_number,
          bank_name: row.bank_name,
          bank_ifsc: row.bank_ifsc
        })

        // Calculate PF and ESI
        const pfEmployee = validated.basic_salary * 0.12
        const pfEmployer = validated.basic_salary * 0.12

        const grossSalary = validated.basic_salary + (validated.hra || 0) +
                           (validated.da || 0) + (validated.special_allowance || 0) +
                           (validated.medical_allowance || 0) + (validated.conveyance_allowance || 0) +
                           (validated.education_allowance || 0) + (validated.performance_bonus || 0) +
                           (validated.other_allowances || 0)

        const esiEmployee = grossSalary <= 21000 ? grossSalary * 0.0075 : 0
        const esiEmployer = grossSalary <= 21000 ? grossSalary * 0.0325 : 0

        salaryRecords.push({
          ...validated,
          pf_employee: pfEmployee,
          pf_employer: pfEmployer,
          esi_employee: esiEmployee,
          esi_employer: esiEmployer,
          created_by: user.id,
          updated_by: user.id
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push({
            row: i + 2,
            error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          })
        } else {
          errors.push({ row: i + 2, error: 'Validation failed' })
        }
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation errors found',
          errors: errors,
          validRecords: salaryRecords.length,
          totalRecords: rows.length
        },
        { status: 400 }
      )
    }

    // Deactivate existing active salaries
    const userIds = salaryRecords.map(r => r.user_id)

    await adminClient
      .from('employee_salary')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split('T')[0]
      })
      .in('user_id', userIds)
      .eq('is_active', true)

    // Insert new salary records
    const { data: inserted, error: insertError } = await adminClient
      .from('employee_salary')
      .insert(salaryRecords)
      .select()

    if (insertError) {
      apiLogger.error('Bulk insert error', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to insert salary records' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${inserted.length} salary records`,
      data: {
        totalRecords: rows.length,
        inserted: inserted.length,
        errors: errors.length
      }
    })

  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Bulk upload error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}

// GET /api/hr/payroll/bulk-upload (Download CSV template)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const template = `employee_id,basic_salary,hra,da,special_allowance,medical_allowance,conveyance_allowance,education_allowance,performance_bonus,other_allowances,effective_from,payment_mode,bank_account_number,bank_name,bank_ifsc
EMP001,50000,20000,5000,10000,1500,1600,0,5000,2000,2025-03-01,bank_transfer,1234567890,HDFC Bank,HDFC0001234
EMP002,60000,24000,6000,12000,1500,1600,0,6000,2500,2025-03-01,bank_transfer,9876543210,ICICI Bank,ICIC0005678`

    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="salary_upload_template.csv"'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}
