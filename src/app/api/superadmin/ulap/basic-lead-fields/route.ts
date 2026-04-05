export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all basic lead fields (including inactive) for admin
export async function GET() {
  try {
    const { data: fields, error } = await supabase
      .from('ulap_basic_lead_fields')
      .select('*')
      .order('display_order');

    if (error) {
      apiLogger.error('Error fetching basic lead fields', error);
      return NextResponse.json(
        { error: 'Failed to fetch basic lead fields' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fields: fields || [],
      count: fields?.length || 0,
    });
  } catch (error) {
    apiLogger.error('Error in basic lead fields API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new basic lead field
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      field_key,
      label,
      field_type,
      placeholder,
      helper_text,
      is_required,
      is_default,
      display_order,
      validation_rules,
      is_active,
    } = body;

    if (!field_key || !label || !field_type) {
      return NextResponse.json(
        { error: 'Field key, label, and field type are required' },
        { status: 400 }
      );
    }

    const { data: field, error } = await supabase
      .from('ulap_basic_lead_fields')
      .insert({
        field_key: field_key.toLowerCase().replace(/\s+/g, '_'),
        label,
        field_type,
        placeholder,
        helper_text,
        is_required: is_required || false,
        is_default: is_default || false,
        display_order: display_order || 0,
        validation_rules: validation_rules || {},
        is_active: is_active !== false,
      })
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error creating basic lead field', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A field with this key already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create basic lead field' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      field,
    }, { status: 201 });
  } catch (error) {
    apiLogger.error('Error in create basic lead field API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a basic lead field
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      field_key,
      label,
      field_type,
      placeholder,
      helper_text,
      is_required,
      is_default,
      display_order,
      validation_rules,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (field_key !== undefined) updateData.field_key = field_key.toLowerCase().replace(/\s+/g, '_');
    if (label !== undefined) updateData.label = label;
    if (field_type !== undefined) updateData.field_type = field_type;
    if (placeholder !== undefined) updateData.placeholder = placeholder;
    if (helper_text !== undefined) updateData.helper_text = helper_text;
    if (is_required !== undefined) updateData.is_required = is_required;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (validation_rules !== undefined) updateData.validation_rules = validation_rules;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: field, error } = await supabase
      .from('ulap_basic_lead_fields')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error updating basic lead field', error);
      return NextResponse.json(
        { error: 'Failed to update basic lead field' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      field,
    });
  } catch (error) {
    apiLogger.error('Error in update basic lead field API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a basic lead field
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      );
    }

    if (hardDelete) {
      const { error } = await supabase
        .from('ulap_basic_lead_fields')
        .delete()
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deleting basic lead field', error);
        return NextResponse.json(
          { error: 'Failed to delete basic lead field' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from('ulap_basic_lead_fields')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deactivating basic lead field', error);
        return NextResponse.json(
          { error: 'Failed to deactivate basic lead field' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Field deleted' : 'Field deactivated',
    });
  } catch (error) {
    apiLogger.error('Error in delete basic lead field API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Reorder basic lead fields
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fields } = body; // Array of { id, display_order }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { error: 'Fields array is required' },
        { status: 400 }
      );
    }

    // Update display_order for each field
    for (const field of fields) {
      const { error } = await supabase
        .from('ulap_basic_lead_fields')
        .update({ display_order: field.display_order })
        .eq('id', field.id);

      if (error) {
        apiLogger.error('Error reordering field', error);
        return NextResponse.json(
          { error: 'Failed to reorder fields' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Fields reordered successfully',
    });
  } catch (error) {
    apiLogger.error('Error in reorder basic lead fields API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
