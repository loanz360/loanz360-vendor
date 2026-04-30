
import { NextRequest, NextResponse } from 'next/server'
import {
  KB_FAQS,
  getFAQsByCategory,
  getPopularFAQs,
  getFAQById,
  getRelatedFAQs
} from '@/lib/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('category')
    const popular = searchParams.get('popular') === 'true'
    const id = searchParams.get('id')
    const related = searchParams.get('related')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Get specific FAQ by ID
    if (id) {
      const faq = getFAQById(id)
      if (!faq) {
        return NextResponse.json({
          success: false,
          error: 'FAQ not found',
          data: null
        }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: faq
      })
    }

    // Get related FAQs
    if (related) {
      const relatedFaqs = getRelatedFAQs(related, Math.min(limit, 20))
      return NextResponse.json({
        success: true,
        data: {
          faqs: relatedFaqs,
          total: relatedFaqs.length
        }
      })
    }

    // Get popular FAQs
    if (popular) {
      const faqs = getPopularFAQs(Math.min(limit, 20))
      return NextResponse.json({
        success: true,
        data: {
          faqs,
          total: faqs.length
        }
      })
    }

    // Get FAQs by category
    if (categoryId) {
      const faqs = getFAQsByCategory(categoryId)
      return NextResponse.json({
        success: true,
        data: {
          categoryId,
          faqs,
          total: faqs.length
        }
      })
    }

    // Get all FAQs with pagination
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const paginatedFaqs = KB_FAQS.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        faqs: paginatedFaqs,
        total: KB_FAQS.length,
        offset,
        limit,
        hasMore: offset + limit < KB_FAQS.length
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base FAQs error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while fetching FAQs',
      data: null
    }, { status: 500 })
  }
}
