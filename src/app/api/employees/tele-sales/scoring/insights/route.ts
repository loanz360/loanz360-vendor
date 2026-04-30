
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET - Get call insights for a specific call
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const call_id = searchParams.get('call_id')

    if (!call_id) {
      return NextResponse.json({ success: false, error: 'Call ID is required' }, { status: 400 })
    }

    // Get insights for the call
    const { data: insights, error: insightsError } = await supabase
      .from('ts_call_insights')
      .select('*')
      .eq('call_id', call_id)
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    if (insightsError && insightsError.code !== 'PGRST116') {
      throw insightsError
    }

    // Get transcription if available
    const { data: transcription } = await supabase
      .from('ts_call_transcriptions')
      .select('*')
      .eq('call_id', call_id)
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    // Get score if available
    const { data: score } = await supabase
      .from('ts_call_scores')
      .select('*')
      .eq('call_id', call_id)
      .eq('sales_executive_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        insights: insights || null,
        transcription: transcription || null,
        score: score || null
      }
    })
  } catch (error) {
    apiLogger.error('Get insights error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch call insights' },
      { status: 500 }
    )
  }
}

// POST - Generate AI insights for a call (simulated)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { call_id, transcription_text } = body

    if (!call_id) {
      return NextResponse.json({ success: false, error: 'Call ID is required' }, { status: 400 })
    }

    // In a real implementation, this would call an AI service
    // For now, we'll generate placeholder insights based on text analysis

    // Simple sentiment analysis based on keywords
    const text = (transcription_text || '').toLowerCase()
    let sentimentScore = 0
    const positiveWords = ['thank', 'great', 'excellent', 'happy', 'pleased', 'good', 'perfect', 'wonderful', 'appreciate']
    const negativeWords = ['not', 'bad', 'wrong', 'issue', 'problem', 'frustrated', 'disappointed', 'angry', 'annoyed']

    positiveWords.forEach(word => {
      if (text.includes(word)) sentimentScore += 0.15
    })
    negativeWords.forEach(word => {
      if (text.includes(word)) sentimentScore -= 0.15
    })
    sentimentScore = Math.max(-1, Math.min(1, sentimentScore))

    let overall_sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'MIXED' = 'NEUTRAL'
    if (sentimentScore > 0.3) overall_sentiment = 'POSITIVE'
    else if (sentimentScore < -0.3) overall_sentiment = 'NEGATIVE'
    else if (Math.abs(sentimentScore) < 0.1) overall_sentiment = 'NEUTRAL'
    else overall_sentiment = 'MIXED'

    // Detect customer intent
    let customer_intent = 'UNDECIDED'
    if (text.includes('interested') || text.includes('tell me more')) customer_intent = 'INTERESTED'
    else if (text.includes('not interested') || text.includes('no thank')) customer_intent = 'NOT_INTERESTED'
    else if (text.includes('how much') || text.includes('price')) customer_intent = 'PRICE_SENSITIVE'
    else if (text.includes('call back') || text.includes('call later')) customer_intent = 'CALLBACK_REQUESTED'
    else if (text.includes('let me think') || text.includes('need to check')) customer_intent = 'NEEDS_INFO'

    // Generate improvement suggestions
    const improvement_suggestions = []
    if (!text.includes('my name is')) {
      improvement_suggestions.push({
        area: 'Introduction',
        suggestion: 'Always introduce yourself with your full name',
        priority: 'HIGH'
      })
    }
    if (!text.includes('thank you') && !text.includes('thanks')) {
      improvement_suggestions.push({
        area: 'Courtesy',
        suggestion: 'Thank the customer for their time',
        priority: 'MEDIUM'
      })
    }
    if (!text.includes('next step') && !text.includes('follow up')) {
      improvement_suggestions.push({
        area: 'Closing',
        suggestion: 'Always establish clear next steps before ending the call',
        priority: 'HIGH'
      })
    }

    // Create insights record
    const { data: insights, error: insertError } = await supabase
      .from('ts_call_insights')
      .insert({
        call_id,
        sales_executive_id: user.id,
        overall_sentiment,
        customer_sentiment: overall_sentiment,
        agent_sentiment: 'NEUTRAL',
        sentiment_score: sentimentScore,
        talk_ratio: 0.5, // Would be calculated from actual audio
        silence_percentage: 5,
        interruptions_count: 0,
        average_response_time_seconds: 2.5,
        key_topics: extractKeyTopics(text),
        customer_objections: extractObjections(text),
        agent_responses: [],
        action_items: [],
        customer_intent,
        intent_confidence: 0.7,
        improvement_suggestions,
        coaching_points: [],
        call_summary: generateSummary(text),
        next_steps: []
      })
      .select()
      .maybeSingle()

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      data: insights
    })
  } catch (error) {
    apiLogger.error('Generate insights error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}

// Helper functions for basic text analysis
function extractKeyTopics(text: string): string[] {
  const topics: string[] = []
  const topicKeywords: Record<string, string[]> = {
    'Loan Application': ['loan', 'apply', 'application', 'borrow'],
    'Interest Rates': ['interest', 'rate', 'percentage'],
    'Documentation': ['document', 'paper', 'proof', 'pan', 'aadhar'],
    'Eligibility': ['eligible', 'qualify', 'criteria'],
    'Processing Time': ['time', 'days', 'process', 'when'],
    'EMI Details': ['emi', 'monthly', 'payment', 'installment']
  }

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      topics.push(topic)
    }
  }

  return topics.slice(0, 5)
}

function extractObjections(text: string): string[] {
  const objections: string[] = []
  const objectionPatterns = [
    { pattern: /too (expensive|high|much)/i, objection: 'Price concern' },
    { pattern: /not (interested|looking|need)/i, objection: 'Not interested' },
    { pattern: /already have/i, objection: 'Already has similar product' },
    { pattern: /(busy|later|call back)/i, objection: 'Time constraint' },
    { pattern: /need to (think|discuss|check)/i, objection: 'Needs consideration time' }
  ]

  objectionPatterns.forEach(({ pattern, objection }) => {
    if (pattern.test(text)) {
      objections.push(objection)
    }
  })

  return objections
}

function generateSummary(text: string): string {
  const wordCount = text.split(/\s+/).length
  if (wordCount < 50) {
    return 'Brief interaction with limited conversation.'
  } else if (wordCount < 200) {
    return 'Standard call with moderate engagement from the customer.'
  } else {
    return 'Extended conversation with detailed discussion of products/services.'
  }
}
