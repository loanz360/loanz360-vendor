
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function POST(request: NextRequest) {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createSupabaseAdmin()
    const { action, adminIds } = await request.json()

    if (!adminIds || adminIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No admins selected' }, { status: 400 })
    }

    let result
    switch (action) {
      case 'enable':
        result = await supabase.from('admins').update({ status: 'enabled' }).in('id', adminIds)
        break
      case 'disable':
        result = await supabase.from('admins').update({ status: 'disabled' }).in('id', adminIds)
        break
      case 'delete':
        result = await supabase.from('admins').update({ is_deleted: true }).in('id', adminIds)
        break
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    if (result.error) throw result.error

    return NextResponse.json({ success: true, message: `Bulk ${action} completed`, affected: adminIds.length })
  } catch (error: unknown) {
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json({ success: false, ...response }, { status: statusCode })
  }
}
