
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const {
      prompt,
      category,
      tone,
      targetAudience,
      keyPoints,
      includeCTA,
      ctaText,
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Build the AI prompt
    const systemPrompt = `You are an expert email marketing copywriter for Loanz360, a loan management platform in India.
    Create professional, conversion-focused email templates that are visually appealing and mobile-responsive.

    Company: Loanz360
    Industry: Financial Services / Loan Management
    Brand Colors: Orange (#f97316), White, Dark backgrounds

    Guidelines:
    - Use professional yet approachable language
    - Include personalization variables like {{name}}, {{company}}, {{loan_type}}
    - Make CTAs clear and action-oriented
    - Keep paragraphs short and scannable
    - Include proper email structure (preheader, header, body, CTA, footer)
    - Make it mobile-responsive with inline styles
    - Include unsubscribe link placeholder {{unsubscribe_url}}`

    const userPrompt = `Create an email template with the following requirements:

**Description:** ${prompt}
**Category:** ${category}
**Tone:** ${tone}
${targetAudience ? `**Target Audience:** ${targetAudience}` : ''}
${keyPoints && keyPoints.length > 0 ? `**Key Points to Include:**\n${keyPoints.map((p: string) => `- ${p}`).join('\n')}` : ''}
${includeCTA ? `**Call-to-Action:** ${ctaText || 'Yes, include a CTA'}` : ''}

Please provide the response in the following JSON format:
{
  "suggestedName": "Template name suggestion",
  "subject": "Email subject line (compelling and under 60 characters)",
  "previewText": "Preview text for email clients (under 100 characters)",
  "textContent": "Plain text version of the email",
  "htmlContent": "Complete HTML email template with inline CSS styling"
}

For the HTML, create a professional, mobile-responsive email using:
- Inline CSS styles only
- Table-based layout for email client compatibility
- Loanz360 brand colors (orange #f97316, white, dark text)
- Clean, modern design
- Proper email structure with header, body, CTA button, and footer
- Include placeholder variables: {{name}}, {{cta_url}}, {{unsubscribe_url}}`

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ])

    const response = await result.response
    const text = response.text()

    // Parse the JSON response
    let parsedResponse
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      apiLogger.error('Error parsing Gemini response', parseError)

      // Fallback: create a basic template
      parsedResponse = {
        suggestedName: `${category} Template`,
        subject: `${tone.charAt(0).toUpperCase() + tone.slice(1)} ${category} Email`,
        previewText: prompt.slice(0, 100),
        textContent: `Dear {{name}},\n\n${prompt}\n\n${includeCTA && ctaText ? ctaText : 'Learn more at Loanz360'}\n\nBest regards,\nThe Loanz360 Team`,
        htmlContent: generateFallbackHTML(prompt, category, ctaText)
      }
    }

    return NextResponse.json(parsedResponse)
  } catch (error: unknown) {
    apiLogger.error('Error generating email template', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateFallbackHTML(prompt: string, category: string, ctaText: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loanz360 Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Loanz360</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Dear {{name}},
              </p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                ${prompt}
              </p>
              ${ctaText ? `
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td style="background-color: #f97316; border-radius: 6px;">
                    <a href="{{cta_url}}" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-weight: bold;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              ` : ''}
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">
                Best regards,<br>
                The Loanz360 Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #666666; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Loanz360. All rights reserved.<br>
                <a href="{{unsubscribe_url}}" style="color: #999999;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
