
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { sendEmail } from '@/lib/communication/email-service'
import { sendSMS } from '@/lib/communication/sms-service'

// POST /api/crm/communications/send - Send bulk communications
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Only CROs and Super Admin can send communications
    if (profile.subrole !== 'cro' && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only CRO and Super Admin can send communications' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { lead_ids, contact_ids, template_id, type, campaign_name, scheduled_at } = body

    // Support both lead_ids and contact_ids - at least one must be provided
    const hasLeads = lead_ids && Array.isArray(lead_ids) && lead_ids.length > 0
    const hasContacts = contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0

    if (!hasLeads && !hasContacts) {
      return NextResponse.json(
        { error: 'lead_ids or contact_ids is required (non-empty array)' },
        { status: 400 }
      )
    }

    if (!template_id) {
      return NextResponse.json(
        { error: 'template_id is required' },
        { status: 400 }
      )
    }

    if (!type || !['email', 'sms'].includes(type)) {
      return NextResponse.json(
        { error: 'type is required and must be email or sms' },
        { status: 400 }
      )
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('crm_templates')
      .select('*')
      .eq('id', template_id)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    // Verify template type matches request type (normalize to lowercase for comparison)
    const templateTypeNormalized = template.template_type?.toLowerCase()
    if (templateTypeNormalized !== type.toLowerCase()) {
      return NextResponse.json(
        { error: `Template type (${template.template_type}) does not match request type (${type})` },
        { status: 400 }
      )
    }

    // Fetch leads and contacts in parallel, normalize to a common recipient format
    interface Recipient {
      id: string
      customer_name: string
      phone: string
      email: string
      loan_type: string
      loan_amount: number | null
      source: 'lead' | 'contact'
    }

    const recipients: Recipient[] = []

    const [leadsResult, contactsResult] = await Promise.all([
      hasLeads
        ? supabase
            .from('crm_leads')
            .select('id, customer_name, phone, email, loan_type, loan_amount')
            .in('id', lead_ids)
        : Promise.resolve({ data: null, error: null }),
      hasContacts
        ? supabase
            .from('crm_contacts')
            .select('id, customer_name, customer_phone, customer_email, loan_type')
            .in('id', contact_ids)
        : Promise.resolve({ data: null, error: null }),
    ])

    if (leadsResult.error) {
      apiLogger.error('Error fetching leads for communication', leadsResult.error)
    }
    if (contactsResult.error) {
      apiLogger.error('Error fetching contacts for communication', contactsResult.error)
    }

    // Normalize leads
    if (leadsResult.data) {
      for (const lead of leadsResult.data) {
        recipients.push({
          id: lead.id,
          customer_name: lead.customer_name || 'Unknown',
          phone: lead.phone || '',
          email: lead.email || '',
          loan_type: lead.loan_type || '',
          loan_amount: lead.loan_amount,
          source: 'lead',
        })
      }
    }

    // Normalize contacts
    if (contactsResult.data) {
      for (const contact of contactsResult.data) {
        recipients.push({
          id: contact.id,
          customer_name: contact.customer_name || 'Unknown',
          phone: contact.customer_phone || '',
          email: contact.customer_email || '',
          loan_type: contact.loan_type || '',
          loan_amount: null,
          source: 'contact',
        })
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, error: 'No recipients found for the provided IDs' }, { status: 404 })
    }

    // Alias for backward compatibility in the loop below
    const leads = recipients

    const croName = `${profile.first_name} ${profile.last_name}`
    const companyName = process.env.COMPANY_NAME || 'Loanz360'

    // Process each lead and send communication
    const results = []
    let sentCount = 0
    let failedCount = 0

    for (const lead of leads) {
      try {
        // Replace variables in template
        let message = template.body
        let subject = template.subject || ''

        const variables: Record<string, string> = {
          customer_name: lead.customer_name,
          customer_mobile: lead.phone,
          customer_email: lead.email || '',
          loan_type: lead.loan_type,
          loan_amount_required: lead.loan_amount?.toString() || '0',
          cro_name: croName,
          company_name: companyName,
        }

        // Replace all variables
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
          message = message.replace(regex, value)
          subject = subject.replace(regex, value)
        }

        // Log the communication attempt
        const logPayload: Record<string, unknown> = {
          lead_id: lead.source === 'lead' ? lead.id : null,
          contact_id: lead.source === 'contact' ? lead.id : null,
          template_id: template.id,
          type,
          subject: type === 'email' ? subject : null,
          message,
          recipient: type === 'email' ? lead.email : lead.phone,
          recipient_name: lead.customer_name,
          status: scheduled_at ? 'scheduled' : 'pending',
          sent_by: user.id,
          sent_at: scheduled_at || new Date().toISOString(),
          campaign_name: campaign_name || null,
        }

        const { error: logError } = await supabase
          .from('crm_communications_log')
          .insert(logPayload)

        if (logError) {
          apiLogger.error('Error logging communication', logError)
          failedCount++
          results.push({
            recipient_id: lead.id,
            customer_name: lead.customer_name,
            source: lead.source,
            success: false,
            error: 'Failed to log communication',
          })
          continue
        }

        // If scheduled, don't send now
        if (scheduled_at) {
          sentCount++
          results.push({
            recipient_id: lead.id,
            customer_name: lead.customer_name,
            source: lead.source,
            success: true,
            scheduled: true,
          })
          continue
        }

        // Send via actual communication service
        let deliveryStatus = 'sent'
        try {
          if (type === 'email' && lead.email) {
            await sendEmail({
              to: lead.email,
              subject,
              html: message,
            })
          } else if (type === 'sms' && lead.phone) {
            await sendSMS(lead.phone, message)
          }
        } catch (deliveryError) {
          apiLogger.error(`Delivery failed for recipient ${lead.id}:`, deliveryError)
          deliveryStatus = 'failed'
        }

        // Update communication status
        await supabase
          .from('crm_communications_log')
          .update({ status: deliveryStatus })
          .match({
            [lead.source === 'lead' ? 'lead_id' : 'contact_id']: lead.id,
            template_id: template.id,
          })
          .order('created_at', { ascending: false })
          .limit(1)

        if (deliveryStatus === 'sent') {
          sentCount++
        } else {
          failedCount++
        }

        results.push({
          recipient_id: lead.id,
          customer_name: lead.customer_name,
          source: lead.source,
          success: deliveryStatus === 'sent',
        })

        // Add a note to the lead about the communication (only for leads)
        if (lead.source === 'lead') {
          await supabase.from('crm_notes').insert({
            lead_id: lead.id,
            note_text: `${type.toUpperCase()} sent using template: ${template.name}${campaign_name ? ` (Campaign: ${campaign_name})` : ''}`,
            is_call_log: false,
            created_by: user.id,
          }).catch(() => { /* Non-critical side effect */ })
        }
      } catch (error: unknown) {
        apiLogger.error(`Error sending to recipient ${lead.id}:`, error)
        failedCount++
        results.push({
          recipient_id: lead.id,
          customer_name: lead.customer_name,
          source: lead.source,
          success: false,
          error: 'Internal server error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      sent_count: sentCount,
      failed_count: failedCount,
      total: leads.length,
      results,
      message: scheduled_at
        ? `Scheduled ${type} for ${leads.length} recipients`
        : `Successfully sent ${type} to ${sentCount} of ${leads.length} recipients`,
    })
  } catch (error: unknown) {
    apiLogger.error('Send communications error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
