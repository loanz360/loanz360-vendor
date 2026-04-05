/**
 * API Route: Lead Notification Logs
 * GET /api/notifications/leads
 *
 * Fetches lead notification history with filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

interface LeadNotificationLog {
  id: string
  lead_id: string
  lead_number: string
  notification_type: string
  customer_name: string
  customer_mobile: string
  customer_email?: string
  partner_id?: string
  employee_id?: string
  bde_id?: string
  channels_attempted: string[]
  channels_succeeded: string[]
  result: object
  created_at: string
}

interface NotificationLogsResponse {
  success: boolean
  notifications?: LeadNotificationLog[]
  count?: number
  total?: number
  page?: number
  pageSize?: number
  error?: string
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as NotificationLogsResponse,
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const type = searchParams.get('type')
    const leadNumber = searchParams.get('leadNumber')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userType = searchParams.get('userType') // 'partner', 'employee', 'admin'

    // Calculate offset
    const offset = (page - 1) * pageSize

    // Build query
    let query = supabase
      .from('lead_notification_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Apply filters based on user type
    // Get user's role/type to determine access
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: partner } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: admin } = await supabase
      .from('admins')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    // Filter by user access
    if (admin?.role === 'SUPER_ADMIN') {
      // Super admin sees all
    } else if (partner) {
      query = query.eq('partner_id', partner.id)
    } else if (employee) {
      query = query.or(`employee_id.eq.${employee.id},bde_id.eq.${employee.id}`)
    } else {
      // Customer - only their own notifications (by mobile/email match)
      const { data: customerProfile } = await supabase
        .from('customer_profiles')
        .select('mobile_number, email')
        .eq('user_id', user.id)
        .maybeSingle()

      if (customerProfile) {
        const filters = []
        if (customerProfile.mobile_number) {
          filters.push(`customer_mobile.eq.${customerProfile.mobile_number}`)
        }
        if (customerProfile.email) {
          filters.push(`customer_email.eq.${customerProfile.email}`)
        }
        if (filters.length > 0) {
          query = query.or(filters.join(','))
        }
      }
    }

    // Apply additional filters
    if (type && type !== 'all') {
      query = query.eq('notification_type', type)
    }

    if (leadNumber) {
      query = query.ilike('lead_number', `%${leadNumber}%`)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: notifications, error, count } = await query

    if (error) {
      apiLogger.error('Fetch lead notifications error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' } as NotificationLogsResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      count: notifications?.length || 0,
      total: count || 0,
      page,
      pageSize,
    } as NotificationLogsResponse)
  } catch (error) {
    apiLogger.error('Lead notifications API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as NotificationLogsResponse,
      { status: 500 }
    )
  }
}
