import { parseBody } from '@/lib/utils/parse-body'

/**
 * CRO Skills API
 * Manage CRO capabilities and availability
 * Admin access only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// GET: List all CRO skills with user information
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      const adminId = payload.sub as string

      if (!adminId) {
        throw new Error('Invalid token payload')
      }

      // Verify admin role
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminId)
        .maybeSingle()

      if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized access' },
          { status: 403 }
        )
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Fetch all CRO skills joined with user information
    const { data: skills, error } = await supabase
      .from('cro_skills')
      .select(`
        *,
        users!inner (
          id,
          name,
          email,
          role
        )
      `)
      .eq('users.role', 'CRO')
      .order('cro_id')

    if (error) {
      apiLogger.error('Error fetching CRO skills', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch CRO skills' },
        { status: 500 }
      )
    }

    // Transform data to include user info at root level
    const transformedSkills = (skills || []).map((skill: any) => ({
      cro_id: skill.cro_id,
      cro_name: skill.users.name,
      cro_email: skill.users.email,
      loan_types: skill.loan_types,
      languages: skill.languages,
      min_loan_amount: skill.min_loan_amount,
      max_loan_amount: skill.max_loan_amount,
      max_leads_per_day: skill.max_leads_per_day,
      max_pending_leads: skill.max_pending_leads,
      current_pending_leads: skill.current_pending_leads,
      geography_coverage: skill.geography_coverage || [],
      is_available: skill.is_available,
      created_at: skill.created_at,
      updated_at: skill.updated_at
    }))

    return NextResponse.json({
      success: true,
      skills: transformedSkills
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/cro-skills', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Initialize CRO skills for a new CRO
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    let adminId: string

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      adminId = payload.sub as string

      if (!adminId) {
        throw new Error('Invalid token payload')
      }

      // Verify admin role
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminId)
        .maybeSingle()

      if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized access' },
          { status: 403 }
        )
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      cro_id,
      loan_types,
      languages,
      min_loan_amount,
      max_loan_amount,
      max_leads_per_day,
      max_pending_leads,
      geography_coverage,
      is_available
    } = body

    // Validate required fields
    if (!cro_id || !loan_types || !languages) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify CRO exists and has CRO role
    const { data: cro, error: croError } = await supabase
      .from('users')
      .select('role')
      .eq('id', cro_id)
      .maybeSingle()

    if (croError || !cro || cro.role !== 'CRO') {
      return NextResponse.json(
        { success: false, error: 'Invalid CRO user' },
        { status: 400 }
      )
    }

    // Insert new CRO skills
    const { data: newSkills, error } = await supabase
      .from('cro_skills')
      .insert([{
        cro_id,
        loan_types,
        languages,
        min_loan_amount: min_loan_amount || null,
        max_loan_amount: max_loan_amount || null,
        max_leads_per_day: max_leads_per_day || 20,
        max_pending_leads: max_pending_leads || 50,
        current_pending_leads: 0,
        geography_coverage: geography_coverage || [],
        is_available: is_available !== undefined ? is_available : true
      }])
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating CRO skills', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create CRO skills' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      skills: newSkills
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in POST /api/admin/cro-skills', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
