import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  queryParamsSchema,
  createAdminSchema,
  formatValidationErrors,
} from '@/lib/validation/admin-validation'
import {
  ValidationError,
  ConflictError,
  DatabaseError,
  handleApiError,
  parseSupabaseError,
} from '@/lib/errors/api-errors'
import {
  withIdempotency,
  generateIdempotencyKey,
  withRetry,
} from '@/lib/database/transaction-helper'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

/**
 * GET /api/admin-management
 * List all admins with filtering, sorting, and pagination
 *
 * Security: Input validation with Zod, XSS prevention, SQL injection protection via Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Validate and sanitize query parameters
    const validationResult = queryParamsSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      location: searchParams.get('location'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    })

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      )
    }

    const { page, limit, status, search, location, sortBy, sortOrder } = validationResult.data

    // Calculate offset
    const offset = (page - 1) * limit

    // Build query with parameterized inputs (prevents SQL injection)
    let query = supabase
      .from('admins')
      .select('*, user_id, created_by, updated_by', { count: 'exact' })
      .eq('is_deleted', false)

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) {
        query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,mobile_number.ilike.%${safeSearch}%,admin_unique_id.ilike.%${safeSearch}%`)
      }
    }

    if (location) {
      const safeLocation = sanitizeSearchInput(location)
      if (safeLocation) {
        query = query.ilike('location', `%${safeLocation}%`)
      }
    }

    // Apply sorting (validated enum prevents SQL injection)
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: admins, error, count } = await query

    if (error) {
      throw parseSupabaseError(error)
    }

    // Get module permissions for each admin
    const adminIds = admins?.map((a) => a.id) || []
    const { data: permissions, error: permissionsError } = await supabase
      .from('admin_module_permissions')
      .select('admin_id, module_key, is_enabled')
      .in('admin_id', adminIds)

    if (permissionsError) {
      apiLogger.error('[Admin Management API] Error fetching permissions', permissionsError)
      // Non-critical error - continue with empty permissions
    }

    // Organize permissions by admin_id
    const permissionsMap = new Map()
    permissions?.forEach((p) => {
      if (!permissionsMap.has(p.admin_id)) {
        permissionsMap.set(p.admin_id, [])
      }
      permissionsMap.get(p.admin_id).push(p)
    })

    // Attach permissions to admins
    const adminsWithPermissions = admins?.map((admin) => ({
      ...admin,
      permissions: permissionsMap.get(admin.id) || [],
      enabled_modules_count:
        permissionsMap.get(admin.id)?.filter((p: any) => p.is_enabled).length || 0,
    }))

    return NextResponse.json({
      success: true,
      data: adminsWithPermissions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error fetching admins', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}

/**
 * POST /api/admin-management
 * Create a new admin
 *
 * Security: Zod validation, XSS sanitization, duplicate email check, audit logging
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate and sanitize input
    const validationResult = createAdminSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      )
    }

    const {
      full_name,
      email,
      mobile_number,
      present_address,
      permanent_address,
      location,
      profile_picture_url,
      notes,
      created_by_user_id,
    } = validationResult.data

    // Generate idempotency key to prevent duplicate admin creation
    const idempotencyKey = generateIdempotencyKey(
      'create_admin',
      created_by_user_id || 'system',
      { email, full_name, mobile_number }
    )

    // Wrap admin creation in idempotency and retry logic
    const newAdmin = await withIdempotency(idempotencyKey, async () => {
      return await withRetry(
        async () => {
          // Check if email already exists (case-insensitive)
          const { data: existingAdmin, error: checkError } = await supabase
            .from('admins')
            .select('id')
            .ilike('email', email)
            .eq('is_deleted', false)
            .maybeSingle()

          if (checkError) {
            throw parseSupabaseError(checkError)
          }

          if (existingAdmin) {
            throw new ConflictError('Admin with this email already exists', {
              email,
              existingAdminId: existingAdmin.id,
            })
          }

          // Generate unique admin ID
          const { data: uniqueIdData, error: rpcError } = await supabase.rpc(
            'generate_admin_unique_id'
          )

          if (rpcError) {
            apiLogger.error('[Admin Management API] Error generating admin ID', rpcError)
            // Fallback to timestamp-based ID
          }

          const admin_unique_id = uniqueIdData || `AD${Date.now()}`

          // Create admin with sanitized data
          const { data: newAdmin, error: createError } = await supabase
            .from('admins')
            .insert({
              admin_unique_id,
              full_name,
              email,
              mobile_number,
              present_address,
              permanent_address,
              location,
              profile_picture_url,
              notes,
              status: 'enabled',
              created_by: created_by_user_id,
            })
            .select()
            .maybeSingle()

          if (createError) {
            throw parseSupabaseError(createError)
          }

          return newAdmin
        },
        { maxRetries: 3, retryDelay: 1000 }
      )
    })

    // Create audit log (non-critical - don't fail if it errors)
    const { error: auditError } = await supabase.rpc('create_admin_audit_log', {
      p_admin_id: newAdmin.id,
      p_action_type: 'created',
      p_action_description: `Admin ${full_name} (${admin_unique_id}) was created`,
      p_changes: JSON.stringify({ admin: newAdmin }),
      p_performed_by: created_by_user_id,
      p_ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown',
    })

    if (auditError) {
      apiLogger.error('[Admin Management API] Error creating audit log', auditError)
      // Continue anyway - audit log is non-critical
    }

    return NextResponse.json(
      {
        success: true,
        data: newAdmin,
        message: `Admin ${admin_unique_id} created successfully`,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error creating admin', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}
