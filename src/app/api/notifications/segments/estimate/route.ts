import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface Condition {
  id: string
  field: string
  operator: string
  value: string | number | string[]
  valueEnd?: string | number
}

interface ConditionGroup {
  id: string
  operator: 'AND' | 'OR'
  conditions: Condition[]
}

/**
 * POST /api/notifications/segments/estimate
 * Estimate the number of recipients matching a segment's conditions
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Also check for Super Admin session
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    let isSuperAdmin = false

    if (superAdminSession) {
      const supabaseAdmin = createSupabaseAdmin()
      const { data: session } = await supabaseAdmin
        .from('super_admin_sessions')
        .select('super_admin_id, expires_at')
        .eq('session_id', superAdminSession)
        .maybeSingle()

      if (session && new Date(session.expires_at) > new Date()) {
        isSuperAdmin = true
      }
    }

    if (!user && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { groups, groupOperator } = body as {
      groups: ConditionGroup[]
      groupOperator: 'AND' | 'OR'
    }

    if (!groups || groups.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    const supabaseAdmin = createSupabaseAdmin()

    // For now, provide an estimated count based on simplified logic
    // In production, this would build dynamic SQL queries based on conditions
    let totalCount = 0

    // Get base counts for each category
    const [
      { count: employeeCount },
      { count: partnerCount },
      { count: customerCount }
    ] = await Promise.all([
      supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('partners').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('customers').select('*', { count: 'exact', head: true })
    ])

    // Analyze conditions to estimate count
    const hasRoleCondition = groups.some(g =>
      g.conditions.some(c => c.field === 'user.role')
    )

    const hasStatusCondition = groups.some(g =>
      g.conditions.some(c => c.field === 'user.status')
    )

    const hasActivityCondition = groups.some(g =>
      g.conditions.some(c => c.field.startsWith('activity.'))
    )

    const hasBusinessCondition = groups.some(g =>
      g.conditions.some(c => c.field.startsWith('business.'))
    )

    // Base estimation logic
    let baseCount = (employeeCount || 0) + (partnerCount || 0) + (customerCount || 0)

    // Apply multipliers based on conditions (simplified estimation)
    let multiplier = 1.0

    // Role filter typically reduces by category
    if (hasRoleCondition) {
      const roleCondition = groups
        .flatMap(g => g.conditions)
        .find(c => c.field === 'user.role')

      if (roleCondition) {
        if (roleCondition.value === 'employee') {
          baseCount = employeeCount || 0
        } else if (roleCondition.value === 'partner') {
          baseCount = partnerCount || 0
        } else if (roleCondition.value === 'customer') {
          baseCount = customerCount || 0
        }
      }
    }

    // Status filters typically reduce by ~30-40%
    if (hasStatusCondition) {
      multiplier *= 0.65
    }

    // Activity conditions typically reduce by ~40-60%
    if (hasActivityCondition) {
      multiplier *= 0.5
    }

    // Business conditions typically reduce by ~50-70%
    if (hasBusinessCondition) {
      multiplier *= 0.4
    }

    // Multiple groups with AND reduce more than OR
    if (groups.length > 1) {
      if (groupOperator === 'AND') {
        multiplier *= 0.6
      } else {
        multiplier *= 1.2 // OR can increase reach
      }
    }

    // Each additional condition reduces further
    const totalConditions = groups.reduce((sum, g) => sum + g.conditions.length, 0)
    if (totalConditions > 2) {
      multiplier *= Math.pow(0.85, totalConditions - 2)
    }

    // Calculate final estimate
    totalCount = Math.max(1, Math.round(baseCount * multiplier))

    return NextResponse.json({
      count: totalCount,
      breakdown: {
        base: baseCount,
        multiplier: multiplier.toFixed(2),
        employees: employeeCount || 0,
        partners: partnerCount || 0,
        customers: customerCount || 0
      }
    })
  } catch (error) {
    apiLogger.error('Error estimating segment', error)
    return NextResponse.json(
      { error: 'Failed to estimate segment', count: 0 },
      { status: 500 }
    )
  }
}
