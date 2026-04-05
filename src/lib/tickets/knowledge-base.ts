/**
 * Knowledge Base System - Enterprise-grade Support Knowledge Management
 *
 * Features:
 * - Article management (create, update, publish, archive)
 * - Category hierarchy
 * - Full-text search
 * - Canned responses for agents
 * - Article versioning
 * - View tracking & analytics
 * - Related articles suggestions
 * - Multi-language support ready
 */

import { createClient } from '@/lib/supabase/server'

// Types
export type ArticleStatus = 'draft' | 'published' | 'archived'
export type ArticleVisibility = 'public' | 'internal' | 'agents_only'

export interface KBCategory {
  id: string
  name: string
  slug: string
  description?: string
  parent_id?: string
  icon?: string
  order: number
  is_active: boolean
  article_count?: number
  created_at: string
  updated_at: string
  children?: KBCategory[]
}

export interface KBArticle {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  category_id: string
  category?: KBCategory
  tags: string[]
  status: ArticleStatus
  visibility: ArticleVisibility
  author_id: string
  author_name?: string
  view_count: number
  helpful_count: number
  not_helpful_count: number
  version: number
  published_at?: string
  created_at: string
  updated_at: string
  related_articles?: KBArticle[]
  attachments?: KBAttachment[]
}

export interface KBAttachment {
  id: string
  article_id: string
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  created_at: string
}

export interface CannedResponse {
  id: string
  name: string
  shortcut: string  // e.g., "/greeting", "/closing"
  content: string
  category?: string
  tags: string[]
  usage_count: number
  is_active: boolean
  created_by_id: string
  created_by_name?: string
  created_at: string
  updated_at: string
}

export interface SearchResult {
  articles: KBArticle[]
  total: number
  query: string
  suggestions?: string[]
}

// Default Categories
export const DEFAULT_KB_CATEGORIES: Omit<KBCategory, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Getting Started',
    slug: 'getting-started',
    description: 'New user guides and onboarding information',
    icon: 'rocket',
    order: 1,
    is_active: true
  },
  {
    name: 'Loan Products',
    slug: 'loan-products',
    description: 'Information about different loan types and eligibility',
    icon: 'credit-card',
    order: 2,
    is_active: true
  },
  {
    name: 'Application Process',
    slug: 'application-process',
    description: 'How to apply for loans and required documents',
    icon: 'file-text',
    order: 3,
    is_active: true
  },
  {
    name: 'EMI & Payments',
    slug: 'emi-payments',
    description: 'Payment schedules, methods, and troubleshooting',
    icon: 'calendar',
    order: 4,
    is_active: true
  },
  {
    name: 'Account Management',
    slug: 'account-management',
    description: 'Profile settings, password reset, and security',
    icon: 'user',
    order: 5,
    is_active: true
  },
  {
    name: 'Technical Support',
    slug: 'technical-support',
    description: 'App issues, login problems, and technical FAQs',
    icon: 'tool',
    order: 6,
    is_active: true
  },
  {
    name: 'Partner Portal',
    slug: 'partner-portal',
    description: 'Guides for channel partners and DSAs',
    icon: 'users',
    order: 7,
    is_active: true
  }
]

