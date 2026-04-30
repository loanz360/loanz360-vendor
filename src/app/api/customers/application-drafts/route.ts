/**
 * Customer Application Drafts API
 * Save & resume loan application drafts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


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
    const id = searchParams.get('id')

    if (id) {
      const { data, error } = await supabase
        .from('customer_application_drafts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
      return NextResponse.json({ success: true, data })
    }

    const { data, error } = await supabase
      .from('customer_application_drafts')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('last_saved_at', { ascending: false })

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
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
    const { loan_type, form_data, current_step, total_steps } = body

    if (!loan_type) {
      return NextResponse.json({ success: false, error: 'loan_type is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('customer_application_drafts')
      .insert({
        user_id: user.id,
        loan_type,
        form_data: form_data || {},
        current_step: current_step || 1,
        total_steps: total_steps || 5,
        last_saved_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
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
    const { id, form_data, current_step } = body

    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })

    const updates: Record<string, unknown> = { last_saved_at: new Date().toISOString() }
    if (form_data !== undefined) updates.form_data = form_data
    if (current_step !== undefined) updates.current_step = current_step

    const { data, error } = await supabase
      .from('customer_application_drafts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
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

    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })

    const { error } = await supabase
      .from('customer_application_drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
