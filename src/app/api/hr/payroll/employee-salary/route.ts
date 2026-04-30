import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { employeeSalaryQuerySchema } from '@/lib/validations/hr-schemas'

// GET /api/hr/payroll/employee-salary
// Fetch employee salary structures
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = createSupabaseAdmin()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100)
    const queryParams = employeeSalaryQuerySchema.safeParse({
      user_id: searchParams.get('user_id') || undefined,
      active_only: searchParams.get('active_only') || undefined,
    })

    if (!queryParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const userId = queryParams.data.user_id
    const activeOnly = queryParams.data.active_only === 'true'

    // Check if user is HR/superadmin or requesting own data
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHR = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    // If not HR and requesting other user's data, deny
    if (!isHR && userId && userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Build query with exact count for pagination
    let query = adminClient
      .from('employee_salary')
      .select(`
        *,
        employee_profile:user_id (
          first_name,
          last_name,
          employee_id,
          email,
          department,
          designation
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by user_id if provided
    if (userId) {
      query = query.eq('user_id', userId)
    } else if (!isHR) {
      // Non-HR users can only see their own salary
      query = query.eq('user_id', user.id)
    }

    // Filter active only
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    // Apply pagination with exact count
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Re-build query with count header for accurate total
    const { data: salaries, error, count } = await query.range(from, to)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: salaries || [],
      meta: {
        page,
        page_size: pageSize,
        total: count || (salaries?.length || 0),
        total_pages: count ? Math.ceil(count / pageSize) : 1
      }
    })

  } catch (error) {
    apiLogger.error('Fetch employee salary error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employee salary' },
      { status: 500 }
    )
  }
}

// POST /api/hr/payroll/employee-salary
// Create or update employee salary structure (HR/Superadmin only)
export async function POST(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = createSupabaseAdmin()

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can manage employee salaries' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      user_id: z.string().uuid().optional(),


      basic_salary: z.number().optional(),


      hra: z.number().optional(),


      da: z.number().optional(),


      special_allowance: z.string().optional(),


      medical_allowance: z.string().optional(),


      conveyance_allowance: z.string().optional(),


      education_allowance: z.string().optional(),


      performance_bonus: z.string().optional(),


      other_allowances: z.string().optional(),


      pf_employee: z.string().optional(),


      pf_employer: z.string().optional(),


      esi_employee: z.string().optional(),


      esi_employer: z.string().optional(),


      professional_tax: z.string().optional(),


      tds: z.string().optional(),


      loan_deduction: z.string().optional(),


      advance_deduction: z.string().optional(),


      other_deductions: z.string().optional(),


      effective_from: z.string().optional(),


      effective_to: z.string().optional(),


      salary_grade: z.string().optional(),


      payment_mode: z.string().optional(),


      bank_account_number: z.string().optional(),


      bank_name: z.string().optional(),


      bank_ifsc: z.string().optional(),


      id: z.string().uuid(),


      salary_id: z.string().uuid().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      user_id,
      basic_salary,
      hra,
      da,
      special_allowance,
      medical_allowance,
      conveyance_allowance,
      education_allowance,
      performance_bonus,
      other_allowances,
      pf_employee,
      pf_employer,
      esi_employee,
      esi_employer,
      professional_tax,
      tds,
      loan_deduction,
      advance_deduction,
      other_deductions,
      effective_from,
      effective_to,
      salary_grade,
      payment_mode,
      bank_account_number,
      bank_name,
      bank_ifsc
    } = body

    // Validate required fields
    if (!user_id || !basic_salary) {
      return NextResponse.json(
        { success: false, error: 'User ID and basic salary are required' },
        { status: 400 }
      )
    }

    // Calculate PF automatically if not provided (12% of basic, capped at ₹15,000 wage ceiling)
    const PF_WAGE_CEILING = 15000
    const pfBase = Math.min(basic_salary, PF_WAGE_CEILING)
    const calculatedPFEmployee = pf_employee ?? Math.round(pfBase * 0.12)
    const calculatedPFEmployer = pf_employer ?? Math.round(pfBase * 0.12)

    // Calculate ESI if gross < 21000 (0.75% employee, 3.25% employer)
    const grossSalary = (basic_salary || 0) + (hra || 0) + (da || 0) +
                        (special_allowance || 0) + (medical_allowance || 0) +
                        (conveyance_allowance || 0) + (education_allowance || 0) +
                        (performance_bonus || 0) + (other_allowances || 0)

    const calculatedESIEmployee = grossSalary <= 21000 ? (esi_employee ?? Math.round(grossSalary * 0.0075)) : 0
    const calculatedESIEmployer = grossSalary <= 21000 ? (esi_employer ?? Math.round(grossSalary * 0.0325)) : 0

    // Calculate net salary and CTC
    const totalDeductions = calculatedPFEmployee + calculatedESIEmployee + (professional_tax || 0) + (tds || 0) + (loan_deduction || 0) + (advance_deduction || 0) + (other_deductions || 0)
    const netSalary = grossSalary - totalDeductions
    // CTC = gross salary + all employer contributions (PF + ESI)
    const ctc = grossSalary + calculatedPFEmployer + calculatedESIEmployer

    // Insert new salary structure FIRST to ensure atomicity
    // If insert fails, the old active salary is preserved (no data loss)
    const { data: salary, error } = await adminClient
      .from('employee_salary')
      .insert({
        user_id,
        basic_salary,
        gross_salary: grossSalary,
        hra: hra || 0,
        da: da || 0,
        special_allowance: special_allowance || 0,
        medical_allowance: medical_allowance || 0,
        conveyance_allowance: conveyance_allowance || 0,
        education_allowance: education_allowance || 0,
        performance_bonus: performance_bonus || 0,
        other_allowances: other_allowances || 0,
        pf_employee: calculatedPFEmployee,
        pf_employer: calculatedPFEmployer,
        esi_employee: calculatedESIEmployee,
        esi_employer: calculatedESIEmployer,
        professional_tax: professional_tax || 0,
        tds: tds || 0,
        loan_deduction: loan_deduction || 0,
        advance_deduction: advance_deduction || 0,
        other_deductions: other_deductions || 0,
        net_salary: netSalary,
        ctc,
        effective_from: effective_from || new Date().toISOString().split('T')[0],
        effective_to,
        is_active: !effective_to,
        salary_grade,
        payment_mode: payment_mode || 'bank_transfer',
        bank_account_number,
        bank_name,
        bank_ifsc,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    // Deactivate existing active salaries AFTER successful insert
    // Exclude the newly created record so only old ones get deactivated
    if (!effective_to && salary) {
      await adminClient
        .from('employee_salary')
        .update({ is_active: false, effective_to: new Date().toISOString().split('T')[0] })
        .eq('user_id', user_id)
        .eq('is_active', true)
        .neq('id', salary.id)
    }

    return NextResponse.json({
      success: true,
      data: salary,
      message: 'Employee salary structure created successfully'
    })

  } catch (error) {
    apiLogger.error('Create employee salary error', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { success: false, error: 'Failed to create employee salary structure' },
      { status: 500 }
    )
  }
}

// PUT /api/hr/payroll/employee-salary
// Update employee salary structure (HR/Superadmin only)
export async function PUT(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const adminClient = createSupabaseAdmin()

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can update employee salaries' },
        { status: 403 }
      )
    }

    const bodySchema2 = z.object({


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, updated_at: clientUpdatedAt } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Salary ID is required' },
        { status: 400 }
      )
    }

    // Whitelist allowed fields to prevent mass assignment
    const ALLOWED_FIELDS = [
      'basic_salary', 'hra', 'da', 'special_allowance', 'medical_allowance',
      'conveyance_allowance', 'education_allowance', 'performance_bonus', 'other_allowances',
      'pf_employee', 'pf_employer', 'esi_employee', 'esi_employer',
      'professional_tax', 'tds', 'loan_deduction', 'advance_deduction', 'other_deductions',
      'effective_from', 'effective_to', 'salary_grade', 'payment_mode',
      'bank_account_number', 'bank_name', 'bank_ifsc'
    ] as const

    const updates: Record<string, unknown> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // Add updated_by and updated_at
    updates.updated_by = user.id
    updates.updated_at = new Date().toISOString()

    // Recalculate derived totals (gross_salary, net_salary, ctc) when component values change
    // Fetch the existing record to merge with updates for accurate recalculation
    const { data: existingSalary } = await adminClient
      .from('employee_salary')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (existingSalary) {
      const merged = { ...existingSalary, ...updates }
      const earningFields = ['basic_salary', 'hra', 'da', 'special_allowance', 'medical_allowance',
        'conveyance_allowance', 'education_allowance', 'performance_bonus', 'other_allowances'] as const
      const deductionFields = ['pf_employee', 'esi_employee', 'professional_tax', 'tds',
        'loan_deduction', 'advance_deduction', 'other_deductions'] as const

      // Check if any salary component was updated
      const hasEarningChange = earningFields.some(f => f in body)
      const hasDeductionChange = deductionFields.some(f => f in body)

      if (hasEarningChange || hasDeductionChange) {
        const grossSalary = earningFields.reduce((sum, f) => sum + (Number(merged[f]) || 0), 0)
        const totalDeductions = deductionFields.reduce((sum, f) => sum + (Number(merged[f]) || 0), 0)
        const netSalary = grossSalary - totalDeductions
        // CTC = gross + employer PF + employer ESI
        const ctc = grossSalary + (Number(merged.pf_employer) || 0) + (Number(merged.esi_employer) || 0)

        updates.gross_salary = grossSalary
        updates.net_salary = netSalary
        updates.ctc = ctc
      }
    }

    // Build the update query with optimistic locking
    let updateQuery = adminClient
      .from('employee_salary')
      .update(updates)
      .eq('id', id)

    // If client provides updated_at, use it for optimistic locking
    if (clientUpdatedAt) {
      updateQuery = updateQuery.eq('updated_at', clientUpdatedAt)
    }

    const { data: salary, error } = await updateQuery
      .select()
      .maybeSingle()

    if (error && error.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      )
    }

    if (error) {
      throw error
    }

    if (!salary) {
      return NextResponse.json(
        { success: false, error: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      data: salary,
      message: 'Employee salary structure updated successfully'
    })

  } catch (error) {
    apiLogger.error('Update employee salary error', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json(
      { success: false, error: 'Failed to update employee salary structure' },
      { status: 500 }
    )
  }
}

// DELETE /api/hr/payroll/employee-salary
// Delete employee salary structure (HR/Superadmin only)
export async function DELETE(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can delete employee salaries' },
        { status: 403 }
      )
    }

    const bodySchema3 = z.object({


      salary_id: z.string().optional(),


    })


    const { data: body, error: _valErr3 } = await parseBody(request, bodySchema3)
    if (_valErr3) return _valErr3
    const id = body.salary_id

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Salary ID is required (send salary_id in request body)' },
        { status: 400 }
      )
    }

    // Soft delete by marking as inactive
    const { error } = await adminClient
      .from('employee_salary')
      .update({
        is_active: false,
        effective_to: new Date().toISOString().split('T')[0],
        updated_by: user.id
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Employee salary structure deactivated successfully'
    })

  } catch (error) {
    apiLogger.error('Delete employee salary error', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json(
      { success: false, error: 'Failed to delete employee salary structure' },
      { status: 500 }
    )
  }
}
