import { parseBody } from '@/lib/utils/parse-body'

/**
 * Assignment Rule Detail API
 * Get, update, or delete individual assignment rules
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

async function verifyAdmin(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const adminId = payload.sub as string

    if (!adminId) {
      throw new Error('Invalid token payload')
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .maybeSingle()

    if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return null
    }

    return adminId
  } catch (error) {
    return null
  }
}

// GET: Get single assignment rule
export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { data: rule, error } = await supabase
      .from('lead_assignment_rules')
      .select('*')
      .eq('id', params.ruleId)
      .maybeSingle()

    if (error || !rule) {
      return NextResponse.json(
        { success: false, error: 'Assignment rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      rule
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/assignment-rules/[ruleId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update entire assignment rule
export async function PUT(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
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

    const { data: updatedRule, error } = await supabase
      .from('lead_assignment_rules')
      .update({
        name,
        description,
        strategy,
        priority: priority || 100,
        is_active: is_active !== undefined ? is_active : true,
        criteria: criteria || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', params.ruleId)
      .select()
      .maybeSingle()

    if (error || !updatedRule) {
      apiLogger.error('Error updating assignment rule', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update assignment rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rule: updatedRule
    })

  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/assignment-rules/[ruleId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Partially update assignment rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate strategy if provided
    if (body.strategy) {
      const validStrategies = ['round_robin', 'workload_based', 'skill_based', 'geography_based']
      if (!validStrategies.includes(body.strategy)) {
        return NextResponse.json(
          { success: false, error: 'Invalid strategy' },
          { status: 400 }
        )
      }
    }

    const { data: updatedRule, error } = await supabase
      .from('lead_assignment_rules')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.ruleId)
      .select()
      .maybeSingle()

    if (error || !updatedRule) {
      apiLogger.error('Error updating assignment rule', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update assignment rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      rule: updatedRule
    })

  } catch (error) {
    apiLogger.error('Error in PATCH /api/admin/assignment-rules/[ruleId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Delete assignment rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('lead_assignment_rules')
      .delete()
      .eq('id', params.ruleId)

    if (error) {
      apiLogger.error('Error deleting assignment rule', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete assignment rule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment rule deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Error in DELETE /api/admin/assignment-rules/[ruleId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
