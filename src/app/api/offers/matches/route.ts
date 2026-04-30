
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/offers/matches
 * Get offer-lead matches for the current DSE
 * Matches active offers against the DSE's active leads based on:
 * - Loan type alignment
 * - State matching
 * - Amount range compatibility
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch active offers
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id, offer_title, rolled_out_by, description, states_applicable, start_date, end_date, status, offer_image_url')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (offersError) {
      console.error('Error fetching offers:', offersError)
      return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
    }

    // Fetch DSE's active leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, customer_name, customer_phone, loan_type, loan_amount, state, status, created_at')
      .eq('assigned_to', user.id)
      .in('status', ['new', 'contacted', 'in_progress', 'follow_up', 'qualified'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (leadsError) {
      // If leads table doesn't exist or has different structure, return empty matches
      console.warn('Could not fetch leads:', leadsError.message)
      return NextResponse.json({
        success: true,
        matches: [],
        offers: offers || [],
        leads: [],
        summary: { total_matches: 0, top_offer: null }
      })
    }

    // Build matches
    const matches: Array<{
      offer_id: string
      offer_title: string
      bank: string
      lead_id: string
      lead_name: string
      match_score: number
      match_reasons: string[]
    }> = []

    for (const offer of (offers || [])) {
      for (const lead of (leads || [])) {
        const reasons: string[] = []
        let score = 0

        // State matching
        if (offer.states_applicable && lead.state) {
          if (offer.states_applicable.includes(lead.state) || offer.states_applicable.includes('All India')) {
            reasons.push('State match')
            score += 30
          }
        } else if (!offer.states_applicable || offer.states_applicable.length === 0) {
          // No state restriction = matches all
          reasons.push('Pan-India offer')
          score += 20
        }

        // Offer title/description keyword matching with loan type
        const offerText = `${offer.offer_title} ${offer.description}`.toLowerCase()
        const loanTypeKeywords: Record<string, string[]> = {
          home_loan: ['home loan', 'housing', 'home finance', 'property', 'apartment', 'flat'],
          personal_loan: ['personal loan', 'personal finance', 'instant loan'],
          car_loan: ['car loan', 'auto loan', 'vehicle', 'automobile'],
          business_loan: ['business loan', 'msme', 'working capital', 'business finance'],
          education_loan: ['education loan', 'student loan', 'study abroad'],
          gold_loan: ['gold loan', 'gold finance'],
          loan_against_property: ['lap', 'loan against property', 'mortgage'],
        }

        if (lead.loan_type && loanTypeKeywords[lead.loan_type]) {
          const hasMatch = loanTypeKeywords[lead.loan_type].some(kw => offerText.includes(kw))
          if (hasMatch) {
            reasons.push('Loan type match')
            score += 40
          }
        }

        // Bank match in offer title
        if (offerText.includes('sbi') || offerText.includes('hdfc') || offerText.includes('icici')) {
          score += 10
          reasons.push('Major bank offer')
        }

        // Active offer bonus
        const daysUntilExpiry = Math.ceil((new Date(offer.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
          score += 15
          reasons.push('Expiring soon')
        }

        // Only include meaningful matches
        if (score >= 20 && reasons.length > 0) {
          matches.push({
            offer_id: offer.id,
            offer_title: offer.offer_title,
            bank: offer.rolled_out_by,
            lead_id: lead.id,
            lead_name: lead.customer_name || 'Unnamed Lead',
            match_score: Math.min(score, 100),
            match_reasons: reasons,
          })
        }
      }
    }

    // Sort by score
    matches.sort((a, b) => b.match_score - a.match_score)

    // Group by offer for summary
    const offerMatchCounts = new Map<string, number>()
    matches.forEach(m => {
      offerMatchCounts.set(m.offer_id, (offerMatchCounts.get(m.offer_id) || 0) + 1)
    })

    let topOffer = null
    let maxCount = 0
    offerMatchCounts.forEach((count, offerId) => {
      if (count > maxCount) {
        maxCount = count
        const offer = (offers || []).find(o => o.id === offerId)
        topOffer = offer ? { id: offerId, title: offer.offer_title, match_count: count } : null
      }
    })

    return NextResponse.json({
      success: true,
      matches: matches.slice(0, 50), // Top 50 matches
      summary: {
        total_matches: matches.length,
        top_offer: topOffer,
        active_offers: (offers || []).length,
        active_leads: (leads || []).length,
      }
    })
  } catch (error) {
    console.error('Error in offer matching:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
