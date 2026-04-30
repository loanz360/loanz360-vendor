import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLogger } from '@/lib/utils/logger'

const roleUpdateSchema = z.object({
  role_name: z.string().min(2).max(255).optional(),
  role_code: z.string().min(1).max(50).optional(),
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
  max_reportees: z.number().int().positive().nullable().optional(),
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
 * GET /api/hierarchy/roles/[id]
 * Get a single role by ID
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

    const { data: role, error } = await supabase
      .from('organizational_roles')
      .select(`
        *,
        department:departments(id, name, code),
        parent_role:organizational_roles!parent_role_id(id, role_name, role_code),
        kpis:role_kpis(*),
        kris:role_kris(*)
      `)
      .eq('id', params.id)
      .maybeSingle();

    if (error || !role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: role,
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
 * PUT /api/hierarchy/roles/[id]
 * Update a role (Super Admin only)
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

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr;
    const validatedData = roleUpdateSchema.parse(body);

    // If updating role code, check for duplicates
    if (validatedData.role_code) {
      const { data: existing } = await supabase
        .from('organizational_roles')
        .select('id')
        .eq('role_code', validatedData.role_code)
        .neq('id', params.id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Role with this code already exists' },
          { status: 400 }
        );
      }
    }

    // Prepare data for update
    const updateData: Record<string, unknown> = {
      ...validatedData,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // Convert arrays to JSONB format if present
    if (validatedData.responsibilities) {
      updateData.responsibilities = JSON.stringify(validatedData.responsibilities);
    }
    if (validatedData.duties_tasks) {
      updateData.duties_tasks = JSON.stringify(validatedData.duties_tasks);
    }

    // Update role
    const { data: updatedRole, error: updateError } = await supabase
      .from('organizational_roles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (updateError) {
      apiLogger.error('Error updating role', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole,
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
 * DELETE /api/hierarchy/roles/[id]
 * Soft delete a role (Super Admin only)
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

    // Check if role has any assigned employees
    const { data: employees, count } = await supabase
      .from('employee_profile')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', params.id)
      .eq('status', 'active');

    if (count && count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role: ${count} active employee(s) are assigned to this role`
        },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error: deleteError } = await supabase
      .from('organizational_roles')
      .update({
        is_active: false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (deleteError) {
      apiLogger.error('Error deleting role', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Unexpected error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
