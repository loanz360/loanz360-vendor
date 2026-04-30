import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { csrfProtection } from '@/lib/middleware/csrf'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { requireHRAccess } from '@/lib/auth/hr-access'

const MAX_BULK_UPLOAD_SIZE = 1000

// POST - Bulk upload attendance records
export async function POST(request: NextRequest) {
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.CREATE,
    maxRequests: 5, // Max 5 bulk uploads per hour
    windowMs: 60 * 60 * 1000
  })
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use shared HR access check instead of manual users table query
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { attendance_data } = body

    if (!Array.isArray(attendance_data) || attendance_data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid attendance data' },
        { status: 400 }
      )
    }

    // Size limit validation to prevent excessively large uploads
    if (attendance_data.length > MAX_BULK_UPLOAD_SIZE) {
      return NextResponse.json(
        { success: false, error: `Too many records. Maximum ${MAX_BULK_UPLOAD_SIZE} records per upload.` },
        { status: 400 }
      )
    }

    // Call bulk upload function
    const { data: result, error } = await adminClient
      .rpc('bulk_upload_attendance', {
        p_attendance_data: attendance_data,
        p_uploaded_by: user.id
      })

    if (error) throw error

    // Null check on RPC result
    if (!result) {
      return NextResponse.json({
        success: true,
        data: { success_count: 0, error_count: 0 },
        message: 'Upload completed but returned no result data.'
      })
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully uploaded ${result.success_count ?? 0} records. ${result.error_count ?? 0} errors.`
    })

  } catch (error: unknown) {
    apiLogger.error('Bulk attendance upload error', error)
    logApiError(error instanceof Error ? error : new Error('Unknown error'), request, { action: 'bulk_attendance_upload' })
    return NextResponse.json(
      { success: false, error: 'Failed to upload attendance records' },
      { status: 500 }
    )
  }
}
