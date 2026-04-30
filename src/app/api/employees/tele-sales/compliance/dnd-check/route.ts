
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// Normalize phone number for consistent matching
function normalizePhoneNumber(phone: string): { full: string; normalized: string } {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '')

  // Handle Indian phone numbers
  if (digits.length === 10) {
    // Add country code
    return { full: `+91${digits}`, normalized: digits }
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Remove leading 0
    digits = digits.substring(1)
    return { full: `+91${digits}`, normalized: digits }
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already has country code without +
    return { full: `+${digits}`, normalized: digits.substring(2) }
  } else if (digits.length === 13 && digits.startsWith('91')) {
    // Has +91
    return { full: `+${digits}`, normalized: digits.substring(2) }
  }

  // Return as-is for other formats
  return { full: phone, normalized: digits.slice(-10) }
}

// POST - Check if a phone number is on DND registry
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { phone_number, lead_id, call_id, category } = body

    if (!phone_number) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
    }

    const startTime = Date.now()
    const { full: fullNumber, normalized: normalizedNumber } = normalizePhoneNumber(phone_number)

    // Check DND registry
    const { data: dndEntry, error: dndError } = await supabase
      .from('ts_dnd_registry')
      .select('*')
      .or(`phone_number.eq.${fullNumber},phone_normalized.eq.${normalizedNumber}`)
      .eq('is_dnd', true)
      .maybeSingle()

    const responseTimeMs = Date.now() - startTime

    let isDND = false
    let dndType = null
    let canCall = true
    let reason = null
    let warning = null
    let allowedCategories: string[] = []

    if (dndEntry) {
      isDND = true
      dndType = dndEntry.dnd_type

      if (dndEntry.dnd_type === 'FULL') {
        canCall = false
        reason = 'This number is registered on the Do Not Disturb (DND) registry'
      } else if (dndEntry.dnd_type === 'PARTIAL') {
        allowedCategories = dndEntry.allowed_categories || []
        if (category && allowedCategories.includes(category)) {
          canCall = true
          warning = `DND registered but allows ${category} category calls`
        } else {
          canCall = false
          reason = `DND registered. Only allows: ${allowedCategories.join(', ')}`
        }
      }
    }

    // Log the verification
    const actionTaken = canCall ? (isDND ? 'WARNING_SHOWN' : 'ALLOWED') : 'BLOCKED'

    await supabase
      .from('ts_dnd_verification_logs')
      .insert({
        sales_executive_id: user.id,
        phone_number: fullNumber,
        is_dnd: isDND,
        dnd_type: dndType,
        action_taken: actionTaken,
        call_id,
        lead_id,
        verification_source: 'DATABASE',
        response_time_ms: responseTimeMs
      })

    // If blocked, create a compliance record
    if (!canCall) {
      // Check if user tries to call anyway later
      // This is just logging the check, actual violation would be if they proceed
    }

    return NextResponse.json({
      success: true,
      data: {
        phone_number: fullNumber,
        is_dnd: isDND,
        dnd_type: dndType,
        allowed_categories: allowedCategories,
        can_call: canCall,
        reason,
        warning,
        last_verified: dndEntry?.last_checked || new Date().toISOString()
      }
    })
  } catch (error) {
    apiLogger.error('DND check error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check DND status' },
      { status: 500 }
    )
  }
}

// GET - Get DND check history for current user
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const date = searchParams.get('date') // Optional date filter

    let query = supabase
      .from('ts_dnd_verification_logs')
      .select('*')
      .eq('sales_executive_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
    }

    const { data: logs, error } = await query

    if (error) throw error

    // Calculate stats
    const stats = {
      total_checks: logs?.length || 0,
      dnd_found: logs?.filter(l => l.is_dnd).length || 0,
      blocked: logs?.filter(l => l.action_taken === 'BLOCKED').length || 0,
      allowed: logs?.filter(l => l.action_taken === 'ALLOWED').length || 0,
      warnings: logs?.filter(l => l.action_taken === 'WARNING_SHOWN').length || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        stats
      }
    })
  } catch (error) {
    apiLogger.error('DND history error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch DND history' },
      { status: 500 }
    )
  }
}
