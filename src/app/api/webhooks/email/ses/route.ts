/**
 * Amazon SES Webhook Handler (via SNS)
 * Handles delivery status updates, bounces, and complaints from Amazon SES
 *
 * Setup Requirements:
 * 1. Create an SNS topic for SES notifications
 * 2. Subscribe this webhook URL to the SNS topic
 * 3. Configure SES to send notifications to the SNS topic
 * 4. Confirm the SNS subscription (handled automatically below)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getSESService } from '@/lib/email/ses-service';
import crypto from 'crypto';
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SNS Message Types
interface SNSMessage {
  Type: 'SubscriptionConfirmation' | 'Notification' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string; // For subscription confirmation
  UnsubscribeURL?: string;
  Token?: string;
}

// SES Notification Types (inside SNS Message)
interface SESMailObject {
  timestamp: string;
  source: string;
  sourceArn?: string;
  sendingAccountId?: string;
  messageId: string;
  destination: string[];
  headersTruncated?: boolean;
  headers?: Array<{ name: string; value: string }>;
  commonHeaders?: {
    from: string[];
    to: string[];
    subject: string;
  };
  tags?: Record<string, string[]>;
}

interface SESBounceObject {
  bounceType: 'Undetermined' | 'Permanent' | 'Transient';
  bounceSubType: string;
  bouncedRecipients: Array<{
    emailAddress: string;
    action?: string;
    status?: string;
    diagnosticCode?: string;
  }>;
  timestamp: string;
  feedbackId: string;
  reportingMTA?: string;
}

interface SESComplaintObject {
  complainedRecipients: Array<{
    emailAddress: string;
  }>;
  timestamp: string;
  feedbackId: string;
  complaintSubType?: string;
  complaintFeedbackType?:
    | 'abuse'
    | 'auth-failure'
    | 'fraud'
    | 'not-spam'
    | 'other'
    | 'virus';
  userAgent?: string;
  arrivalDate?: string;
}

interface SESDeliveryObject {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  smtpResponse: string;
  reportingMTA: string;
}

interface SESRejectObject {
  reason: string;
}

interface SESNotification {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Send' | 'Reject';
  mail: SESMailObject;
  bounce?: SESBounceObject;
  complaint?: SESComplaintObject;
  delivery?: SESDeliveryObject;
  reject?: SESRejectObject;
}

/**
 * Verify SNS message signature
 * In production, implement proper certificate validation
 */
async function verifySNSSignature(message: SNSMessage): Promise<boolean> {
  // For now, basic validation
  // In production, fetch the certificate from SigningCertURL and verify
  if (!message.SigningCertURL) return false;

  // Validate that the signing cert URL is from AWS
  const certUrl = new URL(message.SigningCertURL);
  if (!certUrl.hostname.endsWith('.amazonaws.com')) {
    apiLogger.error('[SES Webhook] Invalid certificate URL domain');
    return false;
  }

  // Additional validation should be implemented in production
  return true;
}

/**
 * Handle SNS subscription confirmation
 */
