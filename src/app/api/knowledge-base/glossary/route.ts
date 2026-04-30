
import { NextRequest, NextResponse } from 'next/server'
import {
  KB_GLOSSARY,
  getGlossaryByLetter,
  getImportantTerms,
  getGlossaryByCategory,
  getGlossaryTermById,
  getRelatedGlossaryTerms,
  searchGlossary,
  getGlossaryLetters
} from '@/lib/knowledge-base'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const letter = searchParams.get('letter')
    const category = searchParams.get('category')
    const important = searchParams.get('important') === 'true'
    const id = searchParams.get('id')
    const related = searchParams.get('related')
    const query = searchParams.get('q')
    const letters = searchParams.get('letters') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Get available letters
    if (letters) {
      const availableLetters = getGlossaryLetters()
      return NextResponse.json({
        success: true,
        data: {
          letters: availableLetters
        }
      })
    }

    // Get specific term by ID
    if (id) {
      const term = getGlossaryTermById(id)
      if (!term) {
        return NextResponse.json({
          success: false,
          error: 'Glossary term not found',
          data: null
        }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        data: term
      })
    }

    // Get related terms
    if (related) {
      const relatedTerms = getRelatedGlossaryTerms(related)
      return NextResponse.json({
        success: true,
        data: {
          terms: relatedTerms,
          total: relatedTerms.length
        }
      })
    }

    // Search glossary
    if (query) {
      const results = searchGlossary(query).slice(0, limit)
      return NextResponse.json({
        success: true,
        data: {
          query,
          terms: results,
          total: results.length
        }
      })
    }

    // Get terms by letter
    if (letter) {
      const terms = getGlossaryByLetter(letter)
      return NextResponse.json({
        success: true,
        data: {
          letter,
          terms,
          total: terms.length
        }
      })
    }

    // Get terms by category
    if (category) {
      const terms = getGlossaryByCategory(category)
      return NextResponse.json({
        success: true,
        data: {
          category,
          terms,
          total: terms.length
        }
      })
    }

    // Get important terms
    if (important) {
      const terms = getImportantTerms(limit)
      return NextResponse.json({
        success: true,
        data: {
          terms,
          total: terms.length
        }
      })
    }

    // Get all terms with pagination
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const paginatedTerms = KB_GLOSSARY.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        terms: paginatedTerms,
        total: KB_GLOSSARY.length,
        offset,
        limit,
        hasMore: offset + limit < KB_GLOSSARY.length
      }
    })
  } catch (error) {
    apiLogger.error('Knowledge base glossary error', error)
    return NextResponse.json({
      success: false,
      error: 'An error occurred while fetching glossary terms',
      data: null
    }, { status: 500 })
  }
}
