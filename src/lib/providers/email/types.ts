// Email Provider Types

export interface EmailMessage {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  reply_to?: string
  cc?: string[]
  bcc?: string[]
  attachments?: EmailAttachment[]
  headers?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface EmailAttachment {
  filename: string
  content: string | Buffer
  content_type?: string
  disposition?: 'attachment' | 'inline'
  content_id?: string
}

export interface EmailResponse {
  success: boolean
  message_id?: string
  provider_response?: unknown  error?: string
  error_code?: string
}

export interface EmailDeliveryStatus {
  message_id: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  delivered_at?: string
  opened_at?: string
  clicked_at?: string
  error?: string
}

export interface EmailProviderConfig {
  api_key?: string
  api_secret?: string
  domain?: string
  from_email?: string
  from_name?: string
  region?: string
  host?: string
  port?: number
  username?: string
  password?: string
  secure?: boolean
  [key: string]: string | number | boolean | undefined
}

export abstract class BaseEmailProvider {
  protected config: EmailProviderConfig
  public readonly name: string
  public readonly displayName: string

  constructor(name: string, displayName: string, config: EmailProviderConfig) {
    this.name = name
    this.displayName = displayName
    this.config = config
  }

  abstract sendEmail(message: EmailMessage): Promise<EmailResponse>
  abstract sendBulkEmail(messages: EmailMessage[]): Promise<EmailResponse[]>
  abstract getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus>
  abstract validateCredentials(): Promise<boolean>
}
