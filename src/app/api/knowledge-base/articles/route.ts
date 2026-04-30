import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getArticleById,
  getArticleBySlug,
  createArticle,
  updateArticle,
  recordArticleView,
  recordArticleFeedback,
  getRelatedArticles
} from '@/lib/tickets/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/knowledge-base/articles
 * Get a specific article
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const slug = searchParams.get('slug')
    const includeRelated = searchParams.get('include_related') === 'true'

    let article = null

    if (id) {
      article = await getArticleById(id)
    } else if (slug) {
      article = await getArticleBySlug(slug)
    } else {
      return NextResponse.json({ success: false, error: 'id or slug required' }, { status: 400 })
    }

    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 })
    }

    // Get related articles if requested
    let related = []
    if (includeRelated) {
      related = await getRelatedArticles(article.id)
    }

    return NextResponse.json({
      article,
      related
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/knowledge-base/articles
 * Create a new article
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      title: z.string().optional(),


      slug: z.string().optional(),


      content: z.string().optional(),


      excerpt: z.string().optional(),


      category_id: z.string().uuid().optional(),


      tags: z.array(z.unknown()).optional(),


      status: z.string().optional(),


      visibility: z.string().optional(),


      id: z.string().uuid(),


      action: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      title,
      slug,
      content,
      excerpt,
      category_id,
      tags,
      status,
      visibility
    } = body

    if (!title || !content || !category_id) {
      return NextResponse.json(
        { error: 'title, content, and category_id are required' },
        { status: 400 }
      )
    }

    // Get author name
    const { data: employee } = await supabase
      .from('employees')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    const article = await createArticle({
      title,
      slug: slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      content,
      excerpt,
      category_id,
      tags: tags || [],
      status: status || 'draft',
      visibility: visibility || 'public',
      author_id: user.id,
      author_name: employee?.name,
      published_at: status === 'published' ? new Date().toISOString() : undefined
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Failed to create article' }, { status: 500 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/knowledge-base/articles
 * Update an article or record view/feedback
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const bodySchema2 = z.object({


      action: z.string().optional(),


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Article id required' }, { status: 400 })
    }

    // Handle special actions
    if (action === 'view') {
      await recordArticleView(id, user?.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'feedback') {
      const { helpful, feedback } = updates
      if (helpful === undefined) {
        return NextResponse.json({ success: false, error: 'helpful required' }, { status: 400 })
      }
      await recordArticleFeedback(id, helpful, user?.id, feedback)
      return NextResponse.json({ success: true })
    }

    // Regular update - requires authentication
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Update published_at if publishing
    if (updates.status === 'published') {
      const article = await getArticleById(id)
      if (article && article.status !== 'published') {
        updates.published_at = new Date().toISOString()
      }
    }

    const article = await updateArticle(id, updates)

    if (!article) {
      return NextResponse.json({ success: false, error: 'Failed to update article' }, { status: 500 })
    }

    return NextResponse.json({ article })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/knowledge-base/articles
 * Archive an article
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Article id required' }, { status: 400 })
    }

    // Archive instead of hard delete
    const article = await updateArticle(id, { status: 'archived' })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Failed to archive article' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
