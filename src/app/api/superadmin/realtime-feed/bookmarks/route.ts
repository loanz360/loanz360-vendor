/**
 * Activity Bookmarks API
 * Pin and organize important events
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// Get user's bookmarks
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get bookmarks with activity details
    const { data: bookmarks, error } = await supabase
      .from('activity_bookmarks')
      .select(`
        id,
        notes,
        tags,
        created_at,
        realtime_activities (
          id,
          event_category,
          event_type,
          severity_level,
          status,
          title,
          description,
          actor_name,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('[Bookmarks API] Query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookmarks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bookmarks: bookmarks || []
    })
  } catch (error) {
    apiLogger.error('[Bookmarks API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Create bookmark
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const { activity_id, user_id, notes, tags } = body

    if (!activity_id || !user_id) {
      return NextResponse.json(
        { success: false, error: 'Activity ID and User ID are required' },
        { status: 400 }
      )
    }

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from('activity_bookmarks')
      .select('id')
      .eq('activity_id', activity_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Activity already bookmarked' },
        { status: 409 }
      )
    }

    const { data: bookmark, error } = await supabase
      .from('activity_bookmarks')
      .insert({
        activity_id,
        user_id,
        notes,
        tags
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Bookmarks API] Create error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bookmark,
      message: 'Activity bookmarked successfully'
    })
  } catch (error) {
    apiLogger.error('[Bookmarks API] POST Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update bookmark (notes, tags)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const { id, notes, tags } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Bookmark ID is required' },
        { status: 400 }
      )
    }

    const { data: bookmark, error } = await supabase
      .from('activity_bookmarks')
      .update({ notes, tags })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('[Bookmarks API] Update error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bookmark,
      message: 'Bookmark updated successfully'
    })
  } catch (error) {
    apiLogger.error('[Bookmarks API] PATCH Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete bookmark
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const id = searchParams.get('id')
    const activityId = searchParams.get('activity_id')
    const userId = searchParams.get('user_id')

    if (!id && !(activityId && userId)) {
      return NextResponse.json(
        { success: false, error: 'Bookmark ID or Activity ID with User ID is required' },
        { status: 400 }
      )
    }

    let query = supabase.from('activity_bookmarks').delete()

    if (id) {
      query = query.eq('id', id)
    } else {
      query = query.eq('activity_id', activityId!).eq('user_id', userId!)
    }

    const { error } = await query

    if (error) {
      apiLogger.error('[Bookmarks API] Delete error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed successfully'
    })
  } catch (error) {
    apiLogger.error('[Bookmarks API] DELETE Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
