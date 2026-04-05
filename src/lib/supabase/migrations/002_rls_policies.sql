-- Row Level Security (RLS) Policies for LOANZ 360
-- Financial-grade security with role-based access control

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin or super admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('SUPER_ADMIN', 'ADMIN')
    FROM public.users
    WHERE id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has specific admin permission
CREATE OR REPLACE FUNCTION public.has_admin_permission(user_uuid UUID, module TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin has all permissions
  IF (SELECT role FROM public.users WHERE id = user_uuid) = 'SUPER_ADMIN' THEN
    RETURN TRUE;
  END IF;

  -- Check specific admin permissions
  RETURN (
    SELECT EXISTS(
      SELECT 1 FROM public.admin_permissions
      WHERE admin_id = user_uuid
      AND module_name = module
      AND (permissions->>'enabled')::boolean = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================
-- USERS TABLE POLICIES
-- ===============================

-- Users can view their own profile and admins can view all
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT USING (
    auth.uid() = id OR
    public.is_admin_user(auth.uid())
  );

-- Users can update their own profile, admins can update all
CREATE POLICY "users_update_policy" ON public.users
  FOR UPDATE USING (
    auth.uid() = id OR
    public.is_admin_user(auth.uid())
  );

-- Only super admin can insert users (registration handled separately)
CREATE POLICY "users_insert_policy" ON public.users
  FOR INSERT WITH CHECK (
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

-- Only super admin can delete users
CREATE POLICY "users_delete_policy" ON public.users
  FOR DELETE USING (
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

-- ===============================
-- PROFILES TABLE POLICIES
-- ===============================

-- Users can view their own profile, admins can view based on permissions
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    (public.get_user_role(auth.uid()) = 'EMPLOYEE' AND
     public.has_admin_permission(auth.uid(), 'user_management'))
  );

-- Users can update their own profile
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid())
  );

-- Profiles created during registration
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid())
  );

-- ===============================
-- PARTNERS TABLE POLICIES
-- ===============================

-- Partners can view their own data, admins can view all
CREATE POLICY "partners_select_policy" ON public.partners
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'partner_management')
  );

-- Partners can update their own data
CREATE POLICY "partners_update_policy" ON public.partners
  FOR UPDATE USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'partner_management')
  );

-- Partner registration
CREATE POLICY "partners_insert_policy" ON public.partners
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    public.get_user_role(auth.uid()) = 'PARTNER'
  );

-- ===============================
-- CUSTOMERS TABLE POLICIES
-- ===============================

-- Customers can view their own data
CREATE POLICY "customers_select_policy" ON public.customers
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'customer_management') OR
    (public.get_user_role(auth.uid()) = 'EMPLOYEE' AND
     public.has_admin_permission(auth.uid(), 'customer_management'))
  );

-- Customers can update their own data
CREATE POLICY "customers_update_policy" ON public.customers
  FOR UPDATE USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'customer_management')
  );

-- Customer registration
CREATE POLICY "customers_insert_policy" ON public.customers
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    public.get_user_role(auth.uid()) = 'CUSTOMER'
  );

-- ===============================
-- EMPLOYEES TABLE POLICIES
-- ===============================

-- Employees can view their own data and their subordinates
CREATE POLICY "employees_select_policy" ON public.employees
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- Employees can update their own data, managers can update subordinates
CREATE POLICY "employees_update_policy" ON public.employees
  FOR UPDATE USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    manager_id = (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- Only HR and admins can add employees
CREATE POLICY "employees_insert_policy" ON public.employees
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid()) OR
    (public.get_user_role(auth.uid()) = 'EMPLOYEE' AND
     (SELECT employee_role FROM public.employees WHERE user_id = auth.uid()) = 'HR_TEAM')
  );

-- ===============================
-- VENDORS TABLE POLICIES
-- ===============================

-- Vendors can view their own data
CREATE POLICY "vendors_select_policy" ON public.vendors
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'vendor_management')
  );

-- Vendors can update their own data
CREATE POLICY "vendors_update_policy" ON public.vendors
  FOR UPDATE USING (
    user_id = auth.uid() OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'vendor_management')
  );

-- Vendor registration
CREATE POLICY "vendors_insert_policy" ON public.vendors
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    public.get_user_role(auth.uid()) = 'VENDOR'
  );

-- ===============================
-- LOAN APPLICATIONS POLICIES
-- ===============================

-- Customers can view their own applications, partners/employees can view related ones
CREATE POLICY "loan_applications_select_policy" ON public.loan_applications
  FOR SELECT USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'application_management')
  );

-- Customers can create and update their applications
CREATE POLICY "loan_applications_insert_policy" ON public.loan_applications
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR
    public.is_admin_user(auth.uid())
  );

-- Applications can be updated by customers, assigned partners/employees, or admins
CREATE POLICY "loan_applications_update_policy" ON public.loan_applications
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()) OR
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'application_management')
  );

-- ===============================
-- PAYOUTS POLICIES
-- ===============================

