
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch admin profile
    const { data: profile, error } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('admin_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error
      apiLogger.error('Error fetching admin profile', { error, userId: user.id })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: profile || null,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/admin/profile', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Upsert admin profile
    const { data, error } = await supabase
      .from('admin_profiles')
      .upsert(
        {
          admin_id: user.id,
          full_name: body.full_name,
          email: body.email,
          mobile_number: body.mobile_number,
          profile_photo_url: body.profile_photo_url,
          department: body.department,
          designation: body.designation,
          employee_id: body.employee_id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'admin_id',
        }
      )
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error saving admin profile', { error, userId: user.id })
      return NextResponse.json(
        { success: false, error: 'Failed to save profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: data,
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/admin/profile', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
