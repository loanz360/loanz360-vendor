
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Helper to check Super Admin session from cookie
 */
async function checkSuperAdminSession(request: NextRequest): Promise<{ isValid: boolean; adminId?: string }> {
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (!superAdminSession) {
    return { isValid: false }
  }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: session, error } = await supabaseAdmin
    .from('super_admin_sessions')
    .select('super_admin_id, expires_at')
    .eq('session_id', superAdminSession)
    .maybeSingle()

  if (error || !session) {
    return { isValid: false }
  }

  if (new Date(session.expires_at) < new Date()) {
    return { isValid: false }
  }

  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, is_active, is_locked')
    .eq('id', session.super_admin_id)
    .maybeSingle()

  if (!admin || !admin.is_active || admin.is_locked) {
    return { isValid: false }
  }

  return { isValid: true, adminId: admin.id }
}

/**
 * Escape a CSV field value (handle commas, quotes, newlines)
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * GET /api/notifications/unsubscribes/export
 * Export unsubscribe list as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const superAdminCheck = await checkSuperAdminSession(request)
    let isSuperAdmin = superAdminCheck.isValid

    if (!isSuperAdmin) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const { data: userData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      isSuperAdmin = userData?.role === 'SUPER_ADMIN'
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Fetch all active unsubscribes
    const { data: unsubscribes, error } = await supabaseAdmin
      .from('notification_unsubscribes')
      .select('*')
      .is('resubscribed_at', null)
      .order('unsubscribed_at', { ascending: false })

    if (error) {
      console.error('Error fetching unsubscribes for export:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch unsubscribes' },
        { status: 500 }
      )
    }

    // Build CSV
    const headers = [
      'ID',
      'User ID',
      'Email',
      'Phone',
      'Channel',
      'Topic',
      'Reason',
      'Source',
      'Unsubscribed At',
    ]

    const rows = (unsubscribes || []).map((u: typeof unsubscribes[number]) => [
      escapeCsvField(u.id),
      escapeCsvField(u.user_id),
      escapeCsvField(u.email),
      escapeCsvField(u.phone),
      escapeCsvField(u.channel),
      escapeCsvField(u.topic),
      escapeCsvField(u.reason),
      escapeCsvField(u.source),
      escapeCsvField(u.unsubscribed_at),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    const today = new Date().toISOString().split('T')[0]

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="unsubscribes_${today}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error in unsubscribes export GET:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
