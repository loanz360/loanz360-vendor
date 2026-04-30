
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all profiles (including inactive) for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSubProfiles = searchParams.get('include_sub_profiles') !== 'false';

    const { data: profiles, error } = await supabase
      .from('ulap_applicant_profiles')
      .select(includeSubProfiles ? `
        id,
        key,
        name,
        description,
        icon,
        color,
        display_order,
        is_active,
        created_at,
        updated_at,
        ulap_applicant_sub_profiles (
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
          updated_at
        )
      ` : `
        id,
        key,
        name,
        description,
        icon,
        color,
        display_order,
        is_active,
        created_at,
        updated_at
      `)
      .order('display_order');

    if (error) {
      apiLogger.error('Error fetching profiles', error);
      return NextResponse.json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Map sub_profiles key for consistency
    const mappedProfiles = profiles?.map(profile => ({
      ...profile,
      sub_profiles: profile.ulap_applicant_sub_profiles || [],
    })) || [];

    return NextResponse.json({
      success: true,
      profiles: mappedProfiles,
      count: mappedProfiles.length,
    });
  } catch (error) {
    apiLogger.error('Error in profiles API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, name, description, icon, color, display_order, is_active } = body;

    if (!key || !name) {
      return NextResponse.json(
        { error: 'Key and name are required' },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from('ulap_applicant_profiles')
      .insert({
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
      apiLogger.error('Error creating profile', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A profile with this key already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    }, { status: 201 });
  } catch (error) {
    apiLogger.error('Error in create profile API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, key, name, description, icon, color, display_order, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (key !== undefined) updateData.key = key.toUpperCase().replace(/\s+/g, '_');
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: profile, error } = await supabase
      .from('ulap_applicant_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      apiLogger.error('Error updating profile', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    apiLogger.error('Error in update profile API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a profile (soft delete by setting is_active = false)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    if (hardDelete) {
      const { error } = await supabase
        .from('ulap_applicant_profiles')
        .delete()
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deleting profile', error);
        return NextResponse.json(
          { error: 'Failed to delete profile' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from('ulap_applicant_profiles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        apiLogger.error('Error deactivating profile', error);
        return NextResponse.json(
          { error: 'Failed to deactivate profile' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Profile deleted' : 'Profile deactivated',
    });
  } catch (error) {
    apiLogger.error('Error in delete profile API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
