import { createClient } from '@supabase/supabase-js'

// ============================================================================
// INTEGRATION HUB SERVICE
// Enterprise integration management for third-party services
// Phase 4: Fortune 500 Features
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// TYPES
// ============================================================================

export type IntegrationType =
  | 'crm'
  | 'email'
  | 'chat'
  | 'slack'
  | 'teams'
  | 'jira'
  | 'zendesk'
  | 'salesforce'
  | 'hubspot'
  | 'webhook'
  | 'api'

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending'

export interface IntegrationConfig {
  id: string
  name: string
  type: IntegrationType
  description?: string
  status: IntegrationStatus
  config: Record<string, unknown>
  credentials: Record<string, string>
  events: string[]
  webhook_url?: string
  retry_policy: {
    max_retries: number
    retry_delay_ms: number
    backoff_multiplier: number
  }
  rate_limit?: {
    requests_per_minute: number
    requests_per_hour: number
  }
  created_by: string
  created_at: string
  updated_at: string
  last_synced_at?: string
  error_message?: string
}

export interface IntegrationEvent {
  id: string
  integration_id: string
  event_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'sent' | 'failed' | 'retrying'
  attempts: number
  response?: Record<string, unknown>
  error_message?: string
  created_at: string
  processed_at?: string
}

export interface WebhookPayload {
  event: string
  timestamp: string
  source: 'loanz360'
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface IntegrationSyncResult {
  success: boolean
  recordsSynced: number
  errors: string[]
  duration_ms: number
}

// ============================================================================
// INTEGRATION PROVIDERS
// ============================================================================

const INTEGRATION_PROVIDERS: Record<IntegrationType, {
  name: string
  description: string
  icon: string
  requiredFields: string[]
  supportedEvents: string[]
}> = {
  slack: {
    name: 'Slack',
    description: 'Send ticket notifications to Slack channels',
    icon: 'slack',
    requiredFields: ['webhook_url', 'channel'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved', 'sla_breach']
  },
  teams: {
    name: 'Microsoft Teams',
    description: 'Send ticket notifications to Teams channels',
    icon: 'teams',
    requiredFields: ['webhook_url'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved', 'sla_breach']
  },
  jira: {
    name: 'Jira',
    description: 'Sync tickets with Jira issues',
    icon: 'jira',
    requiredFields: ['api_url', 'api_token', 'project_key'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved']
  },
  zendesk: {
    name: 'Zendesk',
    description: 'Bi-directional sync with Zendesk tickets',
    icon: 'zendesk',
    requiredFields: ['subdomain', 'api_token', 'email'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved']
  },
  salesforce: {
    name: 'Salesforce',
    description: 'Sync with Salesforce Cases',
    icon: 'salesforce',
    requiredFields: ['instance_url', 'access_token', 'refresh_token'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved']
  },
  hubspot: {
    name: 'HubSpot',
    description: 'Sync with HubSpot Tickets',
    icon: 'hubspot',
    requiredFields: ['api_key'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved']
  },
  email: {
    name: 'Email (SMTP)',
    description: 'Send notifications via custom SMTP server',
    icon: 'mail',
    requiredFields: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved', 'message_received']
  },
  webhook: {
    name: 'Custom Webhook',
    description: 'Send events to a custom webhook URL',
    icon: 'webhook',
    requiredFields: ['webhook_url'],
    supportedEvents: ['*']
  },
  crm: {
    name: 'Generic CRM',
    description: 'Generic CRM integration via API',
    icon: 'database',
    requiredFields: ['api_url', 'api_key'],
    supportedEvents: ['ticket_created', 'ticket_updated', 'ticket_resolved']
  },
  chat: {
    name: 'Live Chat',
    description: 'Integration with live chat platforms',
    icon: 'message-circle',
    requiredFields: ['api_url', 'api_key'],
    supportedEvents: ['ticket_created', 'message_received']
  },
  api: {
    name: 'Custom API',
    description: 'Custom API integration',
    icon: 'code',
    requiredFields: ['api_url', 'api_key'],
    supportedEvents: ['*']
  }
}

// ============================================================================
// INTEGRATION HUB SERVICE CLASS
// ============================================================================

export class IntegrationHubService {
  private integrationsCache: Map<string, IntegrationConfig> = new Map()
  private cacheExpiry: number = 0
  private cacheTTL = 5 * 60 * 1000 // 5 minutes

  // ============================================================================
  // INTEGRATION MANAGEMENT
  // ============================================================================

  /**
   * Get all integrations
   */
  async getIntegrations(): Promise<IntegrationConfig[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching integrations:', error)
      return []
    }

    // Update cache
    data?.forEach(integration => {
      this.integrationsCache.set(integration.id, integration)
    })
    this.cacheExpiry = Date.now() + this.cacheTTL

    return data || []
  }

  /**
   * Get active integrations for an event type
   */
  async getActiveIntegrationsForEvent(eventType: string): Promise<IntegrationConfig[]> {
    const allIntegrations = await this.getIntegrations()

    return allIntegrations.filter(integration =>
      integration.status === 'active' &&
      (integration.events.includes(eventType) || integration.events.includes('*'))
    )
  }

  /**
   * Get integration by ID
   */
  async getIntegration(id: string): Promise<IntegrationConfig | null> {
    // Check cache
    if (this.integrationsCache.has(id) && Date.now() < this.cacheExpiry) {
      return this.integrationsCache.get(id)!
    }

    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null

    this.integrationsCache.set(id, data)
    return data
  }

  /**
   * Create a new integration
   */
  async createIntegration(
    integration: Omit<IntegrationConfig, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; integration?: IntegrationConfig; error?: string }> {
    try {
      // Validate required fields
      const provider = INTEGRATION_PROVIDERS[integration.type]
      if (!provider) {
        return { success: false, error: `Unknown integration type: ${integration.type}` }
      }

      const missingFields = provider.requiredFields.filter(
        field => !integration.config[field] && !integration.credentials[field]
      )

      if (missingFields.length > 0) {
        return { success: false, error: `Missing required fields: ${missingFields.join(', ')}` }
      }

      // Test connection before saving
      const testResult = await this.testIntegrationConnection(integration)
      if (!testResult.success) {
        return { success: false, error: `Connection test failed: ${testResult.error}` }
      }

      const { data, error } = await supabase
        .from('integrations')
        .insert({
          ...integration,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) throw error

      this.invalidateCache()
      return { success: true, integration: data }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Update an integration
   */
  async updateIntegration(
    id: string,
    updates: Partial<IntegrationConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('integrations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      this.invalidateCache()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id)

      if (error) throw error

      this.invalidateCache()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Test integration connection
   */
  async testIntegrationConnection(
    integration: Partial<IntegrationConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (integration.type) {
        case 'slack':
          return await this.testSlackConnection(integration)
        case 'teams':
          return await this.testTeamsConnection(integration)
        case 'webhook':
          return await this.testWebhookConnection(integration)
        case 'email':
          return await this.testEmailConnection(integration)
        default:
          // For other integrations, just return success for now
          return { success: true }
      }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  // ============================================================================
  // EVENT DISPATCH
  // ============================================================================

  /**
   * Dispatch an event to all active integrations
   */
  async dispatchEvent(
    eventType: string,
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const integrations = await this.getActiveIntegrationsForEvent(eventType)

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      source: 'loanz360',
      data,
      metadata
    }

    for (const integration of integrations) {
      try {
        await this.sendToIntegration(integration, payload)
        results.sent++

        // Log success
        await this.logIntegrationEvent(integration.id, eventType, payload, 'sent')
      } catch (error: unknown) {
        results.failed++
        results.errors.push(`${integration.name}: ${error instanceof Error ? error.message : String(error)}`)

        // Log failure
        await this.logIntegrationEvent(integration.id, eventType, payload, 'failed', error.message)

        // Update integration status if repeated failures
        await this.handleIntegrationError(integration, error)
      }
    }

    return results
  }

  /**
   * Send payload to a specific integration
   */
  private async sendToIntegration(
    integration: IntegrationConfig,
    payload: WebhookPayload
  ): Promise<void> {
    switch (integration.type) {
      case 'slack':
        await this.sendToSlack(integration, payload)
        break
      case 'teams':
        await this.sendToTeams(integration, payload)
        break
      case 'webhook':
        await this.sendToWebhook(integration, payload)
        break
      case 'jira':
        await this.sendToJira(integration, payload)
        break
      case 'email':
        await this.sendEmail(integration, payload)
        break
      default:
        await this.sendToWebhook(integration, payload)
    }
  }

  // ============================================================================
  // INTEGRATION-SPECIFIC HANDLERS
  // ============================================================================

  /**
   * Send to Slack
   */
  private async sendToSlack(
    integration: IntegrationConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const webhookUrl = integration.config.webhook_url || integration.credentials.webhook_url
    const channel = integration.config.channel

    const slackMessage = this.formatSlackMessage(payload)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...slackMessage,
        channel: channel
      })
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`)
    }
  }

  /**
   * Format message for Slack
   */
  private formatSlackMessage(payload: WebhookPayload): Record<string, unknown> {
    const ticket = payload.data

    const eventLabels: Record<string, string> = {
      ticket_created: '🎫 New Ticket Created',
      ticket_updated: '📝 Ticket Updated',
      ticket_resolved: '✅ Ticket Resolved',
      sla_breach: '⚠️ SLA Breach Alert',
      message_received: '💬 New Message'
    }

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: eventLabels[payload.event] || payload.event
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Ticket:*\n${ticket.ticket_number || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Priority:*\n${(ticket.priority || 'medium').toUpperCase()}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Subject:*\n${ticket.subject || 'No subject'}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Source: Loanz360 | ${new Date(payload.timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    }
  }

  /**
   * Send to Microsoft Teams
   */
  private async sendToTeams(
    integration: IntegrationConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const webhookUrl = integration.config.webhook_url || integration.credentials.webhook_url

    const teamsMessage = this.formatTeamsMessage(payload)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsMessage)
    })

    if (!response.ok) {
      throw new Error(`Teams webhook failed: ${response.statusText}`)
    }
  }

  /**
   * Format message for Teams
   */
  private formatTeamsMessage(payload: WebhookPayload): Record<string, unknown> {
    const ticket = payload.data

    const eventLabels: Record<string, string> = {
      ticket_created: '🎫 New Ticket Created',
      ticket_updated: '📝 Ticket Updated',
      ticket_resolved: '✅ Ticket Resolved',
      sla_breach: '⚠️ SLA Breach Alert',
      message_received: '💬 New Message'
    }

    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'F97316',
      summary: eventLabels[payload.event] || payload.event,
      sections: [{
        activityTitle: eventLabels[payload.event] || payload.event,
        facts: [
          { name: 'Ticket', value: ticket.ticket_number || 'N/A' },
          { name: 'Subject', value: ticket.subject || 'No subject' },
          { name: 'Priority', value: (ticket.priority || 'medium').toUpperCase() },
          { name: 'Status', value: (ticket.status || 'open').toUpperCase() }
        ],
        markdown: true
      }]
    }
  }

  /**
   * Send to generic webhook
   */
  private async sendToWebhook(
    integration: IntegrationConfig,
    payload: WebhookPayload
  ): Promise<void> {
    const webhookUrl = integration.config.webhook_url || integration.webhook_url

    if (!webhookUrl) {
      throw new Error('Webhook URL not configured')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(integration.config.headers || {})
    }

    // Add auth header if configured
    if (integration.credentials.api_key) {
      headers['Authorization'] = `Bearer ${integration.credentials.api_key}`
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Send to Jira
   */
  private async sendToJira(
    integration: IntegrationConfig,
    payload: WebhookPayload
  ): Promise<void> {
    // Only create issues for new tickets
    if (payload.event !== 'ticket_created') return

    const ticket = payload.data
    const apiUrl = integration.config.api_url
    const projectKey = integration.config.project_key
    const apiToken = integration.credentials.api_token
    const email = integration.config.email

    const jiraPayload = {
      fields: {
        project: { key: projectKey },
        summary: ticket.subject,
        description: ticket.description,
        issuetype: { name: 'Task' },
        priority: { name: this.mapPriorityToJira(ticket.priority) }
      }
    }

    const response = await fetch(`${apiUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jiraPayload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Jira API failed: ${error}`)
    }

    // Store the Jira issue key on the ticket
    const jiraIssue = await response.json()
    await this.linkExternalTicket(ticket.id, 'jira', jiraIssue.key)
  }

  /**
   * Map priority to Jira priority names
   */
  private mapPriorityToJira(priority: string): string {
    const mapping: Record<string, string> = {
      critical: 'Highest',
      urgent: 'High',
      high: 'High',
      medium: 'Medium',
      low: 'Low'
    }
    return mapping[priority] || 'Medium'
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    integration: IntegrationConfig,
    payload: WebhookPayload
  ): Promise<void> {
    // Queue email for sending
    await supabase
      .from('email_queue')
      .insert({
        to_email: integration.config.notification_email || payload.data.email,
        subject: `[${payload.event}] ${payload.data.subject || 'Support Ticket Update'}`,
        body: JSON.stringify(payload.data, null, 2),
        integration_id: integration.id,
        status: 'pending'
      })
  }

  // ============================================================================
  // CONNECTION TESTING
  // ============================================================================

  private async testSlackConnection(integration: Partial<IntegrationConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookUrl = integration.config?.webhook_url || integration.credentials?.webhook_url
      if (!webhookUrl) return { success: false, error: 'Webhook URL required' }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ Loanz360 integration test successful!'
        })
      })

      return { success: response.ok, error: response.ok ? undefined : 'Failed to send test message' }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  private async testTeamsConnection(integration: Partial<IntegrationConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookUrl = integration.config?.webhook_url || integration.credentials?.webhook_url
      if (!webhookUrl) return { success: false, error: 'Webhook URL required' }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: 'Test Message',
          themeColor: '00FF00',
          title: '✅ Loanz360 Integration Test',
          text: 'Integration test successful!'
        })
      })

      return { success: response.ok, error: response.ok ? undefined : 'Failed to send test message' }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  private async testWebhookConnection(integration: Partial<IntegrationConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      const webhookUrl = integration.config?.webhook_url || integration.webhook_url
      if (!webhookUrl) return { success: false, error: 'Webhook URL required' }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'connection_test',
          timestamp: new Date().toISOString(),
          source: 'loanz360'
        })
      })

      return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` }
    } catch (error: unknown) {
      return { success: false, error: error.message }
    }
  }

  private async testEmailConnection(integration: Partial<IntegrationConfig>): Promise<{ success: boolean; error?: string }> {
    // For email, we just validate the configuration
    const required = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password']
    const config = { ...integration.config, ...integration.credentials }

    for (const field of required) {
      if (!config[field]) {
        return { success: false, error: `Missing ${field}` }
      }
    }

    return { success: true }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Link external ticket/issue to internal ticket
   */
  private async linkExternalTicket(
    ticketId: string,
    system: string,
    externalId: string
  ): Promise<void> {
    await supabase
      .from('ticket_external_links')
      .insert({
        ticket_id: ticketId,
        external_system: system,
        external_id: externalId,
        created_at: new Date().toISOString()
      })
  }

  /**
   * Log integration event
   */
  private async logIntegrationEvent(
    integrationId: string,
    eventType: string,
    payload: WebhookPayload,
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    await supabase
      .from('integration_events')
      .insert({
        integration_id: integrationId,
        event_type: eventType,
        payload,
        status,
        error_message: errorMessage,
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      })
  }

  /**
   * Handle integration error
   */
  private async handleIntegrationError(
    integration: IntegrationConfig,
    error: Error
  ): Promise<void> {
    // Count recent errors
    const { count } = await supabase
      .from('integration_events')
      .select('*', { count: 'exact', head: true })
      .eq('integration_id', integration.id)
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour

    // If more than 5 failures in the last hour, mark as error
    if ((count || 0) >= 5) {
      await supabase
        .from('integrations')
        .update({
          status: 'error',
          error_message: `Multiple failures: ${error instanceof Error ? error.message : String(error)}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id)
    }
  }

  /**
   * Invalidate cache
   */
  invalidateCache(): void {
    this.integrationsCache.clear()
    this.cacheExpiry = 0
  }

  /**
   * Get available integration providers
   */
  getAvailableProviders(): typeof INTEGRATION_PROVIDERS {
    return INTEGRATION_PROVIDERS
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

let integrationHub: IntegrationHubService | null = null

export function getIntegrationHub(): IntegrationHubService {
  if (!integrationHub) {
    integrationHub = new IntegrationHubService()
  }
  return integrationHub
}

// Helper functions
export async function dispatchIntegrationEvent(
  eventType: string,
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  return getIntegrationHub().dispatchEvent(eventType, data, metadata)
}

export async function createIntegration(
  integration: Omit<IntegrationConfig, 'id' | 'created_at' | 'updated_at'>
) {
  return getIntegrationHub().createIntegration(integration)
}

export async function testIntegration(integration: Partial<IntegrationConfig>) {
  return getIntegrationHub().testIntegrationConnection(integration)
}

export { INTEGRATION_PROVIDERS }
