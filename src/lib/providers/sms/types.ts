// SMS Provider Types

export interface SMSMessage {
  to: string | string[]
  message: string
  sender_id?: string
  template_id?: string  // For DLT compliance (India)
  entity_id?: string    // For DLT compliance (India)
  metadata?: Record<string, unknown>
}

export interface SMSResponse {
  success: boolean
  message_id?: string
  provider_response?: unknown; error?: string
  error_code?: string
  credits_used?: number
}

export interface SMSDeliveryStatus {
  message_id: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'rejected'
  delivered_at?: string
  error?: string
}

export interface SMSBalance {
  credits: number
  currency?: string
  expiry?: string
}

export interface SMSProviderConfig {
  api_key?: string
  api_secret?: string
  sender_id?: string
  entity_id?: string  // DLT Entity ID for India
  base_url?: string
  username?: string
  password?: string
  auth_token?: string
  [key: string]: string | undefined
}

export abstract class BaseSMSProvider {
  protected config: SMSProviderConfig
  public readonly name: string
  public readonly displayName: string

  constructor(name: string, displayName: string, config: SMSProviderConfig) {
    this.name = name
    this.displayName = displayName
    this.config = config
  }

  abstract sendSMS(message: SMSMessage): Promise<SMSResponse>
  abstract sendBulkSMS(messages: SMSMessage[]): Promise<SMSResponse[]>
  abstract getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus>
  abstract getBalance(): Promise<SMSBalance>
  abstract validateCredentials(): Promise<boolean>
}
