
/**
 * Customer Wallet Transactions API
 * Provides paginated transaction history with filtering
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Filters
    const type = searchParams.get('type') // EARNED, REDEEMED, EXPIRED, BONUS
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get customer profile using admin client
    const { data: customer } = await adminClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer profile not found' },
        { status: 404 }
      )
    }

    // Build query using admin client to bypass RLS (already verified user identity)
    let query = adminClient
      .from('customer_points_transactions')
      .select('*', { count: 'exact' })
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (type && type !== 'ALL') {
      query = query.eq('transaction_type', type)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Execute with pagination
    const { data: transactions, count, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    // Get monthly summary for chart using admin client
    const { data: monthlySummary } = await adminClient
      .from('customer_points_transactions')
      .select('created_at, transaction_type, points')
      .eq('customer_id', customer.id)
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })

    // Process monthly data
    const monthlyData = processMonthlyData(monthlySummary || [])

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        monthly_summary: monthlyData
      }
    })

  } catch (error) {
    apiLogger.error('Wallet transactions API error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

// Process transactions into monthly summaries
function processMonthlyData(transactions: unknown[]): {
  month: string
  earned: number
  redeemed: number
  net: number
}[] {
  const monthlyMap = new Map<string, { earned: number; redeemed: number }>()

  transactions.forEach(tx => {
    const date = new Date(tx.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { earned: 0, redeemed: 0 })
    }

    const current = monthlyMap.get(monthKey)!
    if (tx.transaction_type === 'EARNED' || tx.transaction_type === 'BONUS') {
      current.earned += tx.points
    } else if (tx.transaction_type === 'REDEEMED') {
      current.redeemed += Math.abs(tx.points)
    }
  })

  // Convert to array and sort
  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      earned: data.earned,
      redeemed: data.redeemed,
      net: data.earned - data.redeemed
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12) // Last 12 months
}
