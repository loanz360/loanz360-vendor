import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('commission_batches')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ batches: data || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
