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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { dataPointId } = await request.json()

    if (!dataPointId) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: dataPointId is required' },
        { status: 400 }
      )
    }

    // Get all unassigned contacts for this data point
    const { data: unassignedContacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select('id, loan_type, location')
      .eq('data_point_id', dataPointId)
      .is('assigned_to_cro', null)

    if (contactsError) {
      apiLogger.error('Error fetching contacts', contactsError)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!unassignedContacts || unassignedContacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unassigned contacts to distribute',
        assigned: 0,
      })
    }

    // Get all CRO users with their current assignment counts
    const { data: cros, error: crosError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'CRO')
      .order('full_name')

    if (crosError || !cros || cros.length === 0) {
      apiLogger.error('Error fetching CROs', crosError)
      return NextResponse.json(
        { success: false, message: 'No CRO users available for assignment' },
        { status: 500 }
      )
    }

    // Get current assignment counts for each CRO
    const crosWithCounts = await Promise.all(
      cros.map(async (cro) => {
        const { count } = await supabase
          .from('crm_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to_cro', cro.id)

        return {
          id: cro.id,
          name: cro.full_name,
          assigned_count: count || 0,
        }
      })
    )

    // Sort CROs by assigned count (ascending) for load balancing
    crosWithCounts.sort((a, b) => a.assigned_count - b.assigned_count)

    // Round-robin assignment with load balancing
    let croIndex = 0
    const assignments: { contactId: string; croId: string }[] = []

    for (const contact of unassignedContacts) {
      const assignedCRO = crosWithCounts[croIndex]
      assignments.push({
        contactId: contact.id,
        croId: assignedCRO.id,
      })

      // Increment count for this CRO
      assignedCRO.assigned_count++

      // Move to next CRO in round-robin
      croIndex = (croIndex + 1) % crosWithCounts.length

      // Re-sort after each assignment to maintain load balance
      crosWithCounts.sort((a, b) => a.assigned_count - b.assigned_count)
    }

    // Batch update all assignments
    const updatePromises = assignments.map(({ contactId, croId }) =>
      supabase
        .from('crm_contacts')
        .update({
          assigned_to_cro: croId,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    )

    await Promise.all(updatePromises)

    // Update data_points assigned/unassigned counts
    const { count: assignedCount } = await supabase
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('data_point_id', dataPointId)
      .not('assigned_to_cro', 'is', null)

    const { count: unassignedCount } = await supabase
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('data_point_id', dataPointId)
      .is('assigned_to_cro', null)

    await supabase
      .from('data_points')
      .update({
        assigned_records: assignedCount || 0,
        unassigned_records: unassignedCount || 0,
      })
      .eq('id', dataPointId)

    return NextResponse.json({
      success: true,
      message: `Successfully distributed ${assignments.length} contacts among ${crosWithCounts.length} CROs`,
      assigned: assignments.length,
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
