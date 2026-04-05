/**
 * Knowledge Base Module - Main Export
 * Comprehensive loan and banking knowledge management system
 */

// Types
export type {
  KBCategory,
  KBSubCategory,
  KBArticle,
  KBArticleVersion,
  KBImage,
  KBFAQ,
  KBGlossaryTerm,
  KBSearchResult,
  KBSearchFilters,
  KBBreadcrumb,
  KBBookmark,
  KBReadHistory,
  KBFeedback,
  KBAnalytics,
  KBSuggestion,
  KBCategorySlug,
  ContentType,
  DifficultyLevel,
  ArticleStatus,
  VisibilityLevel
} from '@/types/knowledge-base'

// Constants
export {
  KB_CATEGORY_COLORS,
  KB_CONTENT_TYPE_LABELS,
  KB_DIFFICULTY_LABELS,
  KB_VISIBILITY_LABELS
} from '@/types/knowledge-base'

// Categories - Direct ES6 imports
import {
  KB_CATEGORIES as _KB_CATEGORIES,
  getKBCategoryBySlug,
  getKBCategoriesByAudience,
  getActiveKBCategories
} from './kb-categories'

export {
  getKBCategoryBySlug,
  getKBCategoriesByAudience,
  getActiveKBCategories
}
export const KB_CATEGORIES = _KB_CATEGORIES

// FAQs - Direct ES6 imports
import {
  KB_FAQS as _KB_FAQS,
  getFAQsByCategory,
  getPopularFAQs,
  searchFAQs as _searchFAQs
} from './kb-faqs'

export {
  getFAQsByCategory,
  getPopularFAQs
}
export const KB_FAQS = _KB_FAQS
export const searchFAQs = _searchFAQs

// Glossary - Direct ES6 imports
import {
  KB_GLOSSARY as _KB_GLOSSARY,
  getGlossaryByLetter,
  getImportantTerms,
  searchGlossary as _searchGlossary,
  getGlossaryByCategory
} from './kb-glossary'

export {
  getGlossaryByLetter,
  getImportantTerms,
  getGlossaryByCategory
}
export const KB_GLOSSARY = _KB_GLOSSARY
export const searchGlossary = _searchGlossary

// Import types for use in this file
import type { KBCategory, KBFAQ, KBGlossaryTerm } from '@/types/knowledge-base'

/**
 * Search across all knowledge base content
 * @param query - Search query string
 * @param options - Search options
 * @returns Search results grouped by type
 */
export const searchKnowledgeBase = (
  query: string,
  options?: {
    includeCategories?: boolean
    includeFAQs?: boolean
    includeGlossary?: boolean
    limit?: number
  }
): {
  categories: KBCategory[]
  faqs: KBFAQ[]
  glossary: KBGlossaryTerm[]
} => {
  const {
    includeCategories = true,
    includeFAQs = true,
    includeGlossary = true,
    limit = 10
  } = options || {}

  // Validate and sanitize query
  const searchTerm = (query || '').trim().toLowerCase()

  const results: {
    categories: KBCategory[]
    faqs: KBFAQ[]
    glossary: KBGlossaryTerm[]
  } = {
    categories: [],
    faqs: [],
    glossary: []
  }

  // Return empty results for empty query
  if (!searchTerm) {
    return results
  }

  try {
    if (includeCategories) {
      results.categories = _KB_CATEGORIES
        .filter((cat: KBCategory) =>
          cat.name.toLowerCase().includes(searchTerm) ||
          cat.description.toLowerCase().includes(searchTerm) ||
          cat.metadata.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
        )
        .slice(0, limit)
    }

    if (includeFAQs) {
      results.faqs = _searchFAQs(query).slice(0, limit)
    }

    if (includeGlossary) {
      results.glossary = _searchGlossary(query).slice(0, limit)
    }
  } catch (error) {
    console.error('Error searching knowledge base:', error)
  }

  return results
}

/**
 * Get all unique first letters from glossary terms
 * @returns Sorted array of unique letters
 */
export const getGlossaryLetters = (): string[] => {
  const letters = new Set(_KB_GLOSSARY.map((term: KBGlossaryTerm) => term.firstLetter.toUpperCase()))
  return Array.from(letters).sort()
}

/**
 * Get statistics about knowledge base content
 * @returns Category and content statistics
 */
export const getCategoryStats = () => {
  return {
    totalCategories: _KB_CATEGORIES.length,
    totalFAQs: _KB_FAQS.length,
    totalGlossaryTerms: _KB_GLOSSARY.length,
    categoriesWithContent: _KB_CATEGORIES.map((cat: KBCategory) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      faqCount: _KB_FAQS.filter((faq: KBFAQ) => faq.categoryId === cat.id).length,
      glossaryCount: _KB_GLOSSARY.filter((term: KBGlossaryTerm) => term.category === cat.slug).length
    }))
  }
}

/**
 * Get FAQ by ID
 * @param id - FAQ ID
 * @returns FAQ object or undefined
 */
export const getFAQById = (id: string): KBFAQ | undefined => {
  return _KB_FAQS.find((faq: KBFAQ) => faq.id === id)
}

/**
 * Get glossary term by ID
 * @param id - Term ID
 * @returns Glossary term or undefined
 */
export const getGlossaryTermById = (id: string): KBGlossaryTerm | undefined => {
  return _KB_GLOSSARY.find((term: KBGlossaryTerm) => term.id === id)
}

/**
 * Get related FAQs based on tags
 * @param faqId - Current FAQ ID
 * @param limit - Max number of related FAQs
 * @returns Array of related FAQs
 */
export const getRelatedFAQs = (faqId: string, limit: number = 5): KBFAQ[] => {
  const currentFaq = getFAQById(faqId)
  if (!currentFaq) return []

  return _KB_FAQS
    .filter((faq: KBFAQ) =>
      faq.id !== faqId &&
      (faq.categoryId === currentFaq.categoryId ||
       faq.tags.some((tag: string) => currentFaq.tags.includes(tag)))
    )
    .slice(0, limit)
}

/**
 * Get related glossary terms
 * @param termId - Current term ID
 * @returns Array of related terms
 */
export const getRelatedGlossaryTerms = (termId: string): KBGlossaryTerm[] => {
  const currentTerm = getGlossaryTermById(termId)
  if (!currentTerm) return []

  return _KB_GLOSSARY.filter((term: KBGlossaryTerm) =>
    currentTerm.relatedTerms.includes(term.term)
  )
}
