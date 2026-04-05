export const dynamic = 'force-dynamic'

/**
 * Pipeline Retry/Trigger API
 * POST /api/ulap/pipeline/trigger
 *
 * Allows Super Admin to:
 * - Retry a failed pipeline
 * - Manually trigger pipeline for a lead
 * - Retry from a specific step (bridge, cam, deal, bde)
 *
 * Access: Super Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createULAPPipelineService } from '@/lib/services/ulap-pipeline-service'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify Super Admin access
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const { data: adminUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .in('role', ['SUPER_ADMIN', 'ADMIN'])
      .maybeSingle()

    if (!superAdmin && !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super Admin only.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { lead_id, lead_number, from_step } = body

    if (!lead_id && !lead_number) {
      return NextResponse.json(
        { success: false, error: 'lead_id or lead_number is required' },
        { status: 400 }
      )
    }

    // Resolve lead_id from lead_number if needed
    let resolvedLeadId = lead_id
    if (!resolvedLeadId && lead_number) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('lead_number', lead_number)
        .maybeSingle()

      if (!lead) {
        return NextResponse.json(
          { success: false, error: `Lead not found: ${lead_number}` },
          { status: 404 }
        )
      }
      resolvedLeadId = lead.id
    }

    // Validate from_step
    const validSteps = ['bridge', 'cam', 'deal', 'bde']
    if (from_step && !validSteps.includes(from_step)) {
      return NextResponse.json(
        { success: false, error: `Invalid step. Must be one of: ${validSteps.join(', ')}` },
        { status: 400 }
      )
    }

    const pipelineService = createULAPPipelineService(supabase)
    const result = await pipelineService.retryPipeline(resolvedLeadId, from_step)

    return NextResponse.json({
      success: result.success,
      data: result,
    })

  } catch (error) {
    apiLogger.error('Pipeline trigger error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
