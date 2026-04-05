export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Users table for authentication and basic info
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url?: string
          role: UserRole
          sub_role?: string
          status: UserStatus
          created_at: string
          updated_at: string
          last_login?: string
          email_verified: boolean
          mobile_verified: boolean
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          avatar_url?: string
          role: UserRole
          sub_role?: string
          status?: UserStatus
          created_at?: string
          updated_at?: string
          last_login?: string
          email_verified?: boolean
          mobile_verified?: boolean
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string
          role?: UserRole
          sub_role?: string
          status?: UserStatus
          updated_at?: string
          last_login?: string
          email_verified?: boolean
          mobile_verified?: boolean
        }
      }

      // Profiles table for extended user information
      profiles: {
        Row: {
          id: string
          user_id: string
          email?: string
          full_name?: string
          role?: string
          status?: string
          account_status?: string
          avatar_url?: string
          mobile?: string
          date_of_birth?: string
          gender?: string
          address_current?: Json
          address_permanent?: Json
          pan_number?: string
          aadhaar_number?: string
          employee_id?: string
          partner_id?: string
          customer_id?: string
          vendor_id?: string
          location?: string
          geography?: string
          department?: string
          designation?: string
          created_at: string
          updated_at: string
          last_login?: string
          password_changed_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          email?: string
          full_name?: string
          role?: string
          status?: string
          account_status?: string
          avatar_url?: string
          mobile?: string
          date_of_birth?: string
          gender?: string
          address_current?: Json
          address_permanent?: Json
          pan_number?: string
          aadhaar_number?: string
          employee_id?: string
          partner_id?: string
          customer_id?: string
          vendor_id?: string
          location?: string
          geography?: string
          department?: string
          designation?: string
          created_at?: string
          updated_at?: string
          last_login?: string
          password_changed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          full_name?: string
          role?: string
          status?: string
          account_status?: string
          avatar_url?: string
          mobile?: string
          date_of_birth?: string
          gender?: string
          address_current?: Json
          address_permanent?: Json
          pan_number?: string
          aadhaar_number?: string
          employee_id?: string
          partner_id?: string
          customer_id?: string
          vendor_id?: string
          location?: string
          geography?: string
          department?: string
          designation?: string
          updated_at?: string
          last_login?: string
          password_changed_at?: string
        }
      }

      // Partners table
      partners: {
        Row: {
          id: string
          user_id: string
          partner_type: PartnerType
          business_name?: string
          registration_number?: string
          gst_number?: string
          bank_details?: Json
          commission_structure?: Json
          status: PartnerStatus
          performance_metrics?: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          partner_type: PartnerType
          business_name?: string
          registration_number?: string
          gst_number?: string
          bank_details?: Json
          commission_structure?: Json
          status?: PartnerStatus
          performance_metrics?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          partner_type?: PartnerType
          business_name?: string
          registration_number?: string
          gst_number?: string
          bank_details?: Json
          commission_structure?: Json
          status?: PartnerStatus
          performance_metrics?: Json
          updated_at?: string
        }
      }

      // Customers table
      customers: {
        Row: {
          id: string
          user_id: string
          customer_category: CustomerCategory
          income_details?: Json
          employment_details?: Json
          financial_information?: Json
          kyc_status: KYCStatus
          credit_score?: number
          loan_eligibility?: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          customer_category: CustomerCategory
          income_details?: Json
          employment_details?: Json
          financial_information?: Json
          kyc_status?: KYCStatus
          credit_score?: number
          loan_eligibility?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_category?: CustomerCategory
          income_details?: Json
          employment_details?: Json
          financial_information?: Json
          kyc_status?: KYCStatus
          credit_score?: number
          loan_eligibility?: Json
          updated_at?: string
        }
      }

      // Employees table
      employees: {
        Row: {
          id: string
          user_id: string
          employee_role: EmployeeRole
          manager_id?: string
          performance_metrics?: Json
          target_metrics?: Json
          incentive_structure?: Json
          access_permissions?: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          employee_role: EmployeeRole
          manager_id?: string
          performance_metrics?: Json
          target_metrics?: Json
          incentive_structure?: Json
          access_permissions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          employee_role?: EmployeeRole
          manager_id?: string
          performance_metrics?: Json
          target_metrics?: Json
          incentive_structure?: Json
          access_permissions?: Json
          updated_at?: string
        }
      }

      // Loan Applications table
      loan_applications: {
        Row: {
          id: string
          customer_id: string
          partner_id?: string
          employee_id?: string
          loan_type: LoanType
          loan_amount: number
          loan_purpose: string
          application_status: ApplicationStatus
          documents?: Json
          bank_details?: Json
          approval_details?: Json
          disbursement_details?: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          partner_id?: string
          employee_id?: string
          loan_type: LoanType
          loan_amount: number
          loan_purpose: string
          application_status?: ApplicationStatus
          documents?: Json
          bank_details?: Json
          approval_details?: Json
          disbursement_details?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          loan_type?: LoanType
          loan_amount?: number
          loan_purpose?: string
          application_status?: ApplicationStatus
          documents?: Json
          bank_details?: Json
          approval_details?: Json
          disbursement_details?: Json
          updated_at?: string
        }
      }

      // Payouts table
      payouts: {
        Row: {
          id: string
          partner_id: string
          application_id: string
          payout_amount: number
          payout_type: PayoutType
          payout_status: PayoutStatus
          bank_details?: Json
          reconciliation_data?: Json
          approval_details?: Json
          processed_at?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          application_id: string
          payout_amount: number
          payout_type: PayoutType
          payout_status?: PayoutStatus
          bank_details?: Json
          reconciliation_data?: Json
          approval_details?: Json
          processed_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          payout_amount?: number
          payout_type?: PayoutType
          payout_status?: PayoutStatus
          bank_details?: Json
          reconciliation_data?: Json
          approval_details?: Json
          processed_at?: string
          updated_at?: string
        }
      }

      // Banners table
      banners: {
        Row: {
          id: string
          title: string
          image_url: string
          content?: string
          target_audience: UserRole[]
          status: BannerStatus
          start_date: string
          end_date: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          image_url: string
          content?: string
          target_audience: UserRole[]
          status?: BannerStatus
          start_date: string
          end_date: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          image_url?: string
          content?: string
          target_audience?: UserRole[]
          status?: BannerStatus
          start_date?: string
          end_date?: string
          updated_at?: string
        }
      }

      // Notifications table
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: NotificationType
          status: NotificationStatus
          metadata?: Json
          created_at: string
          read_at?: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: NotificationType
          status?: NotificationStatus
          metadata?: Json
          created_at?: string
          read_at?: string
        }
        Update: {
          status?: NotificationStatus
          read_at?: string
        }
      }

      // Audit Logs table
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          resource_type: string
          resource_id: string
          old_values?: Json
          new_values?: Json
          ip_address?: string
          user_agent?: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          resource_type: string
          resource_id: string
          old_values?: Json
          new_values?: Json
          ip_address?: string
          user_agent?: string
          created_at?: string
        }
        Update: never
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      user_status: UserStatus
      partner_type: PartnerType
      partner_status: PartnerStatus
      customer_category: CustomerCategory
      kyc_status: KYCStatus
      employee_role: EmployeeRole
      loan_type: LoanType
      application_status: ApplicationStatus
      payout_type: PayoutType
      payout_status: PayoutStatus
      banner_status: BannerStatus
      notification_type: NotificationType
      notification_status: NotificationStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Enum types
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER' | 'VENDOR'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'

