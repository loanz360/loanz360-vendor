import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is Super Admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { contactIds, croId } = await request.json()

    if (!Array.isArray(contactIds) || contactIds.length === 0 || !croId) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: contactIds and croId are required' },
        { status: 400 }
      )
    }

    // Assign contacts to CRO
    const { error: updateError } = await supabase
      .from('crm_contacts')
      .update({
        assigned_to_cro: croId,
        assigned_at: new Date().toISOString(),
      })
      .in('id', contactIds)

    if (updateError) {
      apiLogger.error('Error assigning contacts', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to assign contacts' },
        { status: 500 }
      )
    }

    // Update data_points assigned/unassigned counts
    // Get data_point_id from first contact
    const { data: firstContact } = await supabase
      .from('crm_contacts')
      .select('data_point_id')
      .eq('id', contactIds[0])
      .maybeSingle()

    if (firstContact) {
      // Recalculate counts
      const { count: assignedCount } = await supabase
        .from('crm_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('data_point_id', firstContact.data_point_id)
        .not('assigned_to_cro', 'is', null)

      const { count: unassignedCount } = await supabase
        .from('crm_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('data_point_id', firstContact.data_point_id)
        .is('assigned_to_cro', null)

      await supabase
        .from('data_points')
        .update({
          assigned_records: assignedCount || 0,
          unassigned_records: unassignedCount || 0,
        })
        .eq('id', firstContact.data_point_id)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${contactIds.length} contacts`,
    })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
