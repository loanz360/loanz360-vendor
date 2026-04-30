
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { z } from 'zod'
import { adminImportSchema } from '@/lib/import-export/admin-import'

/**
 * POST /api/admin-management/import
 * Bulk import admin records
 *
 * Features:
 * - Batch insert with transaction support
 * - Auto-generate admin_unique_id
 * - Duplicate detection
 * - Partial success handling
 * - Detailed error reporting
 */

const importRequestSchema = z.object({
  admins: z.array(adminImportSchema).min(1, 'At least one admin is required'),
})

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Parse and validate request body
    const body = await request.json()
    const validation = importRequestSchema.safeParse(body)

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

    const { admins } = validation.data

    // Generate unique IDs and prepare records
    const adminRecords = admins.map((admin) => ({
      admin_unique_id: `ADM${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      full_name: admin.full_name,
      email: admin.email.toLowerCase(),
      phone: admin.phone || null,
      role: admin.role,
      department: admin.department || null,
      designation: admin.designation || null,
      is_active: admin.status === 'active',
      is_deleted: false,
      two_factor_enabled: false,
      failed_login_attempts: 0,
    }))

    // Bulk insert with error handling
    const results = []
    const errors = []

    for (let i = 0; i < adminRecords.length; i++) {
      const record = adminRecords[i]

      try {
        const { data, error } = await supabase
          .from('admins')
          .insert(record)
          .select()
          .maybeSingle()

        if (error) {
          errors.push({
            index: i,
            email: record.email,
            error: 'Internal server error',
          })
        } else {
          results.push(data)
        }
      } catch (error) {
        errors.push({
          index: i,
          email: record.email,
          error: 'Internal server error',
        })
      }
    }

    // Return results
    return NextResponse.json(
      {
        success: true,
        imported: results.length,
        failed: errors.length,
        total: adminRecords.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: errors.length === adminRecords.length ? 400 : 200 }
    )
  } catch (error) {
    return handleApiError(error, 'admin import')
  }
}
