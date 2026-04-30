
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all categories (with optional subcategories)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSubcategories = searchParams.get('include_subcategories') !== 'false';

    let query = supabase.from('ulap_loan_categories').select(
      includeSubcategories
        ? `
          *,
          ulap_loan_subcategories (id, name, slug, description, image_url, is_active)
        `
        : '*'
    );

    query = query.eq('is_active', true).order('display_order');

    const { data: categories, error } = await query;

    if (error) {
      apiLogger.error('Error fetching categories', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
    }

    return NextResponse.json({ categories: categories || [] });
  } catch (error) {
    apiLogger.error('Error in categories API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
