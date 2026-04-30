/**
 * Customer Family Loans API
 * CRUD for customer_family_members + customer_family_loans
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'members') {
      const { data, error } = await supabase
        .from('customer_family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
      return NextResponse.json({ success: true, data })
    }

    if (type === 'loans') {
      const { data, error } = await supabase
        .from('customer_family_loans')
        .select('*, customer_family_members(name, relationship)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
      return NextResponse.json({ success: true, data })
    }

    // Default: return both
    const [membersResult, loansResult] = await Promise.all([
      supabase
        .from('customer_family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('customer_family_loans')
        .select('*, customer_family_members(name, relationship)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (membersResult.error) return NextResponse.json({ success: false, error: membersResult.error.message }, { status: 500 })
    if (loansResult.error) return NextResponse.json({ success: false, error: loansResult.error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      data: { members: membersResult.data, loans: loansResult.data },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, ...rest } = body

    if (type === 'member') {
      const { name, relationship, avatar_color } = rest
      if (!name || !relationship) {
        return NextResponse.json({ success: false, error: 'name and relationship are required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('customer_family_members')
        .insert({ user_id: user.id, name, relationship, avatar_color })
        .select()
        .maybeSingle()

      if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
      return NextResponse.json({ success: true, data })
    }

    if (type === 'loan') {
      const { member_id, lender, loan_type, principal, outstanding, interest_rate, emi, start_date, tenure_months, status } = rest
      if (!member_id || !lender || !loan_type || !principal || !emi || !start_date || !tenure_months) {
        return NextResponse.json({ success: false, error: 'Missing required loan fields' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('customer_family_loans')
        .insert({
          user_id: user.id,
          member_id,
          lender,
          loan_type,
          principal,
          outstanding: outstanding || principal,
          interest_rate: interest_rate || 0,
          emi,
          start_date,
          tenure_months,
          status: status || 'Active',
        })
        .select()
        .maybeSingle()

      if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json({ success: false, error: 'type must be "member" or "loan"' }, { status: 400 })
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
    const { type, id, ...updates } = body

    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })

    const table = type === 'member' ? 'customer_family_members' : 'customer_family_loans'
    const allowedFields = type === 'member'
      ? ['name', 'relationship', 'avatar_color']
      : ['lender', 'loan_type', 'principal', 'outstanding', 'interest_rate', 'emi', 'start_date', 'tenure_months', 'status']

    const allowed: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

    const { data, error } = await supabase
      .from(table)
      .update(allowed)
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
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json({ success: false, error: 'type and id are required' }, { status: 400 })
    }

    const table = type === 'member' ? 'customer_family_members' : 'customer_family_loans'

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
