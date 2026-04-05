import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const assignSchema = z.object({
  entityType: z.enum(['contact', 'positive_contact', 'lead']),
  entityId: z.string().uuid(),
  loanType: z.string().optional(),
  location: z.string().optional(),
  language: z.string().optional(),
})

/**
 * POST /api/ai-crm/smart-assign
 * Skill-based auto-assignment: matches entity to best CRO based on expertise,
 * location, language, capacity, and load balancing.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 })
    }

    const { entityType, entityId, loanType, location, language } = parsed.data

    // Fetch all active, available CROs with categories
    const { data: croCats } = await supabase
      .from('cro_categories')
      .select('cro_id, loan_type_expertise, locations, languages, skill_level, max_daily_contacts, max_active_leads')
      .eq('is_active', true)
      .eq('is_on_leave', false)

    if (!croCats || croCats.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available CROs for assignment',
      }, { status: 404 })
    }

    // Score each CRO
    const skillWeights: Record<string, number> = {
      champion: 5, star: 4, senior: 3, mid: 2, junior: 1,
    }

    const scoredCros = croCats.map(cro => {
      let score = skillWeights[cro.skill_level] || 1

      if (loanType && Array.isArray(cro.loan_type_expertise) && cro.loan_type_expertise.includes(loanType)) {
        score += 10
      }
      if (location && Array.isArray(cro.locations) && cro.locations.includes(location)) {
        score += 5
      }
      if (language && Array.isArray(cro.languages) && cro.languages.includes(language)) {
        score += 3
      }

      return { ...cro, score }
    })

    // Check capacity
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const croIds = scoredCros.map(c => c.cro_id)

    const [{ data: todayCounts }, { data: leadCounts }] = await Promise.all([
      supabase
        .from('cro_call_logs')
        .select('cro_id')
        .in('cro_id', croIds)
        .gte('call_started_at', todayStart.toISOString()),
      supabase
        .from('crm_leads')
        .select('cro_id')
        .in('cro_id', croIds)
        .not('status', 'in', '("converted","lost")'),
    ])

    const callCountMap = new Map<string, number>()
    ;(todayCounts || []).forEach(log => {
      callCountMap.set(log.cro_id, (callCountMap.get(log.cro_id) || 0) + 1)
    })

    const leadCountMap = new Map<string, number>()
    ;(leadCounts || []).forEach(lead => {
      leadCountMap.set(lead.cro_id, (leadCountMap.get(lead.cro_id) || 0) + 1)
    })

    const availableCros = scoredCros
      .filter(cro => {
        const dailyCalls = callCountMap.get(cro.cro_id) || 0
        const activeLeads = leadCountMap.get(cro.cro_id) || 0
        return dailyCalls < cro.max_daily_contacts && activeLeads < cro.max_active_leads
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aLoad = (callCountMap.get(a.cro_id) || 0) + (leadCountMap.get(a.cro_id) || 0)
        const bLoad = (callCountMap.get(b.cro_id) || 0) + (leadCountMap.get(b.cro_id) || 0)
        return aLoad - bLoad
      })

    if (availableCros.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'All matching CROs are at capacity',
      }, { status: 404 })
    }

    const selectedCro = availableCros[0]

    // Assign
    const tableMap: Record<string, { table: string; field: string }> = {
      contact: { table: 'crm_contacts', field: 'assigned_to_cro' },
      positive_contact: { table: 'positive_contacts', field: 'cro_id' },
      lead: { table: 'crm_leads', field: 'cro_id' },
    }

    const { table, field } = tableMap[entityType]
    const { error: assignError } = await supabase
      .from(table)
      .update({ [field]: selectedCro.cro_id, updated_at: new Date().toISOString() })
      .eq('id', entityId)

    if (assignError) {
      apiLogger.error('Error assigning entity:', assignError)
      return NextResponse.json({ success: false, error: 'Failed to assign entity' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        assignedCroId: selectedCro.cro_id,
        matchScore: selectedCro.score,
        skillLevel: selectedCro.skill_level,
      },
      message: 'Entity assigned to best-matching CRO',
    })
  } catch (error) {
    apiLogger.error('Smart-assign error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
