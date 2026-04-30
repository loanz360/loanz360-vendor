
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default profiles and sub-profiles data
const DEFAULT_PROFILES = [
  { id: 'profile-01-salaried', key: 'SALARIED', name: 'Salaried Individual', description: 'Employees working in private or government sector', icon: 'briefcase', color: '#3B82F6', display_order: 1 },
  { id: 'profile-02-self-employed-pro', key: 'SELF_EMPLOYED_PROFESSIONAL', name: 'Self Employed Professional', description: 'Doctors, lawyers, CAs, architects, consultants', icon: 'user-tie', color: '#8B5CF6', display_order: 2 },
  { id: 'profile-03-self-employed-biz', key: 'SELF_EMPLOYED_BUSINESS', name: 'Self Employed Business', description: 'Business owners, traders, manufacturers', icon: 'store', color: '#10B981', display_order: 3 },
  { id: 'profile-04-business-entity', key: 'BUSINESS_ENTITY', name: 'Business Entity', description: 'Companies, partnerships, LLPs, trusts', icon: 'building', color: '#F59E0B', display_order: 4 },
  { id: 'profile-05-agriculture', key: 'AGRICULTURE', name: 'Agriculture', description: 'Farmers, agri-business owners', icon: 'wheat', color: '#84CC16', display_order: 5 },
  { id: 'profile-06-nri', key: 'NRI', name: 'NRI / PIO', description: 'Non-Resident Indians and Persons of Indian Origin', icon: 'globe', color: '#14B8A6', display_order: 6 },
  { id: 'profile-07-pensioner', key: 'PENSIONER', name: 'Pensioner', description: 'Retired individuals receiving pension', icon: 'user-clock', color: '#6366F1', display_order: 7 },
  { id: 'profile-08-student', key: 'STUDENT', name: 'Student', description: 'Students applying for education loans', icon: 'graduation-cap', color: '#EC4899', display_order: 8 },
];

