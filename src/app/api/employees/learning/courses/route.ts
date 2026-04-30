import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// LEARNING MANAGEMENT API - COURSES
// GET: List courses and enrollments
// POST: Enroll in course
// PATCH: Update progress
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

async function getEmployeeId(supabase: any, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id, sub_role')
    .eq('user_id', userId)
    .maybeSingle()

  return employee
}

// GET: List courses and enrollments
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view') || 'available' // available, my-courses, completed

    if (view === 'my-courses' || view === 'completed') {
      // Get employee's enrollments
      let query = supabase
        .from('employee_course_enrollments')
        .select(`
          *,
          course:training_courses(
            id,
            course_code,
            course_name,
            course_description,
            course_type,
            provider,
            duration_hours,
            difficulty_level,
            credits
          )
        `)
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })

      if (view === 'completed') {
        query = query.eq('enrollment_status', 'COMPLETED')
      } else {
        query = query.in('enrollment_status', ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'])
      }

      const { data: enrollments, error: enrollError } = await query

      if (enrollError) {
        apiLogger.error('Enrollments fetch error', enrollError)
        return NextResponse.json({ success: false, error: 'Failed to fetch enrollments' }, { status: 500 })
      }

      // Get learning summary
      const { data: summary } = await supabase
        .rpc('fn_get_employee_learning_summary', {
          p_employee_id: employee.id
        })

      return NextResponse.json({
        success: true,
        data: {
          enrollments,
          summary: summary && summary.length > 0 ? summary[0] : null
        }
      })
    } else {
      // Get available courses
      const { data: courses, error: coursesError } = await supabase
        .from('training_courses')
        .select('*')
        .eq('is_active', true)
        .or(`applicable_roles.cs.{${employee.sub_role}},applicable_roles.is.null`)
        .order('course_name')

      if (coursesError) {
        apiLogger.error('Courses fetch error', coursesError)
        return NextResponse.json({ success: false, error: 'Failed to fetch courses' }, { status: 500 })
      }

      // Get employee's current enrollments to mark which courses are already enrolled
      const { data: enrollments } = await supabase
        .from('employee_course_enrollments')
        .select('course_id, enrollment_status')
        .eq('employee_id', employee.id)

      const enrollmentMap = new Map(
        enrollments?.map(e => [e.course_id, e.enrollment_status]) || []
      )

      const coursesWithStatus = courses.map(course => ({
        ...course,
        is_enrolled: enrollmentMap.has(course.id),
        enrollment_status: enrollmentMap.get(course.id) || null
      }))

      return NextResponse.json({
        success: true,
        data: {
          courses: coursesWithStatus,
          total: courses.length
        }
      })
    }
  } catch (error) {
    apiLogger.error('Courses GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Enroll in course
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { course_id, target_completion_date } = body

    if (!course_id) {
      return NextResponse.json({ success: false, error: 'course_id is required' }, { status: 400 })
    }

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('employee_course_enrollments')
      .select('id, enrollment_status')
      .eq('employee_id', employee.id)
      .eq('course_id', course_id)
      .maybeSingle()

    if (existing && existing.enrollment_status !== 'DROPPED') {
      return NextResponse.json({ success: false, error: 'Already enrolled in this course'
      }, { status: 400 })
    }

    // Create enrollment
    const { data: enrollment, error: insertError } = await supabase
      .from('employee_course_enrollments')
      .insert({
        employee_id: employee.id,
        course_id,
        enrollment_type: 'SELF_ENROLLED',
        target_completion_date: target_completion_date || null,
        enrollment_status: 'ENROLLED',
        progress_percentage: 0
      })
      .select(`
        *,
        course:training_courses(
          course_code,
          course_name,
          duration_hours,
          credits
        )
      `)
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Enrollment insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to enroll in course' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: enrollment,
      message: 'Successfully enrolled in course'
    })
  } catch (error) {
    apiLogger.error('Courses POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update progress
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await getEmployeeId(supabase, user.id)
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { enrollment_id, action, ...actionData } = body

    if (!enrollment_id || !action) {
      return NextResponse.json({ success: false, error: 'enrollment_id and action required' }, { status: 400 })
    }

    if (action === 'UPDATE_PROGRESS') {
      const { progress_percentage, time_spent_hours } = actionData

      const { data: updated, error: updateError } = await supabase
        .from('employee_course_enrollments')
        .update({
          progress_percentage,
          time_spent_hours: time_spent_hours || 0
        })
        .eq('id', enrollment_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      // Log progress
      await supabase.from('course_progress_logs').insert({
        enrollment_id,
        progress_percentage,
        time_spent_minutes: (time_spent_hours || 0) * 60,
        activity_type: 'PROGRESS_UPDATE'
      })

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Progress updated'
      })
    } else if (action === 'COMPLETE_COURSE') {
      const { quiz_score, certificate_url, feedback_rating, feedback_comments } = actionData

      const passed = quiz_score >= 70 // Passing percentage from course

      const { data: updated, error: updateError } = await supabase
        .from('employee_course_enrollments')
        .update({
          progress_percentage: 100,
          quiz_score,
          passed,
          certificate_url: passed ? certificate_url : null,
          certificate_issued_date: passed ? new Date().toISOString().split('T')[0] : null,
          feedback_rating,
          feedback_comments,
          enrollment_status: passed ? 'COMPLETED' : 'FAILED'
        })
        .eq('id', enrollment_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: passed ? 'Course completed successfully!' : 'Course failed. You can retry.'
      })
    } else if (action === 'DROP_COURSE') {
      const { data: updated, error: updateError } = await supabase
        .from('employee_course_enrollments')
        .update({
          enrollment_status: 'DROPPED'
        })
        .eq('id', enrollment_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Course dropped'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Courses PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
