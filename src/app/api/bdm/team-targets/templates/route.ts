import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const frequency = request.nextUrl.searchParams.get('frequency')
    const isActive = request.nextUrl.searchParams.get('isActive') !== 'false'

    let query = supabase.from('target_templates').select('*').order('name')
    if (frequency) query = query.eq('frequency', frequency)
    if (isActive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: { templates: data || [] } })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const bodySchema = z.object({


      name: z.string().optional(),


      description: z.string().optional(),


      frequency: z.string().optional(),


      leadsTarget: z.string().optional(),


      conversionsTarget: z.string().optional(),


      revenueTarget: z.string().optional(),


      callsTarget: z.string().optional(),


      meetingsTarget: z.string().optional(),


      isDefault: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { name, description, frequency, leadsTarget, conversionsTarget, revenueTarget, callsTarget, meetingsTarget, isDefault } = body

    if (!name || !frequency) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })

    const { data, error } = await supabase
      .from('target_templates')
      .insert({
        name, description, frequency,
        leads_target: leadsTarget || 0,
        conversions_target: conversionsTarget || 0,
        revenue_target: revenueTarget || 0,
        calls_target: callsTarget || 0,
        meetings_target: meetingsTarget || 0,
        is_default: isDefault || false,
        created_by: user.id,
      })
      .select().maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data, message: 'Template created' })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
