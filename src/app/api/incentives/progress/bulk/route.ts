export const dynamic = 'force-dynamic'

/**
 * API Route for Bulk Progress Updates
 *
 * POST /api/incentives/progress/bulk - Update progress for multiple allocations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bulkUpdateProgress, type ProgressUpdate } from '@/lib/incentives/progress-tracking'
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

    // Check if user is admin
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

    if (!isSuperAdmin && !isHRStaff) {
      return NextResponse.json(
        { error: 'Forbidden - only admins can perform bulk updates' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid request - updates array required' }, { status: 400 })
    }

    // Validate each update
    const validUpdates: ProgressUpdate[] = updates
      .filter((update) => {
        return (
          update.userId &&
          update.incentiveId &&
          update.metricType &&
          update.currentValue !== undefined &&
          update.targetValue !== undefined
        )
      })
      .map((update) => ({
        userId: update.userId,
        incentiveId: update.incentiveId,
        metricType: update.metricType,
        currentValue: parseFloat(update.currentValue),
        targetValue: parseFloat(update.targetValue),
        source: 'manual',
        timestamp: new Date(),
        metadata: {
          ...update.metadata,
          bulk_update: true,
          updated_by: user.id
        }
      }))

    if (validUpdates.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid updates provided' }, { status: 400 })
    }

    // Perform bulk update
    const successCount = await bulkUpdateProgress(validUpdates)

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${successCount} of ${validUpdates.length} progress records`,
      totalRequested: updates.length,
      validUpdates: validUpdates.length,
      successfulUpdates: successCount,
      failedUpdates: validUpdates.length - successCount
    })
  } catch (error: unknown) {
    apiLogger.error('Error performing bulk progress update', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
