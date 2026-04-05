/**
 * Knowledge Base Categories Data
 * Comprehensive loan product categories and banking knowledge segments
 */

import type { KBCategory } from '@/types/knowledge-base'

export const KB_CATEGORIES: KBCategory[] = [
  // ============================================================================
  // LOAN PRODUCT CATEGORIES
  // ============================================================================
  {
    id: 'cat-personal-loan',
    slug: 'personal-loan',
    name: 'Personal Loan',
    description: 'Unsecured loans for personal needs including medical emergencies, travel, weddings, and debt consolidation. Learn about eligibility, interest rates, and application process.',
    icon: 'user-dollar',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    image: '/images/kb/personal-loan-hero.jpg',
    order: 1,
    articleCount: 45,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['personal-loan', 'unsecured-loan', 'instant-loan', 'quick-loan'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-business-loan',
    slug: 'business-loan',
    name: 'Business Loan',
    description: 'Financing solutions for businesses including working capital, equipment financing, and expansion loans. Covers MSME loans, startup funding, and corporate credit.',
    icon: 'briefcase',
    color: '#8B5CF6',
    gradient: 'from-violet-500 to-purple-600',
    image: '/images/kb/business-loan-hero.jpg',
    order: 2,
    articleCount: 52,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['business-loan', 'msme', 'working-capital', 'corporate-loan'],
      lastUpdated: '2024-01-14'
    }
  },
  {
    id: 'cat-mortgage-loan',
    slug: 'mortgage-loan',
    name: 'Mortgage Loan',
    description: 'Secured loans against property including residential and commercial mortgages. Understand LTV ratios, mortgage types, and refinancing options.',
    icon: 'building-columns',
    color: '#10B981',
    gradient: 'from-emerald-500 to-green-600',
    image: '/images/kb/mortgage-loan-hero.jpg',
    order: 3,
    articleCount: 38,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['mortgage', 'secured-loan', 'property-loan', 'refinancing'],
      lastUpdated: '2024-01-13'
    }
  },
  {
    id: 'cat-home-loan',
    slug: 'home-loan',
    name: 'Home Loan',
    description: 'Housing finance for purchasing, constructing, or renovating homes. Learn about PMAY subsidies, home loan tax benefits, and balance transfer options.',
    icon: 'home',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-orange-600',
    image: '/images/kb/home-loan-hero.jpg',
    order: 4,
    articleCount: 48,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['home-loan', 'housing-loan', 'pmay', 'property-purchase'],
      lastUpdated: '2024-01-12'
    }
  },
  {
    id: 'cat-car-loan',
    slug: 'car-loan',
    name: 'Car Loan',
    description: 'Vehicle financing for new and used cars. Covers dealer financing, pre-approved loans, and two-wheeler loans with competitive interest rates.',
    icon: 'car',
    color: '#EF4444',
    gradient: 'from-red-500 to-rose-600',
    image: '/images/kb/car-loan-hero.jpg',
    order: 5,
    articleCount: 32,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['car-loan', 'vehicle-loan', 'auto-loan', 'two-wheeler-loan'],
      lastUpdated: '2024-01-11'
    }
  },
  {
    id: 'cat-education-loan',
    slug: 'education-loan',
    name: 'Education Loan',
    description: 'Student loans for higher education in India and abroad. Understand education loan schemes, collateral requirements, and moratorium periods.',
    icon: 'graduation-cap',
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-teal-600',
    image: '/images/kb/education-loan-hero.jpg',
    order: 6,
    articleCount: 28,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['education-loan', 'student-loan', 'study-abroad', 'vidya-lakshmi'],
      lastUpdated: '2024-01-10'
    }
  },
  {
    id: 'cat-gold-loan',
    slug: 'gold-loan',
    name: 'Gold Loan',
    description: 'Instant loans against gold ornaments and jewelry. Quick disbursement with minimal documentation and flexible repayment options.',
    icon: 'coins',
    color: '#F59E0B',
    gradient: 'from-yellow-500 to-amber-600',
    image: '/images/kb/gold-loan-hero.jpg',
    order: 7,
    articleCount: 22,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['gold-loan', 'jewel-loan', 'instant-loan', 'secured-loan'],
      lastUpdated: '2024-01-09'
    }
  },
  {
    id: 'cat-lap',
    slug: 'loan-against-property',
    name: 'Loan Against Property',
    description: 'Secured loans using residential or commercial property as collateral. Higher loan amounts with longer tenures for business or personal needs.',
    icon: 'building',
    color: '#84CC16',
    gradient: 'from-lime-500 to-green-600',
    image: '/images/kb/lap-hero.jpg',
    order: 8,
    articleCount: 35,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['lap', 'property-loan', 'secured-loan', 'mortgage'],
      lastUpdated: '2024-01-08'
    }
  },

  // ============================================================================
  // BANKING KNOWLEDGE CATEGORIES
  // ============================================================================
  {
    id: 'cat-banking-basics',
    slug: 'banking-basics',
    name: 'Banking Basics',
    description: 'Fundamental banking concepts including account types, banking services, NEFT/RTGS/IMPS, and digital banking fundamentals.',
    icon: 'landmark',
    color: '#6366F1',
    gradient: 'from-indigo-500 to-blue-600',
    image: '/images/kb/banking-basics-hero.jpg',
    order: 9,
    articleCount: 55,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['banking', 'account', 'neft', 'rtgs', 'imps', 'upi'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-credit-score',
    slug: 'credit-score',
    name: 'Credit Score & CIBIL',
    description: 'Understanding credit scores, CIBIL reports, factors affecting creditworthiness, and tips to improve your credit score.',
    icon: 'chart-line',
    color: '#EC4899',
    gradient: 'from-pink-500 to-rose-600',
    image: '/images/kb/credit-score-hero.jpg',
    order: 10,
    articleCount: 42,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['cibil', 'credit-score', 'credit-report', 'creditworthiness'],
      lastUpdated: '2024-01-14'
    }
  },
  {
    id: 'cat-interest-rates',
    slug: 'interest-rates',
    name: 'Interest Rates',
    description: 'Comprehensive guide to interest rates including repo rate, MCLR, base rate, fixed vs floating rates, and rate calculation methods.',
    icon: 'percent',
    color: '#14B8A6',
    gradient: 'from-teal-500 to-cyan-600',
    image: '/images/kb/interest-rates-hero.jpg',
    order: 11,
    articleCount: 38,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['interest-rate', 'repo-rate', 'mclr', 'floating-rate', 'fixed-rate'],
      lastUpdated: '2024-01-13'
    }
  },
  {
    id: 'cat-documentation',
    slug: 'documentation',
    name: 'Documentation',
    description: 'Complete guide to loan documentation including KYC requirements, income proof, address proof, and property documents.',
    icon: 'file-text',
    color: '#64748B',
    gradient: 'from-slate-500 to-gray-600',
    image: '/images/kb/documentation-hero.jpg',
    order: 12,
    articleCount: 45,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['kyc', 'documents', 'pan', 'aadhaar', 'income-proof'],
      lastUpdated: '2024-01-12'
    }
  },
  {
    id: 'cat-emi-calculation',
    slug: 'emi-calculation',
    name: 'EMI & Repayment',
    description: 'Understanding EMI calculation, amortization schedules, prepayment options, and loan repayment strategies.',
    icon: 'calculator',
    color: '#22C55E',
    gradient: 'from-green-500 to-emerald-600',
    image: '/images/kb/emi-hero.jpg',
    order: 13,
    articleCount: 32,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['emi', 'repayment', 'prepayment', 'amortization', 'foreclosure'],
      lastUpdated: '2024-01-11'
    }
  },
  {
    id: 'cat-insurance',
    slug: 'insurance',
    name: 'Loan Insurance',
    description: 'Loan protection insurance, credit life insurance, and property insurance requirements for different loan types.',
    icon: 'shield-check',
    color: '#A855F7',
    gradient: 'from-purple-500 to-violet-600',
    image: '/images/kb/insurance-hero.jpg',
    order: 14,
    articleCount: 28,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['insurance', 'credit-life', 'property-insurance', 'loan-protection'],
      lastUpdated: '2024-01-10'
    }
  },
  {
    id: 'cat-taxation',
    slug: 'taxation',
    name: 'Taxation & Benefits',
    description: 'Tax benefits on loans under various sections of Income Tax Act, GST on loans, TDS provisions, and tax planning strategies.',
    icon: 'receipt',
    color: '#F97316',
    gradient: 'from-orange-500 to-red-600',
    image: '/images/kb/taxation-hero.jpg',
    order: 15,
    articleCount: 35,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['tax-benefit', 'section-80c', 'section-24', 'gst', 'tds'],
      lastUpdated: '2024-01-09'
    }
  },
  {
    id: 'cat-regulatory',
    slug: 'regulatory',
    name: 'Regulatory & Compliance',
    description: 'RBI guidelines, NBFC regulations, fair practices code, and consumer protection norms in lending.',
    icon: 'scale',
    color: '#0EA5E9',
    gradient: 'from-sky-500 to-blue-600',
    image: '/images/kb/regulatory-hero.jpg',
    order: 16,
    articleCount: 40,
    isActive: true,
    metadata: {
      targetAudience: ['partners', 'employees'],
      tags: ['rbi', 'nbfc', 'compliance', 'fair-practices', 'consumer-protection'],
      lastUpdated: '2024-01-08'
    }
  },
  {
    id: 'cat-digital-banking',
    slug: 'digital-banking',
    name: 'Digital Banking',
    description: 'Online banking, mobile banking, UPI, digital loans, video KYC, and paperless loan processing.',
    icon: 'smartphone',
    color: '#8B5CF6',
    gradient: 'from-violet-500 to-indigo-600',
    image: '/images/kb/digital-banking-hero.jpg',
    order: 17,
    articleCount: 38,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['digital-banking', 'mobile-banking', 'upi', 'video-kyc', 'e-mandate'],
      lastUpdated: '2024-01-15'
    }
  },

  // ============================================================================
  // USER GUIDE CATEGORIES
  // ============================================================================
  {
    id: 'cat-partner-guide',
    slug: 'partner-guide',
    name: 'Partner Guide',
    description: 'Comprehensive guides for Business Associates, Business Partners, and Channel Partners on lead management, payouts, and platform usage.',
    icon: 'handshake',
    color: '#059669',
    gradient: 'from-emerald-600 to-teal-600',
    image: '/images/kb/partner-guide-hero.jpg',
    order: 18,
    articleCount: 42,
    isActive: true,
    metadata: {
      targetAudience: ['partners'],
      tags: ['partner', 'dsa', 'connector', 'lead-management', 'payout'],
      lastUpdated: '2024-01-14'
    }
  },
  {
    id: 'cat-customer-guide',
    slug: 'customer-guide',
    name: 'Customer Guide',
    description: 'Step-by-step guides for customers on loan application, document submission, EMI payment, and account management.',
    icon: 'users',
    color: '#2563EB',
    gradient: 'from-blue-600 to-indigo-600',
    image: '/images/kb/customer-guide-hero.jpg',
    order: 19,
    articleCount: 35,
    isActive: true,
    metadata: {
      targetAudience: ['customers'],
      tags: ['customer', 'application', 'repayment', 'support', 'self-service'],
      lastUpdated: '2024-01-13'
    }
  },
  {
    id: 'cat-employee-guide',
    slug: 'employee-guide',
    name: 'Employee Guide',
    description: 'Comprehensive guides for employees on CRM usage, lead management, customer handling, loan processing, and internal workflows.',
    icon: 'briefcase',
    color: '#F97316',
    gradient: 'from-orange-600 to-amber-600',
    image: '/images/kb/employee-guide-hero.jpg',
    order: 20,
    articleCount: 38,
    isActive: true,
    metadata: {
      targetAudience: ['employees'],
      tags: ['employee', 'crm', 'leads', 'processes', 'training', 'workflow'],
      lastUpdated: '2024-01-14'
    }
  },

  // ============================================================================
  // ADDITIONAL FINANCIAL SERVICES CATEGORIES
  // ============================================================================
  {
    id: 'cat-credit-cards',
    slug: 'credit-cards',
    name: 'Credit Cards',
    description: 'Complete guide to credit cards including rewards, cashback, travel cards, annual fees, credit limits, and choosing the right card for your needs.',
    icon: 'credit-card',
    color: '#8B5CF6',
    gradient: 'from-violet-500 to-purple-600',
    image: '/images/kb/credit-cards-hero.jpg',
    order: 21,
    articleCount: 45,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['credit-card', 'rewards', 'cashback', 'travel-card', 'credit-limit'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-savings-deposits',
    slug: 'savings-deposits',
    name: 'Savings & Deposits',
    description: 'Everything about Fixed Deposits, Recurring Deposits, Savings Accounts, Senior Citizen schemes, and maximizing returns on your savings.',
    icon: 'piggy-bank',
    color: '#10B981',
    gradient: 'from-emerald-500 to-green-600',
    image: '/images/kb/savings-deposits-hero.jpg',
    order: 22,
    articleCount: 38,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['fd', 'rd', 'savings', 'deposits', 'interest-rates', 'senior-citizen'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-debit-cards-atm',
    slug: 'debit-cards-atm',
    name: 'Debit Cards & ATM',
    description: 'Guide to debit cards, ATM services, withdrawal limits, transaction charges, international cards, and contactless payments.',
    icon: 'credit-card',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-indigo-600',
    image: '/images/kb/debit-cards-hero.jpg',
    order: 23,
    articleCount: 32,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['debit-card', 'atm', 'withdrawal', 'rupay', 'visa', 'mastercard'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-government-schemes',
    slug: 'government-schemes',
    name: 'Government Schemes',
    description: 'Complete guide to PMAY, Mudra Yojana, Jan Dhan, Atal Pension, Sukanya Samriddhi, and other government financial schemes.',
    icon: 'landmark',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-orange-600',
    image: '/images/kb/govt-schemes-hero.jpg',
    order: 24,
    articleCount: 42,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['pmay', 'mudra', 'jan-dhan', 'subsidy', 'government-loan'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-grievance-redressal',
    slug: 'grievance-redressal',
    name: 'Grievance Redressal',
    description: 'How to file complaints with Banking Ombudsman, RBI, consumer forums, and resolve banking disputes effectively.',
    icon: 'scale',
    color: '#EF4444',
    gradient: 'from-red-500 to-rose-600',
    image: '/images/kb/grievance-hero.jpg',
    order: 25,
    articleCount: 28,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['ombudsman', 'complaint', 'rbi', 'consumer-forum', 'grievance'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-cheques-clearing',
    slug: 'cheques-clearing',
    name: 'Cheques & Clearing',
    description: 'Understanding cheque types, clearing process, MICR codes, cheque bounce laws, and penalties in India.',
    icon: 'file-text',
    color: '#64748B',
    gradient: 'from-slate-500 to-gray-600',
    image: '/images/kb/cheques-hero.jpg',
    order: 26,
    articleCount: 25,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['cheque', 'clearing', 'micr', 'cheque-bounce', 'cts'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-bank-lockers',
    slug: 'bank-lockers',
    name: 'Bank Lockers',
    description: 'Safe deposit locker facility, RBI guidelines, nomination, charges, and what you can store in bank lockers.',
    icon: 'lock',
    color: '#6366F1',
    gradient: 'from-indigo-500 to-violet-600',
    image: '/images/kb/lockers-hero.jpg',
    order: 27,
    articleCount: 18,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['locker', 'safe-deposit', 'nomination', 'rbi-rules'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-investments',
    slug: 'investments',
    name: 'Investments & SIP',
    description: 'Guide to Mutual Funds, SIP, PPF, NPS, equity investments, and building wealth through systematic investments.',
    icon: 'trending-up',
    color: '#22C55E',
    gradient: 'from-green-500 to-emerald-600',
    image: '/images/kb/investments-hero.jpg',
    order: 28,
    articleCount: 48,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['mutual-fund', 'sip', 'ppf', 'nps', 'investment', 'wealth'],
      lastUpdated: '2024-01-15'
    }
  },
  {
    id: 'cat-aadhaar-pan',
    slug: 'aadhaar-pan',
    name: 'Aadhaar & PAN',
    description: 'Linking Aadhaar with PAN, bank accounts, KYC updates, UIDAI services, and compliance requirements.',
    icon: 'id-card',
    color: '#EC4899',
    gradient: 'from-pink-500 to-rose-600',
    image: '/images/kb/aadhaar-pan-hero.jpg',
    order: 29,
    articleCount: 22,
    isActive: true,
    metadata: {
      targetAudience: ['customers', 'partners', 'employees'],
      tags: ['aadhaar', 'pan', 'kyc', 'uidai', 'linking'],
      lastUpdated: '2024-01-15'
    }
  }
]

export const getKBCategoryBySlug = (slug: string): KBCategory | undefined => {
  return KB_CATEGORIES.find(cat => cat.slug === slug)
}

export const getKBCategoriesByAudience = (audience: string): KBCategory[] => {
  return KB_CATEGORIES.filter(cat =>
    cat.metadata.targetAudience.includes(audience) && cat.isActive
  )
}

export const getActiveKBCategories = (): KBCategory[] => {
  return KB_CATEGORIES.filter(cat => cat.isActive).sort((a, b) => a.order - b.order)
}
