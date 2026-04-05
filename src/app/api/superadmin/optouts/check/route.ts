/**
 * Opt-Out Check API
 * Real-time validation before sending messages
 *
 * Features:
 * - Single identifier check
 * - Bulk validation
 * - Multi-channel support
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================
// POST - Check if identifier(s) are opted out
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const { identifier, identifiers, channel = 'all' } = body

    // Single check
    if (identifier && !identifiers) {
      const result = await checkSingleOptOut(supabase, identifier, channel)
      return NextResponse.json({
        success: true,
        ...result
      })
    }

    // Bulk check
    if (identifiers && Array.isArray(identifiers)) {
      if (identifiers.length > 1000) {
        return NextResponse.json(
          { success: false, error: 'Maximum 1,000 identifiers per request' },
          { status: 400 }
        )
      }

      const results = await checkBulkOptOut(supabase, identifiers, channel)
      return NextResponse.json({
        success: true,
        ...results
      })
    }

    return NextResponse.json(
      { success: false, error: 'identifier or identifiers[] required' },
      { status: 400 }
    )
  } catch (error: unknown) {
    apiLogger.error('[OptOut Check] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function checkSingleOptOut(
  supabase: any,
  identifier: string,
  channel: string
) {
  const normalizedIdentifier = normalizeIdentifier(identifier)

  let query = supabase
    .from('communication_optouts')
    .select('channel, reason, opted_out_at')
    .eq('identifier', normalizedIdentifier)
    .eq('is_active', true)

  if (channel !== 'all') {
    query = query.eq('channel', channel)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const isOptedOut = data && data.length > 0

  return {
    identifier: normalizedIdentifier,
    isOptedOut,
    channels: isOptedOut ? data.map((d: any) => ({
      channel: d.channel,
      reason: d.reason,
      optedOutAt: d.opted_out_at
    })) : [],
    canSend: {
      sms: !data?.some((d: any) => d.channel === 'sms' || d.channel === 'all'),
      email: !data?.some((d: any) => d.channel === 'email' || d.channel === 'all'),
      whatsapp: !data?.some((d: any) => d.channel === 'whatsapp' || d.channel === 'all')
    }
  }
}

async function checkBulkOptOut(
  supabase: any,
  identifiers: string[],
  channel: string
) {
  const normalizedIdentifiers = identifiers.map(normalizeIdentifier)

  let query = supabase
    .from('communication_optouts')
    .select('identifier, channel, reason')
    .in('identifier', normalizedIdentifiers)
    .eq('is_active', true)

  if (channel !== 'all') {
    query = query.eq('channel', channel)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  // Create a map of opted-out identifiers
  const optedOutMap = new Map<string, string[]>()
  for (const record of data || []) {
    const channels = optedOutMap.get(record.identifier) || []
    channels.push(record.channel)
    optedOutMap.set(record.identifier, channels)
  }

  // Categorize results
  const results = {
    total: identifiers.length,
    optedOut: [] as string[],
    canSend: [] as string[],
    details: {} as Record<string, { isOptedOut: boolean; channels: string[] }>
  }

  for (let i = 0; i < identifiers.length; i++) {
    const original = identifiers[i]
    const normalized = normalizedIdentifiers[i]
    const channels = optedOutMap.get(normalized) || []

    const isOptedOut = channels.length > 0 && (
      channel === 'all' || channels.includes(channel) || channels.includes('all')
    )

    if (isOptedOut) {
      results.optedOut.push(original)
    } else {
      results.canSend.push(original)
    }

    results.details[original] = {
      isOptedOut,
      channels
    }
  }

  return {
    ...results,
    summary: {
      canSendCount: results.canSend.length,
      optedOutCount: results.optedOut.length,
      percentageBlocked: Math.round((results.optedOut.length / results.total) * 100)
    }
  }
}

function normalizeIdentifier(identifier: string): string {
  if (identifier.includes('@')) {
    return identifier.toLowerCase().trim()
  }

  // Phone number
  let digits = identifier.replace(/\D/g, '')
  if (digits.length === 10) {
    digits = '91' + digits
  }
  return '+' + digits
}
