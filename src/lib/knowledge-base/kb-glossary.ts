/**
 * Knowledge Base Glossary - Banking & Financial Terminology
 * Exhaustive glossary covering all banking terms and concepts
 */

import type { KBGlossaryTerm } from '@/types/knowledge-base'

export const KB_GLOSSARY: KBGlossaryTerm[] = [
  // ============================================================================
  // A
  // ============================================================================
  {
    id: 'term-aadhaar',
    term: 'Aadhaar',
    definition: 'Aadhaar is a 12-digit unique identification number issued by UIDAI (Unique Identification Authority of India) to residents of India. It serves as proof of identity and address anywhere in India. Aadhaar is linked to biometric data (fingerprints and iris scans) making it highly secure. For loan applications, Aadhaar is often used for e-KYC verification, enabling instant identity verification through OTP or biometric authentication.',
    shortDefinition: '12-digit unique ID issued by UIDAI for identity verification',
    category: 'documentation',
    relatedTerms: ['KYC', 'e-KYC', 'PAN', 'UIDAI'],
    examples: ['Aadhaar-based e-KYC for instant loan approval', 'Linking Aadhaar to bank account for DBT'],
    aliases: ['Aadhar', 'UID', 'Unique Identification Number'],
    firstLetter: 'A',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-amortization',
    term: 'Amortization',
    definition: 'Amortization is the process of spreading a loan into a series of fixed payments over time. Each EMI payment includes both principal and interest components. In the early stages of a loan, a larger portion of the EMI goes towards interest, while in later stages, more goes towards principal repayment. The amortization schedule is a table showing the breakdown of each payment over the loan tenure.',
    shortDefinition: 'Process of repaying loan through fixed periodic payments',
    category: 'emi-calculation',
    relatedTerms: ['EMI', 'Principal', 'Interest', 'Loan Tenure'],
    examples: ['20-year home loan amortization schedule', 'Front-loaded interest in amortization'],
    aliases: ['Loan Amortization', 'Amortization Schedule'],
    firstLetter: 'A',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-apr',
    term: 'APR (Annual Percentage Rate)',
    definition: 'APR is the total annual cost of borrowing expressed as a percentage. Unlike the nominal interest rate, APR includes all fees and charges associated with the loan, such as processing fees, insurance premiums, and other costs. This provides a more accurate picture of the true cost of the loan and helps borrowers compare different loan offers effectively.',
    shortDefinition: 'Total annual cost of loan including all fees and charges',
    category: 'interest-rates',
    relatedTerms: ['Interest Rate', 'Processing Fee', 'Effective Interest Rate'],
    examples: ['APR of 12% vs nominal rate of 10%', 'Comparing APR across lenders'],
    aliases: ['Annual Percentage Rate', 'All-in Rate'],
    firstLetter: 'A',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // B
  // ============================================================================
  {
    id: 'term-balance-transfer',
    term: 'Balance Transfer',
    definition: 'Balance Transfer is the process of transferring an existing loan from one lender to another, typically to take advantage of lower interest rates or better terms. In home loans, this is common when interest rates drop or when a borrower finds a better deal. The new lender pays off the existing loan and takes over the liability. There may be processing fees and other charges involved.',
    shortDefinition: 'Transferring existing loan to another lender for better terms',
    category: 'home-loan',
    relatedTerms: ['Home Loan', 'Interest Rate', 'Processing Fee', 'Top-up Loan'],
    examples: ['Transferring home loan for 0.5% lower rate', 'Balance transfer with top-up facility'],
    aliases: ['Loan Transfer', 'Home Loan Transfer', 'Refinancing'],
    firstLetter: 'B',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-base-rate',
    term: 'Base Rate',
    definition: 'Base Rate was the minimum lending rate set by banks below which they could not lend to any borrower (except certain categories). It was introduced by RBI in 2010 to replace the BPLR system. Banks calculated base rate based on cost of funds, operating expenses, and minimum return. It has been largely replaced by MCLR and now EBLR for new loans, but older loans may still be linked to base rate.',
    shortDefinition: 'Minimum lending rate set by banks (older benchmark)',
    category: 'interest-rates',
    relatedTerms: ['MCLR', 'EBLR', 'Repo Rate', 'Benchmark Rate'],
    examples: ['Base rate of 9.25%', 'Converting from base rate to MCLR'],
    aliases: ['Bank Base Rate', 'BR'],
    firstLetter: 'B',
    isImportant: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-borrower',
    term: 'Borrower',
    definition: 'A borrower is an individual or entity that receives funds from a lender with an agreement to repay the principal amount along with interest over a specified period. In loan transactions, the borrower is the party who takes the loan and is legally obligated to repay it. The borrower must meet eligibility criteria and provide necessary documents for loan approval.',
    shortDefinition: 'Person or entity who takes a loan and agrees to repay it',
    category: 'banking-basics',
    relatedTerms: ['Lender', 'Co-borrower', 'Guarantor', 'Principal'],
    examples: ['Primary borrower in home loan', 'Corporate borrower for business loan'],
    aliases: ['Loan Applicant', 'Debtor'],
    firstLetter: 'B',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // C
  // ============================================================================
  {
    id: 'term-cibil',
    term: 'CIBIL Score',
    definition: 'CIBIL Score is a 3-digit credit score (300-900) provided by TransUnion CIBIL, India\'s first credit information company. It represents an individual\'s creditworthiness based on their credit history. A score above 750 is considered good. Lenders use CIBIL scores to assess loan applications. The score is calculated based on payment history (35%), credit utilization (30%), credit age (15%), credit mix (10%), and credit inquiries (10%).',
    shortDefinition: '3-digit credit score (300-900) indicating creditworthiness',
    category: 'credit-score',
    relatedTerms: ['Credit Report', 'Credit History', 'Credit Bureau', 'TransUnion'],
    examples: ['CIBIL score of 780', 'Improving CIBIL score for better rates'],
    aliases: ['Credit Score', 'CIBIL Rating', 'TransUnion Score'],
    firstLetter: 'C',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-collateral',
    term: 'Collateral',
    definition: 'Collateral is an asset pledged by a borrower as security for a loan. If the borrower defaults, the lender can seize and sell the collateral to recover the outstanding amount. Common forms of collateral include property (for home loans, LAP), vehicles (for car loans), gold (for gold loans), and fixed deposits. Loans with collateral are called secured loans and typically have lower interest rates than unsecured loans.',
    shortDefinition: 'Asset pledged as security for loan repayment',
    category: 'banking-basics',
    relatedTerms: ['Secured Loan', 'Mortgage', 'Hypothecation', 'LTV'],
    examples: ['Property as collateral for LAP', 'Gold jewelry as collateral'],
    aliases: ['Security', 'Pledge', 'Charge'],
    firstLetter: 'C',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-co-applicant',
    term: 'Co-applicant',
    definition: 'A co-applicant is a person who applies for a loan jointly with the primary applicant. The co-applicant\'s income is considered when calculating loan eligibility, which can increase the loan amount. Co-applicants share the repayment responsibility and their credit history affects loan approval. For home loans, having a co-applicant who is a co-owner of the property is often mandatory. Common co-applicants include spouses, parents, or adult children.',
    shortDefinition: 'Person who jointly applies for loan with primary applicant',
    category: 'banking-basics',
    relatedTerms: ['Borrower', 'Co-borrower', 'Guarantor', 'Joint Loan'],
    examples: ['Spouse as co-applicant for home loan', 'Adding co-applicant for higher eligibility'],
    aliases: ['Co-borrower', 'Joint Applicant'],
    firstLetter: 'C',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-credit-utilization',
    term: 'Credit Utilization Ratio',
    definition: 'Credit Utilization Ratio is the percentage of available credit that is currently being used. It is calculated by dividing total credit card balances by total credit limits. A lower ratio (below 30%) is better for credit scores. High credit utilization indicates higher risk to lenders. It accounts for about 30% of the CIBIL score calculation.',
    shortDefinition: 'Percentage of available credit currently in use',
    category: 'credit-score',
    relatedTerms: ['Credit Limit', 'Credit Score', 'Credit Card', 'Available Credit'],
    examples: ['30% utilization on ₹1 lakh limit = ₹30,000 used', 'Reducing utilization to improve score'],
    aliases: ['Credit Usage Ratio', 'Utilization Rate'],
    firstLetter: 'C',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-cgtmse',
    term: 'CGTMSE',
    definition: 'Credit Guarantee Fund Trust for Micro and Small Enterprises (CGTMSE) is a scheme that provides credit guarantee to lenders for collateral-free loans to MSMEs. Established by SIDBI and Government of India, it covers loans up to ₹2 crores without requiring collateral or third-party guarantee. The guarantee fee is typically borne by the borrower and ranges from 1-2% annually.',
    shortDefinition: 'Government scheme guaranteeing collateral-free MSME loans',
    category: 'business-loan',
    relatedTerms: ['MSME', 'Collateral-free Loan', 'SIDBI', 'Credit Guarantee'],
    examples: ['CGTMSE-backed loan of ₹1 crore', 'Guarantee coverage of 75-85%'],
    aliases: ['Credit Guarantee Scheme', 'CGTMSE Cover'],
    firstLetter: 'C',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // D
  // ============================================================================
  {
    id: 'term-disbursement',
    term: 'Disbursement',
    definition: 'Disbursement is the release of loan funds to the borrower after loan sanction and completion of all formalities. For personal and car loans, disbursement is usually in lump sum. For home loans, it may be in tranches based on construction progress. The date of disbursement is when interest starts accruing, not the sanction date.',
    shortDefinition: 'Release of loan amount to borrower after approval',
    category: 'banking-basics',
    relatedTerms: ['Sanction', 'Loan Agreement', 'Tranche', 'Interest Accrual'],
    examples: ['Full disbursement of personal loan', 'Stage-wise disbursement for under-construction property'],
    aliases: ['Loan Release', 'Fund Transfer'],
    firstLetter: 'D',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-default',
    term: 'Default',
    definition: 'Default occurs when a borrower fails to make scheduled loan payments as per the loan agreement. Typically, an account is considered in default after 90 days of non-payment (NPA classification). Default has serious consequences including negative impact on credit score, penalty charges, legal action, and seizure of collateral. It remains on credit report for 7 years.',
    shortDefinition: 'Failure to repay loan as per agreed terms',
    category: 'banking-basics',
    relatedTerms: ['NPA', 'Credit Score', 'Overdue', 'Wilful Defaulter'],
    examples: ['90 days past due = default', 'Recovery action after default'],
    aliases: ['Loan Default', 'Payment Default'],
    firstLetter: 'D',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-dsa',
    term: 'DSA (Direct Selling Agent)',
    definition: 'Direct Selling Agent (DSA) is an individual or entity authorized by banks/NBFCs to source loan applications. DSAs market and sell loan products on behalf of lenders and earn commission on successful disbursements. They help customers with loan applications, document collection, and follow-up. Also known as loan agents, connectors, or channel partners.',
    shortDefinition: 'Agent authorized to sell loans on behalf of banks/NBFCs',
    category: 'partner-guide',
    relatedTerms: ['Channel Partner', 'Business Associate', 'Commission', 'Payout'],
    examples: ['DSA commission of 1% on home loan', 'Becoming a DSA for multiple banks'],
    aliases: ['Loan Agent', 'Connector', 'Business Associate', 'Channel Partner'],
    firstLetter: 'D',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-down-payment',
    term: 'Down Payment',
    definition: 'Down payment is the initial amount paid by the borrower upfront when purchasing an asset with a loan. It represents the borrower\'s own contribution and reduces the loan amount required. For home loans, minimum down payment is 10-25% of property value. For car loans, it\'s typically 10-20%. Higher down payment results in lower EMI and less interest paid over the loan tenure.',
    shortDefinition: 'Initial amount paid by borrower when taking loan',
    category: 'banking-basics',
    relatedTerms: ['LTV', 'Margin Money', 'Own Contribution', 'Loan Amount'],
    examples: ['20% down payment on ₹50 lakh property = ₹10 lakhs', 'Zero down payment car loan'],
    aliases: ['Margin Money', 'Own Contribution', 'Self-Contribution'],
    firstLetter: 'D',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // E
  // ============================================================================
  {
    id: 'term-emi',
    term: 'EMI (Equated Monthly Installment)',
    definition: 'EMI is a fixed payment amount made by a borrower to a lender at a specified date each calendar month. EMI includes both principal and interest components. The formula is: EMI = P × r × (1+r)^n / [(1+r)^n – 1], where P is principal, r is monthly interest rate, and n is tenure in months. In the initial period, EMI has higher interest component, which gradually decreases as principal gets repaid.',
    shortDefinition: 'Fixed monthly payment including principal and interest',
    category: 'emi-calculation',
    relatedTerms: ['Principal', 'Interest', 'Amortization', 'Loan Tenure'],
    examples: ['EMI of ₹21,247 for ₹10 lakh loan at 10% for 5 years', 'Reducing EMI vs tenure'],
    aliases: ['Monthly Installment', 'Loan EMI'],
    firstLetter: 'E',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-eblr',
    term: 'EBLR (External Benchmark Lending Rate)',
    definition: 'EBLR is the lending rate linked to an external benchmark, typically the RBI repo rate. Since October 2019, RBI mandated all new retail loans (home, auto, personal, MSME) to be linked to external benchmarks. This ensures faster transmission of RBI rate cuts to borrowers. Banks add a spread (margin) to the benchmark to arrive at the final lending rate.',
    shortDefinition: 'Lending rate linked to RBI repo rate for transparent pricing',
    category: 'interest-rates',
    relatedTerms: ['Repo Rate', 'MCLR', 'Spread', 'Rate Transmission'],
    examples: ['EBLR = Repo Rate (6.5%) + Spread (2.5%) = 9%', 'Quarterly rate reset'],
    aliases: ['External Benchmark Rate', 'Repo-linked Rate'],
    firstLetter: 'E',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-e-nach',
    term: 'e-NACH',
    definition: 'Electronic National Automated Clearing House (e-NACH) is a centralized system for repetitive payments like EMIs, insurance premiums, and SIPs. It enables auto-debit from bank account on specified dates. e-NACH mandates can be registered online through net banking or UPI. It provides convenience of automatic payments and helps avoid missed EMIs.',
    shortDefinition: 'Electronic auto-debit system for recurring payments',
    category: 'digital-banking',
    relatedTerms: ['Auto-debit', 'ECS', 'Standing Instruction', 'EMI'],
    examples: ['e-NACH mandate for home loan EMI', 'UPI-based e-NACH registration'],
    aliases: ['NACH', 'Auto-debit Mandate', 'ECS'],
    firstLetter: 'E',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // F
  // ============================================================================
  {
    id: 'term-foir',
    term: 'FOIR (Fixed Obligation to Income Ratio)',
    definition: 'FOIR is a key metric used by lenders to assess loan eligibility. It represents the percentage of monthly income that goes towards fixed obligations like existing EMIs, rent, and proposed new EMI. Most lenders prefer FOIR below 50-60%. Lower FOIR indicates better repayment capacity and higher chances of loan approval.',
    shortDefinition: 'Ratio of fixed payments to monthly income',
    category: 'banking-basics',
    relatedTerms: ['Eligibility', 'EMI', 'Net Income', 'DTI'],
    examples: ['FOIR of 45% on ₹1 lakh income = ₹45,000 total EMIs', 'Reducing FOIR for loan approval'],
    aliases: ['Fixed Obligation Ratio', 'Debt-to-Income Ratio', 'DTI'],
    firstLetter: 'F',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-floating-rate',
    term: 'Floating Interest Rate',
    definition: 'Floating interest rate is a variable rate that changes based on market conditions and benchmark rates (like repo rate). When benchmark rate increases, the loan rate increases and vice versa. EMI or tenure changes accordingly. Floating rates are typically lower than fixed rates but carry interest rate risk.',
    shortDefinition: 'Variable interest rate that changes with market conditions',
    category: 'interest-rates',
    relatedTerms: ['Fixed Rate', 'EBLR', 'MCLR', 'Repo Rate'],
    examples: ['Floating rate of 8.5% currently', 'Rate reset every quarter'],
    aliases: ['Variable Rate', 'Adjustable Rate'],
    firstLetter: 'F',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-foreclosure',
    term: 'Foreclosure',
    definition: 'Foreclosure refers to paying off the entire outstanding loan amount before the scheduled tenure ends. This can be done from own funds or by taking a new loan (balance transfer). RBI mandates that there should be no foreclosure charges on floating rate loans for individuals. For fixed rate loans, banks may charge up to 2-3% of outstanding amount.',
    shortDefinition: 'Paying off entire loan before scheduled tenure',
    category: 'emi-calculation',
    relatedTerms: ['Prepayment', 'Outstanding', 'Balance Transfer', 'Part Payment'],
    examples: ['Foreclosure after 5 years of 20-year loan', 'Zero foreclosure charges on floating rate'],
    aliases: ['Full Prepayment', 'Loan Closure', 'Early Repayment'],
    firstLetter: 'F',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // G
  // ============================================================================
  {
    id: 'term-guarantor',
    term: 'Guarantor',
    definition: 'A guarantor is a person who guarantees to repay the loan if the primary borrower defaults. Unlike co-applicant, guarantor\'s income is not considered for eligibility but they become liable for repayment on default. Guarantors need to submit KYC documents and sign the loan agreement. Their credit history is also checked and any default affects their CIBIL score.',
    shortDefinition: 'Person who agrees to repay loan if borrower defaults',
    category: 'banking-basics',
    relatedTerms: ['Co-applicant', 'Borrower', 'Default', 'Security'],
    examples: ['Parent as guarantor for education loan', 'Corporate guarantee for business loan'],
    aliases: ['Loan Guarantor', 'Surety'],
    firstLetter: 'G',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-gstin',
    term: 'GSTIN',
    definition: 'Goods and Services Tax Identification Number is a 15-digit unique identification number assigned to businesses registered under GST. It is mandatory for businesses with turnover above threshold limit. GSTIN is required for business loan applications as proof of business registration and to verify business credentials.',
    shortDefinition: '15-digit unique GST registration number',
    category: 'documentation',
    relatedTerms: ['GST', 'Business Registration', 'Tax Compliance', 'ITR'],
    examples: ['GSTIN: 29AAACC1206D1ZY', 'Linking GSTIN to loan application'],
    aliases: ['GST Number', 'GSTN'],
    firstLetter: 'G',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // H
  // ============================================================================
  {
    id: 'term-hypothecation',
    term: 'Hypothecation',
    definition: 'Hypothecation is a form of charge where movable assets (like vehicles, stock, receivables) are pledged as security without transferring possession to the lender. The borrower retains possession and use of the asset. In case of default, the lender can take possession and sell the asset. Car loans use hypothecation where the vehicle is pledged but borrower uses it.',
    shortDefinition: 'Pledge of movable asset as security without transferring possession',
    category: 'banking-basics',
    relatedTerms: ['Collateral', 'Mortgage', 'Pledge', 'Charge'],
    examples: ['Hypothecation of car in auto loan', 'Stock hypothecation in working capital'],
    aliases: ['Asset Hypothecation', 'Movable Asset Charge'],
    firstLetter: 'H',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // I
  // ============================================================================
  {
    id: 'term-ifsc',
    term: 'IFSC Code',
    definition: 'Indian Financial System Code is an 11-character alphanumeric code that uniquely identifies a bank branch in India. First 4 characters represent bank, 5th is always 0, and last 6 identify the branch. IFSC is mandatory for all electronic fund transfers like NEFT, RTGS, and IMPS. It ensures accurate routing of funds to the correct branch.',
    shortDefinition: '11-character code uniquely identifying bank branch',
    category: 'banking-basics',
    relatedTerms: ['NEFT', 'RTGS', 'IMPS', 'Bank Account'],
    examples: ['SBIN0000123 - SBI branch', 'Finding IFSC on cheque book'],
    aliases: ['IFS Code', 'Branch Code'],
    firstLetter: 'I',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-itr',
    term: 'ITR (Income Tax Return)',
    definition: 'Income Tax Return is a form filed with the Income Tax Department declaring annual income and tax paid. ITR is a crucial document for loan applications as it serves as proof of income. Lenders typically require ITR for last 2-3 years for salaried (high-value loans) and self-employed applicants. Filed ITR with acknowledgment (ITR-V) is accepted.',
    shortDefinition: 'Annual tax filing document used as income proof',
    category: 'documentation',
    relatedTerms: ['Income Proof', 'Form 16', 'Tax Assessment', 'PAN'],
    examples: ['ITR-1 for salaried individuals', 'ITR-3 for business income'],
    aliases: ['Income Tax Return', 'Tax Return', 'IT Return'],
    firstLetter: 'I',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // K
  // ============================================================================
  {
    id: 'term-kyc',
    term: 'KYC (Know Your Customer)',
    definition: 'KYC is a mandatory verification process required by RBI for all financial services. It involves verifying customer identity and address through valid documents. KYC helps prevent fraud, money laundering, and terrorist financing. Types include in-person KYC, video KYC (V-KYC), e-KYC (Aadhaar-based), and CKYC (Central KYC).',
    shortDefinition: 'Mandatory identity verification process for financial services',
    category: 'documentation',
    relatedTerms: ['Aadhaar', 'PAN', 'Identity Proof', 'Address Proof'],
    examples: ['Video KYC for instant loan approval', 'CKYC for one-time verification'],
    aliases: ['Know Your Customer', 'Customer Verification'],
    firstLetter: 'K',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // L
  // ============================================================================
  {
    id: 'term-ltv',
    term: 'LTV (Loan to Value Ratio)',
    definition: 'LTV ratio is the percentage of property/asset value that can be borrowed as loan. It is calculated as (Loan Amount / Property Value) × 100. For home loans, RBI allows maximum LTV of 75-90% based on loan amount. Lower LTV means higher down payment requirement. LTV affects loan eligibility and interest rates.',
    shortDefinition: 'Percentage of asset value available as loan',
    category: 'home-loan',
    relatedTerms: ['Down Payment', 'Property Value', 'Loan Amount', 'Margin'],
    examples: ['LTV of 80% on ₹50 lakh property = ₹40 lakh loan', 'Lower LTV for luxury properties'],
    aliases: ['Loan to Value', 'LTV Ratio'],
    firstLetter: 'L',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-lien',
    term: 'Lien',
    definition: 'A lien is a legal claim or right against an asset used as collateral. When you take a loan against an asset, the lender places a lien on it. This prevents the borrower from selling or transferring the asset without the lender\'s permission. The lien is removed once the loan is fully repaid. Common examples include lien on FD for overdraft, lien on property for home loan.',
    shortDefinition: 'Legal claim on asset pledged as loan collateral',
    category: 'banking-basics',
    relatedTerms: ['Collateral', 'Mortgage', 'Hypothecation', 'Encumbrance'],
    examples: ['Lien on FD for loan against FD', 'Release of lien after loan closure'],
    aliases: ['Security Interest', 'Charge'],
    firstLetter: 'L',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // M
  // ============================================================================
  {
    id: 'term-mclr',
    term: 'MCLR (Marginal Cost of Funds Based Lending Rate)',
    definition: 'MCLR is an internal benchmark rate calculated by banks based on their marginal cost of funds. Introduced by RBI in 2016 to replace base rate, it ensures better transmission of policy rates. Banks calculate MCLR considering marginal cost of funds, operating costs, and tenor premium. Reset periods range from 6 months to 1 year. Being phased out in favor of EBLR.',
    shortDefinition: 'Bank\'s internal lending benchmark based on cost of funds',
    category: 'interest-rates',
    relatedTerms: ['EBLR', 'Base Rate', 'Spread', 'Repo Rate'],
    examples: ['1-year MCLR of 8.5%', 'MCLR + Spread = Final Rate'],
    aliases: ['Marginal Cost Rate', 'MCR'],
    firstLetter: 'M',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-moratorium',
    term: 'Moratorium',
    definition: 'Moratorium is a period during which loan repayment is not required. During moratorium, principal and sometimes interest payments are deferred. Common in education loans (course duration + 6 months), construction-linked home loans, and COVID-19 relief measures. Interest may continue to accrue during moratorium and gets added to principal.',
    shortDefinition: 'Period of deferred loan repayment',
    category: 'emi-calculation',
    relatedTerms: ['EMI', 'Principal', 'Interest', 'Education Loan'],
    examples: ['2-year moratorium on education loan', 'COVID moratorium of 6 months'],
    aliases: ['Payment Holiday', 'Repayment Holiday', 'Grace Period'],
    firstLetter: 'M',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-mortgage',
    term: 'Mortgage',
    definition: 'Mortgage is a legal agreement where immovable property (land or building) is pledged as security for a loan. The property remains with the borrower, but the lender has a legal claim on it. If the borrower defaults, the lender can sell the property to recover the loan. Types include simple mortgage, English mortgage, and equitable mortgage.',
    shortDefinition: 'Pledge of immovable property as loan security',
    category: 'mortgage-loan',
    relatedTerms: ['Hypothecation', 'Collateral', 'LAP', 'Home Loan'],
    examples: ['Registered mortgage for home loan', 'Equitable mortgage by deposit of title deeds'],
    aliases: ['Property Mortgage', 'Real Estate Mortgage'],
    firstLetter: 'M',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-mudra',
    term: 'MUDRA',
    definition: 'Micro Units Development and Refinance Agency (MUDRA) is a government organization that provides refinancing to lenders for loans given to micro enterprises. MUDRA loans are available in three categories: Shishu (up to ₹50,000), Kishore (₹50,000-5 lakhs), and Tarun (₹5-10 lakhs). These are collateral-free loans available through all banks.',
    shortDefinition: 'Government scheme for collateral-free MSME loans up to ₹10 lakhs',
    category: 'business-loan',
    relatedTerms: ['MSME', 'Shishu', 'Kishore', 'Tarun'],
    examples: ['Mudra Shishu loan of ₹50,000', 'Applying through Udyamimitra portal'],
    aliases: ['MUDRA Loan', 'Pradhan Mantri MUDRA Yojana', 'PMMY'],
    firstLetter: 'M',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-msme',
    term: 'MSME',
    definition: 'Micro, Small, and Medium Enterprises are businesses classified based on investment and turnover. Micro: Investment up to ₹1 crore, Turnover up to ₹5 crore. Small: Investment up to ₹10 crore, Turnover up to ₹50 crore. Medium: Investment up to ₹50 crore, Turnover up to ₹250 crore. MSMEs get priority sector lending benefits and government schemes.',
    shortDefinition: 'Micro, Small, and Medium Enterprises classified by size',
    category: 'business-loan',
    relatedTerms: ['MUDRA', 'Udyam', 'Priority Sector', 'CGTMSE'],
    examples: ['Udyam registration for MSME benefits', 'Priority sector lending to MSMEs'],
    aliases: ['SME', 'Small Business', 'Micro Enterprise'],
    firstLetter: 'M',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // N
  // ============================================================================
  {
    id: 'term-npa',
    term: 'NPA (Non-Performing Asset)',
    definition: 'NPA is a loan or advance where principal or interest payment remains overdue for 90 days or more. NPAs are classified as Substandard (NPA for up to 12 months), Doubtful (NPA for more than 12 months), and Loss Assets (considered uncollectable). Banks have to make provisions for NPAs, affecting their profitability. High NPAs indicate poor asset quality.',
    shortDefinition: 'Loan overdue for 90+ days classified as non-performing',
    category: 'regulatory',
    relatedTerms: ['Default', 'Overdue', 'Asset Classification', 'Provisioning'],
    examples: ['Account becomes NPA after 90 DPD', 'NPA resolution through IBC'],
    aliases: ['Non-Performing Loan', 'Bad Loan', 'Stressed Asset'],
    firstLetter: 'N',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-nbfc',
    term: 'NBFC',
    definition: 'Non-Banking Financial Company is a financial institution registered under the Companies Act that provides banking services without holding a banking license. NBFCs offer loans, asset financing, investments, and other financial products. They are regulated by RBI but have different requirements than banks. NBFCs often serve customers that banks may not, sometimes at higher interest rates.',
    shortDefinition: 'Financial institution offering banking services without banking license',
    category: 'regulatory',
    relatedTerms: ['RBI', 'HFC', 'Fintech', 'Lending'],
    examples: ['Bajaj Finance, HDFC Ltd, L&T Finance', 'NBFC-MFI for microfinance'],
    aliases: ['Non-Banking Finance Company', 'Finance Company'],
    firstLetter: 'N',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-noc',
    term: 'NOC (No Objection Certificate)',
    definition: 'NOC is a document issued by the lender after complete repayment of loan, certifying that the borrower has no outstanding dues. It is essential for releasing the lien/charge on collateral assets. For vehicle loans, NOC is needed to remove hypothecation from RC. For home loans, NOC along with original property documents is provided after loan closure.',
    shortDefinition: 'Certificate confirming loan is fully repaid with no dues',
    category: 'documentation',
    relatedTerms: ['Foreclosure', 'Loan Closure', 'Lien Release', 'Title Deed'],
    examples: ['NOC to remove hypothecation from car RC', 'Property NOC after home loan closure'],
    aliases: ['No Due Certificate', 'Loan Closure Certificate'],
    firstLetter: 'N',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // O
  // ============================================================================
  {
    id: 'term-outstanding',
    term: 'Outstanding Balance',
    definition: 'Outstanding balance is the total amount still owed on a loan at any given point, including principal and any accrued interest. It decreases with each EMI payment. The outstanding balance is used to calculate foreclosure amount, prepayment benefits, and for balance transfer quotes. Statement of account shows month-wise outstanding balance.',
    shortDefinition: 'Total amount still owed on loan at any point',
    category: 'emi-calculation',
    relatedTerms: ['Principal', 'Interest', 'Foreclosure', 'Prepayment'],
    examples: ['Outstanding of ₹35 lakhs after 5 years', 'Paying 10% of outstanding as prepayment'],
    aliases: ['Loan Outstanding', 'Balance Due', 'Amount Owed'],
    firstLetter: 'O',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // P
  // ============================================================================
  {
    id: 'term-pan',
    term: 'PAN (Permanent Account Number)',
    definition: 'PAN is a 10-character alphanumeric identifier issued by Income Tax Department. It is mandatory for all financial transactions above specified limits, loan applications, and filing ITR. PAN helps track financial transactions and prevents tax evasion. For loans, PAN is mandatory for KYC and is used to fetch ITR details and credit history.',
    shortDefinition: '10-character tax ID mandatory for financial transactions',
    category: 'documentation',
    relatedTerms: ['ITR', 'KYC', 'Aadhaar', 'TDS'],
    examples: ['PAN format: ABCDE1234F', 'Linking PAN with Aadhaar'],
    aliases: ['Permanent Account Number', 'PAN Card'],
    firstLetter: 'P',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-prepayment',
    term: 'Prepayment',
    definition: 'Prepayment is paying an amount over and above the regular EMI to reduce the loan principal. Part prepayment reduces outstanding and either lowers EMI or shortens tenure. It saves significant interest over loan life. RBI mandates no prepayment charges on floating rate retail loans. Fixed rate loans may have prepayment charges of 2-5%.',
    shortDefinition: 'Extra payment to reduce loan principal faster',
    category: 'emi-calculation',
    relatedTerms: ['Foreclosure', 'EMI', 'Outstanding', 'Interest Savings'],
    examples: ['₹2 lakh prepayment saving ₹5 lakh interest', 'Annual bonus used for prepayment'],
    aliases: ['Part Payment', 'Principal Prepayment', 'Extra Payment'],
    firstLetter: 'P',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-principal',
    term: 'Principal',
    definition: 'Principal is the original loan amount borrowed, excluding interest and fees. Each EMI payment includes a principal component that reduces the outstanding loan amount. In the early stages of loan, EMI has smaller principal component (more interest). As loan progresses, principal component increases. Prepayments directly reduce the principal.',
    shortDefinition: 'Original loan amount borrowed (excluding interest)',
    category: 'emi-calculation',
    relatedTerms: ['Interest', 'EMI', 'Amortization', 'Outstanding'],
    examples: ['Principal of ₹50 lakhs for home loan', 'Principal reduction through prepayment'],
    aliases: ['Loan Principal', 'Original Amount'],
    firstLetter: 'P',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-processing-fee',
    term: 'Processing Fee',
    definition: 'Processing fee is a one-time charge levied by lenders for processing the loan application. It covers documentation, verification, and administrative costs. Typically ranges from 0.5% to 2% of loan amount (plus GST). Some banks waive processing fees during promotional periods. It\'s usually deducted from the disbursed amount or paid upfront.',
    shortDefinition: 'One-time fee charged for processing loan application',
    category: 'banking-basics',
    relatedTerms: ['APR', 'Loan Charges', 'Disbursement', 'Administrative Fee'],
    examples: ['1% processing fee on ₹50 lakh = ₹50,000', 'Processing fee waiver offer'],
    aliases: ['Loan Processing Fee', 'Administrative Fee', 'Setup Fee'],
    firstLetter: 'P',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-pmay',
    term: 'PMAY (Pradhan Mantri Awas Yojana)',
    definition: 'PMAY is a government housing scheme providing interest subsidy on home loans for affordable housing. Credit Linked Subsidy Scheme (CLSS) under PMAY offers interest subsidy of 3-6.5% for EWS, LIG, and MIG categories. Subsidy is provided as upfront deduction from loan principal. Maximum benefit ranges from ₹2.30-2.67 lakhs based on category.',
    shortDefinition: 'Government scheme providing home loan interest subsidy',
    category: 'home-loan',
    relatedTerms: ['CLSS', 'EWS', 'LIG', 'MIG', 'Interest Subsidy'],
    examples: ['PMAY subsidy of ₹2.67 lakhs for EWS', 'First-time home buyer benefit'],
    aliases: ['Pradhan Mantri Awas Yojana', 'Housing for All'],
    firstLetter: 'P',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // R
  // ============================================================================
  {
    id: 'term-repo-rate',
    term: 'Repo Rate',
    definition: 'Repo Rate is the rate at which RBI lends money to commercial banks for short-term (usually overnight). It is the primary tool for controlling inflation and money supply. When RBI increases repo rate, borrowing becomes expensive, reducing money supply. EBLR-linked loans change within 3 months of repo rate changes. Current repo rate: 6.50% (Jan 2024).',
    shortDefinition: 'Rate at which RBI lends to commercial banks',
    category: 'interest-rates',
    relatedTerms: ['EBLR', 'Reverse Repo', 'MPC', 'Monetary Policy'],
    examples: ['Repo rate cut of 25 bps', 'EMI reduction after repo rate cut'],
    aliases: ['Repurchase Rate', 'RBI Repo'],
    firstLetter: 'R',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-rbi',
    term: 'RBI (Reserve Bank of India)',
    definition: 'RBI is India\'s central bank and monetary authority, established in 1935. It regulates banking system, controls money supply, manages foreign exchange, issues currency, and supervises financial institutions. RBI sets policy rates (repo, reverse repo), banking regulations, and consumer protection norms. All banks and NBFCs are regulated by RBI.',
    shortDefinition: 'India\'s central bank and monetary authority',
    category: 'regulatory',
    relatedTerms: ['Repo Rate', 'MPC', 'Banking Ombudsman', 'NBFC'],
    examples: ['RBI guidelines on lending', 'RBI\'s monetary policy decisions'],
    aliases: ['Reserve Bank', 'Central Bank'],
    firstLetter: 'R',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // S
  // ============================================================================
  {
    id: 'term-sanction',
    term: 'Sanction',
    definition: 'Sanction is the formal approval of a loan application by the lender. A sanction letter details the approved loan amount, interest rate, tenure, EMI, and terms & conditions. Sanction does not mean disbursement - additional steps like agreement signing and document verification are required. Sanction may have validity period (typically 6 months).',
    shortDefinition: 'Formal approval of loan application by lender',
    category: 'banking-basics',
    relatedTerms: ['Disbursement', 'Loan Agreement', 'Approval', 'Terms'],
    examples: ['Sanction letter for ₹50 lakh home loan', 'Sanction validity of 180 days'],
    aliases: ['Loan Sanction', 'Approval', 'In-Principle Approval'],
    firstLetter: 'S',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-secured-loan',
    term: 'Secured Loan',
    definition: 'Secured loan is a loan backed by collateral or security. If borrower defaults, lender can seize the collateral. Examples include home loan (property), car loan (vehicle), gold loan (gold), LAP (property). Secured loans have lower interest rates than unsecured loans due to reduced risk for lender. LTV determines how much can be borrowed against collateral.',
    shortDefinition: 'Loan backed by collateral that can be seized on default',
    category: 'banking-basics',
    relatedTerms: ['Collateral', 'Unsecured Loan', 'Mortgage', 'Hypothecation'],
    examples: ['Home loan secured by property', 'Gold loan secured by jewelry'],
    aliases: ['Collateral Loan', 'Asset-Backed Loan'],
    firstLetter: 'S',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-spread',
    term: 'Spread',
    definition: 'Spread is the margin added by banks to the benchmark rate to arrive at the final lending rate. For EBLR loans, Spread = Final Rate - Repo Rate. Spread covers bank\'s operating costs, credit risk premium, and profit margin. Spread is generally fixed at loan origination but may vary based on credit risk profile of borrower.',
    shortDefinition: 'Margin added to benchmark rate for final lending rate',
    category: 'interest-rates',
    relatedTerms: ['EBLR', 'MCLR', 'Benchmark Rate', 'Interest Rate'],
    examples: ['Spread of 2.5% over repo rate', 'Lower spread for good credit score'],
    aliases: ['Interest Spread', 'Margin', 'Mark-up'],
    firstLetter: 'S',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // T
  // ============================================================================
  {
    id: 'term-tenure',
    term: 'Tenure',
    definition: 'Tenure is the duration or time period over which the loan will be repaid. Longer tenure results in lower EMI but higher total interest paid. Shorter tenure means higher EMI but less total interest. Home loans can have tenure up to 30 years, personal loans up to 7 years, car loans up to 8 years. Tenure can be modified through prepayments.',
    shortDefinition: 'Duration over which loan is repaid',
    category: 'banking-basics',
    relatedTerms: ['EMI', 'Interest', 'Amortization', 'Loan Term'],
    examples: ['20-year tenure for home loan', 'Reducing tenure through prepayment'],
    aliases: ['Loan Tenure', 'Loan Term', 'Repayment Period'],
    firstLetter: 'T',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-tds',
    term: 'TDS (Tax Deducted at Source)',
    definition: 'TDS is tax deducted by payer at the time of payment and deposited to government. In loans, TDS is relevant for interest income (on FDs), professional fees, commission to DSAs, and certain payments to contractors. Banks deduct TDS on interest paid if it exceeds threshold. TDS rate for commission to loan agents is typically 5-10%.',
    shortDefinition: 'Tax deducted at time of payment and deposited to government',
    category: 'taxation',
    relatedTerms: ['Income Tax', 'Form 26AS', 'PAN', 'Tax Credit'],
    examples: ['TDS on FD interest above ₹40,000', 'TDS on DSA commission'],
    aliases: ['Tax Deducted at Source', 'Withholding Tax'],
    firstLetter: 'T',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-top-up',
    term: 'Top-up Loan',
    definition: 'Top-up loan is an additional loan taken on top of an existing loan, using the same collateral. It\'s commonly offered to existing home loan or LAP borrowers with good repayment track record. Top-up can be at same or different interest rate. It provides quick access to funds without fresh documentation. Maximum top-up depends on available equity in collateral.',
    shortDefinition: 'Additional loan on existing loan using same collateral',
    category: 'home-loan',
    relatedTerms: ['Home Loan', 'LAP', 'Balance Transfer', 'LTV'],
    examples: ['₹10 lakh top-up on existing home loan', 'Top-up with balance transfer'],
    aliases: ['Loan Top-up', 'Additional Loan'],
    firstLetter: 'T',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // U
  // ============================================================================
  {
    id: 'term-unsecured-loan',
    term: 'Unsecured Loan',
    definition: 'Unsecured loan is a loan that does not require any collateral or security. Approval is based on borrower\'s creditworthiness, income, and repayment capacity. Examples include personal loans, credit cards, and education loans (below certain amount). Unsecured loans have higher interest rates due to increased risk for lenders.',
    shortDefinition: 'Loan without collateral based on creditworthiness',
    category: 'banking-basics',
    relatedTerms: ['Secured Loan', 'Personal Loan', 'Credit Score', 'Collateral'],
    examples: ['Personal loan without security', 'Credit card as unsecured credit'],
    aliases: ['Signature Loan', 'Collateral-Free Loan'],
    firstLetter: 'U',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'term-upi',
    term: 'UPI (Unified Payments Interface)',
    definition: 'UPI is a real-time payment system developed by NPCI enabling instant money transfer between bank accounts through mobile phones. It uses Virtual Payment Address (VPA) instead of bank account details. UPI supports multiple payment modes including P2P, P2M, bill payments, and scheduled payments. UPI is used for EMI payments through UPI AutoPay (e-mandate).',
    shortDefinition: 'Instant mobile payment system using virtual addresses',
    category: 'digital-banking',
    relatedTerms: ['NPCI', 'VPA', 'IMPS', 'e-NACH'],
    examples: ['EMI payment via UPI AutoPay', 'Loan disbursement to UPI-linked account'],
    aliases: ['Unified Payments Interface', 'UPI Payment'],
    firstLetter: 'U',
    isImportant: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  }
]

export const getGlossaryByLetter = (letter: string): KBGlossaryTerm[] => {
  return KB_GLOSSARY.filter(term => term.firstLetter.toUpperCase() === letter.toUpperCase())
}

export const getImportantTerms = (): KBGlossaryTerm[] => {
  return KB_GLOSSARY.filter(term => term.isImportant)
}

export const searchGlossary = (query: string): KBGlossaryTerm[] => {
  const searchTerm = query.toLowerCase()
  return KB_GLOSSARY.filter(term =>
    term.term.toLowerCase().includes(searchTerm) ||
    term.definition.toLowerCase().includes(searchTerm) ||
    term.aliases.some(alias => alias.toLowerCase().includes(searchTerm))
  )
}

export const getGlossaryByCategory = (category: string): KBGlossaryTerm[] => {
  return KB_GLOSSARY.filter(term => term.category === category)
}
