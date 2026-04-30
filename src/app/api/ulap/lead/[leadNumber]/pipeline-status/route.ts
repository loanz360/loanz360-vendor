
/**
 * Pipeline Status API
 * GET /api/ulap/lead/[leadNumber]/pipeline-status
 *
 * Returns the current pipeline status for a ULAP lead.
 * Used by the frontend to show progress to DSE/Partners.
 *
 * Access: Lead generator (DSE/Partner), BDE (if assigned), Super Admin
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createULAPPipelineService } from '@/lib/services/ulap-pipeline-service'
import { apiLogger } from '@/lib/utils/logger'

interface RouteParams {
  params: Promise<{ leadNumber: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { leadNumber } = await params

    if (!leadNumber) {
      return NextResponse.json(
        { success: false, error: 'Lead number is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify access: lead generator, assigned BDE, or admin
    const { data: lead } = await supabase
      .from('leads')
      .select('id, lead_generator_id, assigned_bde_id')
      .eq('lead_number', leadNumber)
      .maybeSingle()

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      )
    }

    const isGenerator = lead.lead_generator_id === user.id
    const isAssignedBDE = lead.assigned_bde_id === user.id

    // Check admin access
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .in('role', ['SUPER_ADMIN', 'ADMIN'])
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = !!adminUser || !!superAdmin

    if (!isGenerator && !isAssignedBDE && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const pipelineService = createULAPPipelineService(supabase)
    const status = await pipelineService.getPipelineStatus(leadNumber)

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Pipeline status not available' },
        { status: 404 }
      )
    }

    // For non-admin users, hide sensitive BDE details before assignment
    if (!isAdmin && !isAssignedBDE) {
      if (status.pipeline_status !== 'BDE_ASSIGNED' && status.pipeline_status !== 'COMPLETED') {
        delete status.bde_name
        delete status.bde_id
      }
    }

    return NextResponse.json({
      success: true,
      data: status,
    })

  } catch (error) {
    apiLogger.error('Pipeline status error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
