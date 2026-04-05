export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all active loan categories with their subcategories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSubcategories = searchParams.get('include_subcategories') === 'true';

    // Build query for loan categories
    // Select all columns from the table using *
    const query = supabase
      .from('ulap_loan_categories')
      .select(includeSubcategories ? `
        *,
        ulap_loan_subcategories (*)
      ` : `*`)
      .eq('is_active', true)
      .order('display_order');

    const { data: categories, error } = await query;

    if (error) {
      apiLogger.error('Error fetching loan categories', error);
      return NextResponse.json(
        { error: 'Failed to fetch loan categories' },
        { status: 500 }
      );
    }

    // Filter out inactive subcategories if included
    const filteredCategories = categories?.map(category => {
      if (includeSubcategories && category.ulap_loan_subcategories) {
        return {
          ...category,
          ulap_loan_subcategories: category.ulap_loan_subcategories.filter(
            (sub: { is_active: boolean }) => sub.is_active
          ),
        };
      }
      return category;
    }) || [];

    return NextResponse.json({
      categories: filteredCategories,
      count: filteredCategories.length,
    });
  } catch (error) {
    apiLogger.error('Error in loan categories API', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
