export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { SubUserRole, SubUserStatus, CPSubUserForm, SUBUSER_ROLE_PERMISSIONS, CPPermission } from '@/types/cp-profile'

const MAX_SUB_USERS = 5

/** Row shape for cp_sub_users table */
interface SubUserRow {
  id: string
  full_name: string
  email: string
  mobile: string | null
  role: string
  permissions: string | string[] | null
  status: string
  invited_at: string | null
  accepted_at: string | null
  last_login_at: string | null
  created_at: string
}

/**
 * GET /api/partners/cp/sub-users
 * Fetches all sub-users for the authenticated CP
 *
 * CP-exclusive feature:
 * - CPs can create sub-users with specific roles
 * - Roles: FINANCE, COMPLIANCE, OPERATIONS, VIEWER
 * - Each role has predefined permissions
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Fetch sub-users
    const { data: subUsers, error } = await supabase
      .from('cp_sub_users')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching sub-users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sub-users' },
        { status: 500 }
      )
    }

    // Parse JSON arrays
    const parseJsonArray = (field: unknown): unknown[] => {
      if (!field) return []
      if (Array.isArray(field)) return field
      if (typeof field !== 'string') return []
      try {
        return JSON.parse(field)
      } catch {
        return []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sub_users: (subUsers || []).map((su: SubUserRow) => ({
          id: su.id,
          full_name: su.full_name,
          email: su.email,
          mobile: su.mobile,
          role: su.role as SubUserRole,
          permissions: parseJsonArray(su.permissions),
          status: su.status as SubUserStatus,
          invited_at: su.invited_at,
          accepted_at: su.accepted_at,
          last_login_at: su.last_login_at,
          created_at: su.created_at
        })),
        max_sub_users: 5,
        available_slots: Math.max(0, 5 - (subUsers || []).length),
        role_definitions: {
          FINANCE: {
            label: 'Finance',
            description: 'Access to payout information, commission details, and financial reports',
            permissions: [
              'cp.profile.view',
              'cp.lender.view',
              'cp.lender.view_payout',
              'cp.disbursement.view',
              'cp.payout.view',
              'cp.payout.view_detailed',
              'cp.payout.raise_dispute',
              'cp.document.view',
              'cp.audit.view',
              'cp.audit.export'
            ]
          },
          COMPLIANCE: {
            label: 'Compliance',
            description: 'Access to compliance documents, KYC status, and audit reports',
            permissions: [
              'cp.profile.view',
              'cp.lender.view',
              'cp.disbursement.view',
              'cp.document.view',
              'cp.document.upload',
              'cp.audit.view',
              'cp.audit.export',
              'cp.compliance.report'
            ]
          },
          OPERATIONS: {
            label: 'Operations',
            description: 'Can submit disbursements, upload files, and view operational data',
            permissions: [
              'cp.profile.view',
              'cp.lender.view',
              'cp.disbursement.view',
              'cp.disbursement.submit',
              'cp.disbursement.bulk_upload',
              'cp.document.view',
              'cp.audit.view'
            ]
          },
          VIEWER: {
            label: 'Viewer',
            description: 'Read-only access to profile, disbursements, and documents',
            permissions: [
              'cp.profile.view',
              'cp.lender.view',
              'cp.disbursement.view',
              'cp.document.view',
              'cp.audit.view'
            ]
          }
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/sub-users:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/partners/cp/sub-users
 * Invite a new sub-user
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Check sub-user limit
    const { count: existingCount } = await supabase
      .from('cp_sub_users')
      .select('id', { count: 'exact' })
      .eq('partner_id', partner.id)

    if ((existingCount || 0) >= MAX_SUB_USERS) {
      return NextResponse.json(
        { success: false, error: `Maximum sub-user limit (${MAX_SUB_USERS}) reached` },
        { status: 400 }
      )
    }

    // Parse request body
    const body: CPSubUserForm = await request.json()

    // Validate required fields
    const validationErrors: string[] = []
    if (!body.full_name || body.full_name.trim().length < 2) {
      validationErrors.push('Full name is required (minimum 2 characters)')
    }
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      validationErrors.push('Valid email is required')
    }
    if (!body.role || !['FINANCE', 'COMPLIANCE', 'OPERATIONS', 'VIEWER'].includes(body.role)) {
      validationErrors.push('Valid role is required (FINANCE, COMPLIANCE, OPERATIONS, VIEWER)')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', validation_errors: validationErrors },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('cp_sub_users')
      .select('id')
      .eq('partner_id', partner.id)
      .eq('email', body.email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A sub-user with this email already exists' },
        { status: 409 }
      )
    }

    // Get role permissions
    const rolePermissions = getRolePermissions(body.role)

    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Generate invitation token
    const inviteToken = generateInviteToken()

    // Create sub-user record
    const { data: subUser, error: insertError } = await supabase
      .from('cp_sub_users')
      .insert({
        partner_id: partner.id,
        full_name: body.full_name.trim(),
        email: body.email.toLowerCase().trim(),
        mobile: body.mobile?.trim() || null,
        role: body.role,
        permissions: JSON.stringify(body.permissions?.length ? body.permissions : rolePermissions),
        status: 'INACTIVE',
        invite_token: inviteToken,
        invited_at: new Date().toISOString(),
        invited_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating sub-user:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create sub-user' },
        { status: 500 }
      )
    }

    // Log audit entry
    await supabase.from('cp_audit_logs').insert({
      partner_id: partner.id,
      action_type: 'SUBUSER_ADD',
      action_description: `Invited sub-user ${body.email} with role ${body.role}`,
      section: 'access-control',
      changed_by: user.id,
      source: 'WEB',
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    })

    // TODO: Send invitation email (would integrate with email service)

    return NextResponse.json({
      success: true,
      message: 'Sub-user invitation sent successfully',
      data: {
        id: subUser.id,
        email: subUser.email,
        role: subUser.role,
        status: subUser.status
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/partners/cp/sub-users:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get default permissions for a role
 */
function getRolePermissions(role: SubUserRole): string[] {
  const permissionMap: Record<SubUserRole, string[]> = {
    FINANCE: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.lender.view_payout',
      'cp.disbursement.view',
      'cp.payout.view',
      'cp.payout.view_detailed',
      'cp.payout.raise_dispute',
      'cp.document.view',
      'cp.audit.view',
      'cp.audit.export'
    ],
    COMPLIANCE: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.disbursement.view',
      'cp.document.view',
      'cp.document.upload',
      'cp.audit.view',
      'cp.audit.export',
      'cp.compliance.report'
    ],
    OPERATIONS: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.disbursement.view',
      'cp.disbursement.submit',
      'cp.disbursement.bulk_upload',
      'cp.document.view',
      'cp.audit.view'
    ],
    VIEWER: [
      'cp.profile.view',
      'cp.lender.view',
      'cp.disbursement.view',
      'cp.document.view',
      'cp.audit.view'
    ]
  }

  return permissionMap[role] || []
}

/**
 * Generate secure invite token
 */
function generateInviteToken(): string {
  const { randomBytes } = require('crypto')
  return randomBytes(32).toString('hex')
}
