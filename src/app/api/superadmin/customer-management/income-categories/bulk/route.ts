import { parseBody } from '@/lib/utils/parse-body'

/**
 * Income Categories Bulk Operations API
 * SuperAdmin endpoint for bulk enable/disable/delete operations
 *
 * POST - Perform bulk operation on selected categories
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
  operation: z.enum(['enable', 'disable', 'delete', 'reorder']),
  category_ids: z.array(z.string().uuid()).min(1),
  reorder_data: z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number(),
  })).optional(),
})

/**
 * POST /api/superadmin/customer-management/income-categories/bulk
 * Perform bulk operation on selected categories
 */
export async function POST(request: NextRequest) {
  try {
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = bulkOperationSchema.parse(body)

    const { operation, category_ids, reorder_data } = validatedData
    const results = {
      success_count: 0,
      failure_count: 0,
      failures: [] as { id: string; error: string }[],
    }

    switch (operation) {
      case 'enable':
      case 'disable':
        // Bulk enable/disable
        for (const id of category_ids) {
          const { error } = await supabaseAdmin
            .from('income_categories')
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
                entity_type: 'INCOME_CATEGORY',
                entity_id: id,
                entity_name: id,
                old_value: { is_active: operation !== 'enable' },
                new_value: { is_active: operation === 'enable' },
                changed_by: auth.userId,
                changed_by_email: auth.email,
              })
          }
        }
        break

      case 'delete':
        // Check for categories with individuals
        const { data: categoriesWithCounts } = await supabaseAdmin
          .from('individuals')
          .select('income_category_id')
          .in('income_category_id', category_ids)

        const categoriesWithIndividuals = new Set(
          categoriesWithCounts?.map(c => c.income_category_id) || []
        )

        for (const id of category_ids) {
          if (categoriesWithIndividuals.has(id)) {
            results.failure_count++
            results.failures.push({
              id,
              error: 'Cannot delete category with associated individuals',
            })
            continue
          }

          // First delete associated profiles
          await supabaseAdmin
            .from('income_profiles')
            .delete()
            .eq('income_category_id', id)

          const { error } = await supabaseAdmin
            .from('income_categories')
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
                entity_type: 'INCOME_CATEGORY',
                entity_id: id,
                entity_name: id,
                old_value: { id },
                new_value: null,
                changed_by: auth.userId,
                changed_by_email: auth.email,
              })
          }
        }
        break

      case 'reorder':
        if (!reorder_data) {
          return NextResponse.json(
            { success: false, error: 'Reorder data required for reorder operation' },
            { status: 400 }
          )
        }

        for (const item of reorder_data) {
          const { error } = await supabaseAdmin
            .from('income_categories')
            .update({
              display_order: item.display_order,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)

          if (error) {
            results.failure_count++
            results.failures.push({ id: item.id, error: 'Operation failed' })
          } else {
            results.success_count++
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
    apiLogger.error('Income Categories Bulk POST error', error)

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
