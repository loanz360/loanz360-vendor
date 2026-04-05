import { apiLogger } from '@/lib/utils/logger'

type NotificationChannel = 'slack' | 'teams' | 'whatsapp' | 'email'

interface ChannelConfig {
  slack?: { webhookUrl: string; defaultChannel?: string }
  teams?: { webhookUrl: string }
  whatsapp?: { apiUrl: string; apiKey: string; senderNumber: string }
  email?: { from: string }
}

interface NotificationPayload {
  title: string
  message: string
  channel: NotificationChannel
  recipient?: string // email, phone, or channel name
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  metadata?: Record<string, string>
}

interface NotificationResult {
  success: boolean
  channel: NotificationChannel
  messageId?: string
  error?: string
}

// Slack message formatter
function formatSlackMessage(payload: NotificationPayload): Record<string, unknown> {
  const priorityEmoji: Record<string, string> = {
    urgent: ':rotating_light:',
    high: ':warning:',
    normal: ':information_source:',
    low: ':speech_balloon:',
  }
  const emoji = priorityEmoji[payload.priority || 'normal']

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${payload.title}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: payload.message },
      },
      ...(payload.metadata ? [{
        type: 'context',
        elements: Object.entries(payload.metadata).map(([k, v]) => ({
          type: 'mrkdwn',
          text: `*${k}:* ${v}`,
        })),
      }] : []),
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `Sent from LOANZ 360 HR Portal • ${new Date().toLocaleString('en-IN')}`,
        }],
      },
    ],
  }
}

// Teams Adaptive Card formatter
function formatTeamsMessage(payload: NotificationPayload): Record<string, unknown> {
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        body: [
          {
            type: 'TextBlock',
            size: 'Medium',
            weight: 'Bolder',
            text: payload.title,
          },
          {
            type: 'TextBlock',
            text: payload.message,
            wrap: true,
          },
          ...(payload.metadata ? [{
            type: 'FactSet',
            facts: Object.entries(payload.metadata).map(([title, value]) => ({ title, value })),
          }] : []),
        ],
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.4',
      },
    }],
  }
}

// WhatsApp message formatter (for WhatsApp Business API)
function formatWhatsAppMessage(payload: NotificationPayload, recipient: string): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: 'hr_notification',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: payload.title },
          { type: 'text', text: payload.message },
        ],
      }],
    },
  }
}

// Send notification to a specific channel
async function sendNotification(
  payload: NotificationPayload,
  config: ChannelConfig
): Promise<NotificationResult> {
  try {
    switch (payload.channel) {
      case 'slack': {
        if (!config.slack?.webhookUrl) {
          return { success: false, channel: 'slack', error: 'Slack webhook URL not configured' }
        }
        const slackBody = formatSlackMessage(payload)
        const res = await fetch(config.slack.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackBody),
        })
        return { success: res.ok, channel: 'slack', error: res.ok ? undefined : `Slack API error: ${res.status}` }
      }

      case 'teams': {
        if (!config.teams?.webhookUrl) {
          return { success: false, channel: 'teams', error: 'Teams webhook URL not configured' }
        }
        const teamsBody = formatTeamsMessage(payload)
        const res = await fetch(config.teams.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamsBody),
        })
        return { success: res.ok, channel: 'teams', error: res.ok ? undefined : `Teams API error: ${res.status}` }
      }

      case 'whatsapp': {
        if (!config.whatsapp?.apiUrl || !config.whatsapp?.apiKey) {
          return { success: false, channel: 'whatsapp', error: 'WhatsApp API not configured' }
        }
        if (!payload.recipient) {
          return { success: false, channel: 'whatsapp', error: 'Recipient phone number required' }
        }
        const waBody = formatWhatsAppMessage(payload, payload.recipient)
        const res = await fetch(config.whatsapp.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.whatsapp.apiKey}`,
          },
          body: JSON.stringify(waBody),
        })
        const data = await res.json()
        return {
          success: res.ok,
          channel: 'whatsapp',
          messageId: data?.messages?.[0]?.id,
          error: res.ok ? undefined : data?.error?.message || `WhatsApp API error: ${res.status}`,
        }
      }

      case 'email': {
        // Email is handled by existing email service, just return success
        return { success: true, channel: 'email' }
      }

      default:
        return { success: false, channel: payload.channel, error: `Unknown channel: ${payload.channel}` }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    apiLogger.error(`Notification send failed for ${payload.channel}`, { error: message })
    return { success: false, channel: payload.channel, error: message }
  }
}

// Send to multiple channels
async function broadcastNotification(
  payload: Omit<NotificationPayload, 'channel'>,
  channels: NotificationChannel[],
  config: ChannelConfig
): Promise<NotificationResult[]> {
  const results = await Promise.allSettled(
    channels.map(channel => sendNotification({ ...payload, channel }, config))
  )

  return results.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value
    return { success: false, channel: channels[idx], error: String(result.reason) }
  })
}

// HR-specific notification templates
const HR_NOTIFICATION_TEMPLATES = {
  leaveApproved: (name: string, dates: string) => ({
    title: 'Leave Approved',
    message: `${name}'s leave request for ${dates} has been approved.`,
  }),
  leaveRejected: (name: string, dates: string, reason: string) => ({
    title: 'Leave Rejected',
    message: `${name}'s leave request for ${dates} has been rejected. Reason: ${reason}`,
  }),
  payrollProcessed: (month: string, count: number) => ({
    title: 'Payroll Processed',
    message: `Payroll for ${month} has been processed for ${count} employees.`,
  }),
  newJoiner: (name: string, dept: string, date: string) => ({
    title: 'New Team Member',
    message: `Welcome ${name} who joins ${dept} on ${date}!`,
  }),
  birthdayWish: (name: string) => ({
    title: 'Birthday Celebration',
    message: `Wishing ${name} a very Happy Birthday!`,
  }),
  resignationAlert: (name: string, dept: string) => ({
    title: 'Resignation Alert',
    message: `${name} from ${dept} has submitted their resignation.`,
  }),
}

export {
  sendNotification,
  broadcastNotification,
  formatSlackMessage,
  formatTeamsMessage,
  formatWhatsAppMessage,
  HR_NOTIFICATION_TEMPLATES,
}
export type { NotificationPayload, NotificationResult, ChannelConfig, NotificationChannel }
