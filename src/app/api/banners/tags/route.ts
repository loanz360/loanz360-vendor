export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

// GET - Fetch all unique tags or tags for a specific banner
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
    const search = searchParams.get('search')

    if (bannerId) {
      // Get tags for a specific banner
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(bannerId)) {
        return NextResponse.json(
          { error: 'Invalid banner ID format' },
          { status: 400 }
        )
      }

      const { data: tags, error } = await supabase
        .from('banner_tags')
        .select('id, tag_name, created_at')
        .eq('banner_id', bannerId)
        .order('tag_name', { ascending: true })

      if (error) throw error

      return NextResponse.json({ tags: tags || [] })
    }

    // Get all unique tags with counts
    let query = supabase
      .from('banner_tags')
      .select('tag_name')

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.ilike('tag_name', `%${safeSearch}%`)
      }
    }

    const { data: allTags, error } = await query

    if (error) throw error

    // Count occurrences of each tag
    const tagCounts: Record<string, number> = {}
    for (const tag of allTags || []) {
      tagCounts[tag.tag_name] = (tagCounts[tag.tag_name] || 0) + 1
    }

    // Convert to array and sort by count
    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ tags })
  } catch (error: unknown) {
    apiLogger.error('Error fetching banner tags', error)
    logApiError(error as Error, request, { action: 'get_tags' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add tags to a banner
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
    const { banner_id, tags } = body

    if (!banner_id) {
      return NextResponse.json(
        { error: 'Banner ID is required' },
        { status: 400 }
      )
    }

    // Validate banner_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(banner_id)) {
      return NextResponse.json(
        { error: 'Invalid banner ID format' },
        { status: 400 }
      )
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: 'Tags must be a non-empty array of strings' },
        { status: 400 }
      )
    }

    if (tags.length > 10) {
      return NextResponse.json(
        { error: 'Cannot add more than 10 tags at once' },
        { status: 400 }
      )
    }

    // Validate and normalize tags
    const normalizedTags = tags
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim().toLowerCase().slice(0, 50))

    if (normalizedTags.length === 0) {
      return NextResponse.json(
        { error: 'No valid tags provided' },
        { status: 400 }
      )
    }

    // Insert tags (ignore duplicates)
    const tagRecords = normalizedTags.map(tag_name => ({
      banner_id,
      tag_name
    }))

    const { data: insertedTags, error } = await supabase
      .from('banner_tags')
      .upsert(tagRecords, { onConflict: 'banner_id,tag_name', ignoreDuplicates: true })
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      tags: insertedTags || [],
      message: `Added ${normalizedTags.length} tag(s)`
    })
  } catch (error: unknown) {
    apiLogger.error('Error adding banner tags', error)
    logApiError(error as Error, request, { action: 'add_tags' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a tag from a banner
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
    const tagId = searchParams.get('id')
    const bannerId = searchParams.get('banner_id')
    const tagName = searchParams.get('tag_name')

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (tagId) {
      // Delete by tag ID
      if (!uuidRegex.test(tagId)) {
        return NextResponse.json(
          { error: 'Invalid tag ID format' },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('banner_tags')
        .delete()
        .eq('id', tagId)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    if (bannerId && tagName) {
      // Delete by banner_id and tag_name
      if (!uuidRegex.test(bannerId)) {
        return NextResponse.json(
          { error: 'Invalid banner ID format' },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('banner_tags')
        .delete()
        .eq('banner_id', bannerId)
        .eq('tag_name', tagName.toLowerCase())

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Either tag ID or (banner_id and tag_name) is required' },
      { status: 400 }
    )
  } catch (error: unknown) {
    apiLogger.error('Error deleting banner tag', error)
    logApiError(error as Error, request, { action: 'delete_tag' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