-- Partners can view their own payouts
CREATE POLICY "payouts_select_policy" ON public.payouts
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'payout_management')
  );

-- Only admins with payout permission can manage payouts
CREATE POLICY "payouts_insert_policy" ON public.payouts
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'payout_management')
  );

CREATE POLICY "payouts_update_policy" ON public.payouts
  FOR UPDATE USING (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'payout_management')
  );

-- ===============================
-- BANNERS POLICIES
-- ===============================

-- Users see banners targeted to their role
CREATE POLICY "banners_select_policy" ON public.banners
  FOR SELECT USING (
    status = 'ACTIVE' AND
    start_date <= NOW() AND
    end_date >= NOW() AND
    (target_audience = '{}' OR public.get_user_role(auth.uid()) = ANY(target_audience)) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'banner_management')
  );

-- Only admins with banner permission can manage banners
CREATE POLICY "banners_insert_policy" ON public.banners
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'banner_management')
  );

CREATE POLICY "banners_update_policy" ON public.banners
  FOR UPDATE USING (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'banner_management')
  );

CREATE POLICY "banners_delete_policy" ON public.banners
  FOR DELETE USING (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'banner_management')
  );

-- ===============================
-- NOTIFICATIONS POLICIES
-- ===============================

-- Users can only see their own notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_policy" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- System and admins can create notifications
CREATE POLICY "notifications_insert_policy" ON public.notifications
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid())
  );

-- ===============================
-- AUDIT LOGS POLICIES
-- ===============================

-- Only super admin can view audit logs
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

-- System can insert audit logs
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- ===============================
-- ADMIN PERMISSIONS POLICIES
-- ===============================

-- Admins can view their own permissions, super admin can view all
CREATE POLICY "admin_permissions_select_policy" ON public.admin_permissions
  FOR SELECT USING (
    admin_id = auth.uid() OR
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

-- Only super admin can manage admin permissions
CREATE POLICY "admin_permissions_insert_policy" ON public.admin_permissions
  FOR INSERT WITH CHECK (
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "admin_permissions_update_policy" ON public.admin_permissions
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "admin_permissions_delete_policy" ON public.admin_permissions
  FOR DELETE USING (
    public.get_user_role(auth.uid()) = 'SUPER_ADMIN'
  );

-- ===============================
-- PROPERTIES POLICIES
-- ===============================

-- Vendors can view their own properties, customers can view approved ones
CREATE POLICY "properties_select_policy" ON public.properties
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) OR
    (status = 'APPROVED' AND public.get_user_role(auth.uid()) = 'CUSTOMER') OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'property_management')
  );

-- Vendors can add properties
CREATE POLICY "properties_insert_policy" ON public.properties
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- Vendors can update their own properties, admins can approve/reject
CREATE POLICY "properties_update_policy" ON public.properties
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'property_management')
  );

-- ===============================
-- INCENTIVES POLICIES
-- ===============================

-- Employees can view incentives for their role
CREATE POLICY "incentives_select_policy" ON public.incentives
  FOR SELECT USING (
    (status = 'ACTIVE' AND
     start_date <= NOW() AND
     end_date >= NOW() AND
     target_role = (SELECT employee_role FROM public.employees WHERE user_id = auth.uid())) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'incentive_management')
  );

-- Only admins can manage incentives
CREATE POLICY "incentives_insert_policy" ON public.incentives
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'incentive_management')
  );

CREATE POLICY "incentives_update_policy" ON public.incentives
  FOR UPDATE USING (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'incentive_management')
  );

-- ===============================
-- CONTESTS POLICIES
-- ===============================

-- Partners can view contests for their type
CREATE POLICY "contests_select_policy" ON public.contests
  FOR SELECT USING (
    (status = 'ACTIVE' AND
     start_date <= NOW() AND
     end_date >= NOW() AND
     target_partner_type = (SELECT partner_type FROM public.partners WHERE user_id = auth.uid())) OR
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'contest_management')
  );

-- Only admins can manage contests
CREATE POLICY "contests_insert_policy" ON public.contests
  FOR INSERT WITH CHECK (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'contest_management')
  );

CREATE POLICY "contests_update_policy" ON public.contests
  FOR UPDATE USING (
    public.is_admin_user(auth.uid()) OR
    public.has_admin_permission(auth.uid(), 'contest_management')
  );

-- ===============================
-- FUNCTIONS FOR AUDIT LOGGING
-- ===============================

-- Function to log changes automatically
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    ip_address
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    inet_client_addr()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER audit_partners AFTER INSERT OR UPDATE OR DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER audit_loan_applications AFTER INSERT OR UPDATE OR DELETE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER audit_payouts AFTER INSERT OR UPDATE OR DELETE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.log_changes();
CREATE TRIGGER audit_admin_permissions AFTER INSERT OR UPDATE OR DELETE ON public.admin_permissions FOR EACH ROW EXECUTE FUNCTION public.log_changes();