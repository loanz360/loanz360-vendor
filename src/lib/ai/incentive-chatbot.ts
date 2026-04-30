/**
 * AI-Powered Incentive Chatbot Assistant
 * Natural language interface for incentive queries
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    queryType?: string
    contextData?: unknown; functionCalls?: string[]
  }
}

export interface ChatbotContext {
  userId: string
  userName: string
  userRole: string
  currentIncentives?: unknown[]
  recentActivity?: unknown[]
}

export class IncentiveChatbot {
  private context: ChatbotContext
  private conversationHistory: ChatMessage[] = []

  constructor(context: ChatbotContext) {
    this.context = context
  }

  /**
   * Process user query and generate response
   */
  async processQuery(userMessage: string): Promise<ChatMessage> {
    // Add user message to history
    this.conversationHistory.push({
      id: this.generateMessageId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    })

    // Analyze query intent
    const intent = this.analyzeIntent(userMessage)

    // Get relevant context
    const contextData = await this.getRelevantContext(intent)

    // Generate response based on intent
    const response = await this.generateResponse(userMessage, intent, contextData)

    // Add assistant response to history
    const assistantMessage: ChatMessage = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        queryType: intent.type,
        contextData: response.data,
        functionCalls: response.functionsUsed,
      },
    }

    this.conversationHistory.push(assistantMessage)

    return assistantMessage
  }

  /**
   * Analyze user intent from message
   */
  private analyzeIntent(message: string): { type: string; entities: unknown} {
    const lowerMessage = message.toLowerCase()

    // Progress queries
    if (
      lowerMessage.includes('how close') ||
      lowerMessage.includes('progress') ||
      lowerMessage.includes('how far') ||
      lowerMessage.includes('how much')
    ) {
      return { type: 'progress_query', entities: {} }
    }

    // Target queries
    if (
      lowerMessage.includes('target') ||
      lowerMessage.includes('goal') ||
      lowerMessage.includes('what do i need')
    ) {
      return { type: 'target_query', entities: {} }
    }

    // Leaderboard/Rank queries
    if (
      lowerMessage.includes('rank') ||
      lowerMessage.includes('leaderboard') ||
      lowerMessage.includes('standing') ||
      lowerMessage.includes('position')
    ) {
      return { type: 'rank_query', entities: {} }
    }

    // Claim queries
    if (
      lowerMessage.includes('claim') ||
      lowerMessage.includes('reward') ||
      lowerMessage.includes('payment')
    ) {
      return { type: 'claim_query', entities: {} }
    }

    // Help queries
    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('how to') ||
      lowerMessage.includes('what is') ||
      lowerMessage.includes('explain')
    ) {
      return { type: 'help_query', entities: {} }
    }

    // Tips/Advice
    if (
      lowerMessage.includes('tip') ||
      lowerMessage.includes('advice') ||
      lowerMessage.includes('improve') ||
      lowerMessage.includes('better')
    ) {
      return { type: 'advice_query', entities: {} }
    }

    // Default
    return { type: 'general_query', entities: {} }
  }

  /**
   * Get relevant context data based on intent
   */
  private async getRelevantContext(intent: { type: string; entities: unknown}): Promise<unknown> {
    switch (intent.type) {
      case 'progress_query':
        return await this.getProgressData()

      case 'target_query':
        return await this.getTargetData()

      case 'rank_query':
        return await this.getRankData()

      case 'claim_query':
        return await this.getClaimData()

      default:
        return {}
    }
  }

  /**
   * Generate response based on intent and context
   */
  private async generateResponse(
    userMessage: string,
    intent: { type: string; entities: unknown},
    contextData: unknown  ): Promise<{ content: string; data?: unknown; functionsUsed?: string[] }> {
    switch (intent.type) {
      case 'progress_query':
        return this.generateProgressResponse(contextData)

      case 'target_query':
        return this.generateTargetResponse(contextData)

      case 'rank_query':
        return this.generateRankResponse(contextData)

      case 'claim_query':
        return this.generateClaimResponse(contextData)

      case 'help_query':
        return this.generateHelpResponse(userMessage)

      case 'advice_query':
        return this.generateAdviceResponse(contextData)

      default:
        return {
          content: "I'm here to help you with your incentive targets! You can ask me things like:\n\n" +
            "- How close am I to my target?\n" +
            "- What's my current rank?\n" +
            "- How do I claim my reward?\n" +
            "- Give me tips to improve my performance\n\n" +
            "What would you like to know?",
        }
    }
  }

  /**
   * Get user's progress data
   */
  private async getProgressData(): Promise<unknown> {
    // Fetch from API
    const response = await fetch('/api/incentives/my-incentives')
    const data = await response.json()

    return {
      activeIncentives: data.data.active,
      summary: data.summary,
    }
  }

  /**
   * Generate progress response
   */
  private generateProgressResponse(data: Record<string, unknown>): { content: string; data: unknown; functionsUsed: string[] } {
    const { activeIncentives, summary } = data

    if (!activeIncentives || activeIncentives.length === 0) {
      return {
        content: "You don't have any active incentive targets at the moment. Check back later for new opportunities!",
        data,
        functionsUsed: ['getProgressData'],
      }
    }

    const inProgress = activeIncentives.filter((i: unknown) => i.progress_percentage > 0)
    const avgProgress = inProgress.length > 0
      ? inProgress.reduce((sum: number, i: unknown) => sum + i.progress_percentage, 0) / inProgress.length
      : 0

    let response = `Here's your current progress:\n\n`

    // Overall summary
    response += `📊 **Overall Performance:**\n`
    response += `- ${summary.in_progress} incentives in progress\n`
    response += `- ${summary.achieved} already achieved!\n`
    response += `- Average progress: ${avgProgress.toFixed(1)}%\n`
    response += `- Potential earnings: ₹${summary.total_potential_earnings.toLocaleString()}\n\n`

    // Top 3 incentives
    const sorted = [...activeIncentives].sort((a: unknown, b: unknown) => b.progress_percentage - a.progress_percentage)
    response += `🎯 **Top Incentives:**\n`

    sorted.slice(0, 3).forEach((incentive: unknown, index: number) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
      response += `${emoji} ${incentive.incentive_title}: ${incentive.progress_percentage}% (₹${incentive.reward_amount})\n`
    })

    // Motivation
    if (avgProgress >= 80) {
      response += `\n🔥 You're doing amazing! Keep up the great work!`
    } else if (avgProgress >= 50) {
      response += `\n💪 You're on the right track! A little more push and you'll reach your goals!`
    } else {
      response += `\n🚀 Time to accelerate! You have great potential - let's unlock it!`
    }

    return {
      content: response,
      data,
      functionsUsed: ['getProgressData'],
    }
  }

  /**
   * Get target data
   */
  private async getTargetData(): Promise<unknown> {
    const response = await fetch('/api/incentives/my-incentives')
    const data = await response.json()

    return {
      activeIncentives: data.data.active,
    }
  }

  /**
   * Generate target response
   */
  private generateTargetResponse(data: Record<string, unknown>): { content: string; data: unknown; functionsUsed: string[] } {
    const { activeIncentives } = data

    if (!activeIncentives || activeIncentives.length === 0) {
      return {
        content: "You don't have any active targets right now.",
        data,
        functionsUsed: ['getTargetData'],
      }
    }

    let response = `Here are your current targets:\n\n`

    activeIncentives.forEach((incentive: unknown, index: number) => {
      const criteria = incentive.performance_criteria
      const current = incentive.current_progress?.metric_value || 0
      const target = criteria?.target_value || 100
      const remaining = target - current

      response += `${index + 1}. **${incentive.incentive_title}**\n`
      response += `   - Target: ${target} ${criteria?.metric || 'units'}\n`
      response += `   - Current: ${current}\n`
      response += `   - Remaining: ${remaining}\n`
      response += `   - Reward: ₹${incentive.reward_amount?.toLocaleString()}\n`
      response += `   - Days left: ${incentive.days_remaining || 'N/A'}\n\n`
    })

    return {
      content: response,
      data,
      functionsUsed: ['getTargetData'],
    }
  }

  /**
   * Get rank data
   */
  private async getRankData(): Promise<unknown> {
    const response = await fetch('/api/incentives/gamification/leaderboard')
    const data = await response.json()

    return {
      leaderboard: data.data,
      userRank: data.userRank,
    }
  }

  /**
   * Generate rank response
   */
  private generateRankResponse(data: Record<string, unknown>): { content: string; data: unknown; functionsUsed: string[] } {
    const { leaderboard, userRank } = data

    if (!userRank) {
      return {
        content: "Rank information is not available yet. Complete some targets to see your rank!",
        data,
        functionsUsed: ['getRankData'],
      }
    }

    let response = `🏆 **Your Current Standing:**\n\n`
    response += `Rank: #${userRank.rank}\n`
    response += `Score: ${userRank.score}\n`
    response += `Tier: ${userRank.tier}\n\n`

    // Show top 3
    if (leaderboard && leaderboard.length > 0) {
      response += `**Top Performers:**\n`
      leaderboard.slice(0, 3).forEach((leader: unknown, index: number) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
        response += `${emoji} ${leader.user_name}: ${leader.score} points\n`
      })
    }

    // Motivation based on rank
    if (userRank.rank <= 3) {
      response += `\n🌟 You're in the top 3! Outstanding performance!`
    } else if (userRank.rank <= 10) {
      response += `\n🚀 You're in the top 10! Keep pushing to reach the podium!`
    } else {
      response += `\n💪 Great effort! Stay consistent to climb higher!`
    }

    return {
      content: response,
      data,
      functionsUsed: ['getRankData'],
    }
  }

  /**
   * Get claim data
   */
  private async getClaimData(): Promise<unknown> {
    const response = await fetch('/api/incentives/my-incentives')
    const data = await response.json()

    return {
      activeIncentives: data.data.active,
    }
  }

  /**
   * Generate claim response
   */
  private generateClaimResponse(data: Record<string, unknown>): { content: string; data: unknown; functionsUsed: string[] } {
    const { activeIncentives } = data

    const claimable = activeIncentives.filter(
      (i: unknown) => i.allocation_status === 'achieved' && i.earned_amount > 0
    )

    if (claimable.length === 0) {
      return {
        content: "You don't have any rewards ready to claim yet. Keep working on your targets!",
        data,
        functionsUsed: ['getClaimData'],
      }
    }

    let response = `💰 **Rewards Ready to Claim:**\n\n`

    claimable.forEach((incentive: unknown) => {
      response += `✅ ${incentive.incentive_title}: ₹${incentive.earned_amount.toLocaleString()}\n`
    })

    const totalClaimable = claimable.reduce((sum: number, i: unknown) => sum + i.earned_amount, 0)
    response += `\n**Total Claimable:** ₹${totalClaimable.toLocaleString()}\n\n`
    response += `To claim, go to the "My Targets" tab and click the "Claim Reward" button!`

    return {
      content: response,
      data,
      functionsUsed: ['getClaimData'],
    }
  }

  /**
   * Generate help response
   */
  private generateHelpResponse(userMessage: string): { content: string } {
    let response = `I'm your AI assistant for incentive targets! 🤖\n\n`

    if (userMessage.toLowerCase().includes('claim')) {
      response += `**How to Claim Rewards:**\n`
      response += `1. Achieve 100% of your target\n`
      response += `2. Go to "My Targets" tab\n`
      response += `3. Click "Claim Reward" button\n`
      response += `4. Select payment method\n`
      response += `5. Submit for approval\n\n`
      response += `HR will review and approve within 2-3 business days.`
    } else if (userMessage.toLowerCase().includes('target')) {
      response += `**About Targets:**\n`
      response += `- Targets are assigned based on your role and experience\n`
      response += `- They adjust based on market conditions and seasonality\n`
      response += `- Track your progress in real-time on the dashboard\n`
      response += `- Earn rewards when you achieve your targets!`
    } else {
      response += `**I can help you with:**\n`
      response += `- Checking your progress and targets\n`
      response += `- Viewing your rank on the leaderboard\n`
      response += `- Understanding how to claim rewards\n`
      response += `- Getting tips to improve performance\n\n`
      response += `Just ask me anything about your incentives!`
    }

    return { content: response }
  }

  /**
   * Generate personalized advice
   */
  private generateAdviceResponse(data: Record<string, unknown>): { content: string; data: unknown; functionsUsed: string[] } {
    const { activeIncentives, summary } = data

    if (!activeIncentives || activeIncentives.length === 0) {
      return {
        content: "Focus on getting started with your first target when one is assigned!",
        data,
        functionsUsed: ['getProgressData'],
      }
    }

    let response = `💡 **Personalized Tips for You:**\n\n`

    // Analyze progress patterns
    const lowProgress = activeIncentives.filter((i: unknown) => i.progress_percentage < 30)
    const highProgress = activeIncentives.filter((i: unknown) => i.progress_percentage >= 70)

    if (lowProgress.length > 0) {
      response += `⚠️ **Quick Wins:**\n`
      response += `Focus on these low-progress incentives for quick wins:\n`
      lowProgress.slice(0, 2).forEach((i: unknown) => {
        response += `- ${i.incentive_title} (${i.progress_percentage}%)\n`
      })
      response += `\n`
    }

    if (highProgress.length > 0) {
      response += `🎯 **Almost There:**\n`
      response += `Push hard on these - you're so close!\n`
      highProgress.slice(0, 2).forEach((i: unknown) => {
        response += `- ${i.incentive_title} (${i.progress_percentage}%)\n`
      })
      response += `\n`
    }

    response += `**General Tips:**\n`
    response += `1. Set daily mini-goals to stay consistent\n`
    response += `2. Track your progress every morning\n`
    response += `3. Ask top performers for advice\n`
    response += `4. Focus on quality over quantity\n`
    response += `5. Stay motivated - rewards are worth it!\n\n`
    response += `💪 You've got this!`

    return {
      content: response,
      data,
      functionsUsed: ['getProgressData'],
    }
  }

  /**
   * Quick action: Submit claim
   */
  async quickClaimReward(allocationId: string, amount: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/incentives/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocation_id: allocationId,
          claimed_amount: amount,
          payment_method: 'bank_transfer',
        }),
      })

      if (response.ok) {
        return {
          success: true,
          message: '✅ Claim submitted successfully! Pending HR approval.',
        }
      } else {
        throw new Error('Failed to submit claim')
      }
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to submit claim. Please try again or use the dashboard.',
      }
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = []
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Initialize chatbot with user context
 */
export async function initializeChatbot(userId: string): Promise<IncentiveChatbot> {
  // Fetch user context
  const userResponse = await fetch('/api/auth/me')
  const userData = await userResponse.json()

  const incentivesResponse = await fetch('/api/incentives/my-incentives')
  const incentivesData = await incentivesResponse.json()

  const context: ChatbotContext = {
    userId: userData.id,
    userName: userData.full_name,
    userRole: userData.sub_role,
    currentIncentives: incentivesData.data.active,
  }

  return new IncentiveChatbot(context)
}
