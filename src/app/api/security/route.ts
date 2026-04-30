
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAuditLogs,
  createAuditLog,
  getSecurityAlerts,
  resolveSecurityAlert,
  getRetentionPolicies,
  applyRetentionPolicy,
  exportUserData,
  anonymizeUserData,
  generateComplianceReport,
  maskSensitiveData
} from '@/lib/tickets/security-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/security
 * Get audit logs, security alerts, retention policies, or compliance reports
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'audit_logs'

    // Mode: Get audit logs
    if (mode === 'audit_logs') {
      const action = searchParams.get('action') as any
      const entityType = searchParams.get('entity_type') || undefined
      const entityId = searchParams.get('entity_id') || undefined
      const userId = searchParams.get('user_id') || undefined
      const startDate = searchParams.get('start_date')
        ? new Date(searchParams.get('start_date')!)
        : undefined
      const endDate = searchParams.get('end_date')
        ? new Date(searchParams.get('end_date')!)
        : undefined
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')

      const result = await getAuditLogs({
        action,
        entityType,
        entityId,
        userId,
        startDate,
        endDate,
        limit,
        offset
      })

      return NextResponse.json(result)
    }

    // Mode: Get security alerts
    if (mode === 'alerts') {
      const severity = searchParams.get('severity') || undefined
      const type = searchParams.get('type') || undefined
      const resolved = searchParams.get('resolved') === 'true' ? true :
                       searchParams.get('resolved') === 'false' ? false : undefined
      const limit = parseInt(searchParams.get('limit') || '50')

      const alerts = await getSecurityAlerts({
        severity,
        type,
        resolved,
        limit
      })

      return NextResponse.json({ alerts })
    }

    // Mode: Get retention policies
    if (mode === 'retention') {
      const policies = await getRetentionPolicies()
      return NextResponse.json({ policies })
    }

    // Mode: Generate compliance report
    if (mode === 'compliance') {
      const days = parseInt(searchParams.get('days') || '30')
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const report = await generateComplianceReport(startDate, endDate)
      return NextResponse.json({ report })
    }

    // Mode: Get privacy settings
    if (mode === 'privacy') {
      const { data: settings } = await supabase
        .from('privacy_settings')
        .select('*')
        .maybeSingle()

      return NextResponse.json({
        settings: settings || {
          data_masking_enabled: true,
          masked_fields: ['email', 'phone', 'pan', 'aadhaar'],
          anonymization_enabled: true,
          consent_required: true,
          gdpr_compliant: true,
          data_export_enabled: true,
          right_to_delete_enabled: true
        }
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Security API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/security
 * Create audit logs, export data, or run retention policies
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Action: Create audit log
    if (action === 'log') {
      const { log_action, entity_type, entity_id, details, changes } = body

      if (!log_action || !entity_type) {
        return NextResponse.json(
          { error: 'log_action and entity_type required' },
          { status: 400 }
        )
      }

      // Get user details
      const { data: employee } = await supabase
        .from('employees')
        .select('name, email, role')
        .eq('id', user.id)
        .maybeSingle()

      const success = await createAuditLog({
        action: log_action,
        entity_type,
        entity_id,
        user_id: user.id,
        user_email: employee?.email || user.email,
        user_name: employee?.name,
        user_role: employee?.role,
        details: details || {},
        changes
      })

      return NextResponse.json({ success })
    }

    // Action: Export user data (GDPR)
    if (action === 'export_data') {
      const { target_user_id } = body

      if (!target_user_id) {
        return NextResponse.json({ success: false, error: 'target_user_id required' }, { status: 400 })
      }

      const data = await exportUserData(target_user_id)
      return NextResponse.json({ data, success: true })
    }

    // Action: Anonymize user data
    if (action === 'anonymize_data') {
      const { target_user_id, reason } = body

      if (!target_user_id) {
        return NextResponse.json({ success: false, error: 'target_user_id required' }, { status: 400 })
      }

      // Log this sensitive action
      await createAuditLog({
        action: 'data_deleted',
        entity_type: 'user',
        entity_id: target_user_id,
        user_id: user.id,
        details: { reason, initiated_by: user.id }
      })

      const success = await anonymizeUserData(target_user_id)
      return NextResponse.json({ success })
    }

    // Action: Run retention policy
    if (action === 'run_retention') {
      const { policy_id } = body

      if (!policy_id) {
        return NextResponse.json({ success: false, error: 'policy_id required' }, { status: 400 })
      }

      const result = await applyRetentionPolicy(policy_id)
      return NextResponse.json(result)
    }

    // Action: Mask sensitive data
    if (action === 'mask_data') {
      const { data, fields } = body

      if (!data || !fields) {
        return NextResponse.json({ success: false, error: 'data and fields required' }, { status: 400 })
      }

      const masked = maskSensitiveData(data, fields)
      return NextResponse.json({ masked })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Security API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/security
 * Resolve alerts or update settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Action: Resolve security alert
    if (action === 'resolve_alert') {
      const { alert_id } = body

      if (!alert_id) {
        return NextResponse.json({ success: false, error: 'alert_id required' }, { status: 400 })
      }

      const success = await resolveSecurityAlert(alert_id, user.id)
      return NextResponse.json({ success })
    }

    // Action: Update privacy settings
    if (action === 'update_privacy') {
      const { settings } = body

      if (!settings) {
        return NextResponse.json({ success: false, error: 'settings required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('privacy_settings')
        .upsert({
          id: 'default',
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 })
      }

      // Log settings change
      await createAuditLog({
        action: 'settings_changed',
        entity_type: 'settings',
        entity_id: 'privacy',
        user_id: user.id,
        details: { new_settings: settings }
      })

      return NextResponse.json({ settings: data })
    }

    // Action: Update retention policy
    if (action === 'update_retention') {
      const { policy_id, ...updates } = body

      if (!policy_id) {
        return NextResponse.json({ success: false, error: 'policy_id required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('data_retention_policies')
        .update(updates)
        .eq('id', policy_id)
        .select()
        .maybeSingle()

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to update policy' }, { status: 500 })
      }

      return NextResponse.json({ policy: data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Security API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
