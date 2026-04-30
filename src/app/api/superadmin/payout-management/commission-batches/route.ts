import { parseBody } from '@/lib/utils/parse-body'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('commission_batches')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ batches: data || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { data, error } = await supabase
      .from('commission_batches')
      .insert([{ ...body, status: 'pending', created_at: new Date().toISOString() }])
      .select().single()
    if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ batch: data })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
