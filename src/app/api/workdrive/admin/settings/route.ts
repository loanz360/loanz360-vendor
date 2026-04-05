export const dynamic = 'force-dynamic'

/**
 * WorkDrive Admin Settings API
 * GET - Get all settings
 * PUT - Update a setting
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminSettings, updateAdminSetting, isSuperAdmin, isAdmin } from '@/lib/workdrive'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Settings that only Super Admin can modify
const SUPER_ADMIN_ONLY_SETTINGS = [
  'virus_scanning_enabled',
  'session_timeout_minutes',
  'max_failed_login_attempts',
  'audit_log_retention_days',
  'total_org_storage_tb',
]

/**
 * GET /api/workdrive/admin/settings
 * Get all admin settings
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const result = await getAdminSettings()

    if (!result.settings) {
      return NextResponse.json(
        { error: result.error || 'Failed to get settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: result.settings,
    })
  } catch (error) {
    apiLogger.error('Get admin settings error', error)
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/workdrive/admin/settings
 * Update a setting
 */
export async function PUT(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const adminCheck = await isAdmin(user.id)
    if (!adminCheck) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      )
    }

    // Check if setting requires Super Admin
    if (SUPER_ADMIN_ONLY_SETTINGS.includes(key)) {
      const superAdminCheck = await isSuperAdmin(user.id)
      if (!superAdminCheck) {
        return NextResponse.json(
          { error: 'This setting can only be modified by Super Admin' },
          { status: 403 }
        )
      }
    }

    const result = await updateAdminSetting({
      key,
      value,
      updatedBy: user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update setting' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Update admin setting error', error)
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    )
  }
}
