/**
 * Opt-Out Management API
 * Enterprise-grade GDPR/DND compliance
 *
 * Features:
 * - Multi-channel opt-out (SMS, Email, WhatsApp)
 * - Bulk import/export
 * - Audit trail
 * - DND registry integration ready
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// =====================================================
// TYPES
// =====================================================

type OptOutChannel = 'sms' | 'email' | 'whatsapp' | 'all'
type OptOutReason = 'user_request' | 'bounce' | 'complaint' | 'dnd_registry' | 'admin' | 'other'
type OptOutSource = 'api' | 'webhook' | 'manual' | 'bulk_import' | 'unsubscribe_link'

interface OptOutRecord {
  id: string
  identifier: string
  identifierType: 'phone' | 'email'
  channel: OptOutChannel
  reason: OptOutReason
  source: OptOutSource
  isActive: boolean
  optedOutAt: string
  optedInAt?: string
  notes?: string
  metadata?: Record<string, any>
  createdBy?: string
  updatedBy?: string
}

interface BulkOptOutRequest {
  identifiers: string[]
  channel: OptOutChannel
  reason: OptOutReason
  notes?: string
}

// =====================================================
// GET - List opt-outs with filtering
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Parse query params
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const channel = searchParams.get('channel') as OptOutChannel | null
    const reason = searchParams.get('reason') as OptOutReason | null
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const exportFormat = searchParams.get('export')

    // Build query
    let query = supabase
      .from('communication_optouts')
      .select('*', { count: 'exact' })

    // Apply filters
    if (channel && channel !== 'all') {
      query = query.eq('channel', channel)
    }

    if (reason) {
      query = query.eq('reason', reason)
    }

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.ilike('identifier', `%${safeSearch}%`)
      }
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (startDate) {
      query = query.gte('opted_out_at', startDate)
    }

    if (endDate) {
      query = query.lte('opted_out_at', endDate)
    }

    // Handle export
    if (exportFormat === 'csv') {
      const { data: allData, error } = await query.order('opted_out_at', { ascending: false })

      if (error) {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
      }

      const csvRows = [
        'Identifier,Type,Channel,Reason,Source,Status,Opted Out At,Notes'
      ]

      for (const record of allData || []) {
        csvRows.push([
          record.identifier,
          record.identifier_type,
          record.channel,
          record.reason,
          record.source,
          record.is_active ? 'Active' : 'Inactive',
          record.opted_out_at,
          `"${(record.notes || '').replace(/"/g, '""')}"`
        ].join(','))
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=optouts_${new Date().toISOString().split('T')[0]}.csv`
        }
      })
    }

    // Paginate
    const offset = (page - 1) * limit
    query = query
      .order('opted_out_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase
    const records: OptOutRecord[] = (data || []).map(r => ({
      id: r.id,
      identifier: r.identifier,
      identifierType: r.identifier_type,
      channel: r.channel,
      reason: r.reason,
      source: r.source,
      isActive: r.is_active,
      optedOutAt: r.opted_out_at,
      optedInAt: r.opted_in_at,
      notes: r.notes,
      metadata: r.metadata,
      createdBy: r.created_by,
      updatedBy: r.updated_by
    }))

    // Get summary stats
    const { data: stats } = await supabase
      .from('communication_optouts')
      .select('channel, is_active')
      .eq('is_active', true)

    const summary = {
      totalActive: stats?.length || 0,
      byChannel: {
        sms: stats?.filter(s => s.channel === 'sms').length || 0,
        email: stats?.filter(s => s.channel === 'email').length || 0,
        whatsapp: stats?.filter(s => s.channel === 'whatsapp').length || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary
    })
  } catch (error: unknown) {
    apiLogger.error('[OptOuts API] GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// POST - Add opt-out (single or bulk)
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()
    const userId = request.headers.get('x-user-id')

    // Check if bulk operation
    if (body.identifiers && Array.isArray(body.identifiers)) {
      return handleBulkOptOut(supabase, body as BulkOptOutRequest, userId)
    }

    // Single opt-out
    const { identifier, channel, reason, source, notes, metadata } = body

    if (!identifier || !channel) {
      return NextResponse.json(
        { success: false, error: 'identifier and channel are required' },
        { status: 400 }
      )
    }

    // Determine identifier type
    const identifierType = identifier.includes('@') ? 'email' : 'phone'

    // Normalize identifier
    const normalizedIdentifier = identifierType === 'phone'
      ? normalizePhone(identifier)
      : identifier.toLowerCase().trim()

    // Upsert opt-out record
    const { data, error } = await supabase
      .from('communication_optouts')
      .upsert({
        identifier: normalizedIdentifier,
        identifier_type: identifierType,
        channel: channel,
        reason: reason || 'user_request',
        source: source || 'api',
        is_active: true,
        opted_out_at: new Date().toISOString(),
        notes: notes,
        metadata: metadata,
        created_by: userId,
        updated_by: userId
      }, {
        onConflict: 'identifier,channel'
      })
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Log audit
    await logAudit(supabase, 'opt_out_created', {
      identifier: normalizedIdentifier,
      channel,
      reason,
      source
    }, userId)

    return NextResponse.json({
      success: true,
      message: 'Opt-out recorded successfully',
      data: {
        id: data.id,
        identifier: data.identifier,
        channel: data.channel,
        isActive: data.is_active
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[OptOuts API] POST error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// PATCH - Update opt-out (opt-in / modify)
// =====================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const body = await request.json()
    const userId = request.headers.get('x-user-id')

    const { id, identifier, channel, action, notes } = body

    // Support lookup by id or identifier+channel
    let query = supabase.from('communication_optouts')

    if (id) {
      query = query.eq('id', id)
    } else if (identifier && channel) {
      const normalizedIdentifier = identifier.includes('@')
        ? identifier.toLowerCase().trim()
        : normalizePhone(identifier)
      query = query.eq('identifier', normalizedIdentifier).eq('channel', channel)
    } else {
      return NextResponse.json(
        { success: false, error: 'id or (identifier + channel) required' },
        { status: 400 }
      )
    }

    // Handle different actions
    switch (action) {
      case 'opt_in':
        // Re-subscribe user
        const { data: optInData, error: optInError } = await query
          .update({
            is_active: false,
            opted_in_at: new Date().toISOString(),
            notes: notes || 'User opted back in',
            updated_by: userId
          })
          .select()
          .maybeSingle()

        if (optInError) {
          return NextResponse.json({ success: false, error: optInError.message }, { status: 500 })
        }

        await logAudit(supabase, 'opt_in', {
          identifier: optInData.identifier,
          channel: optInData.channel
        }, userId)

        return NextResponse.json({
          success: true,
          message: 'User opted back in successfully',
          data: optInData
        })

      case 'update_notes':
        const { data: updateData, error: updateError } = await query
          .update({
            notes: notes,
            updated_by: userId
          })
          .select()
          .maybeSingle()

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Notes updated',
          data: updateData
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: opt_in, update_notes' },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    apiLogger.error('[OptOuts API] PATCH error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// DELETE - Remove opt-out record
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const userId = request.headers.get('x-user-id')

    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    // Get record before deleting for audit
    const { data: existing } = await supabase
      .from('communication_optouts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    // Delete
    const { error } = await supabase
      .from('communication_optouts')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Log audit
    if (existing) {
      await logAudit(supabase, 'opt_out_deleted', {
        identifier: existing.identifier,
        channel: existing.channel
      }, userId)
    }

    return NextResponse.json({
      success: true,
      message: 'Opt-out record deleted'
    })
  } catch (error: unknown) {
    apiLogger.error('[OptOuts API] DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function handleBulkOptOut(
  supabase: any,
  request: BulkOptOutRequest,
  userId?: string | null
) {
  const { identifiers, channel, reason, notes } = request

  if (!identifiers.length) {
    return NextResponse.json(
      { success: false, error: 'identifiers array cannot be empty' },
      { status: 400 }
    )
  }

  if (identifiers.length > 10000) {
    return NextResponse.json(
      { success: false, error: 'Maximum 10,000 identifiers per request' },
      { status: 400 }
    )
  }

  const results = {
    total: identifiers.length,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  }

  // Process in batches of 100
  const batchSize = 100
  for (let i = 0; i < identifiers.length; i += batchSize) {
    const batch = identifiers.slice(i, i + batchSize)

    const records = batch.map(identifier => {
      const identifierType = identifier.includes('@') ? 'email' : 'phone'
      const normalizedIdentifier = identifierType === 'phone'
        ? normalizePhone(identifier)
        : identifier.toLowerCase().trim()

      return {
        identifier: normalizedIdentifier,
        identifier_type: identifierType,
        channel: channel,
        reason: reason || 'admin',
        source: 'bulk_import' as OptOutSource,
        is_active: true,
        opted_out_at: new Date().toISOString(),
        notes: notes,
        created_by: userId,
        updated_by: userId
      }
    })

    const { error } = await supabase
      .from('communication_optouts')
      .upsert(records, {
        onConflict: 'identifier,channel'
      })

    if (error) {
      results.failed += batch.length
      results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : String(error)}`)
    } else {
      results.successful += batch.length
    }
  }

  // Log audit
  await logAudit(supabase, 'bulk_opt_out', {
    channel,
    reason,
    total: results.total,
    successful: results.successful,
    failed: results.failed
  }, userId)

  return NextResponse.json({
    success: results.failed === 0,
    message: `Processed ${results.total} identifiers`,
    results
  })
}

function normalizePhone(phone: string): string {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '')

  // Add country code if missing (assuming India)
  if (digits.length === 10) {
    digits = '91' + digits
  }

  // Ensure it starts with +
  return '+' + digits
}

async function logAudit(
  supabase: any,
  action: string,
  details: Record<string, any>,
  userId?: string | null
) {
  try {
    await supabase
      .from('communication_audit_log')
      .insert({
        action_type: action,
        entity_type: 'optout',
        entity_id: details.identifier,
        changes: details,
        performed_by: userId,
        ip_address: null
      })
  } catch (error) {
    apiLogger.error('[OptOuts API] Audit log error', error)
  }
}
