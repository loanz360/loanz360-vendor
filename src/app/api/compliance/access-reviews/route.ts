import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { initiateAccessReview } from '@/lib/compliance/compliance-service'

/**
 * GET /api/compliance/access-reviews
 * List access reviews
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const status = searchParams.get('status')
    const reviewType = searchParams.get('reviewType')

    let query = supabase
      .from('access_reviews')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (reviewType) query = query.eq('review_type', reviewType)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      reviews: data || [],
    })
  } catch (error) {
    return handleApiError(error, 'fetch access reviews')
  }
}

/**
 * POST /api/compliance/access-reviews
 * Initiate new access review
 */
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { reviewType, reviewerId } = body

    const reviewId = await initiateAccessReview(reviewType, reviewerId)

    if (!reviewId) {
      return NextResponse.json(
        { success: false, error: 'Failed to initiate access review' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reviewId,
      message: 'Access review initiated successfully',
    })
  } catch (error) {
    return handleApiError(error, 'initiate access review')
  }
}

/**
 * PATCH /api/compliance/access-reviews
 * Update access review results
 */
export async function PATCH(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { reviewId, status, findings, completionNotes, signOffBy } = body

    if (!reviewId) {
      return NextResponse.json(
        { success: false, error: 'Review ID required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    const updateData: any = {}
    if (status) updateData.status = status
    if (findings) {
      updateData.findings = findings
      updateData.findings_count = findings.length
    }
    if (completionNotes) updateData.completion_notes = completionNotes
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
      if (signOffBy) {
        updateData.sign_off_by = signOffBy
        updateData.sign_off_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('access_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      review: data,
    })
  } catch (error) {
    return handleApiError(error, 'update access review')
  }
}
