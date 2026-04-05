import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'

export const dynamic = 'force-dynamic'

const createLogSchema = z.object({
  partner_id: z.string().uuid(),
  channel: z.enum(['WHATSAPP', 'CALL', 'EMAIL', 'SMS', 'IN_PERSON', 'VIDEO_CALL']),
  direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'),
  subject: z.string().max(255).optional(),
  summary: z.string().max(2000).optional(),
  outcome: z.string().max(50).optional(),
  duration_seconds: z.number().int().min(0).optional(),
  next_action: z.string().max(255).optional(),
  next_action_date: z.string().datetime().optional(),
})

// GET - List communication logs for a partner
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
        { success: false, error: 'partner_id is required' },
        { status: 400 }
      )
    }

    // Verify partner belongs to DSE
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('id', partnerId)
      .eq('recruited_by_cpe', userId)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      )
    }

    const { data: logs, error, count } = await supabase
      .from('partner_communication_log')
      .select('*', { count: 'exact' })
      .eq('dse_user_id', userId)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      apiLogger.error('DSE partner communication log error', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      meta: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE partner comm log error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Log a communication event
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    const body = await request.json()
    const validated = createLogSchema.parse(body)

    // Verify partner belongs to DSE
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('id', validated.partner_id)
      .eq('recruited_by_cpe', userId)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Partner not found' },
        { status: 404 }
      )
    }

    const { data: log, error } = await supabase
      .from('partner_communication_log')
      .insert({
        dse_user_id: userId,
        ...validated,
      })
      .select()
      .single()

    if (error) {
      apiLogger.error('DSE partner comm log create error', error)
      return NextResponse.json({ success: false, error: 'Failed to log communication' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Communication logged successfully',
      data: log,
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    apiLogger.error('DSE partner comm log error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
