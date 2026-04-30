
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All 15 loan categories - matching actual DB schema (id, name, slug, description, icon, display_order, is_active)
// Note: The actual table uses 'slug' field with hyphenated format like 'personal-loans'
const CATEGORIES = [
  {
    slug: 'personal-loans',
    name: 'Personal Loans',
    description: 'Unsecured loans for personal expenses, emergencies, travel, or consolidating debts.',
    icon: 'user',
    display_order: 1,
    is_active: true,
  },
  {
    slug: 'business-loans',
    name: 'Business Loans',
    description: 'Financing solutions for business expansion, working capital, and equipment purchase.',
    icon: 'briefcase',
    display_order: 2,
    is_active: true,
  },
  {
    slug: 'home-loans',
    name: 'Home Loans',
    description: 'Loans for purchasing, constructing, or renovating your dream home.',
    icon: 'home',
    display_order: 3,
    is_active: true,
  },
  {
    slug: 'mortgage-lap',
    name: 'Mortgage / LAP',
    description: 'Loans against property for high-value financing needs with property as collateral.',
    icon: 'building',
    display_order: 4,
    is_active: true,
  },
  {
    slug: 'vehicle-loans',
    name: 'Vehicle Loans',
    description: 'Financing for cars, two-wheelers, and commercial vehicles.',
    icon: 'car',
    display_order: 5,
    is_active: true,
  },
  {
    slug: 'machinery-equipment',
    name: 'Machinery / Equipment',
    description: 'Loans for purchasing industrial equipment and machinery.',
    icon: 'cog',
    display_order: 6,
    is_active: true,
  },
  {
    slug: 'professional-loans',
    name: 'Professional Loans',
    description: 'Specialized loans for doctors, CAs, lawyers, and other professionals.',
    icon: 'user-tie',
    display_order: 7,
    is_active: true,
  },
  {
    slug: 'nri-loans',
    name: 'NRI Loans',
    description: 'Home loans and LAP for Non-Resident Indians.',
    icon: 'globe',
    display_order: 8,
    is_active: true,
  },
  {
    slug: 'educational-loans',
    name: 'Educational Loans',
    description: 'Loans for domestic and international education expenses.',
    icon: 'academic-cap',
    display_order: 9,
    is_active: true,
  },
  {
    slug: 'institution-loans',
    name: 'Institution Loans',
    description: 'Loans for schools, colleges, hospitals, and trusts.',
    icon: 'library',
    display_order: 10,
    is_active: true,
  },
  {
    slug: 'working-capital',
    name: 'Working Capital',
    description: 'Short-term financing to manage day-to-day business operations.',
    icon: 'currency-rupee',
    display_order: 11,
    is_active: true,
  },
  {
    slug: 'loan-against-rentals',
    name: 'Loan Against Rentals',
    description: 'Loans against rental income from residential or commercial properties.',
    icon: 'key',
    display_order: 12,
    is_active: true,
  },
  {
    slug: 'builder-loans',
    name: 'Builder Loans',
    description: 'Project finance for builders and real estate developers.',
    icon: 'building-office',
    display_order: 13,
    is_active: true,
  },
  {
    slug: 'women-professional',
    name: 'Women Professional',
    description: 'Special loan schemes for women entrepreneurs and professionals.',
    icon: 'user-female',
    display_order: 14,
    is_active: true,
  },
  {
    slug: 'govt-schemes',
    name: 'Govt Schemes',
    description: 'Government-backed loan schemes like Mudra, Stand Up India, PMEGP.',
    icon: 'flag',
    display_order: 15,
    is_active: true,
  },
];

// POST - Seed all categories to database
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Check if we're in production and require authorization
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.SEED_API_TOKEN || 'seed-categories-2024';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First, check existing categories
    const { data: existingCategories } = await supabase
      .from('ulap_loan_categories')
      .select('slug');

    const existingSlugs = new Set(existingCategories?.map(c => c.slug) || []);

    // Filter out categories that already exist
    const newCategories = CATEGORIES.filter(c => !existingSlugs.has(c.slug));

    if (newCategories.length === 0) {
      return NextResponse.json({
        message: 'All categories already exist',
        existingCount: existingCategories?.length || 0,
        insertedCount: 0,
      });
    }

    // Insert new categories
    const { data: insertedCategories, error: insertError } = await supabase
      .from('ulap_loan_categories')
      .insert(newCategories)
      .select();

    if (insertError) {
      apiLogger.error('Error inserting categories', insertError);
      return NextResponse.json(
        { error: 'Failed to insert categories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Categories seeded successfully',
      existingCount: existingCategories?.length || 0,
      insertedCount: insertedCategories?.length || 0,
      insertedCategories: insertedCategories,
    });
  } catch (error) {
    apiLogger.error('Error in seed categories API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Return current categories from database
export async function GET() {
  try {
    const { data: categories, error } = await supabase
      .from('ulap_loan_categories')
      .select('*')
      .order('display_order');

    if (error) {
      apiLogger.error('Error fetching categories', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      categories: categories || [],
      count: categories?.length || 0,
    });
  } catch (error) {
    apiLogger.error('Error in get categories API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
