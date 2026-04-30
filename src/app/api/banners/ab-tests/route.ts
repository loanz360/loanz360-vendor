
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

const VALID_AB_TEST_STATUSES = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const

// GET - Fetch A/B tests
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    // Get single test by ID
    if (testId) {
      if (!uuidRegex.test(testId)) {
        return NextResponse.json(
          { error: 'Invalid test ID format' },
          { status: 400 }
        )
      }

      const { data: test, error } = await supabase
        .from('ab_tests')
        .select(`
          *,
          banner_a:banner_a_id (
            id,
            title,
            image_url,
            status,
            views_count,
            clicks_count
          ),
          banner_b:banner_b_id (
            id,
            title,
            image_url,
            status,
            views_count,
            clicks_count
          ),
          created_by_user:created_by (
            id,
            email,
            full_name
          )
        `)
        .eq('id', testId)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ success: false, error: 'A/B test not found' }, { status: 404 })
        }
        throw error
      }

      // Calculate stats for each variant
      const variantACTR = test.banner_a?.views_count > 0
        ? (test.banner_a?.clicks_count / test.banner_a?.views_count) * 100
        : 0
      const variantBCTR = test.banner_b?.views_count > 0
        ? (test.banner_b?.clicks_count / test.banner_b?.views_count) * 100
        : 0

      return NextResponse.json({
        test: {
          ...test,
          variant_a_stats: {
            views: test.banner_a?.views_count || 0,
            clicks: test.banner_a?.clicks_count || 0,
            ctr: variantACTR
          },
          variant_b_stats: {
            views: test.banner_b?.views_count || 0,
            clicks: test.banner_b?.clicks_count || 0,
            ctr: variantBCTR
          }
        }
      })
    }

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    const offset = (page - 1) * limit

    // Build query for listing tests
    let countQuery = supabase.from('ab_tests').select('*', { count: 'exact', head: true })
    let dataQuery = supabase
      .from('ab_tests')
      .select(`
        *,
        banner_a:banner_a_id (
          id,
          title,
          image_url,
          views_count,
          clicks_count
        ),
        banner_b:banner_b_id (
          id,
          title,
          image_url,
          views_count,
          clicks_count
        ),
        created_by_user:created_by (
          id,
          full_name
        )
      `)

    // Apply status filter
    if (status) {
      if (!VALID_AB_TEST_STATUSES.includes(status as any)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_AB_TEST_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      countQuery = countQuery.eq('status', status)
      dataQuery = dataQuery.eq('status', status)
    }

    // Get count
    const { count, error: countError } = await countQuery
    if (countError) throw countError

    // Get paginated data
    const { data: tests, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Enhance tests with calculated stats
    const enhancedTests = (tests || []).map(test => ({
      ...test,
      variant_a_ctr: test.banner_a?.views_count > 0
        ? (test.banner_a?.clicks_count / test.banner_a?.views_count) * 100
        : 0,
      variant_b_ctr: test.banner_b?.views_count > 0
        ? (test.banner_b?.clicks_count / test.banner_b?.views_count) * 100
        : 0
    }))

    return NextResponse.json({
      tests: enhancedTests,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching A/B tests', error)
    logApiError(error as Error, request, { action: 'get_ab_tests' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new A/B test
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const {
      name,
      description,
      banner_a_id,
      banner_b_id,
      start_date,
      end_date,
      traffic_split,
      target_sub_roles
    } = body

    // Validate required fields
    if (!name || !banner_a_id || !banner_b_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: name, banner_a_id, banner_b_id, start_date, end_date' },
        { status: 400 }
      )
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(banner_a_id) || !uuidRegex.test(banner_b_id)) {
      return NextResponse.json(
        { error: 'Invalid banner ID format' },
        { status: 400 }
      )
    }

    if (banner_a_id === banner_b_id) {
      return NextResponse.json(
        { error: 'Banner A and Banner B must be different' },
        { status: 400 }
      )
    }

    // Validate dates
    const startDateObj = new Date(start_date)
    const endDateObj = new Date(end_date)

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    if (endDateObj <= startDateObj) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Validate traffic_split
    const split = traffic_split !== undefined ? traffic_split : 50
    if (split < 0 || split > 100) {
      return NextResponse.json(
        { error: 'Traffic split must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Verify banners exist
    const { data: bannersExist, error: bannerError } = await supabase
      .from('banners')
      .select('id')
      .in('id', [banner_a_id, banner_b_id])

    if (bannerError) throw bannerError

    if (!bannersExist || bannersExist.length !== 2) {
      return NextResponse.json(
        { error: 'One or both banners not found' },
        { status: 404 }
      )
    }

    // Create A/B test
    const { data: test, error } = await supabase
      .from('ab_tests')
      .insert({
        name,
        description: description || null,
        banner_a_id,
        banner_b_id,
        start_date,
        end_date,
        traffic_split: split,
        status: 'DRAFT',
        target_sub_roles: target_sub_roles || null,
        created_by: user.id
      })
      .select()
      .maybeSingle()

    if (error) throw error

    // Update banners to mark them as part of A/B test
    await supabase
      .from('banners')
      .update({
        is_ab_test: true,
        ab_test_id: test.id,
        ab_test_variant: 'A'
      })
      .eq('id', banner_a_id)

    await supabase
      .from('banners')
      .update({
        is_ab_test: true,
        ab_test_id: test.id,
        ab_test_variant: 'B'
      })
      .eq('id', banner_b_id)

    return NextResponse.json({ test, success: true })
  } catch (error: unknown) {
    apiLogger.error('Error creating A/B test', error)
    logApiError(error as Error, request, { action: 'create_ab_test' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update an A/B test
export async function PUT(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, status, winner, end_date, traffic_split } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Test ID is required' },
        { status: 400 }
      )
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid test ID format' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (status !== undefined) {
      if (!VALID_AB_TEST_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_AB_TEST_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = status

      if (status === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString()
      }
    }

    if (winner !== undefined) {
      if (winner !== 'A' && winner !== 'B' && winner !== null) {
        return NextResponse.json(
          { error: 'Winner must be "A", "B", or null' },
          { status: 400 }
        )
      }
      updateData.winner = winner
    }

    if (end_date !== undefined) {
      updateData.end_date = end_date
    }

    if (traffic_split !== undefined) {
      if (traffic_split < 0 || traffic_split > 100) {
        return NextResponse.json(
          { error: 'Traffic split must be between 0 and 100' },
          { status: 400 }
        )
      }
      updateData.traffic_split = traffic_split
    }

    const { data: test, error } = await supabase
      .from('ab_tests')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ test, success: true })
  } catch (error: unknown) {
    apiLogger.error('Error updating A/B test', error)
    logApiError(error as Error, request, { action: 'update_ab_test' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an A/B test
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Test ID is required' },
        { status: 400 }
      )
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid test ID format' },
        { status: 400 }
      )
    }

    // Get the test first to update the associated banners
    const { data: test, error: getError } = await supabase
      .from('ab_tests')
      .select('banner_a_id, banner_b_id')
      .eq('id', id)
      .maybeSingle()

    if (getError) {
      if (getError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'A/B test not found' }, { status: 404 })
      }
      throw getError
    }

    // Remove A/B test markers from banners
    await supabase
      .from('banners')
      .update({
        is_ab_test: false,
        ab_test_id: null,
        ab_test_variant: null
      })
      .in('id', [test.banner_a_id, test.banner_b_id])

    // Delete the test
    const { error } = await supabase
      .from('ab_tests')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    apiLogger.error('Error deleting A/B test', error)
    logApiError(error as Error, request, { action: 'delete_ab_test' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
