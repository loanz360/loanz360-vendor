import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { logPartnerCreated, sanitizeForAudit } from '@/lib/audit/audit-logger'
import { apiLogger } from '@/lib/utils/logger'


interface ValidationError {
  row: number
  field: string
  value: any
  error: string
}

interface ImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: ValidationError[]
  createdPartners: any[]
}

/**
 * POST /api/superadmin/partner-management/partners/import
 * Bulk import partners from CSV
 *
 * Rate Limit: 30 requests per minute
 */
export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await importPartnersHandler(req)
  })
}

async function importPartnersHandler(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse CSV data from request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { data: csvData, validateOnly = false } = body

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid CSV data provided' },
        { status: 400 }
      )
    }

    // Validate and process each row
    const validationErrors: ValidationError[] = []
    const validRows: any[] = []

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i]
      const rowNumber = i + 2 // +2 because row 1 is header, arrays start at 0

      // Validate required fields
      const rowErrors = validatePartnerRow(row, rowNumber)

      if (rowErrors.length > 0) {
        validationErrors.push(...rowErrors)
      } else {
        validRows.push(row)
      }
    }

    // If validation only, return validation results
    if (validateOnly) {
      return NextResponse.json({
        success: true,
        validation: {
          totalRows: csvData.length,
          validRows: validRows.length,
          invalidRows: validationErrors.length,
          errors: validationErrors
        }
      })
    }

    // If there are validation errors and not validation-only mode, return errors
    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        validation: {
          totalRows: csvData.length,
          validRows: validRows.length,
          invalidRows: validationErrors.length,
          errors: validationErrors
        }
      }, { status: 400 })
    }

    // Import valid rows
    const supabase = createSupabaseAdmin()
    const importResult: ImportResult = {
      totalRows: csvData.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      createdPartners: []
    }

    // Process each valid row
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const rowNumber = i + 2

      try {
        // Check for duplicates
        const { data: existingPartner } = await supabase
          .from('partners')
          .select('id')
          .or(`work_email.eq.${row.work_email},mobile_number.eq.${row.mobile_number}`)
          .maybeSingle()

        if (existingPartner) {
          importResult.errorCount++
          importResult.errors.push({
            row: rowNumber,
            field: 'work_email/mobile_number',
            value: `${row.work_email} / ${row.mobile_number}`,
            error: 'Partner with this email or mobile already exists'
          })
          continue
        }

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: row.work_email,
          email_confirm: true,
          user_metadata: {
            full_name: row.full_name,
            role: 'PARTNER',
            sub_role: row.partner_type
          }
        })

        if (authError) {
          importResult.errorCount++
          importResult.errors.push({
            row: rowNumber,
            field: 'auth_creation',
            value: row.work_email,
            error: authError.message
          })
          continue
        }

        const authUserId = authData.user.id

        // Create user record
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authUserId,
            email: row.work_email,
            full_name: row.full_name,
            role: 'PARTNER',
            sub_role: row.partner_type,
            status: 'ACTIVE',
            email_verified: true,
            mobile_verified: false,
            mobile_number: row.mobile_number
          })

        if (userError) {
          // Rollback auth user
          await supabase.auth.admin.deleteUser(authUserId).catch(() => { /* Non-critical side effect */ })

          importResult.errorCount++
          importResult.errors.push({
            row: rowNumber,
            field: 'user_creation',
            value: row.work_email,
            error: userError.message
          })
          continue
        }

        // Create partner record
        const { data: newPartner, error: partnerError } = await supabase
          .from('partners')
          .insert({
            user_id: authUserId,
            partner_type: row.partner_type,
            full_name: row.full_name,
            mobile_number: row.mobile_number,
            work_email: row.work_email,
            personal_email: row.personal_email || null,
            present_address: row.present_address,
            city: row.city || null,
            state: row.state || null,
            pincode: row.pincode || null,
            status: 'ACTIVE',
            registration_source: 'bulk_import',
            added_by: auth.userId,
            joining_date: new Date().toISOString().split('T')[0],
            is_active: true
          })
          .select()
          .maybeSingle()

        if (partnerError) {
          // Rollback user and auth
          await supabase.from('users').delete().eq('id', authUserId).catch(() => { /* Non-critical side effect */ })
          await supabase.auth.admin.deleteUser(authUserId).catch(() => { /* Non-critical side effect */ })

          importResult.errorCount++
          importResult.errors.push({
            row: rowNumber,
            field: 'partner_creation',
            value: row.work_email,
            error: partnerError.message
          })
          continue
        }

        // Log audit trail
        try {
          await logPartnerCreated(
            newPartner.id,
            sanitizeForAudit({
              ...row,
              registration_source: 'bulk_import',
              import_row: rowNumber
            }),
            auth.userId!,
            request
          )
        } catch (auditError) {
          apiLogger.error('Audit logging failed for bulk import', auditError)
        }

        importResult.successCount++
        importResult.createdPartners.push({
          partner_id: newPartner.partner_id,
          full_name: newPartner.full_name,
          email: newPartner.work_email
        })

      } catch (error: unknown) {
        importResult.errorCount++
        importResult.errors.push({
          row: rowNumber,
          field: 'general',
          value: row.work_email,
          error: 'Operation failed'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${importResult.successCount} partners created, ${importResult.errorCount} errors`,
      result: importResult
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Import API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during import' },
      { status: 500 }
    )
  }
}

/**
 * Validate a single partner row
 */
function validatePartnerRow(row: any, rowNumber: number): ValidationError[] {
  const errors: ValidationError[] = []

  // Required fields
  const requiredFields = [
    'partner_type',
    'full_name',
    'work_email',
    'mobile_number',
    'present_address'
  ]

  for (const field of requiredFields) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push({
        row: rowNumber,
        field,
        value: row[field],
        error: `${field} is required`
      })
    }
  }

  // Validate partner type
  const validTypes = ['BUSINESS_ASSOCIATE', 'BUSINESS_PARTNER', 'CHANNEL_PARTNER']
  if (row.partner_type && !validTypes.includes(row.partner_type)) {
    errors.push({
      row: rowNumber,
      field: 'partner_type',
      value: row.partner_type,
      error: 'Must be BUSINESS_ASSOCIATE, BUSINESS_PARTNER, or CHANNEL_PARTNER'
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (row.work_email && !emailRegex.test(row.work_email)) {
    errors.push({
      row: rowNumber,
      field: 'work_email',
      value: row.work_email,
      error: 'Invalid email format'
    })
  }

  if (row.personal_email && row.personal_email.trim() && !emailRegex.test(row.personal_email)) {
    errors.push({
      row: rowNumber,
      field: 'personal_email',
      value: row.personal_email,
      error: 'Invalid email format'
    })
  }

  // Validate mobile number (10 digits, starts with 6-9)
  const mobileRegex = /^[6-9]\d{9}$/
  if (row.mobile_number && !mobileRegex.test(row.mobile_number)) {
    errors.push({
      row: rowNumber,
      field: 'mobile_number',
      value: row.mobile_number,
      error: 'Must be 10 digits starting with 6-9'
    })
  }

  // Validate pincode if provided
  if (row.pincode && row.pincode.trim() && !/^\d{6}$/.test(row.pincode)) {
    errors.push({
      row: rowNumber,
      field: 'pincode',
      value: row.pincode,
      error: 'Must be 6 digits'
    })
  }

  return errors
}

/**
 * GET /api/superadmin/partner-management/partners/import/template
 * Download CSV template for bulk import
 */
export async function GET(request: NextRequest) {
  const template = `partner_type,full_name,work_email,personal_email,mobile_number,present_address,city,state,pincode
BUSINESS_ASSOCIATE,John Doe,john.doe@example.com,john.personal@example.com,9876543210,"123 Main St, Mumbai",Mumbai,Maharashtra,400001
BUSINESS_PARTNER,Jane Smith,jane.smith@example.com,,9123456780,"456 Park Ave, Delhi",Delhi,Delhi,110001
CHANNEL_PARTNER,Bob Johnson,bob.johnson@example.com,bob@personal.com,8234567890,"789 Lake Rd, Bangalore",Bangalore,Karnataka,560001`

  return new NextResponse(template, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="partner_import_template.csv"'
    }
  })
}
