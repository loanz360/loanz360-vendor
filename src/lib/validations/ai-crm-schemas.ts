/**
 * AI-CRM Validation Schemas
 *
 * Enterprise-grade validation for CRO leads management module
 * SECURITY: Input validation, sanitization, and type safety
 * COMPLIANCE: OWASP A03:2021 - Injection Prevention
 */

import { z } from 'zod'
import {
  emailSchema,
  phoneSchema,
  nameSchema,
  uuidSchema,
  amountSchema,
  safeStringSchema,
  paginationSchema,
} from './api-schemas'

// =============================================================================
// LEAD STATUS & STAGE ENUMS
// =============================================================================

export const leadStatusEnum = z.enum(['active', 'follow_up', 'converted', 'dropped'])
export const leadStageEnum = z.enum(['new', 'contacted', 'qualified', 'docs_pending', 'ready_to_convert'])
export const dealStageEnum = z.enum([
  'docs_collected',
  'finalized_bank',
  'login_complete',
  'post_login_pending_cleared',
  'process_started_at_bank',
  'case_assessed_by_banker',
  'pd_complete',
  'sanctioned',
  'dropped',
  'disbursed',
])
export const dealStatusEnum = z.enum(['in_progress', 'sanctioned', 'dropped', 'disbursed'])

export const contactStatusEnum = z.enum(['new', 'contacted', 'called', 'follow_up', 'not_interested', 'positive', 'converted'])
export const interestLevelEnum = z.enum(['low', 'medium', 'high', 'very_high'])
export const urgencyLevelEnum = z.enum(['low', 'medium', 'high', 'urgent'])

export const loanTypeEnum = z.enum([
  'HOME_LOAN',
  'PERSONAL_LOAN',
  'BUSINESS_LOAN',
  'CAR_LOAN',
  'EDUCATION_LOAN',
  'GOLD_LOAN',
  'PROPERTY_LOAN',
  'LAP',
  'WORKING_CAPITAL',
  'OVERDRAFT',
])

export const employmentTypeEnum = z.enum([
  'SALARIED',
  'SELF_EMPLOYED',
  'BUSINESS_OWNER',
  'PROFESSIONAL',
  'RETIRED',
  'HOMEMAKER',
  'STUDENT',
  'OTHER',
])

// =============================================================================
// LEAD SCHEMAS
// =============================================================================

/**
 * Schema for creating a new lead
 */
export const createLeadSchema = z.object({
  // Contact reference (optional - can create lead without existing contact)
  contactId: uuidSchema.optional().nullable(),
  positiveContactId: uuidSchema.optional().nullable(),

  // Required customer information
  name: nameSchema,
  phone: phoneSchema,
  location: safeStringSchema.min(2, 'Location must be at least 2 characters').max(200),
  loan_type: loanTypeEnum,
  loan_amount: z.union([
    amountSchema.min(10000, 'Minimum loan amount is 10,000'),
    z.string().transform((val) => {
      const num = parseFloat(val.replace(/[,\s]/g, ''))
      if (isNaN(num) || num < 10000) {
        throw new Error('Invalid loan amount')
      }
      return num
    }),
  ]),
  monthly_income: z.union([
    amountSchema.min(0, 'Monthly income cannot be negative'),
    z.string().transform((val) => {
      const num = parseFloat(val.replace(/[,\s]/g, ''))
      if (isNaN(num) || num < 0) {
        throw new Error('Invalid monthly income')
      }
      return num
    }),
  ]),
  employment_type: employmentTypeEnum,
  purpose: safeStringSchema.min(3, 'Purpose must be at least 3 characters').max(500),
  urgency: urgencyLevelEnum,

  // Optional customer information
  email: emailSchema.optional().nullable(),
  alternate_phone: phoneSchema.optional().nullable(),
  company_name: safeStringSchema.max(200).optional().nullable(),
  business_type: safeStringSchema.max(100).optional().nullable(),
  notes: safeStringSchema.max(2000).optional().nullable(),

  // Internal tracking
  source: z.enum(['manual', 'import', 'website', 'referral', 'campaign']).default('manual'),
})

