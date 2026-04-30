import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'


/**
 * Generate WhatsApp Web Link and Log Message
 *
 * Simple WhatsApp integration using web.whatsapp.com with pre-filled message
 * Logs the message in whatsapp_message_log table
 *
 * POST /api/ai-crm/whatsapp/send
 * Body: {
 *   entity_type: 'contact' | 'positive_contact' | 'lead' | 'deal'
 *   entity_id: string
 *   phone: string
 *   message: string
 * }
 *
 * Returns: {
 *   whatsapp_url: string (clickable link to open WhatsApp)
 * }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get current user
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

    const body = await request.json()
    const { entity_type, entity_id, phone, message } = body

    // Validate inputs
    if (!entity_type || !entity_id || !phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: entity_type, entity_id, phone, message' },
        { status: 400 }
      )
    }

    if (!['contact', 'positive_contact', 'lead', 'deal'].includes(entity_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity_type' },
        { status: 400 }
      )
    }

    // Clean phone number (remove spaces, dashes, parentheses)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')

    // Add country code if not present
    const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+91'
    let formattedPhone = cleanPhone
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        formattedPhone = `${defaultCountryCode}${cleanPhone}`
      } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        formattedPhone = `+${cleanPhone}`
      } else {
        formattedPhone = `+${cleanPhone}`
      }
    }

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message)

    // Generate WhatsApp Web URL
    const whatsappUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodedMessage}`

    // Map entity type to table name
    const tableMap: Record<string, string> = {
      contact: 'crm_contacts',
      positive_contact: 'positive_contacts',
      lead: 'crm_leads',
      deal: 'crm_deals',
    }

    const tableName = tableMap[entity_type]

    // Get master_contact_id from entity
    const { data: entity, error: fetchError } = await supabase
      .from(tableName)
      .select('master_contact_id')
      .eq('id', entity_id)
      .maybeSingle()

    if (fetchError || !entity) {
      return NextResponse.json(
        { success: false, error: `${entity_type} not found` },
        { status: 404 }
      )
    }

    // Log the WhatsApp message
    const { error: logError } = await supabase.from('whatsapp_message_log').insert({
      contact_id: entity_id,
      master_contact_id: entity.master_contact_id,
      cro_id: user.id,
      message: message,
      sent_at: new Date().toISOString(),
    })

    if (logError) {
      apiLogger.error('Error logging WhatsApp message', logError)
      // Don't fail the request - URL is still valid
    }

    // Update whatsapp_sent_count if entity is positive_contact
    if (entity_type === 'positive_contact') {
      const { error: updateError } = await supabase
        .from('positive_contacts')
        .update({
          whatsapp_sent_count: supabase.rpc('increment', { x: 1 }),
          last_whatsapp_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)

      if (updateError) {
        apiLogger.error('Error updating whatsapp count', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        whatsapp_url: whatsappUrl,
        phone: formattedPhone,
        message: message,
      },
      message: 'WhatsApp link generated successfully',
    })
  } catch (error) {
    apiLogger.error('Error in whatsapp-send API', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
