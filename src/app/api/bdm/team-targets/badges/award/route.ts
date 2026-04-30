
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { bdeUserId, badgeId, earnedForDate } = await request.json()
    if (!bdeUserId || !badgeId) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })

    const { data, error } = await supabase
      .from('bde_earned_badges')
      .insert({
        bde_user_id: bdeUserId,
        badge_id: badgeId,
        earned_for_date: earnedForDate || new Date().toISOString().split('T')[0],
        auto_awarded: false,
        awarded_by: user.id,
      })
      .select('*, badge:achievement_badges!badge_id (*)')
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data, message: 'Badge awarded successfully' })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
