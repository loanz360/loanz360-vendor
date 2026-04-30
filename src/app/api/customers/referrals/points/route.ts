/**
 * API Route: Get Customer Points Balance and History
 * GET /api/customers/referrals/points
 *
 * Retrieves points balance and transaction history for the authenticated customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PointsBalanceResponse } from '@/types/customer-referrals'
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
        { success: false, error: 'Unauthorized' } as PointsBalanceResponse,
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // 3. Get customer information
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no customer profile exists, return default empty data
    if (!customer) {
      // Get points configuration (available to all)
      const { data: config } = await supabase
        .from('referral_points_config')
        .select('*')
        .eq('is_active', true)

      return NextResponse.json({
        success: true,
        data: {
          balance: {
            id: '',
            customer_id: '',
            user_id: user.id,
            points_balance: 0,
            total_points_earned: 0,
            total_points_redeemed: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          recent_transactions: [],
          config: config || [],
        },
      } as PointsBalanceResponse)
    }

    // 4. Get or create points balance record
    let { data: balance, error: balanceError } = await supabase
      .from('customer_referral_points')
      .select('*')
      .eq('customer_id', customer.id)
      .maybeSingle()

    // If no balance record exists, create one
    if (balanceError && balanceError.code === 'PGRST116') {
      const { data: newBalance, error: createError } = await supabase
        .from('customer_referral_points')
        .insert({
          customer_id: customer.id,
          user_id: user.id,
          points_balance: 0,
          total_points_earned: 0,
          total_points_redeemed: 0,
        })
        .select()
        .maybeSingle()

      if (createError) {
        apiLogger.error('Failed to create points balance', createError)
        // Return default balance
        balance = {
          id: '',
          customer_id: customer.id,
          user_id: user.id,
          points_balance: 0,
          total_points_earned: 0,
          total_points_redeemed: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      } else {
        balance = newBalance
      }
    } else if (balanceError) {
      apiLogger.error('Balance fetch error', balanceError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch points balance' } as PointsBalanceResponse,
        { status: 500 }
      )
    }

    // 5. Get recent transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('customer_points_transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (transactionsError) {
      apiLogger.error('Transactions fetch error', transactionsError)
      // Continue with empty transactions
    }

    // 6. Get points configuration
    const { data: config, error: configError } = await supabase
      .from('referral_points_config')
      .select('*')
      .eq('is_active', true)

    if (configError) {
      apiLogger.error('Config fetch error', configError)
      // Continue with empty config
    }

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: {
        balance: balance!,
        recent_transactions: transactions || [],
        config: config || [],
      },
    } as PointsBalanceResponse)
  } catch (error) {
    apiLogger.error('Get points balance error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as PointsBalanceResponse,
      { status: 500 }
    )
  }
}
