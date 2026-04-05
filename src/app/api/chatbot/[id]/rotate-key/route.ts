export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { auditService } from '@/lib/services/audit-service'
import { getClientIP } from '@/lib/middleware/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

// Generate a secure API key
function generateApiKey(): string {
  // Format: cb_live_xxxx or cb_test_xxxx
  const prefix = 'cb_live_'
  const key = randomBytes(24).toString('hex')
  return `${prefix}${key}`
}

// POST - Rotate API key for a chatbot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'SUPER_ADMIN' && !superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Verify chatbot exists
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, api_key')
      .eq('id', chatbotId)
      .maybeSingle()

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Generate new API key
    const newApiKey = generateApiKey()

    // Update chatbot with new API key
    const { error: updateError } = await supabase
      .from('chatbots')
      .update({
        api_key: newApiKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatbotId)

    if (updateError) throw updateError

    // Log audit event
    const clientIP = getClientIP(request.headers)
    await auditService.logApiKeyRotated(chatbotId, user.id, clientIP)

    return NextResponse.json({
      success: true,
      data: {
        api_key: newApiKey,
        message: 'API key rotated successfully. Update your integrations with the new key.'
      }
    })
  } catch (error) {
    apiLogger.error('Error rotating API key', error)
    return NextResponse.json(
      { success: false, error: 'Failed to rotate API key' },
      { status: 500 }
    )
  }
}
