/**
 * Notification Utility
 * Handles sending notifications via email and in-app
 */

export interface NotificationPayload {
  userId: string
  type: 'leave_approval' | 'leave_rejection' | 'regularization_approval' | 'regularization_rejection' | 'lead_assignment'
  title: string
  message: string
  metadata?: Record<string, any>
}

/**
 * Send email notification to user
 */
export async function sendEmailNotification(payload: NotificationPayload): Promise<void> {
  try {
    // Call email API endpoint
    const response = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('Email notification failed:', await response.text())
    }
  } catch (error) {
    console.error('Error sending email notification:', error)
  }
}

/**
 * Create in-app notification
 */
export async function createInAppNotification(payload: NotificationPayload): Promise<void> {
  try {
    const response = await fetch('/api/notifications/in-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('In-app notification failed:', await response.text())
    }
  } catch (error) {
    console.error('Error creating in-app notification:', error)
  }
}

/**
 * Send both email and in-app notifications
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  await Promise.all([
    sendEmailNotification(payload),
    createInAppNotification(payload),
  ])
}

/**
 * Send leave approval notification
 */
export async function notifyLeaveApproval(userId: string, leaveDetails: any): Promise<void> {
  await sendNotification({
    userId,
    type: 'leave_approval',
    title: 'Leave Request Approved',
    message: `Your leave request from ${leaveDetails.startDate} to ${leaveDetails.endDate} has been approved.`,
    metadata: leaveDetails,
  })
}

/**
 * Send leave rejection notification
 */
export async function notifyLeaveRejection(userId: string, leaveDetails: any, reason: string): Promise<void> {
  await sendNotification({
    userId,
    type: 'leave_rejection',
    title: 'Leave Request Rejected',
    message: `Your leave request has been rejected. Reason: ${reason}`,
    metadata: { ...leaveDetails, reason },
  })
}

/**
 * Send regularization approval notification
 */
export async function notifyRegularizationApproval(userId: string, regularizationDetails: any): Promise<void> {
  await sendNotification({
    userId,
    type: 'regularization_approval',
    title: 'Attendance Regularization Approved',
    message: `Your attendance regularization for ${regularizationDetails.date} has been approved.`,
    metadata: regularizationDetails,
  })
}

/**
 * Send regularization rejection notification
 */
export async function notifyRegularizationRejection(userId: string, regularizationDetails: any, reason: string): Promise<void> {
  await sendNotification({
    userId,
    type: 'regularization_rejection',
    title: 'Attendance Regularization Rejected',
    message: `Your attendance regularization request has been rejected. Reason: ${reason}`,
    metadata: { ...regularizationDetails, reason },
  })
}

/**
 * Send lead assignment notification
 */
export async function notifyLeadAssignment(userId: string, leadDetails: any): Promise<void> {
  await sendNotification({
    userId,
    type: 'lead_assignment',
    title: 'New Lead Assigned',
    message: `A new lead "${leadDetails.customerName}" has been assigned to you.`,
    metadata: leadDetails,
  })
}
