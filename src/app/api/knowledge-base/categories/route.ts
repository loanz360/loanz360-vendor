
import { NextRequest, NextResponse } from 'next/server'
import {
  KB_CATEGORIES,
  getKBCategoryBySlug,
  getKBCategoriesByAudience,
  getActiveKBCategories,
  getCategoryStats
} from '@/lib/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get('slug')
    const audience = searchParams.get('audience')
    const active = searchParams.get('active') === 'true'
    const stats = searchParams.get('stats') === 'true'

    // Get category statistics
    if (stats) {
      const categoryStats = getCategoryStats()
      return NextResponse.json({
        success: true,
        data: categoryStats
      })
    }

    // Get specific category by slug
    if (slug) {
      const category = getKBCategoryBySlug(slug)
      if (!category) {
        return NextResponse.json({
          success: false,
          error: 'Category not found',
          data: null
        }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: category
      })
    }

    // Get categories by audience
    if (audience) {
      const categories = getKBCategoriesByAudience(audience as 'customers' | 'partners' | 'employees')
      return NextResponse.json({
        success: true,
        data: {
          audience,
          categories,
          total: categories.length
        }
      })
    }

    // Get active categories only
    if (active) {
      const categories = getActiveKBCategories()
      return NextResponse.json({
        success: true,
        data: {
          categories,
          total: categories.length
        }
      })
    }

    // Get all categories
    return NextResponse.json({
      success: true,
      data: {
        categories: KB_CATEGORIES,
        total: KB_CATEGORIES.length
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base categories error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while fetching categories',
      data: null
    }, { status: 500 })
  }
}
