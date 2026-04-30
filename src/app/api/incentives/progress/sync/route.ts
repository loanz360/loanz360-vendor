import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * API Route for Syncing Incentive Progress from Leads/Deals
 *
 * POST /api/incentives/progress/sync - Trigger progress sync from CRM
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncProgressFromLeads } from '@/lib/incentives/progress-tracking'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      userId: z.string().uuid().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr.catch(() => ({}))
    const { userId } = body

    // Check if user has permission to sync
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: employeeData } = await supabase
      .from('employees')
      .select('sub_role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isSuperAdmin = profileData?.role === 'SUPER_ADMIN'
    const isHRStaff = employeeData?.sub_role === 'HR_MANAGER' || employeeData?.sub_role === 'HR_EXECUTIVE'
    const canSyncAll = isSuperAdmin || isHRStaff

    // If syncing for a specific user, check permissions
    const targetUserId = userId || (canSyncAll ? undefined : user.id)

    if (targetUserId && targetUserId !== user.id && !canSyncAll) {
      return NextResponse.json(
        { error: 'Forbidden - cannot sync progress for other users' },
        { status: 403 }
      )
    }

    // Perform sync
    const updatedCount = await syncProgressFromLeads(targetUserId)

    return NextResponse.json({
      success: true,
      message: `Successfully synced progress for ${updatedCount} allocation(s)`,
      updatedCount
    })
  } catch (error: unknown) {
    apiLogger.error('Error syncing progress', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
