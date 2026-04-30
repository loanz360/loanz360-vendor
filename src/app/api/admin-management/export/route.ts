import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { z } from 'zod'

/**
 * POST /api/admin-management/export
 * Export admin records with filtering
 *
 * Features:
 * - Filter by role, department, status
 * - Configurable column selection
 * - Pagination support for large exports
 * - Exclude deleted records by default
 */

const exportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  includeIds: z.boolean().optional().default(false),
  includeDates: z.boolean().optional().default(true),
  includeDeletedRecords: z.boolean().optional().default(false),
  filters: z
    .object({
      role: z.array(z.string()).optional(),
      department: z.array(z.string()).optional(),
      status: z.array(z.string()).optional(),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validation = exportRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { includeDeletedRecords, filters } = validation.data

    // Build query
    let query = supabase
      .from('admins')
      .select(
        `
        id,
        admin_unique_id,
        full_name,
        email,
        phone,
        role,
        department,
        designation,
        is_active,
        created_at,
        updated_at,
        last_login
      `
      )
      .order('created_at', { ascending: false })

    // Apply filters
    if (!includeDeletedRecords) {
      query = query.eq('is_deleted', false)
    }

    if (filters?.role && filters.role.length > 0) {
      query = query.in('role', filters.role)
    }

    if (filters?.department && filters.department.length > 0) {
      query = query.in('department', filters.department)
    }

    if (filters?.status && filters.status.length > 0) {
      const statusValues = filters.status.map((s) => s === 'active')
      query = query.in('is_active', statusValues)
    }

    // Execute query
    const { data: admins, error } = await query

    if (error) {
      throw error
    }

    // Return data (client will handle CSV/Excel generation)
    return NextResponse.json(admins || [], { status: 200 })
  } catch (error) {
    return handleApiError(error, 'admin export')
  }
}
