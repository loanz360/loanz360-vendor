// SMS Provider Factory

import { BaseSMSProvider, SMSProviderConfig } from './types'

// Provider implementations (simplified for deployment)
class MSG91Provider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('msg91', 'MSG91', config)
  }

  async sendSMS(message: unknown) {
    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': this.config.api_key || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_id: message.template_id,
        recipients: Array.isArray(message.to)
          ? message.to.map((n: string) => ({ mobiles: n }))
          : [{ mobiles: message.to }],
        ...message.metadata
      })
    })
    const data = await response.json()
    return { success: data.type === 'success', message_id: data.request_id, provider_response: data }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    return { credits: 0 }
  }

  async validateCredentials() {
    try {
      await this.getBalance()
      return true
    } catch {
      return false
    }
  }
}

class TextlocalProvider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('textlocal', 'Textlocal', config)
  }

  async sendSMS(message: unknown) {
    const params = new URLSearchParams({
      apikey: this.config.api_key || '',
      numbers: Array.isArray(message.to) ? message.to.join(',') : message.to,
      message: message.message,
      sender: message.sender_id || this.config.sender_id || 'TXTLCL'
    })

    const response = await fetch('https://api.textlocal.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    const data = await response.json()
    return {
      success: data.status === 'success',
      message_id: data.messages?.[0]?.id,
      provider_response: data
    }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    const params = new URLSearchParams({ apikey: this.config.api_key || '' })
    const response = await fetch(`https://api.textlocal.in/balance/?${params}`)
    const data = await response.json()
    return { credits: data.balance?.sms || 0 }
  }

  async validateCredentials() {
    try {
      await this.getBalance()
      return true
    } catch {
      return false
    }
  }
}

class GupshupProvider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('gupshup', 'Gupshup', config)
  }

  async sendSMS(message: unknown) {
    const params = new URLSearchParams({
      userid: this.config.username || '',
      password: this.config.password || '',
      send_to: Array.isArray(message.to) ? message.to.join(',') : message.to,
      msg: message.message,
      method: 'sendMessage',
      msg_type: 'TEXT',
      v: '1.1',
      auth_scheme: 'plain'
    })

    const response = await fetch('https://enterprise.smsgupshup.com/GatewayAPI/rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    const text = await response.text()
    const success = text.includes('success')
    return { success, message_id: text.split('|')[2]?.trim(), provider_response: text }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    return { credits: 0 }
  }

  async validateCredentials() {
    return true
  }
}

class VconProvider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('vcon', 'Vcon', config)
  }

  async sendSMS(message: unknown) {
    const params = new URLSearchParams({
      user: this.config.username || '',
      pass: this.config.password || '',
      dest: Array.isArray(message.to) ? message.to.join(',') : message.to,
      msg: message.message,
      send: this.config.sender_id || 'VCONIN'
    })

    const response = await fetch(`https://www.vcon.in/api/push.php?${params}`)
    const text = await response.text()
    return { success: text.includes('OK'), message_id: text, provider_response: text }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    return { credits: 0 }
  }

  async validateCredentials() {
    return true
  }
}

class AirtelProvider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('airtel', 'Airtel IQ', config)
  }

  async sendSMS(message: unknown) {
    const response = await fetch('https://iqsms.airtel.in/api/v1/send-sms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.auth_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: Array.isArray(message.to) ? message.to : [message.to],
        message: message.message,
        sender: message.sender_id || this.config.sender_id,
        templateId: message.template_id,
        entityId: message.entity_id || this.config.entity_id
      })
    })
    const data = await response.json()
    return { success: data.status === 'success', message_id: data.messageId, provider_response: data }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    return { credits: 0 }
  }

  async validateCredentials() {
    return true
  }
}

class KaleyraProvider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('kaleyra', 'Kaleyra', config)
  }

  async sendSMS(message: unknown) {
    const response = await fetch('https://api.kaleyra.io/v1/messages', {
      method: 'POST',
      headers: {
        'api-key': this.config.api_key || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: Array.isArray(message.to) ? message.to : [message.to],
        type: 'OTP',
        sender: message.sender_id || this.config.sender_id,
        body: message.message,
        template_id: message.template_id
      })
    })
    const data = await response.json()
    return { success: !!data.id, message_id: data.id, provider_response: data }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    return { credits: 0 }
  }

  async validateCredentials() {
    return true
  }
}

class TwoFactorProvider extends BaseSMSProvider {
  constructor(config: SMSProviderConfig) {
    super('2factor', '2Factor', config)
  }

  async sendSMS(message: unknown) {
    const phone = Array.isArray(message.to) ? message.to[0] : message.to
    const response = await fetch(
      `https://2factor.in/API/V1/${this.config.api_key}/SMS/${phone}/${message.message}`,
      { method: 'GET' }
    )
    const data = await response.json()
    return { success: data.Status === 'Success', message_id: data.Details, provider_response: data }
  }

  async sendBulkSMS(messages: unknown[]) {
    return Promise.all(messages.map(m => this.sendSMS(m)))
  }

  async getDeliveryStatus(messageId: string) {
    return { message_id: messageId, status: 'pending' as const }
  }

  async getBalance() {
    const response = await fetch(`https://2factor.in/API/V1/${this.config.api_key}/ADDON_SERVICES/BAL/SMS`)
    const data = await response.json()
    return { credits: parseInt(data.Details) || 0 }
  }

  async validateCredentials() {
    try {
      await this.getBalance()
      return true
    } catch {
      return false
    }
  }
}

// Provider factory
export function createSMSProvider(
  providerName: string,
  config: SMSProviderConfig
): BaseSMSProvider {
  switch (providerName.toLowerCase()) {
    case 'msg91':
      return new MSG91Provider(config)
    case 'textlocal':
      return new TextlocalProvider(config)
    case 'gupshup':
      return new GupshupProvider(config)
    case 'vcon':
      return new VconProvider(config)
    case 'airtel':
    case 'airtel_iq':
      return new AirtelProvider(config)
    case 'kaleyra':
      return new KaleyraProvider(config)
    case '2factor':
    case 'twofactor':
      return new TwoFactorProvider(config)
    default:
      throw new Error(`Unknown SMS provider: ${providerName}`)
  }
}

export const SUPPORTED_SMS_PROVIDERS = [
  { id: 'msg91', name: 'MSG91', country: 'India' },
  { id: 'textlocal', name: 'Textlocal', country: 'India' },
  { id: 'gupshup', name: 'Gupshup', country: 'India' },
  { id: 'vcon', name: 'Vcon', country: 'India' },
  { id: 'airtel', name: 'Airtel IQ', country: 'India' },
  { id: 'kaleyra', name: 'Kaleyra', country: 'Global' },
  { id: '2factor', name: '2Factor', country: 'India' }
]

export * from './types'
