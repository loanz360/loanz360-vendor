
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { apiLogger } from '@/lib/utils/logger'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { analytics, dateRange } = await request.json()

    if (!analytics) {
      return NextResponse.json({ success: false, error: 'Analytics data is required' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are an expert marketing analyst. Analyze the following marketing metrics and provide actionable insights.

Marketing Analytics Data (${dateRange}):
- Total Contacts: ${analytics.totalContacts}
- Active Contacts: ${analytics.activeContacts}
- New Contacts This Month: ${analytics.newContactsThisMonth}
- Emails Sent: ${analytics.emailsSent}
- Emails Delivered: ${analytics.emailsDelivered}
- Emails Opened: ${analytics.emailsOpened}
- Emails Clicked: ${analytics.emailsClicked}
- Bounced Emails: ${analytics.emailBounced}
- Average Open Rate: ${analytics.avgOpenRate}%
- Average Click Rate: ${analytics.avgClickRate}%
- Total Campaigns: ${analytics.totalCampaigns}
- Active Campaigns: ${analytics.activeCampaigns}
- Completed Campaigns: ${analytics.completedCampaigns}

Generate 4-6 insights in the following JSON format. Each insight should be actionable and specific:
{
  "insights": [
    {
      "type": "success" | "warning" | "info" | "recommendation",
      "title": "Brief title (max 50 chars)",
      "description": "Detailed insight (max 150 chars)",
      "metric": "Optional key metric value",
      "action": "Optional actionable recommendation"
    }
  ]
}

Guidelines:
- "success" type: For metrics performing above industry average (Open rate >20%, Click rate >2.5%)
- "warning" type: For metrics needing improvement
- "info" type: For neutral observations
- "recommendation" type: For actionable suggestions

Industry benchmarks for reference:
- Email Open Rate: 20-25%
- Email Click Rate: 2.5-3.5%
- Delivery Rate: 95%+
- Bounce Rate: <2%

Return ONLY valid JSON, no markdown or additional text.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    try {
      // Clean the response - remove any markdown formatting
      let cleanText = text.trim()
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.slice(7)
      }
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.slice(3)
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.slice(0, -3)
      }
      cleanText = cleanText.trim()

      const data = JSON.parse(cleanText)

      if (data.insights && Array.isArray(data.insights)) {
        return NextResponse.json({ insights: data.insights })
      }

      throw new Error('Invalid response format')
    } catch (parseError) {
      apiLogger.error('Error parsing AI response', parseError)

      // Return fallback insights
      return NextResponse.json({
        insights: generateFallbackInsights(analytics),
      })
    }
  } catch (error: unknown) {
    apiLogger.error('Error generating insights', error)

    // Return fallback insights on error
    return NextResponse.json({
      insights: [
        {
          type: 'info',
          title: 'Analytics Summary',
          description: 'Review your marketing performance metrics above.',
        },
        {
          type: 'recommendation',
          title: 'Improve Engagement',
          description: 'Try A/B testing your subject lines and send times for better results.',
          action: 'Create an A/B test campaign',
        },
      ],
    })
  }
}

function generateFallbackInsights(analytics: any) {
  const insights = []

  // Open rate insight
  if (analytics.avgOpenRate > 25) {
    insights.push({
      type: 'success',
      title: 'Excellent Open Rate',
      description: `Your ${analytics.avgOpenRate}% open rate is above the industry average of 20-25%.`,
      metric: `${analytics.avgOpenRate}%`,
    })
  } else if (analytics.avgOpenRate > 15) {
    insights.push({
      type: 'info',
      title: 'Average Open Rate',
      description: `Your ${analytics.avgOpenRate}% open rate is close to industry average.`,
      metric: `${analytics.avgOpenRate}%`,
    })
  } else if (analytics.avgOpenRate > 0) {
    insights.push({
      type: 'warning',
      title: 'Low Open Rate',
      description: 'Consider improving your subject lines to boost open rates.',
      metric: `${analytics.avgOpenRate}%`,
      action: 'A/B test your subject lines',
    })
  }

  // Click rate insight
  if (analytics.avgClickRate > 3) {
    insights.push({
      type: 'success',
      title: 'Great Click Rate',
      description: `${analytics.avgClickRate}% CTR shows strong content engagement.`,
      metric: `${analytics.avgClickRate}%`,
    })
  } else if (analytics.avgClickRate > 0) {
    insights.push({
      type: 'recommendation',
      title: 'Improve Click Rate',
      description: 'Try more compelling CTAs and relevant content.',
      action: 'Review your email content strategy',
    })
  }

  // Contact growth
  if (analytics.newContactsThisMonth > 0) {
    insights.push({
      type: 'info',
      title: 'Contact Growth',
      description: `Added ${analytics.newContactsThisMonth} new contacts this month.`,
      metric: `+${analytics.newContactsThisMonth}`,
    })
  }

  // Campaign activity
  if (analytics.activeCampaigns === 0 && analytics.totalCampaigns > 0) {
    insights.push({
      type: 'warning',
      title: 'No Active Campaigns',
      description: 'Schedule new campaigns to keep engaging your audience.',
      action: 'Create a new campaign',
    })
  }

  // Deliverability
  if (analytics.emailsSent > 0) {
    const deliveryRate = (analytics.emailsDelivered / analytics.emailsSent) * 100
    if (deliveryRate < 95) {
      insights.push({
        type: 'warning',
        title: 'Deliverability Issues',
        description: 'Your delivery rate is below 95%. Clean your contact list.',
        metric: `${Math.round(deliveryRate)}%`,
        action: 'Remove bounced emails',
      })
    }
  }

  // Default recommendation
  insights.push({
    type: 'recommendation',
    title: 'Segment Your Audience',
    description: 'Create targeted segments for personalized campaigns.',
    action: 'Build audience segments',
  })

  return insights.slice(0, 6)
}
