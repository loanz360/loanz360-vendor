import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { data, error } = await supabase
      .from('target_templates')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select().maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data, message: 'Template updated' })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('target_templates').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true, message: 'Template deleted' })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
