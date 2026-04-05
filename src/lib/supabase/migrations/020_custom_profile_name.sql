-- =====================================================
-- CUSTOM PROFILE NAME FOR "OTHERS" PROFILES
-- Version: 1.0.0
-- Date: 2026-01-30
-- Purpose: Add custom_profile_name column to store user-entered profile names
--          when they select "Others" profile in any category
-- =====================================================

-- Add custom_profile_name column to customer_profiles table
DO $$
BEGIN
  -- Add custom_profile_name column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'customer_profiles'
    AND column_name = 'custom_profile_name'
  ) THEN
    ALTER TABLE public.customer_profiles ADD COLUMN custom_profile_name VARCHAR(100);
    COMMENT ON COLUMN public.customer_profiles.custom_profile_name IS 'Custom profile name entered by user when selecting "Others" profile';
  END IF;
END $$;

-- Create index for custom_profile_name lookups
CREATE INDEX IF NOT EXISTS idx_customer_profiles_custom_profile_name
  ON public.customer_profiles(custom_profile_name)
  WHERE custom_profile_name IS NOT NULL;

-- =====================================================
-- MIGRATION TRACKING
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations') THEN
    INSERT INTO public.migrations (name, executed_at)
    VALUES ('020_custom_profile_name', NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
