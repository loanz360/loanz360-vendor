
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all active applicant profiles with their sub-profiles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSubProfiles = searchParams.get('include_sub_profiles') !== 'false';
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Build query for profiles
    let query = supabase
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

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: profiles, error } = await query;

    if (error) {
      apiLogger.error('Error fetching applicant profiles', error);
      return NextResponse.json(
        { error: 'Failed to fetch applicant profiles' },
        { status: 500 }
      );
    }

    // Filter out inactive sub-profiles if not requested
    const filteredProfiles = profiles?.map(profile => {
      if (includeSubProfiles && profile.ulap_applicant_sub_profiles) {
        return {
          ...profile,
          sub_profiles: includeInactive
            ? profile.ulap_applicant_sub_profiles
            : profile.ulap_applicant_sub_profiles.filter(
                (sub: { is_active: boolean }) => sub.is_active
              ),
        };
      }
      return { ...profile, sub_profiles: [] };
    }) || [];

    return NextResponse.json({
      success: true,
      profiles: filteredProfiles,
      count: filteredProfiles.length,
    });
  } catch (error) {
    apiLogger.error('Error in applicant profiles API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
