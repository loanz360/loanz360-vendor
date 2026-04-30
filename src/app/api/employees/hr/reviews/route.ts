
// =====================================================
// HR PERFORMANCE REVIEWS API
// GET: List all reviews with stats + employees/cycles for forms
// POST: Create new review (HR initiates for employee)
// PATCH: Update review status (START, COMPLETE, SHARE)
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

// ---------- Zod Schemas ----------

const createReviewBodySchema = z.object({
  employee_id: z.string().uuid('Invalid employee_id'),
  cycle_id: z.string().uuid('Invalid cycle_id'),
  review_type: z.string().max(50).optional().default('MANAGER'),
  initial_notes: z.string().max(5000).optional().nullable(),
})

const patchReviewBodySchema = z.object({
  action: z.enum(['START', 'COMPLETE', 'SHARE']),
  review_id: z.string().uuid('Invalid review_id'),
  overall_rating: z.number().min(0).max(5).optional(),
  goal_achievement_percentage: z.number().min(0).max(100).optional(),
  strengths: z.string().max(5000).optional().nullable(),
  areas_for_improvement: z.string().max(5000).optional().nullable(),
  achievements: z.string().max(5000).optional().nullable(),
})

// Valid status transitions: action -> required current status
const STATUS_TRANSITIONS: Record<string, string> = {
  START: 'DRAFT',
  COMPLETE: 'UNDER_REVIEW',
  SHARE: 'FINALIZED',
}

interface ReviewRow {
  id: string
  cycle_id: string
  employee_id: string
  review_type: string
  reviewer_id: string | null
  overall_rating: number | null
  status: string
  cycle?: { id: string; cycle_name: string; cycle_type: string; review_period_start: string; review_period_end: string } | null
  employee?: { id: string; full_name: string; work_email: string; department: string | null; designation: string | null } | null
  [key: string]: unknown
}

interface ReviewerRow {
  user_id: string
  full_name: string
}

