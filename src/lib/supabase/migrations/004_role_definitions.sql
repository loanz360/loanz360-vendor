-- Migration: Create role_definitions table for dynamic sub-role management
-- Description: Allows Super Admin to create, update, and manage sub-roles dynamically
-- Date: 2025-10-03

-- Create role_definitions table
CREATE TABLE IF NOT EXISTS public.role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'BUSINESS_ASSOCIATE', 'CRO'
  role_name VARCHAR(255) NOT NULL, -- Display name, e.g., 'Business Associate', 'Customer Relationship Officer'
  role_type VARCHAR(50) NOT NULL, -- 'PARTNER' or 'EMPLOYEE'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0, -- For sorting in UI
  permissions JSONB DEFAULT '{}', -- Store role-specific permissions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_definitions_role_type ON public.role_definitions(role_type);
CREATE INDEX IF NOT EXISTS idx_role_definitions_is_active ON public.role_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_role_definitions_role_key ON public.role_definitions(role_key);

-- Add comment
COMMENT ON TABLE public.role_definitions IS 'Stores dynamic role definitions that can be managed by Super Admin';

-- Enable Row Level Security
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Super Admin can do everything
CREATE POLICY "Super Admin full access to role_definitions"
  ON public.role_definitions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Admin can read role definitions
CREATE POLICY "Admin read access to role_definitions"
  ON public.role_definitions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- All authenticated users can read active role definitions (for registration forms, etc.)
CREATE POLICY "Authenticated users can read active role_definitions"
  ON public.role_definitions
  FOR SELECT
  USING (is_active = true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_role_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_definitions_updated_at
  BEFORE UPDATE ON public.role_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_role_definitions_updated_at();

-- Insert initial Partner sub-roles
INSERT INTO public.role_definitions (role_key, role_name, role_type, description, display_order) VALUES
  ('BUSINESS_ASSOCIATE', 'Business Associate', 'PARTNER', 'Independent business associate working with LOANZ 360', 1),
  ('BUSINESS_PARTNER', 'Business Partner', 'PARTNER', 'Strategic business partner with higher commission rates', 2),
  ('CHANNEL_PARTNER', 'Channel Partner', 'PARTNER', 'Channel partner managing multiple associates', 3)
ON CONFLICT (role_key) DO NOTHING;

-- Insert initial Employee sub-roles (12 active roles)
-- Note: LOAN_OFFICER and COLLECTION_AGENT were removed from the system
INSERT INTO public.role_definitions (role_key, role_name, role_type, description, display_order) VALUES
  ('CRO', 'Customer Relationship Officer', 'EMPLOYEE', 'Manages customer relationships and support', 10),
  ('BUSINESS_DEVELOPMENT_EXECUTIVE', 'Business Development Executive', 'EMPLOYEE', 'Focuses on new business acquisition', 11),
  ('BUSINESS_DEVELOPMENT_MANAGER', 'Business Development Manager', 'EMPLOYEE', 'Manages business development team', 12),
  ('DIGITAL_SALES', 'Digital Sales', 'EMPLOYEE', 'Handles online and digital sales channels', 13),
  ('CHANNEL_PARTNER_EXECUTIVE', 'Channel Partner Executive', 'EMPLOYEE', 'Manages channel partner relationships and operations', 14),
  ('CHANNEL_PARTNER_MANAGER', 'Channel Partner Manager', 'EMPLOYEE', 'Manages channel partner team and strategies', 15),
  ('FINANCE_EXECUTIVE', 'Finance Executive', 'EMPLOYEE', 'Handles financial operations', 16),
  ('ACCOUNTS_EXECUTIVE', 'Accounts Executive', 'EMPLOYEE', 'Manages accounting tasks', 17),
  ('ACCOUNTS_MANAGER', 'Accounts Manager', 'EMPLOYEE', 'Oversees accounting department', 18),
  ('DIRECT_SALES_EXECUTIVE', 'Direct Sales Executive', 'EMPLOYEE', 'Direct customer sales', 19),
  ('DIRECT_SALES_MANAGER', 'Direct Sales Manager', 'EMPLOYEE', 'Manages direct sales team', 20),
  ('TELE_SALES', 'Tele Sales', 'EMPLOYEE', 'General sales agent', 21)
ON CONFLICT (role_key) DO NOTHING;
