
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const bdeUserId = request.nextUrl.searchParams.get('bdeUserId') || user.id
    const { data, error } = await supabase
      .from('bde_earned_badges')
      .select('*, badge:achievement_badges!badge_id (*)')
      .eq('bde_user_id', bdeUserId)
      .order('earned_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, data: { earned: data || [] } })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
