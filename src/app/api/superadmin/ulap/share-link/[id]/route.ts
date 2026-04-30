
import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { error } = await supabase.from('ulap_share_links').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Link deactivated' })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to deactivate link' }, { status: 500 })
  }
}
