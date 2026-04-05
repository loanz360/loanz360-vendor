'use client';

/**
 * ULAP Lead Submission Wizard Component
 * Beautiful card-based multi-step loan application form
 * Flow: Category Cards → Subcategory Cards → Applicant Details → Submit
 *
 * Used by: BA Portal, BP Portal, Employee Portal, Customer Referral
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =====================================================
// TYPES
// =====================================================

type Step = 'loan-category' | 'loan-subcategory' | 'loan-details';

interface LoanSubcategory {
  id: string;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  min_amount?: number;
  max_amount?: number;
  category_id?: string;
  ulap_loan_categories?: LoanCategory;
}

interface LoanCategory {
  id: string;
  name: string;
  code?: string;
  color?: string;
  icon?: string;
  description?: string;
  subcategories?: LoanSubcategory[];
}

interface FormData {
  // Applicant Details (Phase 1 - Basic info only)
  full_name: string;
  mobile: string;
  email: string;
  city: string;
  pincode: string;
  estimated_amount: string;
}

interface CommissionEstimate {
  hasRates: boolean;
  message?: string;
  minPercentage?: number;
  maxPercentage?: number;
  avgPercentage?: number;
  estimatedMinCommission?: number;
  estimatedMaxCommission?: number;
  estimatedAvgCommission?: number;
}

interface ULAPLeadSubmissionWizardProps {
  source: 'BA' | 'BP' | 'EMPLOYEE' | 'DSE_EMPLOYEE' | 'CUSTOMER_REFERRAL' | 'SELF';
  partnerId?: string;
  partnerName?: string;
  onSuccess?: (leadNumber: string) => void;
  onCancel?: () => void;
}

// =====================================================
// FALLBACK DATA - All 15 Categories with Subcategories
// =====================================================

const DEFAULT_CATEGORIES: LoanCategory[] = [
  // 1. Personal Loans
  { id: 'personal_loans', name: 'Personal Loans', code: 'PERSONAL_LOAN', color: '#3B82F6', icon: 'user', description: 'Quick unsecured funds for personal needs, medical emergencies, travel, or any purpose without collateral.' },
  // 2. Business Loans
  { id: 'business_loans', name: 'Business Loans', code: 'BUSINESS_LOAN', color: '#8B5CF6', icon: 'briefcase', description: 'Fund your business growth, expansion, inventory, or operational expenses with flexible repayment options.' },
  // 3. Home Loans
  { id: 'home_loans', name: 'Home Loans', code: 'HOME_LOAN', color: '#10B981', icon: 'home', description: 'Make your dream home a reality with competitive interest rates and long tenure up to 30 years.' },
  // 4. Mortgage Loans (LAP)
  { id: 'mortgage_loans', name: 'Mortgage Loans', code: 'LAP', color: '#F59E0B', icon: 'building', description: 'Unlock the value of your property with loan against property for any purpose at lower interest rates.' },
  // 5. Vehicle Loans
  { id: 'vehicle_loans', name: 'Vehicle Loans', code: 'VEHICLE_LOAN', color: '#EF4444', icon: 'car', description: 'Drive your dream car or two-wheeler with up to 100% on-road financing and quick approval.' },
  // 6. Machinery Loans
  { id: 'machinery_loans', name: 'Machinery Loans', code: 'MACHINERY_LOAN', color: '#6366F1', icon: 'cog', description: 'Finance industrial machinery, manufacturing equipment, and production tools for your business expansion.' },
  // 7. Professional Loans
  { id: 'professional_loans', name: 'Professional Loans', code: 'PROFESSIONAL_LOAN', color: '#EC4899', icon: 'briefcase', description: 'Specialized loans for doctors, CAs, lawyers, architects and other professionals for practice setup and expansion.' },
  // 8. NRI Loans
  { id: 'nri_loans', name: 'Loan to NRI', code: 'NRI_LOAN', color: '#14B8A6', icon: 'globe', description: 'Special loan products for Non-Resident Indians to invest in property, business, or meet family needs in India.' },
  // 9. Educational Loans
  { id: 'educational_loans', name: 'Educational Loans', code: 'EDUCATION_LOAN', color: '#06B6D4', icon: 'academic-cap', description: 'Fund higher education in India or abroad with moratorium period and tax benefits on interest.' },
  // 10. Institution Loans
  { id: 'institution_loans', name: 'Institution Loans', code: 'INSTITUTION_LOAN', color: '#8B5CF6', icon: 'library', description: 'Loans for educational institutions, schools, colleges, and universities for infrastructure and expansion.' },
  // 11. Working Capital
  { id: 'working_capital', name: 'Working Capital', code: 'WORKING_CAPITAL', color: '#F97316', icon: 'cash', description: 'Manage day-to-day operational expenses with CC/OD facilities and flexible drawdown options.' },
  // 12. Loan Against Rentals
  { id: 'loan_against_rentals', name: 'Loan Against Rentals', code: 'RENTAL_LOAN', color: '#84CC16', icon: 'building', description: 'Monetize your rental income by getting loans secured against future rental receivables.' },
  // 13. Builder Loans
  { id: 'builder_loans', name: 'Loan to Builders', code: 'BUILDER_LOAN', color: '#A855F7', icon: 'building', description: 'Project finance and construction loans for real estate developers and builders.' },
  // 14. Women Professional Loans
  { id: 'women_professional_loans', name: 'Loan to Professional (Women)', code: 'WOMEN_LOAN', color: '#F472B6', icon: 'user', description: 'Special loan schemes for women professionals and entrepreneurs with preferential rates and benefits.' },
  // 15. Govt Schemes
  { id: 'govt_schemes', name: 'Govt Schemes', code: 'GOVT_SCHEME', color: '#22C55E', icon: 'flag', description: 'PMEGP, Mudra, Stand-Up India, and other govt-backed schemes with subsidies and lower rates.' },
];

const DEFAULT_SUBCATEGORIES: Record<string, LoanSubcategory[]> = {
  // 1. Personal Loans
  'personal_loans': [
    { id: 'new_personal_loan', name: 'New Personal Loan', description: 'Fresh personal loan for any purpose - wedding, travel, medical, or personal expenses.', category_id: 'personal_loans' },
    { id: 'topup_loan', name: 'Top-up Loan', description: 'Additional loan on your existing personal loan with lower interest rates.', category_id: 'personal_loans' },
    { id: 'balance_transfer', name: 'Balance Transfer', description: 'Transfer your existing loan to another bank at lower interest rates and save on EMI.', category_id: 'personal_loans' },
    { id: 'debt_consolidation', name: 'Debt Consolidation', description: 'Combine multiple loans into one with a single EMI for easier management.', category_id: 'personal_loans' },
    { id: 'overdraft_flexi', name: 'Overdraft / Flexi Loan', description: 'Flexible credit line - withdraw as needed, pay interest only on utilized amount.', category_id: 'personal_loans' },
  ],
  // 2. Business Loans
  'business_loans': [
    { id: 'new_business_loan', name: 'New Business Loan', description: 'Fresh capital for business expansion, inventory, or operational needs.', category_id: 'business_loans' },
    { id: 'msme_loan', name: 'MSME Loan', description: 'Special loans for Micro, Small & Medium Enterprises with govt. benefits.', category_id: 'business_loans' },
    { id: 'startup_loan', name: 'Startup Loan', description: 'Funding for new ventures and startups with flexible collateral options.', category_id: 'business_loans' },
    { id: 'business_bt', name: 'Business Loan Balance Transfer', description: 'Transfer existing business loan to get better rates and top-up.', category_id: 'business_loans' },
  ],
  // 3. Home Loans
  'home_loans': [
    { id: 'new_home_loan', name: 'New Home Loan', description: 'Purchase your dream home with up to 90% financing and long tenure.', category_id: 'home_loans' },
    { id: 'home_construction', name: 'Home Construction Loan', description: 'Build your own house with stage-wise disbursement facility.', category_id: 'home_loans' },
    { id: 'home_improvement', name: 'Home Improvement Loan', description: 'Renovate, repair, or upgrade your existing home.', category_id: 'home_loans' },
    { id: 'plot_purchase', name: 'Plot Purchase Loan', description: 'Buy residential or commercial plot with loan facility.', category_id: 'home_loans' },
    { id: 'home_bt', name: 'Home Loan Balance Transfer', description: 'Transfer your existing home loan to lower interest rates and save lakhs.', category_id: 'home_loans' },
    { id: 'home_topup', name: 'Home Loan Top-up', description: 'Additional loan on your existing home loan for any purpose.', category_id: 'home_loans' },
  ],
  // 4. Mortgage Loans (LAP)
  'mortgage_loans': [
    { id: 'lap_residential', name: 'LAP - Residential Property', description: 'Loan against your residential property for personal or business needs.', category_id: 'mortgage_loans' },
    { id: 'lap_commercial', name: 'LAP - Commercial Property', description: 'Loan against your commercial property like shop, office, or warehouse.', category_id: 'mortgage_loans' },
    { id: 'lap_industrial', name: 'LAP - Industrial Property', description: 'Loan against factory, industrial land, or manufacturing unit.', category_id: 'mortgage_loans' },
    { id: 'lap_bt', name: 'LAP Balance Transfer', description: 'Transfer your existing LAP to get better interest rates.', category_id: 'mortgage_loans' },
  ],
  // 5. Vehicle Loans
  'vehicle_loans': [
    { id: 'new_car_loan', name: 'New Car Loan', description: 'Finance your brand new car with up to 100% on-road funding.', category_id: 'vehicle_loans' },
    { id: 'used_car_loan', name: 'Used Car Loan', description: 'Buy pre-owned cars up to 10 years old with easy financing.', category_id: 'vehicle_loans' },
    { id: 'two_wheeler_loan', name: 'Two Wheeler Loan', description: 'Finance your bike or scooter with instant approval.', category_id: 'vehicle_loans' },
    { id: 'commercial_vehicle', name: 'Commercial Vehicle Loan', description: 'Trucks, buses, taxis, and other commercial vehicles financing.', category_id: 'vehicle_loans' },
    { id: 'ev_loan', name: 'Electric Vehicle Loan', description: 'Special financing for electric cars and bikes with lower rates.', category_id: 'vehicle_loans' },
  ],
  // 6. Machinery Loans
  'machinery_loans': [
    { id: 'new_machinery', name: 'New Machinery Loan', description: 'Finance brand new industrial machinery and equipment for your business.', category_id: 'machinery_loans' },
    { id: 'used_machinery', name: 'Used Machinery Loan', description: 'Get financing for pre-owned machinery and equipment at competitive rates.', category_id: 'machinery_loans' },
    { id: 'equipment_finance', name: 'Equipment Finance', description: 'Finance specialized equipment for manufacturing, agriculture, or construction.', category_id: 'machinery_loans' },
    { id: 'machinery_refinance', name: 'Machinery Refinance', description: 'Refinance existing machinery loans at lower interest rates.', category_id: 'machinery_loans' },
  ],
  // 7. Professional Loans
  'professional_loans': [
    { id: 'doctor_loan', name: 'Doctor Loan', description: 'Loans for doctors to set up clinic, buy equipment, or expand practice.', category_id: 'professional_loans' },
    { id: 'ca_loan', name: 'CA Loan', description: 'Special loans for Chartered Accountants for practice setup.', category_id: 'professional_loans' },
    { id: 'lawyer_loan', name: 'Lawyer Loan', description: 'Loans for advocates and lawyers for office setup and expansion.', category_id: 'professional_loans' },
    { id: 'architect_loan', name: 'Architect Loan', description: 'Loans for architects to set up design studio and purchase equipment.', category_id: 'professional_loans' },
    { id: 'engineer_loan', name: 'Engineer Loan', description: 'Loans for consulting engineers to establish practice and buy tools.', category_id: 'professional_loans' },
  ],
  // 8. NRI Loans
  'nri_loans': [
    { id: 'nri_home_loan', name: 'NRI Home Loan', description: 'Home loans for NRIs to purchase property in India.', category_id: 'nri_loans' },
    { id: 'nri_lap', name: 'NRI Loan Against Property', description: 'Loan against property owned by NRIs in India.', category_id: 'nri_loans' },
    { id: 'nri_personal_loan', name: 'NRI Personal Loan', description: 'Personal loans for NRIs for family needs in India.', category_id: 'nri_loans' },
    { id: 'nri_business_loan', name: 'NRI Business Loan', description: 'Business loans for NRIs to invest in Indian ventures.', category_id: 'nri_loans' },
  ],
  // 9. Educational Loans
  'educational_loans': [
    { id: 'education_india', name: 'Education Loan - India', description: 'Fund your higher education in top Indian universities.', category_id: 'educational_loans' },
    { id: 'education_abroad', name: 'Education Loan - Abroad', description: 'Study abroad in USA, UK, Canada, Australia with easy financing.', category_id: 'educational_loans' },
    { id: 'education_skill', name: 'Skill Development Loan', description: 'Loans for professional courses, certifications, and skill upgrades.', category_id: 'educational_loans' },
    { id: 'education_coaching', name: 'Coaching / Entrance Loan', description: 'Finance for coaching classes and entrance exam preparation.', category_id: 'educational_loans' },
  ],
  // 10. Institution Loans
  'institution_loans': [
    { id: 'school_loan', name: 'School Infrastructure Loan', description: 'Loans for school construction, renovation, and equipment.', category_id: 'institution_loans' },
    { id: 'college_loan', name: 'College / University Loan', description: 'Loans for higher education institutions for campus development.', category_id: 'institution_loans' },
    { id: 'coaching_center_loan', name: 'Coaching Center Loan', description: 'Loans for coaching institutes and training centers.', category_id: 'institution_loans' },
    { id: 'edtech_loan', name: 'EdTech Infrastructure Loan', description: 'Loans for digital infrastructure and online education platforms.', category_id: 'institution_loans' },
  ],
  // 11. Working Capital
  'working_capital': [
    { id: 'cc_od', name: 'Cash Credit / Overdraft', description: 'Revolving credit facility for daily business operations.', category_id: 'working_capital' },
    { id: 'bill_discounting', name: 'Bill Discounting', description: 'Get advance against your sales invoices and receivables.', category_id: 'working_capital' },
    { id: 'channel_finance', name: 'Channel Finance', description: 'Finance for dealers and distributors in supply chain.', category_id: 'working_capital' },
    { id: 'vendor_finance', name: 'Vendor Finance', description: 'Working capital support for vendors and suppliers.', category_id: 'working_capital' },
  ],
  // 12. Loan Against Rentals
  'loan_against_rentals': [
    { id: 'residential_rental', name: 'Residential Rental Loan', description: 'Loan against rental income from residential properties.', category_id: 'loan_against_rentals' },
    { id: 'commercial_rental', name: 'Commercial Rental Loan', description: 'Loan against rental income from commercial properties.', category_id: 'loan_against_rentals' },
    { id: 'lease_rental_discounting', name: 'Lease Rental Discounting', description: 'Get upfront financing against long-term lease agreements.', category_id: 'loan_against_rentals' },
  ],
  // 13. Builder Loans
  'builder_loans': [
    { id: 'project_finance', name: 'Project Finance', description: 'Finance for residential and commercial real estate projects.', category_id: 'builder_loans' },
    { id: 'construction_finance', name: 'Construction Finance', description: 'Stage-wise construction financing for builders.', category_id: 'builder_loans' },
    { id: 'land_acquisition', name: 'Land Acquisition Loan', description: 'Finance for land purchase for development projects.', category_id: 'builder_loans' },
    { id: 'builder_bt', name: 'Builder Loan Balance Transfer', description: 'Transfer existing construction loans at better rates.', category_id: 'builder_loans' },
  ],
  // 14. Women Professional Loans
  'women_professional_loans': [
    { id: 'women_business_loan', name: 'Women Business Loan', description: 'Business loans for women entrepreneurs with lower interest rates.', category_id: 'women_professional_loans' },
    { id: 'women_professional', name: 'Women Professional Loan', description: 'Loans for women professionals for practice setup.', category_id: 'women_professional_loans' },
    { id: 'mahila_udyam', name: 'Mahila Udyam Nidhi', description: 'Government scheme for women-owned small businesses.', category_id: 'women_professional_loans' },
    { id: 'women_shg_loan', name: 'Women SHG Loan', description: 'Loans for women Self Help Groups and joint liability groups.', category_id: 'women_professional_loans' },
  ],
  // 15. Govt Schemes
  'govt_schemes': [
    { id: 'mudra_loan', name: 'Mudra Loan', description: 'Shishu, Kishor, Tarun - loans up to ₹10 lakh for micro enterprises.', category_id: 'govt_schemes' },
    { id: 'pmegp', name: 'PMEGP Loan', description: 'Prime Minister Employment Generation Programme with subsidy.', category_id: 'govt_schemes' },
    { id: 'standup_india', name: 'Stand-Up India', description: 'Loans for SC/ST and women entrepreneurs ₹10 lakh to ₹1 crore.', category_id: 'govt_schemes' },
    { id: 'pmsvanidhi', name: 'PM SVANidhi', description: 'Micro credit for street vendors up to ₹50,000.', category_id: 'govt_schemes' },
    { id: 'cgtmse', name: 'CGTMSE Loan', description: 'Collateral-free loans up to ₹2 crore under CGTMSE guarantee.', category_id: 'govt_schemes' },
  ],
};

// =====================================================
// ANIMATED ICON MAPPING FOR CATEGORIES
// =====================================================

// Icon SVG paths for each loan category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'personal_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  'business_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  'home_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  'mortgage_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'vehicle_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  'machinery_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
    </svg>
  ),
  'professional_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  'nri_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  'educational_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  'institution_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  'working_capital': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  'loan_against_rentals': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  ),
  'builder_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'women_professional_loans': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" />
    </svg>
  ),
  'govt_schemes': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

// Subcategory icons mapping
const SUBCATEGORY_ICONS: Record<string, React.ReactNode> = {
  // Personal Loans
  'new_personal_loan': CATEGORY_ICONS['personal_loans'],
  'topup_loan': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  'balance_transfer': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  'debt_consolidation': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  ),
  'overdraft_flexi': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
    </svg>
  ),
  // Business Loans
  'new_business_loan': CATEGORY_ICONS['business_loans'],
  'msme_loan': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  ),
  'startup_loan': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
  // Home Loans
  'new_home_loan': CATEGORY_ICONS['home_loans'],
  'home_construction': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  'home_improvement': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  // Vehicle Loans
  'new_car_loan': CATEGORY_ICONS['vehicle_loans'],
  'used_car_loan': CATEGORY_ICONS['vehicle_loans'],
  'two_wheeler_loan': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  // Default for any unmapped
  'default': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Get icon for a category or subcategory
const getCategoryIcon = (categoryId: string): React.ReactNode => {
  return CATEGORY_ICONS[categoryId] || CATEGORY_ICONS['personal_loans'];
};

const getSubcategoryIcon = (subcategoryId: string, categoryId?: string): React.ReactNode => {
  return SUBCATEGORY_ICONS[subcategoryId] || (categoryId && CATEGORY_ICONS[categoryId]) || SUBCATEGORY_ICONS['default'];
};

// =====================================================
// STEP INDICATOR
// =====================================================

const StepIndicator = ({ currentStep }: { currentStep: Step }) => {
  const steps = [
    { id: 'loan-category', label: 'Category', number: 1 },
    { id: 'loan-subcategory', label: 'Loan Type', number: 2 },
    { id: 'loan-details', label: 'Apply', number: 3 },
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex items-center gap-2">
            <motion.div
              initial={false}
              animate={{
                scale: index === currentIndex ? 1.1 : 1,
                backgroundColor: index <= currentIndex ? '#f97316' : 'rgba(255,255,255,0.1)',
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            >
              {index < currentIndex ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </motion.div>
            <span className={`text-xs font-medium hidden sm:block ${index <= currentIndex ? 'text-white' : 'text-white/40'}`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 rounded ${index < currentIndex ? 'bg-orange-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// =====================================================
// CATEGORY CARD - Glassmorphism Design with Solid Gradient Icons
// Modern frosted glass card with animated solid icons
// Shows bank/NBFC count badge and detailed description
// =====================================================

const CategoryCard = ({
  category,
  subcategoryCount,
  bankCount = 0,
  onSelect
}: {
  category: LoanCategory;
  subcategoryCount: number;
  bankCount?: number;
  onSelect: () => void;
}) => {
  const color = category.color || '#f97316';

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-2xl overflow-hidden text-left w-full h-full flex flex-col min-h-[280px]"
    >
      {/* Glassmorphism background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `linear-gradient(145deg, rgba(30,30,35,0.9) 0%, rgba(20,20,25,0.95) 100%)`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />

      {/* Subtle color tint overlay */}
      <div
        className="absolute inset-0 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"
        style={{
          background: `linear-gradient(145deg, ${color}15 0%, transparent 60%)`,
        }}
      />

      {/* Animated border glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{
          boxShadow: `inset 0 0 0 1.5px ${color}60, 0 0 40px ${color}15, 0 8px 32px rgba(0,0,0,0.4)`,
        }}
      />

      {/* Default subtle border */}
      <div
        className="absolute inset-0 rounded-2xl border border-white/10 group-hover:border-transparent transition-colors duration-300"
      />

      {/* Content */}
      <div className="relative p-5 flex flex-col h-full z-10">
        {/* Icon Container with solid gradient background */}
        <div className="relative mb-4">
          <motion.div
            className="w-14 h-14 rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
              boxShadow: `0 4px 20px ${color}40`,
            }}
            whileHover={{ scale: 1.1, rotate: [0, -3, 3, 0] }}
            transition={{ duration: 0.4 }}
          >
            {/* Inner glow */}
            <div
              className="absolute inset-0 rounded-xl opacity-50"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${color}80 0%, transparent 60%)`,
              }}
            />
            <div className="w-7 h-7 text-white relative z-10 drop-shadow-lg">
              {getCategoryIcon(category.id)}
            </div>
          </motion.div>

          {/* Bank/NBFC count badge - top right */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full text-[11px] font-bold text-white flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              boxShadow: `0 2px 10px ${color}50`,
            }}
          >
            {bankCount > 0 ? bankCount : subcategoryCount}
          </motion.div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg text-white group-hover:text-opacity-100 transition-colors leading-tight mb-2">
          <span
            className="transition-colors duration-300"
            style={{
              color: 'white',
            }}
          >
            {category.name}
          </span>
        </h3>

        {/* Description - 2-3 lines */}
        <p className="text-sm text-white/60 leading-relaxed line-clamp-3 flex-1 mb-4">
          {category.description || `Explore ${category.name} options from multiple banks and NBFCs with competitive rates.`}
        </p>

        {/* Bottom section */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/5">
          <span className="text-xs text-white/40 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {subcategoryCount} loan types
          </span>
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: `${color}20`,
              color: color,
            }}
            whileHover={{ x: 4, background: `${color}30` }}
          >
            Explore
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
};

// =====================================================
// SUBCATEGORY CARD - Glassmorphism Design
// Modern frosted glass card with solid gradient icons
// =====================================================

const SubcategoryCard = ({
  subcategory,
  categoryColor,
  onSelect
}: {
  subcategory: LoanSubcategory;
  categoryColor?: string;
  onSelect: () => void;
}) => {
  const formatAmount = (amount?: number) => {
    if (!amount) return '';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const color = categoryColor || '#f97316';

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-xl overflow-hidden text-left w-full h-full flex flex-col min-h-[180px]"
    >
      {/* Glassmorphism background */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: `linear-gradient(145deg, rgba(28,28,32,0.95) 0%, rgba(18,18,22,0.98) 100%)`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      />

      {/* Subtle color tint */}
      <div
        className="absolute inset-0 rounded-xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"
        style={{
          background: `linear-gradient(145deg, ${color}20 0%, transparent 50%)`,
        }}
      />

      {/* Hover glow border */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300"
        style={{
          boxShadow: `inset 0 0 0 1px ${color}50, 0 0 30px ${color}10`,
        }}
      />

      {/* Default border */}
      <div className="absolute inset-0 rounded-xl border border-white/10 group-hover:border-transparent transition-colors duration-300" />

      <div className="relative p-4 flex flex-col h-full z-10">
        {/* Top row: Icon + Title */}
        <div className="flex items-start gap-3 mb-3">
          <motion.div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
              boxShadow: `0 3px 15px ${color}35`,
            }}
            whileHover={{ scale: 1.1, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {/* Inner glow */}
            <div
              className="absolute inset-0 rounded-lg opacity-40"
              style={{
                background: `radial-gradient(circle at 30% 30%, white 0%, transparent 60%)`,
              }}
            />
            <div className="w-5 h-5 text-white relative z-10 drop-shadow">
              {getSubcategoryIcon(subcategory.id, subcategory.category_id)}
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-white group-hover:text-white transition-colors leading-tight line-clamp-2">
              {subcategory.name}
            </h3>
            {(subcategory.min_amount || subcategory.max_amount) && (
              <p className="text-xs mt-1 font-medium" style={{ color: `${color}` }}>
                {formatAmount(subcategory.min_amount)} - {formatAmount(subcategory.max_amount)}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-white/50 leading-relaxed line-clamp-2 flex-1">
          {subcategory.description || `Apply for ${subcategory.name}`}
        </p>

        {/* Apply Button */}
        <div className="flex items-center justify-end pt-3 mt-auto">
          <motion.div
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-md"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              color: '#fff',
              boxShadow: `0 2px 10px ${color}30`,
            }}
            whileHover={{ scale: 1.05, boxShadow: `0 4px 15px ${color}40` }}
            whileTap={{ scale: 0.95 }}
          >
            Apply Now
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
};

// =====================================================
// CATEGORY SELECTION (STEP 1)
// =====================================================

const CategorySelection = ({
  categories,
  subcategoriesMap,
  bankCountsMap,
  onSelect
}: {
  categories: LoanCategory[];
  subcategoriesMap: Record<string, LoanSubcategory[]>;
  bankCountsMap: Record<string, number>;
  onSelect: (category: LoanCategory) => void;
}) => {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-2">
          <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-sm font-medium text-orange-400">{categories.length} Loan Categories Available</span>
        </div>
        <p className="text-white/50 text-sm max-w-2xl mx-auto">
          Choose a loan category to explore available options from multiple banks and NBFCs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <CategoryCard
              category={category}
              subcategoryCount={subcategoriesMap[category.id]?.length || 0}
              bankCount={bankCountsMap[category.id] || 0}
              onSelect={() => onSelect(category)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// =====================================================
// SUBCATEGORY SELECTION (STEP 2)
// =====================================================

const SubcategorySelection = ({
  selectedCategory,
  subcategories,
  onSelect,
  onBack
}: {
  selectedCategory: LoanCategory;
  subcategories: LoanSubcategory[];
  onSelect: (subcategory: LoanSubcategory) => void;
  onBack: () => void;
}) => {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Categories
        </button>
        <div className="text-right">
          <h2 className="text-sm font-semibold text-white">{selectedCategory.name}</h2>
          <p className="text-xs text-white/50">{subcategories.length} loan types</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subcategories.map((subcategory, index) => (
          <motion.div
            key={subcategory.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <SubcategoryCard
              subcategory={subcategory}
              categoryColor={selectedCategory.color}
              onSelect={() => onSelect(subcategory)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// =====================================================
// APPLICANT FORM (STEP 3)
// =====================================================

const ApplicantForm = ({
  selectedCategory,
  selectedSubcategory,
  formData,
  setFormData,
  isSubmitting,
  onBack,
  onSubmit,
  partnerName,
  source
}: {
  selectedCategory: LoanCategory;
  selectedSubcategory: LoanSubcategory;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  partnerName?: string;
  source: 'BA' | 'BP' | 'EMPLOYEE' | 'DSE_EMPLOYEE' | 'CUSTOMER_REFERRAL' | 'SELF';
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [commissionEstimate, setCommissionEstimate] = useState<CommissionEstimate | null>(null);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  // Fetch commission estimate when loan type and amount are available
  useEffect(() => {
    const partnerTypeMap: Record<string, string> = { 'BA': 'BA', 'BP': 'BP', 'EMPLOYEE': 'BA', 'DSE_EMPLOYEE': '', 'CUSTOMER_REFERRAL': 'BA', 'SELF': 'BA' };
    const partnerType = partnerTypeMap[source];
    if (!partnerType || !['BA', 'BP'].includes(partnerType)) {
      return;
    }

    const amount = parseFloat(formData.estimated_amount);
    if (!formData.estimated_amount || isNaN(amount) || amount < 10000) {
      setCommissionEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingEstimate(true);
      try {
        const params = new URLSearchParams({
          loan_type: selectedSubcategory.name,
          partner_type: partnerType,
          amount: amount.toString(),
        });
        const res = await fetch(`/api/partners/commission-estimate?${params}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setCommissionEstimate(result.data);
          }
        }
      } catch {
        // Silently fail - commission estimate is optional
      } finally {
        setIsLoadingEstimate(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [formData.estimated_amount, selectedSubcategory.name, source]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate required fields with proper format checks
  const mobileValid = /^[6-9]\d{9}$/.test(formData.mobile.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
  const nameValid = formData.full_name.trim().length >= 2;
  const pincodeValid = !formData.pincode || /^\d{6}$/.test(formData.pincode.trim());
  const isFormValid = nameValid && mobileValid && emailValid && pincodeValid;

  // Handle review button click - show confirmation modal
  const handleReviewClick = () => {
    if (isFormValid) {
      setShowConfirmation(true);
    }
  };

  // Handle confirm submission
  const handleConfirmSubmit = () => {
    setShowConfirmation(false);
    onSubmit();
  };

  // Handle edit - close modal and return to form
  const handleEdit = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="space-y-4">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={handleEdit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-white/10 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Confirm Lead Details</h3>
                    <p className="text-xs text-white/50">Please review the information before submitting</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Loan Details */}
                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">Loan Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Category</span>
                      <span className="text-sm font-medium text-white">{selectedCategory.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Loan Type</span>
                      <span className="text-sm font-medium text-orange-400">{selectedSubcategory.name}</span>
                    </div>
                    {formData.estimated_amount && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/70">Est. Amount</span>
                        <span className="text-sm font-medium text-white">₹{parseFloat(formData.estimated_amount).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Details */}
                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">Customer Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Full Name</span>
                      <span className="text-sm font-medium text-white">{formData.full_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Mobile Number</span>
                      <span className="text-sm font-medium text-white">{formData.mobile}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Email Address</span>
                      <span className="text-sm font-medium text-white truncate max-w-[200px]">{formData.email}</span>
                    </div>
                    {formData.city && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/70">City</span>
                        <span className="text-sm font-medium text-white">{formData.city}</span>
                      </div>
                    )}
                    {formData.pincode && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/70">PIN Code</span>
                        <span className="text-sm font-medium text-white">{formData.pincode}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Referrer Details */}
                {partnerName && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">Referrer Details</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white/70">Referred By</span>
                      <span className="text-sm font-medium text-green-400">{partnerName}</span>
                    </div>
                  </div>
                )}

                {/* Info Note */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-300">
                    <span className="font-medium">Note:</span> Once confirmed, the lead will be created and notifications will be sent to the customer and referrer.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-white/10 flex gap-3">
                <button
                  onClick={handleEdit}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm & Submit
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
        <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="text-right">
          <h2 className="text-sm font-semibold text-white">{selectedSubcategory.name}</h2>
          <p className="text-xs text-white/50">{selectedCategory.name}</p>
        </div>
      </div>

      <div className="bg-white/[0.02] rounded-xl border border-white/10 p-5">
        {/* Applicant Details - Phase 1: Basic Info Only */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Customer Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="ulap-full-name" className="sr-only">Full Name (required)</label>
              <input
                id="ulap-full-name"
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Full Name *"
                aria-required="true"
                aria-invalid={formData.full_name.length > 0 && !nameValid}
                autoComplete="name"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
              />
              {formData.full_name.length > 0 && !nameValid && (
                <p className="text-xs text-red-400 mt-1">Name must be at least 2 characters</p>
              )}
            </div>
            <div>
              <label htmlFor="ulap-mobile" className="sr-only">Mobile Number (required)</label>
              <input
                id="ulap-mobile"
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, mobile: digits }));
                }}
                placeholder="Mobile Number *"
                maxLength={10}
                inputMode="numeric"
                aria-required="true"
                aria-invalid={formData.mobile.length > 0 && !mobileValid}
                autoComplete="tel"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
              />
              {formData.mobile.length > 0 && !mobileValid && (
                <p className="text-xs text-red-400 mt-1">Enter valid 10-digit Indian mobile (starts with 6-9)</p>
              )}
            </div>
            <div>
              <label htmlFor="ulap-email" className="sr-only">Email Address (required)</label>
              <input
                id="ulap-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address *"
                aria-required="true"
                aria-invalid={formData.email.length > 0 && !emailValid}
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
              />
              {formData.email.length > 0 && !emailValid && (
                <p className="text-xs text-red-400 mt-1">Enter a valid email address</p>
              )}
            </div>
            <div>
              <label htmlFor="ulap-city" className="sr-only">City</label>
              <input
                id="ulap-city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                autoComplete="address-level2"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
              />
            </div>
            <div>
              <label htmlFor="ulap-pincode" className="sr-only">PIN Code</label>
              <input
                id="ulap-pincode"
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, pincode: digits }));
                }}
                placeholder="PIN Code"
                maxLength={6}
                inputMode="numeric"
                aria-invalid={formData.pincode.length > 0 && !pincodeValid}
                autoComplete="postal-code"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
              />
              {formData.pincode.length > 0 && !pincodeValid && (
                <p className="text-xs text-red-400 mt-1">PIN code must be 6 digits</p>
              )}
            </div>
          </div>
        </div>

        {/* Estimated Loan Amount + Commission Estimate (partners only) */}
        {(source === 'BA' || source === 'BP') && source !== 'DSE_EMPLOYEE' && (
          <div className="mt-1">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Commission Estimate
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  name="estimated_amount"
                  value={formData.estimated_amount}
                  onChange={handleChange}
                  placeholder="Estimated Loan Amount (e.g., 500000)"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                />
                <p className="text-xs text-white/30 mt-1">Optional - Enter an approximate amount to see your estimated commission</p>
              </div>
            </div>

            {/* Commission Estimate Result */}
            {isLoadingEstimate && (
              <div className="mt-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-xs text-orange-300">Calculating estimate...</span>
              </div>
            )}

            {commissionEstimate && !isLoadingEstimate && commissionEstimate.hasRates && (
              <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-sm font-medium text-green-400">Your Estimated Commission</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-white/50">Rate Range</p>
                    <p className="text-sm font-semibold text-white">
                      {commissionEstimate.minPercentage === commissionEstimate.maxPercentage
                        ? `${commissionEstimate.avgPercentage}%`
                        : `${commissionEstimate.minPercentage}% - ${commissionEstimate.maxPercentage}%`}
                    </p>
                  </div>
                  {commissionEstimate.estimatedMinCommission !== undefined && (
                    <div>
                      <p className="text-xs text-white/50">Estimated Earning</p>
                      <p className="text-sm font-semibold text-emerald-400">
                        {commissionEstimate.estimatedMinCommission === commissionEstimate.estimatedMaxCommission
                          ? `₹${commissionEstimate.estimatedAvgCommission?.toLocaleString('en-IN')}`
                          : `₹${commissionEstimate.estimatedMinCommission?.toLocaleString('en-IN')} - ₹${commissionEstimate.estimatedMaxCommission?.toLocaleString('en-IN')}`}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-white/30 mt-2">
                  * Actual commission depends on bank, location & loan terms. Shown across {commissionEstimate.rateCount} bank rate(s).
                </p>
              </div>
            )}

            {commissionEstimate && !isLoadingEstimate && !commissionEstimate.hasRates && (
              <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <p className="text-xs text-blue-300">{commissionEstimate.message}</p>
              </div>
            )}
          </div>
        )}

        {/* Info note */}
        <div className="mt-5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-300">
            <span className="font-medium">Note:</span> Additional documents (PAN, Aadhaar, etc.) will be collected in Phase 2 after initial review.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          onClick={handleReviewClick}
          disabled={!isFormValid || isSubmitting}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Submit Lead
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// =====================================================
// SUCCESS SCREEN
// =====================================================

const SuccessScreen = ({
  leadNumber,
  selectedCategory,
  selectedSubcategory,
  formData,
  partnerName,
  onReset,
  onProceedToPhase2
}: {
  leadNumber: string;
  selectedCategory: LoanCategory;
  selectedSubcategory: LoanSubcategory;
  formData: FormData;
  partnerName?: string;
  onReset: () => void;
  onProceedToPhase2: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  // Generate shareable link
  const applicationLink = typeof window !== 'undefined'
    ? `${window.location.origin}/apply/${leadNumber}`
    : `/apply/${leadNumber}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(applicationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = applicationLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareWhatsApp = () => {
    const message = `Hi ${formData.full_name},\n\nYour loan application has been submitted successfully!\n\nLead ID: ${leadNumber}\nLoan Type: ${selectedSubcategory.name}\n\nTo complete your application with additional documents, please click:\n${applicationLink}\n\nRegards,\n${partnerName || 'Loanz360 Team'}`;
    // Ensure Indian country code (91) is prepended for WhatsApp API
    const cleanMobile = formData.mobile.replace(/\D/g, '');
    const waNumber = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareEmail = () => {
    const subject = `Your Loan Application - ${leadNumber}`;
    const body = `Dear ${formData.full_name},\n\nYour loan application has been submitted successfully!\n\nApplication Details:\n- Lead ID: ${leadNumber}\n- Loan Category: ${selectedCategory.name}\n- Loan Type: ${selectedSubcategory.name}\n\nTo complete your application with additional documents (PAN, Aadhaar, etc.), please click the link below:\n${applicationLink}\n\nOur team will review your application and connect you with the best banks and NBFCs.\n\nBest Regards,\n${partnerName || 'Loanz360 Team'}`;
    const mailtoUrl = `mailto:${formData.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="py-6">
      {/* Success Animation */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center"
        >
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-1">Lead Submitted Successfully!</h2>
        <p className="text-sm text-white/50">Added to Unified CRM Pipeline</p>
      </div>

      {/* Lead ID Card */}
      <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-xl border border-orange-500/30 p-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-300/70">Lead ID</p>
            <p className="text-xl font-mono font-bold text-orange-400">{leadNumber}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Application Details */}
      <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 mb-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Application Details
        </h3>

        <div className="space-y-3">
          {/* Loan Details */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selectedCategory.color}30` }}>
              <svg className="w-4 h-4" style={{ color: selectedCategory.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/50">Loan Type</p>
              <p className="text-sm font-medium text-white">{selectedSubcategory.name}</p>
              <p className="text-xs text-white/40">{selectedCategory.name}</p>
            </div>
          </div>

          {/* Customer Details */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/50">Customer</p>
              <p className="text-sm font-medium text-white">{formData.full_name}</p>
              <p className="text-xs text-white/40">{formData.mobile} • {formData.email}</p>
              {(formData.city || formData.pincode) && (
                <p className="text-xs text-white/40">{[formData.city, formData.pincode].filter(Boolean).join(' - ')}</p>
              )}
            </div>
          </div>

          {/* Referrer Details */}
          {partnerName && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50">Referred By</p>
                <p className="text-sm font-medium text-white">{partnerName}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-300">Phase 1 Complete</p>
            <p className="text-xs text-blue-300/70 mt-1">
              Basic details captured. Proceed to Phase 2 to upload PAN, Aadhaar, and other documents for faster processing.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Primary: Proceed to Phase 2 */}
        <button
          onClick={onProceedToPhase2}
          className="w-full px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Proceed to Phase 2 - Upload Documents
        </button>

        {/* Secondary: Share Application Link */}
        <div className="relative">
          <button
            onClick={() => setShowShareOptions(!showShareOptions)}
            className="w-full px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Application Link
            <svg className={`w-4 h-4 transition-transform ${showShareOptions ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Share Options Dropdown */}
          <AnimatePresence>
            {showShareOptions && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-xl z-10"
              >
                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    {copied ? (
                      <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-white">{copied ? 'Link Copied!' : 'Copy Link'}</p>
                    <p className="text-xs text-white/40 truncate">{applicationLink}</p>
                  </div>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={handleShareWhatsApp}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-t border-white/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Share via WhatsApp</p>
                    <p className="text-xs text-white/40">Send to {formData.mobile}</p>
                  </div>
                </button>

                {/* Email */}
                <button
                  onClick={handleShareEmail}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-t border-white/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Share via Email</p>
                    <p className="text-xs text-white/40">Send to {formData.email}</p>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tertiary: Submit Another Lead */}
        <button
          onClick={onReset}
          className="w-full px-6 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
        >
          Submit Another Lead
        </button>
      </div>
    </div>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ULAPLeadSubmissionWizard({
  source,
  partnerId,
  partnerName,
  onSuccess,
  onCancel
}: ULAPLeadSubmissionWizardProps) {
  const [step, setStep] = useState<Step>('loan-category');
  const [categories, setCategories] = useState<LoanCategory[]>(DEFAULT_CATEGORIES);
  const [subcategoriesMap, setSubcategoriesMap] = useState<Record<string, LoanSubcategory[]>>(DEFAULT_SUBCATEGORIES);
  const [bankCountsMap, setBankCountsMap] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<LoanCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<LoanSubcategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [leadNumber, setLeadNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    mobile: '',
    email: '',
    city: '',
    pincode: '',
    estimated_amount: '',
  });

  // Fetch categories, subcategories, and bank counts from API with proper error handling
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        // Fetch categories and subcategories
        const response = await fetch('/api/ulap/loan-subcategories', {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // If API fails, we already have fallback data loaded from DEFAULT_CATEGORIES
          console.warn('API returned non-OK status, using fallback data');
          return;
        }

        const data = await response.json();

        if (data.subcategories && data.subcategories.length > 0) {
          // Group subcategories by category
          const groupedSubcategories: Record<string, LoanSubcategory[]> = {};
          const categoryMap: Record<string, LoanCategory> = {};

          data.subcategories.forEach((sub: LoanSubcategory & { ulap_loan_categories?: LoanCategory }) => {
            const catId = sub.category_id || sub.ulap_loan_categories?.id;
            if (catId) {
              if (!groupedSubcategories[catId]) {
                groupedSubcategories[catId] = [];
              }
              groupedSubcategories[catId].push(sub);

              if (sub.ulap_loan_categories && !categoryMap[catId]) {
                categoryMap[catId] = sub.ulap_loan_categories;
              }
            }
          });

          // Use API categories if available
          if (data.categories && data.categories.length > 0) {
            setCategories(data.categories);
          } else if (Object.keys(categoryMap).length > 0) {
            setCategories(Object.values(categoryMap));
          }

          setSubcategoriesMap(groupedSubcategories);

          // Set bank counts if available from API
          if (data.bankCounts) {
            setBankCountsMap(data.bankCounts);
          }
        }
      } catch (err) {
        // Only log if not an abort error
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('Failed to fetch loan categories, using fallback data:', err.message);
        }
        // Keep using fallback data - no need to throw or show error to user
      }
    };

    // Fetch bank counts separately (fallback if not included in main API)
    const fetchBankCounts = async () => {
      try {
        const response = await fetch('/api/ulap/bank-counts', {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.bankCounts) {
            setBankCountsMap(data.bankCounts);
          }
        }
      } catch (err) {
        // Silently fail - bank counts are optional
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('Failed to fetch bank counts:', err.message);
        }
      }
    };

    fetchData();
    fetchBankCounts();

    // Cleanup function to abort fetch on unmount
    return () => {
      controller.abort();
    };
  }, []);

  // Handle category selection
  const handleCategorySelect = useCallback((category: LoanCategory) => {
    setSelectedCategory(category);
    setStep('loan-subcategory');
  }, []);

  // Handle subcategory selection
  const handleSubcategorySelect = useCallback((subcategory: LoanSubcategory) => {
    setSelectedSubcategory(subcategory);
    setStep('loan-details');
  }, []);

  // Handle form submission
  // Routes DSE_EMPLOYEE to dedicated DSE API for proper attribution & target tracking
  const handleSubmit = useCallback(async () => {
    if (!selectedCategory || !selectedSubcategory) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine if this is a DSE employee submission
      const isDSEEmployee = source === 'DSE_EMPLOYEE';

      if (isDSEEmployee) {
        // Route to dedicated DSE Lead Submission API
        // This ensures: self-assignment, daily target tracking, co-applicant handling, CAM processing
        const dsePayload = {
          customer_name: formData.full_name.trim(),
          customer_mobile: formData.mobile.trim(),
          customer_email: formData.email.trim() || undefined,
          customer_city: formData.city.trim() || 'Not Specified',
          customer_pincode: formData.pincode.trim() || '000000',
          customer_subrole: 'SALARIED',
          loan_type: selectedSubcategory.name,
          loan_amount: parseFloat(formData.estimated_amount) || 100000,
          employment_type: 'SALARIED',
          monthly_income: 50000,
          loan_category_id: selectedCategory.id,
          loan_subcategory_id: selectedSubcategory.id,
          source: 'DSE',
        };

        const response = await fetch('/api/employees/dse/leads/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dsePayload),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to submit lead');
        }

        const newLeadNumber = result.data?.lead_number || result.data?.lead_id;
        if (!newLeadNumber) {
          throw new Error('Lead submitted but no lead number returned');
        }
        setLeadNumber(newLeadNumber);
        setShowSuccess(true);
        onSuccess?.(newLeadNumber);
      } else {
        // Standard ULAP flow for BA, BP, Employee (non-DSE), Customer Referral, Self
        const formSourceMap: Record<string, string> = {
          'BA': 'ULAP_PARTNER_LINK',
          'BP': 'ULAP_PARTNER_LINK',
          'EMPLOYEE': 'ULAP_EMPLOYEE',
          'CUSTOMER_REFERRAL': 'ULAP_CUSTOMER_REFERRAL',
          'SELF': 'ULAP_PUBLIC_FORM',
        };

        const payload = {
          customer_name: formData.full_name.trim(),
          customer_mobile: formData.mobile.trim(),
          customer_email: formData.email.trim() || undefined,
          customer_city: formData.city.trim() || undefined,
          customer_pincode: formData.pincode.trim() || undefined,
          loan_category_id: selectedCategory.id,
          loan_category_code: selectedCategory.code,
          loan_subcategory_id: selectedSubcategory.id,
          loan_subcategory_code: selectedSubcategory.code,
          loan_type: selectedSubcategory.name,
          form_source: formSourceMap[source] || 'ULAP_PUBLIC_FORM',
          source_type: source,
          source_partner_type: source,
          source_id: partnerId,
          source_name: partnerName,
          partner_id: partnerId,
          partner_name: partnerName,
          application_phase: 1,
        };

        const response = await fetch('/api/ulap/submit-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to submit application');
        }

        const newLeadNumber = result.data?.lead_number;
        if (!newLeadNumber) {
          throw new Error('Lead submitted but no lead number returned');
        }
        setLeadNumber(newLeadNumber);
        setShowSuccess(true);
        onSuccess?.(newLeadNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, selectedCategory, selectedSubcategory, source, partnerId, partnerName, onSuccess]);

  // Handle reset
  const handleReset = useCallback(() => {
    setStep('loan-category');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setShowSuccess(false);
    setLeadNumber('');
    setFormData({
      full_name: '',
      mobile: '',
      email: '',
      city: '',
      pincode: '',
      estimated_amount: '',
    });
  }, []);

  // Handle proceed to Phase 2
  const handleProceedToPhase2 = useCallback(() => {
    // Navigate to Phase 2 document upload page with lead number
    // Use Next.js router for SPA navigation instead of full page reload
    if (typeof window !== 'undefined') {
      window.location.href = `/apply/${encodeURIComponent(leadNumber)}`;
    }
  }, [leadNumber]);

  // Success screen
  if (showSuccess && selectedCategory && selectedSubcategory) {
    return (
      <SuccessScreen
        leadNumber={leadNumber}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        formData={formData}
        partnerName={partnerName}
        onReset={handleReset}
        onProceedToPhase2={handleProceedToPhase2}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">Submit a Lead</h1>
        <p className="text-xs text-white/50 mt-1">
          {step === 'loan-category' && 'Select a loan category'}
          {step === 'loan-subcategory' && 'Select loan type'}
          {step === 'loan-details' && 'Fill applicant details'}
        </p>
      </div>

      {/* Cancel button */}
      {onCancel && (
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-400/70 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {step === 'loan-category' && (
          <motion.div
            key="category"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <CategorySelection
              categories={categories}
              subcategoriesMap={subcategoriesMap}
              bankCountsMap={bankCountsMap}
              onSelect={handleCategorySelect}
            />
          </motion.div>
        )}

        {step === 'loan-subcategory' && selectedCategory && (
          <motion.div
            key="subcategory"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <SubcategorySelection
              selectedCategory={selectedCategory}
              subcategories={subcategoriesMap[selectedCategory.id] || []}
              onSelect={handleSubcategorySelect}
              onBack={() => setStep('loan-category')}
            />
          </motion.div>
        )}

        {step === 'loan-details' && selectedCategory && selectedSubcategory && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ApplicantForm
              selectedCategory={selectedCategory}
              selectedSubcategory={selectedSubcategory}
              formData={formData}
              setFormData={setFormData}
              isSubmitting={isSubmitting}
              onBack={() => setStep('loan-subcategory')}
              onSubmit={handleSubmit}
              partnerName={partnerName}
              source={source}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
