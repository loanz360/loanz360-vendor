import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/** Row shape for cp_ip_whitelist table */
interface IPWhitelistRow {
  id: string
  ip_address: string | null
  ip_range_start: string | null
  ip_range_end: string | null
  description: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
}

/**
 * GET /api/partners/cp/security/ip-whitelist
 * Fetches IP whitelist entries for the authenticated CP
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, ip_whitelist_enabled')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Fetch IP whitelist entries
    const { data: entries, error } = await supabase
      .from('cp_ip_whitelist')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching IP whitelist:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch IP whitelist' },
        { status: 500 }
      )
    }

    // Get current IP
    const currentIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

    return NextResponse.json({
      success: true,
      data: {
        ip_whitelist_enabled: partner.ip_whitelist_enabled || false,
        current_ip: currentIP,
        entries: (entries || []).map((e: IPWhitelistRow) => ({
          id: e.id,
          ip_address: e.ip_address,
          ip_range_start: e.ip_range_start,
          ip_range_end: e.ip_range_end,
          description: e.description,
          is_active: e.is_active,
          created_at: e.created_at,
          created_by: e.created_by
        })),
        max_entries: 10
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/security/ip-whitelist:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/cp/security/ip-whitelist
 * Add a new IP address to whitelist
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Check entry limit
    const { count } = await supabase
      .from('cp_ip_whitelist')
      .select('id', { count: 'exact' })
      .eq('partner_id', partner.id)

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum IP whitelist entries (10) reached' },
        { status: 400 }
      )
    }

    // Parse request body
    const bodySchema = z.object({

      ip_address: z.string().optional(),

      ip_range_start: z.string().optional(),

      ip_range_end: z.string().optional(),

      description: z.string().optional(),

      enabled: z.boolean().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { ip_address, ip_range_start, ip_range_end, description } = body

    // Validate IP address format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

    if (ip_address && !ipRegex.test(ip_address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid IP address format' },
        { status: 400 }
      )
    }

    if (ip_range_start && !ipRegex.test(ip_range_start)) {
      return NextResponse.json(
        { success: false, error: 'Invalid IP range start format' },
        { status: 400 }
      )
    }

    if (ip_range_end && !ipRegex.test(ip_range_end)) {
      return NextResponse.json(
        { success: false, error: 'Invalid IP range end format' },
        { status: 400 }
      )
    }

    if (!ip_address && (!ip_range_start || !ip_range_end)) {
      return NextResponse.json(
        { success: false, error: 'Either IP address or IP range is required' },
        { status: 400 }
      )
    }

    // Check for duplicate
    let existingQuery = supabase
      .from('cp_ip_whitelist')
      .select('id')
      .eq('partner_id', partner.id)

    if (ip_address) {
      existingQuery = existingQuery.eq('ip_address', ip_address)
    } else {
      existingQuery = existingQuery.eq('ip_range_start', ip_range_start).eq('ip_range_end', ip_range_end)
    }

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This IP address/range is already in the whitelist' },
        { status: 409 }
      )
    }

    // Get current IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const currentIP = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Insert entry
    const { data: entry, error: insertError } = await supabase
      .from('cp_ip_whitelist')
      .insert({
        partner_id: partner.id,
        ip_address: ip_address || null,
        ip_range_start: ip_range_start || null,
        ip_range_end: ip_range_end || null,
        description: description?.trim() || null,
        is_active: true,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error adding IP whitelist entry:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to add IP whitelist entry' },
        { status: 500 }
      )
    }

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'IP_WHITELIST_ADD',
      action_description: `Added IP ${ip_address || `${ip_range_start}-${ip_range_end}`} to whitelist`,
      section: 'security',
      changed_by: user.id,
      source: 'WEB',
      ip_address: currentIP,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'IP address added to whitelist',
      data: {
        id: entry.id,
        ip_address: entry.ip_address,
        ip_range_start: entry.ip_range_start,
        ip_range_end: entry.ip_range_end
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/partners/cp/security/ip-whitelist:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/cp/security/ip-whitelist
 * Enable/disable IP whitelist feature
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, ip_whitelist_enabled')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const bodySchema2 = z.object({

      enabled: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Enabled must be a boolean value' },
        { status: 400 }
      )
    }

    // If enabling, check that there's at least one entry with current IP
    if (enabled) {
      const currentIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

      const { data: entries } = await supabase
        .from('cp_ip_whitelist')
        .select('ip_address')
        .eq('partner_id', partner.id)
        .eq('is_active', true)

      const hasCurrentIP = (entries || []).some((e: IPWhitelistRow) => e.ip_address === currentIP)

      if (!hasCurrentIP && (entries || []).length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Your current IP address is not in the whitelist. Add it first to avoid being locked out.',
            current_ip: currentIP
          },
          { status: 400 }
        )
      }

      if ((entries || []).length === 0) {
        return NextResponse.json(
          { success: false, error: 'Add at least one IP address before enabling the whitelist' },
          { status: 400 }
        )
      }
    }

    // Update setting
    const { error: updateError } = await supabase
      .from('partners')
      .update({
        ip_whitelist_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', partner.id)

    if (updateError) {
      apiLogger.error('Error updating IP whitelist setting:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update setting' },
        { status: 500 }
      )
    }

    // Get current IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'UPDATE',
      action_description: `IP whitelist ${enabled ? 'enabled' : 'disabled'}`,
      section: 'security',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: `IP whitelist ${enabled ? 'enabled' : 'disabled'} successfully`
    })
  } catch (error: unknown) {
    apiLogger.error('Error in PUT /api/partners/cp/security/ip-whitelist:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
