export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get chatbot public config (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params
    const supabase = await createClient()

    // Get chatbot public data (limited fields)
    const { data: chatbot, error } = await supabase
      .from('chatbots')
      .select('id, theme, settings, status, embed_domains')
      .eq('id', chatbotId)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !chatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found or inactive' },
        { status: 404 }
      )
    }

    // Check domain restriction with secure validation
    const origin = request.headers.get('origin') || ''
    const embedDomains: string[] = chatbot.embed_domains || []

    if (embedDomains.length > 0 && origin) {
      let allowedOrigin = false

      try {
        const originUrl = new URL(origin)
        const originHostname = originUrl.hostname.toLowerCase()

        allowedOrigin = embedDomains.some((domain: string) => {
          const normalizedDomain = domain.toLowerCase().trim()
          // Exact match or subdomain match (e.g., "example.com" matches "www.example.com")
          return originHostname === normalizedDomain ||
                 originHostname.endsWith('.' + normalizedDomain)
        })
      } catch {
        // Invalid origin URL - reject
        allowedOrigin = false
      }

      if (!allowedOrigin) {
        return NextResponse.json(
          { success: false, error: 'Domain not allowed' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: chatbot.id,
        theme: chatbot.theme,
        settings: {
          proactiveEnabled: chatbot.settings.proactiveEnabled,
          proactiveDelaySeconds: chatbot.settings.proactiveDelaySeconds,
          proactiveMessage: chatbot.settings.proactiveMessage,
          showReferenceNumber: chatbot.settings.showReferenceNumber,
          thankYouMessage: chatbot.settings.thankYouMessage,
          thankYouButtonText: chatbot.settings.thankYouButtonText,
          allowRestart: chatbot.settings.allowRestart
        }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching chatbot config', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch config' },
      { status: 500 }
    )
  }
}
