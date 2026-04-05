/**
 * Customer Credit Disputes API
 * CRUD operations for customer_credit_disputes table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const bureau = searchParams.get('bureau')

    let query = supabase
      .from('customer_credit_disputes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (bureau) query = query.eq('bureau', bureau)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bureau, dispute_type, description, account_details, supporting_docs } = body

    if (!bureau || !dispute_type || !description) {
      return NextResponse.json({ success: false, error: 'bureau, dispute_type, and description are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('customer_credit_disputes')
      .insert({
        user_id: user.id,
        bureau,
        dispute_type,
        description,
        account_details: account_details || {},
        supporting_docs: supporting_docs || [],
      })
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Only allow updating certain fields
    const allowed: Record<string, unknown> = {}
    for (const key of ['status', 'description', 'resolution_notes', 'account_details', 'supporting_docs']) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }
    if (updates.status === 'Resolved') allowed.resolved_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('customer_credit_disputes')
      .update(allowed)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

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
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    // Only allow deleting if status is Filed
    const { data: existing } = await supabase
      .from('customer_credit_disputes')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing && existing.status !== 'Filed') {
      return NextResponse.json({ success: false, error: 'Can only delete disputes with Filed status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('customer_credit_disputes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
