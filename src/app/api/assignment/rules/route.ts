import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_ASSIGNMENT_RULES } from '@/lib/tickets/assignment-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/assignment/rules
 * Get assignment rules
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const active = searchParams.get('active')

    let query = supabase.from('assignment_rules').select('*').order('order', { ascending: true })

    if (source) {
      query = query.or(`ticket_source.eq.${source},ticket_source.is.null`)
    }
    if (active === 'true') {
      query = query.eq('is_active', true)
    }

    const { data: rules, error } = await query

    if (error) {
      apiLogger.error('Error fetching rules', error)
      return NextResponse.json({ rules: [] })
    }

    return NextResponse.json({ rules: rules || [] })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/assignment/rules
 * Create a new assignment rule
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { data: rule, error } = await supabase
      .from('assignment_rules')
      .insert(body)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating rule', error)
      return NextResponse.json({ success: false, error: 'Failed to create rule' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/assignment/rules
 * Initialize default assignment rules
 */
export async function PUT() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if rules exist
    const { data: existingRules } = await supabase
      .from('assignment_rules')
      .select('id')
      .limit(1)

    if (existingRules && existingRules.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Rules already exist. Delete existing rules first to reinitialize.'
      })
    }

    // Insert default rules
    for (const rule of DEFAULT_ASSIGNMENT_RULES) {
      await supabase.from('assignment_rules').insert(rule)
    }

    return NextResponse.json({
      success: true,
      message: 'Default assignment rules initialized'
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/assignment/rules
 * Update an assignment rule
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema2 = z.object({


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing rule id' }, { status: 400 })
    }

    const { data: rule, error } = await supabase
      .from('assignment_rules')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating rule', error)
      return NextResponse.json({ success: false, error: 'Failed to update rule' }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/assignment/rules
 * Delete an assignment rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing rule id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('assignment_rules')
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting rule', error)
      return NextResponse.json({ success: false, error: 'Failed to delete rule' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