async function handleSubscriptionConfirmation(
  message: SNSMessage
): Promise<boolean> {
  if (!message.SubscribeURL) {
    apiLogger.error('[SES Webhook] Missing SubscribeURL for subscription confirmation');
    return false;
  }

  try {
    // Automatically confirm the subscription
    const response = await fetch(message.SubscribeURL);
    if (response.ok) {
      return true;
    }
    apiLogger.error('[SES Webhook] Failed to confirm subscription');
    return false;
  } catch (error) {
    apiLogger.error('[SES Webhook] Error confirming subscription', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    const snsMessage: SNSMessage = JSON.parse(rawBody);


    // Verify signature
    const isValid = await verifySNSSignature(snsMessage);
    if (!isValid) {
      apiLogger.error('[SES Webhook] Invalid signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Handle subscription confirmation
    if (snsMessage.Type === 'SubscriptionConfirmation') {
      const confirmed = await handleSubscriptionConfirmation(snsMessage);
      return NextResponse.json({
        success: confirmed,
        message: confirmed ? 'Subscription confirmed' : 'Subscription confirmation failed',
      });
    }

    // Handle unsubscribe confirmation
    if (snsMessage.Type === 'UnsubscribeConfirmation') {
      return NextResponse.json({
        success: true,
        message: 'Unsubscribe confirmed',
      });
    }

    // Handle notification
    if (snsMessage.Type === 'Notification') {
      const sesNotification: SESNotification = JSON.parse(snsMessage.Message);
      const supabase = createSupabaseAdmin();
      const sesService = getSESService();

      // Store the webhook event
      const { data: webhookEvent } = await supabase
        .from('webhook_events')
        .insert({
          provider_name: 'ses',
          event_type: `ses.${sesNotification.notificationType.toLowerCase()}`,
          external_message_id: sesNotification.mail.messageId,
          raw_payload: {
            snsMessage,
            sesNotification,
          },
          parsed_data: {
            notificationType: sesNotification.notificationType,
            source: sesNotification.mail.source,
            destination: sesNotification.mail.destination,
            timestamp: sesNotification.mail.timestamp,
          },
          status: 'received',
          received_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();

      // Process based on notification type
      const messageId = sesNotification.mail.messageId;

      switch (sesNotification.notificationType) {
        case 'Send':
          await supabase
            .from('communication_delivery_log')
            .update({
              delivery_status: 'sent',
              sent_at: sesNotification.mail.timestamp,
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', messageId);
          break;

        case 'Delivery':
          const delivery = sesNotification.delivery;
          await supabase
            .from('communication_delivery_log')
            .update({
              delivery_status: 'delivered',
              delivered_at: delivery?.timestamp,
              provider_response_payload: {
                smtpResponse: delivery?.smtpResponse,
                processingTimeMillis: delivery?.processingTimeMillis,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', messageId);

          // Update message queue
          await supabase
            .from('message_queue')
            .update({
              status: 'delivered',
              delivered_at: delivery?.timestamp,
              updated_at: new Date().toISOString(),
            })
            .eq('external_message_id', messageId);
          break;

        case 'Bounce':
          const bounce = sesNotification.bounce;
          const isHardBounce = bounce?.bounceType === 'Permanent';

          await supabase
            .from('communication_delivery_log')
            .update({
              delivery_status: 'bounced',
              error_code: bounce?.bounceSubType,
              error_message: bounce?.bouncedRecipients
                .map((r) => r.diagnosticCode)
                .filter(Boolean)
                .join('; '),
              provider_response_payload: bounce,
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', messageId);

          // Update message queue
          await supabase
            .from('message_queue')
            .update({
              status: 'failed',
              error_message: `${bounce?.bounceType}: ${bounce?.bounceSubType}`,
              updated_at: new Date().toISOString(),
            })
            .eq('external_message_id', messageId);

          // Handle bounced recipients (parallel)
          await Promise.all((bounce?.bouncedRecipients || []).map(async (recipient: unknown) => {
            // Add to opt-out list for hard bounces
            if (isHardBounce) {
              await supabase.from('communication_optouts').upsert(
                {
                  identifier: recipient.emailAddress,
                  identifier_type: 'email',
                  channel: 'email',
                  reason: 'bounce',
                  source: 'ses_webhook',
                  is_active: true,
                  metadata: {
                    bounceType: bounce?.bounceType,
                    bounceSubType: bounce?.bounceSubType,
                    diagnosticCode: recipient.diagnosticCode,
                  },
                  opted_out_at: new Date().toISOString(),
                },
                {
                  onConflict: 'identifier,channel',
                }
              );

              // Also add to SES suppression list
              if (sesService.isInitialized()) {
                await sesService.suppressEmail(recipient.emailAddress, 'BOUNCE');
              }
            }

            // Store bounce event
            await supabase.from('email_events').insert({
              email_id: messageId,
              event_type: isHardBounce ? 'hard_bounce' : 'soft_bounce',
              recipient: recipient.emailAddress,
              metadata: {
                bounceType: bounce?.bounceType,
                bounceSubType: bounce?.bounceSubType,
                diagnosticCode: recipient.diagnosticCode,
                status: recipient.status,
                action: recipient.action,
              },
              event_at: bounce?.timestamp,
            });
          }))
          break;

        case 'Complaint':
          const complaint = sesNotification.complaint;

          await supabase
            .from('communication_delivery_log')
            .update({
              delivery_status: 'complained',
              error_message: `Complaint: ${complaint?.complaintFeedbackType || 'unknown'}`,
              provider_response_payload: complaint,
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', messageId);

          // Handle complained recipients (parallel)
          await Promise.all((complaint?.complainedRecipients || []).map(async (recipient: unknown) => {
            // Add to opt-out list
            await supabase.from('communication_optouts').upsert(
              {
                identifier: recipient.emailAddress,
                identifier_type: 'email',
                channel: 'email',
                reason: 'complaint',
                source: 'ses_webhook',
                is_active: true,
                metadata: {
                  complaintFeedbackType: complaint?.complaintFeedbackType,
                  complaintSubType: complaint?.complaintSubType,
                  userAgent: complaint?.userAgent,
                },
                opted_out_at: new Date().toISOString(),
              },
              {
                onConflict: 'identifier,channel',
              }
            );

            // Also add to SES suppression list
            if (sesService.isInitialized()) {
              await sesService.suppressEmail(recipient.emailAddress, 'COMPLAINT');
            }

            // Store complaint event
            await supabase.from('email_events').insert({
              email_id: messageId,
              event_type: 'complaint',
              recipient: recipient.emailAddress,
              metadata: {
                complaintFeedbackType: complaint?.complaintFeedbackType,
                complaintSubType: complaint?.complaintSubType,
              },
              event_at: complaint?.timestamp,
            });
          }))
          break;

        case 'Reject':
          const reject = sesNotification.reject;

          await supabase
            .from('communication_delivery_log')
            .update({
              delivery_status: 'rejected',
              error_message: reject?.reason,
              updated_at: new Date().toISOString(),
            })
            .eq('provider_message_id', messageId);

          // Update message queue
          await supabase
            .from('message_queue')
            .update({
              status: 'failed',
              error_message: `Rejected: ${reject?.reason}`,
              updated_at: new Date().toISOString(),
            })
            .eq('external_message_id', messageId);
          break;
      }

      // Mark webhook event as processed
      if (webhookEvent?.id) {
        await supabase
          .from('webhook_events')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEvent.id);
      }

      const processingTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: 'Webhook processed',
        event: sesNotification.notificationType,
        messageId: sesNotification.mail.messageId,
        processingTimeMs: processingTime,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown message type',
    });
  } catch (error: unknown) {
    apiLogger.error('[SES Webhook] Error', error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'ses',
    message: 'Amazon SES webhook endpoint active (via SNS)',
    setup: {
      steps: [
        '1. Create an SNS topic in AWS Console',
        '2. Subscribe this URL to the topic (HTTPS protocol)',
        '3. Configure SES to publish notifications to the SNS topic',
        '4. Enable notification types: Bounce, Complaint, Delivery, Send, Reject',
      ],
      configurationSet: 'Create a Configuration Set in SES for tracking',
    },
  });
}
