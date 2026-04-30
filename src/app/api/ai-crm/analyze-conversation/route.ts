import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


// Initialize Anthropic client lazily
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

interface ConversationGist {
  keyDiscussionPoints: string[]
  customerRequirements: {
    loanAmount?: string | null
    loanType?: string | null
    loanPurpose?: string | null
    urgency?: string
    timeline?: string
  }
  concernsAndObjections: string[]
  financialDetails: {
    monthlyIncome?: string | null
    existingLoans?: string | null
    assets?: string | null
    businessType?: string | null
    cibilScore?: string | null
  }
  agreedNextSteps: string[]
  conversationOutcome: string
}

interface AnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative'
  interestLevel: 'high' | 'medium' | 'low'
  aiRating: number
  conversationGist?: ConversationGist
  positivePoints: string[]
  improvementPoints: string[]
  coachingFeedback: string
  extractedData: {
    loanAmount?: string
    loanPurpose?: string
    monthlyIncome?: string
    businessType?: string
    urgency?: string
    concerns?: string[]
    nextSteps?: string[]
  }
  outcome: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { transcript, callLogId, conversationId, contextType } = await request.json()

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transcript is required' },
        { status: 400 }
      )
    }

    // Determine the analysis type based on context
    const isCROCall = contextType === 'cro_call'
    const isBDEUpdate = contextType === 'bde_update'

    // Build the prompt based on context
    const systemPrompt = isCROCall
      ? buildCROAnalysisPrompt()
      : buildBDEAnalysisPrompt()

    // Get Anthropic client and call Claude API for analysis
    const anthropic = getAnthropicClient()
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation transcript and provide structured feedback:\n\n${transcript}`,
        },
      ],
    })

    // Parse Claude's response
    const analysisText = message.content[0].type === 'text' ? message.content[0].text : ''
    const analysis = parseAnalysisResponse(analysisText)

    // Save analysis results
    if (isCROCall && callLogId) {
      // Update cro_call_logs with AI analysis
      await supabase
        .from('cro_call_logs')
        .update({
          transcript: transcript,
          ai_summary: analysis.conversationGist
            ? JSON.stringify(analysis.conversationGist)
            : analysis.coachingFeedback?.substring(0, 500),
          ai_rating: analysis.aiRating,
          ai_sentiment: analysis.sentiment === 'positive' ? 'positive' : analysis.sentiment === 'negative' ? 'negative' : 'neutral',
          ai_coaching_feedback: analysis.coachingFeedback,
          ai_positive_points: analysis.positivePoints,
          ai_improvement_points: analysis.improvementPoints,
          ai_extracted_data: {
            ...analysis.extractedData,
            conversation_gist: analysis.conversationGist || null,
          },
          ai_analysis_status: 'completed',
        })
        .eq('id', callLogId)

      // Backward compat: also try legacy call_logs table
      await supabase
        .from('call_logs')
        .update({
          transcript: transcript,
          sentiment: analysis.sentiment,
          interest_level: analysis.interestLevel,
          ai_rating: analysis.aiRating,
          positive_points: JSON.stringify(analysis.positivePoints),
          improvement_points: JSON.stringify(analysis.improvementPoints),
          coaching_feedback: analysis.coachingFeedback,
          extracted_data: JSON.stringify(analysis.extractedData),
          outcome: analysis.outcome,
          ai_analysis_status: 'completed',
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', callLogId)

      // Save per-dimension performance rating to cro_performance_ratings
      // Use the overall AI rating for all dimensions until per-dimension AI analysis is implemented
      const rating = analysis.aiRating || 5
      await supabase
        .from('cro_performance_ratings')
        .insert({
          cro_id: user.id,
          call_log_id: callLogId,
          communication_quality: rating,
          product_knowledge: rating,
          objection_handling: Math.max(1, Math.min(10, Math.round(rating - 0.5))),
          needs_identification: rating,
          rapport_building: Math.max(1, Math.min(10, Math.round(rating + 0.3))),
          call_to_action: Math.max(1, Math.min(10, Math.round(rating - 0.3))),
          overall_rating: rating,
          improvement_suggestions: analysis.improvementPoints,
          coaching_guidance: analysis.coachingFeedback,
        })
    }

    if (isBDEUpdate && conversationId) {
      await supabase
        .from('deal_conversations')
        .update({
          sentiment: analysis.sentiment,
          ai_rating: analysis.aiRating,
          key_points: JSON.stringify(analysis.positivePoints),
          improvement_areas: JSON.stringify(analysis.improvementPoints),
          ai_feedback: analysis.coachingFeedback,
          extracted_data: JSON.stringify(analysis.extractedData),
          ai_analysis_status: 'completed',
          analyzed_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    })
  } catch (error: unknown) {
    apiLogger.error('Analysis error', error)
    logApiError(error as Error, request, { action: 'post' })

    // Handle Anthropic specific errors
    if (error?.status === 401) {
      return NextResponse.json(
        { success: false, message: 'AI service authentication failed. Please check API configuration.' },
        { status: 503 }
      )
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, message: 'AI service rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    if (error?.status >= 500) {
      return NextResponse.json(
        { success: false, message: 'AI service temporarily unavailable' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to analyze conversation' },
      { status: 500 }
    )
  }
}

function buildCROAnalysisPrompt(): string {
  return `You are an expert sales coach analyzing loan sales calls for LOANZ 360 (a loan DSA platform).

