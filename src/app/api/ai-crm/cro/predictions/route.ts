import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { predictConversion } from '@/lib/ai/conversion-predictor'
import { apiLogger } from '@/lib/utils/logger'


interface TimelineEntry {
  type: string
  ai_rating?: number
  sentiment?: string
  interest_level?: string
  call_duration?: number
  created_at?: string
  timestamp?: string
}

/**
 * GET /api/ai-crm/cro/predictions?type=contact|lead&id=xxx
 *
 * Returns AI conversion prediction for a contact or lead.
 * Also supports batch predictions: GET /api/ai-crm/cro/predictions?type=leads
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('type') || 'lead'
    const entityId = searchParams.get('id')

    if (entityId) {
      // Single entity prediction
      const prediction = await getSinglePrediction(supabase, user.id, entityType, entityId)
      if (!prediction) {
        return NextResponse.json(
          { success: false, error: 'Entity not found or unauthorized' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, data: prediction })
    }

    // Batch predictions for all leads/contacts
    if (entityType === 'leads') {
      const predictions = await getBatchLeadPredictions(supabase, user.id)
      return NextResponse.json({ success: true, data: predictions })
    }

    if (entityType === 'contacts') {
      const predictions = await getBatchContactPredictions(supabase, user.id)
      return NextResponse.json({ success: true, data: predictions })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type. Use "lead", "contact", "leads", or "contacts"' },
      { status: 400 }
    )
  } catch (error) {
    apiLogger.error('Error in predictions API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getSinglePrediction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  entityType: string,
  entityId: string
) {
  const table = entityType === 'contact' ? 'crm_contacts' : 'crm_leads'
  const ownerField = entityType === 'contact' ? 'assigned_to_cro' : 'cro_id'

  const { data: entity } = await supabase
    .from(table)
    .select('*')
    .eq('id', entityId)
    .eq(ownerField, userId)
    .maybeSingle()

  if (!entity) return null

  const input = extractPredictionInput(entity, entityType)
  const prediction = predictConversion(input)

  return {
    entity_id: entityId,
    entity_type: entityType,
    entity_name: entity.customer_name || entity.name,
    ...prediction,
  }
}

async function getBatchLeadPredictions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: leads } = await supabase
    .from('crm_leads')
    .select('id, customer_name, loan_type, loan_amount, stage, status, call_count, last_called_at, documents, notes_timeline, created_at')
    .eq('cro_id', userId)
    .neq('status', 'converted')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!leads) return []

  return leads.map((lead) => {
    const input = extractPredictionInput(lead, 'lead')
    const prediction = predictConversion(input)
    return {
      entity_id: lead.id,
      entity_type: 'lead',
      entity_name: lead.customer_name,
      loan_type: lead.loan_type,
      loan_amount: lead.loan_amount,
      stage: lead.stage,
      probability: prediction.probability,
      confidence: prediction.confidence,
      estimatedClosingDays: prediction.estimatedClosingDays,
      estimatedClosingDate: prediction.estimatedClosingDate,
      recommendation: prediction.recommendation,
    }
  }).sort((a, b) => b.probability - a.probability)
}

async function getBatchContactPredictions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, name, loan_type, loan_amount, status, call_count, last_called_at, notes_timeline, created_at')
    .eq('assigned_to_cro', userId)
    .in('status', ['new', 'called', 'follow_up', 'positive'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (!contacts) return []

  return contacts.map((contact) => {
    const input = extractPredictionInput(contact, 'contact')
    const prediction = predictConversion(input)
    return {
      entity_id: contact.id,
      entity_type: 'contact',
      entity_name: contact.name,
      loan_type: contact.loan_type,
      loan_amount: contact.loan_amount,
      status: contact.status,
      probability: prediction.probability,
      confidence: prediction.confidence,
      estimatedClosingDays: prediction.estimatedClosingDays,
      estimatedClosingDate: prediction.estimatedClosingDate,
      recommendation: prediction.recommendation,
    }
  }).sort((a, b) => b.probability - a.probability)
}

function extractPredictionInput(entity: Record<string, unknown>, entityType: string) {
  const timeline = (entity.notes_timeline as TimelineEntry[]) || []
  const documents = (entity.documents as Array<Record<string, unknown>>) || []

  // Extract AI analysis
  const aiNotes = timeline
    .filter((n) => n.type === 'ai_transcript' && n.ai_rating)
    .sort((a, b) =>
      new Date(b.created_at || b.timestamp || '').getTime() -
      new Date(a.created_at || a.timestamp || '').getTime()
    )

  const latestAI = aiNotes[0] || null
  const callLogs = timeline.filter((n) => n.type === 'call_log' || n.type === 'call_recording')
  const manualNotes = timeline.filter((n) => n.type === 'manual_note')

  const createdAt = entity.created_at as string || new Date().toISOString()
  const daysInPipeline = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  const lastCalledAt = entity.last_called_at as string | null
  const lastContactedDaysAgo = lastCalledAt
    ? Math.floor((Date.now() - new Date(lastCalledAt).getTime()) / (1000 * 60 * 60 * 24))
    : daysInPipeline

  return {
    callCount: (entity.call_count as number) || callLogs.length,
    totalCallDuration: callLogs.reduce((sum, n) => sum + (n.call_duration || 0), 0),
    lastContactedDaysAgo,
    notesCount: manualNotes.length,
    latestAIRating: latestAI?.ai_rating || null,
    sentiment: latestAI?.sentiment || null,
    interestLevel: latestAI?.interest_level || null,
    documentsUploaded: documents.length,
    requiredDocuments: 5, // Default estimate
    daysInPipeline,
    currentStage: (entity.stage as string) || (entityType === 'contact' ? 'new' : 'new'),
    loanType: (entity.loan_type as string) || null,
    loanAmount: (entity.loan_amount as number) || null,
  }
}
