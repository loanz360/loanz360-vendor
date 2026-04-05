export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { csrfProtection } from '@/lib/middleware/csrf'
import { apiLogger } from '@/lib/utils/logger'
import DOMPurify from 'isomorphic-dompurify'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch regularization requests
    const { data: requests, error } = await supabase
      .from('attendance_regularization_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: requests || []
    })

  } catch (error) {
    apiLogger.error('Fetch regularization requests error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch regularization requests' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  // Apply CSRF protection
  const csrfResponse = await csrfProtection(request)
  if (csrfResponse) return csrfResponse

  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      date,
      request_type,
      proposed_check_in,
      proposed_check_out,
      proposed_status,
      reason,
      supporting_documents
    } = body

    // Validate required fields
    if (!date || !request_type || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Sanitize reason field with DOMPurify
    const sanitizedReason = DOMPurify.sanitize(reason.trim(), { ALLOWED_TAGS: [] })

    // Validate document URLs (must be valid HTTPS URLs)
    if (supporting_documents && Array.isArray(supporting_documents)) {
      for (const docUrl of supporting_documents) {
        if (typeof docUrl !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Invalid document URL format' },
            { status: 400 }
          )
        }
        try {
          const parsed = new URL(docUrl)
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return NextResponse.json(
              { success: false, error: `Invalid document URL protocol: ${docUrl}` },
              { status: 400 }
            )
          }
        } catch {
          // Allow relative paths from Supabase storage (e.g., /storage/...)
          if (!docUrl.startsWith('/')) {
            return NextResponse.json(
              { success: false, error: `Invalid document URL: ${docUrl}` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Check if attendance record exists for this date
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle()

    // Create regularization request
    const { data: regularizationRequest, error } = await supabase
      .from('attendance_regularization_requests')
      .insert({
        user_id: user.id,
        attendance_id: existingAttendance?.id || null,
        date,
        request_type,
        proposed_check_in,
        proposed_check_out,
        proposed_status,
        original_check_in: existingAttendance?.check_in || null,
        original_check_out: existingAttendance?.check_out || null,
        original_status: existingAttendance?.status || null,
        reason: sanitizedReason,
        supporting_documents: supporting_documents || null,
        status: 'pending'
      })
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: regularizationRequest
    })

  } catch (error) {
    apiLogger.error('Create regularization request error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, error: 'Failed to create regularization request' },
      { status: 500 }
    )
  }
}
