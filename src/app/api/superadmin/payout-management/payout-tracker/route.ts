/**
 * Payout Tracker API
 * Provides stage-wise pipeline visualization data for SA
 * Aggregates from both cp_applications and partner_payout_applications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


const PIPELINE_STAGES = [
  'PENDING',
  'ACCOUNTS_VERIFICATION',
  'ACCOUNTS_VERIFIED',
  'SA_APPROVED',
  'FINANCE_PROCESSING',
  'PAYOUT_CREDITED',
] as const

const SIDE_STATUSES = ['REJECTED', 'ON_HOLD'] as const

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const partnerType = searchParams.get('partner_type') || 'all' // 'all', 'ba', 'bp', 'cp'
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const bankFilter = searchParams.get('bank')

    // Build parallel count queries for each stage across both tables
    const allStages = [...PIPELINE_STAGES, ...SIDE_STATUSES]

    // CP pipeline counts
    const cpCountPromises = allStages.map(status => {
      let q = supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })

      // Handle CP status mapping to standard statuses
      if (status === 'PENDING') {
        q = q.in('status', ['PENDING', 'UNDER_REVIEW'])
      } else if (status === 'SA_APPROVED') {
        q = q.in('status', ['SA_APPROVED', 'APPROVED'])
      } else if (status === 'PAYOUT_CREDITED') {
        q = q.in('status', ['PAYOUT_CREDITED', 'PAYOUT_PROCESSED'])
      } else {
        q = q.eq('status', status)
      }

      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`)
      if (bankFilter) q = q.ilike('bank_name', `%${bankFilter}%`)

      return q
    })

    // CP amount queries for pipeline stages
    const cpAmountPromises = PIPELINE_STAGES.map(status => {
      let q = supabase
        .from('cp_applications')
        .select('expected_payout_amount, payment_amount')

      // Handle CP status mapping to standard statuses (amounts)
      if (status === 'PENDING') {
        q = q.in('status', ['PENDING', 'UNDER_REVIEW'])
      } else if (status === 'SA_APPROVED') {
        q = q.in('status', ['SA_APPROVED', 'APPROVED'])
      } else if (status === 'PAYOUT_CREDITED') {
        q = q.in('status', ['PAYOUT_CREDITED', 'PAYOUT_PROCESSED'])
      } else {
        q = q.eq('status', status)
      }

      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`)
      if (bankFilter) q = q.ilike('bank_name', `%${bankFilter}%`)

      return q
    })

    // Partner pipeline counts (BA/BP)
    const partnerCountPromises = allStages.map(status => {
      let q = supabase
        .from('partner_payout_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)

      if (partnerType === 'ba') q = q.eq('partner_type', 'BA')
      else if (partnerType === 'bp') q = q.eq('partner_type', 'BP')

      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`)
      if (bankFilter) q = q.ilike('bank_name', `%${bankFilter}%`)

      return q
    })

    // Partner amount queries
    const partnerAmountPromises = PIPELINE_STAGES.map(status => {
      let q = supabase
        .from('partner_payout_applications')
        .select('expected_commission_amount, payment_amount')
        .eq('status', status)

      if (partnerType === 'ba') q = q.eq('partner_type', 'BA')
      else if (partnerType === 'bp') q = q.eq('partner_type', 'BP')

      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`)
      if (bankFilter) q = q.ilike('bank_name', `%${bankFilter}%`)

      return q
    })

    // Aging: applications stuck > 3 days in non-terminal stages
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const agingPromises = [
      supabase.from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED', 'FINANCE_PROCESSING'])
        .lt('updated_at', threeDaysAgo),
      supabase.from('partner_payout_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED', 'FINANCE_PROCESSING'])
        .lt('updated_at', threeDaysAgo),
    ]

    // Execute all queries in parallel
    const [
      cpCounts, cpAmounts,
      partnerCounts, partnerAmounts,
      agingResults,
    ] = await Promise.all([
      Promise.all(cpCountPromises),
      Promise.all(cpAmountPromises),
      Promise.all(partnerCountPromises),
      Promise.all(partnerAmountPromises),
      Promise.all(agingPromises),
    ])

    // Build pipeline stages response
    const pipeline = PIPELINE_STAGES.map((stage, i) => {
      const cpCount = (partnerType === 'ba' || partnerType === 'bp') ? 0 : (cpCounts[i].count || 0)
      const partnerCount = partnerType === 'cp' ? 0 : (partnerCounts[i].count || 0)

      const cpAmount = (partnerType === 'ba' || partnerType === 'bp') ? 0 :
        (cpAmounts[i].data || []).reduce((sum, a) => sum + (a.payment_amount || a.expected_payout_amount || 0), 0)
      const partnerAmount = partnerType === 'cp' ? 0 :
        (partnerAmounts[i].data || []).reduce((sum, a) => sum + (a.payment_amount || a.expected_commission_amount || 0), 0)

      return {
        stage,
        count: cpCount + partnerCount,
        amount: cpAmount + partnerAmount,
        cp_count: cpCount,
        partner_count: partnerCount,
      }
    })

    // Side statuses
    const sideStatuses = SIDE_STATUSES.map((status, i) => {
      const idx = PIPELINE_STAGES.length + i
      const cpCount = (partnerType === 'ba' || partnerType === 'bp') ? 0 : (cpCounts[idx].count || 0)
      const partnerCount = partnerType === 'cp' ? 0 : (partnerCounts[idx].count || 0)

      return {
        status,
        count: cpCount + partnerCount,
        cp_count: cpCount,
        partner_count: partnerCount,
      }
    })

    // Total pipeline value
    const totalPipelineValue = pipeline.reduce((sum, s) => sum + s.amount, 0)
    const totalApplications = pipeline.reduce((sum, s) => sum + s.count, 0)
    const totalCredited = pipeline.find(s => s.stage === 'PAYOUT_CREDITED')?.amount || 0
    const totalStuck = (agingResults[0].count || 0) + (agingResults[1].count || 0)

    // Conversion rates
    const pendingCount = pipeline[0]?.count || 0
    const creditedCount = pipeline[5]?.count || 0
    const conversionRate = totalApplications > 0
      ? Math.round((creditedCount / totalApplications) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        pipeline,
        sideStatuses,
        summary: {
          totalApplications,
          totalPipelineValue,
          totalCredited,
          totalStuck,
          conversionRate,
          rejectedCount: sideStatuses.find(s => s.status === 'REJECTED')?.count || 0,
          onHoldCount: sideStatuses.find(s => s.status === 'ON_HOLD')?.count || 0,
        },
        filters: {
          partnerType,
          dateFrom,
          dateTo,
          bank: bankFilter,
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error in payout tracker API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
