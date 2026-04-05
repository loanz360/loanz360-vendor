export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase.from('ulap_share_links').select('id, is_active, click_count, conversion_count')

    return NextResponse.json({
      success: true,
      data: {
        total_links: data?.length || 0,
        active_links: data?.filter((l: Record<string, unknown>) => l.is_active).length || 0,
        total_clicks: data?.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.click_count) || 0), 0) || 0,
        total_conversions: data?.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.conversion_count) || 0), 0) || 0,
      },
    })
  } catch {
    return NextResponse.json({ success: true, data: { total_links: 0, active_links: 0, total_clicks: 0, total_conversions: 0 } })
  }
}
