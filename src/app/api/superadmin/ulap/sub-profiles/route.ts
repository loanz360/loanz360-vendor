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

// GET - Fetch all sub-profiles (optionally filter by profile_id)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profile_id');

    let query = supabase
      .from('ulap_applicant_sub_profiles')
      .select(`
        id,
        key,
        name,
        description,
        icon,
        color,
        display_order,
        is_active,
        profile_id,
        created_at,
        updated_at,
        ulap_applicant_profiles (
          id,
          key,
          name
        )
      `)
      .order('display_order');

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data: subProfiles, error } = await query;

    if (error) {
      apiLogger.error('Error fetching sub-profiles', error);
      return NextResponse.json(
        { error: 'Failed to fetch sub-profiles' },
        { status: 500 }
      );
    }

    // Map profile info for consistency
    const mappedSubProfiles = subProfiles?.map(sp => ({
      ...sp,
      profile: sp.ulap_applicant_profiles,
    })) || [];

    return NextResponse.json({
      success: true,
      sub_profiles: mappedSubProfiles,
      count: mappedSubProfiles.length,
    });
  } catch (error) {
    apiLogger.error('Error in sub-profiles API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new sub-profile
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      profile_id: z.string().uuid().optional(),

      key: z.string().optional(),

      name: z.string().optional(),

      description: z.string().optional(),

      icon: z.string().optional(),

      color: z.string().optional(),

      display_order: z.string().optional(),

      is_active: z.boolean().optional(),

      id: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const { profile_id, key, name, description, icon, color, display_order, is_active } = body;

    if (!profile_id || !key || !name) {
      return NextResponse.json(
        { error: 'Profile ID, key, and name are required' },
        { status: 400 }
      );
    }

    // Verify profile exists
    const { data: profile, error: profileError } = await supabase
      .from('ulap_applicant_profiles')
      .select('id')
      .eq('id', profile_id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const { data: subProfile, error } = await supabase
      .from('ulap_applicant_sub_profiles')
      .insert({
        profile_id,
        key: key.toUpperCase().replace(/\s+/g, '_'),
        name,
        description,
        icon,
        color,
        display_order: display_order || 0,
        is_active: is_active !== false,
      })
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error creating sub-profile', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A sub-profile with this key already exists for this profile' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create sub-profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sub_profile: subProfile,
    }, { status: 201 });
  } catch (error) {
    apiLogger.error('Error in create sub-profile API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a sub-profile
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema2 = z.object({

      color: z.string().optional(),

      name: z.string().optional(),

      icon: z.string().optional(),

      key: z.string().optional(),

      description: z.string().optional(),

      profile_id: z.string().optional(),

      is_active: z.boolean().optional(),

      display_order: z.string().optional(),

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2;
    const { id, profile_id, key, name, description, icon, color, display_order, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Sub-profile ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (profile_id !== undefined) updateData.profile_id = profile_id;
    if (key !== undefined) updateData.key = key.toUpperCase().replace(/\s+/g, '_');
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: subProfile, error } = await supabase
      .from('ulap_applicant_sub_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error updating sub-profile', error);
      return NextResponse.json(
        { error: 'Failed to update sub-profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sub_profile: subProfile,
    });
  } catch (error) {
    apiLogger.error('Error in update sub-profile API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a sub-profile
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Sub-profile ID is required' },
        { status: 400 }
      );
    }

    if (hardDelete) {
      const { error } = await supabase
        .from('ulap_applicant_sub_profiles')
        .delete()
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deleting sub-profile', error);
        return NextResponse.json(
          { error: 'Failed to delete sub-profile' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from('ulap_applicant_sub_profiles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deactivating sub-profile', error);
        return NextResponse.json(
          { error: 'Failed to deactivate sub-profile' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Sub-profile deleted' : 'Sub-profile deactivated',
    });
  } catch (error) {
    apiLogger.error('Error in delete sub-profile API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
