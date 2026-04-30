
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all ULAP data (categories, subcategories, banks, rates)
export async function GET() {
  try {
    // Fetch categories with subcategories
    const { data: categories, error: catError } = await supabase
      .from('ulap_loan_categories')
      .select(`
        id,
        name,
        slug,
        description,
        image_url,
        icon,
        display_order,
        ulap_loan_subcategories (
          id,
          name,
          slug,
          description,
          image_url,
          display_order
        )
      `)
      .eq('is_active', true)
      .order('display_order');

    if (catError) {
      apiLogger.error('Error fetching categories', catError);
      return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Transform categories to include subcategories array
    const transformedCategories = (categories || []).map((cat) => ({
      ...cat,
      subcategories: cat.ulap_loan_subcategories || [],
    }));

    // Fetch banks
    const { data: banks, error: bankError } = await supabase
      .from('ulap_banks')
      .select('id, name, short_code, logo_url, type, website_url')
      .eq('is_active', true)
      .order('display_order');

    if (bankError) {
      apiLogger.error('Error fetching banks', bankError);
      return NextResponse.json({ success: false, error: 'Failed to fetch banks' }, { status: 500 });
    }

    // Fetch loan details for all subcategories
    const { data: loanDetails, error: detailsError } = await supabase
      .from('ulap_loan_details')
      .select('*');

    if (detailsError) {
      apiLogger.error('Error fetching loan details', detailsError);
    }

    // Transform loan details to a map by subcategory_id
    const loanDetailsMap: Record<string, unknown> = {};
    (loanDetails || []).forEach((detail) => {
      loanDetailsMap[detail.subcategory_id] = detail;
    });

    // Fetch bank rates with bank info
    const { data: bankRates, error: ratesError } = await supabase
      .from('ulap_bank_rates')
      .select(`
        id,
        bank_id,
        subcategory_id,
        interest_rate_min,
        interest_rate_max,
        processing_fee,
        max_amount,
        max_tenure,
        ulap_banks (
          id,
          name,
          short_code,
          logo_url,
          type
        )
      `)
      .eq('is_active', true);

    if (ratesError) {
      apiLogger.error('Error fetching bank rates', ratesError);
    }

    // Transform bank rates to a map by subcategory_id
    const bankRatesMap: Record<string, unknown[]> = {};
    (bankRates || []).forEach((rate) => {
      if (!bankRatesMap[rate.subcategory_id]) {
        bankRatesMap[rate.subcategory_id] = [];
      }
      bankRatesMap[rate.subcategory_id].push({
        ...rate,
        bank: rate.ulap_banks,
      });
    });

    return NextResponse.json({
      categories: transformedCategories,
      banks: banks || [],
      loanDetails: loanDetailsMap,
      bankRates: bankRatesMap,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    apiLogger.error('Error in ULAP API', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
