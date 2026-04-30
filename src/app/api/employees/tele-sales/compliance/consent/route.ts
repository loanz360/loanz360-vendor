import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// Normalize phone number
function normalizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+91${digits}`
  } else if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.substring(1)}`
  } else if (digits.length >= 12 && !phone.startsWith('+')) {
    return `+${digits}`
  }
  return phone
}

// POST - Record customer consent
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

    const {
      phone_number,
      customer_id,
      lead_id,
      consent_type,
      consent_channel,
      consent_categories,
      expires_at,
      consent_proof
    } = body

    if (!phone_number || !consent_type || !consent_channel) {
      return NextResponse.json({
        success: false,
        error: 'Phone number, consent type, and channel are required'
      }, { status: 400 })
    }

    const normalizedPhone = normalizePhoneNumber(phone_number)

    // Deactivate any existing consent for this phone
    await supabase
      .from('ts_customer_consent')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('phone_number', normalizedPhone)

    // Create new consent record
    const { data: consent, error: insertError } = await supabase
      .from('ts_customer_consent')
      .insert({
        phone_number: normalizedPhone,
        customer_id,
        lead_id,
        consent_type,
        consent_channel,
        consent_categories,
        expires_at,
        consent_proof,
        recorded_by: user.id,
        is_active: true
      })
      .select()
      .maybeSingle()

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      data: consent
    })
  } catch (error) {
    apiLogger.error('Record consent error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to record consent' },
      { status: 500 }
    )
  }
}

// GET - Get consent status for a phone number
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

    const phone_number = searchParams.get('phone')

    if (!phone_number) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
    }

    const normalizedPhone = normalizePhoneNumber(phone_number)

    const { data: consent, error } = await supabase
      .from('ts_customer_consent')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('is_active', true)
      .order('consented_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (!consent) {
      return NextResponse.json({
        success: true,
        data: {
          has_consent: false,
          consent_type: null,
          reason: 'No consent record found'
        }
      })
    }

    // Check if expired
    const isExpired = consent.expires_at && new Date(consent.expires_at) < new Date()

    return NextResponse.json({
      success: true,
      data: {
        has_consent: !isExpired && consent.consent_type !== 'OPT_OUT',
        consent_type: consent.consent_type,
        consent_channel: consent.consent_channel,
        categories: consent.consent_categories || [],
        consented_at: consent.consented_at,
        expires_at: consent.expires_at,
        is_expired: isExpired,
        consent_proof: consent.consent_proof
      }
    })
  } catch (error) {
    apiLogger.error('Get consent error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get consent status' },
      { status: 500 }
    )
  }
}

// PUT - Update consent (revoke or modify)
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { consent_id, action, ...updates } = body

    if (!consent_id || !action) {
      return NextResponse.json({ success: false, error: 'Consent ID and action are required' }, { status: 400 })
    }

    if (action === 'REVOKE') {
      const { data, error } = await supabase
        .from('ts_customer_consent')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', consent_id)
        .select()
        .maybeSingle()

      if (error) throw error

      return NextResponse.json({ success: true, data, message: 'Consent revoked' })
    }

    if (action === 'UPDATE') {
      const { data, error } = await supabase
        .from('ts_customer_consent')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', consent_id)
        .select()
        .maybeSingle()

      if (error) throw error

      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Update consent error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update consent' },
      { status: 500 }
    )
  }
}
