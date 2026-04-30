import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission } from '@/lib/auth/employee-mgmt-auth'
import { logEmployeeActivity } from '@/lib/services/employee-audit'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeText } from '@/lib/validations/input-sanitization'
import crypto from 'crypto'

export const runtime = 'nodejs'

function generateTemporaryPassword(): string {
  const length = 12
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%^&*'
  const allChars = uppercase + lowercase + digits + special

  let password = ''
  password += uppercase[crypto.randomInt(0, uppercase.length)]
  password += lowercase[crypto.randomInt(0, lowercase.length)]
  password += digits[crypto.randomInt(0, digits.length)]
  password += special[crypto.randomInt(0, special.length)]

  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)]
  }

  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

interface ImportEmployee {
  full_name: string
  work_email: string
  personal_email: string
  mobile_number: string
  sub_role: string
  department_id?: string
  department_name?: string
  date_of_joining: string
  present_address: string
  permanent_address?: string
  city?: string
  state?: string
  pincode?: string
  emergency_contact_name?: string
  emergency_contact_number?: string
  emergency_contact_relation?: string
  qualification?: string
  experience_years?: string
  previous_company?: string
}

interface ImportResult {
  row: number
  success: boolean
  employee_id?: string
  work_email: string
  temporary_password?: string
  error?: string
}

/**
 * POST /api/superadmin/employee-management/bulk-import
 * Bulk create employees from validated CSV data
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'ADD_EMPLOYEE')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { employees } = body as { employees: ImportEmployee[] }

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No employee data provided' },
        { status: 400 }
      )
    }

    // Limit batch size
    if (employees.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 employees per batch' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Resolve department names to IDs if needed
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')

    const deptNameToId = new Map<string, string>()
    departments?.forEach((d) => {
      deptNameToId.set(d.name.toLowerCase(), d.id)
    })

    const results: ImportResult[] = []

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i]
      const row = i + 2 // CSV row number (header = 1)

      try {
        const workEmail = emp.work_email.toLowerCase().trim()

        // Resolve department
        let departmentId = emp.department_id || null
        if (!departmentId && emp.department_name) {
          departmentId = deptNameToId.get(emp.department_name.toLowerCase()) || null
        }

        // Check duplicate
        const { data: existing } = await supabase
          .from('employees')
          .select('id')
          .or(`work_email.eq.${workEmail},mobile_number.eq.${emp.mobile_number}`)
          .is('deleted_at', null)
          .limit(1)

        if (existing && existing.length > 0) {
          results.push({ row, success: false, work_email: workEmail, error: 'Duplicate email or mobile' })
          continue
        }

        // Generate temp password
        const temporaryPassword = generateTemporaryPassword()

        // Create auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: workEmail,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: emp.full_name.trim(),
            role: 'EMPLOYEE',
            sub_role: emp.sub_role,
          },
        })

        if (authError || !authUser.user) {
          results.push({ row, success: false, work_email: workEmail, error: `Auth error: ${authError?.message || 'Unknown'}` })
          continue
        }

        // Insert employee record
        const { data: newEmployee, error: insertError } = await supabase
          .from('employees')
          .insert({
            user_id: authUser.user.id,
            full_name: sanitizeText(emp.full_name.trim()),
            mobile_number: emp.mobile_number,
            work_email: workEmail,
            personal_email: emp.personal_email.toLowerCase().trim(),
            present_address: sanitizeText(emp.present_address || ''),
            permanent_address: sanitizeText(emp.permanent_address || emp.present_address || ''),
            city: sanitizeText(emp.city || ''),
            state: sanitizeText(emp.state || ''),
            pincode: emp.pincode || '',
            department_id: departmentId,
            sub_role: emp.sub_role.toUpperCase(),
            employee_status: 'PENDING_ONBOARDING',
            date_of_joining: emp.date_of_joining,
            emergency_contact_name: sanitizeText(emp.emergency_contact_name || ''),
            emergency_contact_number: emp.emergency_contact_number || '',
            emergency_contact_relation: emp.emergency_contact_relation || null,
            qualification: emp.qualification ? sanitizeText(emp.qualification) : null,
            experience_years: emp.experience_years ? parseInt(emp.experience_years) : null,
            previous_company: emp.previous_company ? sanitizeText(emp.previous_company) : null,
            password_reset_required: true,
            profile_completed: false,
            first_login_completed: false,
            is_active: true,
            created_by: auth.userId,
          })
          .select('id, employee_id')
          .maybeSingle()

        if (insertError || !newEmployee) {
          // Rollback auth user
          await supabase.auth.admin.deleteUser(authUser.user.id)
          results.push({ row, success: false, work_email: workEmail, error: 'Failed to create employee record' })
          continue
        }

        // Create users table record
        await supabase.from('users').insert({
          id: authUser.user.id,
          email: workEmail,
          full_name: emp.full_name.trim(),
          role: 'EMPLOYEE',
        }).select().maybeSingle()

        // Log activity
        logEmployeeActivity({
          employeeId: newEmployee.id,
          action: 'EMPLOYEE_CREATED_BULK',
          actionDetails: { employee_id: newEmployee.employee_id, import_batch: true },
          performedBy: auth.userId!,
          performedByRole: auth.role || 'SUPER_ADMIN',
        }).catch(() => { /* Non-critical side effect */ })

        results.push({
          row,
          success: true,
          employee_id: newEmployee.employee_id,
          work_email: workEmail,
          temporary_password: temporaryPassword,
        })
      } catch (error) {
        results.push({
          row,
          success: false,
          work_email: emp.work_email || 'unknown',
          error: `Unexpected error: ${(error as Error).message}`,
        })
      }
    }

    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    logger.info(`Bulk import completed: ${successful.length} success, ${failed.length} failed, by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      message: `Imported ${successful.length} of ${employees.length} employees`,
      data: {
        results,
        summary: {
          total: employees.length,
          successful: successful.length,
          failed: failed.length,
        },
      },
    })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/bulk-import:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
