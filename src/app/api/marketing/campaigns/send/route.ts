import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { apiLogger } from '@/lib/utils/logger'

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize AWS SES
const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const { campaignId } = await request.json()

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'Campaign ID is required' }, { status: 400 })
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .select('*, segment:marketing_segments(*)')
      .eq('id', campaignId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'sent') {
      return NextResponse.json({ success: false, error: 'Campaign already sent' }, { status: 400 })
    }

    // Update campaign status to sending
    await supabase
      .from('marketing_campaigns')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    // Get contacts from segment
    let contacts: any[] = []

    if (campaign.segment_id) {
      const segment = campaign.segment

      if (segment?.is_dynamic) {
        // For dynamic segments, execute the filter query
        // This is a simplified version - in production, you'd need to build the query from filter_rules
        if (campaign.campaign_type === 'email') {
          const { data } = await supabase
            .from('email_database_contacts')
            .select('id, email, name')
            .eq('status', 'active')
            .limit(1000)

          contacts = data || []
        } else {
          const { data } = await supabase
            .from('sms_database_contacts')
            .select('id, full_number, name')
            .eq('status', 'active')
            .limit(1000)

          contacts = data || []
        }
      } else {
        // For static segments, get members
        const { data: members } = await supabase
          .from('marketing_segment_members')
          .select('contact_id')
          .eq('segment_id', segment.id)

        if (members && members.length > 0) {
          const contactIds = members.map(m => m.contact_id)

          if (campaign.campaign_type === 'email') {
            const { data } = await supabase
              .from('email_database_contacts')
              .select('id, email, name')
              .in('id', contactIds)

            contacts = data || []
          } else {
            const { data } = await supabase
              .from('sms_database_contacts')
              .select('id, full_number, name')
              .in('id', contactIds)

            contacts = data || []
          }
        }
      }
    }

    // Update total recipients
    await supabase
      .from('marketing_campaigns')
      .update({ total_recipients: contacts.length })
      .eq('id', campaignId)

    // Create recipient records
    const recipientRecords = contacts.map(contact => ({
      campaign_id: campaignId,
      contact_type: campaign.campaign_type,
      contact_id: contact.id,
      recipient_address: campaign.campaign_type === 'email' ? contact.email : contact.full_number,
      recipient_name: contact.name,
      status: 'pending',
    }))

    if (recipientRecords.length > 0) {
      await supabase
        .from('marketing_campaign_recipients')
        .insert(recipientRecords)
    }

    // Process sending in batches (async)
    // In production, this would be a background job or queue
    processCampaignSend(campaignId, campaign, contacts)

    return NextResponse.json({
      success: true,
      message: 'Campaign send started',
      totalRecipients: contacts.length,
    })
  } catch (error: unknown) {
    apiLogger.error('Error starting campaign', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function processCampaignSend(
  campaignId: string,
  campaign: any,
  contacts: any[]
) {
  let sentCount = 0
  let deliveredCount = 0
  let failedCount = 0
  const batchSize = 50
  const totalContacts = contacts.length

  try {
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)

      for (const contact of batch) {
        try {
          if (campaign.campaign_type === 'email') {
            // Send email via AWS SES
            const personalizedContent = personalizeContent(
              campaign.html_content || campaign.text_content,
              contact
            )
            const personalizedSubject = personalizeContent(
              campaign.subject,
              contact
            )

            const command = new SendEmailCommand({
              Destination: {
                ToAddresses: [contact.email],
              },
              Message: {
                Body: {
                  Html: campaign.html_content ? {
                    Charset: 'UTF-8',
                    Data: personalizedContent,
                  } : undefined,
                  Text: {
                    Charset: 'UTF-8',
                    Data: campaign.html_content
                      ? personalizeContent(campaign.text_content || '', contact)
                      : personalizedContent,
                  },
                },
                Subject: {
                  Charset: 'UTF-8',
                  Data: personalizedSubject,
                },
              },
              Source: `${process.env.AWS_SES_FROM_NAME || 'Loanz360'} <${process.env.AWS_SES_FROM_EMAIL || 'noreply@loanz360.com'}>`,
              ReplyToAddresses: process.env.AWS_SES_REPLY_TO
                ? [process.env.AWS_SES_REPLY_TO]
                : undefined,
            })

            const result = await sesClient.send(command)

            // Update recipient status
            await supabase
              .from('marketing_campaign_recipients')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_message_id: result.MessageId,
              })
              .eq('campaign_id', campaignId)
              .eq('contact_id', contact.id)

            sentCount++
            deliveredCount++ // Assuming delivered for now, would need SES notifications for actual delivery
          } else {
            // SMS sending would go here
            // For now, just mark as sent (integrate with SMS provider like MSG91/Twilio)
            await supabase
              .from('marketing_campaign_recipients')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .eq('campaign_id', campaignId)
              .eq('contact_id', contact.id)

            sentCount++
          }
        } catch (sendError: unknown) {
          apiLogger.error('Error sending to contact', contact.id, sendError)
          failedCount++

          // Update recipient status to failed
          await supabase
            .from('marketing_campaign_recipients')
            .update({
              status: 'failed',
              error_message: sendError.message,
            })
            .eq('campaign_id', campaignId)
            .eq('contact_id', contact.id)
        }
      }

      // Update campaign progress
      const progress = Math.round(((i + batch.length) / totalContacts) * 100)
      await supabase
        .from('marketing_campaigns')
        .update({
          progress_percentage: progress,
          sent_count: sentCount,
          delivered_count: deliveredCount,
          failed_count: failedCount,
        })
        .eq('id', campaignId)

      // Small delay between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Mark campaign as completed
    await supabase
      .from('marketing_campaigns')
      .update({
        status: 'sent',
        progress_percentage: 100,
        sent_count: sentCount,
        delivered_count: deliveredCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
  } catch (error: unknown) {
    apiLogger.error('Campaign processing error', error)

    // Mark campaign as failed
    await supabase
      .from('marketing_campaigns')
      .update({
        status: 'failed',
        sent_count: sentCount,
        delivered_count: deliveredCount,
        failed_count: failedCount,
      })
      .eq('id', campaignId)
  }
}

function personalizeContent(content: string, contact: any): string {
  if (!content) return ''

  return content
    .replace(/\{\{name\}\}/g, contact.name || 'Valued Customer')
    .replace(/\{\{first_name\}\}/g, contact.first_name || contact.name?.split(' ')[0] || '')
    .replace(/\{\{last_name\}\}/g, contact.last_name || contact.name?.split(' ').slice(1).join(' ') || '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{mobile\}\}/g, contact.full_number || contact.mobile_number || '')
}
