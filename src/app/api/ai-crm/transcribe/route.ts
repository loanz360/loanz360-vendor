import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { AIAnalysis, Note } from '@/types/ai-crm'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// Initialize OpenAI client lazily
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Helper function to analyze conversation with GPT-4
async function analyzeConversation(transcript: string): Promise<AIAnalysis> {
  const openai = getOpenAIClient()

  const systemPrompt = `You are an expert loan sales coach analyzing a conversation between a CRO (Customer Relationship Officer) and a potential customer about business loans.

Analyze the conversation and provide:
1. A brief summary (2-3 sentences)
2. Overall rating (0-10 scale)
3. Sentiment (positive/neutral/negative)
4. Customer interest level (high/medium/low)
5. 3-5 key discussion points
6. 3-4 positive aspects of the CRO's performance
7. 2-3 areas where the CRO can improve
8. Recommendation (add_to_positive / keep_in_contacts / not_interested)

Be constructive and specific in your feedback.`

  const userPrompt = `Analyze this conversation:

${transcript}

Provide analysis in JSON format with this structure:
{
  "summary": "string",
  "rating": number (0-10),
  "sentiment": "positive" | "neutral" | "negative",
  "interest_level": "high" | "medium" | "low",
  "key_points": ["point1", "point2", ...],
  "positive_points": ["strength1", "strength2", ...],
  "improvement_points": ["area1", "area2", ...],
  "recommendation": "add_to_positive" | "keep_in_contacts" | "not_interested"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  let analysis: AIAnalysis
  try {
    analysis = JSON.parse(completion.choices[0].message.content || '{}')
  } catch {
    analysis = { sentiment: 'neutral', key_topics: [], action_items: [], summary: 'Analysis could not be parsed' } as unknown as AIAnalysis
  }
  return analysis
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

    // Get the audio file from form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const contactId = formData.get('contactId') as string
    const dealId = formData.get('dealId') as string

    if (!audioFile) {
      return NextResponse.json(
        { success: false, message: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg']
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid audio file type' },
        { status: 400 }
      )
    }

    // Validate file size (max 25MB for Whisper API)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'Audio file too large (max 25MB)' },
        { status: 400 }
      )
    }

    // Convert File to Buffer for OpenAI
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a File object that OpenAI SDK can use
    const file = new File([buffer], audioFile.name, { type: audioFile.type })

    // Get OpenAI client and transcribe audio using Whisper
    const openai = getOpenAIClient()
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en', // Can be made dynamic based on user preference
      response_format: 'verbose_json', // Get timestamps and metadata
      timestamp_granularities: ['segment'], // Get segment-level timestamps
    })

    // Extract the transcript text
    const transcript = transcription.text

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'No speech detected in audio' },
        { status: 400 }
      )
    }

    // Analyze conversation with GPT-4
    const aiAnalysis = await analyzeConversation(transcript)

    // Create AI transcript note
    const aiNote: Note = {
      id: crypto.randomUUID(),
      type: 'ai_transcript',
      timestamp: new Date().toISOString(),
      call_duration: transcription.duration || 0,
      transcript: transcript,
      ai_summary: aiAnalysis.summary,
      ai_rating: aiAnalysis.rating,
      sentiment: aiAnalysis.sentiment,
      interest_level: aiAnalysis.interest_level,
      key_points: aiAnalysis.key_points,
      positive_points: aiAnalysis.positive_points,
      improvement_points: aiAnalysis.improvement_points,
      is_editable: false,
      created_by: user.id,
      created_by_name: user.user_metadata?.full_name || 'Unknown',
      created_at: new Date().toISOString(),
    }

    // Save call log with transcript and AI analysis (if contactId provided - for CRO calls)
    if (contactId) {
      // Fetch current contact to get existing notes
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('notes_timeline')
        .eq('id', contactId)
        .maybeSingle()

      const existingNotes = (contact?.notes_timeline as Note[]) || []
      const updatedNotes = [...existingNotes, aiNote]

      // Update contact with new notes timeline
      const { error: updateError } = await supabase
        .from('crm_contacts')
        .update({
          notes_timeline: updatedNotes,
          last_called_at: new Date().toISOString(),
        })
        .eq('id', contactId)

      if (updateError) {
        apiLogger.error('Error updating contact notes', updateError)
      }

      // Update contact call count
      await supabase.rpc('increment_contact_calls', { contact_id: contactId })
    }

    // Save conversation record (if dealId provided - for BDE updates)
    if (dealId) {
      // Fetch current deal to get existing notes
      const { data: deal } = await supabase
        .from('crm_deals')
        .select('notes_timeline')
        .eq('id', dealId)
        .maybeSingle()

      const existingNotes = (deal?.notes_timeline as Note[]) || []
      const updatedNotes = [...existingNotes, aiNote]

      // Update deal with new notes timeline
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update({
          notes_timeline: updatedNotes,
        })
        .eq('id', dealId)

      if (updateError) {
        apiLogger.error('Error updating deal notes', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript: transcript,
        duration: transcription.duration,
        language: transcription.language,
        segments: transcription.segments || [],
        ai_analysis: aiAnalysis,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Transcription error', error)
    logApiError(error as Error, request, { action: 'post' })

    // Handle OpenAI specific errors
    if (error?.response?.status === 401) {
      return NextResponse.json(
        { success: false, message: 'OpenAI API key is invalid' },
        { status: 500 }
      )
    }

    if (error?.response?.status === 429) {
      return NextResponse.json(
        { success: false, message: 'OpenAI API rate limit exceeded' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
