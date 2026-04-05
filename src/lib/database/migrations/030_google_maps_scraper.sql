-- Google Maps Data Scraper Tables
-- Migration: 030_google_maps_scraper.sql
-- Created: 2026-01-11
-- Description: Tables for Google Maps business data scraping system

-- =====================================================
-- 1. KEYWORDS TABLE - Store keyword + pincode combinations
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(255) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'scraping', 'completed', 'failed', 'paused')),
    priority INTEGER DEFAULT 0,
    total_results INTEGER DEFAULT 0,
    scraped_count INTEGER DEFAULT 0,
    last_scraped_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(keyword, pincode)
);

-- =====================================================
-- 2. SCRAPING JOBS TABLE - Track scraping job status
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(255) NOT NULL,
    job_type VARCHAR(20) DEFAULT 'manual' CHECK (job_type IN ('manual', 'scheduled', 'bulk')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    total_keywords INTEGER DEFAULT 0,
    processed_keywords INTEGER DEFAULT 0,
    total_businesses INTEGER DEFAULT 0,
    successful_scrapes INTEGER DEFAULT 0,
    failed_scrapes INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_log JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. BUSINESSES TABLE - Store scraped business data
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Information
    place_id VARCHAR(255) UNIQUE,
    business_name VARCHAR(500) NOT NULL,
    business_type VARCHAR(255),
    category VARCHAR(255),
    subcategories TEXT[],

    -- Contact Information
    phone_numbers TEXT[],
    email_addresses TEXT[],
    website_url TEXT,

    -- Address Information
    full_address TEXT,
    street_address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(6),
    country VARCHAR(100) DEFAULT 'India',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    plus_code VARCHAR(50),

    -- Business Details
    rating DECIMAL(2, 1),
    review_count INTEGER DEFAULT 0,
    price_level VARCHAR(10),
    business_status VARCHAR(50),

    -- Operating Hours
    opening_hours JSONB,
    is_open_now BOOLEAN,

    -- Additional Info
    google_maps_url TEXT,
    photos_count INTEGER DEFAULT 0,
    description TEXT,
    attributes JSONB,

    -- Metadata
    keyword_id UUID REFERENCES google_maps_keywords(id),
    job_id UUID REFERENCES google_maps_jobs(id),
    search_keyword VARCHAR(255),
    search_pincode VARCHAR(6),
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    email_extracted BOOLEAN DEFAULT FALSE,
    email_extraction_attempted BOOLEAN DEFAULT FALSE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. EMAIL EXTRACTION QUEUE - Queue for website email scraping
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES google_maps_businesses(id) ON DELETE CASCADE,
    website_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    priority INTEGER DEFAULT 0,
    emails_found TEXT[],
    pages_crawled INTEGER DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. PROXY CONFIGURATION TABLE - Store proxy settings
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_proxy_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_type VARCHAR(20) DEFAULT 'free' CHECK (proxy_type IN ('free', 'paid', 'residential', 'datacenter')),
    proxy_url TEXT,
    proxy_host VARCHAR(255),
    proxy_port INTEGER,
    proxy_username VARCHAR(255),
    proxy_password VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    avg_response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. SCRAPER SETTINGS TABLE - Global scraper configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_scraper_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. SCRAPER LOGS TABLE - Detailed scraping logs
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_scraper_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES google_maps_jobs(id),
    keyword_id UUID REFERENCES google_maps_keywords(id),
    log_type VARCHAR(20) CHECK (log_type IN ('info', 'warning', 'error', 'success', 'blocked', 'captcha')),
    message TEXT NOT NULL,
    details JSONB,
    proxy_used TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. DUPLICATE TRACKING TABLE - Track duplicate businesses
-- =====================================================
CREATE TABLE IF NOT EXISTS google_maps_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_business_id UUID NOT NULL REFERENCES google_maps_businesses(id) ON DELETE CASCADE,
    duplicate_place_id VARCHAR(255),
    duplicate_phone VARCHAR(50),
    duplicate_email VARCHAR(255),
    matched_on VARCHAR(50) CHECK (matched_on IN ('place_id', 'phone', 'email', 'name_address')),
    keyword_id UUID REFERENCES google_maps_keywords(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Keywords indexes
CREATE INDEX IF NOT EXISTS idx_gmaps_keywords_status ON google_maps_keywords(status);
CREATE INDEX IF NOT EXISTS idx_gmaps_keywords_pincode ON google_maps_keywords(pincode);
CREATE INDEX IF NOT EXISTS idx_gmaps_keywords_keyword ON google_maps_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_gmaps_keywords_created_by ON google_maps_keywords(created_by);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_gmaps_jobs_status ON google_maps_jobs(status);
CREATE INDEX IF NOT EXISTS idx_gmaps_jobs_type ON google_maps_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_gmaps_jobs_created_by ON google_maps_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_gmaps_jobs_created_at ON google_maps_jobs(created_at DESC);

-- Businesses indexes
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_place_id ON google_maps_businesses(place_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_pincode ON google_maps_businesses(pincode);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_city ON google_maps_businesses(city);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_phone ON google_maps_businesses USING GIN(phone_numbers);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_email ON google_maps_businesses USING GIN(email_addresses);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_category ON google_maps_businesses(category);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_keyword ON google_maps_businesses(search_keyword);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_job ON google_maps_businesses(job_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_scraped_at ON google_maps_businesses(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmaps_businesses_name ON google_maps_businesses(business_name);

-- Email queue indexes
CREATE INDEX IF NOT EXISTS idx_gmaps_email_queue_status ON google_maps_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_gmaps_email_queue_priority ON google_maps_email_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_gmaps_email_queue_business ON google_maps_email_queue(business_id);

-- Logs indexes
CREATE INDEX IF NOT EXISTS idx_gmaps_logs_job ON google_maps_scraper_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_gmaps_logs_type ON google_maps_scraper_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_gmaps_logs_created ON google_maps_scraper_logs(created_at DESC);

-- Proxy indexes
CREATE INDEX IF NOT EXISTS idx_gmaps_proxy_active ON google_maps_proxy_config(is_active);
CREATE INDEX IF NOT EXISTS idx_gmaps_proxy_type ON google_maps_proxy_config(proxy_type);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'google_maps_keywords',
        'google_maps_jobs',
        'google_maps_businesses',
        'google_maps_email_queue',
        'google_maps_proxy_config',
        'google_maps_scraper_settings'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_%I_updated_at ON %I;
            CREATE TRIGGER trigger_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_google_maps_updated_at();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- =====================================================
-- INSERT DEFAULT SETTINGS
-- =====================================================

INSERT INTO google_maps_scraper_settings (setting_key, setting_value, description)
VALUES
    ('scraping_delay', '{"min_ms": 3000, "max_ms": 10000}'::jsonb, 'Random delay between requests in milliseconds'),
    ('max_concurrent_scrapes', '{"value": 3}'::jsonb, 'Maximum concurrent scraping operations'),
    ('batch_size', '{"value": 50}'::jsonb, 'Number of businesses to scrape per Lambda invocation'),
    ('retry_delay', '{"minutes": 60}'::jsonb, 'Delay before retrying after being blocked'),
    ('use_free_proxies', '{"enabled": true}'::jsonb, 'Whether to use free proxy rotation'),
    ('email_extraction_enabled', '{"enabled": true}'::jsonb, 'Whether to extract emails from websites'),
    ('max_pages_per_website', '{"value": 5}'::jsonb, 'Maximum pages to crawl per website for email extraction'),
    ('schedule_enabled', '{"enabled": true}'::jsonb, 'Whether scheduled scraping is enabled'),
    ('schedule_cron', '{"expression": "0 2 * * *"}'::jsonb, 'Cron expression for scheduled scraping (default: 2 AM daily)')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE google_maps_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_proxy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_scraper_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_scraper_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_maps_duplicates ENABLE ROW LEVEL SECURITY;

-- Super admin full access policies
CREATE POLICY "Super admins have full access to google_maps_keywords"
    ON google_maps_keywords FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_jobs"
    ON google_maps_jobs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_businesses"
    ON google_maps_businesses FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_email_queue"
    ON google_maps_email_queue FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_proxy_config"
    ON google_maps_proxy_config FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_scraper_settings"
    ON google_maps_scraper_settings FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_scraper_logs"
    ON google_maps_scraper_logs FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Super admins have full access to google_maps_duplicates"
    ON google_maps_duplicates FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE google_maps_keywords IS 'Stores keyword + pincode combinations for Google Maps scraping';
COMMENT ON TABLE google_maps_jobs IS 'Tracks scraping job status and progress';
COMMENT ON TABLE google_maps_businesses IS 'Stores scraped business data from Google Maps';
COMMENT ON TABLE google_maps_email_queue IS 'Queue for extracting emails from business websites';
COMMENT ON TABLE google_maps_proxy_config IS 'Proxy configuration for anti-blocking measures';
COMMENT ON TABLE google_maps_scraper_settings IS 'Global scraper configuration settings';
COMMENT ON TABLE google_maps_scraper_logs IS 'Detailed logs for scraping operations';
COMMENT ON TABLE google_maps_duplicates IS 'Tracks duplicate businesses detected during scraping';
