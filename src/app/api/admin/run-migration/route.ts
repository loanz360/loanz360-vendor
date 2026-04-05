export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // SECURITY FIX CRITICAL-05: Add authentication and authorization check
    const authSupabase = await createClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()

    if (authError || !user) {
      logger.warn('Unauthorized migration attempt - no auth', undefined, {
        endpoint: '/api/admin/run-migration',
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is SUPER_ADMIN
    const { data: userData } = await authSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized migration attempt - insufficient privileges', undefined, {
        userId: user.id,
        email: user.email,
        role: userData?.role,
        endpoint: '/api/admin/run-migration'
      })
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    logger.info('Starting role_definitions migration', {
      context: 'run-migration-POST',
      userId: user.id,
      email: user.email
    })

    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Create the table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.role_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_key VARCHAR(100) NOT NULL UNIQUE,
        role_name VARCHAR(255) NOT NULL,
        role_type VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id)
      );
    `

    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL })

    if (tableError) {
      logger.error('Error creating table', tableError instanceof Error ? tableError : undefined, {
        context: 'run-migration-POST'
      })
      // Try direct query instead
      const { error: directError } = await supabase.from('role_definitions').select('id').limit(1)
      if (directError && directError.code === '42P01') {
        // Table doesn't exist, we need another approach
        return NextResponse.json({
          success: false,
          error: 'Unable to create table. Please run migration manually via Supabase dashboard.',
          details: tableError
        }, { status: 500 })
      }
    }

    logger.info('Table created or already exists', { context: 'run-migration-POST' })

    // Insert initial partner roles
    const { error: insertError } = await supabase
      .from('role_definitions')
      .upsert([
        {
          role_key: 'BUSINESS_ASSOCIATE',
          role_name: 'Business Associate',
          role_type: 'PARTNER',
          description: 'Independent business associate working with LOANZ 360',
          is_active: true,
          display_order: 1
        },
        {
          role_key: 'BUSINESS_PARTNER',
          role_name: 'Business Partner',
          role_type: 'PARTNER',
          description: 'Strategic business partner with higher commission rates',
          is_active: true,
          display_order: 2
        },
        {
          role_key: 'CHANNEL_PARTNER',
          role_name: 'Channel Partner',
          role_type: 'PARTNER',
          description: 'Channel partner managing multiple associates',
          is_active: true,
          display_order: 3
        }
      ], {
        onConflict: 'role_key',
        ignoreDuplicates: false
      })

    if (insertError) {
      logger.error('Error inserting partner roles', insertError instanceof Error ? insertError : undefined, {
        context: 'run-migration-POST'
      })
      return NextResponse.json({
        success: false,
        error: 'Failed to insert partner roles',
      }, { status: 500 })
    }

    logger.info('Partner roles inserted successfully', { context: 'run-migration-POST' })

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      rolesCreated: 3
    })

  } catch (error) {
    logger.error('Migration failed', error instanceof Error ? error : undefined, {
      context: 'run-migration-POST'
    })
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      }, { status: 500 })
  }
}
