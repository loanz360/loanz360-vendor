/**
 * API Route: ULI Environment Configuration
 * GET   /api/superadmin/uli-hub/environment  — Get current config
 * PATCH /api/superadmin/uli-hub/environment  — Update config
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// GET — Get environment configuration (single-row table)
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('uli_environment_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) throw error

    // Mask sensitive fields before returning
    const masked = {
      ...data,
      sandbox_client_secret_encrypted: data.sandbox_client_secret_encrypted ? '••••••••' : null,
      sandbox_jwt_token: data.sandbox_jwt_token ? '••••••••' : null,
      production_client_secret_encrypted: data.production_client_secret_encrypted ? '••••••••' : null,
      production_jwt_token: data.production_jwt_token ? '••••••••' : null,
    }

    return NextResponse.json({ success: true, data: masked })
  } catch (error) {
    apiLogger.error('ULI environment config error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ULI environment config' },
      { status: 500 }
    )
  }
}

// PATCH — Update environment configuration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    // First get the existing row ID
    const { data: existing, error: fetchError } = await supabase
      .from('uli_environment_config')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (fetchError) throw fetchError

    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'active_environment',
      'sandbox_base_url', 'sandbox_client_id', 'sandbox_client_secret_encrypted',
      'sandbox_jwt_token', 'sandbox_jwt_expires_at',
      'production_base_url', 'production_client_id', 'production_client_secret_encrypted',
      'production_jwt_token', 'production_jwt_expires_at',
      'default_timeout_ms', 'default_retry_count',
      'enable_request_logging', 'enable_cost_tracking',
      'monthly_budget_limit', 'alert_threshold_percentage',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Skip masked values (don't overwrite with bullet chars)
        if (typeof body[field] === 'string' && body[field] === '••••••••') continue
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('uli_environment_config')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .maybeSingle()

    if (error) throw error

    // Mask sensitive fields
    const masked = {
      ...data,
      sandbox_client_secret_encrypted: data.sandbox_client_secret_encrypted ? '••••••••' : null,
      sandbox_jwt_token: data.sandbox_jwt_token ? '••••••••' : null,
      production_client_secret_encrypted: data.production_client_secret_encrypted ? '••••••••' : null,
      production_jwt_token: data.production_jwt_token ? '••••••••' : null,
    }

    return NextResponse.json({ success: true, data: masked })
  } catch (error) {
    apiLogger.error('ULI environment update error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update ULI environment config' },
      { status: 500 }
    )
  }
}
