/**
 * SMS Notification Service for Customer Support Tickets
 *
 * This service handles sending SMS notifications for urgent ticket events:
 * - Urgent ticket created
 * - SLA breach imminent
 * - Critical customer escalation
 *
 * SMS notifications are reserved for high-priority events only to avoid spam.
 */

interface SMSData {
  to: string // Phone number in E.164 format (+1234567890)
  message: string
}

interface TicketSMSData {
  ticketNumber: string
  ticketId: string
  customerName: string
  customerPhone?: string
  agentName?: string
  agentPhone?: string
  priority: string
  subject: string
}

export class SMSNotificationService {
  private static apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  /**
   * Send SMS notification
   * In production, this would integrate with SMS service (Twilio, AWS SNS, etc.)
   */
  private static async sendSMS(data: SMSData): Promise<boolean> {
    try {
      // Validate phone number format
      if (!data.to.match(/^\+[1-9]\d{1,14}$/)) {
        console.error('Invalid phone number format:', data.to)
        return false
      }

      // Limit SMS message to 160 characters (standard SMS length)
      const message = data.message.substring(0, 160)

      // TODO: Integrate with actual SMS service
      // For now, log to console (in production, call SMS API)
      console.log('📱 SMS Notification:', {
        to: data.to,
        message: message,
        length: message.length
      })

      // Uncomment when integrating with actual SMS service (Twilio example):
      /*
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.to,
          message: message
        })
      })
      return response.ok
      */

      // Twilio integration example:
      /*
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_PHONE_NUMBER

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: data.to,
            From: fromNumber,
            Body: message
          })
        }
      )
      return response.ok
      */

      return true
    } catch (error) {
      console.error('Error sending SMS:', error)
      return false
    }
  }

  /**
   * Notify customer when urgent ticket is created
   */
  static async notifyUrgentTicketCreated(data: TicketSMSData): Promise<boolean> {
    if (!data.customerPhone) return false

    const message = `Loanz360: Urgent support ticket ${data.ticketNumber} created. We'll respond within 1 hour. Track: ${this.apiUrl.replace('http://', '').replace('https://', '')}`

    return this.sendSMS({
      to: data.customerPhone,
      message
    })
  }

  /**
   * Notify agent when urgent ticket is assigned
   */
  static async notifyAgentUrgentAssignment(data: TicketSMSData): Promise<boolean> {
    if (!data.agentPhone) return false

    const message = `🚨 URGENT: Ticket ${data.ticketNumber} assigned to you. Customer: ${data.customerName}. Respond ASAP!`

    return this.sendSMS({
      to: data.agentPhone,
      message
    })
  }

  /**
   * Notify agent when SLA is about to breach (30 min warning)
   */
  static async notifySLABreachImminent(data: TicketSMSData, minutesRemaining: number): Promise<boolean> {
    if (!data.agentPhone) return false

    const message = `⚠️ SLA ALERT: Ticket ${data.ticketNumber} breaches in ${minutesRemaining}min! Respond now to avoid breach.`

    return this.sendSMS({
      to: data.agentPhone,
      message
    })
  }

  /**
   * Notify manager when SLA breach occurs
   */
  static async notifySLABreached(data: TicketSMSData, managerPhone: string): Promise<boolean> {
    if (!managerPhone) return false

    const message = `🚨 SLA BREACH: Ticket ${data.ticketNumber} from ${data.customerName}. Escalate immediately!`

    return this.sendSMS({
      to: managerPhone,
      message
    })
  }

  /**
   * Notify customer when urgent ticket is resolved
   */
  static async notifyUrgentTicketResolved(data: TicketSMSData): Promise<boolean> {
    if (!data.customerPhone) return false

    const message = `Loanz360: Your urgent ticket ${data.ticketNumber} is resolved. Please rate your experience in your account.`

    return this.sendSMS({
      to: data.customerPhone,
      message
    })
  }

  /**
   * Send critical escalation notification to manager
   */
  static async notifyCriticalEscalation(data: TicketSMSData, managerPhone: string, reason: string): Promise<boolean> {
    if (!managerPhone) return false

    const truncatedReason = reason.substring(0, 60)
    const message = `🚨 ESCALATION: ${data.ticketNumber} - ${truncatedReason}. Review immediately!`

    return this.sendSMS({
      to: managerPhone,
      message
    })
  }

  /**
   * Batch notify multiple agents about high-priority ticket queue
   */
  static async notifyTeamHighPriorityQueue(agentPhones: string[], count: number): Promise<boolean[]> {
    const message = `Loanz360: ${count} high-priority tickets in queue. Please check your dashboard and respond.`

    return Promise.all(
      agentPhones.map(phone => this.sendSMS({ to: phone, message }))
    )
  }

  /**
   * Send customer satisfaction survey reminder (for resolved tickets)
   */
  static async sendSatisfactionSurveyReminder(data: TicketSMSData): Promise<boolean> {
    if (!data.customerPhone) return false

    const message = `Loanz360: How was your support experience? Rate ticket ${data.ticketNumber}: ${this.apiUrl.replace('http://', '').replace('https://', '')}/support/${data.ticketId}`

    return this.sendSMS({
      to: data.customerPhone,
      message
    })
  }

  /**
   * Utility: Format phone number to E.164
   */
  static formatPhoneNumber(phone: string, countryCode: string = '+91'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')

    // If already has country code, return as is
    if (phone.startsWith('+')) {
      return phone
    }

    // If 10 digits (Indian mobile), add country code
    if (digits.length === 10) {
      return `${countryCode}${digits}`
    }

    // If already has country code digits, add +
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`
    }

    return `${countryCode}${digits}`
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    // E.164 format: + followed by 1-15 digits
    return /^\+[1-9]\d{1,14}$/.test(phone)
  }
}

export default SMSNotificationService
