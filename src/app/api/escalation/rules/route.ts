import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_ESCALATION_RULES, DEFAULT_ESCALATION_PATHS } from '@/lib/tickets/escalation-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/escalation/rules
 * Get escalation rules and paths
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'rules' // 'rules' or 'paths'
    const source = searchParams.get('source')
    const active = searchParams.get('active')

    if (type === 'paths') {
      let query = supabase.from('escalation_paths').select('*')

      if (source) {
        query = query.eq('ticket_source', source)
      }
      if (active === 'true') {
        query = query.eq('is_active', true)
      }

      const { data: paths, error } = await query.order('created_at', { ascending: false })

      if (error) {
        apiLogger.error('Error fetching paths', error)
        return NextResponse.json({ paths: [] })
      }

      return NextResponse.json({ paths: paths || [] })
    }

    // Default: fetch rules
    let query = supabase.from('escalation_rules').select('*')

    if (source) {
      query = query.or(`ticket_source.eq.${source},ticket_source.is.null`)
    }
    if (active === 'true') {
      query = query.eq('is_active', true)
    }

    const { data: rules, error } = await query.order('created_at', { ascending: false })

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
 * POST /api/escalation/rules
 * Create a new escalation rule or path
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { type, ...data } = body

    if (type === 'path') {
      const { data: path, error } = await supabase
        .from('escalation_paths')
        .insert(data)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error creating path', error)
        return NextResponse.json({ success: false, error: 'Failed to create path' }, { status: 500 })
      }

      return NextResponse.json({ path })
    }

    // Default: create rule
    const { data: rule, error } = await supabase
      .from('escalation_rules')
      .insert(data)
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
 * PUT /api/escalation/rules
 * Initialize default escalation rules and paths
 */
export async function PUT() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize default paths
    const { data: existingPaths } = await supabase
      .from('escalation_paths')
      .select('id')
      .limit(1)

    if (!existingPaths || existingPaths.length === 0) {
      for (const path of DEFAULT_ESCALATION_PATHS) {
        await supabase.from('escalation_paths').insert(path)
      }
    }

    // Initialize default rules
    const { data: existingRules } = await supabase
      .from('escalation_rules')
      .select('id')
      .limit(1)

    if (!existingRules || existingRules.length === 0) {
      for (const rule of DEFAULT_ESCALATION_RULES) {
        await supabase.from('escalation_rules').insert(rule)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Default escalation rules and paths initialized'
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/escalation/rules
 * Update an escalation rule or path
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { id, type, ...updateData } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
    }

    const tableName = type === 'path' ? 'escalation_paths' : 'escalation_rules'

    const { data, error } = await supabase
      .from(tableName)
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating', error)
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json(type === 'path' ? { path: data } : { rule: data })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/escalation/rules
 * Delete an escalation rule or path
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
    const type = searchParams.get('type') || 'rule'

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
    }

    const tableName = type === 'path' ? 'escalation_paths' : 'escalation_rules'

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)

    if (error) {
      apiLogger.error('Error deleting', error)
      return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
