
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default loan categories for fallback - All 15 categories
const DEFAULT_CATEGORIES = [
  {
    id: 'cat-personal',
    name: 'Personal Loans',
    code: 'PERSONAL_LOANS',
    color: '#3B82F6',
    icon: 'user',
  },
  {
    id: 'cat-business',
    name: 'Business Loans',
    code: 'BUSINESS_LOANS',
    color: '#8B5CF6',
    icon: 'briefcase',
  },
  {
    id: 'cat-home',
    name: 'Home Loans',
    code: 'HOME_LOANS',
    color: '#10B981',
    icon: 'home',
  },
  {
    id: 'cat-mortgage',
    name: 'Mortgage / LAP',
    code: 'MORTGAGE_LAP',
    color: '#F59E0B',
    icon: 'building',
  },
  {
    id: 'cat-vehicle',
    name: 'Vehicle Loans',
    code: 'VEHICLE_LOANS',
    color: '#EF4444',
    icon: 'car',
  },
  {
    id: 'cat-machinery',
    name: 'Machinery / Equipment',
    code: 'MACHINERY_EQUIPMENT',
    color: '#6366F1',
    icon: 'cog',
  },
  {
    id: 'cat-professional',
    name: 'Professional Loans',
    code: 'PROFESSIONAL_LOANS',
    color: '#EC4899',
    icon: 'user-tie',
  },
  {
    id: 'cat-nri',
    name: 'NRI Loans',
    code: 'NRI_LOANS',
    color: '#14B8A6',
    icon: 'globe',
  },
  {
    id: 'cat-education',
    name: 'Educational Loans',
    code: 'EDUCATIONAL_LOANS',
    color: '#06B6D4',
    icon: 'academic-cap',
  },
  {
    id: 'cat-institution',
    name: 'Institution Loans',
    code: 'INSTITUTION_LOANS',
    color: '#A855F7',
    icon: 'library',
  },
  {
    id: 'cat-working-capital',
    name: 'Working Capital',
    code: 'WORKING_CAPITAL',
    color: '#F97316',
    icon: 'currency-rupee',
  },
  {
    id: 'cat-rentals',
    name: 'Loan Against Rentals',
    code: 'LOAN_AGAINST_RENTALS',
    color: '#84CC16',
    icon: 'key',
  },
  {
    id: 'cat-builder',
    name: 'Builder Loans',
    code: 'BUILDER_LOANS',
    color: '#0EA5E9',
    icon: 'building-office',
  },
  {
    id: 'cat-women',
    name: 'Women Professional',
    code: 'WOMEN_PROFESSIONAL',
    color: '#D946EF',
    icon: 'user-female',
  },
  {
    id: 'cat-govt',
    name: 'Govt Schemes',
    code: 'GOVT_SCHEMES',
    color: '#22C55E',
    icon: 'flag',
  },
];

