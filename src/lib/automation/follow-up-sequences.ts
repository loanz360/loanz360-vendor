/**
 * Automated Follow-up Sequences
 *
 * Manages automated follow-up schedules for contacts and leads.
 * When a CRO marks a contact for follow-up or a lead enters
 * a specific stage, a sequence of timed actions is triggered:
 * - Day 0: Immediate WhatsApp/SMS confirmation
 * - Day 1: Reminder to CRO to call
 * - Day 3: Auto-SMS to customer if no call made
 * - Day 7: Escalation alert if still no activity
 *
 * Sequences are stored in the tasks_reminders table
 * and processed by a cron job or on-demand.
 */

interface SequenceStep {
  delayDays: number
  action: 'sms_customer' | 'whatsapp_customer' | 'reminder_cro' | 'escalation'
  message: string
  smsTemplate?: string
  whatsappTemplate?: string
}

interface SequenceConfig {
  name: string
  triggerStage: string
  steps: SequenceStep[]
}

// Pre-built follow-up sequences
export const FOLLOW_UP_SEQUENCES: Record<string, SequenceConfig> = {
  new_contact: {
    name: 'New Contact Follow-up',
    triggerStage: 'new',
    steps: [
      {
        delayDays: 0,
        action: 'reminder_cro',
        message: 'New contact assigned. Call within 2 hours for best conversion.',
      },
      {
        delayDays: 1,
        action: 'reminder_cro',
        message: 'Reminder: Contact {{customer_name}} has not been called yet.',
      },
      {
        delayDays: 3,
        action: 'sms_customer',
        message: 'Hi {{customer_name}}, thank you for your interest in {{loan_type}}. Our advisor will connect with you shortly. - LOANZ 360',
      },
      {
        delayDays: 7,
        action: 'escalation',
        message: 'Contact {{customer_name}} uncalled for 7 days. Auto-escalating.',
      },
    ],
  },

  positive_contact: {
    name: 'Positive Contact Nurture',
    triggerStage: 'positive',
    steps: [
      {
        delayDays: 0,
        action: 'whatsapp_customer',
        message: 'Thank you for your interest {{customer_name}}! We are reviewing your {{loan_type}} requirements. Our advisor will share next steps soon.',
      },
      {
        delayDays: 2,
        action: 'reminder_cro',
        message: 'Follow up with {{customer_name}} - positive contact needs nurturing.',
      },
      {
        delayDays: 5,
        action: 'sms_customer',
        message: 'Hi {{customer_name}}, checking in on your {{loan_type}} requirement. Reply YES if still interested. - LOANZ 360',
      },
    ],
  },

  lead_docs_pending: {
    name: 'Document Collection Sequence',
    triggerStage: 'docs_pending',
    steps: [
      {
        delayDays: 0,
        action: 'whatsapp_customer',
        message: 'Hi {{customer_name}}, we need a few documents for your {{loan_type}} application. Please upload them using the link shared by your advisor.',
      },
      {
        delayDays: 2,
        action: 'reminder_cro',
        message: 'Documents pending for {{customer_name}}. Send upload link if not done.',
      },
      {
        delayDays: 4,
        action: 'sms_customer',
        message: 'Hi {{customer_name}}, your {{loan_type}} application is waiting for documents. Please submit them at the earliest. - LOANZ 360',
      },
      {
        delayDays: 7,
        action: 'reminder_cro',
        message: 'URGENT: {{customer_name}} documents still pending after 7 days.',
      },
    ],
  },

  lead_qualified: {
    name: 'Qualified Lead Push',
    triggerStage: 'qualified',
    steps: [
      {
        delayDays: 0,
        action: 'whatsapp_customer',
        message: 'Great news {{customer_name}}! Your {{loan_type}} application looks promising. Our advisor will guide you through the next steps.',
      },
      {
        delayDays: 1,
        action: 'reminder_cro',
        message: 'Qualified lead {{customer_name}} ready for document collection. Push for docs.',
      },
    ],
  },

  follow_up_scheduled: {
    name: 'Scheduled Follow-up',
    triggerStage: 'follow_up',
    steps: [
      {
        delayDays: 0,
        action: 'reminder_cro',
        message: 'Follow-up scheduled for {{customer_name}}. Call today.',
      },
    ],
  },
}

/**
 * Create follow-up tasks for a given sequence.
 * Returns task objects to be inserted into tasks_reminders.
 */
export function createFollowUpTasks(
  sequenceKey: string,
  params: {
    userId: string
    entityId: string
    entityType: 'contact' | 'lead'
    customerName: string
    customerPhone?: string
    loanType?: string
    loanAmount?: number
  }
) {
  const sequence = FOLLOW_UP_SEQUENCES[sequenceKey]
  if (!sequence) return []

  const now = new Date()

  return sequence.steps.map((step, index) => {
    const dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + step.delayDays)

    // Replace template variables
    const message = step.message
      .replace(/\{\{customer_name\}\}/g, params.customerName)
      .replace(/\{\{loan_type\}\}/g, params.loanType || 'loan')
      .replace(/\{\{loan_amount\}\}/g, params.loanAmount?.toLocaleString('en-IN') || '')

    const taskType =
      step.action === 'reminder_cro' ? 'follow_up'
        : step.action === 'escalation' ? 'follow_up'
          : step.action === 'sms_customer' ? 'call'
            : 'follow_up'

    return {
      user_id: params.userId,
      lead_id: params.entityType === 'lead' ? params.entityId : null,
      contact_id: params.entityType === 'contact' ? params.entityId : null,
      task_type: taskType,
      title: `[Auto] ${sequence.name} - Step ${index + 1}`,
      description: message,
      due_date: dueDate.toISOString().split('T')[0],
      due_time: step.delayDays === 0 ? '09:00:00' : '10:00:00',
      status: 'pending',
      priority: step.action === 'escalation' ? 'urgent' : 'medium',
      entity_type: params.entityType,
      customer_name: params.customerName,
      customer_phone: params.customerPhone || null,
      metadata: {
        sequence_key: sequenceKey,
        step_index: index,
        action: step.action,
        customer_phone: params.customerPhone,
        customer_name: params.customerName,
        loan_type: params.loanType,
        auto_generated: true,
      },
    }
  })
}

/**
 * Process due follow-up tasks.
 * Called by a cron job or triggered on demand.
 * For SMS/WhatsApp actions, sends the message.
 * For reminders, the task itself serves as the reminder.
 */
export async function processDueFollowUps(
  baseUrl: string,
  authCookie: string
): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  try {
    const response = await fetch(`${baseUrl}/api/ai-crm/cro/follow-ups/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
    })

    const result = await response.json()
    if (result.success) {
      processed = result.data?.processed || 0
      errors = result.data?.errors || 0
    }
  } catch {
    errors = 1
  }

  return { processed, errors }
}
