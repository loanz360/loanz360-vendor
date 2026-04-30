import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// CAREER PLANNING API
// GET: Get career plan and paths
// POST: Create career plan
// PATCH: Update career plan progress
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

async function getEmployeeId(supabase: any, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id, sub_role, full_name')
    .eq('user_id', userId)
    .maybeSingle()

  return employee
}

// GET: Get career plan
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
    const view = searchParams.get('view') || 'my-plan' // my-plan, paths, internal-jobs

    if (view === 'paths') {
      // Get available career paths for current role
      const { data: paths, error: pathsError } = await supabase
        .from('career_paths')
        .select('*')
        .eq('is_active', true)
        .eq('start_role', employee.sub_role)

      if (pathsError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch career paths' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: {
          paths,
          current_role: employee.sub_role
        }
      })
    } else if (view === 'internal-jobs') {
      // Get internal job postings
      const { data: jobs, error: jobsError } = await supabase
        .from('internal_job_postings')
        .select(`
          *,
          hiring_manager:employees!internal_job_postings_hiring_manager_id_fkey(
            full_name,
            work_email
          )
        `)
        .eq('status', 'OPEN')
        .order('posting_date', { ascending: false })

      if (jobsError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch job postings' }, { status: 500 })
      }

      // Calculate skill match for each job
      const jobsWithMatch = await Promise.all(
        jobs.map(async (job: any) => {
          if (job.required_skills && job.required_skills.length > 0) {
            const { data: matchData } = await supabase
              .rpc('fn_calculate_skill_match', {
                p_employee_id: employee.id,
                p_required_skills: job.required_skills
              })

            return {
              ...job,
              skill_match_percentage: matchData || 0
            }
          }
          return { ...job, skill_match_percentage: 0 }
        })
      )

      // Get employee's applications
      const { data: applications } = await supabase
        .from('internal_job_applications')
        .select('job_posting_id, application_status')
        .eq('employee_id', employee.id)

      const applicationMap = new Map(
        applications?.map(a => [a.job_posting_id, a.application_status]) || []
      )

      const jobsWithStatus = jobsWithMatch.map(job => ({
        ...job,
        has_applied: applicationMap.has(job.id),
        application_status: applicationMap.get(job.id) || null
      }))

      return NextResponse.json({
        success: true,
        data: {
          jobs: jobsWithStatus,
          total: jobsWithStatus.length
        }
      })
    } else {
      // Get employee's career plan
      const { data: plan, error: planError } = await supabase
        .from('employee_career_plans')
        .select(`
          *,
          career_path:career_paths(
            path_name,
            path_description,
            path_steps
          ),
          mentor:employees!employee_career_plans_mentor_id_fkey(
            full_name,
            work_email,
            sub_role
          )
        `)
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planError && planError.code !== 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Failed to fetch career plan' }, { status: 500 })
      }

      // Get skill gap if exists
      const { data: skillGap } = await supabase
        .from('skill_gap_analysis')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        data: {
          career_plan: plan || null,
          skill_gap: skillGap || null,
          employee_current_role: employee.sub_role
        }
      })
    }
  } catch (error) {
    apiLogger.error('Career Plan GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create career plan
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
    const { action } = body

    if (action === 'CREATE_PLAN') {
      const {
        target_role,
        career_path_id,
        target_timeline_months,
        development_areas,
        strengths
      } = body

      if (!target_role) {
        return NextResponse.json({ success: false, error: 'target_role is required' }, { status: 400 })
      }

      // Get path details if provided
      let totalSteps = 0
      if (career_path_id) {
        const { data: path } = await supabase
          .from('career_paths')
          .select('path_steps')
          .eq('id', career_path_id)
          .maybeSingle()

        totalSteps = path?.path_steps?.length || 0
      }

      const { data: plan, error: insertError } = await supabase
        .from('employee_career_plans')
        .insert({
          employee_id: employee.id,
          employee_current_role: employee.sub_role,
          employee_target_role: target_role,
          career_path_id: career_path_id || null,
          target_timeline_months: target_timeline_months || 24,
          total_steps: totalSteps,
          current_step: 1,
          development_areas: development_areas || [],
          strengths: strengths || [],
          status: 'ACTIVE',
          progress_percentage: 0
        })
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Plan insert error', insertError)
        return NextResponse.json({ success: false, error: 'Failed to create career plan' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: plan,
        message: 'Career plan created successfully'
      })
    } else if (action === 'APPLY_JOB') {
      const { job_posting_id, cover_letter } = body

      if (!job_posting_id) {
        return NextResponse.json({ success: false, error: 'job_posting_id is required' }, { status: 400 })
      }

      // Check if already applied
      const { data: existing } = await supabase
        .from('internal_job_applications')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('job_posting_id', job_posting_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ success: false, error: 'Already applied to this job' }, { status: 400 })
      }

      // Get job details
      const { data: job } = await supabase
        .from('internal_job_postings')
        .select('required_skills')
        .eq('id', job_posting_id)
        .maybeSingle()

      // Calculate skill match
      let skillMatchPercentage = 0
      if (job?.required_skills && job.required_skills.length > 0) {
        const { data: matchData } = await supabase
          .rpc('fn_calculate_skill_match', {
            p_employee_id: employee.id,
            p_required_skills: job.required_skills
          })
        skillMatchPercentage = matchData || 0
      }

      // Create application
      const { data: application, error: insertError } = await supabase
        .from('internal_job_applications')
        .insert({
          job_posting_id,
          employee_id: employee.id,
          cover_letter: cover_letter || null,
          application_status: 'APPLIED',
          skill_match_percentage: skillMatchPercentage
        })
        .select()
        .maybeSingle()

      if (insertError) {
        apiLogger.error('Application insert error', insertError)
        return NextResponse.json({ success: false, error: 'Failed to submit application' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: application,
        message: 'Application submitted successfully'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Career Plan POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update career plan
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

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { plan_id, action, ...updateData } = body

    if (!plan_id || !action) {
      return NextResponse.json({ success: false, error: 'plan_id and action required' }, { status: 400 })
    }

    if (action === 'UPDATE_PROGRESS') {
      const { current_step, progress_percentage, milestones } = updateData

      const { data: updated, error: updateError } = await supabase
        .from('employee_career_plans')
        .update({
          current_step: current_step || undefined,
          progress_percentage: progress_percentage || undefined,
          milestones: milestones || undefined,
          last_review_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', plan_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Career plan updated'
      })
    } else if (action === 'COMPLETE_PLAN') {
      const { data: updated, error: updateError } = await supabase
        .from('employee_career_plans')
        .update({
          status: 'COMPLETED',
          progress_percentage: 100
        })
        .eq('id', plan_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Congratulations! Career plan completed.'
      })
    } else if (action === 'WITHDRAW_APPLICATION') {
      const { application_id } = updateData

      const { data: updated, error: updateError } = await supabase
        .from('internal_job_applications')
        .update({
          application_status: 'WITHDRAWN'
        })
        .eq('id', application_id)
        .eq('employee_id', employee.id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Application withdrawn'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Career Plan PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
