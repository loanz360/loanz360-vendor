
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Seed all subcategories to database
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Check authorization
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.SEED_API_TOKEN || 'seed-categories-2024';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First, get all category IDs from database
    const { data: categories, error: catError } = await supabase
      .from('ulap_loan_categories')
      .select('id, slug');

    if (catError || !categories || categories.length === 0) {
      return NextResponse.json(
        { error: 'No categories found. Please seed categories first.' },
        { status: 400 }
      );
    }

    // Create a map of slug -> id (slugs use hyphenated format like 'personal-loans')
    const categoryMap = new Map(categories.map(c => [c.slug, c.id]));

    // Helper to convert category_code (PERSONAL_LOANS) to slug (personal-loans)
    // Converts underscores to hyphens and lowercases
    const codeToSlug = (code: string) => code.toLowerCase().replace(/_/g, '-');

    // All 66 subcategories across 15 categories
    const SUBCATEGORIES = [
      // 1. Personal Loans (5 subcategories)
      { category_code: 'PERSONAL_LOANS', code: 'PL_SALARIED', name: 'Salaried Personal Loan', description: 'Personal loan for salaried individuals', icon: 'user', min_amount: 50000, max_amount: 4000000, display_order: 1, is_active: true },
      { category_code: 'PERSONAL_LOANS', code: 'PL_SELF_EMPLOYED', name: 'Self Employed Personal Loan', description: 'Personal loan for self-employed individuals', icon: 'briefcase', min_amount: 100000, max_amount: 5000000, display_order: 2, is_active: true },
      { category_code: 'PERSONAL_LOANS', code: 'PL_PENSION', name: 'Pensioner Personal Loan', description: 'Personal loan for pensioners', icon: 'user-clock', min_amount: 50000, max_amount: 2000000, display_order: 3, is_active: true },
      { category_code: 'PERSONAL_LOANS', code: 'PL_BALANCE_TRANSFER', name: 'Personal Loan Balance Transfer', description: 'Transfer existing personal loan for better rates', icon: 'refresh', min_amount: 50000, max_amount: 4000000, display_order: 4, is_active: true },
      { category_code: 'PERSONAL_LOANS', code: 'PL_TOP_UP', name: 'Personal Loan Top Up', description: 'Additional loan on existing personal loan', icon: 'plus-circle', min_amount: 25000, max_amount: 2000000, display_order: 5, is_active: true },

      // 2. Business Loans (7 subcategories)
      { category_code: 'BUSINESS_LOANS', code: 'BL_SME', name: 'SME / MSME Loan', description: 'Loan for small and medium enterprises', icon: 'building', min_amount: 500000, max_amount: 50000000, display_order: 1, is_active: true },
      { category_code: 'BUSINESS_LOANS', code: 'BL_UNSECURED', name: 'Unsecured Business Loan', description: 'Business loan without collateral', icon: 'shield-off', min_amount: 100000, max_amount: 5000000, display_order: 2, is_active: true },
      { category_code: 'BUSINESS_LOANS', code: 'BL_SECURED', name: 'Secured Business Loan', description: 'Business loan with collateral', icon: 'shield', min_amount: 500000, max_amount: 100000000, display_order: 3, is_active: true },
      { category_code: 'BUSINESS_LOANS', code: 'BL_STARTUP', name: 'Startup Loan', description: 'Loan for new business ventures', icon: 'rocket', min_amount: 500000, max_amount: 20000000, display_order: 4, is_active: true },
      { category_code: 'BUSINESS_LOANS', code: 'BL_INVOICE', name: 'Invoice Discounting', description: 'Financing against unpaid invoices', icon: 'file-invoice', min_amount: 100000, max_amount: 10000000, display_order: 5, is_active: true },
      { category_code: 'BUSINESS_LOANS', code: 'BL_MERCHANT', name: 'Merchant Cash Advance', description: 'Advance based on card sales', icon: 'credit-card', min_amount: 50000, max_amount: 5000000, display_order: 6, is_active: true },
      { category_code: 'BUSINESS_LOANS', code: 'BL_OVERDRAFT', name: 'Business Overdraft', description: 'Flexible overdraft facility', icon: 'wallet', min_amount: 100000, max_amount: 10000000, display_order: 7, is_active: true },

      // 3. Home Loans (6 subcategories)
      { category_code: 'HOME_LOANS', code: 'HL_PURCHASE', name: 'Home Purchase Loan', description: 'Loan for buying a ready home', icon: 'home', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true },
      { category_code: 'HOME_LOANS', code: 'HL_CONSTRUCTION', name: 'Home Construction Loan', description: 'Loan for constructing a home', icon: 'building', min_amount: 500000, max_amount: 50000000, display_order: 2, is_active: true },
      { category_code: 'HOME_LOANS', code: 'HL_EXTENSION', name: 'Home Extension Loan', description: 'Loan for extending existing home', icon: 'expand', min_amount: 200000, max_amount: 20000000, display_order: 3, is_active: true },
      { category_code: 'HOME_LOANS', code: 'HL_IMPROVEMENT', name: 'Home Improvement Loan', description: 'Loan for renovating your home', icon: 'paint-brush', min_amount: 100000, max_amount: 10000000, display_order: 4, is_active: true },
      { category_code: 'HOME_LOANS', code: 'HL_BALANCE_TRANSFER', name: 'Home Loan Balance Transfer', description: 'Transfer existing home loan', icon: 'refresh', min_amount: 500000, max_amount: 100000000, display_order: 5, is_active: true },
      { category_code: 'HOME_LOANS', code: 'HL_TOP_UP', name: 'Home Loan Top Up', description: 'Additional loan on existing home loan', icon: 'plus-circle', min_amount: 200000, max_amount: 30000000, display_order: 6, is_active: true },

      // 4. Mortgage / LAP (5 subcategories)
      { category_code: 'MORTGAGE_LOANS', code: 'LAP_RESIDENTIAL', name: 'LAP Residential Property', description: 'Loan against residential property', icon: 'home', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true },
      { category_code: 'MORTGAGE_LOANS', code: 'LAP_COMMERCIAL', name: 'LAP Commercial Property', description: 'Loan against commercial property', icon: 'building', min_amount: 1000000, max_amount: 200000000, display_order: 2, is_active: true },
      { category_code: 'MORTGAGE_LOANS', code: 'LAP_INDUSTRIAL', name: 'LAP Industrial Property', description: 'Loan against industrial property', icon: 'factory', min_amount: 2000000, max_amount: 500000000, display_order: 3, is_active: true },
      { category_code: 'MORTGAGE_LOANS', code: 'LAP_BALANCE_TRANSFER', name: 'LAP Balance Transfer', description: 'Transfer existing LAP', icon: 'refresh', min_amount: 500000, max_amount: 100000000, display_order: 4, is_active: true },
      { category_code: 'MORTGAGE_LOANS', code: 'LAP_TOP_UP', name: 'LAP Top Up', description: 'Additional loan on existing LAP', icon: 'plus-circle', min_amount: 200000, max_amount: 50000000, display_order: 5, is_active: true },

      // 5. Vehicle Loans (6 subcategories)
      { category_code: 'VEHICLE_LOANS', code: 'VL_NEW_CAR', name: 'New Car Loan', description: 'Loan for purchasing a new car', icon: 'car', min_amount: 100000, max_amount: 10000000, display_order: 1, is_active: true },
      { category_code: 'VEHICLE_LOANS', code: 'VL_USED_CAR', name: 'Used Car Loan', description: 'Loan for purchasing a used car', icon: 'car-side', min_amount: 50000, max_amount: 5000000, display_order: 2, is_active: true },
      { category_code: 'VEHICLE_LOANS', code: 'VL_TWO_WHEELER', name: 'Two Wheeler Loan', description: 'Loan for bikes and scooters', icon: 'motorcycle', min_amount: 20000, max_amount: 500000, display_order: 3, is_active: true },
      { category_code: 'VEHICLE_LOANS', code: 'VL_COMMERCIAL', name: 'Commercial Vehicle Loan', description: 'Loan for trucks, buses, tempos', icon: 'truck', min_amount: 500000, max_amount: 50000000, display_order: 4, is_active: true },
      { category_code: 'VEHICLE_LOANS', code: 'VL_THREE_WHEELER', name: 'Three Wheeler Loan', description: 'Loan for auto-rickshaws', icon: 'auto', min_amount: 50000, max_amount: 500000, display_order: 5, is_active: true },
      { category_code: 'VEHICLE_LOANS', code: 'VL_REFINANCE', name: 'Vehicle Refinance', description: 'Loan against existing vehicle', icon: 'refresh', min_amount: 50000, max_amount: 5000000, display_order: 6, is_active: true },

      // 6. Machinery / Equipment (4 subcategories)
      { category_code: 'MACHINERY_LOANS', code: 'ML_NEW', name: 'New Machinery Loan', description: 'Loan for purchasing new machinery', icon: 'cog', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true },
      { category_code: 'MACHINERY_LOANS', code: 'ML_USED', name: 'Used Machinery Loan', description: 'Loan for purchasing used machinery', icon: 'cog', min_amount: 200000, max_amount: 50000000, display_order: 2, is_active: true },
      { category_code: 'MACHINERY_LOANS', code: 'ML_EQUIPMENT', name: 'Equipment Finance', description: 'Financing for business equipment', icon: 'tools', min_amount: 100000, max_amount: 20000000, display_order: 3, is_active: true },
      { category_code: 'MACHINERY_LOANS', code: 'ML_MEDICAL', name: 'Medical Equipment Loan', description: 'Loan for medical equipment', icon: 'stethoscope', min_amount: 200000, max_amount: 50000000, display_order: 4, is_active: true },

      // 7. Professional Loans (5 subcategories)
      { category_code: 'PROFESSIONAL_LOANS', code: 'PRF_DOCTOR', name: 'Doctor Loan', description: 'Loan for medical professionals', icon: 'stethoscope', min_amount: 200000, max_amount: 30000000, display_order: 1, is_active: true },
      { category_code: 'PROFESSIONAL_LOANS', code: 'PRF_CA', name: 'CA / CS Loan', description: 'Loan for chartered accountants', icon: 'calculator', min_amount: 100000, max_amount: 20000000, display_order: 2, is_active: true },
      { category_code: 'PROFESSIONAL_LOANS', code: 'PRF_ARCHITECT', name: 'Architect / Engineer Loan', description: 'Loan for architects and engineers', icon: 'ruler', min_amount: 100000, max_amount: 20000000, display_order: 3, is_active: true },
      { category_code: 'PROFESSIONAL_LOANS', code: 'PRF_LAWYER', name: 'Lawyer Loan', description: 'Loan for legal professionals', icon: 'scale', min_amount: 100000, max_amount: 15000000, display_order: 4, is_active: true },
      { category_code: 'PROFESSIONAL_LOANS', code: 'PRF_CONSULTANT', name: 'Consultant Loan', description: 'Loan for consultants', icon: 'user-tie', min_amount: 100000, max_amount: 10000000, display_order: 5, is_active: true },

      // 8. NRI Loans (4 subcategories)
      { category_code: 'NRI_LOANS', code: 'NRI_HOME', name: 'NRI Home Loan', description: 'Home loan for NRIs', icon: 'home', min_amount: 1000000, max_amount: 100000000, display_order: 1, is_active: true },
      { category_code: 'NRI_LOANS', code: 'NRI_LAP', name: 'NRI LAP', description: 'Loan against property for NRIs', icon: 'building', min_amount: 1000000, max_amount: 100000000, display_order: 2, is_active: true },
      { category_code: 'NRI_LOANS', code: 'NRI_PLOT', name: 'NRI Plot Loan', description: 'Plot purchase loan for NRIs', icon: 'map', min_amount: 500000, max_amount: 50000000, display_order: 3, is_active: true },
      { category_code: 'NRI_LOANS', code: 'NRI_BALANCE_TRANSFER', name: 'NRI Balance Transfer', description: 'Transfer existing NRI loan', icon: 'refresh', min_amount: 1000000, max_amount: 100000000, display_order: 4, is_active: true },

      // 9. Educational Loans (4 subcategories)
      { category_code: 'EDUCATIONAL_LOANS', code: 'EL_DOMESTIC', name: 'Domestic Education Loan', description: 'Education loan for studies in India', icon: 'book', min_amount: 100000, max_amount: 5000000, display_order: 1, is_active: true },
      { category_code: 'EDUCATIONAL_LOANS', code: 'EL_ABROAD', name: 'Abroad Education Loan', description: 'Education loan for studies abroad', icon: 'globe', min_amount: 500000, max_amount: 20000000, display_order: 2, is_active: true },
      { category_code: 'EDUCATIONAL_LOANS', code: 'EL_SKILL', name: 'Skill Development Loan', description: 'Loan for professional courses', icon: 'certificate', min_amount: 50000, max_amount: 1000000, display_order: 3, is_active: true },
      { category_code: 'EDUCATIONAL_LOANS', code: 'EL_EXECUTIVE', name: 'Executive Education Loan', description: 'Loan for MBA/executive programs', icon: 'graduation-cap', min_amount: 500000, max_amount: 15000000, display_order: 4, is_active: true },

      // 10. Institution Loans (4 subcategories)
      { category_code: 'INSTITUTION_LOANS', code: 'INST_SCHOOL', name: 'School Infrastructure Loan', description: 'Loan for school infrastructure', icon: 'school', min_amount: 1000000, max_amount: 100000000, display_order: 1, is_active: true },
      { category_code: 'INSTITUTION_LOANS', code: 'INST_COLLEGE', name: 'College / University Loan', description: 'Loan for higher education institutions', icon: 'university', min_amount: 5000000, max_amount: 500000000, display_order: 2, is_active: true },
      { category_code: 'INSTITUTION_LOANS', code: 'INST_HOSPITAL', name: 'Hospital / Healthcare Loan', description: 'Loan for healthcare facilities', icon: 'hospital', min_amount: 5000000, max_amount: 500000000, display_order: 3, is_active: true },
      { category_code: 'INSTITUTION_LOANS', code: 'INST_TRUST', name: 'Trust / NGO Loan', description: 'Loan for trusts and NGOs', icon: 'hands-heart', min_amount: 500000, max_amount: 50000000, display_order: 4, is_active: true },

      // 11. Working Capital (4 subcategories)
      { category_code: 'WORKING_CAPITAL', code: 'WC_CC', name: 'Cash Credit', description: 'Cash credit facility', icon: 'currency-rupee', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true },
      { category_code: 'WORKING_CAPITAL', code: 'WC_OD', name: 'Overdraft Facility', description: 'Overdraft against collateral', icon: 'wallet', min_amount: 500000, max_amount: 50000000, display_order: 2, is_active: true },
      { category_code: 'WORKING_CAPITAL', code: 'WC_LC', name: 'Letter of Credit', description: 'LC facility for trade', icon: 'file-text', min_amount: 100000, max_amount: 50000000, display_order: 3, is_active: true },
      { category_code: 'WORKING_CAPITAL', code: 'WC_BG', name: 'Bank Guarantee', description: 'Bank guarantee facility', icon: 'shield-check', min_amount: 100000, max_amount: 100000000, display_order: 4, is_active: true },

      // 12. Loan Against Rentals (3 subcategories)
      { category_code: 'LOAN_AGAINST_RENTALS', code: 'LAR_RESIDENTIAL', name: 'Residential Rental Loan', description: 'Loan against residential rentals', icon: 'home', min_amount: 500000, max_amount: 50000000, display_order: 1, is_active: true },
      { category_code: 'LOAN_AGAINST_RENTALS', code: 'LAR_COMMERCIAL', name: 'Commercial Rental Loan', description: 'Loan against commercial rentals', icon: 'building', min_amount: 1000000, max_amount: 100000000, display_order: 2, is_active: true },
      { category_code: 'LOAN_AGAINST_RENTALS', code: 'LAR_LRD', name: 'Lease Rental Discounting', description: 'LRD for rental income', icon: 'file-contract', min_amount: 5000000, max_amount: 200000000, display_order: 3, is_active: true },

      // 13. Builder Loans (4 subcategories)
      { category_code: 'BUILDER_LOANS', code: 'BLD_CONSTRUCTION', name: 'Builder Construction Finance', description: 'Loan for project construction', icon: 'building', min_amount: 10000000, max_amount: 1000000000, display_order: 1, is_active: true },
      { category_code: 'BUILDER_LOANS', code: 'BLD_LAND', name: 'Builder Land Purchase', description: 'Loan for land acquisition', icon: 'map', min_amount: 5000000, max_amount: 500000000, display_order: 2, is_active: true },
      { category_code: 'BUILDER_LOANS', code: 'BLD_PLOTTED', name: 'Plotted Development Loan', description: 'Loan for plotted development', icon: 'grid', min_amount: 5000000, max_amount: 200000000, display_order: 3, is_active: true },
      { category_code: 'BUILDER_LOANS', code: 'BLD_COMMERCIAL', name: 'Commercial Project Finance', description: 'Loan for commercial projects', icon: 'building-office', min_amount: 10000000, max_amount: 1000000000, display_order: 4, is_active: true },

      // 14. Women Professional (3 subcategories)
      { category_code: 'WOMEN_PROFESSIONAL_LOANS', code: 'WPF_BUSINESS', name: 'Women Entrepreneur Loan', description: 'Business loan for women', icon: 'user-female', min_amount: 100000, max_amount: 20000000, display_order: 1, is_active: true },
      { category_code: 'WOMEN_PROFESSIONAL_LOANS', code: 'WPF_PROFESSIONAL', name: 'Women Professional Loan', description: 'Professional loan for women', icon: 'briefcase', min_amount: 100000, max_amount: 15000000, display_order: 2, is_active: true },
      { category_code: 'WOMEN_PROFESSIONAL_LOANS', code: 'WPF_MUDRA', name: 'Women Mudra Loan', description: 'Mudra loan for women', icon: 'hand-holding-usd', min_amount: 10000, max_amount: 1000000, display_order: 3, is_active: true },

      // 15. Govt Schemes (4 subcategories)
      { category_code: 'GOVT_SCHEMES', code: 'GOVT_MUDRA', name: 'Mudra Loan', description: 'Pradhan Mantri Mudra Yojana', icon: 'flag', min_amount: 10000, max_amount: 1000000, display_order: 1, is_active: true },
      { category_code: 'GOVT_SCHEMES', code: 'GOVT_STANDUP', name: 'Stand Up India', description: 'Stand Up India scheme', icon: 'flag', min_amount: 1000000, max_amount: 10000000, display_order: 2, is_active: true },
      { category_code: 'GOVT_SCHEMES', code: 'GOVT_PMEGP', name: 'PMEGP Loan', description: 'Prime Minister Employment Generation', icon: 'flag', min_amount: 100000, max_amount: 5000000, display_order: 3, is_active: true },
      { category_code: 'GOVT_SCHEMES', code: 'GOVT_CGTMSE', name: 'CGTMSE Scheme', description: 'Credit Guarantee Trust scheme', icon: 'shield', min_amount: 100000, max_amount: 20000000, display_order: 4, is_active: true },
    ];

    // Check existing subcategories
    const { data: existingSubcategories } = await supabase
      .from('ulap_loan_subcategories')
      .select('code');

    const existingCodes = new Set(existingSubcategories?.map(s => s.code) || []);

    // Transform subcategories to include category_id instead of category_code
    const subcategoriesToInsert = SUBCATEGORIES
      .filter(s => !existingCodes.has(s.code))
      .map(({ category_code, ...rest }) => ({
        ...rest,
        category_id: categoryMap.get(codeToSlug(category_code)),
      }))
      .filter(s => s.category_id); // Only include subcategories with valid category_id

    if (subcategoriesToInsert.length === 0) {
      return NextResponse.json({
        message: 'All subcategories already exist',
        existingCount: existingSubcategories?.length || 0,
        insertedCount: 0,
      });
    }

    // Insert in batches of 20 to avoid timeout
    const batchSize = 20;
    const insertedResults = [];

    for (let i = 0; i < subcategoriesToInsert.length; i += batchSize) {
      const batch = subcategoriesToInsert.slice(i, i + batchSize);
      const { data: insertedBatch, error: insertError } = await supabase
        .from('ulap_loan_subcategories')
        .insert(batch)
        .select();

      if (insertError) {
        apiLogger.error('Error inserting subcategories batch', insertError);
        return NextResponse.json(
          {
            error: 'Failed to insert subcategories',
            insertedSoFar: insertedResults.length,
          },
          { status: 500 }
        );
      }

      if (insertedBatch) {
        insertedResults.push(...insertedBatch);
      }
    }

    return NextResponse.json({
      message: 'Subcategories seeded successfully',
      existingCount: existingSubcategories?.length || 0,
      insertedCount: insertedResults.length,
      totalSubcategories: SUBCATEGORIES.length,
    });
  } catch (error) {
    apiLogger.error('Error in seed subcategories API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Return current subcategories from database
export async function GET() {
  try {
    const { data: subcategories, error } = await supabase
      .from('ulap_loan_subcategories')
      .select(`
        *,
        ulap_loan_categories (*)
      `);

    if (error) {
      apiLogger.error('Error fetching subcategories', error);
      return NextResponse.json(
        { error: 'Failed to fetch subcategories' },
        { status: 500 }
      );
    }

    // Group by category
    const byCategory: Record<string, typeof subcategories> = {};
    subcategories?.forEach(sub => {
      const catName = sub.ulap_loan_categories?.name || 'Unknown';
      if (!byCategory[catName]) {
        byCategory[catName] = [];
      }
      byCategory[catName].push(sub);
    });

    return NextResponse.json({
      subcategories: subcategories || [],
      count: subcategories?.length || 0,
      byCategory,
    });
  } catch (error) {
    apiLogger.error('Error in get subcategories API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
