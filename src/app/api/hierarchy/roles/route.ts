import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

// Validation schemas
const roleSchema = z.object({
  role_name: z.string().min(2).max(255),
  role_code: z.string().min(1).max(50),
  department_id: z.string().uuid().nullable().optional(),
  parent_role_id: z.string().uuid().nullable().optional(),
  level: z.number().int().min(1).max(10).optional(),
  level_code: z.string().max(50).optional(),
  description: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  duties_tasks: z.array(z.string()).optional(),
  requires_approval: z.boolean().optional(),
  can_approve_leaves: z.boolean().optional(),
  can_approve_attendance: z.boolean().optional(),
  max_reportees: z.number().int().positive().optional(),
});

// Helper function to check if user is Super Admin
async function isSuperAdmin(supabase: unknown): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('employee_profile')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  return profile?.role === 'superadmin';
}

/**
 * GET /api/hierarchy/roles
 * Get all organizational roles with filters
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('department_id');
    const level = searchParams.get('level');
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const includeKpis = searchParams.get('include_kpis') === 'true';
    const includeKris = searchParams.get('include_kris') === 'true';

    // Build base query
    let selectQuery = `
      *,
      department:departments(id, name, code),
      parent_role:organizational_roles!parent_role_id(id, role_name, role_code)
    `;

    if (includeKpis) {
      selectQuery += `,
        kpis:role_kpis(
          id,
          kpi_name,
          kpi_description,
          measurement_unit,
          target_monthly,
          target_quarterly,
          target_yearly,
          weightage,
          is_active
        )
      `;
    }

    if (includeKris) {
      selectQuery += `,
        kris:role_kris(
          id,
          kri_name,
          kri_description,
          measurement_criteria,
          target_value,
          weightage,
          measurement_frequency,
          is_active
        )
      `;
    }

    let query = supabase
      .from('organizational_roles')
      .select(selectQuery)
      .order('level', { ascending: true })
      .order('role_name', { ascending: true });

    // Apply filters
    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (level) {
      query = query.eq('level', parseInt(level));
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: roles, error } = await query;

    if (error) {
      apiLogger.error('Error fetching roles', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch roles' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: roles,
      count: roles?.length || 0,
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hierarchy/roles
 * Create new organizational role (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Super Admin
    const isAdmin = await isSuperAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const validatedData = roleSchema.parse(body);

    // Check if role code already exists
    const { data: existing } = await supabase
      .from('organizational_roles')
      .select('id')
      .eq('role_code', validatedData.role_code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Role with this code already exists' },
        { status: 400 }
      );
    }

    // Prepare data for insertion
    const insertData: Record<string, unknown> = {
      ...validatedData,
      created_by: user.id,
      updated_by: user.id,
    };

    // Convert arrays to JSONB format
    if (validatedData.responsibilities) {
      insertData.responsibilities = JSON.stringify(validatedData.responsibilities);
    }
    if (validatedData.duties_tasks) {
      insertData.duties_tasks = JSON.stringify(validatedData.duties_tasks);
    }

    // Insert new role
    const { data: newRole, error: insertError } = await supabase
      .from('organizational_roles')
      .insert(insertData)
      .select()
      .maybeSingle();

    if (insertError) {
      apiLogger.error('Error creating role', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Role created successfully',
      data: newRole,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