export type PartnerType = 'BUSINESS_ASSOCIATE' | 'BUSINESS_PARTNER' | 'CHANNEL_PARTNER'

export type PartnerStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED'

export type CustomerCategory =
  | 'INDIVIDUAL' | 'SALARIED' | 'CORPORATE' | 'PARTNERSHIPS'
  | 'PRODUCTION_COMPANY' | 'PUBLIC_UTILITY_COMPANY' | 'NRI'
  | 'LLP' | 'HUF' | 'AGRICULTURAL' | 'PURE_RENTAL'
  | 'REAL_ESTATE' | 'FREELANCERS' | 'CHARTERED_ACCOUNTANT'
  | 'DOCTORS' | 'COMPANY_SECRETARY' | 'OTHERS'

export type KYCStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export type EmployeeRole =
  | 'CRO' | 'CUSTOMER_RELATIONSHIP_MANAGER' | 'CUSTOMER_RELATIONSHIP_OFFICER'
  | 'BUSINESS_DEVELOPMENT_EXECUTIVE' | 'BUSINESS_DEVELOPMENT_MANAGER'
  | 'ACCOUNTS_TEAM' | 'ACCOUNTS_EXECUTIVE' | 'ACCOUNTS_MANAGER'
  | 'FINANCE_TEAM' | 'FINANCE_EXECUTIVE'
  | 'CHANNEL_PARTNER_MANAGER' | 'CHANNEL_PARTNER_EXECUTIVE'
  | 'DIGITAL_SALES' | 'DIRECT_SALES_EXECUTIVE' | 'DIRECT_SALES_MANAGER'
  | 'TELE_SALES' | 'HR_TEAM' | 'ADMIN'

export type LoanType =
  | 'HOME_LOAN' | 'PERSONAL_LOAN' | 'BUSINESS_LOAN' | 'CAR_LOAN'
  | 'EDUCATION_LOAN' | 'GOLD_LOAN' | 'PROPERTY_LOAN' | 'OTHERS'

export type ApplicationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
  | 'REJECTED' | 'DISBURSED' | 'CLOSED'

export type PayoutType = 'COMMISSION' | 'INCENTIVE' | 'BONUS' | 'REFUND'

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'FAILED'

export type BannerStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'DISABLED'

export type NotificationType =
  | 'APPLICATION_UPDATE' | 'PAYOUT_UPDATE' | 'SYSTEM_ALERT'
  | 'PROMOTION' | 'REMINDER' | 'WARNING'

export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED'