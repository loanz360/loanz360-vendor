import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// SKILLS MANAGEMENT API
// GET: List employee skills and catalog
// POST: Add new skill
// PATCH: Update skill proficiency
// DELETE: Remove skill
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

// GET: List skills
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
    const view = searchParams.get('view') || 'my-skills' // my-skills, catalog, gap-analysis

    if (view === 'catalog') {
      // Get skills catalog
      const { data: skills, error: skillsError } = await supabase
        .from('skills_catalog')
        .select('*')
        .eq('is_active', true)
        .order('skill_category, skill_name')

      if (skillsError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch skills catalog' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: {
          skills,
          total: skills.length
        }
      })
    } else if (view === 'my-skills') {
      // Get employee's skills
      const { data: employeeSkills, error: skillsError } = await supabase
        .from('employee_skills')
        .select(`
          *,
          skill:skills_catalog(
            skill_code,
            skill_name,
            skill_category,
            skill_type,
            description,
            is_core_skill
          )
        `)
        .eq('employee_id', employee.id)
        .order('is_primary_skill', { ascending: false })
        .order('proficiency_level', { ascending: false })

      if (skillsError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch employee skills' }, { status: 500 })
      }

      // Get skills catalog for adding new skills
      const { data: catalog } = await supabase
        .from('skills_catalog')
        .select('id, skill_code, skill_name, skill_category')
        .eq('is_active', true)
        .order('skill_name')

      // Calculate summary
      const summary = {
        total_skills: employeeSkills.length,
        expert_level: employeeSkills.filter((s: any) => s.proficiency_level === 'EXPERT').length,
        advanced_level: employeeSkills.filter((s: any) => s.proficiency_level === 'ADVANCED').length,
        intermediate_level: employeeSkills.filter((s: any) => s.proficiency_level === 'INTERMEDIATE').length,
        beginner_level: employeeSkills.filter((s: any) => s.proficiency_level === 'BEGINNER').length,
        core_skills: employeeSkills.filter((s: any) => s.skill?.is_core_skill).length,
        certified_skills: employeeSkills.filter((s: any) => s.certification_name).length
      }

      return NextResponse.json({
        success: true,
        data: {
          skills: employeeSkills,
          catalog,
          summary
        }
      })
    } else if (view === 'gap-analysis') {
      // Get skill gap analysis
      const { data: gapAnalysis, error: gapError } = await supabase
        .from('skill_gap_analysis')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (gapError && gapError.code !== 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Failed to fetch gap analysis' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: {
          gap_analysis: gapAnalysis || null
        }
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid view parameter' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Skills GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Add new skill
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
    const {
      skill_id,
      proficiency_level,
      years_of_experience,
      self_rating,
      certification_name,
      certification_date,
      is_primary_skill
    } = body

    if (!skill_id || !proficiency_level) {
      return NextResponse.json({ success: false, error: 'skill_id and proficiency_level are required'
      }, { status: 400 })
    }

    // Check if skill already exists
    const { data: existing } = await supabase
      .from('employee_skills')
      .select('id')
      .eq('employee_id', employee.id)
      .eq('skill_id', skill_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'Skill already added. Use PATCH to update.'
      }, { status: 400 })
    }

    // Add skill
    const { data: skill, error: insertError } = await supabase
      .from('employee_skills')
      .insert({
        employee_id: employee.id,
        skill_id,
        proficiency_level,
        years_of_experience: years_of_experience || null,
        self_rating: self_rating || null,
        certification_name: certification_name || null,
        certification_date: certification_date || null,
        is_primary_skill: is_primary_skill || false,
        skill_source: 'SELF_DECLARED',
        last_used_date: new Date().toISOString().split('T')[0]
      })
      .select(`
        *,
        skill:skills_catalog(
          skill_name,
          skill_category
        )
      `)
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Skill insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to add skill' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: skill,
      message: 'Skill added successfully'
    })
  } catch (error) {
    apiLogger.error('Skills POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update skill
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

    const isHR = ['HR_EXECUTIVE', 'HR_MANAGER'].includes(employee.sub_role)

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { skill_id, action, ...updateData } = body

    if (!skill_id) {
      return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 })
    }

    if (action === 'UPDATE_PROFICIENCY') {
      const { proficiency_level, years_of_experience, self_rating } = updateData

      const { data: updated, error: updateError } = await supabase
        .from('employee_skills')
        .update({
          proficiency_level: proficiency_level || undefined,
          years_of_experience: years_of_experience || undefined,
          self_rating: self_rating || undefined,
          last_used_date: new Date().toISOString().split('T')[0]
        })
        .eq('employee_id', employee.id)
        .eq('skill_id', skill_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Skill proficiency updated'
      })
    } else if (action === 'ADD_CERTIFICATION') {
      const { certification_name, certification_date, certification_expiry } = updateData

      const { data: updated, error: updateError } = await supabase
        .from('employee_skills')
        .update({
          certification_name,
          certification_date,
          certification_expiry: certification_expiry || null
        })
        .eq('employee_id', employee.id)
        .eq('skill_id', skill_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Certification added'
      })
    } else if (action === 'MANAGER_VERIFY' && isHR) {
      const { manager_rating, verified_rating } = updateData

      const { data: updated, error: updateError } = await supabase
        .from('employee_skills')
        .update({
          manager_rating: manager_rating || undefined,
          verified_rating: verified_rating || undefined,
          skill_source: 'HR_VERIFIED'
        })
        .eq('skill_id', skill_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Skill verified by manager'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Skills PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove skill
export async function DELETE(request: NextRequest) {
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
    const skillId = searchParams.get('skill_id')

    if (!skillId) {
      return NextResponse.json({ success: false, error: 'skill_id is required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('employee_skills')
      .delete()
      .eq('employee_id', employee.id)
      .eq('skill_id', skillId)

    if (deleteError) {
      return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Skill removed'
    })
  } catch (error) {
    apiLogger.error('Skills DELETE Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
