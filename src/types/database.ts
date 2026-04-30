// Core database types for LOANZ 360

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'EMPLOYEE' | 'PARTNER' | 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN' | 'VENDOR';
  sub_role?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  department?: string;
  designation?: string;
  reporting_to?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  loan_type: string;
  loan_amount?: number;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  source?: string;
  assigned_to?: string;
  city?: string;
  pincode?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LoanApplication {
  id: string;
  applicant_id: string;
  loan_type: string;
  loan_amount: number;
  tenure_months: number;
  interest_rate?: number;
  emi_amount?: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'closed';
  purpose?: string;
  partner_id?: string;
  employee_id?: string;
  documents?: DocumentMeta[];
  created_at: string;
  updated_at: string;
}

export interface DocumentMeta {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  uploaded_at: string;
  verified?: boolean;
}

export interface Commission {
  id: string;
  loan_id: string;
  partner_id: string;
  amount: number;
  percentage?: number;
  type: 'upfront' | 'trail' | 'bonus' | 'override';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  approved_by?: string;
  notes?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday' | 'weekend';
  location?: { latitude: number; longitude: number; name?: string };
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  is_half_day: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  read_at?: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}
