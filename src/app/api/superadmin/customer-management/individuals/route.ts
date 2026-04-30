
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const kycStatus = searchParams.get('kyc_status') || ''
    const offset = (page - 1) * limit

    // Build query for individuals (from customer_identities table)
    let query = supabase
      .from('customer_identities')
      .select(`
        id,
        unique_id,
        full_name,
        email,
        mobile_number,
        profile_photo_url,
        date_of_birth,
        gender,
        pan_number,
        primary_category,
        sub_category,
        current_city,
        current_state,
        kyc_status,
        status,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,mobile_number.ilike.%${search}%,unique_id.ilike.%${search}%`)
    }

    // Apply KYC status filter
    if (kycStatus) {
      query = query.eq('kyc_status', kycStatus)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: individuals, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching individuals', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch individuals' }, { status: 500 })
    }

    // Get statistics
    const { count: totalCount } = await supabase
      .from('customer_identities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')

    const { count: verifiedCount } = await supabase
      .from('customer_identities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .eq('kyc_status', 'VERIFIED')

    const { count: pendingCount } = await supabase
      .from('customer_identities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .in('kyc_status', ['PENDING', 'IN_PROGRESS', 'NOT_STARTED'])

    // Get active this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: activeThisMonth } = await supabase
      .from('customer_identities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .gte('created_at', startOfMonth.toISOString())

    // Transform data to include computed fields
    const transformedData = (individuals || []).map(ind => ({
      ...ind,
      income_category: ind.primary_category,
      income_profile: ind.sub_category,
      profile_completion: calculateProfileCompletion(ind),
      entity_count: 0, // Would need a join to get actual count
      is_verified: ind.kyc_status === 'VERIFIED'
    }))

    return NextResponse.json({
      success: true,
      data: transformedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      statistics: {
        totalIndividuals: totalCount || 0,
        verifiedIndividuals: verifiedCount || 0,
        pendingKYC: pendingCount || 0,
        activeThisMonth: activeThisMonth || 0
      }
    })
  } catch (error) {
    apiLogger.error('Error in individuals API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function calculateProfileCompletion(individual: Record<string, unknown>): number {
  const requiredFields = [
    'full_name',
    'email',
    'mobile_number',
    'date_of_birth',
    'gender',
    'pan_number',
    'current_city',
    'current_state',
    'primary_category',
    'sub_category'
  ]

  const filledFields = requiredFields.filter(field => {
    const value = individual[field]
    return value && String(value).trim() !== ''
  }).length

  return Math.round((filledFields / requiredFields.length) * 100)
}
