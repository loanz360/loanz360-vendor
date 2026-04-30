
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatbotCreateInput } from '@/types/chatbot'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/chatbot - List all chatbots
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Verify super admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin only.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('chatbots')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: chatbots, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching chatbots', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch chatbots' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: chatbots,
      total: count,
      limit,
      offset
    })
  } catch (error) {
    apiLogger.error('Chatbot list error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/chatbot - Create a new chatbot
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Verify super admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin only.' },
        { status: 403 }
      )
    }

    const body: ChatbotCreateInput = await request.json()

    // Validate required fields
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Chatbot name is required' },
        { status: 400 }
      )
    }

    // Prepare chatbot data
    const chatbotData = {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      status: body.status || 'draft',
      theme: body.theme ? {
        primaryColor: body.theme.primaryColor || '#FF6B00',
        secondaryColor: body.theme.secondaryColor || '#1F2937',
        backgroundColor: body.theme.backgroundColor || '#FFFFFF',
        textColor: body.theme.textColor || '#1F2937',
        bubblePosition: body.theme.bubblePosition || 'bottom-right',
        bubbleSize: body.theme.bubbleSize || 'medium',
        avatarUrl: body.theme.avatarUrl || null,
        botName: body.theme.botName || 'Loans360 Assistant',
        welcomeMessage: body.theme.welcomeMessage || 'Hi! I am here to help you find the perfect loan. Let me ask you a few questions.',
        typingIndicatorEnabled: body.theme.typingIndicatorEnabled ?? true,
        typingDelayMs: body.theme.typingDelayMs || 1000,
        fontFamily: body.theme.fontFamily || 'Inter, system-ui, sans-serif'
      } : undefined,
      settings: body.settings ? {
        proactiveEnabled: body.settings.proactiveEnabled ?? false,
        proactiveDelaySeconds: body.settings.proactiveDelaySeconds || 30,
        proactiveMessage: body.settings.proactiveMessage || 'Need help finding the right loan?',
        preChatFormEnabled: body.settings.preChatFormEnabled ?? false,
        preChatFields: body.settings.preChatFields || ['name'],
        showReferenceNumber: body.settings.showReferenceNumber ?? true,
        thankYouMessage: body.settings.thankYouMessage || 'Thank you for your interest! Our team will contact you within 24 hours.',
        thankYouButtonText: body.settings.thankYouButtonText || 'Start New Chat',
        allowRestart: body.settings.allowRestart ?? true,
        multiLanguageEnabled: body.settings.multiLanguageEnabled ?? false,
        defaultLanguage: body.settings.defaultLanguage || 'en',
        languages: body.settings.languages || ['en'],
        offlineMessage: body.settings.offlineMessage || 'We are currently offline. Please leave your details and we will get back to you.',
        sessionTimeoutMinutes: body.settings.sessionTimeoutMinutes || 30
      } : undefined,
      assignment_mode: body.assignment_mode || 'round_robin',
      assignment_rules: body.assignment_rules || {},
      default_assignee_id: body.default_assignee_id || null,
      embed_domains: body.embed_domains || [],
      created_by: user.id
    }

    // Create chatbot
    const { data: chatbot, error: createError } = await supabase
      .from('chatbots')
      .insert(chatbotData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating chatbot', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create chatbot' },
        { status: 500 }
      )
    }

    // Create default flow for the chatbot
    const { error: flowError } = await supabase
      .from('chatbot_flows')
      .insert({
        chatbot_id: chatbot.id,
        name: 'Main Flow',
        description: 'Primary conversation flow',
        is_default: true,
        is_published: false,
        canvas_data: {
          nodes: [
            {
              id: 'start-1',
              type: 'start',
              position: { x: 250, y: 50 },
              data: {
                type: 'start',
                welcomeMessage: chatbot.theme?.welcomeMessage || 'Hi! How can I help you today?'
              }
            },
            {
              id: 'end-1',
              type: 'end',
              position: { x: 250, y: 400 },
              data: {
                type: 'end',
                thankYouMessage: chatbot.settings?.thankYouMessage || 'Thank you! We will contact you soon.',
                showReferenceNumber: true
              }
            }
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      })

    if (flowError) {
      apiLogger.error('Error creating default flow', flowError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      data: chatbot,
      message: 'Chatbot created successfully'
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Chatbot creation error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
