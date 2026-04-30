import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

// Gateway Providers API
// GET: List all providers
// POST: Create new provider

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    let query = supabase
      .from('communication_providers')
      .select('*')
      .order('priority', { ascending: true })

    if (type) {
      query = query.eq('type', type)
    }

    const { data: providers, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Mask sensitive credentials
    const maskedProviders = providers?.map(p => ({
      ...p,
      config: maskCredentials(p.config)
    }))

    return NextResponse.json({ success: true, providers: maskedProviders })
  } catch (error) {
    apiLogger.error('Error fetching providers', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      type: z.string().optional(),


      provider_name: z.string().optional(),


      display_name: z.string().optional(),


      config: z.record(z.unknown()).optional(),


      is_active: z.boolean().optional().default(false),


      priority: z.number().optional().default(10),


      rate_limit_per_minute: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      type,
      provider_name,
      display_name,
      config,
      is_active = false,
      priority = 10,
      rate_limit_per_minute
    } = body

    if (!type || !provider_name || !config) {
      return NextResponse.json(
        { error: 'type, provider_name, and config are required' },
        { status: 400 }
      )
    }

    const { data: provider, error } = await supabase
      .from('communication_providers')
      .insert({
        type,
        provider_name,
        display_name: display_name || provider_name,
        config,
        is_active,
        priority,
        rate_limit_per_minute,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      provider: { ...provider, config: maskCredentials(provider.config) }
    })
  } catch (error) {
    apiLogger.error('Error creating provider', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function maskCredentials(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['api_key', 'api_secret', 'password', 'auth_token', 'secret_key']
  const masked = { ...config }

  for (const key of sensitiveKeys) {
    if (masked[key] && typeof masked[key] === 'string') {
      const value = masked[key] as string
      masked[key] = value.length > 8
        ? `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`
        : '********'
    }
  }

  return masked
}
