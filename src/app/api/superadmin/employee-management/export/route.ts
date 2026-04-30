import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission, getAccessibleDepartments } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/employee-management/export
 * Export employee data in various formats (CSV, XLSX, PDF)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'EXPORT_DATA')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to export data' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv' // csv, xlsx, json
    const exportType = searchParams.get('type') || 'employees' // employees, analytics, performance, targets
    const departmentId = searchParams.get('department')
    const subRole = searchParams.get('sub_role')
    const status = searchParams.get('status')

    const supabase = createSupabaseAdmin()

    // Get accessible departments
    const accessibleDepartments = await getAccessibleDepartments(auth.userId!, auth.role!)

    let data: any[] = []
    let filename = 'export'

    switch (exportType) {
      case 'employees': {
        // Export employee list
        let query = supabase
          .from('employees')
          .select(`
            employee_id,
            full_name,
            work_email,
            personal_email,
            mobile_number,
            sub_role,
            employee_status,
            is_active,
            date_of_joining,
            present_address,
            city,
            state,
            departments:department_id (name, code)
          `)
          .is('deleted_at', null)
          .order('employee_id', { ascending: true })

        if (accessibleDepartments.length > 0) {
          query = query.in('department_id', accessibleDepartments)
        }

        if (departmentId) {
          query = query.eq('department_id', departmentId)
        }

        if (subRole) {
          query = query.eq('sub_role', subRole)
        }

        if (status) {
          query = query.eq('employee_status', status)
        }

        const { data: employees, error } = await query

        if (error) {
          logger.error('Error fetching employees for export:', error)
          return NextResponse.json(
            { success: false, error: 'Failed to fetch employees' },
            { status: 500 }
          )
        }

        // Flatten data for export
        data = (employees || []).map(emp => ({
          'Employee ID': emp.employee_id,
          'Full Name': emp.full_name,
          'Work Email': emp.work_email,
          'Personal Email': emp.personal_email,
          'Mobile': emp.mobile_number,
          'Department': emp.departments?.name || 'N/A',
          'Sub Role': emp.sub_role,
          'Status': emp.employee_status,
          'Active': emp.is_active ? 'Yes' : 'No',
          'Date of Joining': emp.date_of_joining,
          'City': emp.city || '',
          'State': emp.state || ''
        }))

        filename = `employees_${new Date().toISOString().split('T')[0]}`
        break
      }

      case 'analytics': {
        // Export analytics summary
        const { data: employees } = await supabase
          .from('employees')
          .select(`
            sub_role,
            employee_status,
            is_active,
            date_of_joining,
            departments:department_id (name)
          `)
          .is('deleted_at', null)

        // Aggregate by department and role
        const analytics: Record<string, any> = {}

        employees?.forEach(emp => {
          const dept = emp.departments?.name || 'Unknown'
          const role = emp.sub_role
          const key = `${dept}_${role}`

          if (!analytics[key]) {
            analytics[key] = {
              Department: dept,
              'Sub Role': role,
              'Total Employees': 0,
              'Active': 0,
              'Inactive': 0
            }
          }

          analytics[key]['Total Employees']++
          if (emp.is_active) {
            analytics[key]['Active']++
          } else {
            analytics[key]['Inactive']++
          }
        })

        data = Object.values(analytics)
        filename = `analytics_${new Date().toISOString().split('T')[0]}`
        break
      }

      case 'performance': {
        // Export performance data
        const { data: performanceLogs } = await supabase
          .from('employee_performance_logs')
          .select(`
            *,
            employees:employee_id (
              employee_id,
              full_name,
              sub_role,
              departments:department_id (name)
            )
          `)
          .order('period_end', { ascending: false })
          .limit(1000)

        data = (performanceLogs || []).map(log => ({
          'Employee ID': log.employees?.employee_id,
          'Employee Name': log.employees?.full_name,
          'Department': log.employees?.departments?.name,
          'Sub Role': log.employees?.sub_role,
          'Period Start': log.period_start,
          'Period End': log.period_end,
          'Period Type': log.period_type,
          'Productivity Score': log.productivity_score,
          'Performance Rating': log.performance_rating || 'N/A',
          'Rank in Team': log.rank_in_team || 'N/A',
          'Rank in Department': log.rank_in_department || 'N/A'
        }))

        filename = `performance_${new Date().toISOString().split('T')[0]}`
        break
      }

      case 'targets': {
        // Export targets data
        const { data: targets } = await supabase
          .from('employee_targets')
          .select(`
            *,
            employees:employee_id (
              employee_id,
              full_name,
              sub_role,
              departments:department_id (name)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(1000)

        data = (targets || []).map(target => ({
          'Employee ID': target.employees?.employee_id,
          'Employee Name': target.employees?.full_name,
          'Department': target.employees?.departments?.name,
          'Target Name': target.target_name,
          'Period': target.target_period,
          'Start Date': target.start_date,
          'End Date': target.end_date,
          'Achievement %': target.achievement_percentage,
          'Is Achieved': target.is_achieved ? 'Yes' : 'No',
          'Is Active': target.is_active ? 'Yes' : 'No'
        }))

        filename = `targets_${new Date().toISOString().split('T')[0]}`
        break
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid export type' },
          { status: 400 }
        )
    }

    // Format response based on requested format
    switch (format.toLowerCase()) {
      case 'csv': {
        // Convert to CSV
        if (data.length === 0) {
          return NextResponse.json(
            { success: false, error: 'No data to export' },
            { status: 404 }
          )
        }

        const headers = Object.keys(data[0])
        const csvRows = [
          headers.join(','),
          ...data.map(row =>
            headers.map(header => {
              const value = row[header]
              // Escape commas and quotes
              const escaped = String(value).replace(/"/g, '""')
              return `"${escaped}"`
            }).join(',')
          )
        ]

        const csvContent = csvRows.join('\n')

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}.csv"`
          }
        })
      }

      case 'json': {
        return NextResponse.json({
          success: true,
          data,
          exported_at: new Date().toISOString(),
          total_records: data.length
        })
      }

      case 'xlsx': {
        // For XLSX, return JSON with instructions to use frontend library
        // In production, you'd use a library like 'exceljs' or 'xlsx'
        return NextResponse.json({
          success: true,
          message: 'XLSX export requires frontend library. Use JSON format and convert client-side.',
          data,
          total_records: data.length
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported format. Use csv, json, or xlsx' },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Error in GET /api/superadmin/employee-management/export:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