/**
 * Schema for updating a lead
 */
export const updateLeadSchema = z.object({
  // Status and stage updates
  status: leadStatusEnum.optional(),
  stage: leadStageEnum.optional(),

  // Customer information updates
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional().nullable(),
  alternate_phone: phoneSchema.optional().nullable(),
  location: safeStringSchema.max(200).optional(),
  loan_type: loanTypeEnum.optional(),
  loan_amount: z.union([
    amountSchema.min(10000),
    z.string().transform((val) => parseFloat(val.replace(/[,\s]/g, ''))),
  ]).optional(),
  monthly_income: z.union([
    amountSchema.min(0),
    z.string().transform((val) => parseFloat(val.replace(/[,\s]/g, ''))),
  ]).optional(),
  employment_type: employmentTypeEnum.optional(),
  company_name: safeStringSchema.max(200).optional().nullable(),
  business_type: safeStringSchema.max(100).optional().nullable(),
  purpose: safeStringSchema.max(500).optional(),
  urgency: urgencyLevelEnum.optional(),

  // Follow-up tracking
  next_follow_up_date: z.string().datetime().optional().nullable(),
  follow_up_notes: safeStringSchema.max(1000).optional().nullable(),

  // Notes
  notes: safeStringSchema.max(2000).optional().nullable(),
}).strict() // Prevent additional fields

/**
 * Schema for converting lead to deal
 */
export const convertLeadToDealSchema = z.object({
  leadId: uuidSchema,
  bdeId: uuidSchema.optional(), // If not provided, auto-assign
  conversionNotes: safeStringSchema.max(1000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
})

/**
 * Schema for lead status update
 */
export const updateLeadStatusSchema = z.object({
  status: leadStatusEnum,
  stage: leadStageEnum.optional(),
  reason: safeStringSchema.max(500).optional(),
  next_follow_up_date: z.string().datetime().optional().nullable(),
})

// =============================================================================
// CONTACT SCHEMAS
// =============================================================================

/**
 * Schema for updating contact call information
 */
export const updateContactCallSchema = z.object({
  contactId: uuidSchema,
  callDuration: z.number().int().min(0).max(7200), // Max 2 hours
  callOutcome: z.enum(['connected', 'not_answered', 'busy', 'wrong_number', 'callback_requested']),
  notes: safeStringSchema.max(1000).optional(),
  nextFollowUp: z.string().datetime().optional().nullable(),
  interestLevel: interestLevelEnum.optional(),
})

/**
 * Schema for moving contact to positive
 */
export const moveToPositiveSchema = z.object({
  contactId: uuidSchema,
  interestLevel: interestLevelEnum,
  aiRating: z.number().min(1).max(10).optional(),
  aiSummary: safeStringSchema.max(2000).optional(),
  keyPoints: z.array(safeStringSchema.max(200)).max(10).optional(),
})

/**
 * Schema for converting positive contact to lead
 */
export const convertToLeadSchema = z.object({
  positiveContactId: uuidSchema,
  loan_type: loanTypeEnum,
  loan_amount: z.union([
    amountSchema.min(10000),
    z.string().transform((val) => parseFloat(val.replace(/[,\s]/g, ''))),
  ]),
  purpose: safeStringSchema.max(500),
  urgency: urgencyLevelEnum.default('medium'),
  notes: safeStringSchema.max(2000).optional(),
})

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

export const documentCategoryEnum = z.enum([
  'identity_proof',
  'address_proof',
  'income_proof',
  'bank_statement',
  'property_document',
  'business_document',
  'other',
])

export const uploadDocumentSchema = z.object({
  entityType: z.enum(['lead', 'deal', 'contact']),
  entityId: uuidSchema,
  fileName: z.string()
    .min(1, 'Filename required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._\-\s]+$/, 'Invalid filename characters'),
  fileType: z.enum(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  category: documentCategoryEnum.default('other'),
  description: safeStringSchema.max(500).optional(),
})

// =============================================================================
// NOTE SCHEMAS
// =============================================================================

export const noteTypeEnum = z.enum(['manual_note', 'system_event', 'ai_transcript'])

export const addNoteSchema = z.object({
  entityType: z.enum(['lead', 'deal', 'contact', 'positive_contact']),
  entityId: uuidSchema,
  content: safeStringSchema.min(1, 'Note content required').max(5000),
  noteType: noteTypeEnum.default('manual_note'),
})

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

/**
 * Schema for leads list query parameters
 */
export const leadsQuerySchema = paginationSchema.extend({
  status: leadStatusEnum.optional(),
  stage: leadStageEnum.optional(),
  loan_type: loanTypeEnum.optional(),
  search: safeStringSchema.max(100).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  min_amount: z.number().positive().optional(),
  max_amount: z.number().positive().optional(),
})

/**
 * Schema for contacts list query parameters
 */
export const contactsQuerySchema = paginationSchema.extend({
  status: contactStatusEnum.optional(),
  search: safeStringSchema.max(100).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
})

/**
 * Schema for deals list query parameters
 */
export const dealsQuerySchema = paginationSchema.extend({
  stage: dealStageEnum.optional(),
  status: dealStatusEnum.optional(),
  search: safeStringSchema.max(100).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
})

// =============================================================================
// BULK OPERATION SCHEMAS
// =============================================================================

/**
 * Schema for bulk status update
 */
export const bulkUpdateStatusSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID required').max(100, 'Maximum 100 items per batch'),
  status: leadStatusEnum,
  reason: safeStringSchema.max(500).optional(),
})

/**
 * Schema for bulk assignment
 */
export const bulkAssignSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
  assigneeId: uuidSchema,
  reason: safeStringSchema.max(500).optional(),
})

