/**
 * API Route: Get Customer Referrals
 * GET /api/customers/referrals
 *
 * Retrieves all referrals made by the authenticated customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GetReferralsResponse } from '@/types/customer-referrals'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

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
        { success: false, error: 'Unauthorized' } as GetReferralsResponse,
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status') // referral_status filter
    const formStatus = searchParams.get('form_status')
    const search = searchParams.get('search')

    // Calculate offset
    const offset = (page - 1) * limit

    // 3. Get customer information
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no customer profile exists, return empty list
    if (!customer) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      } as GetReferralsResponse)
    }

    // 4. Build query
    let query = supabase
      .from('customer_referrals')
      .select('*', { count: 'exact' })
      .eq('referrer_customer_id', customer.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('referral_status', status)
    }
    if (formStatus) {
      query = query.eq('form_status', formStatus)
    }
    if (search) {
      query = query.or(`referred_name.ilike.%${search}%,referred_mobile.ilike.%${search}%,referred_email.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // 5. Execute query
    const { data: referrals, error: referralsError, count } = await query

    if (referralsError) {
      apiLogger.error('Referrals fetch error', referralsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch referrals' } as GetReferralsResponse,
        { status: 500 }
      )
    }

    // 6. Return response
    return NextResponse.json({
      success: true,
      data: referrals || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    } as GetReferralsResponse)
  } catch (error) {
    apiLogger.error('Get referrals error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as GetReferralsResponse,
      { status: 500 }
    )
  }
}
