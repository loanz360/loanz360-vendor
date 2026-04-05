export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch banner version history
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
    const bannerId = searchParams.get('banner_id')
    const actionType = searchParams.get('action_type')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    const offset = (page - 1) * limit

    // Build query
    let countQuery = supabase.from('banner_versions').select('*', { count: 'exact', head: true })
    let dataQuery = supabase
      .from('banner_versions')
      .select(`
        *,
        banners (
          id,
          title,
          status,
          is_active
        ),
        users:created_by (
          id,
          email,
          full_name
        )
      `)

    // Apply filters
    if (bannerId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(bannerId)) {
        return NextResponse.json(
          { error: 'Invalid banner ID format' },
          { status: 400 }
        )
      }
      countQuery = countQuery.eq('banner_id', bannerId)
      dataQuery = dataQuery.eq('banner_id', bannerId)
    }

    if (actionType) {
      const validActions = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'RESTORE', 'CLONE']
      if (!validActions.includes(actionType.toUpperCase())) {
        return NextResponse.json(
          { error: `Invalid action type. Must be one of: ${validActions.join(', ')}` },
          { status: 400 }
        )
      }
      countQuery = countQuery.eq('action_type', actionType.toUpperCase())
      dataQuery = dataQuery.eq('action_type', actionType.toUpperCase())
    }

    // Get total count
    const { count, error: countError } = await countQuery
    if (countError) throw countError

    // Get paginated data
    const { data: versions, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      versions: versions || [],
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
    apiLogger.error('Error fetching banner versions', error)
    logApiError(error as Error, request, { action: 'get_versions' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Restore a banner to a specific version
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
    const { version_id } = body

    if (!version_id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    // Validate version_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(version_id)) {
      return NextResponse.json(
        { error: 'Invalid version ID format' },
        { status: 400 }
      )
    }

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from('banner_versions')
      .select('*')
      .eq('id', version_id)
      .maybeSingle()

    if (versionError || !version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Restore the banner to this version's state
    const { data: banner, error: updateError } = await supabase
      .from('banners')
      .update({
        title: version.title,
        banner_text: version.banner_text,
        image_url: version.image_url,
        image_source: version.image_source,
        ai_prompt: version.ai_prompt,
        start_date: version.start_date,
        end_date: version.end_date,
        click_url: version.click_url,
        display_order: version.display_order,
        status: version.status,
        priority: version.priority,
        banner_type: version.banner_type,
        alt_text: version.alt_text,
        updated_at: new Date().toISOString()
      })
      .eq('id', version.banner_id)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    // Get the max version_number for this banner and increment
    const { data: maxVersionData } = await supabase
      .from('banner_versions')
      .select('version_number')
      .eq('banner_id', version.banner_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersionNumber = (maxVersionData?.version_number || version.version_number) + 1

    // Create a new version record for the restore action
    const { error: insertError } = await supabase
      .from('banner_versions')
      .insert({
        banner_id: version.banner_id,
        version_number: nextVersionNumber,
        title: version.title,
        banner_text: version.banner_text,
        image_url: version.image_url,
        image_source: version.image_source,
        ai_prompt: version.ai_prompt,
        start_date: version.start_date,
        end_date: version.end_date,
        click_url: version.click_url,
        display_order: version.display_order,
        status: version.status,
        priority: version.priority,
        banner_type: version.banner_type,
        alt_text: version.alt_text,
        action_type: 'RESTORE',
        changes_summary: `Restored to version ${version.version_number}`,
        created_by: user.id
      })

    if (insertError) {
      apiLogger.error('Error inserting restore version record', insertError)
    }

    return NextResponse.json({
      success: true,
      banner,
      message: `Banner restored to version ${version.version_number}`
    })
  } catch (error: unknown) {
    apiLogger.error('Error restoring banner version', error)
    logApiError(error as Error, request, { action: 'restore_version' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
