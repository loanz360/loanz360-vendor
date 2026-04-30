
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
    const verificationStatus = searchParams.get('verification_status') || ''
    const entityType = searchParams.get('entity_type') || ''
    const offset = (page - 1) * limit

    // Build query for entities
    let query = supabase
      .from('entities')
      .select(`
        id,
        unique_id,
        legal_name,
        trading_name,
        entity_type,
        industry_category,
        registration_number,
        pan_number,
        gst_number,
        cin_number,
        registered_city,
        registered_state,
        verification_status,
        status,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`legal_name.ilike.%${search}%,trading_name.ilike.%${search}%,pan_number.ilike.%${search}%,gst_number.ilike.%${search}%,unique_id.ilike.%${search}%`)
    }

    // Apply verification status filter
    if (verificationStatus) {
      query = query.eq('verification_status', verificationStatus)
    }

    // Apply entity type filter
    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: entities, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching entities', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch entities' }, { status: 500 })
    }

    // Get statistics
    const { count: totalCount } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')

    const { count: verifiedCount } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .eq('verification_status', 'VERIFIED')

    const { count: pendingCount } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .in('verification_status', ['PENDING', 'IN_REVIEW'])

    // Get added this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: activeThisMonth } = await supabase
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .gte('created_at', startOfMonth.toISOString())

    // Get entity type names
    const { data: entityTypes } = await supabase
      .from('entity_types')
      .select('key, name')

    const entityTypeMap: Record<string, string> = {}
    entityTypes?.forEach(et => {
      entityTypeMap[et.key] = et.name
    })

    // Transform data to include computed fields
    const transformedData = (entities || []).map(entity => ({
      ...entity,
      entity_type_name: entityTypeMap[entity.entity_type] || null,
      profile_completion: calculateEntityCompletion(entity),
      member_count: 0, // Would need a join to get actual count
      is_verified: entity.verification_status === 'VERIFIED'
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
        totalEntities: totalCount || 0,
        verifiedEntities: verifiedCount || 0,
        pendingVerification: pendingCount || 0,
        activeThisMonth: activeThisMonth || 0
      }
    })
  } catch (error) {
    apiLogger.error('Error in entities API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function calculateEntityCompletion(entity: Record<string, unknown>): number {
  const requiredFields = [
    'legal_name',
    'entity_type',
    'pan_number',
    'registered_city',
    'registered_state'
  ]

  const optionalFields = [
    'trading_name',
    'gst_number',
    'cin_number',
    'registration_number',
    'industry_category'
  ]

  const requiredFilled = requiredFields.filter(field => {
    const value = entity[field]
    return value && String(value).trim() !== ''
  }).length

  const optionalFilled = optionalFields.filter(field => {
    const value = entity[field]
    return value && String(value).trim() !== ''
  }).length

  // Required fields are worth 70%, optional fields 30%
  const requiredScore = (requiredFilled / requiredFields.length) * 70
  const optionalScore = (optionalFilled / optionalFields.length) * 30

  return Math.round(requiredScore + optionalScore)
}
