
/**
 * Customer Digital Wallet API
 * Provides wallet overview, points balance, and statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client for data queries to bypass RLS
    // (RLS policies check user_id but we need to query by customer_id)
    const adminClient = createSupabaseAdmin()

    // Get customer profile
    let { data: customer, error: customerError } = await adminClient
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // If customer record doesn't exist, auto-create it for existing users
    if (customerError || !customer) {
      // Try to get customer_profiles to determine category
      const { data: profile } = await adminClient
        .from('customer_profiles')
        .select('primary_category')
        .eq('customer_id', user.id)
        .maybeSingle()

      // Map primary_category to customer_category enum
      const getCustomerCategory = (category: string | null): string => {
        if (!category) return 'INDIVIDUAL'
        const categoryMap: Record<string, string> = {
          'SALARIED': 'SALARIED',
          'SELF_EMPLOYED': 'INDIVIDUAL',
          'BUSINESS_ENTITY': 'CORPORATE',
          'LLP': 'LLP',
          'PRIVATE_LIMITED_COMPANY': 'CORPORATE',
          'PUBLIC_LIMITED_COMPANY': 'CORPORATE',
          'PARTNERSHIP': 'PARTNERSHIPS',
          'PROPRIETOR': 'INDIVIDUAL',
          'NRI': 'NRI',
          'HUF': 'HUF',
          'AGRICULTURAL': 'AGRICULTURAL'
        }
        return categoryMap[category] || 'INDIVIDUAL'
      }

      // Create the missing customers record
      const { data: newCustomer, error: createError } = await adminClient
        .from('customers')
        .insert({
          user_id: user.id,
          customer_category: getCustomerCategory(profile?.primary_category),
          kyc_status: 'PENDING'
        })
        .select('id')
        .maybeSingle()

      if (createError || !newCustomer) {
        apiLogger.error('Failed to create customer record', createError)
        return NextResponse.json(
          { success: false, error: 'Customer profile not found' },
          { status: 404 }
        )
      }

      customer = newCustomer
    }

    // Get points balance
    const { data: pointsData } = await adminClient
      .from('customer_referral_points')
      .select('*')
      .eq('customer_id', customer.id)
      .maybeSingle()

    // Get referral statistics using the database function
    const { data: statsData } = await adminClient
      .rpc('get_customer_referral_stats', { p_customer_id: customer.id })

    // Get recent transactions (last 5)
    const { data: recentTransactions } = await adminClient
      .from('customer_points_transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get points configuration for display
    const { data: pointsConfig } = await adminClient
      .from('referral_points_config')
      .select('*')
      .eq('is_active', true)
      .order('config_key')

    // Build wallet overview response
    const currentPoints = pointsData?.points_balance || 0
    const totalEarned = pointsData?.total_points_earned || 0

    const walletData = {
      // Primary fields used by client
      current_points: currentPoints,
      points_balance: currentPoints,
      total_points_earned: totalEarned,
      total_points_redeemed: pointsData?.total_points_redeemed || 0,
      statistics: statsData?.[0] || {
        total_referrals: 0,
        pending_referrals: 0,
        opened_referrals: 0,
        registered_referrals: 0,
        applied_referrals: 0,
        converted_referrals: 0,
        conversion_rate: 0
      },
      recent_transactions: recentTransactions || [],
      points_config: pointsConfig || [],
      // Calculate wallet tier based on total earned
      tier: calculateTier(totalEarned),
      // Points expiring soon (placeholder - would need expiry tracking)
      expiring_soon: 0,
      next_tier_progress: calculateTierProgress(totalEarned)
    }

    return NextResponse.json({
      success: true,
      data: walletData
    })

  } catch (error) {
    apiLogger.error('Wallet API error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wallet data' },
      { status: 500 }
    )
  }
}

// Tier calculation based on total points earned
function calculateTier(totalPoints: number): {
  name: string
  level: number
  color: string
  icon: string
  minPoints: number
  maxPoints: number
} {
  if (totalPoints >= 10000) {
    return {
      name: 'Platinum',
      level: 4,
      color: '#E5E4E2',
      icon: '💎',
      minPoints: 10000,
      maxPoints: Infinity
    }
  } else if (totalPoints >= 5000) {
    return {
      name: 'Gold',
      level: 3,
      color: '#FFD700',
      icon: '🥇',
      minPoints: 5000,
      maxPoints: 10000
    }
  } else if (totalPoints >= 2000) {
    return {
      name: 'Silver',
      level: 2,
      color: '#C0C0C0',
      icon: '🥈',
      minPoints: 2000,
      maxPoints: 5000
    }
  } else {
    return {
      name: 'Bronze',
      level: 1,
      color: '#CD7F32',
      icon: '🥉',
      minPoints: 0,
      maxPoints: 2000
    }
  }
}

// Calculate progress to next tier
function calculateTierProgress(totalPoints: number): {
  currentPoints: number
  nextTierPoints: number
  progressPercentage: number
  pointsNeeded: number
  nextTierName: string
} {
  let nextTierPoints: number
  let nextTierName: string

  if (totalPoints >= 10000) {
    return {
      currentPoints: totalPoints,
      nextTierPoints: totalPoints,
      progressPercentage: 100,
      pointsNeeded: 0,
      nextTierName: 'Platinum (Max)'
    }
  } else if (totalPoints >= 5000) {
    nextTierPoints = 10000
    nextTierName = 'Platinum'
  } else if (totalPoints >= 2000) {
    nextTierPoints = 5000
    nextTierName = 'Gold'
  } else {
    nextTierPoints = 2000
    nextTierName = 'Silver'
  }

  const progressPercentage = Math.min(100, Math.round((totalPoints / nextTierPoints) * 100))
  const pointsNeeded = nextTierPoints - totalPoints

  return {
    currentPoints: totalPoints,
    nextTierPoints,
    progressPercentage,
    pointsNeeded,
    nextTierName
  }
}
