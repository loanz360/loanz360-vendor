import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { paginationQuerySchema, updateEmployeeSchema, createEmployeeSchema } from '@/lib/validations/hr-schemas'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

interface EmployeeRow {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: string
  subrole: string | null
  department: string | null
  designation: string | null
  date_of_joining: string | null
  status: string
  city: string | null
  state: string | null
  profile_photo_url: string | null
  created_at: string
}

interface BgvRow {
  employee_id: string
  overall_status: string
  created_at: string
}

// Helper function to check if user is HR or Super Admin
async function isHROrAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { checkHRAccess } = await import('@/lib/auth/hr-access')
  return checkHRAccess(supabase)
}

// Use shared sanitizeSearchInput from @/lib/validations/input-sanitization
// which properly escapes SQL LIKE pattern chars instead of stripping them
const sanitizeSearchTerm = sanitizeSearchInput

/**
 * GET /api/hr/employees
 * Get all employees with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient();
    const adminClient = createSupabaseAdmin()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is HR or Admin
    const hasAccess = await isHROrAdmin(supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      );
    }

    // Get and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = paginationQuerySchema.safeParse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '12',
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { page, limit, search, status } = queryParams.data;
    const department = searchParams.get('department') || '';
    const role = searchParams.get('role') || '';

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query
    let query = adminClient
      .from('employee_profile')
      .select('*', { count: 'exact' });

    // Apply search filter (sanitized to prevent injection)
    if (search) {
      const safe = sanitizeSearchTerm(search)
      if (safe) {
        query = query.or(
          `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,employee_id.ilike.%${safe}%`
        );
      }
    }

    // Apply department filter
    if (department) {
      query = query.eq('department', department);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply role filter
    if (role) {
      query = query.eq('role', role);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: employees, error, count } = await query;

    if (error) {
      apiLogger.error('Error fetching employees', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch employees' },
        { status: 500 }
      );
    }

    // Fetch latest BGV status for each employee
    let bgvMap: Record<string, string> = {};
    if (employees && employees.length > 0) {
      const employeeIds = (employees as EmployeeRow[]).map((e) => e.id).filter(Boolean);
      try {
        const { data: bgvData } = await adminClient
          .from('bgv_requests')
          .select('employee_id, overall_status, created_at')
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false });
        if (bgvData) {
          (bgvData as BgvRow[]).forEach((b) => {
            if (!bgvMap[b.employee_id]) bgvMap[b.employee_id] = b.overall_status;
          });
        }
      } catch { /* bgv table may not exist yet, ignore */ }
    }

    // Strip sensitive fields (password) from response and enrich with BGV status
    const enriched = (employees || []).map((e: unknown) => {
      const { password, ...safeEmployee } = e;
      return {
        ...safeEmployee,
        bgv_status: bgvMap[e.id] || null
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Unexpected error', { errorId, error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hr/employees
 * Create a new employee
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient();
    const adminClient = createSupabaseAdmin()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is HR or Admin
    const hasAccess = await isHROrAdmin(supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: HR access required' },
        { status: 403 }
      );
    }

    const bodySchema = z.object({


      id: z.string().uuid().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;

    // Validate and whitelist fields to prevent mass assignment
    const validated = createEmployeeSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: validated.error.errors },
        { status: 400 }
      );
    }
    const cleanBody = validated.data;

    // Retry loop to handle race condition in employee ID generation
    const MAX_RETRIES = 3;
    let newEmployee = null;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Get the max employee ID efficiently by sorting descending and taking just 1 row
      // We fetch a small set and extract numeric max to avoid lexicographic ordering bugs
      // e.g. 'EMP9' > 'EMP10' lexicographically, so we extract the number
      const { data: maxResult } = await adminClient
        .from('employee_profile')
        .select('employee_id')
        .like('employee_id', 'EMP%')
        .order('employee_id', { ascending: false })
        .limit(1);

      let newEmployeeId = 'EMP001';
      if (maxResult && maxResult.length > 0) {
        // Extract numeric part from the highest employee_id
        const maxNum = parseInt((maxResult[0].employee_id || '').replace('EMP', ''), 10);
        if (!isNaN(maxNum) && maxNum > 0) {
          // Add attempt offset to avoid repeated collisions
          newEmployeeId = `EMP${String(maxNum + 1 + attempt).padStart(3, '0')}`;
        }
      }

      // Insert new employee with whitelisted fields only
      const { data: inserted, error: insertError } = await adminClient
        .from('employee_profile')
        .insert({
          ...cleanBody,
          employee_id: newEmployeeId,
          status: cleanBody.employee_status || 'active'
        })
        .select()
        .maybeSingle();

      if (!insertError) {
        newEmployee = inserted;
        break;
      }

      // If it's a unique constraint violation on employee_id, retry
      const isDuplicate = insertError.code === '23505' &&
        (insertError.message?.includes('employee_id') || insertError.details?.includes('employee_id'));

      if (!isDuplicate) {
        // Non-duplicate error, don't retry
        apiLogger.error('Error creating employee', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to create employee' },
          { status: 500 }
        );
      }

      lastError = insertError;
      apiLogger.warn(`Employee ID collision on attempt ${attempt + 1}, retrying...`);
    }

    if (!newEmployee) {
      apiLogger.error('Failed to generate unique employee ID after retries', lastError);
      return NextResponse.json(
        { success: false, error: 'Failed to create employee: could not generate unique ID' },
        { status: 500 }
      );
    }

    // Strip sensitive fields from response
    const { password: _pw, ...safeNewEmployee } = newEmployee as unknown;

    return NextResponse.json({
      success: true,
      message: 'Employee created successfully',
      data: safeNewEmployee
    }, { status: 201 });
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Unexpected error in POST', { errorId, error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr/employees
 * Update an employee by id (passed in body)
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient();
    const adminClient = createSupabaseAdmin()

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await isHROrAdmin(supabase);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 });
    }

    const bodySchema2 = z.object({


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { id, ...updateFields } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 });
    }

    // Validate update fields
    const validated = updateEmployeeSchema.safeParse(updateFields);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: validated.error.errors },
        { status: 400 }
      );
    }

    const cleanData = validated.data;

    if (Object.keys(cleanData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await adminClient
      .from('employee_profile')
      .update({ ...cleanData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating employee', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update employee' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    // Log audit trail
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'employee',
        entity_id: id,
        description: `Updated employee ${updated.employee_id || id}`,
        details: { updated_fields: Object.keys(cleanData) }
      });
    } catch (auditErr) {
      apiLogger.error('Audit log failed for employee operation', { error: auditErr })
    }

    // Strip sensitive fields from response
    const { password: _pw, ...safeUpdated } = updated as unknown;

    return NextResponse.json({
      success: true,
      message: 'Employee updated successfully',
      data: safeUpdated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const errorId = crypto.randomUUID()
    apiLogger.error('Unexpected error in PATCH', { errorId, error });
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 });
  }
}

