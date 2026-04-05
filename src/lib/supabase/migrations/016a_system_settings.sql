-- =====================================================
-- MIGRATION: 016a_system_settings.sql
-- PURPOSE: System settings table for CAE toggle and configs
-- RUN ORDER: 1 of 5
-- =====================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists (safe migration)
DO $$
BEGIN
  -- Add setting_type column if missing (REQUIRED by existing schema - NOT NULL)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'setting_type') THEN
    ALTER TABLE public.system_settings ADD COLUMN setting_type TEXT DEFAULT 'system';
  END IF;

  -- Add is_public column if missing (from existing schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'is_public') THEN
    ALTER TABLE public.system_settings ADD COLUMN is_public BOOLEAN DEFAULT false;
  END IF;

  -- Add category column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'category') THEN
    ALTER TABLE public.system_settings ADD COLUMN category VARCHAR(50);
  END IF;

  -- Add description column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'description') THEN
    ALTER TABLE public.system_settings ADD COLUMN description TEXT;
  END IF;

  -- Add is_active column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'is_active') THEN
    ALTER TABLE public.system_settings ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Add updated_by column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'updated_by') THEN
    ALTER TABLE public.system_settings ADD COLUMN updated_by UUID;
  END IF;

  -- Add updated_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.system_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 AND table_name = 'system_settings'
                 AND column_name = 'created_at') THEN
    ALTER TABLE public.system_settings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes (safe - IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- Insert CAE toggle setting
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, category, is_public)
VALUES (
  'CAE_ENABLED',
  '{
    "enabled": false,
    "default_provider": "CIBIL",
    "fallback_provider": "MOCK",
    "auto_assign_after_cam": true,
    "retry_on_failure": true,
    "max_retry_attempts": 3,
    "providers_priority": ["CIBIL", "EXPERIAN", "EQUIFAX", "MOCK"]
  }'::jsonb,
  'cae',
  'Credit Appraisal Engine global toggle. When enabled, all leads go through CAM preparation before BDE assignment.',
  'CAE',
  false
) ON CONFLICT (setting_key) DO NOTHING;

-- Insert default CAE provider settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description, category, is_public)
VALUES (
  'CAE_PROVIDER_CONFIG',
  '{
    "CIBIL": {"enabled": true, "priority": 1, "timeout_ms": 30000},
    "EXPERIAN": {"enabled": true, "priority": 2, "timeout_ms": 30000},
    "EQUIFAX": {"enabled": true, "priority": 3, "timeout_ms": 30000},
    "MOCK": {"enabled": true, "priority": 99, "timeout_ms": 5000}
  }'::jsonb,
  'cae',
  'CAE provider-specific configuration.',
  'CAE',
  false
) ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE public.system_settings IS 'Global system settings including CAE toggle, provider configs, and other application-wide settings';

-- =====================================================
-- END OF MIGRATION 016a
-- =====================================================
