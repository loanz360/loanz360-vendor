import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'


const createNoteSchema = z.object({
  partner_id: z.string().uuid('Invalid partner ID'),
  note_type: z.enum(['GENERAL', 'FOLLOW_UP', 'QUALITY_ISSUE', 'TRAINING', 'ESCALATION', 'APPRECIATION']).default('GENERAL'),
  content: z.string().min(1, 'Note content is required').max(5000, 'Note too long (max 5000 chars)'),
  is_pinned: z.boolean().optional().default(false),
})

// GET - List notes for a partner
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partner_id')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: 'partner_id is required', code: 'MISSING_PARAM' },
        { status: 400 }
      )
    }

    // Verify this partner belongs to the DSE
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('id', partnerId)
      .eq('recruited_by_cpe', userId)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found or not in your network', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const { data: notes, error, count } = await supabase
      .from('dse_partner_notes')
      .select('*', { count: 'exact' })
      .eq('dse_user_id', userId)
      .eq('partner_id', partnerId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      apiLogger.error('DSE partner notes fetch error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notes', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: notes || [],
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE partner notes error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a note for a partner
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validated = createNoteSchema.parse(body)

    // Verify partner belongs to DSE
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('id', validated.partner_id)
      .eq('recruited_by_cpe', userId)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found or not in your network', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const { data: note, error } = await supabase
      .from('dse_partner_notes')
      .insert({
        dse_user_id: userId,
        partner_id: validated.partner_id,
        note_type: validated.note_type,
        content: validated.content,
        is_pinned: validated.is_pinned,
      })
      .select()
      .single()

    if (error) {
      apiLogger.error('DSE partner note create error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create note', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Note created successfully',
      data: note,
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('DSE partner note create error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
