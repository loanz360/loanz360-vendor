import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { memoryCache } from '@/lib/cache/memory-cache'
import { apiLogger } from '@/lib/utils/logger'

// Valid enum values for validation
const VALID_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'DISABLED'] as const
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const VALID_BANNER_TYPES = ['PROMOTIONAL', 'INFORMATIONAL', 'ANNOUNCEMENT', 'ALERT', 'FESTIVE', 'SEASONAL'] as const

// GET - Fetch all banners (Super Admin) or user-specific banners
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const forUser = searchParams.get('forUser') === 'true'

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (forUser) {
      // Try to get from cache first (keyed by user ID)
      const cacheKey = `banners:user:${user.id}`
      const cachedBanners = memoryCache.get<any[]>(cacheKey)

      if (cachedBanners) {
        return NextResponse.json({ banners: cachedBanners, cached: true })
      }

      // Get active banners for current user
      const { data, error } = await supabase.rpc('get_active_banners_for_user')

      if (error) throw error

      // Cache for 5 minutes (300000ms)
      memoryCache.set(cacheKey, data || [], 300000)

      return NextResponse.json({ banners: data || [] })
    } else {
      // Super Admin: Get all banners with target audiences
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (userData?.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      // Pagination parameters
      const page = parseInt(searchParams.get('page') || '1', 10)
      const limit = parseInt(searchParams.get('limit') || '100', 10)

      // Filter parameters
      const statusFilter = searchParams.get('status')
      const priorityFilter = searchParams.get('priority')
      const typeFilter = searchParams.get('type')
      const searchQuery = searchParams.get('search')
      const isActiveFilter = searchParams.get('is_active')
      const sortBy = searchParams.get('sortBy') || 'display_order'
      const sortOrder = searchParams.get('sortOrder') || 'asc'

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' },
          { status: 400 }
        )
      }

      const offset = (page - 1) * limit

      // Build query with filters
      let countQuery = supabase.from('banners').select('*', { count: 'exact', head: true })
      let dataQuery = supabase
        .from('banners')
        .select(`
          *,
          banner_target_audiences (
            id,
            sub_role_id,
            banner_sub_roles (
              id,
              sub_role_name,
              sub_role_code,
              category_id,
              banner_categories (
                id,
                category_name
              )
            )
          ),
          banner_tags (
            id,
            tag_name
          )
        `)

      // Apply filters
      if (statusFilter && VALID_STATUSES.includes(statusFilter as unknown)) {
        countQuery = countQuery.eq('status', statusFilter)
        dataQuery = dataQuery.eq('status', statusFilter)
      }

      if (priorityFilter && VALID_PRIORITIES.includes(priorityFilter as unknown)) {
        countQuery = countQuery.eq('priority', priorityFilter)
        dataQuery = dataQuery.eq('priority', priorityFilter)
      }

      if (typeFilter && VALID_BANNER_TYPES.includes(typeFilter as unknown)) {
        countQuery = countQuery.eq('banner_type', typeFilter)
        dataQuery = dataQuery.eq('banner_type', typeFilter)
      }

      if (isActiveFilter !== null) {
        const isActive = isActiveFilter === 'true'
        countQuery = countQuery.eq('is_active', isActive)
        dataQuery = dataQuery.eq('is_active', isActive)
      }

      if (searchQuery) {
        const searchPattern = `%${searchQuery}%`
        countQuery = countQuery.or(`title.ilike.${searchPattern},banner_text.ilike.${searchPattern}`)
        dataQuery = dataQuery.or(`title.ilike.${searchPattern},banner_text.ilike.${searchPattern}`)
      }

      // Get total count first
      const { count, error: countError } = await countQuery

      if (countError) throw countError

      // Apply sorting
      const ascending = sortOrder === 'asc'
      const validSortFields = ['display_order', 'created_at', 'updated_at', 'title', 'start_date', 'end_date', 'views_count', 'clicks_count']
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'display_order'

      dataQuery = dataQuery.order(sortField, { ascending })

      // Add secondary sort by created_at if not already sorting by it
      if (sortField !== 'created_at') {
        dataQuery = dataQuery.order('created_at', { ascending: false })
      }

      // Apply pagination
      const { data: banners, error } = await dataQuery.range(offset, offset + limit - 1)

      if (error) throw error

      return NextResponse.json({
        banners: banners || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNext: offset + limit < (count || 0),
          hasPrev: page > 1
        }
      })
    }
  } catch (error: unknown) {
    apiLogger.error('Error fetching banners', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new banner (Super Admin only)
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
    const bodySchema = z.object({

      title: z.string().optional(),

      banner_text: z.string().optional(),

      image_url: z.string().optional(),

      image_source: z.string().optional(),

      ai_prompt: z.string().optional(),

      start_date: z.string().optional(),

      end_date: z.string().optional(),

      click_url: z.string().optional(),

      display_order: z.string().optional(),

      target_sub_roles: z.array(z.unknown()).optional(),

      priority: z.string().optional(),

      banner_type: z.string().optional(),

      alt_text: z.string().optional(),

      tags: z.array(z.unknown()).optional(),

      scheduled_publish_at: z.string().optional(),

      is_draft: z.boolean().optional(),

      id: z.string().uuid(),

      is_active: z.boolean().optional(),

      action: z.string().optional(),

      bannerIds: z.array(z.unknown()).optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      title,
      banner_text,
      image_url,
      image_source,
      ai_prompt,
      start_date,
      end_date,
      click_url,
      display_order,
      target_sub_roles,
      // New fields
      status,
      priority,
      banner_type,
      alt_text,
      tags,
      scheduled_publish_at,
      is_draft
    } = body

    // Comprehensive input validation
    if (!title || !image_url || !start_date || !end_date || !target_sub_roles?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: title, image_url, start_date, end_date, target_sub_roles' },
        { status: 400 }
      )
    }

    // Validate title length (1-200 characters)
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 200 characters' },
        { status: 400 }
      )
    }

    // Validate banner_text length if provided (max 500 characters)
    if (banner_text && (typeof banner_text !== 'string' || banner_text.length > 500)) {
      return NextResponse.json(
        { error: 'Banner text must be 500 characters or less' },
        { status: 400 }
      )
    }

    // Validate image_url format - accept any valid HTTPS URL (CDN/storage URLs may not have file extensions)
    if (typeof image_url !== 'string' || !image_url.match(/^https:\/\/.+/i)) {
      return NextResponse.json(
        { error: 'Invalid image URL format. Must be a valid HTTPS URL' },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // Validate click_url if provided
    if (click_url) {
      try {
        const urlObj = new URL(click_url)
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'Click URL must use HTTP or HTTPS protocol' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid click URL format' },
          { status: 400 }
        )
      }
    }

    // Validate display_order if provided
    if (display_order !== undefined && (typeof display_order !== 'number' || display_order < 0 || display_order > 9999)) {
      return NextResponse.json(
        { error: 'Display order must be a number between 0 and 9999' },
        { status: 400 }
      )
    }

    // Validate target_sub_roles array
    if (!Array.isArray(target_sub_roles) || target_sub_roles.length === 0 || target_sub_roles.length > 50) {
      return NextResponse.json(
        { error: 'Target sub-roles must be an array with 1-50 items' },
        { status: 400 }
      )
    }

    // Validate each sub_role_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const subRoleId of target_sub_roles) {
      if (typeof subRoleId !== 'string' || !uuidRegex.test(subRoleId)) {
        return NextResponse.json(
          { error: 'All target sub-role IDs must be valid UUIDs' },
          { status: 400 }
        )
      }
    }

    // Validate new fields if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
        { status: 400 }
      )
    }

    if (banner_type !== undefined && !VALID_BANNER_TYPES.includes(banner_type)) {
      return NextResponse.json(
        { error: `Invalid banner type. Must be one of: ${VALID_BANNER_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (alt_text !== undefined && (typeof alt_text !== 'string' || alt_text.length > 500)) {
      return NextResponse.json(
        { error: 'Alt text must be 500 characters or less' },
        { status: 400 }
      )
    }

    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 10)) {
      return NextResponse.json(
        { error: 'Tags must be an array with up to 10 items' },
        { status: 400 }
      )
    }

    // Validate scheduled_publish_at if provided
    if (scheduled_publish_at) {
      const scheduledDate = new Date(scheduled_publish_at)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid scheduled publish date format' },
          { status: 400 }
        )
      }
    }

    // Determine the banner status
    let bannerStatus = status || 'ACTIVE'
    const isActive = !is_draft

    if (is_draft) {
      bannerStatus = 'DRAFT'
    } else if (scheduled_publish_at && new Date(scheduled_publish_at) > new Date()) {
      bannerStatus = 'SCHEDULED'
    }

    // Create banner
    const { data: banner, error: bannerError } = await supabase
      .from('banners')
      .insert({
        title,
        banner_text,
        image_url,
        image_source: image_source || 'upload',
        ai_prompt,
        start_date,
        end_date,
        click_url,
        display_order: display_order || 0,
        created_by_admin_id: user.id,
        is_active: isActive,
        // New fields
        status: bannerStatus,
        priority: priority || 'MEDIUM',
        banner_type: banner_type || 'INFORMATIONAL',
        alt_text: alt_text || null,
        scheduled_publish_at: scheduled_publish_at || null
      })
      .select()
      .maybeSingle()

    if (bannerError) throw bannerError

    // Create target audience mappings
    const targetAudiences = target_sub_roles.map((subRoleId: string) => ({
      banner_id: banner.id,
      sub_role_id: subRoleId
    }))

    const { error: targetError } = await supabase
      .from('banner_target_audiences')
      .insert(targetAudiences)

    if (targetError) throw targetError

    // Create banner tags if provided
    if (tags && tags.length > 0) {
      const tagRecords = tags.map((tagName: string) => ({
        banner_id: banner.id,
        tag_name: tagName.trim().toLowerCase()
      }))

      const { error: tagError } = await supabase
        .from('banner_tags')
        .insert(tagRecords)

      if (tagError) {
        // Don't throw - tags are optional, banner was created successfully
      }
    }

    // Clear banner cache for all users (since new banner may affect multiple users)
    memoryCache.clear()

    return NextResponse.json({ banner, success: true })
  } catch (error: unknown) {
    apiLogger.error('Error creating banner', error)
    logApiError(error as Error, request, { action: 'create' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update banner (Super Admin only)
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
    const bodySchema2 = z.object({

      tags: z.string().optional(),

      banner_text: z.string().optional(),

      priority: z.string().optional(),

      title: z.string().optional(),

      scheduled_publish_at: z.string().optional(),

      ai_prompt: z.string().optional(),

      end_date: z.string().optional(),

      image_source: z.string().optional(),

      alt_text: z.string().optional(),

      is_active: z.boolean().optional(),

      click_url: z.string().optional(),

      target_sub_roles: z.string().optional(),

      banner_type: z.string().optional(),

      display_order: z.string().optional(),

      image_url: z.string().optional(),

      start_date: z.string().optional(),

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const {
      id,
      title,
      banner_text,
      image_url,
      image_source,
      ai_prompt,
      start_date,
      end_date,
      click_url,
      display_order,
      is_active,
      target_sub_roles,
      // New fields
      status,
      priority,
      banner_type,
      alt_text,
      tags,
      scheduled_publish_at
    } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Banner ID required' }, { status: 400 })
    }

    // Validate banner ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (typeof id !== 'string' || !uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid banner ID format' }, { status: 400 })
    }

    // Validate title if provided
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 200)) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 200 characters' },
        { status: 400 }
      )
    }

    // Validate banner_text if provided
    if (banner_text !== undefined && banner_text !== null && (typeof banner_text !== 'string' || banner_text.length > 500)) {
      return NextResponse.json(
        { error: 'Banner text must be 500 characters or less' },
        { status: 400 }
      )
    }

    // Validate image_url if provided - accept any valid HTTPS URL (CDN/storage URLs may not have file extensions)
    if (image_url !== undefined && (typeof image_url !== 'string' || !image_url.match(/^https:\/\/.+/i))) {
      return NextResponse.json(
        { error: 'Invalid image URL format. Must be a valid HTTPS URL' },
        { status: 400 }
      )
    }

    // Validate dates if provided
    if (start_date !== undefined || end_date !== undefined) {
      const startDate = start_date ? new Date(start_date) : null
      const endDate = end_date ? new Date(end_date) : null

      if (start_date && (!startDate || isNaN(startDate.getTime()))) {
        return NextResponse.json(
          { error: 'Invalid start date format. Use ISO 8601 format (YYYY-MM-DD)' },
          { status: 400 }
        )
      }

      if (end_date && (!endDate || isNaN(endDate.getTime()))) {
        return NextResponse.json(
          { error: 'Invalid end date format. Use ISO 8601 format (YYYY-MM-DD)' },
          { status: 400 }
        )
      }

      if (startDate && endDate && endDate <= startDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        )
      }
    }

    // Validate click_url if provided
    if (click_url !== undefined && click_url !== null && click_url !== '') {
      try {
        const urlObj = new URL(click_url)
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'Click URL must use HTTP or HTTPS protocol' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid click URL format' },
          { status: 400 }
        )
      }
    }

    // Validate display_order if provided
    if (display_order !== undefined && (typeof display_order !== 'number' || display_order < 0 || display_order > 9999)) {
      return NextResponse.json(
        { error: 'Display order must be a number between 0 and 9999' },
        { status: 400 }
      )
    }

    // Validate is_active if provided
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'is_active must be a boolean' },
        { status: 400 }
      )
    }

    // Validate new fields if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` },
        { status: 400 }
      )
    }

    if (banner_type !== undefined && !VALID_BANNER_TYPES.includes(banner_type)) {
      return NextResponse.json(
        { error: `Invalid banner type. Must be one of: ${VALID_BANNER_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (alt_text !== undefined && alt_text !== null && (typeof alt_text !== 'string' || alt_text.length > 500)) {
      return NextResponse.json(
        { error: 'Alt text must be 500 characters or less' },
        { status: 400 }
      )
    }

    if (tags !== undefined && tags !== null && (!Array.isArray(tags) || tags.length > 10)) {
      return NextResponse.json(
        { error: 'Tags must be an array with up to 10 items' },
        { status: 400 }
      )
    }

    // Validate target_sub_roles if provided
    if (target_sub_roles !== undefined) {
      if (!Array.isArray(target_sub_roles) || target_sub_roles.length === 0 || target_sub_roles.length > 50) {
        return NextResponse.json(
          { error: 'Target sub-roles must be an array with 1-50 items' },
          { status: 400 }
        )
      }

      // Validate each sub_role_id is a valid UUID
      for (const subRoleId of target_sub_roles) {
        if (typeof subRoleId !== 'string' || !uuidRegex.test(subRoleId)) {
          return NextResponse.json(
            { error: 'All target sub-role IDs must be valid UUIDs' },
            { status: 400 }
          )
        }
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updateData.title = title
    if (banner_text !== undefined) updateData.banner_text = banner_text
    if (image_url !== undefined) updateData.image_url = image_url
    if (image_source !== undefined) updateData.image_source = image_source
    if (ai_prompt !== undefined) updateData.ai_prompt = ai_prompt
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (click_url !== undefined) updateData.click_url = click_url
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_active !== undefined) updateData.is_active = is_active
    // New fields
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority
    if (banner_type !== undefined) updateData.banner_type = banner_type
    if (alt_text !== undefined) updateData.alt_text = alt_text
    if (scheduled_publish_at !== undefined) updateData.scheduled_publish_at = scheduled_publish_at

    // Update banner
    const { data: banner, error: bannerError } = await supabase
      .from('banners')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (bannerError) throw bannerError

    // Update target audiences if provided
    if (target_sub_roles && target_sub_roles.length > 0) {
      // Use a transaction-like approach: delete and insert in sequence
      // If insert fails, the delete will be rolled back by throwing an error

      // First, delete existing targets
      const { error: deleteError } = await supabase
        .from('banner_target_audiences')
        .delete()
        .eq('banner_id', id)

      if (deleteError) throw new Error(`Failed to delete existing targets: ${deleteError.message}`)

      // Then insert new targets
      const targetAudiences = target_sub_roles.map((subRoleId: string) => ({
        banner_id: id,
        sub_role_id: subRoleId
      }))

      const { error: targetError } = await supabase
        .from('banner_target_audiences')
        .insert(targetAudiences)

      if (targetError) throw new Error(`Failed to insert new targets: ${targetError.message}`)
    }

    // Update tags if provided
    if (tags !== undefined) {
      // Delete existing tags
      const { error: deleteTagError } = await supabase
        .from('banner_tags')
        .delete()
        .eq('banner_id', id)

      if (deleteTagError) {
        apiLogger.error('Error deleting banner tags', deleteTagError)
      }

      // Insert new tags if any
      if (tags && tags.length > 0) {
        const tagRecords = tags.map((tagName: string) => ({
          banner_id: id,
          tag_name: tagName.trim().toLowerCase()
        }))

        const { error: tagError } = await supabase
          .from('banner_tags')
          .insert(tagRecords)

        if (tagError) {
          apiLogger.error('Error inserting banner tags', tagError)
        }
      }
    }

    // Clear banner cache for all users (since update may affect multiple users)
    memoryCache.clear()

    return NextResponse.json({ banner, success: true })
  } catch (error: unknown) {
    apiLogger.error('Error updating banner', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Bulk operations (activate/deactivate multiple banners)
export async function PATCH(request: NextRequest) {
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
    const bodySchema3 = z.object({

      action: z.string().optional(),

      bannerIds: z.string().optional(),

    })

    const { data: body, error: _valErr3 } = await parseBody(request, bodySchema3)
    if (_valErr3) return _valErr3
    const { action, bannerIds } = body

    // Validate action
    const validActions = ['activate', 'deactivate', 'delete']
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate bannerIds
    if (!bannerIds || !Array.isArray(bannerIds) || bannerIds.length === 0) {
      return NextResponse.json(
        { error: 'bannerIds must be a non-empty array of UUIDs' },
        { status: 400 }
      )
    }

    if (bannerIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot process more than 100 banners at once' },
        { status: 400 }
      )
    }

    // Validate each banner ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const bannerId of bannerIds) {
      if (typeof bannerId !== 'string' || !uuidRegex.test(bannerId)) {
        return NextResponse.json(
          { error: 'All banner IDs must be valid UUIDs' },
          { status: 400 }
        )
      }
    }

    let result

    if (action === 'delete') {
      // Bulk delete
      const { error } = await supabase
        .from('banners')
        .delete()
        .in('id', bannerIds)

      if (error) throw error
      result = { deleted: bannerIds.length }
    } else {
      // Bulk activate/deactivate
      const isActive = action === 'activate'
      const status = isActive ? 'ACTIVE' : 'DISABLED'

      const { data, error } = await supabase
        .from('banners')
        .update({
          is_active: isActive,
          status: status,
          updated_at: new Date().toISOString()
        })
        .in('id', bannerIds)
        .select()

      if (error) throw error
      result = { updated: data?.length || 0, banners: data }
    }

    // Clear banner cache
    memoryCache.clear()

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    apiLogger.error('Error in bulk operation', error)
    logApiError(error as Error, request, { action: 'bulk' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete banner (Super Admin only)
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
    const ids = searchParams.get('ids') // For bulk delete: comma-separated IDs

    // Validate banner ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (ids) {
      // Bulk delete
      const idArray = ids.split(',').map(id => id.trim())

      if (idArray.length > 100) {
        return NextResponse.json(
          { error: 'Cannot delete more than 100 banners at once' },
          { status: 400 }
        )
      }

      // Validate each ID
      for (const bannerId of idArray) {
        if (!uuidRegex.test(bannerId)) {
          return NextResponse.json(
            { error: `Invalid banner ID format: ${bannerId}` },
            { status: 400 }
          )
        }
      }

      const { error } = await supabase
        .from('banners')
        .delete()
        .in('id', idArray)

      if (error) throw error

      // Clear banner cache
      memoryCache.clear()

      return NextResponse.json({ success: true, deleted: idArray.length })
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Banner ID required (use ?id=UUID or ?ids=UUID1,UUID2,...)' }, { status: 400 })
    }

    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid banner ID format' }, { status: 400 })
    }

    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Clear banner cache for all users (since deletion affects multiple users)
    memoryCache.clear()

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    apiLogger.error('Error deleting banner', error)
    logApiError(error as Error, request, { action: 'delete' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
