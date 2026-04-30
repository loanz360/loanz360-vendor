import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Income Profiles Bulk Operations API
 * SuperAdmin endpoint for bulk enable/disable/delete operations
 *
 * POST - Perform bulk operation on selected profiles
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const bulkOperationSchema = z.object({
  operation: z.enum(['enable', 'disable', 'delete', 'move_category']),
  profile_ids: z.array(z.string().uuid()).min(1),
  target_category_id: z.string().uuid().optional(),
})

/**
 * POST /api/superadmin/customer-management/income-profiles/bulk
 * Perform bulk operation on selected profiles
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = bulkOperationSchema.parse(body)

    const { operation, profile_ids, target_category_id } = validatedData
    const results = {
      success_count: 0,
      failure_count: 0,
      failures: [] as { id: string; error: string }[],
    }

    switch (operation) {
      case 'enable':
      case 'disable':
        // Bulk enable/disable
        for (const id of profile_ids) {
          const { data: profile } = await supabaseAdmin
            .from('income_profiles')
            .select('name')
            .eq('id', id)
            .maybeSingle()

          const { error } = await supabaseAdmin
            .from('income_profiles')
            .update({
              is_active: operation === 'enable',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (error) {
            results.failure_count++
            results.failures.push({ id, error: 'Operation failed' })
          } else {
            results.success_count++

            // Log to audit
            await supabaseAdmin
              .from('config_audit_log')
              .insert({
                action: operation === 'enable' ? 'ENABLE' : 'DISABLE',
                entity_type: 'INCOME_PROFILE',
                entity_id: id,
                entity_name: profile?.name || id,
                old_value: { is_active: operation !== 'enable' },
                new_value: { is_active: operation === 'enable' },
                changed_by: auth.userId,
                changed_by_email: auth.email,
              })
          }
        }
        break

      case 'delete':
        // Check for profiles with individuals
        const { data: profilesWithCounts } = await supabaseAdmin
          .from('individuals')
          .select('income_profile_id')
          .in('income_profile_id', profile_ids)

        const profilesWithIndividuals = new Set(
          profilesWithCounts?.map(p => p.income_profile_id) || []
        )

        for (const id of profile_ids) {
          if (profilesWithIndividuals.has(id)) {
            results.failure_count++
            results.failures.push({
              id,
              error: 'Cannot delete profile with associated individuals',
            })
            continue
          }

          const { data: profile } = await supabaseAdmin
            .from('income_profiles')
            .select('name')
            .eq('id', id)
            .maybeSingle()

          const { error } = await supabaseAdmin
            .from('income_profiles')
            .delete()
            .eq('id', id)

          if (error) {
            results.failure_count++
            results.failures.push({ id, error: 'Operation failed' })
          } else {
            results.success_count++

            // Log to audit
            await supabaseAdmin
              .from('config_audit_log')
              .insert({
                action: 'DELETE',
                entity_type: 'INCOME_PROFILE',
                entity_id: id,
                entity_name: profile?.name || id,
                old_value: { id },
                new_value: null,
                changed_by: auth.userId,
                changed_by_email: auth.email,
              })
          }
        }
        break

      case 'move_category':
        if (!target_category_id) {
          return NextResponse.json(
            { success: false, error: 'Target category required for move operation' },
            { status: 400 }
          )
        }

        // Verify target category exists
        const { data: targetCategory } = await supabaseAdmin
          .from('income_categories')
          .select('id, name')
          .eq('id', target_category_id)
          .maybeSingle()

        if (!targetCategory) {
          return NextResponse.json(
            { success: false, error: 'Target category not found' },
            { status: 404 }
          )
        }

        for (const id of profile_ids) {
          const { data: profile } = await supabaseAdmin
            .from('income_profiles')
            .select('name, income_category_id')
            .eq('id', id)
            .maybeSingle()

          const { error } = await supabaseAdmin
            .from('income_profiles')
            .update({
              income_category_id: target_category_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (error) {
            results.failure_count++
            results.failures.push({ id, error: 'Operation failed' })
          } else {
            results.success_count++

            // Log to audit
            await supabaseAdmin
              .from('config_audit_log')
              .insert({
                action: 'UPDATE',
                entity_type: 'INCOME_PROFILE',
                entity_id: id,
                entity_name: profile?.name || id,
                old_value: { income_category_id: profile?.income_category_id },
                new_value: { income_category_id: target_category_id },
                changed_by: auth.userId,
                changed_by_email: auth.email,
              })
          }
        }
        break
    }

    return NextResponse.json({
      success: true,
      operation,
      results,
      message: `Bulk ${operation} completed: ${results.success_count} succeeded, ${results.failure_count} failed`,
    })

  } catch (error) {
    apiLogger.error('Income Profiles Bulk POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
