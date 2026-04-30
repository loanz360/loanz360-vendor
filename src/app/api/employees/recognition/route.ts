import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// EMPLOYEE RECOGNITION API
// GET: List recognitions (wall of fame)
// POST: Give recognition to peer/team member
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET: List recognitions
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get('filter') // 'my_recognitions', 'given_by_me', 'public', 'featured'
    const limit = parseInt(searchParams.get('limit') || '20')

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    let query = supabase
      .from('employee_recognition')
      .select(`
        *,
        employee:employee_id(
          id,
          full_name,
          work_email,
          profile_photo_url
        ),
        given_by_user:given_by(
          id,
          full_name,
          work_email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filter === 'my_recognitions') {
      query = query.eq('employee_id', employee.id)
    } else if (filter === 'given_by_me') {
      query = query.eq('given_by', user.id)
    } else if (filter === 'featured') {
      query = query.eq('is_featured', true).eq('is_public', true)
    } else {
      // Default: public recognitions
      query = query.eq('is_public', true)
    }

    // Only approved recognitions
    query = query.eq('status', 'APPROVED')

    const { data: recognitions, error: recogError } = await query

    if (recogError) {
      apiLogger.error('Recognitions fetch error', recogError)
      return NextResponse.json({ success: false, error: 'Failed to fetch recognitions' }, { status: 500 })
    }

    // Get stats if fetching my recognitions
    let stats = null
    if (filter === 'my_recognitions') {
      const { data: statsData } = await supabase
        .from('employee_recognition')
        .select('recognition_type, has_monetary_reward, reward_amount')
        .eq('employee_id', employee.id)
        .eq('status', 'APPROVED')

      stats = {
        total_recognitions: statsData?.length || 0,
        total_reward_amount: statsData?.reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0,
        by_type: {} as Record<string, number>
      }

      statsData?.forEach((r: any) => {
        stats.by_type[r.recognition_type] = (stats.by_type[r.recognition_type] || 0) + 1
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        recognitions,
        stats
      }
    })
  } catch (error) {
    apiLogger.error('Recognition GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Give recognition
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      employee_id, // Who is being recognized
      recognition_type, // SPOT_AWARD, MONTHLY_STAR, PEER_APPRECIATION, etc.
      recognition_category,
      title,
      description,
      specific_achievement,
      is_public
    } = body

    // Validation
    if (!employee_id || !recognition_type || !title || !description) {
      return NextResponse.json({ success: false, error: 'employee_id, recognition_type, title, and description required'
      }, { status: 400 })
    }

    // Can't recognize yourself
    const { data: recipientEmployee } = await supabase
      .from('employees')
      .select('user_id')
      .eq('id', employee_id)
      .maybeSingle()

    if (recipientEmployee && recipientEmployee.user_id === user.id) {
      return NextResponse.json({ success: false, error: 'Cannot recognize yourself' }, { status: 400 })
    }

    // Insert recognition (status PENDING for manager/HR approval)
    const { data: recognition, error: insertError } = await supabase
      .from('employee_recognition')
      .insert({
        employee_id,
        given_by: user.id,
        recognition_type,
        recognition_category,
        title,
        description,
        specific_achievement,
        is_public: is_public !== false, // Default true
        status: 'PENDING'
      })
      .select(`
        *,
        employee:employee_id(
          id,
          full_name,
          work_email
        )
      `)
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Recognition insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create recognition' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: recognition,
      message: 'Recognition submitted for approval'
    })
  } catch (error) {
    apiLogger.error('Recognition POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
