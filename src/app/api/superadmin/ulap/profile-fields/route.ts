import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all profile fields for admin
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url);
    const subcategoryId = searchParams.get('subcategory_id');
    const section = searchParams.get('section');
    const baseOnly = searchParams.get('base_only') === 'true';

    let query = supabase
      .from('ulap_profile_fields')
      .select('*')
      .order('display_order');

    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId);
    }

    if (section) {
      query = query.eq('field_section', section);
    }

    if (baseOnly) {
      query = query.eq('is_base_field', true);
    }

    const { data: fields, error } = await query;

    if (error) {
      apiLogger.error('Error fetching profile fields', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch profile fields' }, { status: 500 });
    }

    return NextResponse.json({ fields: fields || [] });
  } catch (error) {
    apiLogger.error('Error in admin profile fields API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new profile field
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      subcategory_id: z.string().uuid().optional(),

      field_name: z.string().optional(),

      field_label: z.string().optional(),

      field_type: z.string().optional(),

      placeholder: z.string().optional(),

      is_required: z.boolean().optional(),

      validation_rules: z.string().optional(),

      options: z.record(z.unknown()).optional(),

      display_order: z.string().optional(),

      field_section: z.string().optional(),

      is_base_field: z.boolean().optional(),

      id: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const {
      subcategory_id,
      field_name,
      field_label,
      field_type,
      placeholder,
      is_required,
      validation_rules,
      options,
      display_order,
      field_section,
      is_base_field,
    } = body;

    if (!field_name || !field_label || !field_type || !field_section) {
      return NextResponse.json(
        { error: 'Missing required fields: field_name, field_label, field_type, field_section' },
        { status: 400 }
      );
    }

    const { data: field, error } = await supabase
      .from('ulap_profile_fields')
      .insert({
        subcategory_id: subcategory_id || null,
        field_name,
        field_label,
        field_type,
        placeholder: placeholder || null,
        is_required: is_required || false,
        validation_rules: validation_rules || {},
        options: options || [],
        display_order: display_order || 0,
        field_section,
        is_base_field: is_base_field || false,
      })
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error creating profile field', error);
      return NextResponse.json({ success: false, error: 'Failed to create profile field' }, { status: 500 });
    }

    return NextResponse.json({ success: true, field });
  } catch (error) {
    apiLogger.error('Error in create profile field API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update profile field
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema2 = z.object({

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Field ID is required' }, { status: 400 });
    }

    const { data: field, error } = await supabase
      .from('ulap_profile_fields')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error updating profile field', error);
      return NextResponse.json({ success: false, error: 'Failed to update profile field' }, { status: 500 });
    }

    return NextResponse.json({ success: true, field });
  } catch (error) {
    apiLogger.error('Error in update profile field API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete profile field
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Field ID is required' }, { status: 400 });
    }

    const { error } = await supabase.from('ulap_profile_fields').delete().eq('id', id);

    if (error) {
      apiLogger.error('Error deleting profile field', error);
      return NextResponse.json({ success: false, error: 'Failed to delete profile field' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    apiLogger.error('Error in delete profile field API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
