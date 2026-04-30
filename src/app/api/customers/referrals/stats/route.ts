/**
 * API Route: Get Customer Referral Statistics
 * GET /api/customers/referrals/stats
 *
 * Retrieves referral statistics for the authenticated customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReferralStatsResponse, CustomerReferralStats } from '@/types/customer-referrals'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ReferralStatsResponse,
        { status: 401 }
      )
    }

    // 2. Get customer information
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no customer profile exists, return default empty stats
    if (!customer) {
      const defaultStats: CustomerReferralStats = {
        total_referrals: 0,
        pending_referrals: 0,
        opened_referrals: 0,
        registered_referrals: 0,
        applied_referrals: 0,
        converted_referrals: 0,
        total_points_earned: 0,
        points_balance: 0,
        conversion_rate: 0,
      }
      return NextResponse.json({
        success: true,
        data: defaultStats,
      } as ReferralStatsResponse)
    }

    // 3. Try to get stats using database function
    const { data: statsResult, error: statsError } = await supabase.rpc(
      'get_customer_referral_stats',
      { p_customer_id: customer.id }
    )

    if (statsError) {
      apiLogger.error('Stats function error', statsError)
      // Fallback: Calculate stats manually
      const { data: referrals, error: referralsError } = await supabase
        .from('customer_referrals')
        .select('referral_status, converted')
        .eq('referrer_customer_id', customer.id)

      if (referralsError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch statistics' } as ReferralStatsResponse,
          { status: 500 }
        )
      }

      // Get points balance
      const { data: points } = await supabase
        .from('customer_referral_points')
        .select('points_balance, total_points_earned')
        .eq('customer_id', customer.id)
        .maybeSingle()

      const stats: CustomerReferralStats = {
        total_referrals: referrals?.length || 0,
        pending_referrals: referrals?.filter(r => r.referral_status === 'NEW').length || 0,
        opened_referrals: referrals?.filter(r => r.referral_status === 'LINK_OPENED').length || 0,
        registered_referrals: referrals?.filter(r => r.referral_status === 'REGISTERED').length || 0,
        applied_referrals: referrals?.filter(r => r.referral_status === 'APPLIED').length || 0,
        converted_referrals: referrals?.filter(r => r.referral_status === 'CONVERTED').length || 0,
        total_points_earned: points?.total_points_earned || 0,
        points_balance: points?.points_balance || 0,
        conversion_rate: referrals && referrals.length > 0
          ? Math.round((referrals.filter(r => r.converted).length / referrals.length) * 100 * 100) / 100
          : 0,
      }

      return NextResponse.json({
        success: true,
        data: stats,
      } as ReferralStatsResponse)
    }

    // 4. Return stats from function
    const stats = statsResult?.[0] || {
      total_referrals: 0,
      pending_referrals: 0,
      opened_referrals: 0,
      registered_referrals: 0,
      applied_referrals: 0,
      converted_referrals: 0,
      total_points_earned: 0,
      points_balance: 0,
      conversion_rate: 0,
    }

    return NextResponse.json({
      success: true,
      data: stats as CustomerReferralStats,
    } as ReferralStatsResponse)
  } catch (error) {
    apiLogger.error('Get referral stats error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ReferralStatsResponse,
      { status: 500 }
    )
  }
}
