import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cro/documents?entityId=...&entityType=...
 * Fetches document checklist status for a specific entity.
 * Stored in entity's notes_timeline as type='document_checklist'.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
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

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')
    const entityType = searchParams.get('entityType')

    if (!entityId || !entityType) {
      return NextResponse.json({ success: false, error: 'entityId and entityType required' }, { status: 400 })
    }

    const tableMap: Record<string, string> = {
      contact: 'crm_contacts',
      positive_contact: 'positive_contacts',
      lead: 'crm_leads',
    }
    const table = tableMap[entityType]
    if (!table) {
      return NextResponse.json({ success: false, error: 'Invalid entityType' }, { status: 400 })
    }

    const { data: entity } = await supabase
      .from(table)
      .select('notes_timeline')
      .eq('id', entityId)
      .maybeSingle()

    if (!entity) {
      return NextResponse.json({ success: true, data: [] })
    }

    const timeline = Array.isArray(entity.notes_timeline) ? entity.notes_timeline : []
    const docEntry = timeline.find(
      (n: Record<string, unknown>) => n.type === 'document_checklist'
    )

    return NextResponse.json({
      success: true,
      data: docEntry?.documents || [],
    })
  } catch (error) {
    apiLogger.error('Document checklist GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/cro/documents
 * Updates document status for an entity. Stores in notes_timeline.
 */
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
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

    const body = await request.json()
    const { entityId, entityType, documentId, status } = body

    if (!entityId || !entityType || !documentId || !status) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const validStatuses = ['pending', 'uploaded', 'verified', 'rejected']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const tableMap: Record<string, string> = {
      contact: 'crm_contacts',
      positive_contact: 'positive_contacts',
      lead: 'crm_leads',
    }
    const table = tableMap[entityType]
    if (!table) {
      return NextResponse.json({ success: false, error: 'Invalid entityType' }, { status: 400 })
    }

    // Fetch current notes_timeline
    const { data: entity, error: fetchError } = await supabase
      .from(table)
      .select('notes_timeline')
      .eq('id', entityId)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json({ success: false, error: 'Entity not found' }, { status: 404 })
    }

    const timeline = Array.isArray(entity.notes_timeline) ? entity.notes_timeline : []
    const docIdx = timeline.findIndex(
      (n: Record<string, unknown>) => n.type === 'document_checklist'
    )

    if (docIdx >= 0) {
      // Update existing document status
      const docs = Array.isArray(timeline[docIdx].documents) ? timeline[docIdx].documents : []
      const docItemIdx = docs.findIndex((d: Record<string, unknown>) => d.id === documentId)
      if (docItemIdx >= 0) {
        docs[docItemIdx].status = status
        docs[docItemIdx].updated_at = new Date().toISOString()
        if (status === 'uploaded') {
          docs[docItemIdx].uploaded_at = new Date().toISOString()
        }
      } else {
        docs.push({ id: documentId, status, updated_at: new Date().toISOString() })
      }
      timeline[docIdx].documents = docs
      timeline[docIdx].updated_at = new Date().toISOString()
    } else {
      // Create new document checklist entry
      timeline.push({
        id: `doc-checklist-${Date.now()}`,
        type: 'document_checklist',
        content: 'Document checklist created',
        documents: [{ id: documentId, status, updated_at: new Date().toISOString() }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.id,
      })
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({ notes_timeline: timeline, updated_at: new Date().toISOString() })
      .eq('id', entityId)

    if (updateError) {
      apiLogger.error('Document update error:', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Document status updated' })
  } catch (error) {
    apiLogger.error('Document checklist PUT error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
