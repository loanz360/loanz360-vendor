// ============================================================================
// HR Module Shared Types
// Centralized type definitions for all HR sub-role pages
// ============================================================================

// ---------- Shared Enums & Unions ----------

export type HRStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'paid'

export type ReviewType = 'quarterly' | 'annual' | 'probation' | 'promotion'
export type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'acknowledged'

export type PIPStatus = 'active' | 'completed' | 'extended' | 'terminated' | 'successful'
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'missed'

export type SettlementStatus = 'pending' | 'processing' | 'approved' | 'paid' | 'disputed'
export type ExitType = 'resignation' | 'termination' | 'retirement' | 'contract_end'

export type ResignationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'on_hold'
export type ReasonCategory = 'better_opportunity' | 'personal' | 'relocation' | 'career_change' | 'health' | 'higher_studies' | 'other'
export type ClearanceStatus = 'not_started' | 'in_progress' | 'completed'

export type DocumentType = 'contract' | 'id_proof' | 'education' | 'offer_letter' | 'policy' | 'form' | 'other'
export type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'expired'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened' | 'on_hold'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

// ---------- Performance Reviews ----------

export interface HRReview {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  reviewer_id: string
  reviewer_name: string
  review_period: string
  review_type: ReviewType
  status: ReviewStatus
  overall_rating: number | null
  goals_met: number | null
  strengths: string[] | null
  areas_for_improvement: string[] | null
  comments: string | null
  employee_feedback: string | null
  created_at: string
  completed_at: string | null
}

export interface HRReviewStats {
  totalReviews: number
  pendingReviews: number
  completedReviews: number
  averageRating: number
}

// ---------- PIP (Performance Improvement Plan) ----------

export interface PIPRecord {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  department: string
  manager_id: string
  manager_name: string
  start_date: string
  end_date: string
  status: PIPStatus
  reason: string
  objectives: string[]
  milestones: PIPMilestone[]
  current_progress: number
  created_at: string
  updated_at: string
}

export interface PIPMilestone {
  id: string
  title: string
  description: string
  due_date: string
  status: MilestoneStatus
  notes: string | null
}

export interface PIPStats {
  total: number
  active: number
  completed: number
  successful: number
  terminated: number
}

// ---------- Final Settlement ----------

export interface Settlement {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  department: string
  designation: string
  date_of_joining: string
  last_working_day: string
  resignation_date: string
  exit_type: ExitType
  status: SettlementStatus
  // Earnings
  pending_salary: number
  leave_encashment: number
  bonus: number
  gratuity: number
  notice_period_recovery: number
  other_earnings: number
  // Deductions
  advance_recovery: number
  loan_recovery: number
  asset_recovery: number
  tax_deduction: number
  other_deductions: number
  // Totals
  gross_amount: number
  total_deductions: number
  net_payable: number
  payment_date: string | null
  payment_mode: string | null
  payment_reference: string | null
  hr_remarks: string | null
  finance_remarks: string | null
  created_at: string
  updated_at: string
}

export interface SettlementStats {
  total: number
  pending: number
  processing: number
  approved: number
  paid: number
  totalAmount: number
}

// ---------- Resignations ----------

export interface Resignation {
  id: string
  employee_id: string
  employee_name: string
  employee_email: string
  employee_phone: string
  department: string
  designation: string
  joining_date: string
  submission_date: string
  last_working_day: string
  notice_period_days: number
  notice_period_served: number
  status: ResignationStatus
  reason: string
  reason_category: ReasonCategory
  detailed_feedback?: string
  manager_name?: string
  manager_id?: string
  manager_remarks?: string
  hr_remarks?: string
  exit_interview_scheduled?: boolean
  exit_interview_date?: string
  exit_interview_completed?: boolean
  clearance_status: ClearanceStatus
  created_at: string
  updated_at: string
}

export interface ResignationStats {
  total_resignations: number
  pending_approval: number
  approved_this_month: number
  in_notice_period: number
  attrition_rate: number
  avg_tenure_months: number
}

// ---------- Documents ----------

export interface HRDocument {
  id: string
  name: string
  type: DocumentType
  category: string
  employee_id: string | null
  employee_name: string | null
  file_url: string
  file_size: number
  file_type: string
  status: DocumentStatus
  uploaded_by: string
  uploaded_at: string
  verified_by: string | null
  verified_at: string | null
  expiry_date: string | null
  is_confidential: boolean
  description: string | null
}

export interface DocumentCategory {
  id: string
  name: string
  count: number
  icon: string
}

export interface DocumentStats {
  totalDocuments: number
  pendingVerification: number
  verified: number
  expired: number
}

// ---------- Support Tickets ----------

export interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string
  is_anonymous: boolean
  is_confidential: boolean
  created_at: string
  updated_at: string
  employee: {
    full_name: string
    email: string
  }
  messages: Array<{ count: number }>
}

export interface TicketMessage {
  id: string
  sender_type: string
  sender_name: string
  message: string
  created_at: string
  is_read: boolean
}

export interface TicketAttachment {
  id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_by_type: string
  created_at: string
}

export interface TicketActivityLog {
  id: string
  action_type: string
  action_by_name: string
  description: string
  created_at: string
}

export interface TicketCounts {
  open: number
  inProgress: number
  resolved: number
  closed: number
  total: number
  urgent: number
}

// ---------- Dashboard ----------

export interface HRDashboardStats {
  totalEmployees: number
  activeEmployees: number
  newHiresThisMonth: number
  resignationsThisMonth: number
  pendingLeaveRequests: number
  pendingApprovals: number
  presentToday: number
  absentToday: number
  onLeaveToday: number
  upcomingBirthdays: number
  pendingOnboarding: number
  pendingReviews: number
  totalPayrollThisMonth: number
  pendingSettlements: number
}

export interface RecentActivity {
  id: string
  type: 'leave' | 'onboarding' | 'resignation' | 'attendance' | 'payroll'
  title: string
  description: string
  timestamp: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
}

export interface UpcomingEvent {
  id: string
  type: 'birthday' | 'anniversary' | 'holiday' | 'review'
  title: string
  date: string
  employeeName?: string
}

// ---------- Payroll ----------

export interface PayrollRun {
  id: string
  month: number
  year: number
  period_start_date: string
  period_end_date: string
  status: string
  total_employees: number
  total_gross_salary: number
  total_deductions: number
  total_net_salary: number
  total_employer_contribution: number
  created_at: string
  payment_date?: string
}

export interface EmployeeSalary {
  id: string
  user_id: string
  basic_salary: number
  gross_salary: number
  net_salary: number
  employee_name?: string
  department?: string
  designation?: string
}

// ---------- Form State Types ----------

export interface CreateReviewForm {
  employee_id: string
  review_type: ReviewType | ''
  review_period: string
  comments: string
}

export interface CreatePIPForm {
  employee_id: string
  start_date: string
  end_date: string
  reason: string
  objectives: string
  manager_id: string
}

export interface CreateSettlementForm {
  employee_id: string
  exit_type: ExitType | ''
  last_working_day: string
  hr_remarks: string
}

export interface PaymentDetailsForm {
  payment_mode: string
  payment_reference: string
  payment_date: string
}
