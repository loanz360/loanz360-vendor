
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { isDepartmentValidForRole, getDefaultDepartment } from '@/lib/constants/department-mapping'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export const runtime = 'nodejs'

interface CSVRow {
  email: string
  department?: string
  professionalMail?: string
  location?: string
  languagesKnown?: string
  reportingManagerEmail?: string
}

interface ValidationError {
  row: number
  email: string
  errors: string[]
}

/**
 * Verify admin authentication
 */
async function verifyAdmin(_request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  // Allow SUPER_ADMIN, ADMIN, and HR roles
  if (!['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'].includes(sessionData.role)) {
    return { authorized: false, error: 'Forbidden - Admin/HR access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * Parse CSV content
 */
function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV must have header row and at least one data row')
  }

  const headers = lines[0].split(',').map(h => h.trim())
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: CSVRow = { email: '' }

    headers.forEach((header, index) => {
      const value = values[index] || ''
      switch (header.toLowerCase()) {
        case 'email':
          row.email = value
          break
        case 'department':
          row.department = value
          break
        case 'professional_mail':
        case 'professionalmail':
          row.professionalMail = value
          break
        case 'location':
          row.location = value
          break
        case 'languages_known':
        case 'languages':
          row.languagesKnown = value
          break
        case 'reporting_manager':
        case 'manager_email':
          row.reportingManagerEmail = value
          break
      }
    })

    if (row.email) {
      rows.push(row)
    }
  }

  return rows
}

/**
 * Validate CSV data
 */
async function validateCSVData(rows: CSVRow[], supabase: ReturnType<typeof createSupabaseAdmin>): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowErrors: string[] = []

    // Validate email
    if (!emailRegex.test(row.email)) {
      rowErrors.push('Invalid email format')
    }

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, sub_role, role')
      .eq('email', row.email)
      .maybeSingle()

    if (!user) {
      rowErrors.push('User not found in system')
    } else if (user.role !== 'EMPLOYEE') {
      rowErrors.push('User is not an employee')
    }

    // Validate professional email if provided
    if (row.professionalMail && !emailRegex.test(row.professionalMail)) {
      rowErrors.push('Invalid professional email format')
    }

    // Validate department for role
    if (row.department && user?.sub_role) {
      if (!isDepartmentValidForRole(row.department, user.sub_role)) {
        rowErrors.push(`Department '${row.department}' not valid for role '${user.sub_role}'`)
      }
    }

    // Validate reporting manager
    if (row.reportingManagerEmail) {
      const { data: manager } = await supabase
        .from('users')
        .select('id')
        .eq('email', row.reportingManagerEmail)
        .maybeSingle()

      if (!manager) {
        rowErrors.push('Reporting manager not found')
      }
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: i + 2, // +2 because of header row and 0-index
        email: row.email,
        errors: rowErrors
      })
    }
  }

  return errors
}

/**
 * POST /api/employees/bulk-import
 * Bulk import employee professional details from CSV
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const auth = await verifyAdmin(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('csv') as File
    const validateOnly = formData.get('validateOnly') === 'true'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No CSV file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only CSV files are allowed' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()

    // Parse CSV
    let rows: CSVRow[]
    try {
      rows = parseCSV(content)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `CSV parsing error: ${(error as Error).message}` },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Validate data
    const validationErrors = await validateCSVData(rows, supabase)

    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        validationErrors,
        stats: {
          totalRows: rows.length,
          validRows: rows.length - validationErrors.length,
          invalidRows: validationErrors.length
        }
      }, { status: 400 })
    }

    // If validate only, return success
    if (validateOnly) {
      return NextResponse.json({
        success: true,
        message: 'Validation passed',
        stats: {
          totalRows: rows.length,
          validRows: rows.length,
          invalidRows: 0
        }
      })
    }

    // Process imports
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as { email: string; error: string }[]
    }

    for (const row of rows) {
      try {
        // Get user ID
        const { data: user } = await supabase
          .from('users')
          .select('id, sub_role')
          .eq('email', row.email)
          .maybeSingle()

        if (!user) continue

        // Get manager ID if provided
        let managerId = null
        let managerName = null
        if (row.reportingManagerEmail) {
          const { data: manager } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('email', row.reportingManagerEmail)
            .maybeSingle()

          if (manager) {
            managerId = manager.id
            managerName = manager.full_name
          }
        }

        // Parse languages
        const languages = row.languagesKnown
          ? row.languagesKnown.split(';').map(l => l.trim()).filter(l => l)
          : []

        // Get department (use provided or default)
        const department = row.department || getDefaultDepartment(user.sub_role)

        // Upsert profile
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            department,
            professional_mail: row.professionalMail || null,
            location: row.location || null,
            languages_known: languages,
            reporting_manager_id: managerId,
            reporting_manager_name: managerName,
            last_updated_by: auth.userId,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (upsertError) {
          results.failed++
          results.errors.push({
            email: row.email,
            error: upsertError.message
          })
        } else {
          results.successful++
        }
      } catch (error) {
        results.failed++
        results.errors.push({
          email: row.email,
          error: (error as Error).message
        })
      }
    }

    logger.info('Bulk import completed', {
      userId: auth.userId,
      totalRows: rows.length,
      successful: results.successful,
      failed: results.failed
    })

    return NextResponse.json({
      success: true,
      message: `Import completed: ${results.successful} successful, ${results.failed} failed`,
      results: {
        totalRows: rows.length,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors
      }
    })
  } catch (error) {
    logger.error('Error in POST /api/employees/bulk-import', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
