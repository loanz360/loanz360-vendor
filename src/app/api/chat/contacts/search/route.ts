import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/contacts/search?q=searchTerm
 * Search contacts and leads for starting new chat conversations
 * Returns contacts and leads assigned to the authenticated CRO
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const rawQuery = searchParams.get('q') || ''
    const safeQuery = sanitizeSearchInput(rawQuery)

    if (!safeQuery || safeQuery.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const userId = session.user.id

    // Search both contacts and leads in parallel
    const [contactsResult, leadsResult] = await Promise.all([
      supabase
        .from('crm_contacts')
        .select('id, customer_name, customer_phone, loan_type')
        .eq('assigned_cro_id', userId)
        .or(`customer_name.ilike.%${safeQuery}%,customer_phone.ilike.%${safeQuery}%`)
        .limit(10),
      supabase
        .from('crm_leads')
        .select('id, customer_name, phone, loan_type, lead_score')
        .eq('assigned_cro', userId)
        .or(`customer_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`)
        .limit(10),
    ])

    const results: Array<{
      id: string
      name: string
      phone: string
      type: 'contact' | 'lead'
      lead_score?: number
      loan_type?: string
    }> = []

    // Normalize contacts
    if (contactsResult.data) {
      for (const c of contactsResult.data) {
        results.push({
          id: c.id,
          name: c.customer_name || 'Unknown',
          phone: c.customer_phone || '',
          type: 'contact',
          loan_type: c.loan_type || undefined,
        })
      }
    }

    // Normalize leads
    if (leadsResult.data) {
      for (const l of leadsResult.data) {
        results.push({
          id: l.id,
          name: l.customer_name || 'Unknown',
          phone: l.phone || '',
          type: 'lead',
          lead_score: l.lead_score || undefined,
          loan_type: l.loan_type || undefined,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    apiLogger.error('Chat contacts search error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