const DEFAULT_SUB_PROFILES = [
  // Salaried Sub-Profiles
  { profile_id: 'profile-01-salaried', key: 'PRIVATE_SECTOR', name: 'Private Sector Employee', description: 'Working in private companies', icon: 'building-office', display_order: 1 },
  { profile_id: 'profile-01-salaried', key: 'GOVERNMENT', name: 'Government Employee', description: 'Central/State government employees', icon: 'landmark', display_order: 2 },
  { profile_id: 'profile-01-salaried', key: 'PSU', name: 'PSU Employee', description: 'Public Sector Undertaking employees', icon: 'building-2', display_order: 3 },
  { profile_id: 'profile-01-salaried', key: 'DEFENSE', name: 'Defense Personnel', description: 'Army, Navy, Air Force personnel', icon: 'shield', display_order: 4 },
  { profile_id: 'profile-01-salaried', key: 'MNC', name: 'MNC Employee', description: 'Working in multinational companies', icon: 'globe-2', display_order: 5 },

  // Self Employed Professional Sub-Profiles
  { profile_id: 'profile-02-self-employed-pro', key: 'DOCTOR', name: 'Doctor / Medical Professional', description: 'Doctors, dentists, medical practitioners', icon: 'stethoscope', display_order: 1 },
  { profile_id: 'profile-02-self-employed-pro', key: 'CHARTERED_ACCOUNTANT', name: 'Chartered Accountant', description: 'CA, CS, CMA professionals', icon: 'calculator', display_order: 2 },
  { profile_id: 'profile-02-self-employed-pro', key: 'LAWYER', name: 'Lawyer / Advocate', description: 'Legal professionals', icon: 'scale', display_order: 3 },
  { profile_id: 'profile-02-self-employed-pro', key: 'ARCHITECT', name: 'Architect / Engineer', description: 'Architects, civil engineers, consultants', icon: 'ruler', display_order: 4 },
  { profile_id: 'profile-02-self-employed-pro', key: 'CONSULTANT', name: 'Consultant', description: 'Management, IT, and other consultants', icon: 'user-tie', display_order: 5 },

  // Self Employed Business Sub-Profiles
  { profile_id: 'profile-03-self-employed-biz', key: 'PROPRIETORSHIP', name: 'Proprietorship', description: 'Sole proprietor business', icon: 'user', display_order: 1 },
  { profile_id: 'profile-03-self-employed-biz', key: 'PARTNERSHIP', name: 'Partnership Firm', description: 'Partnership business', icon: 'users', display_order: 2 },
  { profile_id: 'profile-03-self-employed-biz', key: 'TRADER', name: 'Trader', description: 'Wholesale/retail traders', icon: 'shopping-cart', display_order: 3 },
  { profile_id: 'profile-03-self-employed-biz', key: 'MANUFACTURER', name: 'Manufacturer', description: 'Manufacturing business', icon: 'factory', display_order: 4 },
  { profile_id: 'profile-03-self-employed-biz', key: 'SERVICE_PROVIDER', name: 'Service Provider', description: 'Service-based business', icon: 'briefcase', display_order: 5 },

  // Business Entity Sub-Profiles
  { profile_id: 'profile-04-business-entity', key: 'PRIVATE_LIMITED', name: 'Private Limited Company', description: 'Pvt. Ltd. companies', icon: 'building', display_order: 1 },
  { profile_id: 'profile-04-business-entity', key: 'PUBLIC_LIMITED', name: 'Public Limited Company', description: 'Public Ltd. companies', icon: 'building-office-2', display_order: 2 },
  { profile_id: 'profile-04-business-entity', key: 'LLP', name: 'Limited Liability Partnership', description: 'LLP registered firms', icon: 'handshake', display_order: 3 },
  { profile_id: 'profile-04-business-entity', key: 'TRUST', name: 'Trust / Society', description: 'Registered trusts and societies', icon: 'heart-handshake', display_order: 4 },
  { profile_id: 'profile-04-business-entity', key: 'HUF', name: 'Hindu Undivided Family', description: 'HUF business entities', icon: 'home', display_order: 5 },

  // Agriculture Sub-Profiles
  { profile_id: 'profile-05-agriculture', key: 'FARMER_INDIVIDUAL', name: 'Individual Farmer', description: 'Individual land-owning farmers', icon: 'wheat', display_order: 1 },
  { profile_id: 'profile-05-agriculture', key: 'AGRI_BUSINESS', name: 'Agri-Business', description: 'Agricultural business entities', icon: 'tractor', display_order: 2 },
  { profile_id: 'profile-05-agriculture', key: 'DAIRY_FARMER', name: 'Dairy Farmer', description: 'Dairy and animal husbandry', icon: 'milk', display_order: 3 },

  // NRI Sub-Profiles
  { profile_id: 'profile-06-nri', key: 'NRI_EMPLOYED', name: 'NRI Salaried', description: 'NRIs working abroad', icon: 'briefcase', display_order: 1 },
  { profile_id: 'profile-06-nri', key: 'NRI_BUSINESS', name: 'NRI Business', description: 'NRIs running business abroad', icon: 'building', display_order: 2 },
  { profile_id: 'profile-06-nri', key: 'PIO', name: 'Person of Indian Origin', description: 'PIOs and OCIs', icon: 'user', display_order: 3 },

  // Pensioner Sub-Profiles
  { profile_id: 'profile-07-pensioner', key: 'GOVT_PENSIONER', name: 'Government Pensioner', description: 'Retired government employees', icon: 'landmark', display_order: 1 },
  { profile_id: 'profile-07-pensioner', key: 'PRIVATE_PENSIONER', name: 'Private Pensioner', description: 'Retired from private sector', icon: 'building-office', display_order: 2 },
  { profile_id: 'profile-07-pensioner', key: 'DEFENSE_PENSIONER', name: 'Defense Pensioner', description: 'Retired defense personnel', icon: 'shield', display_order: 3 },

  // Student Sub-Profiles
  { profile_id: 'profile-08-student', key: 'UNDERGRADUATE', name: 'Undergraduate Student', description: 'Pursuing bachelor degree', icon: 'book', display_order: 1 },
  { profile_id: 'profile-08-student', key: 'POSTGRADUATE', name: 'Postgraduate Student', description: 'Pursuing master/doctoral degree', icon: 'graduation-cap', display_order: 2 },
  { profile_id: 'profile-08-student', key: 'PROFESSIONAL_COURSE', name: 'Professional Course', description: 'MBA, engineering, medical students', icon: 'certificate', display_order: 3 },
];

