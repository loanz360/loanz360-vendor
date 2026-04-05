-- LOANZ 360 Database Schema Migration
-- Initial schema setup for enterprise financial application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set JWT secret for the database
-- SECURITY FIX: Hardcoded JWT secret removed (see deployment guide below)

-- Create custom types/enums
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'PARTNER',
  'EMPLOYEE',
  'CUSTOMER',
  'VENDOR'
);

CREATE TYPE user_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION'
);

CREATE TYPE partner_type AS ENUM (
  'BUSINESS_ASSOCIATE',
  'BUSINESS_PARTNER',
  'CHANNEL_PARTNER'
);

CREATE TYPE partner_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'PENDING_APPROVAL',
  'SUSPENDED'
);

CREATE TYPE customer_category AS ENUM (
  'INDIVIDUAL',
  'SALARIED',
  'CORPORATE',
  'PARTNERSHIPS',
  'PRODUCTION_COMPANY',
  'PUBLIC_UTILITY_COMPANY',
  'NRI',
  'LLP',
  'HUF',
  'AGRICULTURAL',
  'PURE_RENTAL',
  'REAL_ESTATE',
  'FREELANCERS',
  'CHARTERED_ACCOUNTANT',
  'DOCTORS',
  'COMPANY_SECRETARY',
  'OTHERS'
);

CREATE TYPE kyc_status AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE employee_role AS ENUM (
  'CRO',
  'CUSTOMER_RELATIONSHIP_MANAGER',
  'BUSINESS_DEVELOPMENT_MANAGER',
  'ACCOUNTS_TEAM',
  'FINANCE_TEAM',
  'CHANNEL_PARTNER_MANAGER',
  'CHANNEL_PARTNER_EXECUTIVE',
  'DIGITAL_SALES',
  'HR_TEAM',
  'ADMIN'
);

CREATE TYPE loan_type AS ENUM (
  'HOME_LOAN',
  'PERSONAL_LOAN',
  'BUSINESS_LOAN',
  'CAR_LOAN',
  'EDUCATION_LOAN',
  'GOLD_LOAN',
  'PROPERTY_LOAN',
  'OTHERS'
);

CREATE TYPE application_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'DISBURSED',
  'CLOSED'
);

CREATE TYPE payout_type AS ENUM (
  'COMMISSION',
  'INCENTIVE',
  'BONUS',
  'REFUND'
);

CREATE TYPE payout_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PROCESSED',
  'FAILED'
);

CREATE TYPE banner_status AS ENUM (
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'DISABLED'
);

CREATE TYPE notification_type AS ENUM (
  'APPLICATION_UPDATE',
  'PAYOUT_UPDATE',
  'SYSTEM_ALERT',
  'PROMOTION',
  'REMINDER',
  'WARNING'
);

CREATE TYPE notification_status AS ENUM (
  'UNREAD',
  'READ',
  'ARCHIVED'
);

-- Create tables

-- 1. Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL,
  sub_role TEXT,
  status user_status DEFAULT 'PENDING_VERIFICATION',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT FALSE,
  mobile_verified BOOLEAN DEFAULT FALSE,

  CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- 2. Profiles table (extended user information)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mobile TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  address_current JSONB,
  address_permanent JSONB,
  pan_number TEXT,
  aadhaar_number TEXT,
  employee_id TEXT UNIQUE,
  partner_id TEXT UNIQUE,
  customer_id TEXT UNIQUE,
  vendor_id TEXT UNIQUE,
  location TEXT,
  geography TEXT,
  department TEXT,
  designation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT profiles_mobile_format CHECK (mobile IS NULL OR mobile ~ '^[6-9][0-9]{9}$'),
  CONSTRAINT profiles_pan_format CHECK (pan_number IS NULL OR pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'),
  CONSTRAINT profiles_aadhaar_format CHECK (aadhaar_number IS NULL OR aadhaar_number ~ '^[0-9]{12}$'),
  CONSTRAINT profiles_user_id_unique UNIQUE (user_id)
);

-- 3. Partners table
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_type partner_type NOT NULL,
  business_name TEXT,
  registration_number TEXT,
  gst_number TEXT,
  bank_details JSONB,
  commission_structure JSONB,
  status partner_status DEFAULT 'PENDING_APPROVAL',
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT partners_gst_format CHECK (
    gst_number IS NULL OR
    gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
  ),
  CONSTRAINT partners_user_id_unique UNIQUE (user_id)
);

-- 4. Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_category customer_category NOT NULL,
  income_details JSONB DEFAULT '{}',
  employment_details JSONB DEFAULT '{}',
  financial_information JSONB DEFAULT '{}',
  kyc_status kyc_status DEFAULT 'PENDING',
  credit_score INTEGER CHECK (credit_score >= 300 AND credit_score <= 850),
  loan_eligibility JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT customers_user_id_unique UNIQUE (user_id)
);

