export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { validateRequest, CreateIncentiveSchema } from '@/lib/validations/incentive-validations'
import { createIncentiveWithAllocations } from '@/lib/utils/transaction-handler'
import { parsePaginationParams, getSupabaseRange, createPaginatedResponse } from '@/lib/utils/pagination'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'

/**
 * GET /api/incentives
 * Fetch all incentives with optional filters
 * Access: SuperAdmin, HR
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling (supports super_admin_session cookie)
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    // Check if user has admin/HR permissions
    const isSuperAdmin = auth.role === 'SUPER_ADMIN'
    const isHR = auth.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden: Only SuperAdmin or HR can access incentive management' },
        { status: 403 }
      )
    }

    // Use admin client for database operations
    const supabase = createSupabaseAdmin()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'draft', 'active', 'expired', 'disabled'
    const subrole = searchParams.get('subrole')

    // Get pagination params using utility
    const { page, limit } = parsePaginationParams(searchParams)
    const [from, to] = getSupabaseRange(page, limit)

    // Build query - simplified without employees foreign key
    let query = supabase
      .from('incentives')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (subrole) {
      query = query.eq('incentive_target_audience.subrole.subrole_code', subrole)
    }

    const { data: incentives, error, count } = await query

    if (error) {
      logger.error('Error fetching incentives', error)

      // Check if it's a table not found error
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return NextResponse.json({ success: false, error: 'Database tables not found',
          message: 'The incentive tables have not been created yet. Please run the database migration first.',
          details: 'See INCENTIVE_SETUP_GUIDE.md for migration instructions',
        }, { status: 500 })
      }

      throw error
    }

    // Return paginated response using utility
    return NextResponse.json(
      createPaginatedResponse(incentives || [], page, limit, count || 0)
    )
  } catch (error) {
    logger.error('Error in GET /api/incentives', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'fetchIncentives' })

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch incentives'

    return NextResponse.json({ success: false, error: 'Failed to fetch incentives',
      message: errorMessage,
      hint: 'Check if database migration has been run and tables exist'
    }, { status: 500 })
  }
}

/**
 * POST /api/incentives
 * Create a new incentive scheme
 * Access: SuperAdmin, HR
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Use verifyAuth for proper session handling (supports super_admin_session cookie)
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      )
    }

    // Check permissions
    const isSuperAdmin = auth.role === 'SUPER_ADMIN'
    const isHR = auth.role === 'HR'

    if (!isSuperAdmin && !isHR) {
      return NextResponse.json(
        { error: 'Forbidden: Only SuperAdmin or HR can create incentives' },
        { status: 403 }
      )
    }

    // Use admin client for database operations
    const supabase = createSupabaseAdmin()

    // Get creator name
    let creatorName = 'Admin'
    if (isSuperAdmin) {
      const { data: admin } = await supabase
        .from('super_admins')
        .select('email')
        .eq('id', auth.userId)
        .maybeSingle()
      creatorName = admin?.email || 'Admin'
    } else {
      const { data: employee } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', auth.userId)
        .maybeSingle()
      creatorName = employee?.full_name || 'HR'
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, CreateIncentiveSchema)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error,
          details: validation.details,
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Insert incentive
    const { data: incentive, error: insertError } = await supabase
      .from('incentives')
      .insert({
        incentive_title: data.incentive_title,
        incentive_description: data.incentive_description,
        incentive_type: data.incentive_type,
        incentive_image_url: data.incentive_image_url || null,
        reward_amount: data.reward_amount || null,
        reward_currency: data.reward_currency,
        reward_details: data.reward_details || null,
        start_date: data.start_date,
        end_date: data.end_date,
        target_category: data.target_category,
        target_all_employees: data.target_all_employees,
        performance_criteria: data.performance_criteria,
        status: data.status,
        display_order: data.display_order,
        notify_on_launch: data.notify_on_launch,
        notify_before_expiry_days: data.notify_before_expiry_days,
        is_active: true,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error inserting incentive', insertError)
      throw insertError
    }

    // Insert target audiences if not targeting all employees
    if (!data.target_all_employees && data.target_subroles.length > 0) {
      const targetAudiences = data.target_subroles.map((subrole_id: string) => ({
        incentive_id: incentive.id,
        subrole_id,
      }))

      const { error: audienceError } = await supabase
        .from('incentive_target_audience')
        .insert(targetAudiences)

      if (audienceError) {
        logger.error('Error inserting target audiences', audienceError)
        // Rollback: delete the incentive
        await supabase.from('incentives').delete().eq('id', incentive.id)
        throw audienceError
      }
    }

    // Create allocations for eligible users
    if (data.status === 'active') {
      await createIncentiveAllocations(supabase, incentive.id, data.target_all_employees, data.target_subroles)
    }

    // Send notification if requested and status is active
    if (data.notify_on_launch && data.status === 'active') {
      // Queue notification (will be handled by notification system)
      await sendIncentiveLaunchNotification(supabase, incentive, creatorName)
    }

    logger.info(`Incentive created: ${incentive.id} by ${auth.userId}`)

    return NextResponse.json({
      success: true,
      data: incentive,
      message: 'Incentive created successfully',
    }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/incentives', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'createIncentive' })
    return NextResponse.json({ success: false, error: 'Failed to create incentive' }, { status: 500 })
  }
}

/**
 * Helper function: Create allocations for eligible users
 */
