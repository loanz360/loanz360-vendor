
/**
 * Assignment Rules API
 * Manage auto-assignment rules for lead distribution
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

// GET: List all assignment rules
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

    // Fetch all assignment rules
    const { data: rules, error } = await supabase
      .from('lead_assignment_rules')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching assignment rules', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch assignment rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rules: rules || []
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/assignment-rules', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Create new assignment rule
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
    const body = await request.json()
    const { name, description, strategy, priority, is_active, criteria } = body

    // Validate required fields
    if (!name || !description || !strategy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate strategy
    const validStrategies = ['round_robin', 'workload_based', 'skill_based', 'geography_based']
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid strategy' },
        { status: 400 }
      )
    }

    // Insert new rule
    const { data: newRule, error } = await supabase
      .from('lead_assignment_rules')
      .insert([{
        name,
        description,
        strategy,
        priority: priority || 100,
        is_active: is_active !== undefined ? is_active : true,
        criteria: criteria || {},
        created_by: adminId
      }])
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating assignment rule', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create assignment rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rule: newRule
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in POST /api/admin/assignment-rules', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
