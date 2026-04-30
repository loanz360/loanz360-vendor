
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Knowledge Base Chatbot API using Google Gemini
 *
 * POST /api/knowledge-base/chat
 *
 * Request body:
 * {
 *   message: string - User's question
 *   loanType: string - The type of loan (e.g., 'personal-loan', 'home-loan')
 *   history?: Array<{ role: 'user' | 'model', parts: [{ text: string }] }> - Chat history
 * }
 */

interface ChatMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

interface RequestBody {
  message: string
  loanType: string
  history?: ChatMessage[]
}

// Loan type display names
const LOAN_TYPE_NAMES: Record<string, string> = {
  'personal-loan': 'Personal Loan',
  'home-loan': 'Home Loan',
  'car-loan': 'Car Loan',
  'business-loan': 'Business Loan',
  'education-loan': 'Education Loan',
  'loan-against-property': 'Loan Against Property',
  'gold-loan': 'Gold Loan',
  'credit-card': 'Credit Card',
  'agriculture-loan': 'Agriculture Loan',
  'working-capital': 'Working Capital',
}

// System context for the chatbot
function getSystemPrompt(loanType: string): string {
  const loanName = LOAN_TYPE_NAMES[loanType] || 'Loan'

  return `You are a helpful and knowledgeable loan assistant for Loanz360, a leading loan aggregator platform in India. You specialize in ${loanName} and related financial products.

Your role is to:
1. Answer questions about ${loanName} clearly and accurately
2. Explain eligibility criteria, documentation requirements, and application processes
3. Provide information about interest rates, processing fees, and repayment options
4. Compare different lenders and their offerings when relevant
5. Guide users through the loan application journey
6. Explain tax benefits and government schemes if applicable

Important guidelines:
- Be conversational, friendly, and professional
- Use simple language that anyone can understand
- Provide accurate information about Indian banking and financial regulations
- If you're unsure about something, admit it and suggest consulting a financial advisor
- Never provide specific financial advice - always recommend consulting professionals for personalized decisions
- Keep responses concise but informative (2-4 paragraphs max)
- Use bullet points when listing multiple items
- Mention that rates and terms may vary by lender and customer profile
- Focus on information relevant to ${loanName}

Common topics to cover:
- Eligibility criteria (age, income, employment, credit score)
- Required documents (KYC, income proof, address proof)
- Interest rates and processing fees
- Loan amount limits and tenure options
- Prepayment and foreclosure charges
- Tax benefits (under relevant sections like 80C, 24b, etc.)
- Government schemes (PMAY, MUDRA, etc. if relevant)
- Our partner banks and NBFCs

Remember: You represent Loanz360, a trusted loan aggregator helping customers find the best loan products.`
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const body: RequestBody = await request.json()
    const { message, loanType, history = [] } = body

    if (!message || !loanType) {
      return NextResponse.json(
        { success: false, error: 'Message and loanType are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      apiLogger.error('GEMINI_API_KEY is not configured')
      // Return a fallback response when API key is not available
      return NextResponse.json({
        success: true,
        response: getFallbackResponse(message, loanType),
        isFallback: true
      })
    }

    const systemPrompt = getSystemPrompt(loanType)

    // Build conversation history
    const contents: ChatMessage[] = [
      // System message as first user message (Gemini's way of handling system prompts)
      {
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}\n\nPlease acknowledge and start helping users with their ${LOAN_TYPE_NAMES[loanType] || 'loan'} queries.` }]
      },
      {
        role: 'model',
        parts: [{ text: `Hello! I'm your ${LOAN_TYPE_NAMES[loanType] || 'loan'} assistant from Loanz360. I'm here to help you understand everything about ${LOAN_TYPE_NAMES[loanType] || 'loans'} - from eligibility and documentation to interest rates and application process. Feel free to ask me anything!` }]
      },
      // Add conversation history
      ...history,
      // Add current user message
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ]

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text()
      apiLogger.error('Gemini API error', errorData)

      // Return fallback response on API error
      return NextResponse.json({
        success: true,
        response: getFallbackResponse(message, loanType),
        isFallback: true
      })
    }

    const geminiData = await geminiResponse.json()

    // Extract the response text
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      apiLogger.error('No response text from Gemini', geminiData)
      return NextResponse.json({
        success: true,
        response: getFallbackResponse(message, loanType),
        isFallback: true
      })
    }

    return NextResponse.json({
      success: true,
      response: responseText,
      isFallback: false
    })

  } catch (error) {
    apiLogger.error('Error in knowledge-base chat API', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

/**
 * Fallback responses when Gemini API is not available
 */
function getFallbackResponse(query: string, loanType: string): string {
  const loanName = LOAN_TYPE_NAMES[loanType] || 'Loan'
  const lowerQuery = query.toLowerCase()

  if (lowerQuery.includes('interest') || lowerQuery.includes('rate')) {
    return `Interest rates for ${loanName} typically vary based on the lender and your profile. Banks usually offer rates starting from 8-12% p.a. for secured loans and 10-18% p.a. for unsecured loans. Factors affecting your rate include:

• Credit score (higher is better)
• Income stability and amount
• Loan amount and tenure
• Relationship with the bank
• Type of employment

For the most accurate rates, I recommend checking with our partner banks through the Apply for Loan section.`
  }

  if (lowerQuery.includes('document') || lowerQuery.includes('required') || lowerQuery.includes('paper')) {
    return `For ${loanName}, you'll typically need the following documents:

**Identity Proof:** Aadhaar Card, PAN Card, Passport, Voter ID
**Address Proof:** Utility bills, Rent agreement, Aadhaar Card
**Income Proof:** Salary slips (last 3-6 months), Bank statements, Form 16/ITR
**Employment Proof:** Employment letter, ID card
**Photographs:** Recent passport-size photos

Additional documents may be required based on the loan type and lender. Our team can guide you through the specific requirements.`
  }

  if (lowerQuery.includes('eligibility') || lowerQuery.includes('eligible') || lowerQuery.includes('qualify')) {
    return `General eligibility criteria for ${loanName}:

• **Age:** 21-60 years (may extend to 65-70 for some products)
• **Income:** Minimum monthly income of Rs. 15,000-25,000
• **Employment:** Salaried (min 1-2 years) or Self-employed (min 2-3 years)
• **Credit Score:** 650+ (750+ for better rates)
• **Residence:** Indian citizen or resident

Specific requirements may vary by lender and loan amount. Use our EMI Calculator to check your approximate eligibility!`
  }

  if (lowerQuery.includes('apply') || lowerQuery.includes('how to') || lowerQuery.includes('process')) {
    return `Here's how to apply for ${loanName} through Loanz360:

1. **Check Eligibility:** Use our eligibility calculator
2. **Gather Documents:** Prepare KYC, income, and address proof
3. **Compare Offers:** Review rates from multiple lenders
4. **Apply Online:** Fill the application through our portal
5. **Verification:** Complete KYC and document verification
6. **Approval:** Get approval (usually within 24-72 hours)
7. **Disbursal:** Receive funds in your account

Click on "Apply for Loan" in the sidebar to get started!`
  }

  if (lowerQuery.includes('bank') || lowerQuery.includes('nbfc') || lowerQuery.includes('lender')) {
    return `Loanz360 partners with leading banks and NBFCs to offer you the best ${loanName} options:

**Banks:** SBI, HDFC, ICICI, Axis, Kotak, Bank of Baroda, PNB
**NBFCs:** Bajaj Finserv, Tata Capital, HDFC Ltd, L&T Finance, Muthoot

Each partner offers unique benefits - some have lower rates, others have faster processing or flexible eligibility. Check the "Banks & NBFCs" tab for detailed comparison!`
  }

  if (lowerQuery.includes('tax') || lowerQuery.includes('benefit') || lowerQuery.includes('80c') || lowerQuery.includes('24')) {
    return `Tax benefits vary by loan type. Common deductions include:

**Home Loan:**
• Section 24(b): Up to Rs. 2 lakh on interest
• Section 80C: Up to Rs. 1.5 lakh on principal
• Section 80EEA: Additional Rs. 1.5 lakh for first-time buyers

**Education Loan:**
• Section 80E: Entire interest amount (no limit)

**Personal/Business Loan:**
• Business loans may have deductions on interest if used for business purposes

Consult a tax professional for personalized advice on your specific situation.`
  }

  // Default response
  return `Thank you for your question about ${loanName}!

I can help you with information about:
• Interest rates and fees
• Eligibility criteria
• Required documents
• Application process
• Tax benefits
• Comparing lenders

Please ask a specific question, or explore the other tabs for detailed information on FAQs, Interest Rates, and our Partner Banks!`
}
