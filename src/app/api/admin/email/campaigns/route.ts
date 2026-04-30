import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Email Marketing Campaign Management API
 * Create, manage, and send email marketing campaigns
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { initializeSESService } from '@/lib/email/ses-service';
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CampaignRecipient {
  email: string;
  name?: string;
  customData?: Record<string, string>;
}

interface Campaign {
  id?: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  recipientListId?: string;
  recipients?: CampaignRecipient[];
  scheduledAt?: string;
  sentAt?: string;
  totalRecipients?: number;
  sentCount?: number;
  deliveredCount?: number;
  bouncedCount?: number;
  openedCount?: number;
  clickedCount?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/admin/email/campaigns
 * List all campaigns or get a specific campaign
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (campaignId) {
      // Get specific campaign
      const { data: campaign, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();

      if (error || !campaign) {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        );
      }

      // Get campaign stats
      const { data: stats } = await supabase
        .from('email_campaign_stats')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();

      return NextResponse.json({
        campaign: {
          ...campaign,
          stats,
        },
      });
    }

    // List campaigns
    let query = supabase
      .from('email_campaigns')
      .select('*, email_campaign_stats(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: campaigns, count, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    apiLogger.error('[Campaigns] Error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/campaigns
 * Create a new campaign or perform actions (send, schedule, pause)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      campaignId: z.string().uuid().optional(),


      id: z.string().uuid(),


      name: z.string().optional(),


      subject: z.string().optional(),


      htmlContent: z.string().optional(),


      textContent: z.string().optional(),


      recipients: z.array(z.unknown()).optional(),


      recipientListId: z.string().uuid().optional(),


      tags: z.array(z.unknown()).optional(),


      metadata: z.record(z.unknown()).optional(),


      scheduledAt: z.string(),


      testEmail: z.string().email(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { action, campaignId, ...campaignData } = body;

    // Handle campaign actions
    if (action && campaignId) {
      switch (action) {
        case 'send':
          return await sendCampaign(supabase, campaignId, user.id);

        case 'schedule':
          if (!body.scheduledAt) {
            return NextResponse.json(
              { error: 'scheduledAt is required for scheduling' },
              { status: 400 }
            );
          }
          return await scheduleCampaign(supabase, campaignId, body.scheduledAt);

        case 'pause':
          return await pauseCampaign(supabase, campaignId);

        case 'cancel':
          return await cancelCampaign(supabase, campaignId);

        case 'duplicate':
          return await duplicateCampaign(supabase, campaignId, user.id);

        case 'test':
          if (!body.testEmail) {
            return NextResponse.json(
              { error: 'testEmail is required for test send' },
              { status: 400 }
            );
          }
          return await sendTestEmail(supabase, campaignId, body.testEmail);

        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          );
      }
    }

    // Create new campaign
    const { name, subject, htmlContent, textContent, recipients, recipientListId, tags, metadata, scheduledAt } = campaignData;

    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, htmlContent' },
        { status: 400 }
      );
    }

    // Calculate recipient count
    let totalRecipients = 0;
    if (recipients && Array.isArray(recipients)) {
      totalRecipients = recipients.length;
    } else if (recipientListId) {
      const { count } = await supabase
        .from('email_recipient_lists_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', recipientListId);
      totalRecipients = count || 0;
    }

    const { data: campaign, error: createError } = await supabase
      .from('email_campaigns')
      .insert({
        name,
        subject,
        html_content: htmlContent,
        text_content: textContent,
        recipient_list_id: recipientListId,
        recipients: recipients || null,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduled_at: scheduledAt,
        total_recipients: totalRecipients,
        tags,
        metadata,
        created_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (createError) {
      throw createError;
    }

    // Create stats record
    await supabase.from('email_campaign_stats').insert({
      campaign_id: campaign.id,
      total_recipients: totalRecipients,
      sent_count: 0,
      delivered_count: 0,
      bounced_count: 0,
      opened_count: 0,
      clicked_count: 0,
      unsubscribed_count: 0,
      complained_count: 0,
    });

    return NextResponse.json({
      success: true,
      campaign,
      message: 'Campaign created successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('[Campaigns] Error creating', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email/campaigns
 * Update an existing campaign
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const bodySchema2 = z.object({


      tags: z.string().optional(),


      textContent: z.string().optional(),


      metadata: z.string().optional(),


      name: z.string().optional(),


      subject: z.string().optional(),


      htmlContent: z.string().optional(),


      scheduledAt: z.string().optional(),


      recipients: z.string().optional(),


      recipientListId: z.string().optional(),


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { id, name, subject, htmlContent, textContent, recipients, recipientListId, tags, metadata, scheduledAt } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing campaign id' },
        { status: 400 }
      );
    }

    // Check if campaign can be edited
    const { data: existingCampaign } = await supabase
      .from('email_campaigns')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!existingCampaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (!['draft', 'scheduled'].includes(existingCampaign.status)) {
      return NextResponse.json(
        { error: 'Cannot edit a campaign that has been sent or is currently sending' },
        { status: 400 }
      );
    }

    // Calculate recipient count if changed
    let totalRecipients = undefined;
    if (recipients && Array.isArray(recipients)) {
      totalRecipients = recipients.length;
    } else if (recipientListId) {
      const { count } = await supabase
        .from('email_recipient_lists_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', recipientListId);
      totalRecipients = count || 0;
    }

    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (htmlContent !== undefined) updateData.html_content = htmlContent;
    if (textContent !== undefined) updateData.text_content = textContent;
    if (recipients !== undefined) updateData.recipients = recipients;
    if (recipientListId !== undefined) updateData.recipient_list_id = recipientListId;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (scheduledAt !== undefined) {
      updateData.scheduled_at = scheduledAt;
      updateData.status = scheduledAt ? 'scheduled' : 'draft';
    }
    if (totalRecipients !== undefined) updateData.total_recipients = totalRecipients;

    const { data: campaign, error: updateError } = await supabase
      .from('email_campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    // Update stats if recipient count changed
    if (totalRecipients !== undefined) {
      await supabase
        .from('email_campaign_stats')
        .update({ total_recipients: totalRecipients })
        .eq('campaign_id', id);
    }

    return NextResponse.json({
      success: true,
      campaign,
      message: 'Campaign updated successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('[Campaigns] Error updating', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email/campaigns
 * Delete a campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin();

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing campaign id' },
        { status: 400 }
      );
    }

    // Check if campaign can be deleted
    const { data: existingCampaign } = await supabase
      .from('email_campaigns')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!existingCampaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (existingCampaign.status === 'sending') {
      return NextResponse.json(
        { error: 'Cannot delete a campaign that is currently sending' },
        { status: 400 }
      );
    }

    // Soft delete by marking as deleted
    const { error: deleteError } = await supabase
      .from('email_campaigns')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error: unknown) {
    apiLogger.error('[Campaigns] Error deleting', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function sendCampaign(supabase: unknown, campaignId: string, userId: string) {
  try {
    // Get campaign
    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (error || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Campaign cannot be sent in current status' },
        { status: 400 }
      );
    }

    // Update status to sending
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', campaignId);

    // Get recipients
    let recipients: CampaignRecipient[] = [];

    if (campaign.recipients && Array.isArray(campaign.recipients)) {
      recipients = campaign.recipients;
    } else if (campaign.recipient_list_id) {
      const { data: members } = await supabase
        .from('email_recipient_lists_members')
        .select('email, name, custom_data')
        .eq('list_id', campaign.recipient_list_id)
        .eq('is_active', true);

      recipients = (members || []).map((m: unknown) => ({
        email: m.email,
        name: m.name,
        customData: m.custom_data,
      }));
    }

    if (recipients.length === 0) {
      await supabase
        .from('email_campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId);

      return NextResponse.json(
        { error: 'No recipients for this campaign' },
        { status: 400 }
      );
    }

    // Check for suppressed emails
    const sesService = await initializeSESService();
    const validRecipients: CampaignRecipient[] = [];

    for (const recipient of recipients) {
      const isSuppressed = await sesService.isEmailSuppressed(recipient.email);
      if (!isSuppressed) {
        validRecipients.push(recipient);
      }
    }

    // Send campaign
    const result = await sesService.sendMarketingCampaign({
      recipients: validRecipients,
      subject: campaign.subject,
      htmlTemplate: campaign.html_content,
      textTemplate: campaign.text_content,
      campaignId: campaignId,
      tags: campaign.tags || [],
    });

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    // Update stats
    await supabase
      .from('email_campaign_stats')
      .update({
        sent_count: result.totalSent,
        total_recipients: recipients.length,
      })
      .eq('campaign_id', campaignId);

    // Store individual send results
    for (let i = 0; i < result.results.length; i++) {
      const sendResult = result.results[i];
      const recipient = validRecipients[i];

      await supabase.from('email_campaign_sends').insert({
        campaign_id: campaignId,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        message_id: sendResult.messageId,
        status: sendResult.success ? 'sent' : 'failed',
        error_message: sendResult.error,
        sent_at: sendResult.success ? new Date().toISOString() : null,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign sent successfully',
      totalSent: result.totalSent,
      totalFailed: result.totalFailed,
      totalRecipients: recipients.length,
      suppressedCount: recipients.length - validRecipients.length,
    });
  } catch (error: unknown) {
    // Revert status on error
    await supabase
      .from('email_campaigns')
      .update({ status: 'draft' })
      .eq('id', campaignId);

    throw error;
  }
}

async function scheduleCampaign(supabase: unknown, campaignId: string, scheduledAt: string) {
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to schedule campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    campaign,
    message: `Campaign scheduled for ${scheduledAt}`,
  });
}

async function pauseCampaign(supabase: unknown, campaignId: string) {
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to pause campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    campaign,
    message: 'Campaign paused',
  });
}

async function cancelCampaign(supabase: unknown, campaignId: string) {
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to cancel campaign' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    campaign,
    message: 'Campaign cancelled',
  });
}

async function duplicateCampaign(supabase: unknown, campaignId: string, userId: string) {
  // Get original campaign
  const { data: original, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (error || !original) {
    return NextResponse.json(
      { error: 'Campaign not found' },
      { status: 404 }
    );
  }

  // Create duplicate
  const { data: duplicate, error: createError } = await supabase
    .from('email_campaigns')
    .insert({
      name: `${original.name} (Copy)`,
      subject: original.subject,
      html_content: original.html_content,
      text_content: original.text_content,
      recipient_list_id: original.recipient_list_id,
      recipients: original.recipients,
      status: 'draft',
      total_recipients: original.total_recipients,
      tags: original.tags,
      metadata: original.metadata,
      created_by: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (createError) {
    return NextResponse.json(
      { error: 'Failed to duplicate campaign' },
      { status: 500 }
    );
  }

  // Create stats record
  await supabase.from('email_campaign_stats').insert({
    campaign_id: duplicate.id,
    total_recipients: original.total_recipients || 0,
    sent_count: 0,
    delivered_count: 0,
    bounced_count: 0,
    opened_count: 0,
    clicked_count: 0,
    unsubscribed_count: 0,
    complained_count: 0,
  });

  return NextResponse.json({
    success: true,
    campaign: duplicate,
    message: 'Campaign duplicated successfully',
  });
}

async function sendTestEmail(supabase: unknown, campaignId: string, testEmail: string) {
  // Get campaign
  const { data: campaign, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  if (error || !campaign) {
    return NextResponse.json(
      { error: 'Campaign not found' },
      { status: 404 }
    );
  }

  const sesService = await initializeSESService();

  // Send test email
  const result = await sesService.sendEmail({
    to: testEmail,
    subject: `[TEST] ${campaign.subject}`,
    html: campaign.html_content,
    text: campaign.text_content,
    tags: ['test', 'campaign-preview'],
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      messageId: result.messageId,
    });
  }

  return NextResponse.json(
    { error: result.error || 'Failed to send test email' },
    { status: 500 }
  );
}
