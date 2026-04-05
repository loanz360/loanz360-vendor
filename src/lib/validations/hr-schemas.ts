// ============================================================================
// HR Module Zod Validation Schemas
// Server-side and client-side validation for HR API endpoints
// ============================================================================

import { z } from 'zod'

// ---------- Shared / Reusable ----------

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
})

// ---------- Performance Reviews ----------

export const createReviewSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  review_type: z.enum(['quarterly', 'annual', 'probation', 'promotion'], {
    required_error: 'Review type is required',
  }),
  review_period: z.string().min(1, 'Review period is required').max(100),
  comments: z.string().max(5000).optional(),
})

export const updateReviewSchema = z.object({
  review_id: z.string().uuid('Invalid review ID'),
  overall_rating: z.number().min(1).max(5).optional(),
  goals_met: z.number().min(0).max(100).optional(),
  strengths: z.array(z.string().max(500)).max(10).optional(),
  areas_for_improvement: z.array(z.string().max(500)).max(10).optional(),
  comments: z.string().max(5000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'acknowledged']).optional(),
})

// ---------- PIP ----------

export const createPIPSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  reason: z.string().min(1, 'Reason is required').max(5000),
  objectives: z.string().min(1, 'Objectives are required').max(5000),
  manager_id: z.string().uuid('Invalid manager ID').optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'End date must be after start date', path: ['end_date'] }
)

export const updatePIPSchema = z.object({
  pip_id: z.string().uuid('Invalid PIP ID'),
  status: z.enum(['active', 'completed', 'extended', 'terminated', 'successful']).optional(),
  current_progress: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
})

// ---------- Final Settlement ----------

export const createSettlementSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  exit_type: z.enum(['resignation', 'termination', 'retirement', 'contract_end'], {
    required_error: 'Exit type is required',
  }),
  last_working_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  hr_remarks: z.string().max(5000).optional(),
})

export const settlementActionSchema = z.object({
  settlement_id: z.string().uuid('Invalid settlement ID'),
  action: z.enum(['PROCESS', 'APPROVE', 'MARK_PAID', 'DISPUTE']),
  payment_mode: z.string().max(50).optional(),
  payment_method: z.string().max(50).optional(),
  payment_reference: z.string().max(200).optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remarks: z.string().max(5000).optional(),
  approval_notes: z.string().max(5000).optional(),
})

// ---------- Resignations ----------

export const resignationActionSchema = z.object({
  resignation_id: z.string().uuid('Invalid resignation ID'),
  action: z.enum(['APPROVE', 'REJECT', 'HOLD', 'MAKE_COUNTEROFFER', 'MARK_DEPARTMENT_CLEARED']),
  hr_comments: z.string().max(5000).optional(),
  counteroffer_details: z.string().max(5000).optional(),
  counteroffer_amount: z.number().positive().optional(),
  counteroffer_other_benefits: z.string().max(5000).optional(),
  department: z.string().max(50).optional(),
  cleared_notes: z.string().max(5000).optional(),
})

// ---------- Documents ----------

export const documentUploadSchema = z.object({
  name: z.string().min(1, 'Document name is required').max(200),
  type: z.enum(['contract', 'id_proof', 'education', 'offer_letter', 'policy', 'form', 'other'], {
    required_error: 'Document type is required',
  }),
  category: z.string().min(1, 'Category is required').max(100),
  employee_id: z.string().uuid().optional(),
  description: z.string().max(1000).optional(),
  is_confidential: z.boolean().default(false),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const documentVerifySchema = z.object({
  document_id: z.string().uuid('Invalid document ID'),
  action: z.enum(['verify', 'reject']),
  remarks: z.string().max(1000).optional(),
})

// ---------- Support Tickets ----------

export const ticketNoteSchema = z.object({
  ticket_id: z.string().uuid('Invalid ticket ID'),
  note: z.string().min(1, 'Note cannot be empty').max(5000),
})

export const ticketStatusSchema = z.object({
  ticket_id: z.string().uuid('Invalid ticket ID'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'reopened', 'on_hold']),
  remarks: z.string().max(1000).optional(),
})

// ---------- Employee Management ----------

export const updateEmployeeSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().min(10).max(20).optional(),
  department: z.string().max(100).optional(),
  designation: z.string().max(150).optional(),
  status: z.enum(['active', 'inactive', 'resigned', 'terminated']).optional(),
  role: z.string().max(50).optional(),
  subrole: z.string().max(100).optional().nullable(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  reporting_manager_id: z.string().uuid().optional().nullable(),
})

export const createEmployeeSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  work_email: z.string().email().max(255).optional(),
  email: z.string().email().max(255).optional(),
  mobile_number: z.string().min(10).max(20).optional(),
  phone: z.string().min(10).max(20).optional(),
  department_id: z.string().uuid().optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  sub_role: z.string().max(100).optional().nullable(),
  role: z.string().max(50).optional(),
  subrole: z.string().max(100).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  employee_status: z.string().max(50).optional(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  emergency_contact_name: z.string().max(200).optional().nullable(),
  emergency_contact_number: z.string().max(20).optional().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  profile_photo_url: z.string().url().max(1000).optional().nullable(),
  reporting_manager_id: z.string().uuid().optional().nullable(),
  office_timing_id: z.string().uuid().optional().nullable(),
})

export const deleteEmployeeSchema = z.object({
  reason: z.string().max(1000).optional(),
})

// ---------- Leave Approval ----------

export const leaveApprovalSchema = z.object({
  id: z.string().uuid('Invalid leave request ID'),
  action: z.enum(['approve', 'reject']),
  remarks: z.string().max(1000).optional(),
})

// ---------- GET Query Param Schemas ----------

export const payrollRunsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.string().max(50).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const payslipsQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  payroll_run_id: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
})

export const employeeSalaryQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  active_only: z.enum(['true', 'false']).optional(),
})

export const investmentProofsQuerySchema = z.object({
  declaration_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  financial_year: z.string().max(20).optional(),
  status: z.string().max(50).optional(),
})

// ---------- Type exports for frontend use ----------

export type CreateReviewInput = z.infer<typeof createReviewSchema>
export type CreatePIPInput = z.infer<typeof createPIPSchema>
export type SettlementActionInput = z.infer<typeof settlementActionSchema>
export type ResignationActionInput = z.infer<typeof resignationActionSchema>
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type DeleteEmployeeInput = z.infer<typeof deleteEmployeeSchema>
export type LeaveApprovalInput = z.infer<typeof leaveApprovalSchema>
