/**
 * Contest Module Configuration Constants
 *
 * Centralized configuration for contest-related features.
 * These values can be overridden via environment variables where applicable.
 */

// File Upload Configuration
export const CONTEST_UPLOAD_CONFIG = {
  /** Maximum file size in bytes (default: 5MB) */
  MAX_FILE_SIZE: parseInt(process.env.CONTEST_MAX_FILE_SIZE || '5242880', 10),

  /** Allowed MIME types for banner images */
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],

  /** Cache control header value in seconds */
  CACHE_CONTROL_SECONDS: '3600',

  /** Storage bucket name for contest banners */
  STORAGE_BUCKET: 'contest-banners',
} as const

// AI Image Generation Configuration (DALL-E)
export const AI_IMAGE_CONFIG = {
  /** OpenAI model for image generation */
  MODEL: process.env.DALLE_MODEL || 'dall-e-3',

  /** Generated image dimensions */
  SIZE: (process.env.DALLE_IMAGE_SIZE || '1792x1024') as '1792x1024' | '1024x1024' | '1024x1792',

  /** Image quality setting */
  QUALITY: (process.env.DALLE_QUALITY || 'standard') as 'standard' | 'hd',

  /** Image style setting */
  STYLE: (process.env.DALLE_STYLE || 'vivid') as 'vivid' | 'natural',

  /** Number of images to generate per request */
  IMAGE_COUNT: 1,
} as const

// Database Query Limits
export const CONTEST_QUERY_LIMITS = {
  /** Maximum partners to fetch for auto-enrollment */
  MAX_PARTNERS_FETCH: parseInt(process.env.CONTEST_MAX_PARTNERS || '10000', 10),

  /** Batch size for participant insertion */
  PARTICIPANT_BATCH_SIZE: parseInt(process.env.CONTEST_BATCH_SIZE || '500', 10),

  /** Default leaderboard results limit */
  DEFAULT_LEADERBOARD_LIMIT: 100,

  /** Maximum leaderboard entries per contest in admin view */
  MAX_LEADERBOARD_PER_CONTEST: 50,
} as const

// Contest Partner Types
export const CONTEST_PARTNER_TYPES = {
  BUSINESS_ASSOCIATE: 'business_associate',
  BUSINESS_PARTNER: 'business_partner',
  CHANNEL_PARTNER: 'channel_partner', // Not eligible for contests
} as const

// Eligible partner types for contests (excludes Channel Partners)
export const CONTEST_ELIGIBLE_PARTNER_TYPES = [
  CONTEST_PARTNER_TYPES.BUSINESS_ASSOCIATE,
  CONTEST_PARTNER_TYPES.BUSINESS_PARTNER,
] as const

// Loan Categories for Contest Targeting
export const CONTEST_LOAN_CATEGORIES = [
  { id: 'home_loan', name: 'Home Loan' },
  { id: 'personal_loan', name: 'Personal Loan' },
  { id: 'business_loan', name: 'Business Loan' },
  { id: 'vehicle_loan', name: 'Vehicle Loan' },
  { id: 'education_loan', name: 'Education Loan' },
  { id: 'gold_loan', name: 'Gold Loan' },
  { id: 'lap', name: 'Loan Against Property' },
] as const

// Indian States for Geography Targeting
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry'
] as const

// Contest Status Types
export const CONTEST_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISABLED: 'disabled',
} as const

// Contest Types
export const CONTEST_TYPES = {
  PERFORMANCE: 'performance',
  SALES: 'sales',
  ENGAGEMENT: 'engagement',
  CUSTOM: 'custom',
} as const

// Default Reward Tiers
export const DEFAULT_REWARD_TIERS = [
  { name: 'Gold', rank_range: [1, 1], reward_multiplier: 1.0, reward_amount: 100000 },
  { name: 'Silver', rank_range: [2, 2], reward_multiplier: 0.5, reward_amount: 50000 },
  { name: 'Bronze', rank_range: [3, 3], reward_multiplier: 0.25, reward_amount: 25000 },
] as const