// Default subcategories for fallback - All 66 subcategories across 15 categories
const DEFAULT_SUBCATEGORIES = [
  // 1. Personal Loans (5 subcategories)
  { id: 'sub-pl-salaried', category_id: 'cat-personal', name: 'Salaried Personal Loan', code: 'PL_SALARIED', description: 'Personal loan for salaried individuals', icon: 'user', min_amount: 50000, max_amount: 4000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[0] },
  { id: 'sub-pl-self-employed', category_id: 'cat-personal', name: 'Self Employed Personal Loan', code: 'PL_SELF_EMPLOYED', description: 'Personal loan for self-employed individuals', icon: 'briefcase', min_amount: 100000, max_amount: 5000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[0] },
  { id: 'sub-pl-pension', category_id: 'cat-personal', name: 'Pensioner Personal Loan', code: 'PL_PENSION', description: 'Personal loan for pensioners', icon: 'user-clock', min_amount: 50000, max_amount: 2000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[0] },
  { id: 'sub-pl-balance-transfer', category_id: 'cat-personal', name: 'Personal Loan Balance Transfer', code: 'PL_BALANCE_TRANSFER', description: 'Transfer existing personal loan for better rates', icon: 'refresh', min_amount: 50000, max_amount: 4000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[0] },
  { id: 'sub-pl-top-up', category_id: 'cat-personal', name: 'Personal Loan Top Up', code: 'PL_TOP_UP', description: 'Additional loan on existing personal loan', icon: 'plus-circle', min_amount: 25000, max_amount: 2000000, display_order: 5, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[0] },

  // 2. Business Loans (7 subcategories)
  { id: 'sub-bl-sme', category_id: 'cat-business', name: 'SME / MSME Loan', code: 'BL_SME', description: 'Loan for small and medium enterprises', icon: 'building', min_amount: 500000, max_amount: 50000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },
  { id: 'sub-bl-unsecured', category_id: 'cat-business', name: 'Unsecured Business Loan', code: 'BL_UNSECURED', description: 'Business loan without collateral', icon: 'shield-off', min_amount: 100000, max_amount: 5000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },
  { id: 'sub-bl-secured', category_id: 'cat-business', name: 'Secured Business Loan', code: 'BL_SECURED', description: 'Business loan with collateral', icon: 'shield', min_amount: 500000, max_amount: 100000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },
  { id: 'sub-bl-startup', category_id: 'cat-business', name: 'Startup Loan', code: 'BL_STARTUP', description: 'Loan for new business ventures', icon: 'rocket', min_amount: 500000, max_amount: 20000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },
  { id: 'sub-bl-invoice', category_id: 'cat-business', name: 'Invoice Discounting', code: 'BL_INVOICE', description: 'Financing against unpaid invoices', icon: 'file-invoice', min_amount: 100000, max_amount: 10000000, display_order: 5, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },
  { id: 'sub-bl-merchant', category_id: 'cat-business', name: 'Merchant Cash Advance', code: 'BL_MERCHANT', description: 'Advance based on card sales', icon: 'credit-card', min_amount: 50000, max_amount: 5000000, display_order: 6, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },
  { id: 'sub-bl-overdraft', category_id: 'cat-business', name: 'Business Overdraft', code: 'BL_OVERDRAFT', description: 'Flexible overdraft facility', icon: 'wallet', min_amount: 100000, max_amount: 10000000, display_order: 7, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[1] },

  // 3. Home Loans (6 subcategories)
  { id: 'sub-hl-purchase', category_id: 'cat-home', name: 'Home Purchase Loan', code: 'HL_PURCHASE', description: 'Loan for buying a ready home', icon: 'home', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[2] },
  { id: 'sub-hl-construction', category_id: 'cat-home', name: 'Home Construction Loan', code: 'HL_CONSTRUCTION', description: 'Loan for constructing a home', icon: 'building', min_amount: 500000, max_amount: 50000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[2] },
  { id: 'sub-hl-extension', category_id: 'cat-home', name: 'Home Extension Loan', code: 'HL_EXTENSION', description: 'Loan for extending existing home', icon: 'expand', min_amount: 200000, max_amount: 20000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[2] },
  { id: 'sub-hl-improvement', category_id: 'cat-home', name: 'Home Improvement Loan', code: 'HL_IMPROVEMENT', description: 'Loan for renovating your home', icon: 'paint-brush', min_amount: 100000, max_amount: 10000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[2] },
  { id: 'sub-hl-balance-transfer', category_id: 'cat-home', name: 'Home Loan Balance Transfer', code: 'HL_BALANCE_TRANSFER', description: 'Transfer existing home loan', icon: 'refresh', min_amount: 500000, max_amount: 100000000, display_order: 5, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[2] },
  { id: 'sub-hl-top-up', category_id: 'cat-home', name: 'Home Loan Top Up', code: 'HL_TOP_UP', description: 'Additional loan on existing home loan', icon: 'plus-circle', min_amount: 200000, max_amount: 30000000, display_order: 6, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[2] },

  // 4. Mortgage / LAP (5 subcategories)
  { id: 'sub-lap-residential', category_id: 'cat-mortgage', name: 'LAP Residential Property', code: 'LAP_RESIDENTIAL', description: 'Loan against residential property', icon: 'home', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[3] },
  { id: 'sub-lap-commercial', category_id: 'cat-mortgage', name: 'LAP Commercial Property', code: 'LAP_COMMERCIAL', description: 'Loan against commercial property', icon: 'building', min_amount: 1000000, max_amount: 200000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[3] },
  { id: 'sub-lap-industrial', category_id: 'cat-mortgage', name: 'LAP Industrial Property', code: 'LAP_INDUSTRIAL', description: 'Loan against industrial property', icon: 'factory', min_amount: 2000000, max_amount: 500000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[3] },
  { id: 'sub-lap-balance-transfer', category_id: 'cat-mortgage', name: 'LAP Balance Transfer', code: 'LAP_BALANCE_TRANSFER', description: 'Transfer existing LAP', icon: 'refresh', min_amount: 500000, max_amount: 100000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[3] },
  { id: 'sub-lap-top-up', category_id: 'cat-mortgage', name: 'LAP Top Up', code: 'LAP_TOP_UP', description: 'Additional loan on existing LAP', icon: 'plus-circle', min_amount: 200000, max_amount: 50000000, display_order: 5, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[3] },

  // 5. Vehicle Loans (6 subcategories)
  { id: 'sub-vl-new-car', category_id: 'cat-vehicle', name: 'New Car Loan', code: 'VL_NEW_CAR', description: 'Loan for purchasing a new car', icon: 'car', min_amount: 100000, max_amount: 10000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[4] },
  { id: 'sub-vl-used-car', category_id: 'cat-vehicle', name: 'Used Car Loan', code: 'VL_USED_CAR', description: 'Loan for purchasing a used car', icon: 'car-side', min_amount: 50000, max_amount: 5000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[4] },
  { id: 'sub-vl-two-wheeler', category_id: 'cat-vehicle', name: 'Two Wheeler Loan', code: 'VL_TWO_WHEELER', description: 'Loan for bikes and scooters', icon: 'motorcycle', min_amount: 20000, max_amount: 500000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[4] },
  { id: 'sub-vl-commercial', category_id: 'cat-vehicle', name: 'Commercial Vehicle Loan', code: 'VL_COMMERCIAL', description: 'Loan for trucks, buses, tempos', icon: 'truck', min_amount: 500000, max_amount: 50000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[4] },
  { id: 'sub-vl-three-wheeler', category_id: 'cat-vehicle', name: 'Three Wheeler Loan', code: 'VL_THREE_WHEELER', description: 'Loan for auto-rickshaws', icon: 'auto', min_amount: 50000, max_amount: 500000, display_order: 5, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[4] },
  { id: 'sub-vl-refinance', category_id: 'cat-vehicle', name: 'Vehicle Refinance', code: 'VL_REFINANCE', description: 'Loan against existing vehicle', icon: 'refresh', min_amount: 50000, max_amount: 5000000, display_order: 6, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[4] },

  // 6. Machinery / Equipment (4 subcategories)
  { id: 'sub-ml-new', category_id: 'cat-machinery', name: 'New Machinery Loan', code: 'ML_NEW', description: 'Loan for purchasing new machinery', icon: 'cog', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[5] },
  { id: 'sub-ml-used', category_id: 'cat-machinery', name: 'Used Machinery Loan', code: 'ML_USED', description: 'Loan for purchasing used machinery', icon: 'cog', min_amount: 200000, max_amount: 50000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[5] },
  { id: 'sub-ml-equipment', category_id: 'cat-machinery', name: 'Equipment Finance', code: 'ML_EQUIPMENT', description: 'Financing for business equipment', icon: 'tools', min_amount: 100000, max_amount: 20000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[5] },
  { id: 'sub-ml-medical', category_id: 'cat-machinery', name: 'Medical Equipment Loan', code: 'ML_MEDICAL', description: 'Loan for medical equipment', icon: 'stethoscope', min_amount: 200000, max_amount: 50000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[5] },

  // 7. Professional Loans (5 subcategories)
  { id: 'sub-prf-doctor', category_id: 'cat-professional', name: 'Doctor Loan', code: 'PRF_DOCTOR', description: 'Loan for medical professionals', icon: 'stethoscope', min_amount: 200000, max_amount: 30000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[6] },
  { id: 'sub-prf-ca', category_id: 'cat-professional', name: 'CA / CS Loan', code: 'PRF_CA', description: 'Loan for chartered accountants', icon: 'calculator', min_amount: 100000, max_amount: 20000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[6] },
  { id: 'sub-prf-architect', category_id: 'cat-professional', name: 'Architect / Engineer Loan', code: 'PRF_ARCHITECT', description: 'Loan for architects and engineers', icon: 'ruler', min_amount: 100000, max_amount: 20000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[6] },
  { id: 'sub-prf-lawyer', category_id: 'cat-professional', name: 'Lawyer Loan', code: 'PRF_LAWYER', description: 'Loan for legal professionals', icon: 'scale', min_amount: 100000, max_amount: 15000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[6] },
  { id: 'sub-prf-consultant', category_id: 'cat-professional', name: 'Consultant Loan', code: 'PRF_CONSULTANT', description: 'Loan for consultants', icon: 'user-tie', min_amount: 100000, max_amount: 10000000, display_order: 5, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[6] },

  // 8. NRI Loans (4 subcategories)
  { id: 'sub-nri-home', category_id: 'cat-nri', name: 'NRI Home Loan', code: 'NRI_HOME', description: 'Home loan for NRIs', icon: 'home', min_amount: 1000000, max_amount: 100000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[7] },
  { id: 'sub-nri-lap', category_id: 'cat-nri', name: 'NRI LAP', code: 'NRI_LAP', description: 'Loan against property for NRIs', icon: 'building', min_amount: 1000000, max_amount: 100000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[7] },
  { id: 'sub-nri-plot', category_id: 'cat-nri', name: 'NRI Plot Loan', code: 'NRI_PLOT', description: 'Plot purchase loan for NRIs', icon: 'map', min_amount: 500000, max_amount: 50000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[7] },
  { id: 'sub-nri-balance-transfer', category_id: 'cat-nri', name: 'NRI Balance Transfer', code: 'NRI_BALANCE_TRANSFER', description: 'Transfer existing NRI loan', icon: 'refresh', min_amount: 1000000, max_amount: 100000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[7] },

  // 9. Educational Loans (4 subcategories)
  { id: 'sub-el-domestic', category_id: 'cat-education', name: 'Domestic Education Loan', code: 'EL_DOMESTIC', description: 'Education loan for studies in India', icon: 'book', min_amount: 100000, max_amount: 5000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[8] },
  { id: 'sub-el-abroad', category_id: 'cat-education', name: 'Abroad Education Loan', code: 'EL_ABROAD', description: 'Education loan for studies abroad', icon: 'globe', min_amount: 500000, max_amount: 20000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[8] },
  { id: 'sub-el-skill', category_id: 'cat-education', name: 'Skill Development Loan', code: 'EL_SKILL', description: 'Loan for professional courses', icon: 'certificate', min_amount: 50000, max_amount: 1000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[8] },
  { id: 'sub-el-executive', category_id: 'cat-education', name: 'Executive Education Loan', code: 'EL_EXECUTIVE', description: 'Loan for MBA/executive programs', icon: 'graduation-cap', min_amount: 500000, max_amount: 15000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[8] },

  // 10. Institution Loans (4 subcategories)
  { id: 'sub-inst-school', category_id: 'cat-institution', name: 'School Infrastructure Loan', code: 'INST_SCHOOL', description: 'Loan for school infrastructure', icon: 'school', min_amount: 1000000, max_amount: 100000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[9] },
  { id: 'sub-inst-college', category_id: 'cat-institution', name: 'College / University Loan', code: 'INST_COLLEGE', description: 'Loan for higher education institutions', icon: 'university', min_amount: 5000000, max_amount: 500000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[9] },
  { id: 'sub-inst-hospital', category_id: 'cat-institution', name: 'Hospital / Healthcare Loan', code: 'INST_HOSPITAL', description: 'Loan for healthcare facilities', icon: 'hospital', min_amount: 5000000, max_amount: 500000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[9] },
  { id: 'sub-inst-trust', category_id: 'cat-institution', name: 'Trust / NGO Loan', code: 'INST_TRUST', description: 'Loan for trusts and NGOs', icon: 'hands-heart', min_amount: 500000, max_amount: 50000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[9] },

  // 11. Working Capital (4 subcategories)
  { id: 'sub-wc-cc', category_id: 'cat-working-capital', name: 'Cash Credit', code: 'WC_CC', description: 'Cash credit facility', icon: 'currency-rupee', min_amount: 500000, max_amount: 100000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[10] },
  { id: 'sub-wc-od', category_id: 'cat-working-capital', name: 'Overdraft Facility', code: 'WC_OD', description: 'Overdraft against collateral', icon: 'wallet', min_amount: 500000, max_amount: 50000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[10] },
  { id: 'sub-wc-lc', category_id: 'cat-working-capital', name: 'Letter of Credit', code: 'WC_LC', description: 'LC facility for trade', icon: 'file-text', min_amount: 100000, max_amount: 50000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[10] },
  { id: 'sub-wc-bg', category_id: 'cat-working-capital', name: 'Bank Guarantee', code: 'WC_BG', description: 'Bank guarantee facility', icon: 'shield-check', min_amount: 100000, max_amount: 100000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[10] },

  // 12. Loan Against Rentals (3 subcategories)
  { id: 'sub-lar-residential', category_id: 'cat-rentals', name: 'Residential Rental Loan', code: 'LAR_RESIDENTIAL', description: 'Loan against residential rentals', icon: 'home', min_amount: 500000, max_amount: 50000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[11] },
  { id: 'sub-lar-commercial', category_id: 'cat-rentals', name: 'Commercial Rental Loan', code: 'LAR_COMMERCIAL', description: 'Loan against commercial rentals', icon: 'building', min_amount: 1000000, max_amount: 100000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[11] },
  { id: 'sub-lar-lease', category_id: 'cat-rentals', name: 'Lease Rental Discounting', code: 'LAR_LRD', description: 'LRD for rental income', icon: 'file-contract', min_amount: 5000000, max_amount: 200000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[11] },

  // 13. Builder Loans (4 subcategories)
  { id: 'sub-bld-construction', category_id: 'cat-builder', name: 'Builder Construction Finance', code: 'BLD_CONSTRUCTION', description: 'Loan for project construction', icon: 'building', min_amount: 10000000, max_amount: 1000000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[12] },
  { id: 'sub-bld-land', category_id: 'cat-builder', name: 'Builder Land Purchase', code: 'BLD_LAND', description: 'Loan for land acquisition', icon: 'map', min_amount: 5000000, max_amount: 500000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[12] },
  { id: 'sub-bld-plotted', category_id: 'cat-builder', name: 'Plotted Development Loan', code: 'BLD_PLOTTED', description: 'Loan for plotted development', icon: 'grid', min_amount: 5000000, max_amount: 200000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[12] },
  { id: 'sub-bld-commercial', category_id: 'cat-builder', name: 'Commercial Project Finance', code: 'BLD_COMMERCIAL', description: 'Loan for commercial projects', icon: 'building-office', min_amount: 10000000, max_amount: 1000000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[12] },

  // 14. Women Professional (3 subcategories)
  { id: 'sub-wpf-business', category_id: 'cat-women', name: 'Women Entrepreneur Loan', code: 'WPF_BUSINESS', description: 'Business loan for women', icon: 'user-female', min_amount: 100000, max_amount: 20000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[13] },
  { id: 'sub-wpf-professional', category_id: 'cat-women', name: 'Women Professional Loan', code: 'WPF_PROFESSIONAL', description: 'Professional loan for women', icon: 'briefcase', min_amount: 100000, max_amount: 15000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[13] },
  { id: 'sub-wpf-mudra', category_id: 'cat-women', name: 'Women Mudra Loan', code: 'WPF_MUDRA', description: 'Mudra loan for women', icon: 'hand-holding-usd', min_amount: 10000, max_amount: 1000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[13] },

  // 15. Govt Schemes (4 subcategories)
  { id: 'sub-govt-mudra', category_id: 'cat-govt', name: 'Mudra Loan', code: 'GOVT_MUDRA', description: 'Pradhan Mantri Mudra Yojana', icon: 'flag', min_amount: 10000, max_amount: 1000000, display_order: 1, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[14] },
  { id: 'sub-govt-standup', category_id: 'cat-govt', name: 'Stand Up India', code: 'GOVT_STANDUP', description: 'Stand Up India scheme', icon: 'flag', min_amount: 1000000, max_amount: 10000000, display_order: 2, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[14] },
  { id: 'sub-govt-pmegp', category_id: 'cat-govt', name: 'PMEGP Loan', code: 'GOVT_PMEGP', description: 'Prime Minister Employment Generation', icon: 'flag', min_amount: 100000, max_amount: 5000000, display_order: 3, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[14] },
  { id: 'sub-govt-cgtmse', category_id: 'cat-govt', name: 'CGTMSE Scheme', code: 'GOVT_CGTMSE', description: 'Credit Guarantee Trust scheme', icon: 'shield', min_amount: 100000, max_amount: 20000000, display_order: 4, is_active: true, ulap_loan_categories: DEFAULT_CATEGORIES[14] },
];

