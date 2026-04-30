
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

// Validation schemas
const departmentSchema = z.object({
  name: z.string().min(2).max(255),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  parent_department_id: z.string().uuid().nullable().optional(),
  head_of_department_user_id: z.string().uuid().nullable().optional(),
});

// Helper function to check if user is Super Admin
async function isSuperAdmin(supabase: any): Promise<boolean> {
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
 * GET /api/hierarchy/departments
 * Get all departments with hierarchy
 */
export async function GET(request: NextRequest) {
  try {
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
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Build query
    let query = supabase
      .from('departments')
      .select(`
        *,
        head_of_department:employee_profile!departments_head_of_department_user_id_fkey(
          user_id,
          first_name,
          last_name,
          email
        ),
        sub_departments:departments!parent_department_id(
          id,
          name,
          code,
          is_active
        )
      `)
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: departments, error } = await query;

    if (error) {
      apiLogger.error('Error fetching departments', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch departments' },
        { status: 500 }
      );
    }

    // Transform the data to include head of department details
    const transformedDepartments = departments?.map(dept => ({
      ...dept,
      head_of_department: dept.head_of_department ? {
        id: dept.head_of_department.user_id,
        name: `${dept.head_of_department.first_name} ${dept.head_of_department.last_name}`,
        email: dept.head_of_department.email,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: transformedDepartments,
      count: transformedDepartments?.length || 0,
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
 * POST /api/hierarchy/departments
 * Create new department (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
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
    const body = await request.json();
    const validatedData = departmentSchema.parse(body);

    // Check if department name already exists
    const { data: existing } = await supabase
      .from('departments')
      .select('id')
      .eq('name', validatedData.name)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Department with this name already exists' },
        { status: 400 }
      );
    }

    // Insert new department
    const { data: newDepartment, error: insertError } = await supabase
      .from('departments')
      .insert({
        ...validatedData,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      apiLogger.error('Error creating department', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create department' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Department created successfully',
      data: newDepartment,
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
