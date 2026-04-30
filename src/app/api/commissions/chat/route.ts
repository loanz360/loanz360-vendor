import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'


interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Structured response from our "AI" assistant
interface AssistantResponse {
  answer: string
  data?: any
  suggestions?: string[]
}

// GET - Fetch chat history (optional)
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    // For now, chat history is not persisted
    // Could be enhanced to store chat history in a table
    return NextResponse.json({
      messages: [],
      suggestions: [
        'What is my commission rate for HDFC Home Loan in Mumbai?',
        'Which bank has the highest commission for Personal Loans?',
        'What are my top earning opportunities?',
        'Show me rate changes in the last month'
      ]
    })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Process user message and generate response
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createSupabaseAdmin()

    // Get partner profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, sub_role')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    // Map sub_role to partner type
    const partnerTypeMap: Record<string, string> = {
      'BUSINESS_ASSOCIATE': 'BA',
      'BUSINESS_PARTNER': 'BP',
      'CHANNEL_PARTNER': 'CP'
    }
    const partnerType = partnerTypeMap[profile.sub_role || ''] || (profile.role === 'PARTNER' ? 'BA' : null)

    if (!partnerType && !auth.isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Invalid partner type' }, { status: 400 })
    }

    const body = await request.json()
    const { message, context = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 })
    }

    // Process the message and generate response
    const response = await processMessage(supabase, message, partnerType, context)

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in chat API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Process user message and generate intelligent response
async function processMessage(
  supabase: any,
  message: string,
  partnerType: string,
  context: ChatMessage[]
): Promise<AssistantResponse> {
  const lowerMessage = message.toLowerCase()
  const tableName = `payout_${partnerType.toLowerCase()}_percentages`

  // Intent detection and response generation

  // 1. Query for specific commission rate
  if (lowerMessage.includes('rate') || lowerMessage.includes('commission') || lowerMessage.includes('percentage')) {
    // Try to extract bank, location, loan type from message
    const { bank, location, loanType } = await extractEntities(supabase, message, tableName)

    if (bank && location && loanType) {
      // Fetch specific rate
      const { data: rate } = await supabase
        .from(tableName)
        .select('*')
        .eq('bank_name', bank)
        .eq('location', location)
        .eq('loan_type', loanType)
        .eq('is_current', true)
        .maybeSingle()

      if (rate) {
        return {
          answer: `The commission rate for **${bank}** in **${location}** for **${loanType}** is **${rate.commission_percentage}%**.\n\n` +
            (rate.conditions ? `\n**Conditions:**\n${rate.conditions.map((c: string) => `- ${c}`).join('\n')}` : '') +
            `\n\nThis rate is effective from ${new Date(rate.effective_from).toLocaleDateString('en-IN')}.`,
          data: { rate },
          suggestions: [
            `Calculate commission for ${loanType}`,
            `Compare rates across banks`,
            'What are the highest paying loan types?'
          ]
        }
      } else {
        return {
          answer: `I couldn't find a rate for **${bank}** in **${location}** for **${loanType}**. This combination might not be available in your payout grid.`,
          suggestions: [
            'Show all available banks',
            'Show all loan types',
            `What rates are available for ${bank}?`
          ]
        }
      }
    }

    // Partial match - try to help
    if (bank) {
      const { data: bankRates } = await supabase
        .from(tableName)
        .select('*')
        .eq('bank_name', bank)
        .eq('is_current', true)
        .limit(5)

      if (bankRates && bankRates.length > 0) {
        const ratesList = bankRates.map((r: any) =>
          `- ${r.location} | ${r.loan_type}: ${r.commission_percentage}%`
        ).join('\n')

        return {
          answer: `Here are some commission rates for **${bank}**:\n\n${ratesList}\n\nWould you like details on a specific location or loan type?`,
          data: { rates: bankRates },
          suggestions: [
            `What's the rate for ${bank} in Mumbai?`,
            `Best loan type for ${bank}?`,
            'Compare with other banks'
          ]
        }
      }
    }
  }

  // 2. Query for highest/best rates
  if (lowerMessage.includes('highest') || lowerMessage.includes('best') || lowerMessage.includes('top')) {
    const { data: topRates } = await supabase
      .from(tableName)
      .select('*')
      .eq('is_current', true)
      .order('commission_percentage', { ascending: false })
      .limit(5)

    if (topRates && topRates.length > 0) {
      const ratesList = topRates.map((r: any, i: number) =>
        `${i + 1}. **${r.bank_name}** - ${r.location} | ${r.loan_type}: **${r.commission_percentage}%**`
      ).join('\n')

      return {
        answer: `Here are your **top 5 commission rates**:\n\n${ratesList}\n\nFocus on these for maximum earnings!`,
        data: { rates: topRates },
        suggestions: [
          'Calculate commission for the top rate',
          'Show rates by bank',
          'What are the conditions for these rates?'
        ]
      }
    }
  }

  // 3. Query for banks/locations/loan types list
  if (lowerMessage.includes('all banks') || lowerMessage.includes('list banks') || lowerMessage.includes('available banks')) {
    const { data: banks } = await supabase
      .from(tableName)
      .select('bank_name')
      .eq('is_current', true)

    const uniqueBanks = [...new Set(banks?.map((b: any) => b.bank_name) || [])]
    const banksList = uniqueBanks.slice(0, 15).join(', ')

    return {
      answer: `You have commission rates available for **${uniqueBanks.length} banks/NBFCs**:\n\n${banksList}${uniqueBanks.length > 15 ? '... and more' : ''}\n\nAsk me about any specific bank!`,
      data: { banks: uniqueBanks },
      suggestions: [
        'What rates does HDFC Bank offer?',
        'Compare SBI vs ICICI rates',
        'Which bank has best Home Loan rates?'
      ]
    }
  }

  if (lowerMessage.includes('loan types') || lowerMessage.includes('product') || lowerMessage.includes('loan product')) {
    const { data: loanTypes } = await supabase
      .from(tableName)
      .select('loan_type')
      .eq('is_current', true)

    const uniqueLoanTypes = [...new Set(loanTypes?.map((l: any) => l.loan_type) || [])]
    const loanTypesList = uniqueLoanTypes.join(', ')

    return {
      answer: `You have commission rates for **${uniqueLoanTypes.length} loan types**:\n\n${loanTypesList}\n\nI can tell you rates for any of these!`,
      data: { loanTypes: uniqueLoanTypes },
      suggestions: [
        'Best rates for Home Loan?',
        'Compare Personal Loan rates',
        'Which loan type pays the most?'
      ]
    }
  }

  // 4. Query for rate changes
  if (lowerMessage.includes('change') || lowerMessage.includes('recent') || lowerMessage.includes('update')) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentChanges } = await supabase
      .from('payout_rate_notifications')
      .select('*')
      .eq('is_active', true)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentChanges && recentChanges.length > 0) {
      const changesList = recentChanges.map((c: any) => {
        const changeType = c.notification_type === 'rate_increase' ? '📈' : c.notification_type === 'rate_decrease' ? '📉' : '🆕'
        return `${changeType} **${c.bank_name}** - ${c.loan_type}: ${c.old_percentage || 'New'}% → ${c.new_percentage}%`
      }).join('\n')

      return {
        answer: `**Recent rate changes (last 30 days):**\n\n${changesList}\n\nStay updated to maximize your earnings!`,
        data: { changes: recentChanges },
        suggestions: [
          'Tell me more about HDFC rate change',
          'What are the new rates?',
          'Show highest rates now'
        ]
      }
    } else {
      return {
        answer: `No rate changes have been recorded in the last 30 days. Your rates are stable!`,
        suggestions: [
          'Show my current rates',
          'What are the highest rates?',
          'Calculate my commission'
        ]
      }
    }
  }

  // 5. Calculate commission
  if (lowerMessage.includes('calculate') || lowerMessage.includes('how much') || lowerMessage.includes('earn')) {
    // Extract amount from message
    const amountMatch = message.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakh|lac|l|cr|crore)?/i)

    if (amountMatch) {
      let amount = parseFloat(amountMatch[1].replace(/,/g, ''))
      const unit = amountMatch[2]?.toLowerCase()

      if (unit === 'lakh' || unit === 'lac' || unit === 'l') {
        amount *= 100000
      } else if (unit === 'cr' || unit === 'crore') {
        amount *= 10000000
      }

      // Get average or highest rate
      const { data: rates } = await supabase
        .from(tableName)
        .select('commission_percentage')
        .eq('is_current', true)

      if (rates && rates.length > 0) {
        const avgRate = rates.reduce((sum: number, r: any) => sum + r.commission_percentage, 0) / rates.length
        const maxRate = Math.max(...rates.map((r: any) => r.commission_percentage))

        const avgCommission = (amount * avgRate) / 100
        const maxCommission = (amount * maxRate) / 100

        const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(val)

        return {
          answer: `For a loan amount of **${formatCurrency(amount)}**:\n\n` +
            `📊 **Average Commission** (${avgRate.toFixed(2)}%): ${formatCurrency(avgCommission)}\n` +
            `💰 **Maximum Commission** (${maxRate.toFixed(2)}%): ${formatCurrency(maxCommission)}\n\n` +
            `Actual commission depends on the bank, location, and loan type.`,
          data: { amount, avgRate, maxRate, avgCommission, maxCommission },
          suggestions: [
            'What combination gives maximum rate?',
            'Calculate for specific bank',
            'Show highest paying banks'
          ]
        }
      }
    }

    return {
      answer: `To calculate your commission, please tell me:\n\n` +
        `1. **Loan Amount** (e.g., "50 lakh" or "1 crore")\n` +
        `2. **Bank/NBFC** (optional)\n` +
        `3. **Location** (optional)\n` +
        `4. **Loan Type** (optional)\n\n` +
        `Example: "Calculate commission for 50 lakh HDFC Home Loan in Mumbai"`,
      suggestions: [
        'Calculate for 50 lakh loan',
        'Calculate for 1 crore Home Loan',
        'What is the highest rate available?'
      ]
    }
  }

  // 6. Help/General query
  if (lowerMessage.includes('help') || lowerMessage.includes('what can you') || lowerMessage === 'hi' || lowerMessage === 'hello') {
    return {
      answer: `Hello! I'm your **Commission Assistant** 🤖\n\n` +
        `I can help you with:\n\n` +
        `📊 **Check Rates** - "What is my rate for HDFC Home Loan?"\n` +
        `💰 **Calculate Commission** - "How much will I earn on 50 lakh?"\n` +
        `📈 **Find Best Rates** - "Which bank has the highest rates?"\n` +
        `📝 **List Options** - "Show all banks" or "Show loan types"\n` +
        `🔔 **Rate Changes** - "Any recent rate changes?"\n\n` +
        `Just ask naturally - I'll do my best to help!`,
      suggestions: [
        'What are my top rates?',
        'Calculate for 1 crore loan',
        'Show all banks',
        'Recent rate changes'
      ]
    }
  }

  // Default response
  return {
    answer: `I'm not sure I understood that. Let me help you!\n\n` +
      `You can ask me about:\n` +
      `- Commission rates for specific banks/loans\n` +
      `- Calculate earnings on a loan amount\n` +
      `- Find highest paying opportunities\n` +
      `- Recent rate changes\n\n` +
      `Try being more specific or use the suggestions below.`,
    suggestions: [
      'What are my commission rates?',
      'Calculate for 50 lakh',
      'Which bank pays the most?',
      'Help'
    ]
  }
}

// Extract entities (bank, location, loan type) from user message
async function extractEntities(supabase: any, message: string, tableName: string) {
  const lowerMessage = message.toLowerCase()

  // Get all unique values from the table for matching
  const { data: allData } = await supabase
    .from(tableName)
    .select('bank_name, location, loan_type')
    .eq('is_current', true)

  if (!allData) return { bank: null, location: null, loanType: null }

  const banks = [...new Set(allData.map((d: any) => d.bank_name))]
  const locations = [...new Set(allData.map((d: any) => d.location))]
  const loanTypes = [...new Set(allData.map((d: any) => d.loan_type))]

  // Find matches (case-insensitive)
  let bank = null
  let location = null
  let loanType = null

  for (const b of banks) {
    if (lowerMessage.includes(b.toLowerCase())) {
      bank = b
      break
    }
  }

  for (const l of locations) {
    if (lowerMessage.includes(l.toLowerCase())) {
      location = l
      break
    }
  }

  for (const t of loanTypes) {
    if (lowerMessage.includes(t.toLowerCase())) {
      loanType = t
      break
    }
  }

  return { bank, location, loanType }
}
