
/**
 * Admin Referrals List API
 * Returns list of active referrals by type (BP/CP/Employee) for Change Referrer modal
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function GET(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY SUPER ADMIN AUTHENTICATION
    // =====================================================

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    let adminId: string

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      adminId = payload.sub as string

      if (!adminId) {
        throw new Error('Invalid token payload')
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
        },
        { status: 401 }
      )
    }

    // Verify Super Admin role
    const { data: adminData, error: adminError } = await supabase
      .from('employee_profile')
      .select('role, is_active')
      .eq('id', adminId)
      .maybeSingle()

    if (adminError || !adminData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin profile not found',
        },
        { status: 404 }
      )
    }

    if (adminData.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Super Admin access required',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 2. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'BP'

    // =====================================================
    // 3. FETCH REFERRALS BASED ON TYPE
    // =====================================================

    let referrals: unknown[] = []

    if (type === 'BP') {
      const { data, error } = await supabase
        .from('business_partner')
        .select('referral_id, name, email, phone, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) {
        apiLogger.error('BP fetch error', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch Business Partners',
          },
          { status: 500 }
        )
      }

      referrals = (data || []).map((bp) => ({
        id: bp.referral_id,
        name: bp.name,
        type: 'BP',
        email: bp.email,
        phone: bp.phone,
      }))
    } else if (type === 'CP') {
      const { data, error } = await supabase
        .from('channel_partner')
        .select('referral_id, name, email, phone, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) {
        apiLogger.error('CP fetch error', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch Channel Partners',
          },
          { status: 500 }
        )
      }

      referrals = (data || []).map((cp) => ({
        id: cp.referral_id,
        name: cp.name,
        type: 'CP',
        email: cp.email,
        phone: cp.phone,
      }))
    } else if (type === 'EMPLOYEE') {
      const { data, error } = await supabase
        .from('employee_profile')
        .select('employee_id, name, email, phone, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) {
        apiLogger.error('Employee fetch error', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch Employees',
          },
          { status: 500 }
        )
      }

      referrals = (data || []).map((emp) => ({
        id: emp.employee_id,
        name: emp.name,
        type: 'EMPLOYEE',
        email: emp.email,
        phone: emp.phone,
      }))
    } else if (type === 'CUSTOMER') {
      // Direct application
      referrals = [
        {
          id: 'LOANZ360',
          name: 'LOANZ360 (Direct Application)',
          type: 'CUSTOMER',
        },
      ]
    }

    // =====================================================
    // 4. RETURN REFERRALS LIST
    // =====================================================

    return NextResponse.json({
      success: true,
      type,
      referrals,
      count: referrals.length,
    })
  } catch (error) {
    apiLogger.error('Referrals List API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
