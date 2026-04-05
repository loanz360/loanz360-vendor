/**
 * Offers Module Configuration
 *
 * Centralized configuration for the Offers to Customers module.
 * All configurable values are gathered here for easy maintenance.
 */

// Pagination defaults
export const OFFERS_PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  FAVORITES_DEFAULT_LIMIT: 50,
  FAVORITES_MAX_LIMIT: 200,
  AUDIT_DEFAULT_LIMIT: 50,
  AUDIT_MAX_LIMIT: 200,
  SEARCH_DEFAULT_LIMIT: 20,
  POPULAR_SEARCHES_LIMIT: 10,
} as const

// File upload limits
export const OFFERS_UPLOAD = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_IMAGE_DIMENSION: 4096,
} as const

// Search configuration
export const OFFERS_SEARCH = {
  DEFAULT_SIMILARITY_THRESHOLD: 0.3,
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 200,
  DEBOUNCE_MS: 300,
} as const

// Scheduling configuration
export const OFFERS_SCHEDULING = {
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  CRON_BATCH_SIZE: 50,
  AUTO_PUBLISH_CHECK_INTERVAL_MS: 60000, // 1 minute
} as const

// Analytics configuration
export const OFFERS_ANALYTICS = {
  VIEW_COOLDOWN_MS: 30000, // 30 seconds between view counts
  TRENDING_THRESHOLD_VIEWS: 100,
  POPULAR_THRESHOLD_VIEWS: 50,
} as const

// Cache configuration
export const OFFERS_CACHE = {
  CACHE_TIME_MS: 5 * 60 * 1000, // 5 minutes
  STALE_TIME_MS: 30 * 1000, // 30 seconds
  FAVORITES_CACHE_TIME_MS: 10 * 60 * 1000, // 10 minutes
} as const

// Sharing configuration
export const OFFERS_SHARING = {
  DEFAULT_LINK_EXPIRY_HOURS: 168, // 7 days
  MAX_LINK_EXPIRY_HOURS: 720, // 30 days
  SHARE_RATE_LIMIT_PER_HOUR: 100,
} as const

// Audit configuration
export const OFFERS_AUDIT = {
  DEFAULT_RETENTION_DAYS: 365,
  MAX_RETENTION_DAYS: 730, // 2 years
  ARCHIVE_BATCH_SIZE: 1000,
} as const

// Content moderation
export const OFFERS_MODERATION = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 5000,
  AUTO_APPROVE_THRESHOLD: 0.9, // AI confidence threshold
  REVIEW_QUEUE_LIMIT: 50,
} as const

// Collections
export const OFFERS_COLLECTIONS = {
  DEFAULT_COLOR: '#3B82F6',
  MAX_OFFERS_PER_COLLECTION: 100,
  MAX_COLLECTIONS_PER_USER: 50,
} as const

// Feature flags (can be overridden by env vars)
export const OFFERS_FEATURES = {
  ENABLE_AI_GENERATION: process.env.NEXT_PUBLIC_ENABLE_AI_OFFERS !== 'false',
  ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_OFFER_ANALYTICS !== 'false',
  ENABLE_COLLECTIONS: true,
  ENABLE_SHARING: true,
  ENABLE_MODERATION: process.env.NEXT_PUBLIC_ENABLE_CONTENT_MODERATION !== 'false',
  ENABLE_TEMPLATES: true,
} as const

// Image hosting allowed domains
export const OFFERS_IMAGE_DOMAINS = [
  'supabase.co',
  'supabase.com',
  'amazonaws.com',
  's3.amazonaws.com',
  'cloudinary.com',
  'res.cloudinary.com',
  'imgix.net',
  'images.unsplash.com',
  'unsplash.com',
  'pexels.com',
  'images.pexels.com',
  'pixabay.com',
  'cdn.pixabay.com',
] as const

// Export combined config
export const offersConfig = {
  pagination: OFFERS_PAGINATION,
  upload: OFFERS_UPLOAD,
  search: OFFERS_SEARCH,
  scheduling: OFFERS_SCHEDULING,
  analytics: OFFERS_ANALYTICS,
  cache: OFFERS_CACHE,
  sharing: OFFERS_SHARING,
  audit: OFFERS_AUDIT,
  moderation: OFFERS_MODERATION,
  collections: OFFERS_COLLECTIONS,
  features: OFFERS_FEATURES,
  imageDomains: OFFERS_IMAGE_DOMAINS,
} as const

export default offersConfig
