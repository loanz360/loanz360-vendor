/**
 * Knowledge Base Types - Enterprise-grade Knowledge Management System
 *
 * Comprehensive type definitions for the KnowledgeBase module
 * supporting loan products, banking terminology, and financial education
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type KBCategorySlug =
  | 'personal-loan'
  | 'business-loan'
  | 'mortgage-loan'
  | 'home-loan'
  | 'car-loan'
  | 'education-loan'
  | 'gold-loan'
  | 'loan-against-property'
  | 'banking-basics'
  | 'credit-score'
  | 'interest-rates'
  | 'documentation'
  | 'emi-calculation'
  | 'insurance'
  | 'taxation'
  | 'regulatory'
  | 'digital-banking'
  | 'partner-guide'
  | 'customer-guide'

export type ContentType = 'article' | 'faq' | 'glossary' | 'guide' | 'video' | 'infographic'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type ArticleStatus = 'draft' | 'published' | 'archived' | 'under_review'
export type VisibilityLevel = 'public' | 'partners' | 'employees' | 'internal'

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

export interface KBCategory {
  id: string
  slug: KBCategorySlug
  name: string
  description: string
  icon: string
  color: string
  gradient: string
  image: string
  order: number
  parentId?: string
  children?: KBCategory[]
  articleCount: number
  isActive: boolean
  metadata: {
    targetAudience: string[]
    tags: string[]
    lastUpdated: string
  }
}

export interface KBSubCategory {
  id: string
  categoryId: string
  slug: string
  name: string
  description: string
  icon: string
  order: number
  articleCount: number
  isActive: boolean
}

// ============================================================================
// ARTICLE & CONTENT
// ============================================================================

export interface KBArticle {
  id: string
  categoryId: string
  subCategoryId?: string
  slug: string
  title: string
  excerpt: string
  content: string
  contentType: ContentType
  difficultyLevel: DifficultyLevel
  status: ArticleStatus
  visibility: VisibilityLevel
  author: {
    id: string
    name: string
    avatar?: string
    role: string
  }
  featuredImage?: string
  images?: KBImage[]
  tags: string[]
  relatedArticleIds: string[]
  metadata: {
    readTime: number
    viewCount: number
    helpfulCount: number
    notHelpfulCount: number
    lastReviewedAt?: string
    reviewedBy?: string
  }
  seo: {
    metaTitle?: string
    metaDescription?: string
    keywords: string[]
  }
  versions: KBArticleVersion[]
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface KBArticleVersion {
  version: number
  content: string
  changedBy: string
  changedAt: string
  changeNote?: string
}

export interface KBImage {
  id: string
  url: string
  alt: string
  caption?: string
  width: number
  height: number
}

// ============================================================================
// FAQ TYPES
// ============================================================================

export interface KBFAQ {
  id: string
  categoryId: string
  question: string
  answer: string
  order: number
  tags: string[]
  helpfulCount: number
  viewCount: number
  isPopular: boolean
  relatedFaqIds: string[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// GLOSSARY TYPES
// ============================================================================

export interface KBGlossaryTerm {
  id: string
  term: string
  definition: string
  shortDefinition: string
  pronunciation?: string
  category: string
  relatedTerms: string[]
  examples: string[]
  usageNotes?: string
  aliases: string[]
  firstLetter: string
  isImportant: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================================
// SEARCH & NAVIGATION
// ============================================================================

export interface KBSearchResult {
  type: 'article' | 'faq' | 'glossary' | 'category'
  id: string
  title: string
  excerpt: string
  categoryName: string
  categorySlug: string
  relevanceScore: number
  highlightedContent?: string
}

export interface KBSearchFilters {
  query: string
  categories?: string[]
  contentTypes?: ContentType[]
  difficultyLevels?: DifficultyLevel[]
  tags?: string[]
  dateRange?: {
    from: string
    to: string
  }
}

export interface KBBreadcrumb {
  label: string
  href: string
}

// ============================================================================
// USER INTERACTION
// ============================================================================

export interface KBBookmark {
  id: string
  userId: string
  articleId: string
  createdAt: string
}

export interface KBReadHistory {
  id: string
  userId: string
  articleId: string
  readAt: string
  readProgress: number
}

export interface KBFeedback {
  id: string
  articleId: string
  userId?: string
  isHelpful: boolean
  comment?: string
  createdAt: string
}

// ============================================================================
// ADMIN & MANAGEMENT
// ============================================================================

export interface KBAnalytics {
  totalArticles: number
  totalViews: number
  totalSearches: number
  popularCategories: {
    categoryId: string
    categoryName: string
    viewCount: number
  }[]
  popularArticles: {
    articleId: string
    title: string
    viewCount: number
  }[]
  searchTerms: {
    term: string
    count: number
  }[]
  feedbackStats: {
    helpfulCount: number
    notHelpfulCount: number
    helpfulPercentage: number
  }
}

export interface KBSuggestion {
  id: string
  userId: string
  type: 'new_article' | 'correction' | 'improvement' | 'new_category'
  title: string
  description: string
  status: 'pending' | 'approved' | 'rejected' | 'implemented'
  adminNotes?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const KB_CATEGORY_COLORS: Record<KBCategorySlug, { color: string; gradient: string }> = {
  'personal-loan': {
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600'
  },
  'business-loan': {
    color: '#8B5CF6',
    gradient: 'from-violet-500 to-purple-600'
  },
  'mortgage-loan': {
    color: '#10B981',
    gradient: 'from-emerald-500 to-green-600'
  },
  'home-loan': {
    color: '#F59E0B',
    gradient: 'from-amber-500 to-orange-600'
  },
  'car-loan': {
    color: '#EF4444',
    gradient: 'from-red-500 to-rose-600'
  },
  'education-loan': {
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-teal-600'
  },
  'gold-loan': {
    color: '#F59E0B',
    gradient: 'from-yellow-500 to-amber-600'
  },
  'loan-against-property': {
    color: '#84CC16',
    gradient: 'from-lime-500 to-green-600'
  },
  'banking-basics': {
    color: '#6366F1',
    gradient: 'from-indigo-500 to-blue-600'
  },
  'credit-score': {
    color: '#EC4899',
    gradient: 'from-pink-500 to-rose-600'
  },
  'interest-rates': {
    color: '#14B8A6',
    gradient: 'from-teal-500 to-cyan-600'
  },
  'documentation': {
    color: '#64748B',
    gradient: 'from-slate-500 to-gray-600'
  },
  'emi-calculation': {
    color: '#22C55E',
    gradient: 'from-green-500 to-emerald-600'
  },
  'insurance': {
    color: '#A855F7',
    gradient: 'from-purple-500 to-violet-600'
  },
  'taxation': {
    color: '#F97316',
    gradient: 'from-orange-500 to-red-600'
  },
  'regulatory': {
    color: '#0EA5E9',
    gradient: 'from-sky-500 to-blue-600'
  },
  'digital-banking': {
    color: '#8B5CF6',
    gradient: 'from-violet-500 to-indigo-600'
  },
  'partner-guide': {
    color: '#059669',
    gradient: 'from-emerald-600 to-teal-600'
  },
  'customer-guide': {
    color: '#2563EB',
    gradient: 'from-blue-600 to-indigo-600'
  }
}

export const KB_CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  article: 'Article',
  faq: 'FAQ',
  glossary: 'Glossary',
  guide: 'Guide',
  video: 'Video',
  infographic: 'Infographic'
}

export const KB_DIFFICULTY_LABELS: Record<DifficultyLevel, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: 'bg-green-100 text-green-800' },
  intermediate: { label: 'Intermediate', color: 'bg-yellow-100 text-yellow-800' },
  advanced: { label: 'Advanced', color: 'bg-red-100 text-red-800' }
}

export const KB_VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  public: 'Public',
  partners: 'Partners Only',
  employees: 'Employees Only',
  internal: 'Internal Only'
}
