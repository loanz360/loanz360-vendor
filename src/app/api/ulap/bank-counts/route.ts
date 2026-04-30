
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default bank counts per category (fallback if database query fails)
// These represent the number of banks/NBFCs partnered for each loan category
const DEFAULT_BANK_COUNTS: Record<string, number> = {
  'cat-personal': 25,      // Personal Loans - many lenders
  'cat-business': 22,      // Business Loans
  'cat-home': 30,          // Home Loans - highest coverage
  'cat-mortgage': 28,      // Mortgage / LAP
  'cat-vehicle': 18,       // Vehicle Loans
  'cat-machinery': 12,     // Machinery / Equipment
  'cat-professional': 15,  // Professional Loans
  'cat-nri': 10,           // NRI Loans
  'cat-education': 14,     // Educational Loans
  'cat-institution': 8,    // Institution Loans
  'cat-working-capital': 16, // Working Capital
  'cat-rentals': 10,       // Loan Against Rentals
  'cat-builder': 12,       // Builder Loans
  'cat-women': 14,         // Women Professional
  'cat-govt': 8,           // Govt Schemes
  // UUIDs from migration (014_ulap_loan_categories.sql)
  'cat-01-personal': 25,
  'cat-02-business': 22,
  'cat-03-home': 30,
  'cat-04-mortgage': 28,
  'cat-05-vehicle': 18,
  'cat-06-machinery': 12,
  'cat-07-professional': 15,
  'cat-08-nri': 10,
  'cat-09-education': 14,
  'cat-10-institution': 8,
  'cat-11-working-capital': 16,
  'cat-12-rentals': 10,
  'cat-13-builder': 12,
  'cat-14-women': 14,
  'cat-15-govt': 8,
};

/**
 * GET - Fetch bank/NBFC counts per loan category
 * Returns the number of banks and NBFCs that offer loans in each category
 */
export async function GET() {
  try {
    // Try to get actual bank counts from ulap_bank_rates table
    // This table links banks to subcategories, so we need to aggregate
    const { data: bankRates, error: bankRatesError } = await supabase
      .from('ulap_bank_rates')
      .select(`
        bank_id,
        subcategory_id,
        ulap_loan_subcategories!inner (
          category_id
        )
      `)
      .eq('is_active', true);

    if (!bankRatesError && bankRates && bankRates.length > 0) {
      // Count unique banks per category
      const bankCountsMap: Record<string, Set<string>> = {};

      bankRates.forEach((rate: { bank_id: string; ulap_loan_subcategories: { category_id: string } }) => {
        const categoryId = rate.ulap_loan_subcategories?.category_id;
        if (categoryId) {
          if (!bankCountsMap[categoryId]) {
            bankCountsMap[categoryId] = new Set();
          }
          bankCountsMap[categoryId].add(rate.bank_id);
        }
      });

      // Convert Sets to counts
      const bankCounts: Record<string, number> = {};
      Object.entries(bankCountsMap).forEach(([categoryId, bankSet]) => {
        bankCounts[categoryId] = bankSet.size;
      });

      return NextResponse.json({
        bankCounts,
        totalBanks: new Set(bankRates.map(r => r.bank_id)).size,
        source: 'database',
      });
    }

    // Alternative: Try to count from ulap_banks table
    const { data: banks, error: banksError } = await supabase
      .from('ulap_banks')
      .select('id')
      .eq('is_active', true);

    if (!banksError && banks && banks.length > 0) {
      const totalBanks = banks.length;

      // Distribute banks proportionally across categories based on defaults
      const totalDefaultCount = Object.values(DEFAULT_BANK_COUNTS).reduce((a, b) => a + b, 0) / 2; // Divide by 2 since we have both cat-xxx and cat-0x-xxx
      const scaleFactor = totalBanks / (totalDefaultCount / 15); // Average per category

      const bankCounts: Record<string, number> = {};
      Object.entries(DEFAULT_BANK_COUNTS).forEach(([key, value]) => {
        bankCounts[key] = Math.max(1, Math.round(value * scaleFactor / 15));
      });

      return NextResponse.json({
        bankCounts,
        totalBanks,
        source: 'estimated',
      });
    }

    // Fallback to default counts
    return NextResponse.json({
      bankCounts: DEFAULT_BANK_COUNTS,
      totalBanks: 45,
      source: 'fallback',
    });
  } catch (error) {
    apiLogger.error('Error fetching bank counts', error);

    // Return fallback on any error
    return NextResponse.json({
      bankCounts: DEFAULT_BANK_COUNTS,
      totalBanks: 45,
      source: 'fallback',
    });
  }
}