/**
 * Schema for data export
 */
export const exportDataSchema = z.object({
  entityType: z.enum(['leads', 'contacts', 'positive_contacts', 'deals']),
  format: z.enum(['csv', 'xlsx', 'pdf']),
  filters: z.object({
    status: z.string().optional(),
    stage: z.string().optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
  }).optional(),
  columns: z.array(z.string().max(50)).optional(),
})

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

export const analyticsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).default('month'),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  group_by: z.enum(['day', 'week', 'month']).optional(),
})

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type ConvertLeadToDealInput = z.infer<typeof convertLeadToDealSchema>
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>
export type UpdateContactCallInput = z.infer<typeof updateContactCallSchema>
export type MoveToPositiveInput = z.infer<typeof moveToPositiveSchema>
export type ConvertToLeadInput = z.infer<typeof convertToLeadSchema>
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type AddNoteInput = z.infer<typeof addNoteSchema>
export type LeadsQueryInput = z.infer<typeof leadsQuerySchema>
export type ContactsQueryInput = z.infer<typeof contactsQuerySchema>
export type DealsQueryInput = z.infer<typeof dealsQuerySchema>
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>
export type ExportDataInput = z.infer<typeof exportDataSchema>
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>

export type LeadStatus = z.infer<typeof leadStatusEnum>
export type LeadStage = z.infer<typeof leadStageEnum>
export type DealStage = z.infer<typeof dealStageEnum>
export type ContactStatus = z.infer<typeof contactStatusEnum>
export type InterestLevel = z.infer<typeof interestLevelEnum>
export type UrgencyLevel = z.infer<typeof urgencyLevelEnum>
export type LoanType = z.infer<typeof loanTypeEnum>
export type EmploymentType = z.infer<typeof employmentTypeEnum>
export type DocumentCategory = z.infer<typeof documentCategoryEnum>
export type NoteType = z.infer<typeof noteTypeEnum>
