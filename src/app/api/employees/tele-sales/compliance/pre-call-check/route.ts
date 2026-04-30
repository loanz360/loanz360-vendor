import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// Normalize phone number for consistent matching
function normalizePhoneNumber(phone: string): { full: string; normalized: string } {
  let digits = phone.replace(/\D/g, '')

  if (digits.length === 10) {
    return { full: `+91${digits}`, normalized: digits }
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1)
    return { full: `+91${digits}`, normalized: digits }
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return { full: `+${digits}`, normalized: digits.substring(2) }
  } else if (digits.length >= 12) {
    return { full: `+${digits}`, normalized: digits.slice(-10) }
  }

  return { full: phone, normalized: digits.slice(-10) }
}

// POST - Comprehensive pre-call compliance check
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { phone_number, lead_id, category, region } = body

    if (!phone_number) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
    }

    const { full: fullNumber, normalized: normalizedNumber } = normalizePhoneNumber(phone_number)
    const warnings: string[] = []
    const blockers: string[] = []

    // =====================================================
    // 1. DND CHECK
    // =====================================================
    const { data: dndEntry } = await supabase
      .from('ts_dnd_registry')
      .select('*')
      .or(`phone_number.eq.${fullNumber},phone_normalized.eq.${normalizedNumber}`)
      .eq('is_dnd', true)
      .maybeSingle()

    const dndCheck = {
      phone_number: fullNumber,
      is_dnd: !!dndEntry,
      dnd_type: dndEntry?.dnd_type || null,
      allowed_categories: dndEntry?.allowed_categories || [],
      can_call: true,
      reason: null as string | null,
      warning: null as string | null,
      last_verified: dndEntry?.last_checked || null
    }

    if (dndEntry) {
      if (dndEntry.dnd_type === 'FULL') {
        dndCheck.can_call = false
        dndCheck.reason = 'Number is on DND registry (Full block)'
        blockers.push('DND Registered: This number is on the Do Not Disturb list')
      } else if (dndEntry.dnd_type === 'PARTIAL') {
        const allowed = dndEntry.allowed_categories || []
        if (category && allowed.includes(category)) {
          dndCheck.can_call = true
          dndCheck.warning = `DND registered but allows ${category} calls`
          warnings.push(`DND Partial: Customer allows ${allowed.join(', ')} calls only`)
        } else {
          dndCheck.can_call = false
          dndCheck.reason = `DND allows only: ${allowed.join(', ')}`
          blockers.push(`DND Restricted: Only ${allowed.join(', ')} categories allowed`)
        }
      }
    }

    // =====================================================
    // 2. CALL TIME CHECK
    // =====================================================
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentDay = now.getDay()
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`

    // Get applicable time restriction
    let restrictionQuery = supabase
      .from('ts_call_time_restrictions')
      .select('*')
      .eq('is_active', true)

    if (category) {
      restrictionQuery = restrictionQuery.or(`category.eq.${category},is_default.eq.true`)
    } else {
      restrictionQuery = restrictionQuery.eq('is_default', true)
    }

    const { data: restrictions } = await restrictionQuery.limit(1)
    const restriction = restrictions?.[0]

    const timeCheck = {
      can_call: true,
      reason: null as string | null,
      current_time: currentTimeStr,
      allowed_start: restriction?.allowed_start_time || '09:00',
      allowed_end: restriction?.allowed_end_time || '21:00',
      next_allowed_time: null as string | null,
      is_holiday: false
    }

    if (restriction) {
      const [startHour, startMin] = restriction.allowed_start_time.split(':').map(Number)
      const [endHour, endMin] = restriction.allowed_end_time.split(':').map(Number)
      const currentMinutes = currentHour * 60 + currentMinute
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      // Check if current day is allowed
      const allowedDays = restriction.allowed_days || [1, 2, 3, 4, 5, 6]
      if (!allowedDays.includes(currentDay)) {
        timeCheck.can_call = false
        timeCheck.reason = `Calls not allowed on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay]}`
        blockers.push(`Day Restriction: Calling not permitted today`)
      }

      // Check if current time is within allowed hours
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        timeCheck.can_call = false
        timeCheck.reason = `Current time ${currentTimeStr} is outside allowed hours (${restriction.allowed_start_time} - ${restriction.allowed_end_time})`

        if (currentMinutes < startMinutes) {
          timeCheck.next_allowed_time = restriction.allowed_start_time
          blockers.push(`Time Restriction: Wait until ${restriction.allowed_start_time} to call`)
        } else {
          // Calculate next day's start time
          timeCheck.next_allowed_time = `Tomorrow ${restriction.allowed_start_time}`
          blockers.push(`Time Restriction: Calling hours ended. Try tomorrow after ${restriction.allowed_start_time}`)
        }
      }

      // Check for blocked dates (holidays)
      const todayStr = now.toISOString().split('T')[0]
      if (restriction.blocked_dates?.includes(todayStr)) {
        timeCheck.can_call = false
        timeCheck.is_holiday = true
        timeCheck.reason = 'Today is a blocked date (holiday)'
        blockers.push('Holiday: Calling not permitted on this date')
      }
    }

    // =====================================================
    // 3. CONSENT CHECK
    // =====================================================
    const { data: consentEntry } = await supabase
      .from('ts_customer_consent')
      .select('*')
      .eq('phone_number', fullNumber)
      .eq('is_active', true)
      .order('consented_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const consentCheck = {
      has_consent: false,
      consent_type: null as string | null,
      consent_channel: null as string | null,
      categories: [] as string[],
      expires_at: null as string | null,
      is_expired: false,
      reason: null as string | null
    }

    if (consentEntry) {
      consentCheck.has_consent = true
      consentCheck.consent_type = consentEntry.consent_type
      consentCheck.consent_channel = consentEntry.consent_channel
      consentCheck.categories = consentEntry.consent_categories || []
      consentCheck.expires_at = consentEntry.expires_at

      // Check if consent is expired
      if (consentEntry.expires_at && new Date(consentEntry.expires_at) < now) {
        consentCheck.is_expired = true
        consentCheck.has_consent = false
        consentCheck.reason = 'Customer consent has expired'
        warnings.push('Consent Expired: Customer consent needs renewal')
      }

      // Check if consent type is OPT_OUT
      if (consentEntry.consent_type === 'OPT_OUT') {
        consentCheck.has_consent = false
        consentCheck.reason = 'Customer has opted out of calls'
        blockers.push('Opted Out: Customer has explicitly opted out of receiving calls')
      }

      // Check category consent for PARTIAL
      if (consentEntry.consent_type === 'PARTIAL' && category) {
        if (!consentEntry.consent_categories?.includes(category)) {
          consentCheck.has_consent = false
          consentCheck.reason = `No consent for ${category} category`
          warnings.push(`Partial Consent: Customer only allows ${consentEntry.consent_categories?.join(', ')} calls`)
        }
      }
    } else {
      // No consent record - this is a warning, not a blocker (depends on business rules)
      warnings.push('No Consent: No explicit consent on record for this number')
    }

    // =====================================================
    // 4. FREQUENCY CHECK (Optional enhancement)
    // =====================================================
    // Check how many times this number was called recently
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const { count: recentCallCount } = await supabase
      .from('ts_calls')
      .select('*', { count: 'exact', head: true })
      .or(`contact_phone.eq.${fullNumber},contact_phone.eq.${normalizedNumber}`)
      .gte('created_at', last24Hours.toISOString())

    if ((recentCallCount || 0) >= 3) {
      warnings.push(`Frequent Calls: This number was called ${recentCallCount} times in the last 24 hours`)
    }

    // =====================================================
    // 5. DETERMINE FINAL RESULT
    // =====================================================
    const canCall = dndCheck.can_call && timeCheck.can_call && !consentCheck.is_expired &&
      (consentCheck.has_consent || consentCheck.consent_type !== 'OPT_OUT')

    // Log the pre-call check
    await supabase
      .from('ts_dnd_verification_logs')
      .insert({
        sales_executive_id: user.id,
        phone_number: fullNumber,
        is_dnd: dndCheck.is_dnd,
        dnd_type: dndCheck.dnd_type,
        action_taken: canCall ? (blockers.length > 0 ? 'WARNING_SHOWN' : 'ALLOWED') : 'BLOCKED',
        lead_id,
        verification_source: 'DATABASE'
      })

    return NextResponse.json({
      success: true,
      data: {
        can_call: blockers.length === 0,
        dnd_check: dndCheck,
        time_check: timeCheck,
        consent_check: consentCheck,
        warnings,
        blockers,
        checked_at: now.toISOString()
      }
    })
  } catch (error) {
    apiLogger.error('Pre-call check error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform pre-call compliance check' },
      { status: 500 }
    )
  }
}
