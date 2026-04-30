import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { maskRecord } from '@/lib/utils/data-masking'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/cro/customer-360/[id]
 * Aggregated customer view: profile, pipeline stage, calls, notes, documents, follow-ups
 * [id] can be a contact, positive_contact, or lead ID
 * Query param: type=contact|positive_contact|lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { id: entityId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Role verification - only CRO roles can access this endpoint
    const userRole = user.user_metadata?.sub_role || user.user_metadata?.role || ''
    const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
    if (!allowedRoles.some(r => userRole.toUpperCase() === r)) {
      return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
    }

    const entityType = request.nextUrl.searchParams.get('type') || 'lead'
    const userId = user.id

    // Fetch entity data based on type
    let entityData: Record<string, unknown> | null = null

    if (entityType === 'contact') {
      const { data } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('id', entityId)
        .or(`cro_id.eq.${userId},assigned_to_cro.eq.${userId}`)
        .maybeSingle()
      entityData = data
    } else if (entityType === 'positive_contact') {
      const { data } = await supabase
        .from('positive_contacts')
        .select('*')
        .eq('id', entityId)
        .eq('cro_id', userId)
        .maybeSingle()
      entityData = data
    } else {
      const { data } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('id', entityId)
        .eq('cro_id', userId)
        .maybeSingle()
      entityData = data
    }

    if (!entityData) {
      return NextResponse.json({ success: false, error: 'Entity not found' }, { status: 404 })
    }

    // Parallel fetch related data
    const [callLogsResult, followupsResult, chatResult] = await Promise.all([
      // Call logs
      supabase
        .from('cro_call_logs')
        .select('id, call_outcome, call_duration_seconds, call_started_at, ai_rating, ai_summary, interest_level, disposition_notes')
        .eq('entity_table_id', entityId)
        .eq('cro_id', userId)
        .order('call_started_at', { ascending: false })
        .limit(20),

      // Follow-ups
      supabase
        .from('crm_followups')
        .select('id, scheduled_at, title, status, created_at')
        .eq('lead_id', entityId)
        .eq('owner_id', userId)
        .order('scheduled_at', { ascending: false })
        .limit(10),

      // Chat conversation
      supabase
        .from('chat_conversations')
        .select('id, status, last_message_at, unread_cro_count, last_message_preview')
        .eq('entity_id', entityId)
        .eq('cro_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
    ])

    // Notes timeline from the entity
    const notesTimeline = Array.isArray(entityData.notes_timeline)
      ? entityData.notes_timeline
      : []

    // Pipeline stage
    const pipelineStages = ['contact', 'positive_contact', 'lead', 'deal']
    const currentStageIndex = pipelineStages.indexOf(entityType)

    // Mask PII for CRO role
    const maskRole = user.user_metadata?.sub_role || user.user_metadata?.role || 'CRO'
    const shouldMask = !['SUPER_ADMIN', 'ADMIN'].includes(maskRole)
    const maskedEntity = maskRecord(entityData as Record<string, unknown>, shouldMask)

    return NextResponse.json({
      success: true,
      data: {
        entity: maskedEntity,
        entityType,
        pipeline: {
          stages: pipelineStages.map((stage, idx) => ({
            name: stage.replace(/_/g, ' '),
            isCurrent: idx === currentStageIndex,
            isCompleted: idx < currentStageIndex,
          })),
          currentStage: entityType,
        },
        callLogs: callLogsResult.data || [],
        followups: followupsResult.data || [],
        notesTimeline,
        chat: chatResult.data || null,
        summary: {
          totalCalls: callLogsResult.data?.length || 0,
          avgAIRating: callLogsResult.data?.length
            ? callLogsResult.data.reduce((sum, c) => sum + (c.ai_rating || 0), 0) / callLogsResult.data.filter(c => c.ai_rating).length || 0
            : 0,
          pendingFollowups: (followupsResult.data || []).filter(f => f.status === 'Pending').length,
          hasChat: !!chatResult.data,
        },
      },
    })
  } catch (error) {
    apiLogger.error('Customer 360 error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
