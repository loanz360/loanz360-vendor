import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET — Fetch bookmarks for authenticated user
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', data: null },
        { status: 401 }
      )
    }

    const { data: bookmarks, error } = await supabase
      .from('kb_bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: { bookmarks: [], total: 0 }
        })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        bookmarks: bookmarks || [],
        total: bookmarks?.length || 0
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base bookmarks error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while fetching bookmarks',
      data: null
    }, { status: 500 })
  }
}

// POST — Add a bookmark for authenticated user
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', data: null },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    if (!body.contentId || !body.contentType || !body.title) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: contentId, contentType, and title are required',
        data: null
      }, { status: 400 })
    }

    if (!['faq', 'glossary', 'category'].includes(body.contentType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid content type',
        data: null
      }, { status: 400 })
    }

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from('kb_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', body.contentId)
      .eq('content_type', body.contentType)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Already bookmarked',
        data: null
      }, { status: 409 })
    }

    const { data: bookmark, error } = await supabase
      .from('kb_bookmarks')
      .insert({
        user_id: user.id,
        content_id: body.contentId,
        content_type: body.contentType,
        title: body.title
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Bookmark added successfully',
      data: bookmark
    })
  } catch (error) {
    apiLogger.error('Knowledge base bookmark create error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while adding bookmark',
      data: null
    }, { status: 500 })
  }
}

// DELETE — Remove a bookmark for authenticated user
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', data: null },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const bookmarkId = searchParams.get('id')
    const contentId = searchParams.get('contentId')
    const contentType = searchParams.get('contentType')

    let query = supabase
      .from('kb_bookmarks')
      .delete()
      .eq('user_id', user.id) // Always scoped to own bookmarks

    if (bookmarkId) {
      query = query.eq('id', bookmarkId)
    } else if (contentId && contentType) {
      query = query.eq('content_id', contentId).eq('content_type', contentType)
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either id or both contentId and contentType are required',
        data: null
      }, { status: 400 })
    }

    const { data, error } = await query.select().maybeSingle()

    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: 'Bookmark not found',
        data: null
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed successfully',
      data
    })
  } catch (error) {
    apiLogger.error('Knowledge base bookmark delete error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while removing bookmark',
      data: null
    }, { status: 500 })
  }
}
