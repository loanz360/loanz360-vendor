/**
 * Smart Notification Service for Incentives Module
 * Provides intelligent, context-aware notifications for employee engagement
 */

import { createSupabaseClient } from '../supabase/client'

export type NotificationType =
  | 'milestone_achievement'
  | 'target_assigned'
  | 'deadline_reminder'
  | 'motivational_nudge'
  | 'claim_approved'
  | 'claim_rejected'
  | 'payment_processed'
  | 'tier_upgrade'
  | 'leaderboard_rank_change'
  | 'achievement_unlocked'

export interface SmartNotification {
  type: NotificationType
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  action_url?: string
  action_label?: string
  metadata?: Record<string, any>
  icon?: string
  color?: string
}

export class SmartNotificationService {
  private supabase = createSupabaseClient()

  /**
   * Send notification for milestone achievement
   */
  async sendMilestoneAchievement(
    userId: string,
    incentiveTitle: string,
    milestone: number,
    earnedAmount: number
  ): Promise<void> {
    const emojis = {
      25: '🥉',
      50: '🥈',
      75: '🥇',
      100: '🎉'
    }

    const messages = {
      25: `Great start! You've reached ${milestone}% of your target for "${incentiveTitle}"!`,
      50: `Halfway there! You're at ${milestone}% progress for "${incentiveTitle}". Keep going!`,
      75: `Almost there! You've achieved ${milestone}% of your target. The finish line is in sight!`,
      100: `Congratulations! You've achieved 100% of your target for "${incentiveTitle}"! ${earnedAmount > 0 ? `You've earned ₹${earnedAmount.toLocaleString()}!` : ''}`
    }

    const notification: SmartNotification = {
      type: 'milestone_achievement',
      title: `${emojis[milestone as keyof typeof emojis]} ${milestone}% Milestone Achieved!`,
      message: messages[milestone as keyof typeof messages] || `You've reached ${milestone}% progress!`,
      priority: milestone === 100 ? 'high' : 'medium',
      action_url: '/employees/incentives?tab=active',
      action_label: milestone === 100 ? 'Claim Reward' : 'View Progress',
      metadata: {
        incentive_title: incentiveTitle,
        milestone,
        earned_amount: earnedAmount
      },
      icon: '🎯',
      color: milestone === 100 ? '#10b981' : '#f59e0b'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send notification for new target assignment
   */
  async sendTargetAssigned(
    userId: string,
    incentiveTitle: string,
    targetValue: number,
    targetMetric: string,
    deadline: Date
  ): Promise<void> {
    const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

    const notification: SmartNotification = {
      type: 'target_assigned',
      title: '🎯 New Target Assigned!',
      message: `You've been assigned a new target: ${targetValue} ${targetMetric} for "${incentiveTitle}". Complete by ${deadline.toLocaleDateString()}!`,
      priority: 'medium',
      action_url: '/employees/incentives?tab=targets',
      action_label: 'View Target',
      metadata: {
        incentive_title: incentiveTitle,
        target_value: targetValue,
        target_metric: targetMetric,
        deadline: deadline.toISOString(),
        days_until_deadline: daysUntilDeadline
      },
      icon: '🎯',
      color: '#3b82f6'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send deadline reminder
   */
  async sendDeadlineReminder(
    userId: string,
    incentiveTitle: string,
    daysRemaining: number,
    currentProgress: number
  ): Promise<void> {
    const urgency = daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'high' : 'medium'

    const messages = {
      1: `⏰ Last day! Your target for "${incentiveTitle}" expires tomorrow. Current progress: ${currentProgress}%`,
      3: `⚡ 3 days left! Time is running out for "${incentiveTitle}". You're at ${currentProgress}% - push hard!`,
      7: `📅 One week remaining for "${incentiveTitle}". Current progress: ${currentProgress}%`
    }

    const defaultMessage = `⏳ ${daysRemaining} days left for "${incentiveTitle}". Current progress: ${currentProgress}%`

    const notification: SmartNotification = {
      type: 'deadline_reminder',
      title: `${daysRemaining === 1 ? '🚨' : '⏰'} Deadline Approaching!`,
      message: messages[daysRemaining as keyof typeof messages] || defaultMessage,
      priority: urgency,
      action_url: '/employees/incentives?tab=active',
      action_label: 'View Progress',
      metadata: {
        incentive_title: incentiveTitle,
        days_remaining: daysRemaining,
        current_progress: currentProgress
      },
      icon: '⏰',
      color: urgency === 'urgent' ? '#ef4444' : '#f59e0b'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send motivational nudge based on performance
   */
  async sendMotivationalNudge(
    userId: string,
    incentiveTitle: string,
    currentProgress: number,
    nextMilestone: number,
    gapToClose: number
  ): Promise<void> {
    const messages = [
      `💪 You're ${gapToClose} steps away from ${nextMilestone}% on "${incentiveTitle}"! You've got this!`,
      `🚀 Almost at ${nextMilestone}%! Just ${gapToClose} more to unlock your next reward!`,
      `⭐ You're doing great! ${gapToClose} more and you'll hit ${nextMilestone}% on "${incentiveTitle}"!`,
      `🔥 Keep the momentum going! ${nextMilestone}% is within reach - only ${gapToClose} to go!`
    ]

    const randomMessage = messages[Math.floor(Math.random() * messages.length)]

    const notification: SmartNotification = {
      type: 'motivational_nudge',
      title: '🎯 You\'re Almost There!',
      message: randomMessage,
      priority: 'low',
      action_url: '/employees/incentives?tab=active',
      action_label: 'See Progress',
      metadata: {
        incentive_title: incentiveTitle,
        current_progress: currentProgress,
        next_milestone: nextMilestone,
        gap_to_close: gapToClose
      },
      icon: '💪',
      color: '#8b5cf6'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send claim status notification
   */
  async sendClaimStatus(
    userId: string,
    incentiveTitle: string,
    claimAmount: number,
    status: 'approved' | 'rejected' | 'paid',
    reviewNotes?: string
  ): Promise<void> {
    const statusConfig = {
      approved: {
        title: '✅ Claim Approved!',
        message: `Your claim for ₹${claimAmount.toLocaleString()} on "${incentiveTitle}" has been approved! Payment will be processed soon.`,
        priority: 'high' as const,
        icon: '✅',
        color: '#10b981'
      },
      rejected: {
        title: '❌ Claim Rejected',
        message: `Unfortunately, your claim for ₹${claimAmount.toLocaleString()} on "${incentiveTitle}" was rejected. ${reviewNotes || 'Please contact HR for details.'}`,
        priority: 'high' as const,
        icon: '❌',
        color: '#ef4444'
      },
      paid: {
        title: '💰 Payment Processed!',
        message: `Great news! ₹${claimAmount.toLocaleString()} for "${incentiveTitle}" has been processed. Check your account!`,
        priority: 'urgent' as const,
        icon: '💰',
        color: '#10b981'
      }
    }

    const config = statusConfig[status]

    const notification: SmartNotification = {
      type: status === 'paid' ? 'payment_processed' : status === 'approved' ? 'claim_approved' : 'claim_rejected',
      title: config.title,
      message: config.message,
      priority: config.priority,
      action_url: '/employees/incentives?tab=active',
      action_label: 'View Details',
      metadata: {
        incentive_title: incentiveTitle,
        claim_amount: claimAmount,
        status,
        review_notes: reviewNotes
      },
      icon: config.icon,
      color: config.color
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send tier upgrade notification
   */
  async sendTierUpgrade(
    userId: string,
    incentiveTitle: string,
    oldTier: string,
    newTier: string,
    newRewardAmount: number
  ): Promise<void> {
    const tierEmojis = {
      BRONZE: '🥉',
      SILVER: '🥈',
      GOLD: '🥇',
      PLATINUM: '👑',
      DIAMOND: '💎'
    }

    const notification: SmartNotification = {
      type: 'tier_upgrade',
      title: `${tierEmojis[newTier as keyof typeof tierEmojis] || '🏆'} Tier Upgraded!`,
      message: `Congratulations! You've been upgraded from ${oldTier} to ${newTier} tier on "${incentiveTitle}"! New reward: ₹${newRewardAmount.toLocaleString()}`,
      priority: 'high',
      action_url: '/employees/incentives?tab=active',
      action_label: 'View Achievement',
      metadata: {
        incentive_title: incentiveTitle,
        old_tier: oldTier,
        new_tier: newTier,
        new_reward_amount: newRewardAmount
      },
      icon: '🏆',
      color: '#f59e0b'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send leaderboard rank change notification
   */
  async sendLeaderboardUpdate(
    userId: string,
    newRank: number,
    oldRank: number,
    totalParticipants: number
  ): Promise<void> {
    const improved = newRank < oldRank
    const rankChange = Math.abs(newRank - oldRank)

    const notification: SmartNotification = {
      type: 'leaderboard_rank_change',
      title: improved ? '📈 You\'re Moving Up!' : '📊 Leaderboard Update',
      message: improved
        ? `You've climbed ${rankChange} positions to #${newRank}! You're now in the top ${Math.round((newRank / totalParticipants) * 100)}%!`
        : `Your rank is now #${newRank} out of ${totalParticipants}. Time to push harder!`,
      priority: improved ? 'medium' : 'low',
      action_url: '/employees/incentives?tab=analytics',
      action_label: 'View Leaderboard',
      metadata: {
        new_rank: newRank,
        old_rank: oldRank,
        rank_change: rankChange,
        improved,
        total_participants: totalParticipants
      },
      icon: improved ? '📈' : '📊',
      color: improved ? '#10b981' : '#6b7280'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Send achievement unlocked notification
   */
  async sendAchievementUnlocked(
    userId: string,
    achievementName: string,
    achievementDescription: string,
    badgeIcon: string
  ): Promise<void> {
    const notification: SmartNotification = {
      type: 'achievement_unlocked',
      title: '🏅 Achievement Unlocked!',
      message: `You've earned "${achievementName}"! ${achievementDescription}`,
      priority: 'medium',
      action_url: '/employees/incentives?tab=analytics',
      action_label: 'View Achievements',
      metadata: {
        achievement_name: achievementName,
        achievement_description: achievementDescription,
        badge_icon: badgeIcon
      },
      icon: badgeIcon,
      color: '#8b5cf6'
    }

    await this.sendNotification(userId, notification)
  }

  /**
   * Core method to send notification to database
   */
  private async sendNotification(userId: string, notification: SmartNotification): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          action_url: notification.action_url,
          action_label: notification.action_label,
          metadata: notification.metadata,
          is_read: false,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Failed to send notification:', error)
      } else {
        console.log(`✅ Notification sent to user ${userId}: ${notification.title}`)
      }

      // Also send email/SMS for high-priority notifications
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        await this.sendExternalNotification(userId, notification)
      }
    } catch (err) {
      console.error('Error sending notification:', err)
    }
  }

  /**
   * Send external notifications (email/SMS) for high-priority items
   */
  private async sendExternalNotification(userId: string, notification: SmartNotification): Promise<void> {
    try {
      // Get user's communication preferences
      const { data: employee } = await this.supabase
        .from('employees')
        .select('professional_mail, mobile')
        .eq('user_id', userId)
        .maybeSingle()

      if (!employee) return

      // Send email notification (if email exists)
      if (employee.professional_mail) {
        await fetch('/api/notifications/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: employee.professional_mail,
            subject: notification.title,
            message: notification.message,
            action_url: notification.action_url,
            action_label: notification.action_label
          })
        })
      }

      // Send SMS notification (if mobile exists and notification is urgent)
      if (employee.mobile && notification.priority === 'urgent') {
        await fetch('/api/notifications/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: employee.mobile,
            message: `${notification.title}: ${notification.message}`
          })
        })
      }
    } catch (err) {
      console.error('Failed to send external notification:', err)
    }
  }

  /**
   * Batch send notifications to multiple users
   */
  async sendBatchNotifications(
    userIds: string[],
    notificationFactory: (userId: string) => SmartNotification
  ): Promise<void> {
    const promises = userIds.map(userId =>
      this.sendNotification(userId, notificationFactory(userId))
    )

    await Promise.all(promises)
  }

  /**
   * Schedule notification for future delivery
   */
  async scheduleNotification(
    userId: string,
    notification: SmartNotification,
    deliveryTime: Date
  ): Promise<void> {
    const delay = deliveryTime.getTime() - Date.now()

    if (delay <= 0) {
      // Send immediately if time has already passed
      await this.sendNotification(userId, notification)
      return
    }

    // Schedule for future (in production, use a job queue like Bull/BullMQ)
    setTimeout(() => {
      this.sendNotification(userId, notification)
    }, Math.min(delay, 2147483647)) // Max setTimeout value
  }
}

// Export singleton instance
export const smartNotificationService = new SmartNotificationService()
