import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/accounts-executive/cp-applications/checklist
 * Get verification checklist for an application
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')
    const appId = searchParams.get('appId')

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: 'Application ID is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is Accounts Executive/Manager or Super Admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only Accounts team can access this resource.' },
        { status: 403 }
      )
    }

    // Get checklist items
    let { data: checklist, error: checklistError } = await supabase
      .from('cp_application_verification')
      .select(`
        id,
        condition_id,
        condition_text,
        is_verified,
        verified_at,
        verification_notes
      `)
      .eq('application_id', applicationId)
      .eq('verification_stage', 'ACCOUNTS')
      .order('created_at', { ascending: true })

    if (checklistError) {
      logger.error('Error fetching checklist:', { error: checklistError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch checklist' },
        { status: 500 }
      )
    }

    // If no checklist exists, initialize it (only once — use advisory lock pattern)
    if (!checklist || checklist.length === 0) {
      // Double-check: re-query to prevent race condition between concurrent requests
      const { data: recheck } = await supabase
        .from('cp_application_verification')
        .select('id')
        .eq('application_id', applicationId)
        .eq('verification_stage', 'ACCOUNTS')
        .limit(1)

      if (recheck && recheck.length > 0) {
        // Another request already created the checklist — re-fetch full data
        const { data: refetched } = await supabase
          .from('cp_application_verification')
          .select('id, condition_id, condition_text, is_verified, verified_at, verification_notes')
          .eq('application_id', applicationId)
          .eq('verification_stage', 'ACCOUNTS')
          .order('created_at', { ascending: true })

        checklist = refetched || []
      } else {
        // Determine checklist items from payout_conditions or defaults
        let checklistItems: Array<{
          application_id: string
          app_id: string | null
          verification_stage: string
          condition_id?: string
          condition_text: string
          is_verified: boolean
        }> = []

        // Try loading from payout_conditions table
        const { data: conditions, error: condError } = await supabase
          .from('payout_conditions')
          .select('id, condition_text')
          .eq('is_active', true)
          .contains('applies_to', ['CP'])

        if (!condError && conditions && conditions.length > 0) {
          checklistItems = conditions.map(cond => ({
            application_id: applicationId,
            app_id: appId,
            verification_stage: 'ACCOUNTS',
            condition_id: cond.id,
            condition_text: cond.condition_text,
            is_verified: false,
          }))
          logger.info('CP checklist: using payout_conditions table', { applicationId, count: conditions.length })
        } else {
          // Fallback to default conditions
          const defaultConditions = [
            'Loan disbursement verified with bank statement/sanction letter',
            'Customer details match with bank records',
            'Loan amount and type verified correctly',
            'Channel Partner is active and in good standing',
            'No duplicate application exists in the system',
            'Commission percentage matches the payout grid',
          ]
          checklistItems = defaultConditions.map(text => ({
            application_id: applicationId,
            app_id: appId,
            verification_stage: 'ACCOUNTS',
            condition_text: text,
            is_verified: false,
          }))
          if (condError) {
            logger.warn('CP checklist: payout_conditions query failed, using defaults', { applicationId, error: condError.message })
          } else {
            logger.info('CP checklist: no active conditions for CP, using defaults', { applicationId })
          }
        }

        // Insert checklist items
        const { data: insertedItems, error: insertError } = await supabase
          .from('cp_application_verification')
          .insert(checklistItems)
          .select()

        if (insertError) {
          logger.error('Error creating checklist:', { error: insertError, applicationId })
          // Final fallback: try fetching again in case concurrent insert succeeded
          const { data: fallbackFetch } = await supabase
            .from('cp_application_verification')
            .select('id, condition_id, condition_text, is_verified, verified_at, verification_notes')
            .eq('application_id', applicationId)
            .eq('verification_stage', 'ACCOUNTS')
            .order('created_at', { ascending: true })
          checklist = fallbackFetch || []
        } else {
          checklist = insertedItems || []
        }
      }
    }

    return NextResponse.json({
      success: true,
      checklist: checklist || [],
    })
  } catch (error) {
    logger.error('Error in checklist API:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/accounts-executive/cp-applications/checklist
 * Update a verification checklist item
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()
    const { verificationId, isVerified, notes } = body

    if (!verificationId) {
      return NextResponse.json(
        { success: false, error: 'Verification ID is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is Accounts Executive/Manager or Super Admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only Accounts team can update verifications.' },
        { status: 403 }
      )
    }

    // Update verification item
    const updateData: Record<string, any> = {
      is_verified: isVerified,
      verified_by: isVerified ? user.id : null,
      verified_at: isVerified ? new Date().toISOString() : null,
    }

    if (notes !== undefined) {
      updateData.verification_notes = notes
    }

    const { error: updateError } = await supabase
      .from('cp_application_verification')
      .update(updateData)
      .eq('id', verificationId)

    if (updateError) {
      logger.error('Error updating verification item:', { error: updateError })
      return NextResponse.json(
        { success: false, error: 'Failed to update verification' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification updated',
    })
  } catch (error) {
    logger.error('Error updating checklist:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
