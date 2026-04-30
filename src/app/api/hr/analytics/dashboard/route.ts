
// =====================================================
// HR ANALYTICS DASHBOARD API
// GET: Workforce analytics and insights
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccessByUserId } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET: Analytics dashboard
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const isHR = await checkHRAccessByUserId(adminClient, user.id)
    if (!isHR) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view') || 'overview' // overview, attrition, learning, performance

    if (view === 'attrition') {
      // Attrition risk analysis - support pagination
      const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
      const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '50') || 50))
      const offset = (page - 1) * pageSize

      const { data: attritionRisks, error: attritionError, count: totalAttritionCount } = await adminClient
        .from('attrition_risk_scores')
        .select(`
          *,
          employee:employees!attrition_risk_scores_employee_id_fkey(
            employee_id,
            full_name,
            work_email,
            sub_role,
            department,
            date_of_joining
          )
        `, { count: 'exact' })
        .order('risk_score', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (attritionError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch attrition data' }, { status: 500 })
      }

      // Calculate summary
      const summary = {
        total_employees_analyzed: attritionRisks.length,
        critical_risk: attritionRisks.filter((r: { risk_level: string }) => r.risk_level === 'CRITICAL').length,
        high_risk: attritionRisks.filter((r: { risk_level: string }) => r.risk_level === 'HIGH').length,
        medium_risk: attritionRisks.filter((r: { risk_level: string }) => r.risk_level === 'MEDIUM').length,
        low_risk: attritionRisks.filter((r: { risk_level: string }) => r.risk_level === 'LOW').length,
        avg_risk_score: attritionRisks.length > 0
          ? Math.round(
              attritionRisks.reduce((sum: number, r: { risk_score: number }) => sum + r.risk_score, 0) / attritionRisks.length
            )
          : 0
      }

      return NextResponse.json({
        success: true,
        data: {
          attrition_risks: attritionRisks,
          summary,
          pagination: {
            page,
            pageSize,
            total: totalAttritionCount || 0,
            totalPages: Math.ceil((totalAttritionCount || 0) / pageSize)
          }
        }
      })
    } else if (view === 'learning') {
      // Learning analytics
      const { data: courses } = await adminClient
        .from('training_courses')
        .select('id, course_name')
        .eq('is_active', true)

      const { data: enrollments } = await adminClient
        .from('employee_course_enrollments')
        .select('course_id, enrollment_status, time_spent_hours, feedback_rating')
        .limit(5000)

      interface EnrollmentRow { course_id: string; enrollment_status: string; time_spent_hours: number | null; feedback_rating: number | null }
      interface CourseRow { id: string; course_name: string }
      interface CourseStats { total: number; completed: number; in_progress: number; avg_rating: number; total_hours: number; ratings: number[] }

      // Group by course
      const courseMap = new Map<string, CourseStats>()
      enrollments?.forEach((e: EnrollmentRow) => {
        if (!courseMap.has(e.course_id)) {
          courseMap.set(e.course_id, {
            total: 0,
            completed: 0,
            in_progress: 0,
            avg_rating: 0,
            total_hours: 0,
            ratings: []
          })
        }
        const stats = courseMap.get(e.course_id)!
        stats.total++
        if (e.enrollment_status === 'COMPLETED') stats.completed++
        if (e.enrollment_status === 'IN_PROGRESS') stats.in_progress++
        stats.total_hours += e.time_spent_hours || 0
        if (e.feedback_rating) stats.ratings.push(e.feedback_rating)
      })

      const learningStats = courses?.map((course: CourseRow) => {
        const stats = courseMap.get(course.id) || { total: 0, completed: 0, in_progress: 0, ratings: [], total_hours: 0 }
        const avgRating = stats.ratings.length > 0
          ? stats.ratings.reduce((a: number, b: number) => a + b, 0) / stats.ratings.length
          : 0

        return {
          course_id: course.id,
          course_name: course.course_name,
          total_enrollments: stats.total,
          completed: stats.completed,
          in_progress: stats.in_progress,
          completion_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          avg_rating: Math.round(avgRating * 10) / 10,
          total_hours: Math.round(stats.total_hours)
        }
      })

      const summary = {
        total_courses: courses?.length || 0,
        total_enrollments: enrollments?.length || 0,
        total_completed: enrollments?.filter((e: EnrollmentRow) => e.enrollment_status === 'COMPLETED').length || 0,
        overall_completion_rate: (enrollments?.length || 0) > 0
          ? Math.round((enrollments!.filter((e: EnrollmentRow) => e.enrollment_status === 'COMPLETED').length / enrollments!.length) * 100)
          : 0
      }

      return NextResponse.json({
        success: true,
        data: {
          learning_stats: learningStats,
          summary
        }
      })
    } else if (view === 'performance') {
      // Performance distribution - fetch latest reviews only (limited to avoid pulling all history)
      const { data: reviews } = await adminClient
        .from('performance_reviews')
        .select('overall_rating, review_type, employee_id')
        .eq('review_type', 'MANAGER')
        .order('review_date', { ascending: false })
        .limit(5000)

      interface ReviewRow { overall_rating: number; review_type: string; employee_id: string }
      // Get latest review per employee
      const employeeLatestReview = new Map<string, number>()
      reviews?.forEach((r: ReviewRow) => {
        if (!employeeLatestReview.has(r.employee_id)) {
          employeeLatestReview.set(r.employee_id, r.overall_rating)
        }
      })

      const ratings = Array.from(employeeLatestReview.values())
      const summary = {
        total_employees_reviewed: ratings.length,
        avg_rating: ratings.length > 0
          ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 100) / 100
          : 0,
        rating_5: ratings.filter((r: number) => r >= 4.5).length,
        rating_4: ratings.filter((r: number) => r >= 3.5 && r < 4.5).length,
        rating_3: ratings.filter((r: number) => r >= 2.5 && r < 3.5).length,
        rating_2: ratings.filter((r: number) => r >= 1.5 && r < 2.5).length,
        rating_1: ratings.filter((r: number) => r < 1.5).length
      }

      // Get PIPs
      const { data: pips } = await adminClient
        .from('performance_improvement_plans')
        .select('status')

      const pipSummary = {
        total_pips: pips?.length || 0,
        active_pips: pips?.filter((p: { status: string }) => p.status === 'ACTIVE').length || 0,
        completed_pips: pips?.filter((p: { status: string }) => p.status === 'COMPLETED').length || 0
      }

      return NextResponse.json({
        success: true,
        data: {
          performance_summary: summary,
          pip_summary: pipSummary
        }
      })
    } else {
      // Overview dashboard — exclude soft-deleted employees
      const { data: employees } = await adminClient
        .from('employees')
        .select('id, status, employee_status, sub_role, department, date_of_joining, gender')
        .is('deleted_at', null)

      interface EmployeeRow { id: string; status?: string | null; employee_status?: string | null; sub_role?: string | null; department: string | null; date_of_joining: string | null; gender: string | null }

      // Normalize status: check `employee_status` first (canonical), then `status`, convert to uppercase
      const getEmployeeStatus = (e: EmployeeRow): string => {
        const raw = e.employee_status || e.status || ''
        return typeof raw === 'string' ? raw.toUpperCase() : ''
      }

      const activeEmployees = employees?.filter((e: EmployeeRow) => getEmployeeStatus(e) === 'ACTIVE') || []

      // Headcount metrics
      const headcount = {
        total_employees: employees?.length || 0,
        active_employees: activeEmployees.length,
        on_leave: employees?.filter((e: EmployeeRow) => getEmployeeStatus(e) === 'ON_LEAVE').length || 0,
        on_notice: employees?.filter((e: EmployeeRow) => getEmployeeStatus(e) === 'ON_NOTICE').length || 0
      }

      // Department distribution - default null departments to 'Unassigned'
      const deptMap = new Map<string, number>()
      activeEmployees.forEach((e: EmployeeRow) => {
        const dept = e.department || 'Unassigned'
        deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
      })
      const departmentDistribution = Array.from(deptMap.entries()).map(([dept, count]) => ({
        department: dept,
        count
      }))

      // Role distribution - default null sub_role to 'Unassigned'
      const roleMap = new Map<string, number>()
      activeEmployees.forEach((e: EmployeeRow) => {
        const role = e.sub_role || 'Unassigned'
        roleMap.set(role, (roleMap.get(role) || 0) + 1)
      })
      const roleDistribution = Array.from(roleMap.entries()).map(([role, count]) => ({
        role,
        count
      }))

      // Gender distribution
      const genderMap = new Map<string, number>()
      activeEmployees.forEach((e: EmployeeRow) => {
        genderMap.set(e.gender || 'NOT_SPECIFIED', (genderMap.get(e.gender || 'NOT_SPECIFIED') || 0) + 1)
      })
      const genderDistribution = Array.from(genderMap.entries()).map(([gender, count]) => ({
        gender,
        count
      }))

      // Get latest analytics snapshot - use .limit(1) instead of .maybeSingle() to avoid crash when table is empty
      const { data: snapshotRows } = await adminClient
        .from('workforce_analytics_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1)

      const snapshot = snapshotRows?.[0] || null

      return NextResponse.json({
        success: true,
        data: {
          headcount,
          department_distribution: departmentDistribution,
          role_distribution: roleDistribution,
          gender_distribution: genderDistribution,
          latest_snapshot: snapshot
        }
      })
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Analytics Dashboard GET Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
