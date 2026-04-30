
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const adminId = searchParams.get('adminId') || null
    const actionType = searchParams.get('actionType') || null
    const severity = searchParams.get('severity') || null

    const { data, error } = await supabase.rpc('get_activity_feed', {
      p_limit: limit,
      p_offset: offset,
      p_admin_id: adminId,
      p_action_type: actionType,
      p_severity: severity,
    })

    if (error) throw error

    return NextResponse.json({ success: true, activities: data || [] })
  } catch (error) {
    return handleApiError(error, 'fetch activity feed')
  }
}