// POST - Seed profiles and sub-profiles
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify authorization token
    const authHeader = request.headers.get('Authorization');
    const expectedToken = process.env.SEED_API_TOKEN || 'ulap-seed-token';

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing token' },
        { status: 401 }
      );
    }

    // Check existing profiles
    const { data: existingProfiles, error: checkError } = await supabase
      .from('ulap_applicant_profiles')
      .select('key');

    if (checkError) {
      apiLogger.error('Error checking existing profiles', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing profiles' },
        { status: 500 }
      );
    }

    const existingKeys = new Set(existingProfiles?.map(p => p.key) || []);

    // Filter profiles to insert (only new ones)
    const profilesToInsert = DEFAULT_PROFILES.filter(p => !existingKeys.has(p.key));

    let insertedProfiles = 0;
    let insertedSubProfiles = 0;

    if (profilesToInsert.length > 0) {
      const { data: newProfiles, error: insertError } = await supabase
        .from('ulap_applicant_profiles')
        .insert(profilesToInsert.map(p => ({
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          icon: p.icon,
          color: p.color,
          display_order: p.display_order,
          is_active: true,
        })))
        .select();

      if (insertError) {
        apiLogger.error('Error inserting profiles', insertError);
        return NextResponse.json(
          { error: 'Failed to insert profiles' },
          { status: 500 }
        );
      }

      insertedProfiles = newProfiles?.length || 0;
    }

    // Check existing sub-profiles
    const { data: existingSubProfiles, error: subCheckError } = await supabase
      .from('ulap_applicant_sub_profiles')
      .select('key, profile_id');

    if (subCheckError) {
      apiLogger.error('Error checking existing sub-profiles', subCheckError);
      return NextResponse.json(
        { error: 'Failed to check existing sub-profiles' },
        { status: 500 }
      );
    }

    const existingSubKeys = new Set(existingSubProfiles?.map(sp => `${sp.profile_id}_${sp.key}`) || []);

    // Filter sub-profiles to insert
    const subProfilesToInsert = DEFAULT_SUB_PROFILES.filter(
      sp => !existingSubKeys.has(`${sp.profile_id}_${sp.key}`)
    );

    if (subProfilesToInsert.length > 0) {
      const { data: newSubProfiles, error: subInsertError } = await supabase
        .from('ulap_applicant_sub_profiles')
        .insert(subProfilesToInsert.map(sp => ({
          profile_id: sp.profile_id,
          key: sp.key,
          name: sp.name,
          description: sp.description,
          icon: sp.icon,
          display_order: sp.display_order,
          is_active: true,
        })))
        .select();

      if (subInsertError) {
        apiLogger.error('Error inserting sub-profiles', subInsertError);
        return NextResponse.json(
          { error: 'Failed to insert sub-profiles' },
          { status: 500 }
        );
      }

      insertedSubProfiles = newSubProfiles?.length || 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Seed completed',
      inserted: {
        profiles: insertedProfiles,
        sub_profiles: insertedSubProfiles,
      },
      skipped: {
        profiles: DEFAULT_PROFILES.length - profilesToInsert.length,
        sub_profiles: DEFAULT_SUB_PROFILES.length - subProfilesToInsert.length,
      },
    });
  } catch (error) {
    apiLogger.error('Error in seed profiles API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get seed status (how many profiles/sub-profiles exist)
export async function GET() {
  try {
    const [profilesResult, subProfilesResult] = await Promise.all([
      supabase.from('ulap_applicant_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('ulap_applicant_sub_profiles').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        profiles: profilesResult.count || 0,
        sub_profiles: subProfilesResult.count || 0,
      },
      expected: {
        profiles: DEFAULT_PROFILES.length,
        sub_profiles: DEFAULT_SUB_PROFILES.length,
      },
      needs_seeding: (profilesResult.count || 0) < DEFAULT_PROFILES.length,
    });
  } catch (error) {
    apiLogger.error('Error checking seed status', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
