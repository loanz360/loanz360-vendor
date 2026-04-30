import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'


const reassignSchema = z.object({
  departingCroId: z.string().uuid(),
  newCroId: z.string().uuid(),
})

/**
 * POST /api/superadmin/cro-reassign
 * Reassign all entities from a departing CRO to a new CRO.
 * SuperAdmin/Admin only.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: userRole } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .in('role', ['SUPER_ADMIN', 'ADMIN'])
      .maybeSingle()

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const parsed = reassignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const { departingCroId, newCroId } = parsed.data

    if (departingCroId === newCroId) {
      return NextResponse.json({
        success: false,
        error: 'Cannot reassign to the same CRO',
      }, { status: 400 })
    }

    // Verify both CROs exist
    const { data: departingCro } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name')
      .eq('user_id', departingCroId)
      .maybeSingle()

    const { data: newCro } = await supabase
      .from('employee_profile')
      .select('user_id, first_name, last_name, status')
      .eq('user_id', newCroId)
      .maybeSingle()

    if (!departingCro) {
      return NextResponse.json({ success: false, error: 'Departing CRO not found' }, { status: 404 })
    }
    if (!newCro) {
      return NextResponse.json({ success: false, error: 'New CRO not found' }, { status: 404 })
    }
    if (newCro.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, error: 'New CRO is not active' }, { status: 400 })
    }

    // Execute reassignment stored procedure
    const { data: result, error: rpcError } = await supabase.rpc('reassign_cro_entities', {
      p_departing_cro_id: departingCroId,
      p_new_cro_id: newCroId,
      p_reassigned_by: session.user.id,
    })

    if (rpcError) {
      apiLogger.error('CRO reassignment RPC error:', rpcError)
      return NextResponse.json({ success: false, error: 'Failed to reassign CRO entities' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully reassigned entities from ${departingCro.first_name} ${departingCro.last_name} to ${newCro.first_name} ${newCro.last_name}`,
    })
  } catch (error) {
    apiLogger.error('CRO reassignment error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