// GET: List all performance reviews (HR view)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get('status')
    const cycleTypeFilter = searchParams.get('cycle_type')
    const includeFormData = searchParams.get('include_form_data') === 'true'

    // Fetch reviews with employee and cycle joins
    let query = adminClient
      .from('performance_reviews')
      .select(`
        *,
        employee:employees!performance_reviews_employee_id_fkey(
          id,
          full_name,
          work_email,
          department,
          designation
        ),
        cycle:performance_review_cycles(
          id,
          cycle_name,
          cycle_type,
          review_period_start,
          review_period_end
        )
      `)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter.toUpperCase())
    }

    const { data: reviews, error: reviewsError } = await query

    if (reviewsError) {
      apiLogger.error('HR Reviews fetch error', reviewsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 })
    }

    // Filter by cycle type if specified (post-query since it's a nested field)
    let filteredReviews: ReviewRow[] = (reviews || []) as ReviewRow[]
    if (cycleTypeFilter) {
      filteredReviews = filteredReviews.filter((r: ReviewRow) =>
        r.cycle?.cycle_type?.toLowerCase() === cycleTypeFilter.toLowerCase()
      )
    }

    // Batch fetch reviewer names from employees table
    const reviewerIds = [...new Set(
      filteredReviews
        .map((r: ReviewRow) => r.reviewer_id)
        .filter(Boolean)
    )] as string[]

    let reviewerMap: Record<string, string> = {}
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await adminClient
        .from('employees')
        .select('user_id, full_name')
        .in('user_id', reviewerIds)

      if (reviewers) {
        reviewerMap = Object.fromEntries(
          (reviewers as ReviewerRow[]).map((r) => [r.user_id, r.full_name])
        )
      }
    }

    // Enrich reviews with reviewer names
    const enrichedReviews = filteredReviews.map((review: ReviewRow) => ({
      ...review,
      reviewer_name: review.reviewer_id
        ? (reviewerMap[review.reviewer_id] || 'Unknown Reviewer')
        : 'Self Review'
    }))

    // Compute stats from ALL reviews (not filtered)
    const allReviews: ReviewRow[] = (reviews || []) as ReviewRow[]
    const ratedReviews = allReviews.filter((r: ReviewRow) => r.overall_rating != null)
    const stats = {
      totalReviews: allReviews.length,
      draftReviews: allReviews.filter((r: ReviewRow) => r.status === 'DRAFT').length,
      submittedReviews: allReviews.filter((r: ReviewRow) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)).length,
      finalizedReviews: allReviews.filter((r: ReviewRow) => ['FINALIZED', 'SHARED'].includes(r.status)).length,
      averageRating: ratedReviews.length > 0
        ? ratedReviews.reduce((sum: number, r: ReviewRow) => sum + Number(r.overall_rating), 0) / ratedReviews.length
        : 0
    }

    // Optionally include form data (employees list + review cycles)
    let formData = undefined
    if (includeFormData) {
      const [employeesResult, cyclesResult] = await Promise.all([
        adminClient
          .from('employees')
          .select('id, full_name, work_email, department, designation')
          .eq('employee_status', 'ACTIVE')
          .order('full_name', { ascending: true }),
        adminClient
          .from('performance_review_cycles')
          .select('id, cycle_name, cycle_type, review_period_start, review_period_end, status')
          .in('status', ['DRAFT', 'OPEN', 'IN_REVIEW'])
          .order('review_period_end', { ascending: false })
      ])

      formData = {
        employees: employeesResult.data || [],
        cycles: cyclesResult.data || []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reviews: enrichedReviews,
        stats,
        ...(formData ? { formData } : {})
      }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Reviews GET Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// POST: Create new review (HR initiates for employee)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const rawBody = await request.json()
    const parsed = createReviewBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: parsed.error.errors },
        { status: 400 }
      )
    }
    const { employee_id, cycle_id, review_type, initial_notes } = parsed.data

    // Verify cycle exists
    const { data: cycle } = await adminClient
      .from('performance_review_cycles')
      .select('id, status')
      .eq('id', cycle_id)
      .maybeSingle()

    if (!cycle) {
      return NextResponse.json({ success: false, error: 'Review cycle not found' }, { status: 404 })
    }

    // Check for existing review
    const { data: existing } = await adminClient
      .from('performance_reviews')
      .select('id')
      .eq('cycle_id', cycle_id)
      .eq('employee_id', employee_id)
      .eq('review_type', review_type || 'MANAGER')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: false, error: 'Review already exists for this employee in this cycle'
      }, { status: 400 })
    }

    const { data: review, error: insertError } = await adminClient
      .from('performance_reviews')
      .insert({
        cycle_id,
        employee_id,
        review_type: review_type || 'MANAGER',
        reviewer_id: user.id,
        achievements: initial_notes || null,
        status: 'DRAFT'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Review insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create review' }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'performance_review',
        entity_id: review.id,
        description: `Created performance review for employee ${employee_id} in cycle ${cycle_id}`,
        details: { employee_id, cycle_id, review_type: review_type || 'MANAGER' }
      })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for performance review creation', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      data: review,
      message: 'Review created successfully'
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Reviews POST Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// PATCH: Update review status/data
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const rawBody = await request.json()
    const parsed = patchReviewBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: parsed.error.errors },
        { status: 400 }
      )
    }
    const { action, review_id, ...actionData } = parsed.data

    // Fetch current review to enforce status guards
    const { data: currentReview, error: fetchError } = await adminClient
      .from('performance_reviews')
      .select('id, status')
      .eq('id', review_id)
      .maybeSingle()

    if (fetchError || !currentReview) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      )
    }

    // Validate status transition
    const requiredStatus = STATUS_TRANSITIONS[action]
    if (requiredStatus && currentReview.status !== requiredStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot ${action} review: current status is '${currentReview.status}', expected '${requiredStatus}'`
        },
        { status: 400 }
      )
    }

    if (action === 'START') {
      const { data: updated, error: updateError } = await adminClient
        .from('performance_reviews')
        .update({ status: 'UNDER_REVIEW' })
        .eq('id', review_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to start review' }, { status: 500 })
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'performance_review',
          entity_id: review_id,
          description: `Started performance review (status: UNDER_REVIEW)`,
          details: { action: 'START', review_id }
        })
      } catch (auditErr) {
        apiLogger.error('Audit log failed for performance review start', { error: auditErr })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Review started'
      })
    } else if (action === 'COMPLETE') {
      const {
        overall_rating,
        goal_achievement_percentage,
        strengths,
        areas_for_improvement,
        achievements
      } = actionData

      // Determine rating label (null-safe: if no rating provided, label is null)
      let overall_rating_label: string | null = null
      if (overall_rating != null) {
        if (overall_rating >= 4.5) overall_rating_label = 'EXCEPTIONAL'
        else if (overall_rating >= 3.5) overall_rating_label = 'EXCEEDS'
        else if (overall_rating >= 2.5) overall_rating_label = 'MEETS'
        else if (overall_rating >= 1.5) overall_rating_label = 'NEEDS_IMPROVEMENT'
        else overall_rating_label = 'UNSATISFACTORY'
      }

      const { data: updated, error: updateError } = await adminClient
        .from('performance_reviews')
        .update({
          status: 'FINALIZED',
          overall_rating,
          overall_rating_label,
          goal_achievement_percentage,
          strengths,
          areas_for_improvement,
          achievements,
          finalized_at: new Date().toISOString()
        })
        .eq('id', review_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to complete review' }, { status: 500 })
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'performance_review',
          entity_id: review_id,
          description: `Finalized performance review with rating ${overall_rating}`,
          details: { action: 'COMPLETE', review_id, overall_rating, overall_rating_label }
        })
      } catch (auditErr) {
        apiLogger.error('Audit log failed for performance review completion', { error: auditErr })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Review completed and finalized'
      })
    } else if (action === 'SHARE') {
      const { data: updated, error: updateError } = await adminClient
        .from('performance_reviews')
        .update({
          status: 'SHARED',
          shared_with_employee_at: new Date().toISOString()
        })
        .eq('id', review_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to share review' }, { status: 500 })
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'performance_review',
          entity_id: review_id,
          description: `Shared performance review with employee`,
          details: { action: 'SHARE', review_id }
        })
      } catch (auditErr) {
        apiLogger.error('Audit log failed for performance review share', { error: auditErr })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Review shared with employee'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Reviews PATCH Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
