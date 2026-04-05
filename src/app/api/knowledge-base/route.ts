export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCategories,
  getArticles,
  searchArticles,
  getPopularArticles,
  initializeKnowledgeBase
} from '@/lib/tickets/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/knowledge-base
 * Get KB articles, categories, or search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'articles'

    // Mode: Get categories
    if (mode === 'categories') {
      const includeInactive = searchParams.get('include_inactive') === 'true'
      const categories = await getCategories(includeInactive)
      return NextResponse.json({ categories })
    }

    // Mode: Search articles
    if (mode === 'search') {
      const query = searchParams.get('q') || ''
      const visibility = searchParams.get('visibility') as any
      const categoryId = searchParams.get('category_id') || undefined
      const limit = parseInt(searchParams.get('limit') || '10')

      if (!query) {
        return NextResponse.json({ success: false, error: 'Search query required' }, { status: 400 })
      }

      const results = await searchArticles(query, { visibility, categoryId, limit })
      return NextResponse.json(results)
    }

    // Mode: Get popular articles
    if (mode === 'popular') {
      const limit = parseInt(searchParams.get('limit') || '10')
      const visibility = searchParams.get('visibility') as any
      const articles = await getPopularArticles(limit, visibility)
      return NextResponse.json({ articles })
    }

    // Default: Get articles with filters
    const categoryId = searchParams.get('category_id') || undefined
    const status = searchParams.get('status') as any
    const visibility = searchParams.get('visibility') as any
    const search = searchParams.get('search') || undefined
    const tags = searchParams.get('tags')?.split(',') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await getArticles({
      categoryId,
      status,
      visibility,
      search,
      tags,
      limit,
      offset
    })

    return NextResponse.json(result)
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/knowledge-base
 * Initialize knowledge base with default data
 */
export async function PUT() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await initializeKnowledgeBase(user.id)

    return NextResponse.json({
      success: true,
      message: 'Knowledge base initialized with default data'
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