-- 5. Employees table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_role employee_role NOT NULL,
  manager_id UUID REFERENCES public.employees(id),
  performance_metrics JSONB DEFAULT '{}',
  target_metrics JSONB DEFAULT '{}',
  incentive_structure JSONB DEFAULT '{}',
  access_permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT employees_user_id_unique UNIQUE (user_id)
);

-- 6. Vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('Collection', 'Auction', 'Service')),
  company_name TEXT NOT NULL,
  registration_number TEXT,
  gst_number TEXT,
  service_areas TEXT[] DEFAULT '{}',
  specializations TEXT[] DEFAULT '{}',
  status user_status DEFAULT 'PENDING_VERIFICATION',
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT vendors_user_id_unique UNIQUE (user_id)
);

-- 7. Loan Applications table
CREATE TABLE IF NOT EXISTS public.loan_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  partner_id UUID REFERENCES public.partners(id),
  employee_id UUID REFERENCES public.employees(id),
  loan_type loan_type NOT NULL,
  loan_amount DECIMAL(15,2) NOT NULL CHECK (loan_amount > 0),
  loan_purpose TEXT NOT NULL,
  application_status application_status DEFAULT 'DRAFT',
  documents JSONB DEFAULT '{}',
  bank_details JSONB,
  approval_details JSONB,
  disbursement_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT loan_applications_amount_positive CHECK (loan_amount > 0)
);

-- 8. Payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES public.partners(id),
  application_id UUID REFERENCES public.loan_applications(id),
  payout_amount DECIMAL(15,2) NOT NULL CHECK (payout_amount > 0),
  payout_type payout_type NOT NULL,
  payout_status payout_status DEFAULT 'PENDING',
  bank_details JSONB,
  reconciliation_data JSONB,
  approval_details JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT payouts_amount_positive CHECK (payout_amount > 0)
);

-- 9. Banners table
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  content TEXT,
  target_audience user_role[] DEFAULT '{}',
  status banner_status DEFAULT 'DRAFT',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT banners_date_order CHECK (start_date < end_date)
);

-- 10. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL,
  status notification_status DEFAULT 'UNREAD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- 11. Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Admin Permissions table
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  granted_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT admin_permissions_unique UNIQUE (admin_id, module_name)
);

-- 13. Properties table (for auction properties)
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT NOT NULL CHECK (property_type IN ('Residential', 'Commercial', 'Agricultural')),
  location TEXT NOT NULL,
  area_sqft DECIMAL(10,2),
  estimated_value DECIMAL(15,2) CHECK (estimated_value > 0),
  auction_date TIMESTAMPTZ,
  loan_amount DECIMAL(15,2),
  bank_name TEXT,
  images TEXT[] DEFAULT '{}',
  documents JSONB DEFAULT '{}',
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'SOLD')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Incentives table
CREATE TABLE IF NOT EXISTS public.incentives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  target_role employee_role NOT NULL,
  criteria JSONB DEFAULT '{}',
  reward_structure JSONB DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status banner_status DEFAULT 'DRAFT',
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT incentives_date_order CHECK (start_date < end_date)
);

-- 15. Contests table
CREATE TABLE IF NOT EXISTS public.contests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  target_partner_type partner_type NOT NULL,
  rules JSONB DEFAULT '{}',
  prizes JSONB DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status banner_status DEFAULT 'DRAFT',
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT contests_date_order CHECK (start_date < end_date)
);

-- Create indexes for performance
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_mobile ON public.profiles(mobile);
CREATE INDEX idx_partners_user_id ON public.partners(user_id);
CREATE INDEX idx_partners_type ON public.partners(partner_type);
CREATE INDEX idx_partners_status ON public.partners(status);
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_customers_category ON public.customers(customer_category);
CREATE INDEX idx_customers_kyc_status ON public.customers(kyc_status);
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_role ON public.employees(employee_role);
CREATE INDEX idx_loan_applications_customer_id ON public.loan_applications(customer_id);
CREATE INDEX idx_loan_applications_status ON public.loan_applications(application_status);
CREATE INDEX idx_loan_applications_created_at ON public.loan_applications(created_at);
CREATE INDEX idx_payouts_partner_id ON public.payouts(partner_id);
CREATE INDEX idx_payouts_status ON public.payouts(payout_status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_properties_vendor_id ON public.properties(vendor_id);
CREATE INDEX idx_properties_status ON public.properties(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loan_applications_updated_at BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_permissions_updated_at BEFORE UPDATE ON public.admin_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incentives_updated_at BEFORE UPDATE ON public.incentives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contests_updated_at BEFORE UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();