
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyTicket,
  analyzeSentiment,
  getResponseSuggestions,
  findSimilarTickets,
  getTicketInsights,
  autoTagTicket,
  detectTrends
} from '@/lib/tickets/ai-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/ai
 * Get AI insights, suggestions, or analysis
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'insights'

    // Mode: Get ticket insights
    if (mode === 'insights') {
      const ticketId = searchParams.get('ticket_id')
      const ticketSource = searchParams.get('ticket_source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
      const subject = searchParams.get('subject') || ''
      const description = searchParams.get('description') || ''

      if (!ticketId || !ticketSource) {
        return NextResponse.json(
          { error: 'ticket_id and ticket_source are required' },
          { status: 400 }
        )
      }

      const insights = await getTicketInsights(ticketId, ticketSource, subject, description)
      return NextResponse.json({ insights })
    }

    // Mode: Get response suggestions
    if (mode === 'suggestions') {
      const ticketId = searchParams.get('ticket_id')
      const ticketSource = searchParams.get('ticket_source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'
      const subject = searchParams.get('subject') || ''
      const description = searchParams.get('description') || ''
      const category = searchParams.get('category') || undefined

      if (!ticketId || !ticketSource) {
        return NextResponse.json(
          { error: 'ticket_id and ticket_source are required' },
          { status: 400 }
        )
      }

      const suggestions = await getResponseSuggestions(
        ticketId,
        ticketSource,
        subject,
        description,
        category
      )
      return NextResponse.json({ suggestions })
    }

    // Mode: Find similar tickets
    if (mode === 'similar') {
      const subject = searchParams.get('subject') || ''
      const description = searchParams.get('description') || ''
      const category = searchParams.get('category') || undefined
      const excludeTicketId = searchParams.get('exclude_ticket_id') || undefined
      const limit = parseInt(searchParams.get('limit') || '5')

      const similarTickets = await findSimilarTickets(
        subject,
        description,
        category,
        excludeTicketId
      )

      return NextResponse.json({
        similar_tickets: similarTickets.slice(0, limit)
      })
    }

    // Mode: Detect trends
    if (mode === 'trends') {
      const days = parseInt(searchParams.get('days') || '7')
      const trends = await detectTrends(days)
      return NextResponse.json({ trends })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('AI API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/ai
 * Perform AI classification, sentiment analysis, or auto-tagging
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, subject, description, text, ticket_id, ticket_source } = body

    // Action: Classify ticket
    if (action === 'classify') {
      if (!subject && !description) {
        return NextResponse.json(
          { error: 'subject or description required for classification' },
          { status: 400 }
        )
      }

      const classification = await classifyTicket(subject || '', description || '')
      return NextResponse.json({ classification })
    }

    // Action: Analyze sentiment
    if (action === 'sentiment') {
      if (!text && !description) {
        return NextResponse.json(
          { error: 'text or description required for sentiment analysis' },
          { status: 400 }
        )
      }

      const sentiment = analyzeSentiment(text || description)
      return NextResponse.json({ sentiment })
    }

    // Action: Auto-tag ticket
    if (action === 'auto_tag') {
      if (!ticket_id || !ticket_source) {
        return NextResponse.json(
          { error: 'ticket_id and ticket_source required for auto-tagging' },
          { status: 400 }
        )
      }

      if (!subject && !description) {
        return NextResponse.json(
          { error: 'subject or description required for auto-tagging' },
          { status: 400 }
        )
      }

      const tags = await autoTagTicket(
        ticket_id,
        ticket_source,
        subject || '',
        description || ''
      )
      return NextResponse.json({ tags })
    }

    // Action: Full analysis (classify + sentiment + suggestions)
    if (action === 'analyze') {
      if (!ticket_id || !ticket_source) {
        return NextResponse.json(
          { error: 'ticket_id and ticket_source required for analysis' },
          { status: 400 }
        )
      }

      const [classification, sentiment, suggestions, similarTickets] = await Promise.all([
        classifyTicket(subject || '', description || ''),
        Promise.resolve(analyzeSentiment(description || subject || '')),
        getResponseSuggestions(ticket_id, ticket_source, subject || '', description || ''),
        findSimilarTickets(subject || '', description || '', undefined, ticket_id)
      ])

      return NextResponse.json({
        analysis: {
          classification,
          sentiment,
          suggestions: suggestions.slice(0, 3),
          similar_tickets: similarTickets.slice(0, 3)
        }
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('AI API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/ai
 * Apply AI suggestions to a ticket
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ticket_id, ticket_source, apply_classification, apply_tags, apply_priority } = body

    if (!ticket_id || !ticket_source) {
      return NextResponse.json(
        { error: 'ticket_id and ticket_source are required' },
        { status: 400 }
      )
    }

    // Determine table based on source
    const tableMap: Record<string, string> = {
      EMPLOYEE: 'employee_tickets',
      CUSTOMER: 'customer_tickets',
      PARTNER: 'partner_tickets'
    }
    const tableName = tableMap[ticket_source]

    if (!tableName) {
      return NextResponse.json({ success: false, error: 'Invalid ticket source' }, { status: 400 })
    }

    // Get current ticket
    const { data: ticket, error: ticketError } = await supabase
      .from(tableName)
      .select('subject, description, category, priority, tags')
      .eq('id', ticket_id)
      .maybeSingle()

    if (ticketError || !ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    const updates: Record<string, any> = {}

    // Apply classification if requested
    if (apply_classification) {
      const classification = await classifyTicket(
        ticket.subject || '',
        ticket.description || ''
      )
      updates.category = classification.category
      if (apply_priority) {
        updates.priority = classification.priority
      }
    }

    // Apply auto-tags if requested
    if (apply_tags) {
      const newTags = await autoTagTicket(
        ticket_id,
        ticket_source,
        ticket.subject || '',
        ticket.description || ''
      )
      const existingTags = ticket.tags || []
      updates.tags = [...new Set([...existingTags, ...newTags])]
    }

    // Update ticket if there are changes
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      updates.ai_processed = true
      updates.ai_processed_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', ticket_id)

      if (updateError) {
        apiLogger.error('Update error', updateError)
        return NextResponse.json({ success: false, error: 'Failed to update ticket' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      applied: updates
    })
  } catch (error) {
    apiLogger.error('AI API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