// GET - Fetch all active loan subcategories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    // Build query for loan subcategories - select all columns
    let query = supabase
      .from('ulap_loan_subcategories')
      .select(`
        *,
        ulap_loan_categories (*)
      `)
      .eq('is_active', true)
      .order('display_order');

    // Filter by category if provided
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data: subcategories, error } = await query;

    if (error) {
      apiLogger.error('Error fetching loan subcategories', error);
      // Return fallback data on error
      const fallbackSubcategories = categoryId
        ? DEFAULT_SUBCATEGORIES.filter((s) => s.category_id === categoryId)
        : DEFAULT_SUBCATEGORIES;
      return NextResponse.json({
        subcategories: fallbackSubcategories,
        count: fallbackSubcategories.length,
        categories: DEFAULT_CATEGORIES,
        usingFallback: true,
      });
    }

    // If no data from DB, use fallback
    if (!subcategories || subcategories.length === 0) {
      const fallbackSubcategories = categoryId
        ? DEFAULT_SUBCATEGORIES.filter((s) => s.category_id === categoryId)
        : DEFAULT_SUBCATEGORIES;
      return NextResponse.json({
        subcategories: fallbackSubcategories,
        count: fallbackSubcategories.length,
        categories: DEFAULT_CATEGORIES,
        usingFallback: true,
      });
    }

    return NextResponse.json({
      subcategories: subcategories,
      count: subcategories.length,
    });
  } catch (error) {
    apiLogger.error('Error in loan subcategories API', error);
    // Return fallback on any error
    return NextResponse.json({
      subcategories: DEFAULT_SUBCATEGORIES,
      count: DEFAULT_SUBCATEGORIES.length,
      categories: DEFAULT_CATEGORIES,
      usingFallback: true,
    });
  }
}
