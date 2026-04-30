
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch all BA payout percentages with pagination and search
export async function GET(request: NextRequest) {
  try {
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build query
    let query = supabase
      .from('payout_ba_percentages')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`bank_name.ilike.%${search}%,loan_type.ilike.%${search}%,location.ilike.%${search}%`)
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching BA percentages', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Get summary statistics
    const { data: summaryData } = await supabase
      .from('payout_ba_percentages_summary')
      .select('*')
      .maybeSingle()

    // Get BA settings (global multiplier)
    const { data: settingsData } = await supabase
      .from('payout_ba_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary: summaryData || {},
      settings: settingsData || { ba_percentage_multiplier: 70.00 }
    })
  } catch (error) {
    apiLogger.error('Error in GET BA percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update BA commission percentage (manual override)
export async function PATCH(request: NextRequest) {
  try {
    const superAdminSession = request.cookies.get('super_admin_session')?.value
    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const body = await request.json()

    const { id, ba_commission_percentage, specific_conditions } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: any = {}

    if (ba_commission_percentage !== undefined) {
      if (ba_commission_percentage < 0 || ba_commission_percentage > 100) {
        return NextResponse.json(
          { error: 'BA commission percentage must be between 0 and 100' },
          { status: 400 }
        )
      }
      updateData.ba_commission_percentage = ba_commission_percentage
      updateData.is_manual_override = true
    }

    if (specific_conditions !== undefined) {
      updateData.specific_conditions = specific_conditions
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update BA percentage
    const { data, error } = await supabase
      .from('payout_ba_percentages')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating BA percentage', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'BA percentage entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'BA percentage updated successfully',
      data
    })
  } catch (error) {
    apiLogger.error('Error in PATCH BA percentages', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
