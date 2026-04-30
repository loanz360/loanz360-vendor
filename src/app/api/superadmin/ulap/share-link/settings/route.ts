
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { data } = await supabase.from('ulap_share_link_settings').select('*').maybeSingle()
    return NextResponse.json({ success: true, data: data || { default_expiry_days: 30, require_auth: false, track_analytics: true } })
  } catch {
    return NextResponse.json({ success: true, data: { default_expiry_days: 30, require_auth: false, track_analytics: true } })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { data, error } = await supabase.from('ulap_share_link_settings').upsert({ ...body, updated_by: user.id, updated_at: new Date().toISOString() }).select().maybeSingle()
    if (error) return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 })
  }
}