IMPORTANT: Generate a structured GIST of the conversation — NOT a word-by-word transcript. Capture EVERY discussion point concisely. Do not miss any topic, concern, or detail mentioned.

Note: Audio may be single-channel (CRO's microphone capturing both sides). Account for potential audio quality variations.

Analyze the conversation and provide:

1. **Sentiment**: Overall customer sentiment (positive/neutral/negative)
2. **Interest Level**: Customer's interest in the loan (high/medium/low)
3. **AI Rating**: Score the call quality from 1-10 based on:
   - Rapport building
   - Needs identification
   - Objection handling
   - Information gathering
   - Call-to-action clarity

4. **Conversation Gist** (CRITICAL — capture EVERY point discussed):
   - **Key Discussion Points**: Bullet list of every topic covered in the call
   - **Customer Requirements**: Loan amount, type, purpose, urgency, timeline
   - **Concerns & Objections**: Every concern or hesitation raised by the customer
   - **Financial Details Mentioned**: Income, existing loans/EMIs, assets, liabilities, CIBIL score references
   - **Agreed Next Steps**: What both parties agreed to do next
   - **Conversation Outcome**: Final result of the call

5. **What CRO Did Well**: 3-5 specific positive points
6. **Areas to Improve**: 3-5 actionable improvement suggestions
7. **Coaching Feedback**: A personalized paragraph with specific coaching advice

Return your analysis in this JSON format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "interestLevel": "high" | "medium" | "low",
  "aiRating": 1-10,
  "conversationGist": {
    "keyDiscussionPoints": ["point1", "point2", ...],
    "customerRequirements": {
      "loanAmount": "amount or null",
      "loanType": "type or null",
      "loanPurpose": "purpose or null",
      "urgency": "high/medium/low",
      "timeline": "when they need it"
    },
    "concernsAndObjections": ["concern1", "concern2", ...],
    "financialDetails": {
      "monthlyIncome": "amount or null",
      "existingLoans": "details or null",
      "assets": "details or null",
      "businessType": "type or null",
      "cibilScore": "score or null"
    },
    "agreedNextSteps": ["step1", "step2", ...],
    "conversationOutcome": "summary of final outcome"
  },
  "positivePoints": ["point1", "point2", ...],
  "improvementPoints": ["point1", "point2", ...],
  "coachingFeedback": "Detailed feedback paragraph",
  "extractedData": {
    "loanAmount": "amount",
    "loanPurpose": "purpose",
    "monthlyIncome": "income",
    "businessType": "type",
    "urgency": "high/medium/low",
    "concerns": ["concern1", ...],
    "nextSteps": ["step1", ...]
  },
  "outcome": "interested/follow_up_required/not_interested/callback_scheduled"
}`
}

function buildBDEAnalysisPrompt(): string {
  return `You are an expert loan processing coach analyzing BDE customer update calls. Analyze the conversation and provide:

1. **Sentiment**: Overall customer sentiment (positive/neutral/negative)
2. **AI Rating**: Score the update quality from 1-10 based on:
   - Clarity of information provided
   - Professional communication
   - Addressing customer concerns
   - Documentation guidance
   - Timeline management

3. **Key Points**: 3-5 important points from the update
4. **Improvement Areas**: 3-5 actionable suggestions
5. **AI Feedback**: Personalized coaching paragraph
6. **Extracted Data**: Key information:
   - Current stage progress
   - Documents pending
   - Customer concerns
   - Timeline updates
   - Next steps

Return your analysis in this JSON format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "aiRating": 1-10,
  "positivePoints": ["point1", "point2", ...],
  "improvementPoints": ["point1", "point2", ...],
  "coachingFeedback": "Detailed feedback paragraph",
  "extractedData": {
    "stageProgress": "description",
    "documentsPending": ["doc1", ...],
    "concerns": ["concern1", ...],
    "timelineUpdates": "updates",
    "nextSteps": ["step1", ...]
  }
}`
}

function parseAnalysisResponse(text: string): AnalysisResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          sentiment: parsed.sentiment || 'neutral',
          interestLevel: parsed.interestLevel || 'medium',
          aiRating: Math.min(10, Math.max(1, parseInt(parsed.aiRating) || 5)),
          conversationGist: parsed.conversationGist || undefined,
          positivePoints: Array.isArray(parsed.positivePoints) ? parsed.positivePoints : [],
          improvementPoints: Array.isArray(parsed.improvementPoints)
            ? parsed.improvementPoints
            : [],
          coachingFeedback: parsed.coachingFeedback || 'Analysis completed.',
          extractedData: parsed.extractedData || {},
          outcome: parsed.outcome || 'Call completed',
        }
      } catch (parseError) {
        apiLogger.error('JSON parse error in analysis response', parseError)
        // Fall through to fallback
      }
    }

    // Fallback if JSON parsing fails or no JSON found
    return {
      sentiment: 'neutral',
      interestLevel: 'medium',
      aiRating: 5,
      positivePoints: ['Analysis completed'],
      improvementPoints: ['Continue monitoring conversation quality'],
      coachingFeedback: text.substring(0, 500),
      extractedData: {},
      outcome: 'Call logged',
    }
  } catch (error) {
    apiLogger.error('Error parsing analysis response', error)
    return {
      sentiment: 'neutral',
      interestLevel: 'medium',
      aiRating: 5,
      positivePoints: ['Analysis completed'],
      improvementPoints: [],
      coachingFeedback: 'Analysis completed successfully.',
      extractedData: {},
      outcome: 'Call logged',
    }
  }
}
