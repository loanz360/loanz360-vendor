
import { NextRequest, NextResponse } from 'next/server'
import { searchKnowledgeBase } from '@/lib/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const includeCategories = searchParams.get('categories') !== 'false'
    const includeFAQs = searchParams.get('faqs') !== 'false'
    const includeGlossary = searchParams.get('glossary') !== 'false'

    if (!query.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required',
        data: null
      }, { status: 400 })
    }

    const results = searchKnowledgeBase(query, {
      includeCategories,
      includeFAQs,
      includeGlossary,
      limit: Math.min(limit, 50) // Cap at 50 results
    })

    return NextResponse.json({
      success: true,
      data: {
        query,
        results,
        totalResults:
          results.categories.length +
          results.faqs.length +
          results.glossary.length
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base search error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while searching',
      data: null
    }, { status: 500 })
  }
}