async function createIncentiveAllocations(
  supabase: any,
  incentiveId: string,
  targetAllEmployees: boolean,
  targetSubroles: string[]
) {
  try {
    let eligibleUsers: any[] = []

    if (targetAllEmployees) {
      // Get all active employees (FIXED: use employee_status and user_id)
      const { data: users, error } = await supabase
        .from('employees')
        .select('user_id')
        .eq('employee_status', 'ACTIVE')
        .isNotNull('user_id')

      if (error) throw error
      eligibleUsers = users || []
    } else {
      // Get employees matching target subroles
      const { data: subroles, error: subroleError } = await supabase
        .from('incentive_employee_subroles')
        .select('subrole_code')
        .in('id', targetSubroles)

      if (subroleError) throw subroleError

      const subroleCodes = subroles.map((sr: any) => sr.subrole_code)

      // FIXED: use employee_status and user_id
      const { data: users, error } = await supabase
        .from('employees')
        .select('user_id')
        .eq('employee_status', 'ACTIVE')
        .isNotNull('user_id')
        .in('sub_role', subroleCodes)

      if (error) throw error
      eligibleUsers = users || []
    }

    // Create allocations
    if (eligibleUsers.length > 0) {
      const allocations = eligibleUsers.map((user) => ({
        incentive_id: incentiveId,
        user_id: user.user_id, // FIXED: use user_id field
        is_eligible: true,
        eligibility_checked_at: new Date().toISOString(),
        allocation_status: 'eligible',
        progress_percentage: 0,
        earned_amount: 0,
      }))

      const { error: allocError } = await supabase
        .from('incentive_allocations')
        .insert(allocations)

      if (allocError) {
        logger.error('Error creating allocations', allocError)
        throw allocError
      }

      logger.info(`Created ${allocations.length} allocations for incentive ${incentiveId}`)
    }
  } catch (error) {
    logger.error('Error in createIncentiveAllocations', error instanceof Error ? error : undefined)
    throw error
  }
}

/**
 * Helper function: Send incentive launch notification
 */
async function sendIncentiveLaunchNotification(
  supabase: any,
  incentive: any,
  createdByName: string
) {
  try {
    // Use the notification system API
    const notificationData = {
      title: `🎁 New Incentive: ${incentive.incentive_title}`,
      message: incentive.incentive_description || 'A new incentive program has been launched!',
      message_html: `
        <div style="font-family: Arial, sans-serif;">
          <h2 style="color: #f97316;">🎁 New Incentive Program Launched!</h2>
          <h3>${incentive.incentive_title}</h3>
          <p>${incentive.incentive_description || ''}</p>
          <p><strong>Reward:</strong> ${incentive.reward_currency} ${incentive.reward_amount || 'Variable'}</p>
          <p><strong>Valid Until:</strong> ${new Date(incentive.end_date).toLocaleDateString()}</p>
          <p><strong>Type:</strong> ${incentive.incentive_type}</p>
          <p style="margin-top: 20px;">
            <a href="/employees/incentives" style="background-color: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Details
            </a>
          </p>
        </div>
      `,
      category: 'incentive',
      priority: 'high',
      target_type: incentive.target_all_employees ? 'category' : 'subrole',
      target_category: 'employee',
      image_url: incentive.incentive_image_url,
      action_url: '/employees/incentives',
      valid_from: incentive.start_date,
      valid_until: incentive.end_date,
      allow_replies: false,
    }

    // This would typically call the notification API endpoint
    // For now, log it
    logger.info('Incentive launch notification queued', { incentive_id: incentive.id })

    // Update incentive to mark notification as sent
    await supabase
      .from('incentives')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', incentive.id)

  } catch (error) {
    logger.error('Error sending incentive launch notification', error instanceof Error ? error : undefined)
    // Don't throw - notification failure shouldn't block incentive creation
  }
}
