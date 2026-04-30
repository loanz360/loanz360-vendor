import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


async function verifySuperAdmin(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id, role, sub_role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!userData) return null

  const isSuperAdmin = userData.role === 'SUPER_ADMIN'
  const isAccountsTeam = userData.role === 'EMPLOYEE' &&
    ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'].includes(userData.sub_role)

  if (!isSuperAdmin && !isAccountsTeam) return null

  return { user, userData }
}

// GET - Fetch all payout conditions
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const auth = await verifySuperAdmin(supabase)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all payout conditions ordered by condition_order
    const { data: conditions, error } = await supabase
      .from('payout_conditions')
      .select('*')
      .order('condition_order', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching payout conditions', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ conditions })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new payout condition
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const auth = await verifySuperAdmin(supabase)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { condition_text, condition_order, is_active, applies_to } = body

    // Validate input
    if (!condition_text || condition_text.trim() === '') {
      return NextResponse.json({ success: false, error: 'Condition text is required' }, { status: 400 })
    }

    // Validate applies_to is a valid array
    if (applies_to && (!Array.isArray(applies_to) || applies_to.some((t: string) => !['BA', 'BP', 'CP'].includes(t)))) {
      return NextResponse.json({ success: false, error: 'applies_to must be an array of BA, BP, CP' }, { status: 400 })
    }

    // Insert new condition
    const { data: newCondition, error } = await supabase
      .from('payout_conditions')
      .insert({
        condition_text: condition_text.trim(),
        condition_order: condition_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        applies_to: applies_to || ['BA', 'BP', 'CP'],
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating payout condition', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ condition: newCondition }, { status: 201 })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update payout condition
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const auth = await verifySuperAdmin(supabase)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, condition_text, condition_order, is_active, applies_to } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Condition ID is required' }, { status: 400 })
    }

    // Validate applies_to if provided
    if (applies_to && (!Array.isArray(applies_to) || applies_to.some((t: string) => !['BA', 'BP', 'CP'].includes(t)))) {
      return NextResponse.json({ success: false, error: 'applies_to must be an array of BA, BP, CP' }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (condition_text !== undefined) updates.condition_text = condition_text.trim()
    if (condition_order !== undefined) updates.condition_order = condition_order
    if (is_active !== undefined) updates.is_active = is_active
    if (applies_to !== undefined) updates.applies_to = applies_to

    // Update condition
    const { data: updatedCondition, error } = await supabase
      .from('payout_conditions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating payout condition', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ condition: updatedCondition })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete payout condition
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const auth = await verifySuperAdmin(supabase)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Condition ID is required' }, { status: 400 })
    }

    // Delete condition
    const { error } = await supabase.from('payout_conditions').delete().eq('id', id)

    if (error) {
      apiLogger.error('Error deleting payout condition', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
