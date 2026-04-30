import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for updates
const departmentUpdateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  parent_department_id: z.string().uuid().nullable().optional(),
  head_of_department: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
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
 * GET /api/hierarchy/departments/[id]
 * Get department by ID with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Fetch department with related data
    const { data: department, error } = await supabase
      .from('departments')
      .select(`
        *,
        head_of_department:employee_profile!departments_head_of_department_fkey(
          user_id,
          first_name,
          last_name,
          email,
          phone
        ),
        parent_department:departments!parent_department_id(
          id,
          name,
          code
        ),
        sub_departments:departments!parent_department_id(
          id,
          name,
          code,
          is_active
        ),
        roles:organizational_roles(
          id,
          role_name,
          role_code,
          level,
          is_active
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      apiLogger.error('Error fetching department', error);
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Transform the data
    const transformedDepartment = {
      ...department,
      head_of_department: department.head_of_department ? {
        id: department.head_of_department.user_id,
        name: `${department.head_of_department.first_name} ${department.head_of_department.last_name}`,
        email: department.head_of_department.email,
        phone: department.head_of_department.phone,
      } : null,
    };

    return NextResponse.json({
      success: true,
      data: transformedDepartment,
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
 * PUT /api/hierarchy/departments/[id]
 * Update department (Super Admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr;
    const validatedData = departmentUpdateSchema.parse(body);

    // Check if department exists
    const { data: existing } = await supabase
      .from('departments')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Update department
    const { data: updatedDepartment, error: updateError } = await supabase
      .from('departments')
      .update({
        ...validatedData,
        updated_by: user.id,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating department', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update department' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment,
    });
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

/**
 * DELETE /api/hierarchy/departments/[id]
 * Soft delete department (Super Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Check if department has roles assigned
    const { data: roles } = await supabase
      .from('organizational_roles')
      .select('id')
      .eq('department_id', id)
      .eq('is_active', true)
      .limit(1);

    if (roles && roles.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete department with active roles assigned',
          hint: 'Please deactivate or reassign all roles before deleting the department'
        },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('departments')
      .update({
        is_active: false,
        updated_by: user.id
      })
      .eq('id', id);

    if (deleteError) {
      apiLogger.error('Error deleting department', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete department' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