/**
 * DELETE /api/hr/employees
 * Soft-delete an employee by id (passed in body or query param)
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient();
    const adminClient = createSupabaseAdmin()

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await isHROrAdmin(supabase);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 });
    }

    // Support both query param and body
    let employeeId = request.nextUrl.searchParams.get('id');
    if (!employeeId) {
      try {
        const bodySchema3 = z.object({

          id: z.string().optional(),

        })

        const { data: body, error: _valErr3 } = await parseBody(request, bodySchema3)
    if (_valErr3) return _valErr3;
        employeeId = body.id;
      } catch { /* no body provided */ }
    }

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 });
    }

    // Soft delete: set deleted_at timestamp and status to terminated
    const { data: deleted, error: deleteError } = await adminClient
      .from('employee_profile')
      .update({
        status: 'terminated',
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select('id, employee_id')
      .maybeSingle();

    if (deleteError) {
      apiLogger.error('Error deleting employee', deleteError);
      return NextResponse.json({ success: false, error: 'Failed to delete employee' }, { status: 500 });
    }

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    // Log audit trail
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'employee',
        entity_id: employeeId,
        description: `Soft-deleted employee ${deleted.employee_id || employeeId}`,
      });
    } catch (auditErr) {
      apiLogger.error('Audit log failed for employee operation', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Unexpected error in DELETE', { errorId, error });
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 });
  }
}