// Default Canned Responses
export const DEFAULT_CANNED_RESPONSES: Omit<CannedResponse, 'id' | 'created_at' | 'updated_at' | 'created_by_id'>[] = [
  {
    name: 'Standard Greeting',
    shortcut: '/greeting',
    content: 'Hello! Thank you for reaching out to Loanz360 Support. I am here to help you. How may I assist you today?',
    category: 'greetings',
    tags: ['greeting', 'opening'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'Standard Closing',
    shortcut: '/closing',
    content: 'Thank you for contacting Loanz360 Support. If you have any further questions, please don\'t hesitate to reach out. Have a great day!',
    category: 'closings',
    tags: ['closing', 'thanks'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'Request Documents',
    shortcut: '/docs',
    content: 'To process your request, we will need the following documents:\n\n1. Valid government ID (Aadhaar/PAN/Passport)\n2. Address proof\n3. Income proof (last 3 months salary slips or ITR)\n4. Bank statements (last 6 months)\n\nPlease upload these documents at your earliest convenience.',
    category: 'requests',
    tags: ['documents', 'verification'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'Application Status',
    shortcut: '/status',
    content: 'I can see your loan application is currently under review. Our team is processing your documents, and you should receive an update within 24-48 business hours. You can also track your application status in the app under "My Applications".',
    category: 'status',
    tags: ['application', 'status', 'tracking'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'EMI Payment Issue',
    shortcut: '/emiproblem',
    content: 'I understand you\'re facing issues with your EMI payment. Let me help you resolve this. Could you please confirm:\n\n1. The date you attempted the payment\n2. The payment method used\n3. Any error message you received\n\nIn the meantime, you can try alternative payment methods: UPI, Net Banking, or Auto-debit.',
    category: 'payments',
    tags: ['emi', 'payment', 'issue'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'Escalation Notice',
    shortcut: '/escalate',
    content: 'I understand the urgency of your concern. I am escalating this to our senior team for priority handling. You will receive an update within the next 4 hours. Your escalation reference number is: [REF_NUMBER]. I apologize for any inconvenience caused.',
    category: 'escalation',
    tags: ['escalation', 'priority', 'senior'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'Technical Issue Acknowledgment',
    shortcut: '/techissue',
    content: 'Thank you for reporting this technical issue. I have logged it with our technical team (Ticket: [TICKET_ID]). They will investigate and work on resolving this as soon as possible. In the meantime, you may try:\n\n1. Clearing your browser cache\n2. Using a different browser\n3. Updating the app to the latest version',
    category: 'technical',
    tags: ['technical', 'bug', 'issue'],
    usage_count: 0,
    is_active: true
  },
  {
    name: 'Account Verification',
    shortcut: '/verify',
    content: 'For security purposes, I need to verify your identity. Could you please confirm the following:\n\n1. Your registered mobile number\n2. Your date of birth\n3. The last 4 digits of your PAN\n\nThis information will help me securely access your account details.',
    category: 'security',
    tags: ['verification', 'security', 'identity'],
    usage_count: 0,
    is_active: true
  }
]

/**
 * Get all categories with hierarchy
 */
export async function getCategories(includeInactive: boolean = false): Promise<KBCategory[]> {
  const supabase = await createClient()

  let query = supabase
    .from('kb_categories')
    .select('*')
    .order('order', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data: categories } = await query

  if (!categories) return []

  // Build hierarchy
  const categoryMap = new Map<string, KBCategory>()
  const rootCategories: KBCategory[] = []

  for (const cat of categories as KBCategory[]) {
    cat.children = []
    categoryMap.set(cat.id, cat)
  }

  for (const cat of categories as KBCategory[]) {
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id)!.children!.push(cat)
    } else {
      rootCategories.push(cat)
    }
  }

  return rootCategories
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<KBCategory | null> {
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  return category as KBCategory | null
}

/**
 * Create a category
 */
export async function createCategory(
  category: Omit<KBCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<KBCategory | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_categories')
    .insert(category)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating category:', error)
    return null
  }

  return data as KBCategory
}

/**
 * Get articles with filters
 */
export async function getArticles(options: {
  categoryId?: string
  status?: ArticleStatus
  visibility?: ArticleVisibility
  search?: string
  tags?: string[]
  limit?: number
  offset?: number
}): Promise<{ articles: KBArticle[]; total: number }> {
  const supabase = await createClient()

  let query = supabase
    .from('kb_articles')
    .select('*, category:kb_categories(*)', { count: 'exact' })

  if (options.categoryId) {
    query = query.eq('category_id', options.categoryId)
  }

  if (options.status) {
    query = query.eq('status', options.status)
  }

  if (options.visibility) {
    query = query.eq('visibility', options.visibility)
  }

  if (options.tags && options.tags.length > 0) {
    query = query.overlaps('tags', options.tags)
  }

  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%,tags.cs.{${options.search}}`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 20) - 1)

  const { data: articles, count } = await query

  return {
    articles: (articles || []) as KBArticle[],
    total: count || 0
  }
}

/**
 * Get article by slug
 */
export async function getArticleBySlug(slug: string): Promise<KBArticle | null> {
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('kb_articles')
    .select('*, category:kb_categories(*)')
    .eq('slug', slug)
    .maybeSingle()

  return article as KBArticle | null
}

/**
 * Get article by ID
 */
export async function getArticleById(id: string): Promise<KBArticle | null> {
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('kb_articles')
    .select('*, category:kb_categories(*)')
    .eq('id', id)
    .maybeSingle()

  return article as KBArticle | null
}

/**
 * Create an article
 */
export async function createArticle(
  article: Omit<KBArticle, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'helpful_count' | 'not_helpful_count' | 'version'>
): Promise<KBArticle | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('kb_articles')
    .insert({
      ...article,
      view_count: 0,
      helpful_count: 0,
      not_helpful_count: 0,
      version: 1
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating article:', error)
    return null
  }

  return data as KBArticle
}

/**
 * Update an article
 */
export async function updateArticle(
  id: string,
  updates: Partial<KBArticle>
): Promise<KBArticle | null> {
  const supabase = await createClient()

  // Get current version
  const { data: current } = await supabase
    .from('kb_articles')
    .select('version')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('kb_articles')
    .update({
      ...updates,
      version: (current?.version || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error updating article:', error)
    return null
  }

  return data as KBArticle
}

/**
 * Record article view
 */
export async function recordArticleView(articleId: string, userId?: string): Promise<void> {
  const supabase = await createClient()

  // Increment view count
  await supabase.rpc('increment_article_view', { article_id: articleId })

  // Record view history if user is logged in
  if (userId) {
    await supabase.from('kb_article_views').insert({
      article_id: articleId,
      user_id: userId,
      viewed_at: new Date().toISOString()
    })
  }
}

/**
 * Record article feedback
 */
export async function recordArticleFeedback(
  articleId: string,
  helpful: boolean,
  userId?: string,
  feedback?: string
): Promise<void> {
  const supabase = await createClient()

  // Update counts
  if (helpful) {
    await supabase.rpc('increment_article_helpful', { article_id: articleId })
  } else {
    await supabase.rpc('increment_article_not_helpful', { article_id: articleId })
  }

  // Record feedback
  await supabase.from('kb_article_feedback').insert({
    article_id: articleId,
    user_id: userId,
    helpful,
    feedback,
    created_at: new Date().toISOString()
  })
}

/**
 * Search articles
 */
export async function searchArticles(
  query: string,
  options?: {
    visibility?: ArticleVisibility
    categoryId?: string
    limit?: number
  }
): Promise<SearchResult> {
  const supabase = await createClient()

  // Build search query
  let dbQuery = supabase
    .from('kb_articles')
    .select('*, category:kb_categories(*)')
    .eq('status', 'published')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%,excerpt.ilike.%${query}%`)

  if (options?.visibility) {
    dbQuery = dbQuery.eq('visibility', options.visibility)
  }

  if (options?.categoryId) {
    dbQuery = dbQuery.eq('category_id', options.categoryId)
  }

  dbQuery = dbQuery
    .order('view_count', { ascending: false })
    .limit(options?.limit || 10)

  const { data: articles } = await dbQuery

  return {
    articles: (articles || []) as KBArticle[],
    total: articles?.length || 0,
    query
  }
}

/**
 * Get popular articles
 */
export async function getPopularArticles(
  limit: number = 10,
  visibility?: ArticleVisibility
): Promise<KBArticle[]> {
  const supabase = await createClient()

  let query = supabase
    .from('kb_articles')
    .select('*, category:kb_categories(*)')
    .eq('status', 'published')
    .order('view_count', { ascending: false })
    .limit(limit)

  if (visibility) {
    query = query.eq('visibility', visibility)
  }

  const { data: articles } = await query

  return (articles || []) as KBArticle[]
}

/**
 * Get related articles
 */
export async function getRelatedArticles(
  articleId: string,
  limit: number = 5
): Promise<KBArticle[]> {
  const supabase = await createClient()

  // Get current article
  const { data: article } = await supabase
    .from('kb_articles')
    .select('category_id, tags')
    .eq('id', articleId)
    .maybeSingle()

  if (!article) return []

  // Find related by category and tags
  const { data: related } = await supabase
    .from('kb_articles')
    .select('*, category:kb_categories(*)')
    .eq('status', 'published')
    .neq('id', articleId)
    .or(`category_id.eq.${article.category_id},tags.ov.{${article.tags.join(',')}}`)
    .order('view_count', { ascending: false })
    .limit(limit)

  return (related || []) as KBArticle[]
}

// Canned Responses

/**
 * Get all canned responses
 */
export async function getCannedResponses(options?: {
  category?: string
  search?: string
  activeOnly?: boolean
}): Promise<CannedResponse[]> {
  const supabase = await createClient()

  let query = supabase
    .from('canned_responses')
    .select('*')
    .order('usage_count', { ascending: false })

  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true)
  }

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,content.ilike.%${options.search}%,shortcut.ilike.%${options.search}%`)
  }

  const { data } = await query

  return (data || []) as CannedResponse[]
}

/**
 * Get canned response by shortcut
 */
export async function getCannedResponseByShortcut(shortcut: string): Promise<CannedResponse | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('canned_responses')
    .select('*')
    .eq('shortcut', shortcut)
    .eq('is_active', true)
    .maybeSingle()

  return data as CannedResponse | null
}

/**
 * Create a canned response
 */
export async function createCannedResponse(
  response: Omit<CannedResponse, 'id' | 'created_at' | 'updated_at' | 'usage_count'>
): Promise<CannedResponse | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('canned_responses')
    .insert({ ...response, usage_count: 0 })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating canned response:', error)
    return null
  }

  return data as CannedResponse
}

/**
 * Record canned response usage
 */
export async function recordCannedResponseUsage(responseId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc('increment_canned_response_usage', { response_id: responseId })
}

/**
 * Initialize default KB data
 */
export async function initializeKnowledgeBase(userId: string): Promise<void> {
  const supabase = await createClient()

  // Check if categories exist
  const { data: existingCategories } = await supabase
    .from('kb_categories')
    .select('id')
    .limit(1)

  if (!existingCategories || existingCategories.length === 0) {
    // Create default categories
    for (const category of DEFAULT_KB_CATEGORIES) {
      await supabase.from('kb_categories').insert(category)
    }
  }

  // Check if canned responses exist
  const { data: existingResponses } = await supabase
    .from('canned_responses')
    .select('id')
    .limit(1)

  if (!existingResponses || existingResponses.length === 0) {
    // Create default canned responses
    for (const response of DEFAULT_CANNED_RESPONSES) {
      await supabase.from('canned_responses').insert({
        ...response,
        created_by_id: userId
      })
    }
  }
}
