/**
 * Knowledge Base FAQs - Comprehensive Q&A Content
 * Exhaustive FAQ database covering all loan products and banking terminology
 */

import type { KBFAQ } from '@/types/knowledge-base'

export const KB_FAQS: KBFAQ[] = [
  // ============================================================================
  // PERSONAL LOAN FAQs
  // ============================================================================
  {
    id: 'faq-pl-001',
    categoryId: 'cat-personal-loan',
    question: 'What is a Personal Loan and how does it work?',
    answer: `A Personal Loan is an unsecured loan provided by banks and NBFCs for various personal needs without requiring any collateral. Here's how it works:

**Key Features:**
- **Unsecured:** No collateral or security required
- **Flexible Use:** Can be used for any purpose - medical expenses, wedding, travel, home renovation, debt consolidation
- **Fixed EMI:** Equal monthly installments throughout the tenure
- **Quick Disbursement:** Funds credited within 24-72 hours of approval

**How It Works:**
1. Apply online or visit a branch with required documents
2. Lender verifies your creditworthiness and income
3. If approved, loan agreement is signed
4. Amount is disbursed to your bank account
5. Repay through fixed EMIs over the chosen tenure

**Typical Terms:**
- Loan Amount: ₹50,000 to ₹40 lakhs
- Tenure: 12 to 60 months
- Interest Rate: 10.5% to 24% p.a.`,
    order: 1,
    tags: ['personal-loan', 'unsecured-loan', 'basics'],
    helpfulCount: 1245,
    viewCount: 15680,
    isPopular: true,
    relatedFaqIds: ['faq-pl-002', 'faq-pl-003', 'faq-pl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pl-002',
    categoryId: 'cat-personal-loan',
    question: 'What is the eligibility criteria for a Personal Loan?',
    answer: `Personal Loan eligibility depends on multiple factors that lenders evaluate to assess your repayment capacity:

**Age Requirements:**
- Minimum: 21 years
- Maximum: 58-60 years (at loan maturity)

**Employment Status:**
- **Salaried:** Minimum 1-2 years of total work experience, 6 months with current employer
- **Self-employed:** Minimum 2-3 years in current business

**Income Requirements:**
- **Salaried:** Minimum ₹15,000-25,000 monthly income
- **Self-employed:** Minimum ₹3-5 lakh annual income

**Credit Score:**
- Ideal: 750 and above
- Acceptable: 650-750 (with higher interest rates)
- Below 650: May face rejection or very high rates

**Other Factors:**
- Fixed Obligation to Income Ratio (FOIR) below 50-60%
- No history of defaults or late payments
- Stable employment/business
- Residing in areas serviceable by the lender`,
    order: 2,
    tags: ['eligibility', 'personal-loan', 'requirements'],
    helpfulCount: 987,
    viewCount: 12340,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-005', 'faq-cs-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pl-003',
    categoryId: 'cat-personal-loan',
    question: 'What documents are required for a Personal Loan?',
    answer: `Here's a comprehensive list of documents required for Personal Loan application:

**Identity Proof (Any One):**
- Aadhaar Card
- PAN Card (Mandatory)
- Passport
- Voter ID Card
- Driving License

**Address Proof (Any One):**
- Aadhaar Card
- Passport
- Utility Bills (not older than 3 months)
- Bank Statement with address
- Rental Agreement

**Income Documents (For Salaried):**
- Last 3 months salary slips
- Last 6 months bank statements
- Form 16 or ITR for last 2 years
- Appointment/Experience letter

**Income Documents (For Self-Employed):**
- Last 2-3 years ITR with computation
- Last 12 months bank statements
- Business proof (GST registration, Shop Act license)
- Audited financial statements
- Partnership deed/MOA/AOA (if applicable)

**Photographs:**
- 2 recent passport-size photographs

**Additional Documents:**
- Existing loan statements (if any)
- Property documents (for high-value loans)`,
    order: 3,
    tags: ['documents', 'personal-loan', 'kyc'],
    helpfulCount: 856,
    viewCount: 10890,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-002', 'faq-doc-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-004',
    categoryId: 'cat-personal-loan',
    question: 'What affects Personal Loan interest rates?',
    answer: `Personal Loan interest rates are determined by multiple factors. Understanding these can help you secure better rates:

**Borrower-Related Factors:**

1. **Credit Score (30% weightage)**
   - 800+: Lowest rates (10.5-12%)
   - 750-799: Good rates (12-14%)
   - 700-749: Moderate rates (14-18%)
   - Below 700: Higher rates (18-24%)

2. **Income Level (20% weightage)**
   - Higher income = Lower perceived risk = Better rates
   - Salary account with the lending bank gets preferential rates

3. **Employment Type (15% weightage)**
   - Government employees: Best rates
   - PSU employees: Excellent rates
   - MNC/Listed companies: Good rates
   - Small companies: Standard rates
   - Self-employed: Slightly higher rates

4. **Existing Relationship (10% weightage)**
   - Existing customers often get 0.5-1% lower rates
   - Salary account holders get special offers

**Loan-Related Factors:**

5. **Loan Amount (10% weightage)**
   - Higher amounts may qualify for better rates
   - Very small loans may have higher rates

6. **Tenure (10% weightage)**
   - Shorter tenure = Lower interest rates
   - Longer tenure = Slightly higher rates

7. **Market Conditions (5% weightage)**
   - RBI repo rate changes
   - Overall economic conditions
   - Lender's cost of funds`,
    order: 4,
    tags: ['interest-rate', 'personal-loan', 'factors'],
    helpfulCount: 723,
    viewCount: 9870,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-ir-001', 'faq-cs-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-005',
    categoryId: 'cat-personal-loan',
    question: 'Can I get a Personal Loan with low CIBIL score?',
    answer: `Yes, it's possible to get a Personal Loan with a low CIBIL score, though it comes with challenges:

**Options Available:**

1. **NBFC Personal Loans**
   - NBFCs are more flexible than banks
   - Accept scores from 600+
   - Interest rates: 18-30% p.a.
   - Process faster but costlier

2. **Peer-to-Peer (P2P) Lending**
   - Platforms like Faircent, LenDenClub
   - Accept lower credit scores
   - Interest rates vary based on bidding

3. **Secured Personal Loans**
   - Loan against Fixed Deposit
   - Loan against gold/jewelry
   - Lower risk for lender = easier approval

4. **Co-applicant/Guarantor**
   - Apply with someone having good credit
   - Their income and credit score help approval
   - They share repayment responsibility

5. **Salary Account Loans**
   - Some banks offer pre-approved loans
   - Based on salary credits, not just CIBIL
   - Limited amounts but easier approval

**Tips to Improve Approval Chances:**
- Clear existing dues before applying
- Check credit report for errors
- Reduce credit utilization below 30%
- Apply for amount within your repayment capacity
- Provide additional income proof
- Wait 6 months after clearing defaults`,
    order: 5,
    tags: ['low-cibil', 'personal-loan', 'alternatives'],
    helpfulCount: 1102,
    viewCount: 14560,
    isPopular: true,
    relatedFaqIds: ['faq-pl-002', 'faq-cs-003', 'faq-cs-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-13'
  },

  // More Personal Loan FAQs
  {
    id: 'faq-pl-006',
    categoryId: 'cat-personal-loan',
    question: 'What is Personal Loan balance transfer and how does it work?',
    answer: `Personal Loan Balance Transfer allows you to transfer your existing loan to another lender at a lower interest rate:

**How Balance Transfer Works:**
1. Apply for balance transfer with new lender
2. New lender pays off your existing loan
3. You repay new lender at lower rate
4. Save money on interest

**Benefits of Balance Transfer:**
- **Lower Interest Rate:** Save 1-4% on interest
- **Lower EMI:** Reduced monthly payments
- **Top-up Option:** Get additional funds
- **Better Terms:** Flexible tenure options

**Eligibility Criteria:**
- Good repayment history (no defaults/delays)
- Minimum 12 EMIs paid on existing loan
- CIBIL score 700+
- Remaining tenure typically 12+ months

**Documents Required:**
1. Existing loan statement (latest)
2. Last 6 months bank statements
3. NOC from existing lender
4. KYC documents
5. Income proof

**Charges Involved:**
| Charge | Amount |
|--------|--------|
| Processing Fee | 0.5-2% of loan amount |
| Foreclosure (existing) | NIL to 4% |
| Documentation | ₹500-2,000 |

**When to Consider Balance Transfer:**
- Interest rate difference > 1.5%
- Large outstanding amount
- Substantial tenure remaining
- Total savings > transfer costs

**Example Calculation:**
Existing Loan: ₹5,00,000 at 18% for 36 months
Balance Transfer: ₹4,50,000 at 14% for 30 months
**Savings: ~₹45,000 over tenure**`,
    order: 6,
    tags: ['balance-transfer', 'personal-loan', 'lower-interest', 'refinance'],
    helpfulCount: 876,
    viewCount: 11230,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-004', 'faq-ir-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pl-007',
    categoryId: 'cat-personal-loan',
    question: 'What is Personal Loan Top-up and how to apply?',
    answer: `Personal Loan Top-up is an additional loan amount over your existing loan:

**What is Top-up Loan?**
- Additional financing on existing Personal Loan
- Lower interest rate than fresh loan
- Simpler documentation
- Faster approval process

**Eligibility Criteria:**
- Existing loan with same lender
- Good repayment history (12+ EMIs paid)
- No defaults or late payments
- Sufficient income for additional EMI
- CIBIL score maintained/improved

**Top-up Amount:**
- Typically 20-50% of original loan
- Maximum: Based on income eligibility
- Combined EMI must be within FOIR limit

**Advantages of Top-up:**
| Benefit | Details |
|---------|---------|
| Lower Rate | 1-2% lower than new loan |
| Less Documentation | Minimal paperwork |
| Quick Approval | 24-48 hours |
| Single EMI | Combined with existing |

**Process:**
1. Check eligibility with existing lender
2. Apply online or at branch
3. Submit minimal documents
4. Get approval and disbursement
5. New combined EMI starts

**Charges:**
- Processing fee: 0.5-1%
- No prepayment charges (usually)
- Stamp duty (if applicable)

**Top-up vs New Loan:**
| Factor | Top-up | New Loan |
|--------|--------|----------|
| Interest Rate | Lower | Higher |
| Processing | Simpler | Full process |
| Time | Faster | Takes longer |
| Amount | Limited | Higher amounts |`,
    order: 7,
    tags: ['top-up-loan', 'personal-loan', 'additional-loan'],
    helpfulCount: 654,
    viewCount: 8760,
    isPopular: false,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-006', 'faq-emi-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-008',
    categoryId: 'cat-personal-loan',
    question: 'What is the difference between Personal Loan and Credit Card loan?',
    answer: `Understanding the difference helps choose the right financing option:

**Personal Loan:**
| Feature | Details |
|---------|---------|
| **Type** | Fixed term loan |
| **Amount** | ₹50,000 - ₹40 lakhs |
| **Interest Rate** | 10.5-24% p.a. |
| **Tenure** | 12-60 months |
| **EMI** | Fixed monthly payment |
| **Processing** | 24-72 hours |
| **Credit Impact** | Adds installment loan |

**Credit Card Loan/EMI:**
| Feature | Details |
|---------|---------|
| **Type** | Revolving credit |
| **Amount** | Based on credit limit |
| **Interest Rate** | 12-42% p.a. |
| **Tenure** | 3-48 months |
| **EMI** | Converts purchase to EMI |
| **Processing** | Instant |
| **Credit Impact** | Uses credit limit |

**Types of Credit Card Borrowing:**
1. **EMI on Purchase:** Convert large purchases
2. **Balance Transfer:** Transfer debt at lower rate
3. **Cash on Credit Card:** Withdraw cash (expensive)
4. **Personal Loan on Card:** Pre-approved loan offers

**When to Choose Personal Loan:**
- Need large amount (>₹2 lakhs)
- Want fixed EMI structure
- Longer repayment tenure
- Lower interest rates important
- One-time lump sum needed

**When to Choose Credit Card:**
- Smaller amounts (<₹2 lakhs)
- Shopping/purchases with EMI
- Already have card with offer
- Need instant approval
- Short-term requirement

**Cost Comparison (₹1 lakh for 12 months):**
| Product | Rate | Total Interest |
|---------|------|----------------|
| Personal Loan | 14% | ~₹7,700 |
| Credit Card EMI | 16% | ~₹8,900 |
| Credit Card Revolving | 42% | ~₹24,000 |`,
    order: 8,
    tags: ['personal-loan', 'credit-card', 'comparison', 'emi'],
    helpfulCount: 789,
    viewCount: 10450,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-bb-003', 'faq-cs-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-009',
    categoryId: 'cat-personal-loan',
    question: 'How quickly can I get a Personal Loan? What is instant Personal Loan?',
    answer: `Instant Personal Loans offer quick disbursement within hours:

**Types of Fast Personal Loans:**

**1. Pre-approved Loans:**
- Banks offer to existing customers
- Based on salary/account history
- Approval: Instant (seconds)
- Disbursement: Within 10 minutes
- Documentation: NIL/Minimal

**2. Digital/Online Loans:**
- Apply through app/website
- AI-based quick assessment
- Approval: 2-4 hours
- Disbursement: Same day
- Documentation: Digital upload

**3. Salary Account Loans:**
- For salary account holders
- Based on salary credits
- Approval: Same day
- Disbursement: Within 24 hours
- Documentation: Minimal

**Processing Timeline:**
| Loan Type | Approval | Disbursement |
|-----------|----------|--------------|
| Pre-approved | Instant | 10 minutes |
| Digital Loan | 2-4 hours | Same day |
| Salary Account | Same day | 24 hours |
| Regular Application | 1-3 days | 2-5 days |

**Requirements for Instant Approval:**
- Existing relationship with lender
- Good credit score (700+)
- Salary credited to account
- Clean repayment history
- Valid KYC documents
- Aadhaar-linked mobile

**Instant Loan Providers:**
| Lender | Max Amount | Time |
|--------|------------|------|
| HDFC Bank | ₹40L | 10 seconds |
| ICICI Bank | ₹25L | 3 seconds |
| SBI | ₹20L | 45 minutes |
| Bajaj Finserv | ₹35L | 24 hours |
| Tata Capital | ₹25L | 24 hours |

**Tips for Faster Approval:**
1. Keep documents ready digitally
2. Apply during banking hours
3. Ensure mobile linked to Aadhaar
4. Maintain good CIBIL score
5. Choose pre-approved offers first`,
    order: 9,
    tags: ['instant-loan', 'quick-loan', 'personal-loan', 'same-day'],
    helpfulCount: 1123,
    viewCount: 14560,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-002', 'faq-db-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pl-010',
    categoryId: 'cat-personal-loan',
    question: 'What are the best banks and NBFCs for Personal Loan in India?',
    answer: `Here's a comprehensive comparison of top Personal Loan providers in India:

**Top Banks for Personal Loan:**

| Bank | Interest Rate | Max Amount | Max Tenure | Processing Fee |
|------|---------------|------------|------------|----------------|
| **SBI** | 11.15-14.30% | ₹20 lakhs | 6 years | 1.5% (max ₹15K) |
| **HDFC Bank** | 10.50-21.00% | ₹40 lakhs | 5 years | Up to 2.5% |
| **ICICI Bank** | 10.85-16.00% | ₹25 lakhs | 5 years | Up to 2.5% |
| **Axis Bank** | 10.49-22.00% | ₹15 lakhs | 5 years | 1.5-2% |
| **Kotak Bank** | 10.99-36.00% | ₹40 lakhs | 5 years | Up to 2.5% |
| **Punjab National Bank** | 10.40-14.45% | ₹10 lakhs | 5 years | 1% |
| **Bank of Baroda** | 11.40-17.60% | ₹10 lakhs | 5 years | Up to 2% |
| **IDFC First** | 10.49-24.00% | ₹40 lakhs | 5 years | Up to 3% |

**Top NBFCs for Personal Loan:**

| NBFC | Interest Rate | Max Amount | Max Tenure | USP |
|------|---------------|------------|------------|-----|
| **Bajaj Finserv** | 11-35% | ₹35 lakhs | 5 years | Flexi loan |
| **Tata Capital** | 10.99-28% | ₹25 lakhs | 6 years | Quick approval |
| **IIFL Finance** | 11.75-36% | ₹25 lakhs | 5 years | Flexible tenure |
| **Fullerton India** | 11.99-36% | ₹25 lakhs | 5 years | Easy documentation |
| **L&T Finance** | 12-32% | ₹15 lakhs | 5 years | Wide network |
| **Poonawalla Fincorp** | 10.99-28% | ₹25 lakhs | 5 years | Competitive rates |

**Best for Specific Needs:**
| Need | Recommended Lender |
|------|-------------------|
| **Lowest Interest** | SBI, PNB |
| **Highest Amount** | HDFC, Kotak |
| **Fastest Approval** | ICICI, HDFC Pre-approved |
| **Low CIBIL** | NBFCs (Bajaj, Tata) |
| **Flexible Repayment** | Bajaj Finserv Flexi |
| **Self-employed** | Tata Capital, IIFL |

**Government Employee Special:**
- SBI Xpress Credit: 11.15%
- Bank of Baroda: 10.40%
- Central Govt Employee rates: 9.90-10.50%`,
    order: 10,
    tags: ['personal-loan', 'best-banks', 'nbfc', 'comparison', 'interest-rates'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-004', 'faq-pl-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pl-011',
    categoryId: 'cat-personal-loan',
    question: 'What is Flexi Personal Loan and how does it work?',
    answer: `Flexi Personal Loan is a flexible credit facility combining features of loan and overdraft:

**What is Flexi Loan?**
- Pre-sanctioned credit limit
- Withdraw any amount anytime
- Pay interest only on utilized amount
- Repay and re-withdraw as needed
- EMI only on principal utilized

**How Flexi Loan Works:**
\`\`\`
Sanctioned Limit: ₹10 lakhs
       ↓
Withdraw: ₹3 lakhs (Month 1)
Pay interest on: ₹3 lakhs only
       ↓
Repay: ₹1 lakh (Month 3)
Outstanding: ₹2 lakhs
       ↓
Withdraw: ₹2 lakhs more (Month 5)
Total utilized: ₹4 lakhs
       ↓
Pay interest only on ₹4 lakhs
\`\`\`

**Features:**
| Feature | Details |
|---------|---------|
| **Limit** | ₹5 lakhs - ₹40 lakhs |
| **Interest** | On utilized amount only |
| **Tenure** | Up to 5 years |
| **Withdrawals** | Unlimited |
| **Prepayment** | Anytime, no charges |
| **Minimum EMI** | Interest + small principal |

**Interest Calculation:**
- Daily product basis
- Interest charged monthly
- Only on withdrawn amount
- Reduces immediately on repayment

**Example:**
Limit: ₹10,00,000 at 14% p.a.
| Month | Utilized | Interest (Approx) |
|-------|----------|-------------------|
| 1 | ₹5,00,000 | ₹5,833 |
| 2 | ₹3,00,000 | ₹3,500 |
| 3 | ₹7,00,000 | ₹8,167 |

**vs Regular Personal Loan:**
| Factor | Flexi Loan | Regular Loan |
|--------|------------|--------------|
| Interest on | Utilized only | Full amount |
| Withdrawals | Multiple | One-time |
| Repayment | Flexible | Fixed EMI |
| Cost if partial use | Lower | Higher |

**Ideal For:**
- Irregular fund requirements
- Business cash flow needs
- Emergency backup credit
- Project-based expenses
- Uncertain requirement amount

**Providers:**
- Bajaj Finserv Flexi Loan
- HDFC Flexi Personal Loan
- ICICI FlexiCash`,
    order: 11,
    tags: ['flexi-loan', 'personal-loan', 'flexible-credit', 'overdraft'],
    helpfulCount: 567,
    viewCount: 7890,
    isPopular: false,
    relatedFaqIds: ['faq-pl-001', 'faq-bl-003', 'faq-emi-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-012',
    categoryId: 'cat-personal-loan',
    question: 'How to check Personal Loan eligibility and calculate loan amount?',
    answer: `Calculating your Personal Loan eligibility helps you understand how much you can borrow:

**Basic Eligibility Formula:**
\`\`\`
Maximum EMI = Net Monthly Income × FOIR
Maximum Loan = EMI × Loan Factor for tenure/rate

Where:
FOIR (Fixed Obligation to Income Ratio) = 40-60%
Loan Factor = Based on interest rate and tenure
\`\`\`

**Step-by-Step Calculation:**

**Step 1: Calculate Net Monthly Income**
- Salaried: Gross Salary - Deductions
- Self-employed: Annual Income ÷ 12

**Step 2: Determine FOIR**
- Existing EMIs reduce available FOIR
- Available FOIR = Total FOIR - Existing obligations

**Step 3: Calculate Maximum EMI**
- Max EMI = Net Income × Available FOIR%

**Step 4: Calculate Loan Amount**
Using EMI per lakh table:
| Tenure | 12% Rate | 14% Rate | 16% Rate |
|--------|----------|----------|----------|
| 3 Years | ₹3,321 | ₹3,418 | ₹3,517 |
| 4 Years | ₹2,633 | ₹2,733 | ₹2,834 |
| 5 Years | ₹2,224 | ₹2,327 | ₹2,432 |

**Example Calculation:**
\`\`\`
Salary: ₹1,00,000/month
Existing EMI: ₹15,000
FOIR allowed: 50%

Available for new loan:
₹1,00,000 × 50% = ₹50,000
₹50,000 - ₹15,000 = ₹35,000 (Max new EMI)

At 14% for 5 years:
EMI per lakh = ₹2,327
Max Loan = ₹35,000 ÷ ₹2,327 × 1,00,000
Max Loan = ₹15,04,000 (approx ₹15 lakhs)
\`\`\`

**Online Eligibility Calculators:**
Most banks provide eligibility calculators:
1. Enter monthly income
2. Add existing EMIs
3. Choose tenure
4. Get instant eligibility

**Factors That Increase Eligibility:**
- Higher income
- Longer tenure
- Lower existing EMIs
- Good credit score
- Adding co-applicant
- Showing variable income (bonuses)

**Quick Reference (50% FOIR, 14%, 5 years):**
| Monthly Income | Max Loan Amount |
|----------------|-----------------|
| ₹30,000 | ₹6.5 lakhs |
| ₹50,000 | ₹10.7 lakhs |
| ₹75,000 | ₹16.1 lakhs |
| ₹1,00,000 | ₹21.5 lakhs |`,
    order: 12,
    tags: ['eligibility', 'loan-calculator', 'personal-loan', 'foir'],
    helpfulCount: 1234,
    viewCount: 16780,
    isPopular: true,
    relatedFaqIds: ['faq-pl-002', 'faq-emi-001', 'faq-pl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pl-013',
    categoryId: 'cat-personal-loan',
    question: 'What happens if I default on Personal Loan EMI?',
    answer: `Understanding consequences of Personal Loan default helps avoid financial trouble:

**What Constitutes Default?**
- EMI not paid by due date = Delay
- EMI not paid for 90+ days = NPA (Non-Performing Asset)
- Complete non-payment = Default

**Immediate Consequences (1-30 days):**
1. **Late Payment Fee**
   - Typically 2-3% of EMI or flat ₹500-1000
   - Charged on delayed EMI

2. **Penal Interest**
   - Additional 2-4% p.a. on overdue amount
   - Compounds the problem

3. **Reminder Communications**
   - SMS reminders
   - Email notifications
   - Phone calls from bank

**Short-term Impact (30-90 days):**
1. **CIBIL Score Drop**
   - 30 days delay: -50 to -80 points
   - 60 days delay: -80 to -100 points
   - 90 days delay: -100+ points

2. **Recovery Calls**
   - Regular follow-up calls
   - Letters/notices sent

3. **Account Flagged**
   - Marked as SMA (Special Mention Account)
   - SMA-1: 31-60 days overdue
   - SMA-2: 61-90 days overdue

**Long-term Consequences (90+ days - NPA):**

**Legal Actions:**
- Legal notice under SARFAESI (if applicable)
- Civil suit for recovery
- Court orders for repayment

**Financial Impact:**
- Loan becomes NPA
- Additional legal costs added
- Difficulty getting future loans
- Impact lasts 7 years on credit report

**Recovery Process:**
\`\`\`
Soft Recovery → Hard Recovery → Legal Action

Stage 1: Bank's internal team (0-90 days)
Stage 2: Recovery agency (90-180 days)
Stage 3: Legal proceedings (180+ days)
\`\`\`

**What You Can Do:**
1. **Before Default:**
   - Request EMI holiday/moratorium
   - Ask for tenure extension
   - Apply for restructuring

2. **After Delay:**
   - Pay immediately with charges
   - Negotiate settlement if needed
   - Document all communications

3. **If Facing Difficulty:**
   - Contact bank proactively
   - Explain financial situation
   - Explore restructuring options
   - Consider loan settlement (last resort)

**One-Time Settlement (OTS):**
- Bank may accept reduced amount
- Saves bank legal costs
- Marked as "Settled" on CIBIL
- Better than "Written-off" but still negative`,
    order: 13,
    tags: ['default', 'personal-loan', 'npa', 'recovery', 'cibil-impact'],
    helpfulCount: 987,
    viewCount: 12340,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-cs-002', 'faq-emi-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-014',
    categoryId: 'cat-personal-loan',
    question: 'Can NRIs and foreign nationals get Personal Loan in India?',
    answer: `Yes, NRIs and certain foreign nationals can avail Personal Loans in India:

**NRI Personal Loan Eligibility:**

**Basic Requirements:**
- Valid Indian passport
- NRI status (working abroad)
- Minimum 1-2 years abroad
- Stable income abroad
- Indian address proof (of relative)
- NRE/NRO account with lender

**Income Requirements:**
| Region | Minimum Income |
|--------|----------------|
| USA/UK/Europe | $36,000/year |
| Gulf Countries | $24,000/year |
| Other Countries | $18,000/year |

**Documents Required:**
1. **Identity:** Passport, Visa, Work Permit
2. **Address:** Overseas address proof, Indian address
3. **Income:** Employment contract, Salary slips, Bank statements
4. **Other:** NRE/NRO account statement

**Loan Features:**
| Parameter | NRI Personal Loan |
|-----------|-------------------|
| **Amount** | ₹5 lakhs - ₹1 crore |
| **Tenure** | 12-60 months |
| **Interest** | 12-18% p.a. |
| **Processing** | 7-15 days |

**Banks Offering NRI Personal Loans:**
| Bank | Max Amount | Special Features |
|------|------------|------------------|
| SBI | ₹20 lakhs | For SBI NRI customers |
| HDFC | ₹40 lakhs | 24-hour processing |
| ICICI | ₹30 lakhs | NRI accounts linked |
| Axis | ₹15 lakhs | Doorstep service |

**Repayment Options:**
1. **Auto-debit from NRE/NRO account**
2. **Standing instruction from abroad**
3. **Wire transfer for EMI**

**Foreign Nationals (Limited):**
- Usually not eligible for unsecured loans
- Can get Loan against NRO FD
- Some NBFCs offer with guarantor
- Work permit/visa validity important

**Key Considerations:**
- Exchange rate risk on repayment
- Need Indian guarantor sometimes
- Power of Attorney for paperwork
- Video KYC availability
- Tax implications in both countries

**Challenges:**
- Document verification takes longer
- Higher interest rates
- Limited lender options
- Co-applicant often required`,
    order: 14,
    tags: ['nri-loan', 'personal-loan', 'foreign-national', 'overseas'],
    helpfulCount: 456,
    viewCount: 6230,
    isPopular: false,
    relatedFaqIds: ['faq-pl-001', 'faq-bb-002', 'faq-doc-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-pl-015',
    categoryId: 'cat-personal-loan',
    question: 'What are the different types of Personal Loans available?',
    answer: `Personal Loans come in various types catering to different needs:

**1. Medical/Healthcare Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Hospital bills, surgery, treatment |
| **Amount** | ₹50,000 - ₹25 lakhs |
| **Specialty** | Direct payment to hospital |
| **Documentation** | Medical estimate required |
| **Interest** | 10-16% p.a. |

**2. Wedding/Marriage Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Wedding expenses, ceremonies |
| **Amount** | ₹1 lakh - ₹50 lakhs |
| **Specialty** | Covers all wedding costs |
| **Documentation** | Standard + wedding estimate |
| **Interest** | 10.5-18% p.a. |

**3. Travel/Holiday Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Domestic/international travel |
| **Amount** | ₹50,000 - ₹15 lakhs |
| **Specialty** | Some banks tie up with travel agencies |
| **Documentation** | Travel itinerary sometimes |
| **Interest** | 11-18% p.a. |

**4. Home Renovation Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Repairs, renovation, furnishing |
| **Amount** | ₹1 lakh - ₹25 lakhs |
| **Specialty** | No property mortgage needed |
| **Documentation** | Renovation estimate |
| **Interest** | 10.5-16% p.a. |

**5. Debt Consolidation Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Consolidate multiple debts |
| **Amount** | Based on existing debts |
| **Specialty** | Single EMI for all debts |
| **Documentation** | Existing loan statements |
| **Interest** | 11-16% p.a. |

**6. Consumer Durable Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Electronics, appliances |
| **Amount** | ₹5,000 - ₹10 lakhs |
| **Specialty** | Point-of-sale financing |
| **Documentation** | Minimal |
| **Interest** | 0% to 24% p.a. |

**7. Education (Non-Higher Ed) Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Coaching, certification, skills |
| **Amount** | ₹50,000 - ₹5 lakhs |
| **Specialty** | Short courses, coaching |
| **Documentation** | Course admission letter |
| **Interest** | 11-18% p.a. |

**8. Pensioner Personal Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Any personal need |
| **Amount** | ₹50,000 - ₹10 lakhs |
| **Specialty** | For retired individuals |
| **Documentation** | Pension slip |
| **Interest** | 10-14% p.a. |

**Special Category Loans:**
- Women's Personal Loan (lower rates)
- Defence Personnel Loan
- Doctor/CA Professional Loan
- Teacher Personal Loan`,
    order: 15,
    tags: ['personal-loan-types', 'medical-loan', 'wedding-loan', 'travel-loan'],
    helpfulCount: 1567,
    viewCount: 19870,
    isPopular: true,
    relatedFaqIds: ['faq-pl-001', 'faq-pl-002', 'faq-pl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // BUSINESS LOAN FAQs
  // ============================================================================
  {
    id: 'faq-bl-001',
    categoryId: 'cat-business-loan',
    question: 'What types of Business Loans are available in India?',
    answer: `India offers diverse Business Loan products to cater to different business needs:

**1. Term Loans**
- **Purpose:** Fixed asset purchase, expansion, machinery
- **Amount:** ₹1 lakh to ₹50 crores+
- **Tenure:** 1 to 15 years
- **Repayment:** Fixed EMIs

**2. Working Capital Loans**
- **Purpose:** Day-to-day operations, inventory, receivables
- **Types:** Cash Credit, Overdraft, Working Capital Term Loan
- **Amount:** Based on business turnover
- **Tenure:** Renewed annually

**3. MSME Loans**
- **Government Schemes:** MUDRA, CGTMSE, PMEGP
- **Amount:** ₹50,000 to ₹10 crores
- **Benefits:** Collateral-free, subsidized rates
- **Eligibility:** Micro, Small, Medium enterprises

**4. Equipment/Machinery Finance**
- **Purpose:** Purchase of specific equipment
- **Amount:** Up to 90% of equipment cost
- **Security:** Equipment itself serves as collateral
- **Tenure:** 3 to 7 years

**5. Invoice Financing/Bill Discounting**
- **Purpose:** Convert receivables to cash
- **Amount:** Up to 90% of invoice value
- **Tenure:** Based on invoice due date
- **Types:** Factoring, Bill discounting

**6. Merchant Cash Advance**
- **Purpose:** Based on card/POS sales
- **Repayment:** Percentage of daily sales
- **Ideal for:** Retail, restaurants, service businesses

**7. Business Line of Credit**
- **Purpose:** Flexible credit facility
- **Pay interest:** Only on utilized amount
- **Revolving:** Repay and reuse`,
    order: 1,
    tags: ['business-loan', 'types', 'msme', 'working-capital'],
    helpfulCount: 1456,
    viewCount: 18920,
    isPopular: true,
    relatedFaqIds: ['faq-bl-002', 'faq-bl-003', 'faq-bl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bl-002',
    categoryId: 'cat-business-loan',
    question: 'What is MUDRA Loan and how to apply?',
    answer: `MUDRA (Micro Units Development and Refinance Agency) Loan is a government scheme to provide financing to micro and small enterprises.

**Three Categories of MUDRA Loans:**

| Category | Loan Amount | Target Borrowers |
|----------|-------------|------------------|
| **Shishu** | Up to ₹50,000 | New/startup businesses |
| **Kishore** | ₹50,001 to ₹5 lakh | Growing businesses |
| **Tarun** | ₹5,00,001 to ₹10 lakh | Established businesses |

**Key Features:**
- **Collateral-free:** No security required
- **Low interest:** 8.6% to 12% p.a.
- **Flexible tenure:** Up to 5 years
- **Available at:** All public/private banks, RRBs, MFIs

**Eligibility:**
- Any individual, proprietorship, partnership, or company
- Engaged in manufacturing, trading, or services
- Non-farm income generating activities
- Should not be a defaulter

**Documents Required:**
1. Identity & Address proof
2. Business plan/project report
3. Industry-specific licenses
4. Quotations for machinery (if applicable)
5. Category certificate (SC/ST/OBC if applicable)
6. Last 6 months bank statements

**How to Apply:**
1. **Online:** Visit udyamimitra.in or psbloansin59minutes.com
2. **Bank Branch:** Visit nearest bank branch
3. **MUDRA Portal:** www.mudra.org.in

**Processing Time:** 7-14 working days`,
    order: 2,
    tags: ['mudra', 'government-scheme', 'msme', 'collateral-free'],
    helpfulCount: 2134,
    viewCount: 28760,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-005', 'faq-bl-006'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bl-003',
    categoryId: 'cat-business-loan',
    question: 'What is the difference between Cash Credit and Overdraft?',
    answer: `Both Cash Credit (CC) and Overdraft (OD) are working capital facilities, but they differ in several aspects:

**Cash Credit (CC):**

| Aspect | Details |
|--------|---------|
| **Definition** | Credit facility against inventory/receivables |
| **Drawing Power** | Based on stock statements submitted monthly |
| **Security** | Hypothecation of stock, receivables |
| **Primary Users** | Manufacturing, trading businesses |
| **Limit Calculation** | Based on working capital assessment |
| **Interest** | On utilized amount (daily product basis) |
| **Review** | Annual renewal required |

**Overdraft (OD):**

| Aspect | Details |
|--------|---------|
| **Definition** | Withdrawal beyond account balance |
| **Types** | Against FD, Property, Securities |
| **Security** | FD, Property, shares pledged |
| **Primary Users** | All businesses, professionals |
| **Limit Calculation** | % of collateral value |
| **Interest** | On utilized amount (daily product basis) |
| **Review** | Annual or linked to collateral |

**Key Differences:**

1. **Security Type:**
   - CC: Current assets (stock, receivables)
   - OD: Fixed assets (FD, property, securities)

2. **Drawing Power:**
   - CC: Variable based on stock value
   - OD: Fixed based on collateral

3. **Monitoring:**
   - CC: Monthly stock statements required
   - OD: Less stringent monitoring

4. **Flexibility:**
   - CC: Drawing power changes with business
   - OD: Fixed limit provides stability

**When to Use:**
- **CC:** High inventory turnover businesses
- **OD:** Professional services, stable businesses`,
    order: 3,
    tags: ['cash-credit', 'overdraft', 'working-capital', 'comparison'],
    helpfulCount: 892,
    viewCount: 11230,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-007', 'faq-bb-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-bl-004',
    categoryId: 'cat-business-loan',
    question: 'How to get a Business Loan without collateral?',
    answer: `Collateral-free Business Loans are available through multiple channels:

**1. Government-backed Schemes:**

**CGTMSE (Credit Guarantee Fund Trust for MSEs)**
- Coverage: Up to ₹2 crores without collateral
- Guarantee: Government provides guarantee to banks
- Fee: 1-2% of loan amount annually
- Available: All scheduled commercial banks

**MUDRA Loans**
- Up to ₹10 lakhs without collateral
- No guarantee fee for borrower
- Available at all banks and MFIs

**Stand-Up India**
- ₹10 lakhs to ₹1 crore
- For SC/ST/Women entrepreneurs
- Manufacturing/Services/Trading

**2. Unsecured Business Loans from Banks/NBFCs:**

**Requirements:**
- Good CIBIL score (700+)
- Minimum 2-3 years in business
- Strong financials and ITRs
- GST registration
- Current account transactions

**Amount:** Up to ₹50 lakhs
**Interest:** 14-24% p.a.

**3. Digital Lending Platforms:**
- Quick approval based on bank data
- Lower amounts (₹50,000 - ₹10 lakhs)
- Higher interest rates (18-30%)
- Examples: Capital Float, Lendingkart, NeoGrowth

**4. Invoice Financing:**
- No additional collateral needed
- Invoice serves as security
- Get 80-90% of invoice value
- Suitable for B2B businesses

**Tips for Approval:**
- Maintain clean CIBIL score
- File ITR consistently
- Keep bank statements healthy
- Show business stability
- Register under GST
- Prepare good project report`,
    order: 4,
    tags: ['collateral-free', 'unsecured', 'cgtmse', 'business-loan'],
    helpfulCount: 1678,
    viewCount: 21340,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-002', 'faq-bl-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // More Business Loan FAQs
  {
    id: 'faq-bl-005',
    categoryId: 'cat-business-loan',
    question: 'What is CGTMSE scheme and how does it help MSMEs?',
    answer: `CGTMSE (Credit Guarantee Fund Trust for Micro and Small Enterprises) is a government scheme that provides collateral-free loans:

**What is CGTMSE?**
- Established by Government of India and SIDBI
- Provides credit guarantee to lenders
- Enables collateral-free loans to MSEs
- Covers loans up to ₹2 crores

**How CGTMSE Works:**
\`\`\`
MSE applies for loan → Bank sanctions loan
         ↓
Bank gets guarantee from CGTMSE
         ↓
If borrower defaults, CGTMSE pays bank
         ↓
Bank doesn't need collateral from borrower
\`\`\`

**Coverage Details:**
| Loan Amount | Guarantee Coverage |
|-------------|-------------------|
| Up to ₹5 lakhs | 85% |
| ₹5 lakhs - ₹50 lakhs | 75% |
| ₹50 lakhs - ₹2 crores | 50% |
| Women/NE enterprises | Up to 80% |

**Guarantee Fee:**
- Annual Guarantee Fee: 1-2% of loan amount
- One-time fee paid by bank (often passed to borrower)
- Lower rates for certain categories

**Eligibility:**
- Micro and Small Enterprises (per MSMED Act)
- Manufacturing sector: Investment up to ₹10 crores
- Service sector: Investment up to ₹5 crores
- No collateral/third-party guarantee taken
- Account should be standard (not NPA)

**Loan Purposes Covered:**
- Term loans for new projects
- Working capital loans
- Equipment financing
- Business expansion
- Composite loans

**How to Apply:**
1. Apply to any lending institution (bank/NBFC)
2. Bank assesses creditworthiness
3. Bank applies for CGTMSE guarantee
4. Loan sanctioned without collateral
5. Guarantee fee included in loan

**Benefits:**
- No collateral required up to ₹2 crores
- Faster loan processing
- Lower risk for banks = better rates possible
- Encourages bank lending to MSEs`,
    order: 5,
    tags: ['cgtmse', 'collateral-free', 'msme', 'government-scheme', 'guarantee'],
    helpfulCount: 1876,
    viewCount: 24560,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-002', 'faq-bl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bl-006',
    categoryId: 'cat-business-loan',
    question: 'What documents are required for Business Loan?',
    answer: `Business Loan documentation requirements vary based on business type and loan amount:

**Basic KYC Documents (All Applicants):**
| Document | Purpose |
|----------|---------|
| PAN Card | Identity & Tax |
| Aadhaar Card | Identity & Address |
| Passport-size Photos | Application |
| Address Proof | Verification |

**Business Documents:**

**For Proprietorship:**
- Shop Act License / Gumasta
- GST Registration Certificate
- Trade License
- MSME/Udyam Registration

**For Partnership:**
- Partnership Deed
- Partners' KYC documents
- Firm PAN Card
- GST Registration

**For Private Limited/LLP:**
- Certificate of Incorporation
- MOA & AOA
- Board Resolution for borrowing
- Directors' KYC
- Company PAN Card
- GST Registration

**Financial Documents:**
| Document | Period | Purpose |
|----------|--------|---------|
| Bank Statements | 12 months | Cash flow analysis |
| ITR with Computation | 2-3 years | Income verification |
| Audited Financials | 2-3 years | Business health |
| GST Returns | 12 months | Revenue verification |
| Provisional Financials | Current year | Recent performance |

**For Secured Loans (Additional):**
- Property documents
- Valuation report
- Title search report
- NOC from society/builder

**Special Documents by Purpose:**

**Working Capital:**
- Stock statement
- Debtor/Creditor aging
- Projected cash flow

**Equipment/Machinery:**
- Quotation/Proforma invoice
- Equipment specifications

**Project Finance:**
- Detailed Project Report (DPR)
- Cost estimates
- Revenue projections

**Government Scheme Loans:**
- Scheme-specific application
- Category certificate (SC/ST/Women)
- Business plan

**Digital/Quick Loans:**
| Requirement | Details |
|-------------|---------|
| Documents | Minimal (GST + Bank) |
| Verification | Digital/API-based |
| Time | Same day |`,
    order: 6,
    tags: ['business-loan', 'documents', 'kyc', 'gst', 'itr'],
    helpfulCount: 1234,
    viewCount: 15670,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-doc-001', 'faq-bl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-bl-007',
    categoryId: 'cat-business-loan',
    question: 'What is the difference between Term Loan and Working Capital?',
    answer: `Term Loans and Working Capital serve different business financing needs:

**Term Loan:**
| Feature | Details |
|---------|---------|
| **Purpose** | Long-term asset creation |
| **Use** | Machinery, equipment, expansion |
| **Disbursement** | Lump sum |
| **Tenure** | 3-15 years |
| **Repayment** | Fixed EMIs |
| **Interest** | 10-18% p.a. |
| **Security** | Asset financed/other |

**Working Capital:**
| Feature | Details |
|---------|---------|
| **Purpose** | Day-to-day operations |
| **Use** | Inventory, receivables, salaries |
| **Disbursement** | As needed (Credit limit) |
| **Tenure** | 1 year (renewable) |
| **Repayment** | Flexible/Interest only |
| **Interest** | 12-20% p.a. |
| **Security** | Stock/receivables/property |

**Working Capital Types:**

**1. Cash Credit (CC):**
- Drawing limit against stock
- Monthly stock statements required
- Interest on utilized amount
- Suitable for trading/manufacturing

**2. Overdraft (OD):**
- Overdraft facility in current account
- Against FD/Property/Business
- Flexible utilization
- Interest on drawn amount

**3. Working Capital Term Loan:**
- Fixed amount for WC needs
- EMI-based repayment
- One-time disbursement
- No monitoring required

**4. Bank Guarantee/Letter of Credit:**
- Non-fund based working capital
- For procurement/contracts
- Commission-based
- Releases operating funds

**Key Differences:**
| Parameter | Term Loan | Working Capital |
|-----------|-----------|-----------------|
| **Flexibility** | Fixed | High |
| **Cost** | Lower | Higher |
| **Documentation** | One-time | Ongoing |
| **Renewal** | No | Annual |
| **Tax Benefit** | Depreciation | Interest deduction |
| **Cash Flow Impact** | Fixed EMI | Variable |

**When to Use:**
| Need | Recommended |
|------|-------------|
| New machinery | Term Loan |
| Business expansion | Term Loan |
| Inventory financing | Working Capital |
| Managing receivables | Working Capital |
| Seasonal requirement | Working Capital |
| Long-term project | Term Loan |`,
    order: 7,
    tags: ['term-loan', 'working-capital', 'business-loan', 'cash-credit', 'comparison'],
    helpfulCount: 1567,
    viewCount: 18900,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-003', 'faq-bl-006'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bl-008',
    categoryId: 'cat-business-loan',
    question: 'How to get Business Loan for startup or new business?',
    answer: `Getting a Business Loan for startups is challenging but possible through these options:

**Challenges for Startups:**
- No business track record
- No financial statements
- Higher perceived risk
- Limited collateral
- Unproven revenue model

**Best Options for Startups:**

**1. MUDRA Loans (Shishu Category):**
| Feature | Details |
|---------|---------|
| **Amount** | Up to ₹50,000 |
| **Collateral** | Not required |
| **Target** | New/startup businesses |
| **Interest** | 8-12% p.a. |
| **Documentation** | Business plan |

**2. Stand-Up India:**
| Feature | Details |
|---------|---------|
| **Amount** | ₹10 lakhs - ₹1 crore |
| **Eligibility** | SC/ST/Women entrepreneurs |
| **For** | Greenfield enterprises |
| **Collateral** | As per bank |

**3. PMEGP (Prime Minister Employment Generation Programme):**
| Feature | Details |
|---------|---------|
| **Amount** | Up to ₹25 lakhs (manufacturing) |
| **Subsidy** | 15-35% of project cost |
| **For** | New manufacturing/service units |
| **Apply** | Through Khadi Commission |

**4. Startup India Seed Fund:**
| Feature | Details |
|---------|---------|
| **Amount** | Up to ₹50 lakhs |
| **For** | DPIIT registered startups |
| **Type** | Equity/Grant |
| **Apply** | Through incubators |

**5. Secured Loan Against Collateral:**
- Property mortgage
- FD/Securities pledge
- Personal assets

**What Lenders Look For in Startups:**
1. **Business Plan Quality**
   - Market opportunity
   - Revenue model
   - Competitive advantage
   - Realistic projections

2. **Founder Background**
   - Industry experience
   - Educational qualification
   - Personal credit score
   - Previous ventures

3. **Personal Investment**
   - Own contribution (25-50%)
   - Shows commitment
   - Reduces lender risk

4. **Collateral/Guarantee**
   - Personal guarantee
   - Co-applicant with income
   - Property/assets if available

**Tips for New Business Loan:**
- Register business formally (GST, MSME)
- Maintain good personal CIBIL
- Start with smaller amounts
- Build 6-12 months track record
- Keep business account separate
- Document all transactions`,
    order: 8,
    tags: ['startup-loan', 'new-business', 'mudra', 'pmegp', 'stand-up-india'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-002', 'faq-bl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bl-009',
    categoryId: 'cat-business-loan',
    question: 'What are the best banks and NBFCs for Business Loans in India?',
    answer: `Here's a comprehensive comparison of Business Loan providers in India:

**Top Banks for Business Loans:**

| Bank | Interest Rate | Max Amount | Special Features |
|------|---------------|------------|------------------|
| **SBI** | 9.00-14.50% | ₹25 crores | MUDRA, SME loans |
| **HDFC Bank** | 11.00-21.00% | ₹50 lakhs | Digital process |
| **ICICI Bank** | 11.00-20.00% | ₹2 crores | Instant business loan |
| **Axis Bank** | 11.00-21.00% | ₹50 lakhs | Quick disbursement |
| **Bank of Baroda** | 9.15-12.50% | ₹10 crores | PSU benefit |
| **Kotak Bank** | 11.99-26.00% | ₹75 lakhs | Unsecured option |
| **IDFC First** | 11.00-18.00% | ₹1 crore | Digital lending |

**Top NBFCs for Business Loans:**

| NBFC | Interest Rate | Max Amount | USP |
|------|---------------|------------|-----|
| **Bajaj Finserv** | 14-30% | ₹80 lakhs | Flexi loan |
| **Tata Capital** | 12-24% | ₹50 lakhs | Quick approval |
| **IIFL** | 14-36% | ₹30 lakhs | Easy docs |
| **Lendingkart** | 18-27% | ₹2 crores | Digital-first |
| **Capital Float** | 15-25% | ₹50 lakhs | GST-based |
| **NeoGrowth** | 14-26% | ₹1 crore | Sales-based |
| **Poonawalla** | 12-24% | ₹50 lakhs | Competitive |

**Best for Specific Needs:**
| Need | Best Option |
|------|-------------|
| **Lowest Interest** | SBI, Bank of Baroda |
| **Fastest Processing** | HDFC, ICICI, NBFCs |
| **Collateral-free** | MUDRA, CGTMSE-backed |
| **High Amount** | SBI, Bank of Baroda |
| **New Business** | MUDRA, NBFCs |
| **Digital/Online** | Lendingkart, Capital Float |

**Government Schemes Comparison:**
| Scheme | Max Amount | Interest | Subsidy |
|--------|------------|----------|---------|
| **MUDRA** | ₹10 lakhs | 8-12% | None |
| **PMEGP** | ₹25 lakhs | Bank rate | 15-35% |
| **Stand-Up** | ₹1 crore | Bank rate | None |
| **CGTMSE** | ₹2 crores | Bank rate | Guarantee |

**MSME Priority Sector Lending:**
- Banks must lend 7.5% to micro enterprises
- Results in competitive rates
- Faster processing for MSMEs`,
    order: 9,
    tags: ['business-loan', 'best-banks', 'nbfc', 'sbi', 'hdfc', 'msme'],
    helpfulCount: 1987,
    viewCount: 25670,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-002', 'faq-bl-008'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bl-010',
    categoryId: 'cat-business-loan',
    question: 'What is GST-based Business Loan and how does it work?',
    answer: `GST-based Business Loans use your GST returns as the primary basis for loan assessment:

**What is GST-based Loan?**
- Uses GST filing data for evaluation
- Minimal additional documentation
- Quick digital processing
- Based on actual business turnover
- Popular with digital lenders

**How It Works:**
\`\`\`
Borrower shares GST credentials
         ↓
Lender pulls GST data via API
         ↓
Analyzes turnover, compliance
         ↓
Determines loan eligibility
         ↓
Combines with bank statement analysis
         ↓
Instant offer and disbursement
\`\`\`

**Loan Amount Calculation:**
| Monthly GST Turnover | Typical Loan Offer |
|----------------------|-------------------|
| ₹5-10 lakhs | ₹2-5 lakhs |
| ₹10-25 lakhs | ₹5-15 lakhs |
| ₹25-50 lakhs | ₹15-30 lakhs |
| ₹50 lakhs+ | ₹30-50 lakhs+ |

**Eligibility Criteria:**
- GST registration (minimum 12 months)
- Regular GST filing (no major gaps)
- Turnover as per GST returns
- Active current/savings account
- No major tax defaults

**Benefits:**
| Advantage | Details |
|-----------|---------|
| **Speed** | Same-day approval possible |
| **Documentation** | Minimal (GST + Bank) |
| **Assessment** | Based on actual sales |
| **Collateral** | Often not required |
| **Interest** | Competitive for good profiles |

**What Lenders Analyze:**
1. **Sales Consistency**
   - Monthly turnover trends
   - Seasonal patterns
   - Growth trajectory

2. **Compliance Score**
   - Filing regularity
   - No late filings
   - Accurate reporting

3. **Tax Payment**
   - Regular tax payments
   - No defaults

**Providers Offering GST-based Loans:**
| Lender | Max Amount | Interest |
|--------|------------|----------|
| Lendingkart | ₹2 crores | 18-26% |
| Capital Float | ₹50 lakhs | 15-25% |
| NeoGrowth | ₹1 crore | 14-26% |
| FlexiLoans | ₹1 crore | 14-24% |
| PSBLoans59 | ₹1 crore | Bank rates |

**Documents Required:**
1. GST login credentials (view access)
2. Last 12 months bank statements
3. PAN Card
4. Aadhaar Card
5. Business proof`,
    order: 10,
    tags: ['gst-loan', 'business-loan', 'digital-loan', 'msme', 'quick-loan'],
    helpfulCount: 1345,
    viewCount: 17890,
    isPopular: true,
    relatedFaqIds: ['faq-bl-001', 'faq-bl-006', 'faq-db-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // EDUCATION LOAN FAQs
  // ============================================================================
  {
    id: 'faq-el-001',
    categoryId: 'cat-education-loan',
    question: 'What is Education Loan and what expenses does it cover?',
    answer: `Education Loan is a specialized financing option for higher education in India and abroad:

**What Education Loan Covers:**

**Tuition & Academic Fees:**
- College/University tuition fees
- Examination fees
- Library fees
- Laboratory fees
- Course material costs

**Living Expenses (for abroad):**
- Hostel/Accommodation
- Food expenses
- Travel to institution
- Local transportation
- Health insurance

**Other Covered Expenses:**
| Expense | Coverage |
|---------|----------|
| **Caution Deposit** | Refundable deposits |
| **Equipment** | Laptop, books, instruments |
| **Study Tours** | Project-related travel |
| **Thesis/Project** | Research expenses |

**Education Loan Features:**
| Parameter | Details |
|-----------|---------|
| **Amount** | Up to ₹20 lakhs (India) |
| **Amount** | Up to ₹1.5 crores (abroad) |
| **Interest** | 8.5-15% p.a. |
| **Tenure** | Course + 6-12 months + up to 15 years |
| **Moratorium** | Course period + 6-12 months |

**Types of Education Loans:**
1. **Domestic Education Loan**
   - For Indian colleges/universities
   - Lower amounts required
   - Often collateral-free up to ₹7.5 lakhs

2. **Overseas Education Loan**
   - For foreign universities
   - Higher loan amounts
   - Usually requires collateral >₹7.5 lakhs

3. **Skill Development Loan**
   - For vocational/skill courses
   - Shorter duration
   - Lower amounts

**Courses Covered:**
- Undergraduate degrees (B.Tech, MBBS, B.Com)
- Postgraduate courses (MBA, MS, M.Tech)
- Professional courses (CA, CS, Law)
- Diploma programs
- Certificate courses (premier institutes)
- Research programs (PhD, Post-doc)`,
    order: 1,
    tags: ['education-loan', 'student-loan', 'study-abroad', 'tuition-fees'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-el-002', 'faq-el-003', 'faq-el-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-el-002',
    categoryId: 'cat-education-loan',
    question: 'What is the eligibility criteria for Education Loan?',
    answer: `Education Loan eligibility involves student, course, and institution requirements:

**Student Eligibility:**
| Criteria | Requirement |
|----------|-------------|
| **Nationality** | Indian citizen |
| **Age** | 18-35 years |
| **Academic Record** | Secured admission |
| **Past Performance** | Generally 50%+ in qualifying exam |
| **Entrance Test** | Required for professional courses |

**Course Eligibility:**
| Course Type | Eligible |
|-------------|----------|
| **Graduate** | Engineering, Medicine, Arts, Science |
| **Post-Graduate** | MBA, MS, M.Tech, MA |
| **Professional** | CA, CS, CFA, ACCA, Law |
| **Diploma** | From recognized institutions |
| **Research** | PhD, Post-doctoral |
| **Skill Courses** | ITI, vocational training |

**Institution Requirements:**

**For Study in India:**
- Recognized by UGC/AICTE/MCI
- Government institutions preferred
- Autonomous colleges accepted
- Deemed universities eligible

**For Study Abroad:**
- University must be recognized
- Ranked institutions preferred
- Course should be accredited
- Visa-issuing country

**Co-applicant Requirements:**
- Parent/Guardian/Spouse
- Must have regular income source
- Good credit history
- Age: Typically 21-60 years

**Income Requirements (for collateral-free loans):**
| Loan Amount | Typical Income Required |
|-------------|------------------------|
| Up to ₹4 lakhs | ₹25,000/month |
| ₹4-7.5 lakhs | ₹40,000/month |
| Above ₹7.5 lakhs | Collateral required |

**Documents for Admission Proof:**
- Offer letter from institution
- Admission confirmation
- Course details and duration
- Fee structure
- I-20/CAS for abroad (where applicable)`,
    order: 2,
    tags: ['education-loan', 'eligibility', 'student-loan', 'requirements'],
    helpfulCount: 2876,
    viewCount: 38900,
    isPopular: true,
    relatedFaqIds: ['faq-el-001', 'faq-el-003', 'faq-el-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-el-003',
    categoryId: 'cat-education-loan',
    question: 'What is Education Loan moratorium period?',
    answer: `Moratorium period is the grace period during which no loan repayment is required:

**What is Moratorium?**
- Period when principal repayment is not required
- Covers course duration plus additional months
- Interest may or may not be paid during this period
- EMI starts after moratorium ends

**Standard Moratorium Period:**
\`\`\`
Course Duration + 6 to 12 months after completion

Example: 2-year MBA
Course: 24 months
Grace: 6 months
Total Moratorium: 30 months
EMI starts: 31st month onwards
\`\`\`

**Interest During Moratorium:**

**Option 1: Simple Interest Payment**
- Pay only interest during moratorium
- Principal remains unchanged
- Lower total interest cost
- EMI is lower after moratorium

**Option 2: Complete Moratorium**
- No payment during moratorium
- Interest capitalizes (adds to principal)
- Higher total cost
- Higher EMI after moratorium

**Comparison Example (₹10 lakhs at 10% for MBA):**
| Option | Interest Paid During | Total Interest | EMI After |
|--------|---------------------|----------------|-----------|
| Simple Interest | ₹2.5 lakhs | ₹4.5 lakhs | ₹15,000 |
| Full Moratorium | ₹0 | ₹7.5 lakhs | ₹17,500 |

**Moratorium Benefits:**
- Focus on studies without financial stress
- Time to find job before repayment
- Build career before EMI burden
- Industry-standard practice

**Key Considerations:**
1. **Interest Subsidy (Government Scheme)**
   - For economically weaker sections
   - Government pays interest during moratorium
   - Under Central Sector Interest Subsidy Scheme

2. **Partial Payment Option**
   - Some banks allow partial interest payment
   - Reduces total burden
   - Not mandatory

**Post-Moratorium:**
- EMI payment starts
- Tenure typically 5-15 years
- Can prepay without penalty (usually)
- Restructuring available if needed`,
    order: 3,
    tags: ['education-loan', 'moratorium', 'grace-period', 'repayment'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-el-001', 'faq-el-002', 'faq-emi-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-el-004',
    categoryId: 'cat-education-loan',
    question: 'What are the best banks for Education Loan in India?',
    answer: `Here's a comprehensive comparison of top Education Loan providers:

**Public Sector Banks:**

| Bank | Interest Rate | Max Amount | Special Features |
|------|---------------|------------|------------------|
| **SBI** | 8.15-10.65% | ₹1.5 crores | Lowest rates, Scholar Loan |
| **Bank of Baroda** | 8.30-10.60% | ₹80 lakhs | Baroda Scholar |
| **Union Bank** | 8.40-10.70% | ₹30 lakhs | Good for India |
| **Canara Bank** | 8.50-10.80% | ₹40 lakhs | Vidya Turant |
| **PNB** | 8.45-10.75% | ₹25 lakhs | Wide network |

**Private Banks:**

| Bank | Interest Rate | Max Amount | Special Features |
|------|---------------|------------|------------------|
| **HDFC Credila** | 9.50-13.50% | ₹1 crore+ | Quick process |
| **Axis Bank** | 9.50-15.00% | ₹75 lakhs | Priority abroad |
| **ICICI Bank** | 10.00-14.00% | ₹1 crore | Pre-admission sanction |
| **Kotak** | 10.25-16.00% | ₹50 lakhs | Flexible |

**Specialized Education Loan NBFCs:**

| NBFC | Interest Rate | Max Amount | USP |
|------|---------------|------------|-----|
| **HDFC Credila** | 9.50-13.50% | No cap | Education specialist |
| **Avanse** | 10.50-14.50% | No cap | Quick disbursement |
| **InCred** | 11.00-15.00% | ₹1 crore | Digital process |
| **Auxilo** | 10.50-14.50% | No cap | Flexible security |

**Best for Specific Needs:**
| Need | Best Option |
|------|-------------|
| **Lowest Interest** | SBI, Bank of Baroda |
| **Highest Amount** | HDFC Credila, Avanse |
| **Quick Processing** | HDFC Credila, InCred |
| **No Collateral** | SBI (up to ₹7.5 lakhs) |
| **Study Abroad** | HDFC Credila, Axis Bank |
| **Government Scheme** | SBI, Bank of Baroda |

**Interest Subsidy Eligibility (Central Scheme):**
- Family income < ₹4.5 lakhs per annum
- Interest paid by government during moratorium
- Apply through bank
- For recognized courses in India

**Vidyalakshmi Portal:**
- Single window for education loans
- Apply to multiple banks at once
- Compare offers
- Track application status
- Visit: www.vidyalakshmi.co.in`,
    order: 4,
    tags: ['education-loan', 'best-banks', 'sbi', 'hdfc-credila', 'comparison'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-el-001', 'faq-el-002', 'faq-el-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-el-005',
    categoryId: 'cat-education-loan',
    question: 'What is the collateral requirement for Education Loan?',
    answer: `Education Loan collateral requirements depend on the loan amount:

**Collateral-Free Education Loan:**
| Bank/NBFC | Collateral-Free Limit |
|-----------|----------------------|
| **SBI** | Up to ₹7.5 lakhs |
| **Other PSBs** | Up to ₹7.5 lakhs |
| **HDFC Credila** | Up to ₹7.5 lakhs (case-by-case) |
| **Under IBA Guidelines** | Up to ₹7.5 lakhs |

**When Collateral is Required:**
- Loan amount exceeding ₹7.5 lakhs
- High-risk courses/institutions
- Weak co-applicant income
- Poor credit history

**Acceptable Collateral Types:**

**1. Immovable Property:**
| Type | LTV Ratio | Preference |
|------|-----------|------------|
| Residential property | 50-70% | Most preferred |
| Commercial property | 50-60% | Accepted |
| Agricultural land | 50-60% | With clear title |
| Plot/Land | 50% | Less preferred |

**2. Fixed Deposits:**
- 100% of FD value as loan
- Lien marked on FD
- Easy to pledge
- Quick processing

**3. Other Securities:**
- LIC policies (surrender value)
- NSC/KVP certificates
- Government bonds
- Mutual funds/shares (with margin)

**Property Documents Required:**
| Document | Purpose |
|----------|---------|
| Sale deed | Ownership proof |
| Title deed | Legal title |
| Property tax receipt | Current payment |
| Encumbrance certificate | No existing charge |
| Valuation report | Market value |
| NOC from society | If applicable |

**Third-Party Collateral:**
- Property of relative can be used
- Requires third-party guarantee
- Legal mortgage/NOC needed
- Additional documentation

**Alternatives to Collateral:**
1. **Personal Guarantee** (for smaller amounts)
2. **Higher co-applicant income**
3. **Multiple co-applicants**
4. **Government guarantee schemes**

**Release of Collateral:**
- After full loan repayment
- NOC from bank required
- Property documents returned
- Remove charge from registry`,
    order: 5,
    tags: ['education-loan', 'collateral', 'security', 'property', 'mortgage'],
    helpfulCount: 1987,
    viewCount: 26780,
    isPopular: true,
    relatedFaqIds: ['faq-el-001', 'faq-el-002', 'faq-el-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-el-006',
    categoryId: 'cat-education-loan',
    question: 'What are the tax benefits on Education Loan?',
    answer: `Education Loans offer tax deductions under Section 80E of the Income Tax Act:

**Section 80E Deduction:**
| Parameter | Details |
|-----------|---------|
| **Deduction** | Interest portion of EMI |
| **Limit** | No upper limit |
| **Period** | 8 years from start of repayment |
| **Who can claim** | Borrower (student) or parent |

**Key Features:**
- Only interest component is deductible
- Principal not eligible for deduction
- No cap on deduction amount
- Available for 8 consecutive years

**Eligibility for 80E:**
1. **Loan must be from:**
   - Scheduled bank
   - Approved financial institution
   - Approved charitable institution
   - Not from friends/relatives

2. **For higher education of:**
   - Self
   - Spouse
   - Children
   - Student for whom you're legal guardian

3. **Course must be:**
   - Full-time course
   - After passing Senior Secondary (12th)
   - From recognized institution
   - In India or abroad

**How to Claim:**
1. Obtain interest certificate from bank
2. Include in total income deductions
3. File under Section 80E
4. Keep loan statements as proof

**Example Calculation:**
\`\`\`
Loan Amount: ₹15 lakhs
Interest Rate: 10% p.a.
First Year Interest: ₹1,50,000

Tax Savings (30% bracket):
₹1,50,000 × 30% = ₹45,000 saved
\`\`\`

**8-Year Calculation:**
| Year | Interest | Deduction | Tax Saved (30%) |
|------|----------|-----------|-----------------|
| 1 | ₹1,50,000 | ₹1,50,000 | ₹45,000 |
| 2 | ₹1,35,000 | ₹1,35,000 | ₹40,500 |
| 3 | ₹1,20,000 | ₹1,20,000 | ₹36,000 |
| ... | Decreasing | Available | Decreasing |

**Important Points:**
- Start year from when repayment begins
- Moratorium period doesn't count
- Interest paid only (not accrued)
- Keep proper records for 8 years
- Only one person can claim (not both parent and student)`,
    order: 6,
    tags: ['education-loan', 'tax-benefit', 'section-80e', 'interest-deduction'],
    helpfulCount: 2567,
    viewCount: 34560,
    isPopular: true,
    relatedFaqIds: ['faq-el-001', 'faq-tax-001', 'faq-hl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-el-007',
    categoryId: 'cat-education-loan',
    question: 'How to get Education Loan for study abroad?',
    answer: `Education Loan for abroad requires additional documentation and planning:

**Planning Timeline:**
\`\`\`
6-12 months before: Research loans
3-6 months before: Get admission offer
2-3 months before: Apply for loan
1-2 months before: Sanction & disbursement
\`\`\`

**Loan Amount for Abroad:**
| Country | Typical Requirement | Banks Offer |
|---------|--------------------| ------------|
| **USA** | ₹30-80 lakhs | Up to ₹1.5 cr |
| **UK** | ₹20-50 lakhs | Up to ₹1 cr |
| **Canada** | ₹25-60 lakhs | Up to ₹1 cr |
| **Australia** | ₹25-50 lakhs | Up to ₹80 lakhs |
| **Germany** | ₹15-30 lakhs | Up to ₹50 lakhs |
| **Other Europe** | ₹20-40 lakhs | Up to ₹75 lakhs |

**Documents Required:**

**Academic Documents:**
- Mark sheets (10th, 12th, Graduation)
- Degree certificates
- Entrance test scores (GRE/GMAT/TOEFL/IELTS)
- Admission letter/Offer letter
- I-20 (USA) / CAS (UK) / COE (Australia)

**Financial Documents:**
- Co-applicant income proof
- Bank statements (6-12 months)
- ITR (2-3 years)
- Property documents (for collateral)

**Expense Coverage:**
| Component | Typically Covered |
|-----------|------------------|
| Tuition fees | 100% |
| Living expenses | As per university estimate |
| Travel | One-way airfare |
| Equipment | Laptop, books |
| Health insurance | Mandatory insurance |

**Disbursement Process:**
1. **First Disbursement:** Tuition fee (direct to university)
2. **Subsequent:** Per semester/term
3. **Living Expenses:** To student's account

**Key Considerations:**

**1. Interest Rate Type:**
- Fixed (stable but higher)
- Floating (variable but lower initially)

**2. Currency Risk:**
- Loan in INR, fees in foreign currency
- Exchange rate fluctuations
- Some banks offer forex protection

**3. Co-signer/Co-applicant:**
- Required for most loans
- Should have sufficient income
- Good credit history needed

**4. Margin Money:**
| Loan Amount | Margin Required |
|-------------|-----------------|
| Up to ₹4 lakhs | Nil |
| ₹4-7.5 lakhs | 5% |
| Above ₹7.5 lakhs | 15% (India), 15% (Abroad) |

**Best Lenders for Abroad:**
| Lender | USP |
|--------|-----|
| HDFC Credila | Highest amounts, quick process |
| SBI Scholar | Lowest interest rates |
| Avanse | Flexible terms |
| Prodigy Finance | No co-signer needed (select courses) |`,
    order: 7,
    tags: ['education-loan', 'study-abroad', 'usa', 'uk', 'foreign-education'],
    helpfulCount: 4567,
    viewCount: 58900,
    isPopular: true,
    relatedFaqIds: ['faq-el-001', 'faq-el-004', 'faq-el-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // GOLD LOAN FAQs
  // ============================================================================
  {
    id: 'faq-gl-001',
    categoryId: 'cat-gold-loan',
    question: 'What is Gold Loan and how does it work?',
    answer: `Gold Loan is a secured loan where you pledge gold ornaments/jewelry as collateral:

**How Gold Loan Works:**
\`\`\`
Bring gold jewelry → Bank evaluates purity & weight
         ↓
Calculate loan value (% of gold value)
         ↓
Complete documentation
         ↓
Gold stored in bank vault
         ↓
Loan amount disbursed
         ↓
Repay loan → Get gold back
\`\`\`

**Key Features:**
| Feature | Details |
|---------|---------|
| **Type** | Secured loan |
| **Collateral** | Gold jewelry/ornaments |
| **Purity Required** | 18-24 karat |
| **LTV Ratio** | Up to 75% (RBI norm) |
| **Interest Rate** | 7-15% p.a. |
| **Tenure** | 7 days to 36 months |

**Loan Amount Calculation:**
\`\`\`
Gold Weight: 100 grams
Purity: 22 karat
Market Rate: ₹6,000/gram for 24K

Calculation:
22K value = ₹6,000 × (22/24) = ₹5,500/gram
Total Value = 100 × ₹5,500 = ₹5,50,000
Max Loan (75% LTV) = ₹4,12,500
\`\`\`

**What Gold is Accepted:**
| Accepted | Not Accepted |
|----------|--------------|
| Gold jewelry | Gold coins (some limits) |
| Gold ornaments | Gold bars |
| Gold articles | Items with high making charges |
| Hallmarked gold | Foreign gold coins |

**Repayment Options:**
1. **Regular EMI:** Monthly principal + interest
2. **Bullet Repayment:** Full amount at end
3. **Interest-only EMI:** Interest monthly, principal at end
4. **Overdraft Style:** Pay interest, principal when convenient

**Advantages:**
- Quick disbursement (within hours)
- No credit score requirement
- Lower interest than personal loans
- Simple documentation
- Flexible repayment
- No end-use restriction

**Risks:**
- Gold price fluctuation
- Auction risk if unpaid
- Loss if bank closure (rare)`,
    order: 1,
    tags: ['gold-loan', 'secured-loan', 'jewelry-loan', 'pledge'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-gl-002', 'faq-gl-003', 'faq-gl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-gl-002',
    categoryId: 'cat-gold-loan',
    question: 'What is Gold Loan LTV ratio and RBI guidelines?',
    answer: `LTV (Loan-to-Value) ratio is the percentage of gold value you can borrow:

**RBI Guidelines on Gold Loan:**

**LTV Ratio:**
| Lender Type | Maximum LTV |
|-------------|-------------|
| Banks | 75% |
| NBFCs | 75% |
| Co-operatives | 75% |

**Important RBI Regulations:**
1. **Valuation:**
   - Based on 30-day average gold price
   - OR current market price (whichever is lower)
   - Only gold purity value (not making charges)

2. **Tenure:**
   - NBFCs: Max 12 months (with options for renewal)
   - Banks: More flexible

3. **Auction Rules:**
   - Minimum 72 hours notice before auction
   - Must attempt contact at last known address
   - Auction at reasonable market value
   - Return excess amount to borrower

**LTV Calculation Example:**
\`\`\`
Gold Weight: 50 grams (22 karat)
Market Price (24K): ₹6,000/gram

Step 1: Convert to 22K value
22K Price = ₹6,000 × 22/24 = ₹5,500/gram

Step 2: Calculate total value
Total Value = 50 × ₹5,500 = ₹2,75,000

Step 3: Apply LTV
At 75% LTV: ₹2,75,000 × 75% = ₹2,06,250
\`\`\`

**What Affects LTV:**
| Factor | Impact |
|--------|--------|
| Gold purity | Higher purity = Higher LTV |
| Gold weight | No impact on ratio |
| Gold price | Fluctuating value |
| Lender policy | Some offer lower |
| Loan type | Varies by product |

**Protection for Borrowers:**
- Insurance of pledged gold (mandatory for large loans)
- Secure vault storage
- Proper weighing and testing
- Transparent valuation process

**Common Issues:**
- Making charges not included in valuation
- Stone weight deducted
- Hallmarked gold gets better valuation
- Documentation of items pledged`,
    order: 2,
    tags: ['gold-loan', 'ltv', 'rbi-guidelines', 'valuation'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-gl-001', 'faq-gl-003', 'faq-reg-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-gl-003',
    categoryId: 'cat-gold-loan',
    question: 'What are the best Gold Loan providers in India?',
    answer: `Here's a comparison of major Gold Loan providers in India:

**Banks - Gold Loan:**

| Bank | Interest Rate | Max LTV | Features |
|------|---------------|---------|----------|
| **SBI** | 7.50-9.60% | 75% | Lowest rates |
| **HDFC Bank** | 8.00-14.00% | 75% | Quick process |
| **ICICI Bank** | 9.00-17.00% | 75% | Online facility |
| **Canara Bank** | 7.25-9.25% | 75% | PSU rates |
| **Bank of Baroda** | 7.50-10.00% | 75% | Wide network |
| **Federal Bank** | 8.00-12.00% | 75% | Kerala presence |

**NBFCs - Gold Loan Specialists:**

| NBFC | Interest Rate | Network | USP |
|------|---------------|---------|-----|
| **Muthoot Finance** | 9-24% | 4,600+ branches | Largest network |
| **Manappuram** | 9-26% | 3,500+ branches | Quick disbursal |
| **IIFL Gold** | 9-24% | 2,000+ branches | Digital process |
| **Rupeek** | 9-18% | At-home service | Home pickup |

**Comparison by Feature:**
| Feature | Banks | NBFCs |
|---------|-------|-------|
| Interest Rate | Lower | Higher |
| Processing Time | Hours | Minutes |
| Branch Network | Limited | Extensive |
| Working Hours | Banking hours | Extended |
| Documentation | More | Less |
| Renewal | Varies | Easy |

**Best for Specific Needs:**
| Need | Best Option |
|------|-------------|
| Lowest interest | SBI, Canara Bank |
| Fastest disbursal | Muthoot, Manappuram |
| Home pickup | Rupeek |
| Highest amount | Banks |
| Weekend service | NBFCs |
| Rural areas | Muthoot, Manappuram |

**Interest Rate Factors:**
- Loan amount (higher amount = lower rate)
- Repayment scheme chosen
- Customer relationship
- Gold quantity pledged
- Market conditions

**Charges Comparison:**
| Charge | Banks | NBFCs |
|--------|-------|-------|
| Processing | 0-1% | 0.5-1.5% |
| Valuation | Usually free | Usually free |
| Late payment | 2-3% | 2-4% |
| Prepayment | Usually nil | Usually nil |`,
    order: 3,
    tags: ['gold-loan', 'muthoot', 'manappuram', 'sbi', 'best-rates'],
    helpfulCount: 2876,
    viewCount: 38900,
    isPopular: true,
    relatedFaqIds: ['faq-gl-001', 'faq-gl-002', 'faq-gl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-gl-004',
    categoryId: 'cat-gold-loan',
    question: 'What happens if I cannot repay Gold Loan on time?',
    answer: `Understanding Gold Loan default consequences helps you plan better:

**Stages of Non-Payment:**

**Stage 1: Grace Period (0-30 days)**
- Some lenders offer grace period
- Usually with late payment charges
- 1-2% penal interest added
- Gold still safe

**Stage 2: Default Notice (30-90 days)**
- Written notice sent to borrower
- Reminder calls and communication
- Option to pay and regularize
- Additional penal interest accumulates

**Stage 3: Auction Warning (After due date/extended period)**
- Formal notice of intent to auction
- Minimum 72 hours notice (RBI requirement)
- Last chance to redeem gold
- Can pay outstanding and retrieve gold

**Stage 4: Auction Process**
\`\`\`
Notice Period → Valuation → Auction
         ↓
Gold sold at market value
         ↓
Outstanding + charges recovered
         ↓
Balance returned to borrower (if any)
\`\`\`

**What You Can Do:**

**Before Default:**
1. **Request extension/renewal**
   - Pay interest portion
   - Extend loan tenure
   - Available with most lenders

2. **Part payment**
   - Reduce outstanding
   - Release part of gold

3. **Balance transfer**
   - Move to lender with better terms
   - Get time to repay

**After Default:**
1. **Negotiate with lender**
   - One-time settlement
   - Restructuring
   - Time to arrange funds

2. **Pay and redeem**
   - Even after notice, can redeem
   - Pay all outstanding + charges

**Auction Rules (RBI Guidelines):**
| Requirement | Details |
|-------------|---------|
| Notice period | Minimum 72 hours |
| Communication | Written notice mandatory |
| Valuation | At fair market value |
| Excess return | Must return excess to borrower |
| Records | Complete documentation |

**Calculation if Auctioned:**
\`\`\`
Outstanding: ₹3,00,000
Interest due: ₹30,000
Charges: ₹5,000
Total due: ₹3,35,000

Gold auctioned at: ₹4,00,000

Refund to borrower: ₹65,000
\`\`\`

**Impact on Credit:**
- CIBIL score may be affected
- Default reported to bureaus
- Future loan difficulties
- No impact if settled before NPA`,
    order: 4,
    tags: ['gold-loan', 'default', 'auction', 'non-payment', 'recovery'],
    helpfulCount: 1876,
    viewCount: 24560,
    isPopular: true,
    relatedFaqIds: ['faq-gl-001', 'faq-gl-002', 'faq-pl-013'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-gl-005',
    categoryId: 'cat-gold-loan',
    question: 'Is my gold safe when pledged for Gold Loan?',
    answer: `Yes, pledged gold is generally safe with proper precautions. Here's what you need to know:

**Safety Measures by Lenders:**

**1. Storage Security:**
- Bank-grade vaults
- Fire-proof storage
- 24/7 security systems
- CCTV surveillance
- Insurance coverage

**2. Documentation:**
| Document | Purpose |
|----------|---------|
| Pledge receipt | Proof of deposit |
| Gold appraisal | Weight & purity record |
| Photograph | Item identification |
| Detailed description | Each item listed |

**3. Insurance:**
- Most lenders insure pledged gold
- Coverage against theft, fire, natural disasters
- Premium often included in charges
- Ask for insurance certificate

**What to Check:**

**Before Pledging:**
1. Weigh gold in your presence
2. Test purity transparency
3. Get detailed receipt with descriptions
4. Confirm insurance coverage
5. Note any marks/features on jewelry

**Receipt Should Include:**
- Total weight (gross and net)
- Number of items
- Description of each item
- Purity assessment
- Loan amount sanctioned
- Terms and conditions

**Risks and Mitigation:**
| Risk | Mitigation |
|------|------------|
| Loss/theft | Insurance, secure vaults |
| Mix-up | Sealed packets, detailed receipts |
| Damage | Careful handling, documentation |
| Fraud | Choose reputed lenders only |

**Red Flags to Avoid:**
- Unregistered lenders
- No proper documentation
- Refusal to test in your presence
- Unclear terms
- Very high interest rates
- No physical office

**Reputed Lenders (Safe):**
- All nationalized banks
- Major private banks
- RBI-registered NBFCs
- Well-known companies (Muthoot, Manappuram, IIFL)

**When Getting Gold Back:**
1. Verify each item against receipt
2. Check weight matches
3. Inspect for any damage
4. Get closure receipt
5. Report issues immediately

**Legal Protection:**
- RBI regulates gold loan business
- Consumer courts available for disputes
- Banking Ombudsman for banks
- NBFC registration mandatory`,
    order: 5,
    tags: ['gold-loan', 'gold-safety', 'security', 'insurance', 'vault'],
    helpfulCount: 1567,
    viewCount: 21340,
    isPopular: false,
    relatedFaqIds: ['faq-gl-001', 'faq-gl-002', 'faq-gl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // ============================================================================
  // LOAN AGAINST PROPERTY FAQs
  // ============================================================================
  {
    id: 'faq-lap-001',
    categoryId: 'cat-lap',
    question: 'What is Loan Against Property (LAP) and how does it work?',
    answer: `Loan Against Property (LAP) is a secured loan where you mortgage your property to get funds:

**How LAP Works:**
\`\`\`
Apply with property documents
         ↓
Bank verifies title & value
         ↓
Property valuation done
         ↓
Loan sanctioned (50-70% of value)
         ↓
Property mortgaged (Equitable/Registered)
         ↓
Funds disbursed
         ↓
Repay via EMI
         ↓
On full payment, mortgage released
\`\`\`

**Key Features:**
| Feature | Details |
|---------|---------|
| **Type** | Secured loan |
| **Security** | Residential/Commercial property |
| **LTV** | 50-70% of property value |
| **Interest** | 8-15% p.a. |
| **Tenure** | Up to 15-20 years |
| **Amount** | ₹5 lakhs - ₹10 crores |

**Properties Accepted:**
| Type | Accepted | LTV Typically |
|------|----------|---------------|
| Self-occupied residential | Yes | 65-70% |
| Rented residential | Yes | 60-65% |
| Commercial | Yes | 55-65% |
| Industrial | Select lenders | 50-60% |
| Plot (with boundary) | Select lenders | 50% |

**LTV Calculation Example:**
\`\`\`
Property Market Value: ₹1 crore
Bank Valuation: ₹90 lakhs (conservative)
LTV Ratio: 65%

Maximum Loan: ₹90 lakhs × 65% = ₹58.5 lakhs
\`\`\`

**Benefits of LAP:**
- Lower interest than Personal Loan
- Higher loan amounts possible
- Longer tenure = Lower EMI
- Property continues in your possession
- No end-use restriction
- Tax benefits possible (for business)

**vs Personal Loan:**
| Factor | LAP | Personal Loan |
|--------|-----|---------------|
| Interest Rate | 8-15% | 10.5-24% |
| Loan Amount | ₹10 crores+ | ₹40 lakhs |
| Tenure | 20 years | 5 years |
| Security | Property | None |
| Processing | 7-15 days | 24-72 hours |

**Common Uses:**
- Business expansion
- Medical emergencies
- Children's education/wedding
- Debt consolidation
- Home renovation
- Working capital`,
    order: 1,
    tags: ['loan-against-property', 'lap', 'mortgage', 'secured-loan'],
    helpfulCount: 2876,
    viewCount: 38900,
    isPopular: true,
    relatedFaqIds: ['faq-lap-002', 'faq-lap-003', 'faq-lap-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-lap-002',
    categoryId: 'cat-lap',
    question: 'What documents are required for Loan Against Property?',
    answer: `LAP requires extensive documentation for property verification:

**Property Documents:**
| Document | Purpose |
|----------|---------|
| Sale Deed | Ownership proof |
| Mother Deed | Chain of ownership |
| Previous Sale Deeds | Title history |
| Khata Certificate | Property registered |
| Tax Receipts | Taxes cleared |
| Encumbrance Certificate | No existing charge |
| Building Plan | Construction approval |
| Completion Certificate | Construction complete |
| Occupancy Certificate | Habitation permission |

**For Different Property Types:**

**Residential:**
- Society NOC (for apartments)
- Share certificate
- Maintenance receipts
- Parking allotment

**Commercial:**
- Shop deed/Lease deed
- Business license
- Fire safety certificate
- Association NOC

**KYC Documents:**
| Document | For |
|----------|-----|
| PAN Card | Tax identity |
| Aadhaar | Address & identity |
| Photographs | Application |
| Address proof | Current residence |

**Income Documents (Salaried):**
- Last 3-6 months salary slips
- Last 6-12 months bank statements
- Form 16 / ITR (2 years)
- Employment letter

**Income Documents (Self-employed):**
- ITR (3 years) with computation
- P&L and Balance Sheet (2-3 years)
- Bank statements (12 months)
- Business proof (GST, License)
- CA certificate

**Additional Documents:**
| Scenario | Document |
|----------|----------|
| Joint property | All owners' KYC |
| Inherited | Legal heir certificate |
| Under power of attorney | POA document |
| Society property | Society registration |

**Technical Verification:**
- Legal opinion report
- Valuation report
- Technical inspection
- Title search (15-30 years)

**Document Checklist for Fast Processing:**
✓ All property documents in original
✓ Property papers in borrower's name
✓ No litigation pending
✓ Clear title chain
✓ Updated tax payments
✓ Valid approved plan`,
    order: 2,
    tags: ['loan-against-property', 'documents', 'property-papers', 'title'],
    helpfulCount: 1987,
    viewCount: 26780,
    isPopular: true,
    relatedFaqIds: ['faq-lap-001', 'faq-doc-001', 'faq-lap-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },
  {
    id: 'faq-lap-003',
    categoryId: 'cat-lap',
    question: 'What are the best banks for Loan Against Property?',
    answer: `Here's a comparison of LAP providers in India:

**Public Sector Banks:**

| Bank | Interest Rate | Max LTV | Max Tenure | Max Amount |
|------|---------------|---------|------------|------------|
| **SBI** | 9.10-11.10% | 65% | 15 years | ₹7.5 crores |
| **Bank of Baroda** | 9.15-12.70% | 65% | 15 years | ₹5 crores |
| **PNB** | 9.25-11.30% | 60% | 15 years | ₹3 crores |
| **Union Bank** | 9.20-11.50% | 65% | 15 years | ₹5 crores |

**Private Banks:**

| Bank | Interest Rate | Max LTV | Max Tenure | Max Amount |
|------|---------------|---------|------------|------------|
| **HDFC Bank** | 8.65-13.00% | 65% | 20 years | ₹10 crores |
| **ICICI Bank** | 9.00-13.50% | 65% | 20 years | ₹5 crores |
| **Axis Bank** | 9.00-13.70% | 65% | 20 years | ₹5 crores |
| **Kotak** | 9.00-14.00% | 65% | 15 years | ₹3 crores |
| **IDFC First** | 9.50-14.50% | 70% | 20 years | ₹5 crores |

**NBFCs:**

| NBFC | Interest Rate | Max LTV | Features |
|------|---------------|---------|----------|
| **Bajaj Finserv** | 9.00-15.00% | 70% | High LTV |
| **Tata Capital** | 9.50-14.50% | 65% | Quick process |
| **IIFL** | 10.50-18.00% | 70% | Flexible |
| **Poonawalla** | 10.00-16.00% | 65% | Good rates |
| **Fullerton** | 11.00-24.00% | 65% | Easy approval |

**Best for Specific Needs:**
| Need | Best Option |
|------|-------------|
| Lowest interest | SBI, HDFC Bank |
| Highest amount | HDFC Bank |
| Fastest processing | NBFCs |
| Self-employed | HDFC, ICICI |
| Commercial property | Banks |
| Older property | NBFCs |

**Interest Rate Factors:**
| Factor | Impact |
|--------|--------|
| Property type | Residential > Commercial |
| Property location | Metro > Non-metro |
| Income stability | Salaried > Self-employed |
| Credit score | Higher = Lower rate |
| Loan amount | Higher = Negotiable rate |
| Tenure | Shorter = Lower rate |

**Processing Fees:**
| Lender Type | Processing Fee |
|-------------|----------------|
| PSU Banks | 0.5-1% |
| Private Banks | 0.5-1.5% |
| NBFCs | 1-2% |`,
    order: 3,
    tags: ['loan-against-property', 'best-banks', 'nbfc', 'interest-rates'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-lap-001', 'faq-lap-002', 'faq-lap-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-lap-004',
    categoryId: 'cat-lap',
    question: 'What is the difference between LAP and Home Loan?',
    answer: `While both are secured by property, LAP and Home Loan have key differences:

**Primary Difference:**
| Factor | Home Loan | LAP |
|--------|-----------|-----|
| **Purpose** | Buy/construct house | Any purpose |
| **Property** | Being purchased | Already owned |
| **End-use** | Restricted | Unrestricted |

**Detailed Comparison:**

**Interest Rates:**
| Loan | Typical Rate |
|------|--------------|
| Home Loan | 8.30-9.50% |
| LAP | 9.00-14.00% |

**Why LAP costs more:**
- No end-use tracking
- Higher risk for bank
- Mixed property types accepted

**Loan-to-Value (LTV):**
| Loan | Typical LTV |
|------|-------------|
| Home Loan | 75-90% |
| LAP | 50-70% |

**Tenure:**
| Loan | Maximum |
|------|---------|
| Home Loan | 30 years |
| LAP | 15-20 years |

**Tax Benefits:**
| Benefit | Home Loan | LAP |
|---------|-----------|-----|
| Section 80C | Yes (principal) | No |
| Section 24(b) | Yes (interest) | Only if for house purchase |
| Business use | Limited | Full interest deduction |

**When to Choose Home Loan:**
- Buying new property
- Constructing house
- Home renovation (home improvement loan)
- Want tax benefits
- Need higher LTV

**When to Choose LAP:**
- Business expansion
- Working capital
- Children's education/wedding
- Medical emergency
- Debt consolidation
- Any personal need

**Same Property - Both Loans:**
\`\`\`
Property value: ₹1 crore
Existing Home Loan: ₹40 lakhs

Can you take LAP?
Bank will consider remaining equity
Available for LAP: (70% - 40%) = ₹30 lakhs max
Subject to income eligibility
\`\`\`

**Conversion Options:**
- Home Loan to LAP: Possible with some lenders
- LAP to Home Loan: Not possible
- Top-up on Home Loan: Better option if eligible`,
    order: 4,
    tags: ['loan-against-property', 'home-loan', 'comparison', 'lap-vs-hl'],
    helpfulCount: 1876,
    viewCount: 24560,
    isPopular: true,
    relatedFaqIds: ['faq-lap-001', 'faq-hl-001', 'faq-hl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // ============================================================================
  // HOME LOAN FAQs
  // ============================================================================
  {
    id: 'faq-hl-001',
    categoryId: 'cat-home-loan',
    question: 'What is the maximum Home Loan amount I can get?',
    answer: `The maximum Home Loan amount depends on several factors:

**Key Determinants:**

**1. Property Value (LTV Ratio)**
| Property Value | Max LTV (Loan Amount) |
|----------------|----------------------|
| Up to ₹30 lakhs | 90% of property value |
| ₹30 lakhs - ₹75 lakhs | 80% of property value |
| Above ₹75 lakhs | 75% of property value |

**2. Income-based Eligibility**

**EMI/NMI Ratio:** Banks allow EMI up to 50-60% of net monthly income

**Simple Formula:**
- Maximum EMI = 50% of Net Monthly Income
- Using EMI calculator, derive loan amount

**Example Calculation:**
- Net Monthly Income: ₹1,00,000
- Max EMI: ₹50,000
- At 8.5% for 20 years: ~₹52-55 lakhs loan

**3. Combined Factors**
- Lower of property-based or income-based eligibility
- Plus: Co-applicant's income can be added

**Enhancing Loan Amount:**

1. **Add Co-applicant**
   - Spouse's/parent's income adds to eligibility
   - Both incomes considered for EMI calculation

2. **Choose Longer Tenure**
   - 30-year tenure = higher loan amount
   - Lower EMI per lakh = more eligibility

3. **Clear Existing Loans**
   - Reduces FOIR
   - Increases disposable income for EMI

4. **Show Additional Income**
   - Rental income
   - Part-time/freelance income
   - Investment returns

**Maximum Limits by Lenders:**
- Most banks: Up to ₹10-15 crores
- Premium housing loans: Up to ₹30-50 crores`,
    order: 1,
    tags: ['home-loan', 'loan-amount', 'eligibility', 'ltv'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-hl-002', 'faq-hl-003', 'faq-emi-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-hl-002',
    categoryId: 'cat-home-loan',
    question: 'What is PMAY (Pradhan Mantri Awas Yojana) subsidy for Home Loans?',
    answer: `PMAY is a government scheme providing interest subsidy on Home Loans to eligible beneficiaries:

**Eligibility Categories:**

**1. EWS (Economically Weaker Section)**
- Annual Income: Up to ₹3 lakhs
- Carpet Area: Up to 30 sq.m
- Interest Subsidy: 6.5%
- Max Loan for Subsidy: ₹6 lakhs
- **Max Benefit: ₹2.67 lakhs**

**2. LIG (Low Income Group)**
- Annual Income: ₹3-6 lakhs
- Carpet Area: Up to 60 sq.m
- Interest Subsidy: 6.5%
- Max Loan for Subsidy: ₹6 lakhs
- **Max Benefit: ₹2.67 lakhs**

**3. MIG-I (Middle Income Group-I)**
- Annual Income: ₹6-12 lakhs
- Carpet Area: Up to 160 sq.m
- Interest Subsidy: 4%
- Max Loan for Subsidy: ₹9 lakhs
- **Max Benefit: ₹2.35 lakhs**

**4. MIG-II (Middle Income Group-II)**
- Annual Income: ₹12-18 lakhs
- Carpet Area: Up to 200 sq.m
- Interest Subsidy: 3%
- Max Loan for Subsidy: ₹12 lakhs
- **Max Benefit: ₹2.30 lakhs**

**Key Conditions:**
- First-time home buyer (no pucca house in family)
- Property should be in urban area
- Women ownership/co-ownership preferred
- Property to be registered in beneficiary name
- Cannot sell property for 5 years

**How Subsidy is Calculated:**
- Interest subsidy credited upfront to loan account
- Calculated on NPV basis for 20 years
- Reduces principal outstanding
- Results in lower EMI

**Application Process:**
1. Apply through any PLI (Primary Lending Institution)
2. Bank verifies eligibility
3. Claim submitted to NHB/HUDCO
4. Subsidy credited to loan account`,
    order: 2,
    tags: ['pmay', 'subsidy', 'home-loan', 'government-scheme'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-hl-001', 'faq-hl-004', 'faq-tax-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-hl-003',
    categoryId: 'cat-home-loan',
    question: 'What are the tax benefits on Home Loan?',
    answer: `Home Loans offer significant tax benefits under the Income Tax Act:

**Principal Repayment - Section 80C:**
| Aspect | Details |
|--------|---------|
| **Deduction Limit** | Up to ₹1.5 lakhs per year |
| **Eligibility** | Self-occupied & let-out property |
| **Condition** | Property should not be sold within 5 years |
| **Who can claim** | Person who is repaying the loan |

**Interest Payment - Section 24(b):**
| Property Type | Max Deduction |
|---------------|---------------|
| **Self-occupied** | ₹2 lakhs per year |
| **Let-out** | No limit (entire interest) |
| **Under construction** | Interest claimable from completion (in 5 installments) |

**First-time Buyers - Section 80EE:**
| Aspect | Details |
|--------|---------|
| **Additional Deduction** | ₹50,000 per year |
| **Property Value** | Up to ₹50 lakhs |
| **Loan Amount** | Up to ₹35 lakhs |
| **Sanctioned Period** | FY 2016-17 |
| **Condition** | No other property owned |

**Affordable Housing - Section 80EEA:**
| Aspect | Details |
|--------|---------|
| **Additional Deduction** | ₹1.5 lakhs per year |
| **Property Stamp Duty** | Up to ₹45 lakhs |
| **Sanctioned Period** | 1 Apr 2019 - 31 Mar 2022 |
| **Condition** | First-time buyer |

**Joint Home Loan Benefits:**
- Both co-borrowers can claim deductions separately
- Effectively doubles the benefit
- Each must be co-owner of property
- EMI paid from respective accounts

**Example Calculation:**
| Component | Amount | Deduction |
|-----------|--------|-----------|
| Principal (80C) | ₹1.5 lakhs | ₹1.5 lakhs |
| Interest (24b) | ₹4 lakhs | ₹2 lakhs |
| 80EEA | - | ₹1.5 lakhs |
| **Total** | - | **₹5 lakhs** |

**At 30% tax bracket: ₹1.5 lakhs tax saved**`,
    order: 3,
    tags: ['tax-benefit', 'home-loan', 'section-80c', 'section-24'],
    helpfulCount: 4567,
    viewCount: 58900,
    isPopular: true,
    relatedFaqIds: ['faq-hl-001', 'faq-hl-002', 'faq-tax-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // CAR LOAN FAQs
  // ============================================================================
  {
    id: 'faq-cl-001',
    categoryId: 'cat-car-loan',
    question: 'What is the difference between new car loan and used car loan?',
    answer: `New and Used Car Loans differ in several key aspects:

**Comparison Table:**

| Parameter | New Car Loan | Used Car Loan |
|-----------|--------------|---------------|
| **Interest Rate** | 7.5% - 12% p.a. | 12% - 18% p.a. |
| **LTV Ratio** | Up to 100% | 70-85% of valuation |
| **Tenure** | Up to 7 years | Up to 5 years |
| **Processing Fee** | 0.5% - 1% | 1% - 2% |
| **Documentation** | Standard | Additional (RTO records) |
| **Down Payment** | 0-20% | 15-30% |

**New Car Loan Features:**
- Lower interest rates due to lower risk
- Higher loan-to-value ratio
- Longer repayment tenure
- Direct payment to dealer
- Comprehensive insurance mandatory
- RC shows hypothecation

**Used Car Loan Features:**
- Vehicle valuation required
- Age restriction: Usually max 5-7 years old
- Mileage check: Usually below 60,000-80,000 km
- No accident/flood damage history
- Clear RTO records essential
- Ownership transfer required

**Used Car Loan Additional Requirements:**
1. Vehicle valuation report
2. RC copy (front & back)
3. Insurance copy
4. Previous owner NOC
5. Pollution certificate
6. Service history (if available)

**Tips for Used Car Loan:**
- Get vehicle inspected by mechanic
- Check for hypothecation on RC
- Verify RTO records online
- Compare multiple lenders
- Negotiate dealer price first
- Consider CPO (Certified Pre-Owned) vehicles`,
    order: 1,
    tags: ['car-loan', 'new-car', 'used-car', 'comparison'],
    helpfulCount: 1234,
    viewCount: 15670,
    isPopular: true,
    relatedFaqIds: ['faq-cl-002', 'faq-cl-003', 'faq-cl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // ============================================================================
  // CREDIT SCORE FAQs
  // ============================================================================
  {
    id: 'faq-cs-001',
    categoryId: 'cat-credit-score',
    question: 'What is CIBIL Score and how is it calculated?',
    answer: `CIBIL Score is a 3-digit number (300-900) that represents your creditworthiness:

**Score Ranges:**
| Range | Rating | Loan Approval Chances |
|-------|--------|----------------------|
| 800-900 | Excellent | Very High (Best rates) |
| 750-799 | Good | High |
| 700-749 | Fair | Moderate |
| 650-699 | Poor | Low (Higher rates) |
| 300-649 | Very Poor | Very Low/Rejection |

**CIBIL Score Calculation Factors:**

**1. Payment History (35%)**
- On-time payments boost score
- Delays, defaults reduce score
- Recent history matters more
- Even 1 day late gets reported

**2. Credit Utilization (30%)**
- Ratio of used credit to available credit
- Ideal: Below 30%
- Using 80%+ hurts score significantly

**3. Credit Age (15%)**
- Longer credit history is better
- Average age of all accounts
- Don't close old accounts

**4. Credit Mix (10%)**
- Mix of secured (home, car loans) and unsecured (credit cards, personal loans)
- Balanced mix improves score

**5. Credit Inquiries (10%)**
- Hard inquiries reduce score temporarily
- Multiple inquiries in short time hurt more
- Soft inquiries don't affect score

**How to Check CIBIL Score:**
1. **Free:** cibil.com (once per year)
2. **Paid:** cibil.com subscription
3. **Banks:** Many banks offer free CIBIL in net banking
4. **Apps:** Paisabazaar, BankBazaar

**Common Myths:**
- Checking own score doesn't reduce it
- Closing credit card doesn't always help
- Score doesn't update instantly after payment`,
    order: 1,
    tags: ['cibil', 'credit-score', 'calculation', 'factors'],
    helpfulCount: 5678,
    viewCount: 72340,
    isPopular: true,
    relatedFaqIds: ['faq-cs-002', 'faq-cs-003', 'faq-cs-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cs-002',
    categoryId: 'cat-credit-score',
    question: 'How to improve CIBIL Score quickly?',
    answer: `Improving your CIBIL Score takes time but following these strategies can accelerate the process:

**Immediate Actions (1-3 months impact):**

1. **Pay Credit Card Bills in Full**
   - Clear outstanding dues completely
   - Pay before due date (not just minimum)
   - Set up auto-pay to avoid misses

2. **Reduce Credit Utilization**
   - Keep usage below 30% of limit
   - Request credit limit increase
   - Pay before statement date

3. **Dispute Errors in Report**
   - Check report for inaccuracies
   - Raise dispute with CIBIL online
   - Provide supporting documents
   - Resolution in 30 days typically

**Medium-term Strategies (3-6 months):**

4. **Become Authorized User**
   - Get added to family member's old card
   - Their good history reflects on you
   - Ensure they maintain good habits

5. **Take a Secured Credit Card**
   - Deposit-backed card for low scores
   - Regular usage builds positive history
   - Graduate to regular card later

6. **Get a Credit Builder Loan**
   - Small loans to build history
   - Regular EMI payments help score
   - Available from banks and NBFCs

**Long-term Habits (6-12 months):**

7. **Maintain Old Accounts**
   - Don't close old credit cards
   - Age of credit matters
   - Use old cards occasionally

8. **Limit New Credit Applications**
   - Each application = hard inquiry
   - Space applications 6 months apart
   - Only apply when necessary

9. **Mix Credit Types**
   - Have both secured and unsecured
   - Credit card + term loan ideal
   - Shows credit management ability

**Score Improvement Timeline:**
| Action | Typical Impact | Time |
|--------|---------------|------|
| Clear overdue | +50-100 | 1-2 months |
| Reduce utilization | +20-50 | 1-2 months |
| Dispute resolution | Varies | 1-2 months |
| Regular payments | +10-20/month | Ongoing |
| Credit mix | +20-30 | 6+ months |`,
    order: 2,
    tags: ['cibil', 'improve-score', 'tips', 'credit-repair'],
    helpfulCount: 6789,
    viewCount: 89560,
    isPopular: true,
    relatedFaqIds: ['faq-cs-001', 'faq-cs-003', 'faq-pl-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // INTEREST RATE FAQs
  // ============================================================================
  {
    id: 'faq-ir-001',
    categoryId: 'cat-interest-rates',
    question: 'What is the difference between Fixed and Floating Interest Rate?',
    answer: `Understanding Fixed vs Floating rates is crucial for loan selection:

**Fixed Interest Rate:**

| Aspect | Details |
|--------|---------|
| **Definition** | Rate remains constant throughout tenure |
| **EMI** | Same throughout loan tenure |
| **Risk** | No risk of rate increase |
| **Benefit** | Predictable payments, easy budgeting |
| **Drawback** | Doesn't decrease if market rates fall |
| **Typical Premium** | 1-2% higher than floating rates |
| **Ideal For** | Short tenure loans, risk-averse borrowers |

**Floating Interest Rate:**

| Aspect | Details |
|--------|---------|
| **Definition** | Rate varies with market conditions |
| **Linked To** | Repo rate, MCLR, or external benchmark |
| **EMI** | Changes when rate changes |
| **Risk** | Rate may increase |
| **Benefit** | Can decrease if market rates fall |
| **Reset Frequency** | Quarterly, half-yearly, or annually |
| **Ideal For** | Long tenure loans, when rates expected to fall |

**Current Linking Mechanisms:**

**1. External Benchmark Linked Rate (EBLR)**
- Linked to RBI repo rate
- Most transparent
- Rate changes within 3 months of repo change
- Mandatory for retail loans since Oct 2019

**2. MCLR (Marginal Cost of Funds Lending Rate)**
- Bank's internal benchmark
- Based on cost of funds
- Reset periods: 6 months to 1 year
- Being phased out

**3. Base Rate (Old System)**
- Older loans may still be on this
- Less frequent changes
- Can convert to EBLR

**Example Scenario:**
| Rate Type | Initial Rate | After 2 Years | After 5 Years |
|-----------|--------------|---------------|---------------|
| Fixed | 9.5% | 9.5% | 9.5% |
| Floating | 8.5% | 9.0% | 8.0% |

**Decision Framework:**
- **Choose Fixed if:** Economic uncertainty, rates at historical low
- **Choose Floating if:** Rates expected to fall, long tenure loan`,
    order: 1,
    tags: ['interest-rate', 'fixed-rate', 'floating-rate', 'comparison'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-ir-002', 'faq-ir-003', 'faq-hl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ir-002',
    categoryId: 'cat-interest-rates',
    question: 'What is Repo Rate and how does it affect loan EMIs?',
    answer: `The Repo Rate is the RBI's key policy rate that influences all lending rates:

**What is Repo Rate?**
- Rate at which RBI lends to commercial banks
- Short-term lending (usually overnight)
- Primary monetary policy tool
- Set by RBI's Monetary Policy Committee (MPC)
- **Current Repo Rate: 6.50%** (as of Jan 2024)

**How Repo Rate Affects Loans:**

**Transmission Mechanism:**
\`\`\`
RBI changes Repo Rate
       ↓
Banks' cost of funds changes
       ↓
Banks revise EBLR/MCLR
       ↓
Your loan rate changes
       ↓
EMI increases or decreases
\`\`\`

**Impact Timeline:**
| Loan Type | Rate Change Within |
|-----------|-------------------|
| EBLR-linked | Within 3 months |
| MCLR-linked | At reset date (6-12 months) |
| Base Rate | Longer delay |
| Fixed Rate | No impact |

**Example Impact:**
For a ₹50 lakh Home Loan, 20 years tenure:

| Repo Rate Change | Rate Change | EMI Impact |
|------------------|-------------|------------|
| +0.25% | +0.25% | +₹750/month |
| +0.50% | +0.50% | +₹1,500/month |
| -0.25% | -0.25% | -₹740/month |

**Related RBI Rates:**

| Rate | Current | Purpose |
|------|---------|---------|
| **Repo Rate** | 6.50% | Rate at which RBI lends to banks |
| **Reverse Repo** | 3.35% | Rate banks get for deposits with RBI |
| **Bank Rate** | 6.75% | Rate for long-term lending by RBI |
| **CRR** | 4.50% | Cash banks must keep with RBI |
| **SLR** | 18% | Liquid assets banks must maintain |

**What Borrowers Should Do:**
- Track RBI policy announcements (bi-monthly)
- Check if your bank has revised rates
- Contact bank if rate not revised post repo cut
- Consider balance transfer if bank delays transmission`,
    order: 2,
    tags: ['repo-rate', 'rbi', 'interest-rate', 'emi'],
    helpfulCount: 2567,
    viewCount: 34560,
    isPopular: true,
    relatedFaqIds: ['faq-ir-001', 'faq-ir-003', 'faq-emi-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // EMI CALCULATION FAQs
  // ============================================================================
  {
    id: 'faq-emi-001',
    categoryId: 'cat-emi-calculation',
    question: 'How is EMI calculated and what is the EMI formula?',
    answer: `EMI (Equated Monthly Installment) is calculated using a mathematical formula:

**EMI Formula:**
\`\`\`
EMI = P × r × (1 + r)^n / [(1 + r)^n - 1]

Where:
P = Principal loan amount
r = Monthly interest rate (Annual rate / 12 / 100)
n = Loan tenure in months
\`\`\`

**Example Calculation:**
- Loan Amount: ₹10,00,000
- Interest Rate: 10% p.a.
- Tenure: 5 years (60 months)

**Step-by-step:**
1. P = 10,00,000
2. r = 10/(12×100) = 0.00833
3. n = 60 months
4. EMI = 10,00,000 × 0.00833 × (1.00833)^60 / [(1.00833)^60 - 1]
5. **EMI = ₹21,247**

**EMI per Lakh at Different Rates:**

| Rate | 5 Years | 10 Years | 15 Years | 20 Years |
|------|---------|----------|----------|----------|
| 8% | ₹2,028 | ₹1,213 | ₹956 | ₹836 |
| 9% | ₹2,076 | ₹1,267 | ₹1,014 | ₹900 |
| 10% | ₹2,125 | ₹1,322 | ₹1,075 | ₹965 |
| 11% | ₹2,174 | ₹1,377 | ₹1,136 | ₹1,032 |
| 12% | ₹2,224 | ₹1,435 | ₹1,200 | ₹1,101 |

**EMI Components:**
- **Principal:** Reduces loan outstanding
- **Interest:** Bank's earning on loan

**Amortization Pattern:**
- Initial EMIs: More interest, less principal
- Later EMIs: More principal, less interest
- Total interest paid is frontloaded

**Factors Affecting EMI:**
1. **Loan Amount** - Higher amount = Higher EMI
2. **Interest Rate** - Higher rate = Higher EMI
3. **Tenure** - Longer tenure = Lower EMI (but more total interest)

**Quick Thumb Rules:**
- 10% rate, 20 years: EMI ≈ ₹965 per lakh
- Every 0.5% rate increase: EMI up by ~₹30-35 per lakh
- Doubling tenure: EMI reduces by ~45%`,
    order: 1,
    tags: ['emi', 'calculation', 'formula', 'amortization'],
    helpfulCount: 4567,
    viewCount: 58900,
    isPopular: true,
    relatedFaqIds: ['faq-emi-002', 'faq-emi-003', 'faq-hl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-emi-002',
    categoryId: 'cat-emi-calculation',
    question: 'What is loan prepayment and foreclosure? Are there charges?',
    answer: `Prepayment and Foreclosure are options to repay loan faster:

**Definitions:**

**Prepayment (Part Payment):**
- Paying extra amount over regular EMI
- Reduces principal outstanding
- Loan continues with revised EMI or tenure

**Foreclosure (Full Prepayment):**
- Paying entire outstanding at once
- Closes the loan completely
- NOC issued after closure

**RBI Guidelines on Prepayment Charges:**

| Loan Type | Interest Type | Prepayment Charges |
|-----------|--------------|-------------------|
| **Home Loan** | Floating | **NIL** (Mandatory) |
| **Home Loan** | Fixed | Up to 2% |
| **Personal Loan** | Floating | NIL to 4% |
| **Personal Loan** | Fixed | 2-5% |
| **Car Loan** | Any | 2-5% |
| **Business Loan** | Any | 2-4% |

**Benefits of Prepayment:**

**1. Interest Savings:**
For ₹50L loan at 8.5%, 20 years:
| Prepayment | Interest Saved | Tenure Reduced |
|------------|---------------|----------------|
| ₹2L in Year 3 | ₹4.8 lakhs | 2 years |
| ₹5L in Year 5 | ₹8.2 lakhs | 4 years |

**2. Options After Prepayment:**
- Reduce EMI, keep tenure same
- Reduce tenure, keep EMI same
- Combination of both

**Best Practices:**

**When to Prepay:**
- When you have surplus funds
- Early in loan tenure (more impact)
- When interest rates are high
- Before year-end for tax benefits

**When NOT to Prepay:**
- If investment returns > loan interest
- If prepayment charges are high
- If you need emergency fund
- If loan has tax benefits

**Foreclosure Process:**
1. Request foreclosure statement
2. Includes: Outstanding + accrued interest + charges
3. Pay the amount
4. Collect NOC and original documents
5. Update CIBIL to show loan closed`,
    order: 2,
    tags: ['prepayment', 'foreclosure', 'charges', 'loan-closure'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-emi-001', 'faq-emi-003', 'faq-hl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // ============================================================================
  // BANKING BASICS FAQs
  // ============================================================================
  {
    id: 'faq-bb-001',
    categoryId: 'cat-banking-basics',
    question: 'What is the difference between NEFT, RTGS, and IMPS?',
    answer: `NEFT, RTGS, and IMPS are electronic fund transfer systems with different characteristics:

**Quick Comparison:**

| Feature | NEFT | RTGS | IMPS |
|---------|------|------|------|
| **Full Form** | National Electronic Funds Transfer | Real Time Gross Settlement | Immediate Payment Service |
| **Settlement** | Batch (Half-hourly) | Real-time | Instant |
| **Availability** | 24×7 | 24×7 | 24×7×365 |
| **Minimum Amount** | ₹1 | ₹2,00,000 | ₹1 |
| **Maximum Amount** | ₹10 lakhs | No limit | ₹5 lakhs |
| **Speed** | 30 min - 2 hours | Immediate | Instant (seconds) |
| **Charges** | ₹2-25 | ₹25-50 | ₹5-15 |

**NEFT (National Electronic Funds Transfer):**
- Operated by RBI
- Settled in batches every 30 minutes
- Suitable for non-urgent transfers
- Available on bank holidays too (since Dec 2019)
- Best for: Regular bill payments, non-urgent transfers

**RTGS (Real Time Gross Settlement):**
- Operated by RBI
- Settlement happens individually in real-time
- For high-value transactions (₹2 lakhs+)
- Instant but during banking hours
- Best for: Property payments, large business transactions

**IMPS (Immediate Payment Service):**
- Operated by NPCI
- Mobile number/MMID-based transfer possible
- Works even when banks are closed
- Truly instant (within seconds)
- Best for: Urgent small transfers, P2P payments

**UPI vs IMPS:**
| Feature | UPI | IMPS |
|---------|-----|------|
| **Limit** | ₹1-5 lakhs | ₹5 lakhs |
| **Interface** | App-based | Bank channel |
| **VPA** | Yes (abc@bank) | No |
| **QR Code** | Supported | No |
| **Charges** | Usually free | ₹5-15 |

**Which to Use When:**
- **Small urgent transfer:** UPI or IMPS
- **Regular payments:** NEFT
- **Large amounts:** RTGS
- **Bill payments:** NEFT or UPI
- **Merchant payments:** UPI`,
    order: 1,
    tags: ['neft', 'rtgs', 'imps', 'fund-transfer', 'banking'],
    helpfulCount: 5678,
    viewCount: 72340,
    isPopular: true,
    relatedFaqIds: ['faq-bb-002', 'faq-bb-003', 'faq-db-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bb-002',
    categoryId: 'cat-banking-basics',
    question: 'What are the different types of bank accounts in India?',
    answer: `Banks offer various account types for different needs:

**1. Savings Account:**
| Feature | Details |
|---------|---------|
| **Purpose** | Personal savings |
| **Interest** | 2.7% - 7% p.a. |
| **Withdrawals** | Limited (typically free) |
| **Min Balance** | ₹500 - ₹10,000 |
| **Best For** | Individuals, salary accounts |

**Types of Savings Accounts:**
- Regular Savings Account
- Zero Balance Savings Account
- Basic Savings Bank Deposit (BSBD)
- Women's Savings Account
- Senior Citizen Savings Account
- Kids/Minor Account

**2. Current Account:**
| Feature | Details |
|---------|---------|
| **Purpose** | Business transactions |
| **Interest** | Nil |
| **Withdrawals** | Unlimited |
| **Min Balance** | ₹10,000 - ₹1 lakh |
| **Features** | Overdraft, high transaction limits |
| **Best For** | Businesses, traders |

**3. Fixed Deposit (FD):**
| Feature | Details |
|---------|---------|
| **Purpose** | Higher returns on lump sum |
| **Interest** | 5% - 7.5% p.a. |
| **Tenure** | 7 days to 10 years |
| **Premature Withdrawal** | With penalty (0.5-1%) |
| **Tax** | TDS applicable if interest > ₹40,000 |

**4. Recurring Deposit (RD):**
| Feature | Details |
|---------|---------|
| **Purpose** | Monthly savings habit |
| **Interest** | Similar to FD rates |
| **Tenure** | 6 months to 10 years |
| **Monthly Deposit** | Fixed amount |
| **Best For** | Systematic savings |

**5. NRI Accounts:**
| Account | Currency | Repatriation | Interest |
|---------|----------|--------------|----------|
| **NRE** | INR | Fully repatriable | Tax-free |
| **NRO** | INR | Limited repatriable | Taxable |
| **FCNR** | Foreign | Fully repatriable | Tax-free |

**6. Special Accounts:**
- **PPF:** 15-year lock-in, tax-free, 7.1% interest
- **SSY:** Girl child scheme, high interest
- **SCSS:** Senior citizen scheme
- **PM Jan Dhan:** Financial inclusion scheme`,
    order: 2,
    tags: ['savings-account', 'current-account', 'fd', 'rd', 'account-types'],
    helpfulCount: 4567,
    viewCount: 58900,
    isPopular: true,
    relatedFaqIds: ['faq-bb-001', 'faq-bb-003', 'faq-bb-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // DOCUMENTATION FAQs
  // ============================================================================
  {
    id: 'faq-doc-001',
    categoryId: 'cat-documentation',
    question: 'What is KYC and why is it mandatory for loans?',
    answer: `KYC (Know Your Customer) is a verification process mandated by RBI for all financial transactions:

**What is KYC?**
- Identity verification process
- Mandatory for all financial services
- Prevents fraud, money laundering, terrorist financing
- Regulated by RBI and PMLA Act

**KYC Documents:**

**Identity Proof (Any One):**
| Document | Additional Info |
|----------|-----------------|
| **Aadhaar Card** | Most widely accepted |
| **PAN Card** | Mandatory for loans |
| **Passport** | Valid passport |
| **Voter ID** | With photograph |
| **Driving License** | Valid license |

**Address Proof (Any One):**
| Document | Validity Period |
|----------|-----------------|
| **Aadhaar** | Current address |
| **Utility Bill** | Not older than 3 months |
| **Bank Statement** | With current address |
| **Rent Agreement** | Registered preferred |
| **Passport** | With current address |

**Types of KYC:**

**1. In-Person Verification (IPV)**
- Physical visit to branch
- Original documents verified
- Photograph taken

**2. Video KYC (V-KYC)**
- Video call verification
- Aadhaar-based authentication
- RBI approved since 2020
- No physical visit required

**3. e-KYC**
- Aadhaar-based digital verification
- OTP or biometric authentication
- Instant verification
- Paperless process

**4. CKYC (Central KYC)**
- One-time KYC registration
- 14-digit KYC Identifier (KIN)
- Shared across financial institutions
- Reduces repeated verification

**KYC Re-verification:**
- Required periodically (2-10 years)
- After change in address/name
- As per bank's risk assessment
- Non-compliance leads to account freeze

**Why KYC Matters for Loans:**
- Verifies applicant identity
- Confirms address for communication
- Enables legal enforcement
- Prevents fraud and impersonation
- Mandatory RBI compliance`,
    order: 1,
    tags: ['kyc', 'documents', 'verification', 'identity-proof'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-doc-002', 'faq-doc-003', 'faq-pl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // DIGITAL BANKING FAQs
  // ============================================================================
  {
    id: 'faq-db-001',
    categoryId: 'cat-digital-banking',
    question: 'What is UPI and how does it work?',
    answer: `UPI (Unified Payments Interface) is India's revolutionary instant payment system:

**What is UPI?**
- Real-time payment system by NPCI
- Enables instant money transfer
- Works 24×7×365
- Uses Virtual Payment Address (VPA)
- Single app for multiple bank accounts

**How UPI Works:**
\`\`\`
Sender initiates payment
       ↓
Enter VPA/Mobile/QR
       ↓
Enter amount & UPI PIN
       ↓
NPCI processes request
       ↓
Instant debit from sender's bank
       ↓
Instant credit to receiver's bank
       ↓
Confirmation to both parties
\`\`\`

**UPI Features:**

| Feature | Details |
|---------|---------|
| **Transaction Limit** | ₹1 lakh per transaction |
| **Daily Limit** | ₹1 lakh (can vary) |
| **Charges** | Usually free for P2P |
| **Speed** | Instant (seconds) |
| **VPA Format** | username@bankcode |

**UPI Payment Methods:**

1. **VPA (Virtual Payment Address)**
   - Example: yourname@ybl, number@paytm
   - No need to share bank details

2. **Mobile Number**
   - Linked to bank account
   - Verify via name display

3. **QR Code**
   - Scan and pay
   - Most convenient for merchants

4. **Account + IFSC**
   - Traditional bank transfer via UPI
   - Useful when VPA unknown

**Popular UPI Apps:**
| App | Bank Partner | Features |
|-----|--------------|----------|
| **Google Pay** | Multiple | Rewards, offers |
| **PhonePe** | Yes Bank | Insurance, mutual funds |
| **Paytm** | Paytm Payments Bank | Wallet + UPI |
| **BHIM** | NPCI | Basic, official app |
| **Amazon Pay** | Multiple | Shopping integration |

**UPI for Loans:**
- EMI payments via UPI mandate (e-NACH)
- Instant disbursement to UPI-linked account
- Prepayment via UPI transfer
- Document fee payment`,
    order: 1,
    tags: ['upi', 'digital-payment', 'npci', 'vpa'],
    helpfulCount: 6789,
    viewCount: 89560,
    isPopular: true,
    relatedFaqIds: ['faq-db-002', 'faq-bb-001', 'faq-db-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // REGULATORY FAQs
  // ============================================================================
  {
    id: 'faq-reg-001',
    categoryId: 'cat-regulatory',
    question: 'What are the RBI guidelines for fair lending practices?',
    answer: `RBI has issued comprehensive Fair Practices Code for lenders:

**Key RBI Guidelines:**

**1. Loan Application & Processing:**
- Acknowledge all loan applications
- Convey decision within reasonable time
- Provide reasons for rejection in writing
- Share CIBIL score that led to rejection
- No arbitrary rejection

**2. Interest Rate Transparency:**
- Disclose all-inclusive interest rate
- Explain fixed vs floating clearly
- Inform about rate reset frequency
- No hidden charges

**3. Loan Agreement:**
- Provide copy of loan agreement
- All terms in vernacular language (if requested)
- Sufficient time to read and understand
- Right to seek clarification

**4. Disbursement:**
- Disburse only after all documents signed
- Credit directly to borrower's account
- Transparent processing fee deduction

**5. Prepayment & Foreclosure:**
- No prepayment penalty on floating rate loans
- Foreclosure charges to be reasonable
- Process foreclosure requests promptly

**6. Recovery Practices:**
- No harassment or use of force
- Recovery agents to be trained
- Calls only between 7 AM - 7 PM
- No threat or intimidation
- Comply with court orders

**7. Grievance Redressal:**
- Designated nodal officer
- Acknowledge complaints within 3 days
- Resolve within 30 days
- Escalation to Banking Ombudsman

**8. Specific Loan Guidelines:**

| Loan Type | Key Guideline |
|-----------|---------------|
| **Home Loan** | No prepayment penalty (floating) |
| **Personal Loan** | All-inclusive rate disclosure |
| **MSME Loan** | 25-day limit for disposal |
| **Education Loan** | Moratorium for course + 6 months |

**Consumer Rights:**
- Right to information
- Right to transparent terms
- Right to fair treatment
- Right to grievance redressal
- Right to privacy

**Complaint Channels:**
1. Bank's Grievance Cell
2. Banking Ombudsman
3. RBI's CMS Portal
4. Consumer Court`,
    order: 1,
    tags: ['rbi', 'fair-practices', 'consumer-rights', 'regulations'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-reg-002', 'faq-reg-003', 'faq-emi-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // MORE HOME LOAN FAQs
  // ============================================================================
  {
    id: 'faq-hl-004',
    categoryId: 'cat-home-loan',
    question: 'What is Home Loan Balance Transfer and when should I consider it?',
    answer: `Home Loan Balance Transfer means moving your existing home loan to another bank at a lower interest rate:

**How Balance Transfer Works:**
\`\`\`
Find lender with lower rate
         ↓
Apply for balance transfer
         ↓
New lender pays off existing loan
         ↓
Property mortgage transferred
         ↓
You continue paying new lender
\`\`\`

**When to Consider Balance Transfer:**
| Factor | Consider If |
|--------|-------------|
| **Rate Difference** | Current rate is 0.5%+ higher |
| **Outstanding Amount** | More than ₹25 lakhs pending |
| **Remaining Tenure** | More than 10 years remaining |
| **Total Savings** | Savings exceed transfer costs |

**Savings Calculation Example:**
\`\`\`
Outstanding: ₹50 lakhs
Current Rate: 9.5%
New Rate: 8.5%
Remaining Tenure: 15 years

Current EMI: ₹52,200
New EMI: ₹49,240
Monthly Savings: ₹2,960
Total Savings over tenure: ~₹5.3 lakhs
\`\`\`

**Costs Involved:**
| Cost | Typical Amount |
|------|----------------|
| Processing Fee | 0.25-1% of loan |
| Legal Charges | ₹5,000-15,000 |
| Technical Valuation | ₹3,000-10,000 |
| Stamp Duty (in some states) | Varies |
| Foreclosure (old bank) | NIL (floating) |

**Eligibility:**
- Good repayment history (no defaults)
- Minimum 12-24 EMIs paid
- Property value covers new loan
- Income eligibility at new lender
- Clean title and documentation

**Documents Required:**
1. Existing loan statement
2. Property documents (from old bank)
3. List of payments (sanction to date)
4. Income documents (fresh)
5. KYC documents

**Best Banks for Balance Transfer:**
| Bank | Current Rate | Processing Fee |
|------|--------------|----------------|
| SBI | 8.40%+ | 0.35% |
| HDFC | 8.50%+ | 0.5% |
| ICICI | 8.60%+ | 0.5% |
| Axis | 8.55%+ | Up to 1% |

**Top-up with Balance Transfer:**
- Get additional amount along with transfer
- Combined in single loan
- Use for renovation, other needs`,
    order: 4,
    tags: ['home-loan', 'balance-transfer', 'refinance', 'lower-rate'],
    helpfulCount: 2567,
    viewCount: 34560,
    isPopular: true,
    relatedFaqIds: ['faq-hl-001', 'faq-hl-003', 'faq-ir-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-hl-005',
    categoryId: 'cat-home-loan',
    question: 'What are the best banks for Home Loan in India?',
    answer: `Here's a comprehensive comparison of Home Loan providers in India:

**Public Sector Banks:**

| Bank | Interest Rate | Max Amount | Max Tenure | Processing |
|------|---------------|------------|------------|------------|
| **SBI** | 8.40-9.65% | ₹15 crores | 30 years | 0.35% |
| **Bank of Baroda** | 8.40-10.60% | ₹10 crores | 30 years | 0.25-0.50% |
| **PNB** | 8.45-10.25% | ₹5 crores | 30 years | 0.35% |
| **Canara Bank** | 8.45-10.65% | ₹5 crores | 30 years | 0.50% |
| **Union Bank** | 8.40-10.35% | ₹7.5 crores | 30 years | 0.50% |

**Private Banks:**

| Bank | Interest Rate | Max Amount | Max Tenure | Processing |
|------|---------------|------------|------------|------------|
| **HDFC Bank** | 8.50-9.40% | No limit | 30 years | 0.50% |
| **ICICI Bank** | 8.60-9.45% | ₹5 crores | 30 years | 0.50% |
| **Axis Bank** | 8.55-9.40% | ₹5 crores | 30 years | Up to 1% |
| **Kotak** | 8.65-9.50% | ₹10 crores | 20 years | 0.5% |
| **IDFC First** | 8.75-12.00% | ₹5 crores | 30 years | 3% |

**Housing Finance Companies:**

| HFC | Interest Rate | Max Amount | USP |
|-----|---------------|------------|-----|
| **LIC HFL** | 8.50-10.50% | ₹10 crores | Government backing |
| **HDFC Ltd** | 8.45-9.20% | No limit | Market leader |
| **PNB HFL** | 8.50-11.00% | ₹5 crores | Good network |
| **Tata Capital** | 8.60-12.00% | ₹3 crores | Quick process |

**Best for Specific Needs:**
| Need | Best Option |
|------|-------------|
| Lowest interest | SBI, Bank of Baroda |
| Highest amount | HDFC Ltd, HDFC Bank |
| Self-employed | HDFC Ltd, Tata Capital |
| Fast processing | ICICI, HDFC Bank |
| NRI Home Loan | SBI, ICICI Bank |
| Affordable housing | SBI, PNB (PMAY) |

**Special Schemes:**
- **Women Borrowers:** 0.05% lower rate at most banks
- **Government Employees:** Special rates at PSU banks
- **PMAY beneficiaries:** Interest subsidy benefits`,
    order: 5,
    tags: ['home-loan', 'best-banks', 'interest-rates', 'comparison'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-hl-001', 'faq-hl-002', 'faq-hl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-hl-006',
    categoryId: 'cat-home-loan',
    question: 'Can NRIs get Home Loan in India?',
    answer: `Yes, NRIs can get Home Loans to purchase property in India:

**NRI Home Loan Eligibility:**

**Basic Requirements:**
- Indian citizen with NRI status
- Valid passport and visa
- Minimum 1-2 years abroad
- Age: 21-60 years (at maturity: 70)
- Property in India only

**Income Requirements:**
| Location | Minimum Income |
|----------|----------------|
| USA/Europe | $36,000-50,000/year |
| Gulf/Middle East | $30,000-40,000/year |
| Other countries | $24,000-36,000/year |

**Loan Features for NRIs:**
| Parameter | Details |
|-----------|---------|
| **Amount** | Up to ₹5 crores |
| **LTV** | Up to 80% |
| **Tenure** | Up to 20-25 years |
| **Interest** | 8.5-10% p.a. |
| **Currency** | INR (repay from NRE/NRO) |

**Documents Required:**

**Identity/Address:**
- Valid passport with visa
- Overseas address proof
- PAN Card

**Income Proof:**
- Employment contract
- Last 6 months salary slips
- Last 6-12 months bank statements
- Tax returns (overseas)

**Property Documents:**
- Sale agreement
- Property papers
- Builder documents (for under-construction)

**Banks Offering NRI Home Loans:**
| Bank | Max Amount | Special Features |
|------|------------|------------------|
| SBI | ₹3 crores | Global network |
| HDFC | ₹5 crores | Quick process |
| ICICI | ₹5 crores | NRI services |
| Axis | ₹3 crores | Doorstep service |

**Repayment Options:**
1. Auto-debit from NRE/NRO account
2. Wire transfer from abroad
3. ECS mandate

**Tax Benefits:**
- Same as resident Indians
- Section 24(b) for interest
- Section 80C for principal
- Depends on tax residency status

**Property Types Allowed:**
✓ Residential house/flat
✓ Plot for construction
✓ Under-construction property
✗ Agricultural/plantation land
✗ Farmhouse`,
    order: 6,
    tags: ['home-loan', 'nri', 'overseas', 'indian-property'],
    helpfulCount: 1876,
    viewCount: 24560,
    isPopular: false,
    relatedFaqIds: ['faq-hl-001', 'faq-hl-005', 'faq-pl-014'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // ============================================================================
  // MORE CAR LOAN FAQs
  // ============================================================================
  {
    id: 'faq-cl-002',
    categoryId: 'cat-car-loan',
    question: 'What is the eligibility criteria for Car Loan?',
    answer: `Car Loan eligibility depends on your profile and the vehicle:

**Salaried Eligibility:**
| Criteria | Requirement |
|----------|-------------|
| **Age** | 21-60 years |
| **Employment** | Minimum 1 year total, 6 months current |
| **Income** | Minimum ₹15,000-25,000/month |
| **Credit Score** | 700+ preferred |

**Self-employed Eligibility:**
| Criteria | Requirement |
|----------|-------------|
| **Age** | 21-65 years |
| **Business Vintage** | Minimum 2-3 years |
| **Income** | ITR showing ₹3 lakh+ annual |
| **Credit Score** | 700+ preferred |

**Vehicle Eligibility (New Car):**
- Any new car from authorized dealer
- Petrol, Diesel, CNG, Electric
- All brands covered
- Ex-showroom price considered

**Vehicle Eligibility (Used Car):**
| Parameter | Requirement |
|-----------|-------------|
| **Age at purchase** | Max 5-7 years old |
| **Age at loan end** | Max 10-12 years |
| **Mileage** | Below 60,000-80,000 km |
| **Condition** | No accident damage |

**Loan Amount Calculation:**
\`\`\`
New Car:
On-road price: ₹10,00,000
LTV: 90-100%
Max Loan: ₹9-10 lakhs

Used Car:
Market value: ₹5,00,000
LTV: 70-85%
Max Loan: ₹3.5-4.25 lakhs
\`\`\`

**EMI to Income Ratio:**
- Banks allow EMI up to 50% of net income
- Existing EMIs deducted from capacity

**Documents Required:**
**For Salaried:**
- ID Proof (Aadhaar, PAN)
- Address Proof
- 3 months salary slips
- 6 months bank statements
- Form 16

**For Self-employed:**
- Business proof
- 2-3 years ITR
- 12 months bank statements
- GST registration

**Special Categories:**
- Women: Lower rates (0.05-0.10%)
- Existing customers: Pre-approved offers
- Corporate employees: Tie-up rates`,
    order: 2,
    tags: ['car-loan', 'eligibility', 'requirements', 'documents'],
    helpfulCount: 1567,
    viewCount: 21340,
    isPopular: true,
    relatedFaqIds: ['faq-cl-001', 'faq-cl-003', 'faq-cl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cl-003',
    categoryId: 'cat-car-loan',
    question: 'What are the best banks for Car Loan in India?',
    answer: `Here's a comparison of top Car Loan providers:

**Banks - New Car Loan:**

| Bank | Interest Rate | Max LTV | Max Tenure | Processing |
|------|---------------|---------|------------|------------|
| **SBI** | 8.65-9.80% | 90% | 7 years | 0.25% |
| **HDFC Bank** | 8.75-10.50% | 100% | 7 years | Up to ₹3,000 |
| **ICICI Bank** | 8.80-10.25% | 100% | 7 years | 0.5% |
| **Axis Bank** | 8.70-10.00% | 90% | 7 years | ₹2,500 |
| **Bank of Baroda** | 8.60-10.40% | 85% | 7 years | 0.50% |
| **Kotak** | 8.75-9.90% | 90% | 5 years | Up to 1% |

**NBFCs - New Car Loan:**

| NBFC | Interest Rate | Max LTV | Features |
|------|---------------|---------|----------|
| **HDFC Ltd** | 8.70-11.00% | 100% | Quick approval |
| **Tata Capital** | 8.99-13.00% | 100% | Wide network |
| **Mahindra Finance** | 9.50-14.00% | 100% | Rural reach |
| **Sundaram Finance** | 9.00-11.50% | 90% | South India |

**Used Car Loan:**

| Lender | Interest Rate | Max LTV | Max Age |
|--------|---------------|---------|---------|
| **HDFC Bank** | 10.50-16.00% | 85% | 7 years |
| **Maruti Finance** | 11.00-15.00% | 80% | 5 years |
| **ICICI Bank** | 11.00-17.00% | 80% | 7 years |
| **Tata Capital** | 12.00-18.00% | 85% | 7 years |

**Best for Specific Needs:**
| Need | Best Option |
|------|-------------|
| Lowest interest | SBI, Bank of Baroda |
| 100% financing | HDFC Bank, ICICI |
| Fast approval | HDFC Bank, ICICI |
| Used car | Maruti True Value, HDFC |
| Electric vehicles | SBI Green Car Loan |
| Pre-owned premium | ICICI, Axis Bank |

**Dealer Financing vs Bank:**
| Factor | Dealer Finance | Bank Direct |
|--------|---------------|-------------|
| Process | Simpler | More steps |
| Rate | May be higher | Negotiable |
| Documentation | Less | More |
| Prepayment | Check terms | Usually flexible |

**Special Offers:**
- Festival discounts
- Corporate tie-ups
- Manufacturer subvention
- Exchange bonus financing`,
    order: 3,
    tags: ['car-loan', 'best-banks', 'interest-rates', 'comparison'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-cl-001', 'faq-cl-002', 'faq-cl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cl-004',
    categoryId: 'cat-car-loan',
    question: 'What is Two-Wheeler Loan and how does it work?',
    answer: `Two-Wheeler Loan helps finance motorcycles, scooters, and electric two-wheelers:

**Two-Wheeler Loan Features:**
| Parameter | Details |
|-----------|---------|
| **Amount** | ₹20,000 - ₹5 lakhs |
| **LTV** | 80-100% of on-road |
| **Tenure** | 12-48 months |
| **Interest** | 8-20% p.a. |
| **Processing** | ₹500-2,000 |

**Eligibility:**
| Criteria | Salaried | Self-employed |
|----------|----------|---------------|
| **Age** | 21-58 years | 21-65 years |
| **Income** | ₹12,000+/month | ₹2 lakh+/year |
| **Employment** | 6 months | 2 years |
| **CIBIL** | 650+ | 650+ |

**Documents Required:**
- ID Proof (Aadhaar/PAN)
- Address Proof
- Income Proof (Salary slip/ITR)
- Bank Statement (3 months)
- Photo

**Top Two-Wheeler Loan Providers:**
| Lender | Interest Rate | Max Amount |
|--------|---------------|------------|
| **HDFC Bank** | 9.50-18.00% | ₹5 lakhs |
| **ICICI Bank** | 10.00-19.00% | ₹5 lakhs |
| **Bajaj Finance** | 9.00-22.00% | ₹4 lakhs |
| **IndusInd Bank** | 10.00-20.00% | ₹3 lakhs |
| **Hero FinCorp** | 9.50-18.00% | ₹3 lakhs |
| **TVS Credit** | 10.00-20.00% | ₹2.5 lakhs |

**Electric Vehicle Special:**
| Feature | Benefit |
|---------|---------|
| Interest Rate | 1-2% lower |
| Processing | Often waived |
| Tenure | Up to 5 years |
| FAME Subsidy | Separate benefit |

**Dealer Point Financing:**
- Apply at showroom
- Instant approval possible
- On-spot disbursement
- Higher rates sometimes

**EMI Calculation (₹1 lakh loan):**
| Tenure | 12% Rate | 15% Rate |
|--------|----------|----------|
| 24 months | ₹4,707 | ₹4,848 |
| 36 months | ₹3,321 | ₹3,467 |
| 48 months | ₹2,633 | ₹2,783 |

**Tips for Better Rates:**
- Check pre-approved offers
- Compare bank vs dealer
- Pay higher down payment
- Choose shorter tenure
- Maintain good CIBIL`,
    order: 4,
    tags: ['two-wheeler-loan', 'bike-loan', 'scooter', 'electric-vehicle'],
    helpfulCount: 1234,
    viewCount: 16780,
    isPopular: true,
    relatedFaqIds: ['faq-cl-001', 'faq-cl-002', 'faq-cl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-14'
  },

  // ============================================================================
  // PARTNER GUIDE FAQs (For DSA/Connectors/Business Partners)
  // ============================================================================
  {
    id: 'faq-pg-001',
    categoryId: 'cat-partner-guide',
    question: 'What is DSA and how to become a Loan DSA?',
    answer: `DSA (Direct Selling Agent) is an individual/company authorized to source loan leads for banks/NBFCs:

**What is DSA?**
- Official channel partner of lenders
- Sources loan applications
- Earns commission on disbursement
- Works independently or with team

**Types of DSA:**
| Type | Description | Commission |
|------|-------------|------------|
| **Individual DSA** | Single person | Lower % |
| **Corporate DSA** | Company setup | Higher % |
| **Sub-DSA** | Works under DSA | Shared % |
| **Connector** | Referral only | Lower % |

**How to Become DSA:**

**Step 1: Basic Eligibility**
- Age: 21+ years
- Education: 12th pass minimum
- Clean background (no criminal record)
- Basic financial knowledge

**Step 2: Choose Lender(s)**
- Banks (SBI, HDFC, ICICI, etc.)
- NBFCs (Bajaj, Tata Capital, etc.)
- HFCs (HDFC Ltd, LIC HFL, etc.)

**Step 3: Apply for DSA Code**
- Fill application form
- Submit documents
- Background verification
- Training (if required)
- Receive DSA code

**Documents Required:**
| Document | Purpose |
|----------|---------|
| PAN Card | Tax identity |
| Aadhaar Card | Identity verification |
| Address Proof | Residence verification |
| Bank Statement | Financial standing |
| Photos | ID card |
| Education Certificate | Qualification |

**DSA Agreement Includes:**
- Products you can sell
- Commission structure
- Territory (if any)
- Compliance requirements
- Termination clauses

**DSA Commission Structure:**
| Product | Typical Payout |
|---------|----------------|
| Personal Loan | 1-3% of disbursement |
| Home Loan | 0.3-1% of disbursement |
| Business Loan | 1.5-4% of disbursement |
| Car Loan | 0.5-1.5% of disbursement |
| Gold Loan | 0.5-1% of disbursement |

**Advantages of Being DSA:**
- Flexible working hours
- No investment required
- Multiple bank tie-ups possible
- Recurring income potential
- Career growth opportunities`,
    order: 1,
    tags: ['dsa', 'partner', 'loan-agent', 'commission', 'business-partner'],
    helpfulCount: 4567,
    viewCount: 58900,
    isPopular: true,
    relatedFaqIds: ['faq-pg-002', 'faq-pg-003', 'faq-pg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pg-002',
    categoryId: 'cat-partner-guide',
    question: 'What is the commission structure for loan DSA partners?',
    answer: `DSA commission varies by loan product, bank, and disbursement amount:

**Personal Loan Payout:**
| Lender Type | Payout Range |
|-------------|--------------|
| Banks | 1.0-2.5% |
| NBFCs | 2.0-4.0% |
| Premium NBFCs | 1.5-3.0% |

**Home Loan Payout:**
| Lender Type | Payout Range |
|-------------|--------------|
| Banks | 0.25-0.60% |
| HFCs | 0.40-0.80% |
| NBFCs | 0.50-1.00% |

**Business Loan Payout:**
| Loan Type | Payout Range |
|-----------|--------------|
| Unsecured BL | 2.0-4.5% |
| Secured BL | 1.0-2.5% |
| Working Capital | 1.5-3.0% |

**Other Products:**
| Product | Typical Payout |
|---------|----------------|
| Car Loan | 0.5-1.5% |
| Gold Loan | 0.5-1.0% |
| Education Loan | 0.5-1.5% |
| LAP | 0.75-1.5% |

**Payout Calculation Example:**
\`\`\`
Personal Loan Disbursement: ₹10,00,000
DSA Payout: 2.5%

Gross Payout: ₹25,000
TDS (5%): ₹1,250
Net Payout: ₹23,750
\`\`\`

**Factors Affecting Payout:**
| Factor | Impact |
|--------|--------|
| Loan amount | Higher = sometimes better rate |
| Volume | More leads = better rates |
| Product type | Different rates |
| Bank policy | Varies by lender |
| Season | Festival offers |

**Payout Modes:**
- Monthly cycle (most common)
- Bi-weekly (some lenders)
- Per-case basis (large loans)

**Payout Timeline:**
| Stage | Time |
|-------|------|
| Disbursement | Day 0 |
| Payout processing | 15-30 days |
| Credit to account | 30-45 days |

**Additional Incentives:**
- Volume-based bonus
- Quality incentives (low bounce)
- Contest prizes
- Annual rewards`,
    order: 2,
    tags: ['dsa-payout', 'commission', 'partner-earnings', 'incentives'],
    helpfulCount: 5678,
    viewCount: 72340,
    isPopular: true,
    relatedFaqIds: ['faq-pg-001', 'faq-pg-003', 'faq-pg-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pg-003',
    categoryId: 'cat-partner-guide',
    question: 'How to use Loanz360 Partner Portal for lead management?',
    answer: `Loanz360 Partner Portal helps you manage leads and track earnings efficiently:

**Getting Started:**
1. Login with your Partner ID
2. Complete profile setup
3. Add bank account for payouts
4. Start adding leads

**Dashboard Overview:**
| Section | Information |
|---------|-------------|
| **Summary** | Total leads, conversions, earnings |
| **Leads** | All leads with status |
| **Payouts** | Earnings and payment history |
| **Reports** | Detailed analytics |
| **Support** | Help and queries |

**Adding New Lead:**
\`\`\`
Click "Add Lead" → Select Loan Type
         ↓
Enter Customer Details:
- Name, Mobile, Email
- Employment Type
- Required Amount
- Preferred Banks
         ↓
Upload Documents (if available)
         ↓
Submit Lead
\`\`\`

**Lead Status Tracking:**
| Status | Meaning |
|--------|---------|
| **New** | Just submitted |
| **Assigned** | Sent to sales team |
| **In Progress** | Being processed |
| **Documents Pending** | Awaiting docs |
| **Submitted to Bank** | At lender |
| **Sanctioned** | Loan approved |
| **Disbursed** | Money released |
| **Rejected** | Not approved |

**Document Upload:**
- Supported: PDF, JPG, PNG
- Max size: 5MB per file
- Categories: KYC, Income, Property
- Secure storage

**Payout Tracking:**
| View | Details |
|------|---------|
| **Pending** | Under processing |
| **Approved** | Ready for payment |
| **Paid** | Credited to account |
| **Invoice** | Download statement |

**Mobile App Features:**
- Add leads on-the-go
- Get instant notifications
- Track in real-time
- Quick customer calling

**Best Practices:**
1. Add leads immediately after meeting customer
2. Upload complete documents
3. Follow up regularly
4. Keep customer informed
5. Check status daily`,
    order: 3,
    tags: ['loanz360', 'partner-portal', 'lead-management', 'crm'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-pg-001', 'faq-pg-002', 'faq-pg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pg-004',
    categoryId: 'cat-partner-guide',
    question: 'What are the compliance requirements for DSA partners?',
    answer: `DSA partners must follow compliance guidelines set by banks and regulators:

**RBI Compliance Requirements:**

**1. Customer Privacy:**
- Maintain confidentiality of customer data
- No sharing of customer info with third parties
- Secure document handling
- Data protection protocols

**2. Fair Practices:**
- No misrepresentation of loan terms
- Clear disclosure of interest rates
- No hidden charges communication
- Transparent processing

**3. No Coercion:**
- No pressure selling
- Customer's right to decline
- No harassment for documents
- Professional conduct

**Bank-Specific Requirements:**

**Document Handling:**
| Requirement | Standard |
|-------------|----------|
| Collection | Original sight verification |
| Storage | Secure and confidential |
| Submission | Within stipulated time |
| Return | If loan rejected |

**Lead Quality Standards:**
| Parameter | Expectation |
|-----------|-------------|
| Contact accuracy | 100% correct |
| Document authenticity | Verified |
| Customer consent | Mandatory |
| No duplicate leads | Single submission |

**Prohibited Activities:**
✗ Collecting cash from customers
✗ Promising guaranteed approval
✗ Charging fees from customers
✗ Forging documents
✗ Multiple lead submission
✗ Sharing customer data
✗ Misrepresenting bank

**Training Requirements:**
- Product knowledge updates
- Compliance training
- Anti-money laundering (AML)
- Customer service standards

**Consequences of Non-Compliance:**
| Violation | Consequence |
|-----------|-------------|
| Minor | Warning |
| Repeated | Payout hold |
| Serious | Code suspension |
| Fraud | Legal action |

**Best Practices:**
1. Verify customer identity always
2. Document everything
3. Follow up professionally
4. Report suspicious activities
5. Keep updated on policies
6. Attend training sessions`,
    order: 4,
    tags: ['compliance', 'dsa-rules', 'regulations', 'partner-guidelines'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-pg-001', 'faq-pg-002', 'faq-reg-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-pg-005',
    categoryId: 'cat-partner-guide',
    question: 'How to increase loan conversion rates as a DSA partner?',
    answer: `Improving conversion rates requires understanding customer needs and process optimization:

**Key Conversion Metrics:**
| Stage | Average Rate |
|-------|--------------|
| Lead to Login | 40-50% |
| Login to Sanction | 60-70% |
| Sanction to Disbursal | 85-95% |
| **Overall** | **25-35%** |

**Improving Lead Quality:**

**1. Customer Profiling:**
| Check | Before Submitting |
|-------|-------------------|
| Employment | Verify company/business |
| Income | Match with loan need |
| CIBIL | Check if possible |
| Existing loans | Calculate FOIR |
| Documentation | Availability |

**2. Pre-qualification:**
\`\`\`
Basic Eligibility Check:
- Age within limits
- Income meets minimum
- Employment/business vintage
- Location serviceable
- Product fit
\`\`\`

**3. Complete Documentation:**
| Stage | Documents Ready |
|-------|-----------------|
| Lead Submission | Basic KYC |
| Login | Full document set |
| Processing | Supporting docs |

**Customer Relationship:**

**Communication Tips:**
- Respond within 2 hours
- Set clear expectations
- Explain process timeline
- Update on status changes
- Handle rejections professionally

**Follow-up Schedule:**
| Day | Action |
|-----|--------|
| Day 0 | Lead submission confirmation |
| Day 1 | Document collection |
| Day 3 | Processing status |
| Day 5 | Bank decision update |
| Day 7 | Disbursement follow-up |

**Product Matching:**
| Customer Profile | Best Product |
|------------------|--------------|
| High salary, good CIBIL | Bank loans |
| Self-employed | NBFC loans |
| Low CIBIL | NBFCs, secured |
| Urgent need | Pre-approved |

**Common Rejection Reasons & Solutions:**
| Reason | Prevention |
|--------|------------|
| Low CIBIL | Check before submitting |
| Income insufficient | Calculate eligibility |
| Wrong documents | Verify before submission |
| High FOIR | Check existing loans |
| Company not listed | Select right lender |

**Tools for Success:**
1. EMI calculator for customers
2. Eligibility check tools
3. Document checklist
4. Regular follow-up reminders
5. CRM for lead tracking`,
    order: 5,
    tags: ['conversion', 'dsa-tips', 'lead-quality', 'success'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-pg-001', 'faq-pg-003', 'faq-pg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // EMPLOYEE GUIDE FAQs (For Internal Staff)
  // ============================================================================
  {
    id: 'faq-eg-001',
    categoryId: 'cat-employee-guide',
    question: 'What is the loan processing workflow in Loanz360 CRM?',
    answer: `Loanz360 CRM follows a structured loan processing workflow:

**End-to-End Loan Processing:**
\`\`\`
Lead Generation → Assignment → Processing → Banking → Disbursement

Stage 1: LEAD
  ↓
Stage 2: QUALIFIED
  ↓
Stage 3: DOCUMENTS COLLECTED
  ↓
Stage 4: SUBMITTED TO BANK
  ↓
Stage 5: IN SANCTION
  ↓
Stage 6: SANCTIONED
  ↓
Stage 7: DISBURSED
\`\`\`

**Stage Details:**

**1. Lead Stage:**
| Action | Responsible |
|--------|-------------|
| New lead entry | Partner/Telecaller |
| Data verification | Sales team |
| Initial contact | Sales executive |
| Qualification | Sales executive |

**2. Qualification Stage:**
| Check | Status |
|-------|--------|
| Customer interest | Confirmed |
| Basic eligibility | Passed |
| Loan amount | Defined |
| Timeline | Agreed |

**3. Document Collection:**
| Activity | Timeline |
|----------|----------|
| Share checklist | Day 1 |
| Collection | Day 1-3 |
| Verification | Day 3-4 |
| Completion | Day 4-5 |

**4. Bank Submission:**
| Task | Owner |
|------|-------|
| Select bank | Credit team |
| Login case | Credit team |
| Track progress | Operations |

**5. Sanction Process:**
| Activity | Timeline |
|----------|----------|
| Bank processing | 3-7 days |
| Query resolution | As needed |
| Sanction letter | On approval |

**6. Disbursement:**
| Step | Action |
|------|--------|
| Documentation | Sign agreement |
| Verification | Final checks |
| Release | Fund transfer |

**CRM Actions by Stage:**
- Update status promptly
- Add notes for context
- Upload documents properly
- Set follow-up reminders
- Escalate delays`,
    order: 1,
    tags: ['crm', 'workflow', 'loan-processing', 'employee-guide'],
    helpfulCount: 2345,
    viewCount: 31250,
    isPopular: true,
    relatedFaqIds: ['faq-eg-002', 'faq-eg-003', 'faq-eg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-eg-002',
    categoryId: 'cat-employee-guide',
    question: 'How to handle customer document verification?',
    answer: `Proper document verification is critical for loan approval:

**Document Verification Checklist:**

**KYC Documents:**
| Document | Check Points |
|----------|--------------|
| **Aadhaar** | Photo match, Address, QR valid |
| **PAN Card** | Name matches, Number format |
| **Passport** | Validity, Photo, Address |
| **Voter ID** | Photo, Address complete |

**Income Documents (Salaried):**
| Document | Verification |
|----------|--------------|
| **Salary Slip** | Company name, Employee ID, Net salary, Deductions |
| **Bank Statement** | Salary credits, Regular pattern, 6 months |
| **Form 16** | Employer details, Income, TDS |
| **Offer Letter** | Joining date, Designation, CTC |

**Income Documents (Self-employed):**
| Document | Verification |
|----------|--------------|
| **ITR** | Computation, Acknowledgment, Income declared |
| **Financials** | P&L, Balance Sheet, CA signature |
| **Bank Statement** | Business credits, 12 months, Regular flow |
| **GST Returns** | GSTIN, Filing regularity, Turnover |

**Property Documents (for Secured Loans):**
| Document | Check |
|----------|-------|
| Sale Deed | Registration, Stamp duty |
| Title | Chain of ownership |
| EC | No encumbrance |
| Tax Receipts | Up to date |
| Plan | Approved by authority |

**Red Flags to Watch:**
| Issue | Action |
|-------|--------|
| Photo mismatch | Reject/Re-verify |
| Tampered documents | Reject immediately |
| Income inconsistency | Seek clarification |
| Missing pages | Get complete docs |
| Expired documents | Request fresh |

**Verification Tools:**
- Aadhaar: UIDAI verification
- PAN: NSDL verification
- Company: MCA/Company registry
- CIBIL: Bureau report
- Bank Statement: Analyzer tools

**Documentation Best Practices:**
1. Verify originals when possible
2. Cross-check across documents
3. Note discrepancies immediately
4. Get customer clarification in writing
5. Maintain verification trail`,
    order: 2,
    tags: ['document-verification', 'kyc', 'employee-guide', 'compliance'],
    helpfulCount: 1876,
    viewCount: 24560,
    isPopular: true,
    relatedFaqIds: ['faq-eg-001', 'faq-eg-003', 'faq-doc-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-eg-003',
    categoryId: 'cat-employee-guide',
    question: 'How to select the right lender for a loan application?',
    answer: `Lender selection impacts approval chances and customer satisfaction:

**Lender Selection Factors:**

**1. Customer Profile:**
| Profile | Best Fit |
|---------|----------|
| High CIBIL (750+) | Banks (best rates) |
| Medium CIBIL (650-750) | Select banks/NBFCs |
| Low CIBIL (<650) | NBFCs |
| Self-employed | NBFC-friendly banks |

**2. Loan Amount:**
| Amount | Suitable Lenders |
|--------|------------------|
| Small (<₹5L) | NBFCs, Digital lenders |
| Medium (₹5-25L) | Banks, Large NBFCs |
| Large (>₹25L) | Banks (secured) |

**3. Income Type:**
| Income Source | Preferred Lenders |
|---------------|-------------------|
| Salaried-MNC | All banks |
| Salaried-SME | Select banks, NBFCs |
| Self-employed | Business-friendly lenders |
| ITR-based | Income-flexible NBFCs |

**Lender Matrix by Product:**

**Personal Loan:**
| Customer Type | Bank Option | NBFC Option |
|---------------|-------------|-------------|
| Prime | HDFC, ICICI, Axis | - |
| Near-prime | SBI, Kotak | Bajaj, Tata |
| Subprime | - | IIFL, Fullerton |

**Home Loan:**
| Type | Bank | HFC |
|------|------|-----|
| Salaried | SBI, HDFC Bank | HDFC Ltd |
| Self-employed | ICICI, Axis | PNB HFL |
| Affordable housing | SBI, BoB | LIC HFL |

**Business Loan:**
| Business Type | Lender Match |
|---------------|--------------|
| Established | Banks |
| Growing | NBFCs |
| Startup | MUDRA, NBFCs |

**Decision Process:**
\`\`\`
Check customer profile
         ↓
Identify eligible lenders
         ↓
Compare interest rates
         ↓
Check processing time
         ↓
Select best fit
\`\`\`

**Things to Consider:**
- Current bank offers/promotions
- Processing time requirements
- Documentation flexibility
- Customer preference
- Past rejection history`,
    order: 3,
    tags: ['lender-selection', 'bank-selection', 'employee-guide', 'matching'],
    helpfulCount: 2567,
    viewCount: 34560,
    isPopular: true,
    relatedFaqIds: ['faq-eg-001', 'faq-eg-002', 'faq-eg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-eg-004',
    categoryId: 'cat-employee-guide',
    question: 'How to handle customer queries and objections?',
    answer: `Effective query handling improves customer experience and conversion:

**Common Customer Queries:**

**Interest Rate Questions:**
| Query | Response Approach |
|-------|-------------------|
| "Rate too high" | Explain factors, show comparison |
| "Can rate be reduced?" | Check pre-approved offers, negotiate |
| "Fixed or floating?" | Explain pros/cons, recommend |

**Example Response:**
"The interest rate depends on your credit profile. Let me check your eligibility for better rates. Based on your CIBIL score of 750, you may qualify for our premium rates."

**Processing Time Questions:**
| Query | Response |
|-------|----------|
| "How long?" | Give realistic timeline |
| "Why delay?" | Explain process, give status |
| "Can it be faster?" | Check fast-track options |

**Document Questions:**
| Query | Response |
|-------|----------|
| "Why so many docs?" | Explain bank requirements |
| "Don't have this doc" | Suggest alternatives |
| "Already gave to bank" | Explain fresh requirement |

**Objection Handling:**

**Price Objection:**
\`\`\`
Acknowledge → Understand → Respond → Confirm

"I understand the rate seems high. May I ask what rate you were expecting? Based on your profile, this is actually competitive. Let me show you the total cost comparison."
\`\`\`

**Trust Objection:**
- Share company credentials
- Provide partner bank details
- Offer reference from existing customers
- Show certifications/registrations

**Timing Objection:**
- Understand the urgency
- Check for faster alternatives
- Set clear expectations
- Follow up proactively

**Communication Tips:**
| Do | Don't |
|----|-------|
| Listen actively | Interrupt |
| Empathize | Dismiss concerns |
| Provide solutions | Make promises |
| Follow up | Leave hanging |
| Be transparent | Hide information |

**Escalation Matrix:**
| Issue | Escalate To |
|-------|-------------|
| Rate negotiation | Team Lead |
| Process delay | Operations |
| Customer complaint | Manager |
| Technical issue | Support team |`,
    order: 4,
    tags: ['customer-service', 'objection-handling', 'employee-guide', 'communication'],
    helpfulCount: 1567,
    viewCount: 21340,
    isPopular: true,
    relatedFaqIds: ['faq-eg-001', 'faq-eg-002', 'faq-eg-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // CUSTOMER GUIDE FAQs (For Loan Applicants)
  // ============================================================================
  {
    id: 'faq-cg-001',
    categoryId: 'cat-customer-guide',
    question: 'How to apply for a loan through Loanz360?',
    answer: `Applying for a loan through Loanz360 is simple and straightforward:

**Step-by-Step Application Process:**

**Step 1: Choose Loan Type**
\`\`\`
Visit Loanz360 → Select Product:
- Personal Loan
- Home Loan
- Business Loan
- Car Loan
- Education Loan
- Gold Loan
\`\`\`

**Step 2: Check Eligibility**
| Information Needed | Purpose |
|-------------------|---------|
| Monthly income | Loan amount calculation |
| Employment type | Product matching |
| Loan amount required | Lender selection |
| City | Availability check |

**Step 3: Fill Application**
- Personal details (Name, DOB, Contact)
- Employment details
- Loan requirement
- Existing loans (if any)

**Step 4: Document Upload**
| Document Type | Examples |
|---------------|----------|
| Identity | Aadhaar, PAN |
| Address | Aadhaar, Utility bill |
| Income | Salary slips, ITR |
| Bank Statement | Last 6 months |

**Step 5: Get Offers**
- Multiple lender options
- Compare interest rates
- See EMI estimates
- Choose best offer

**Step 6: Complete Processing**
- Document verification
- Bank submission
- Track status online
- Get disbursement

**Application Channels:**
| Channel | Features |
|---------|----------|
| **Website** | Full features, document upload |
| **Mobile App** | Apply on-the-go |
| **Call** | Assisted application |
| **Partner** | In-person help |

**Timeline:**
| Stage | Duration |
|-------|----------|
| Application | 10 minutes |
| Document collection | 1-2 days |
| Bank processing | 2-5 days |
| Disbursement | 1-2 days |

**Tips for Fast Approval:**
1. Keep documents ready
2. Fill accurate information
3. Respond to queries quickly
4. Provide complete documents
5. Maintain good CIBIL`,
    order: 1,
    tags: ['apply-loan', 'customer-guide', 'application-process', 'loanz360'],
    helpfulCount: 4567,
    viewCount: 58900,
    isPopular: true,
    relatedFaqIds: ['faq-cg-002', 'faq-cg-003', 'faq-cg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cg-002',
    categoryId: 'cat-customer-guide',
    question: 'How to track my loan application status?',
    answer: `Track your loan application status easily through multiple channels:

**Online Tracking (Website):**
1. Visit Loanz360 portal
2. Login with registered mobile
3. Go to "My Applications"
4. View current status

**Mobile App Tracking:**
1. Open Loanz360 app
2. Login with OTP
3. See application status on dashboard
4. Get push notifications

**Status Stages Explained:**
| Status | Meaning | Expected Action |
|--------|---------|-----------------|
| **Application Received** | Form submitted | Wait for callback |
| **Documents Pending** | Docs needed | Upload documents |
| **Under Review** | Being checked | No action needed |
| **Submitted to Bank** | At lender | Wait for decision |
| **Additional Info Required** | Query raised | Provide information |
| **Approved/Sanctioned** | Loan approved | Sign documents |
| **Disbursement Processing** | Final stage | Await fund credit |
| **Disbursed** | Complete | Enjoy your loan |
| **Rejected** | Not approved | Check rejection reason |

**What Each Status Means:**

**Application Received:**
- Your details are recorded
- A relationship manager will contact you
- Prepare your documents

**Documents Pending:**
- Some documents missing
- Check pending list
- Upload quickly

**Under Review:**
- Our team is verifying
- May take 1-2 days
- Keep phone accessible

**Submitted to Bank:**
- Case at bank level
- Processing time 2-5 days
- We'll update on progress

**Contact for Status:**
| Channel | Response Time |
|---------|---------------|
| WhatsApp | 2-4 hours |
| Phone | Immediate |
| Email | 24 hours |
| Chat | Real-time |

**Tips:**
- Save your application ID
- Keep notification enabled
- Respond to queries promptly
- Check status daily`,
    order: 2,
    tags: ['track-status', 'application-status', 'customer-guide', 'tracking'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-cg-001', 'faq-cg-003', 'faq-cg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cg-003',
    categoryId: 'cat-customer-guide',
    question: 'What documents do I need for loan application?',
    answer: `Document requirements vary by loan type and employment:

**Universal Documents (All Loans):**
| Document | Accepted Formats |
|----------|------------------|
| **PAN Card** | Original/Copy (Mandatory) |
| **Aadhaar Card** | Original/Copy |
| **Passport Photos** | Recent photos |

**Salaried Employee Documents:**
| Document | Details |
|----------|---------|
| **Salary Slips** | Last 3 months |
| **Bank Statement** | Last 6 months (salary account) |
| **Form 16** | Last 2 years |
| **Employee ID** | Current employer |
| **Offer/Appointment Letter** | From current employer |

**Self-Employed Documents:**
| Document | Details |
|----------|---------|
| **ITR** | Last 2-3 years with computation |
| **Bank Statement** | Last 12 months |
| **Business Proof** | GST, Shop Act, License |
| **Financial Statements** | Audited P&L, Balance Sheet |
| **Office Address Proof** | Utility bill, rent agreement |

**Product-Specific Additional Documents:**

**Home Loan:**
| Document | Purpose |
|----------|---------|
| Property papers | Sale deed, agreement |
| Builder documents | Approval, registration |
| Valuation report | Property assessment |

**Business Loan:**
| Document | Purpose |
|----------|---------|
| GST returns | Revenue verification |
| Partnership deed/MOA | Business structure |
| Project report | For new projects |

**Car Loan:**
| Document | Purpose |
|----------|---------|
| Proforma invoice | Vehicle details |
| RC copy (used car) | Ownership proof |

**Education Loan:**
| Document | Purpose |
|----------|---------|
| Admission letter | Course confirmation |
| Fee structure | Amount needed |
| Academic records | Eligibility |

**Document Tips:**
- Clear, readable copies
- All pages included
- Recent documents
- Matching names across documents
- Proper attestation where needed`,
    order: 3,
    tags: ['documents', 'document-list', 'customer-guide', 'requirements'],
    helpfulCount: 5678,
    viewCount: 72340,
    isPopular: true,
    relatedFaqIds: ['faq-cg-001', 'faq-cg-002', 'faq-doc-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cg-004',
    categoryId: 'cat-customer-guide',
    question: 'What if my loan application is rejected?',
    answer: `Loan rejection doesn't mean the end. Here's what you can do:

**Common Rejection Reasons:**
| Reason | Frequency |
|--------|-----------|
| Low CIBIL score | 35% |
| Insufficient income | 25% |
| High existing debt | 15% |
| Document issues | 12% |
| Company not approved | 8% |
| Other | 5% |

**Understanding Your Rejection:**
1. Request written reason from bank
2. Review your CIBIL report
3. Check income calculation
4. Verify document compliance

**Action Plan by Rejection Reason:**

**Low CIBIL Score:**
| Action | Timeline |
|--------|----------|
| Clear pending dues | Immediate |
| Reduce credit card usage | 1-2 months |
| Check report errors | 30 days to resolve |
| Reapply | After 3-6 months |

**Insufficient Income:**
| Action | Option |
|--------|--------|
| Apply for lower amount | Immediate |
| Add co-applicant | Additional income |
| Show additional income | Rental, freelance |
| Wait for salary hike | Future |

**High Existing Debt:**
| Action | Timeline |
|--------|----------|
| Prepay some loans | If possible |
| Wait for loan closures | As per tenure |
| Debt consolidation | Consider |

**Alternative Options:**
| Current Situation | Alternative |
|-------------------|-------------|
| Bank rejection | Try NBFCs |
| Unsecured rejection | Secured loan |
| No income proof | Gold loan |
| New to credit | Credit builder |

**What NOT to Do:**
✗ Apply to many lenders rapidly
✗ Provide false information
✗ Ignore rejection reason
✗ Give up immediately

**Reapplication Strategy:**
\`\`\`
Wait Period: 3-6 months
         ↓
Address rejection reason
         ↓
Check CIBIL improvement
         ↓
Apply to different lender
         ↓
Or try secured alternatives
\`\`\`

**Our Support:**
- Free rejection analysis
- Alternative suggestions
- CIBIL improvement tips
- Reapplication assistance`,
    order: 4,
    tags: ['rejection', 'loan-denied', 'customer-guide', 'alternatives'],
    helpfulCount: 2876,
    viewCount: 38900,
    isPopular: true,
    relatedFaqIds: ['faq-cg-001', 'faq-cs-002', 'faq-pl-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cg-005',
    categoryId: 'cat-customer-guide',
    question: 'How to make loan EMI payments and manage repayment?',
    answer: `Managing loan repayment properly ensures smooth loan tenure:

**EMI Payment Methods:**
| Method | How to Use |
|--------|------------|
| **Auto-debit (ECS/NACH)** | Set up with bank (Recommended) |
| **Net Banking** | Login and pay |
| **UPI** | Scan QR / Enter VPA |
| **Mobile Banking** | Through bank app |
| **NEFT/RTGS** | Transfer to loan account |
| **Cheque** | Post-dated cheques |
| **Cash** | At bank branch |

**Setting Up Auto-Debit:**
1. Sign ECS/NACH mandate form
2. Provide bank details
3. Submit at loan branch
4. Verify first debit
5. Maintain balance on due date

**EMI Due Date Management:**
| Scenario | Action |
|----------|--------|
| Before due date | EMI debited automatically |
| On due date | Keep sufficient balance |
| After due date | Pay immediately + late fee |
| Cheque bounce | Pay with charges |

**Payment Reminders:**
- Bank SMS (3-5 days before)
- Email reminders
- App notifications
- Call for delays

**Prepayment Options:**
| Type | Description |
|------|-------------|
| **Part prepayment** | Pay extra, reduce principal |
| **Full prepayment** | Close loan early |
| **EMI increase** | Reduce tenure |

**Prepayment Benefits:**
\`\`\`
Loan: ₹10 lakhs at 12% for 5 years
Regular EMI: ₹22,244
Total Interest: ₹3,34,670

With ₹1 lakh prepay in Year 2:
Interest Saved: ~₹50,000
Tenure Reduced: 6 months
\`\`\`

**Managing Payment Issues:**

**If EMI Bounces:**
1. Pay immediately with charges
2. Inform bank proactively
3. Ensure balance for next month
4. One bounce may be forgiven

**If Facing Financial Difficulty:**
- Contact bank immediately
- Request EMI moratorium
- Ask for restructuring
- Explore tenure extension

**Keeping Good Track Record:**
| Do | Benefit |
|----|---------|
| Pay on time | Good CIBIL score |
| Keep buffer balance | Avoid bounces |
| Track statements | Spot errors |
| Get NOC on closure | Complete documentation |`,
    order: 5,
    tags: ['emi-payment', 'repayment', 'customer-guide', 'auto-debit'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-cg-001', 'faq-emi-001', 'faq-emi-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // MORTGAGE LOAN FAQs
  // ============================================================================
  {
    id: 'faq-ml-001',
    categoryId: 'cat-mortgage-loan',
    question: 'What is a Mortgage Loan and how is it different from other loans?',
    answer: `A Mortgage Loan is a secured loan where property (residential or commercial) is pledged as collateral to the lender:

**What is Mortgage Loan:**
- Loan against property you already own
- Property remains with you but has lien
- Used for any purpose (business, personal, education)
- Higher loan amounts than unsecured loans
- Lower interest rates due to security

**Types of Mortgage Loans:**
| Type | Description |
|------|-------------|
| **Simple Mortgage** | Property transferred until loan repaid |
| **English Mortgage** | Property reconveyed on payment |
| **Equitable Mortgage** | Title deeds deposited as security |
| **Registered Mortgage** | Mortgage registered with sub-registrar |

**Mortgage vs Other Loans:**
| Feature | Mortgage Loan | Home Loan | Personal Loan |
|---------|---------------|-----------|---------------|
| Purpose | Any purpose | Home purchase only | Any purpose |
| Collateral | Required | Required | Not required |
| Amount | Up to 70% of property | Up to 90% of property | Based on income |
| Interest | 8-13% | 8-10% | 10-24% |
| Tenure | Up to 20 years | Up to 30 years | Up to 5 years |

**Key Features:**
- Loan Amount: ₹5 lakhs to ₹10 crores
- LTV Ratio: 50-70% of property value
- Tenure: 5 to 20 years
- Interest Rate: 8.5% to 13% p.a.

**Best Used For:**
- Business expansion capital
- Child's education abroad
- Debt consolidation
- Medical emergencies
- Wedding expenses`,
    order: 1,
    tags: ['mortgage-loan', 'loan-against-property', 'secured-loan', 'property-loan'],
    helpfulCount: 2345,
    viewCount: 34560,
    isPopular: true,
    relatedFaqIds: ['faq-ml-002', 'faq-lap-001', 'faq-hl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ml-002',
    categoryId: 'cat-mortgage-loan',
    question: 'What is LTV ratio in Mortgage Loan and how is it calculated?',
    answer: `LTV (Loan-to-Value) ratio is the percentage of property value that a lender will finance:

**LTV Calculation:**
\`\`\`
LTV Ratio = (Loan Amount / Property Value) × 100

Example:
Property Value: ₹1 crore
Maximum LTV: 65%
Maximum Loan: ₹65 lakhs
\`\`\`

**LTV Guidelines by Property Type:**
| Property Type | Maximum LTV |
|---------------|-------------|
| Residential - Self-occupied | 65-70% |
| Residential - Rented | 60-65% |
| Commercial - Self-used | 55-60% |
| Commercial - Rented | 50-55% |
| Industrial Property | 50% |
| Plot/Land | 50% |

**Factors Affecting LTV:**
1. **Property Location**
   - Metro cities: Higher LTV
   - Tier 2/3 cities: Lower LTV
   - Rural areas: Lowest LTV

2. **Property Age**
   - New construction: Higher LTV
   - Old buildings: Lower LTV
   - Heritage structures: Special assessment

3. **Property Type**
   - Freehold: Higher LTV
   - Leasehold: Lower LTV
   - Inherited: Additional verification

4. **Borrower Profile**
   - Good CIBIL: Higher LTV
   - Stable income: Higher LTV
   - Government employee: Better terms

**Property Valuation Process:**
\`\`\`
Application submitted
        ↓
Technical visit scheduled
        ↓
Valuer inspects property
        ↓
Market value assessed
        ↓
Distress value calculated
        ↓
Final valuation report
        ↓
LTV determined
\`\`\`

**Tips to Get Higher LTV:**
- Maintain property well
- Clear all dues (taxes, maintenance)
- Provide rental agreements if rented
- Choose reputed builder properties
- Apply with strong income proof`,
    order: 2,
    tags: ['ltv', 'loan-to-value', 'mortgage-loan', 'property-valuation'],
    helpfulCount: 1876,
    viewCount: 25670,
    isPopular: true,
    relatedFaqIds: ['faq-ml-001', 'faq-ml-003', 'faq-lap-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ml-003',
    categoryId: 'cat-mortgage-loan',
    question: 'What documents are required for Mortgage Loan?',
    answer: `Mortgage Loan requires comprehensive documentation for both borrower and property:

**Borrower Documents:**

**Identity & Address Proof:**
- PAN Card (mandatory)
- Aadhaar Card
- Passport/Voter ID/Driving License
- Current address proof

**Income Documents (Salaried):**
| Document | Requirement |
|----------|-------------|
| Salary Slips | Last 6 months |
| Bank Statements | Last 12 months |
| Form 16 | Last 2 years |
| ITR | Last 2-3 years |
| Employment Letter | Current employer |

**Income Documents (Self-Employed):**
| Document | Requirement |
|----------|-------------|
| ITR with Computation | Last 3 years |
| Bank Statements | Last 12-24 months |
| Balance Sheet | Last 3 years |
| P&L Statement | Last 3 years |
| GST Returns | Last 12 months |
| Business Registration | Current |

**Property Documents:**
| Document | Purpose |
|----------|---------|
| **Original Sale Deed** | Proves ownership |
| **Previous Chain Deeds** | Title history (30-40 years) |
| **Khata/Patta** | Revenue records |
| **Encumbrance Certificate** | No pending dues |
| **Property Tax Receipts** | Tax compliance |
| **Approved Building Plan** | Legal construction |
| **Occupancy Certificate** | Habitation approval |
| **Society NOC** | For flat/apartment |
| **Allotment Letter** | Builder property |

**Additional Documents:**
- Property photos (exterior + interior)
- Maintenance receipts
- Rental agreement (if rented)
- Power of Attorney (if applicable)
- Succession certificate (inherited property)

**Document Verification Process:**
\`\`\`
Documents submitted
        ↓
KYC verification
        ↓
Income verification
        ↓
Legal title search
        ↓
Technical valuation
        ↓
Final approval
\`\`\`

**Common Document Issues:**
| Issue | Solution |
|-------|----------|
| Missing chain deed | Title search + legal opinion |
| Encumbrance | Clear before application |
| Name mismatch | Affidavit + supporting docs |
| Unapproved construction | Regularization required |`,
    order: 3,
    tags: ['mortgage-documents', 'property-documents', 'kyc', 'title-documents'],
    helpfulCount: 2134,
    viewCount: 28900,
    isPopular: true,
    relatedFaqIds: ['faq-ml-001', 'faq-ml-002', 'faq-doc-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ml-004',
    categoryId: 'cat-mortgage-loan',
    question: 'Which banks offer best Mortgage Loan interest rates in India?',
    answer: `Compare mortgage loan offerings from top banks and NBFCs in India:

**Bank Mortgage Loan Rates (2024):**
| Bank | Interest Rate | Max LTV | Max Tenure |
|------|---------------|---------|------------|
| SBI | 8.75% - 10.50% | 65% | 15 years |
| HDFC Bank | 9.00% - 11.00% | 65% | 18 years |
| ICICI Bank | 9.05% - 11.25% | 65% | 15 years |
| Axis Bank | 9.25% - 11.50% | 65% | 20 years |
| Bank of Baroda | 8.85% - 10.75% | 70% | 15 years |
| Kotak Bank | 9.15% - 11.00% | 60% | 15 years |
| PNB | 8.90% - 10.65% | 65% | 15 years |
| IDBI Bank | 9.00% - 11.00% | 65% | 15 years |

**NBFC Mortgage Loan Rates:**
| NBFC | Interest Rate | Max LTV | Max Amount |
|------|---------------|---------|------------|
| Bajaj Finserv | 9.50% - 13.00% | 70% | ₹5 crore |
| Tata Capital | 9.75% - 12.50% | 65% | ₹3 crore |
| IIFL | 10.00% - 14.00% | 65% | ₹5 crore |
| Poonawalla | 10.25% - 13.50% | 60% | ₹3 crore |
| L&T Finance | 9.50% - 12.00% | 65% | ₹5 crore |
| Sundaram Finance | 10.00% - 13.00% | 60% | ₹2 crore |

**Processing Fees:**
| Lender | Processing Fee |
|--------|----------------|
| PSU Banks | 0.25% - 0.50% |
| Private Banks | 0.50% - 1.00% |
| NBFCs | 1.00% - 2.00% |

**Choosing Right Lender:**
| Priority | Best Option |
|----------|-------------|
| Lowest rate | PSU banks (SBI, BOB) |
| Fast processing | NBFCs |
| Higher LTV | Select NBFCs |
| Longer tenure | Private banks |
| Special scheme | Check current offers |

**Negotiation Tips:**
1. Get quotes from 3-4 lenders
2. Mention competitor rates
3. Highlight good credit score
4. Ask for processing fee waiver
5. Check for special offers

**Rate Types:**
- **Floating Rate:** Linked to EBLR/MCLR, changes with market
- **Fixed Rate:** Constant for initial period (1-3 years)
- **Mixed Rate:** Fixed initially, then floating`,
    order: 4,
    tags: ['mortgage-rates', 'best-banks', 'interest-comparison', 'nbfc-mortgage'],
    helpfulCount: 3456,
    viewCount: 45670,
    isPopular: true,
    relatedFaqIds: ['faq-ml-001', 'faq-ml-002', 'faq-ir-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ml-005',
    categoryId: 'cat-mortgage-loan',
    question: 'What happens if I default on Mortgage Loan payment?',
    answer: `Defaulting on mortgage loan has serious consequences. Understanding the process helps you take timely action:

**Default Timeline:**
\`\`\`
EMI Due Date
    ↓
7 days late → SMS reminder
    ↓
15 days late → Phone calls begin
    ↓
30 days late → Legal notice preparation
    ↓
60 days late → NPA classification warning
    ↓
90 days late → Account becomes NPA
    ↓
SARFAESI proceedings initiated
\`\`\`

**Consequences of Default:**
| Stage | Impact |
|-------|--------|
| **1-30 days** | Late payment charges (1-2%), calls |
| **30-60 days** | Penal interest, credit score drop |
| **60-90 days** | Account marked SMA-2, legal prep |
| **90+ days** | NPA status, SARFAESI action |

**SARFAESI Act Proceedings:**
1. **60-day Notice:** Demand for payment
2. **Possession Notice:** If no payment
3. **Property Possession:** Bank takes control
4. **Sale Notice:** Public auction announced
5. **Property Auction:** Sold to recover dues

**Financial Impact:**
| Default Period | Credit Score Impact |
|----------------|---------------------|
| 30 days | -50 to -100 points |
| 60 days | -100 to -150 points |
| 90 days | -150 to -200 points |
| NPA | Score drops below 500 |

**Legal Rights of Borrower:**
- 60-day notice before possession
- Right to redeem property before sale
- Right to fair valuation
- Right to appeal to DRT
- Right to remaining amount after sale

**Redemption Process:**
\`\`\`
Total Dues = Principal Outstanding
           + Interest Due
           + Penal Interest
           + Legal Costs
           + Possession Charges
\`\`\`

**What to Do If Facing Default:**

**Immediate Steps:**
1. Contact lender immediately
2. Explain financial situation
3. Request restructuring
4. Negotiate settlement

**Options Available:**
| Option | Description |
|--------|-------------|
| **EMI Holiday** | Temporary pause (3-6 months) |
| **Tenure Extension** | Reduce EMI amount |
| **One-Time Settlement** | Pay less than due (with hit) |
| **Loan Restructuring** | New terms, fresh start |
| **Property Sale** | Sell before auction |

**Prevention Tips:**
- Keep 3-6 months EMI reserve
- Set up auto-debit
- Get loan insurance
- Communicate with lender early`,
    order: 5,
    tags: ['mortgage-default', 'sarfaesi', 'npa', 'loan-recovery', 'property-auction'],
    helpfulCount: 2987,
    viewCount: 41230,
    isPopular: true,
    relatedFaqIds: ['faq-ml-001', 'faq-cg-005', 'faq-reg-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // BANKING BASICS FAQs
  // ============================================================================
  {
    id: 'faq-bb-001',
    categoryId: 'cat-banking-basics',
    question: 'What are different types of bank accounts in India?',
    answer: `Understanding bank account types helps choose the right one for your needs:

**1. Savings Account:**
| Feature | Details |
|---------|---------|
| Purpose | Personal savings |
| Interest | 2.5% - 7% p.a. |
| Min Balance | ₹500 - ₹10,000 |
| Withdrawals | Unlimited (charges may apply) |
| Best For | Salaried, students, general public |

**2. Current Account:**
| Feature | Details |
|---------|---------|
| Purpose | Business transactions |
| Interest | Nil |
| Min Balance | ₹10,000 - ₹25,000 |
| Transactions | Unlimited |
| Best For | Businesses, traders, professionals |

**3. Fixed Deposit (FD):**
| Feature | Details |
|---------|---------|
| Purpose | Higher returns on savings |
| Interest | 5% - 7.5% p.a. |
| Tenure | 7 days to 10 years |
| Withdrawal | Penalty for premature |
| Best For | Risk-averse investors |

**4. Recurring Deposit (RD):**
| Feature | Details |
|---------|---------|
| Purpose | Regular monthly savings |
| Interest | Similar to FD |
| Tenure | 6 months to 10 years |
| Monthly | Fixed amount |
| Best For | Building savings habit |

**5. Salary Account:**
| Feature | Details |
|---------|---------|
| Purpose | Salary credit |
| Interest | 3% - 4% p.a. |
| Min Balance | Usually nil |
| Benefits | Free debit card, no charges |
| Best For | Salaried employees |

**6. NRI Accounts:**
| Type | Who Can Open | Currency |
|------|--------------|----------|
| NRE | NRIs | INR (Freely repatriable) |
| NRO | NRIs | INR (Restricted repatriation) |
| FCNR | NRIs | Foreign currency |

**7. Basic Savings Bank Deposit Account (BSBDA):**
- Zero balance account
- For financial inclusion
- Limited transactions
- No annual fees

**Comparison Chart:**
| Account | Interest | Min Balance | Best For |
|---------|----------|-------------|----------|
| Savings | 2.5-7% | ₹500-10K | Personal |
| Current | 0% | ₹10K-25K | Business |
| FD | 5-7.5% | ₹1,000+ | Investment |
| RD | 5-7% | ₹100/month | Regular saving |
| Salary | 3-4% | Nil | Employees |`,
    order: 1,
    tags: ['bank-account', 'savings-account', 'current-account', 'fd', 'rd', 'nri-account'],
    helpfulCount: 4567,
    viewCount: 67890,
    isPopular: true,
    relatedFaqIds: ['faq-bb-002', 'faq-bb-003', 'faq-db-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bb-002',
    categoryId: 'cat-banking-basics',
    question: 'What is NEFT, RTGS, and IMPS - Which should I use?',
    answer: `Understanding fund transfer methods helps choose the right option:

**NEFT (National Electronic Funds Transfer):**
| Feature | Details |
|---------|---------|
| Timing | 24/7 (all days) |
| Settlement | Batch-wise, every 30 mins |
| Minimum | ₹1 |
| Maximum | No limit |
| Charges | Nil (since Jan 2020) |
| Speed | 30 mins to 2 hours |

**RTGS (Real Time Gross Settlement):**
| Feature | Details |
|---------|---------|
| Timing | 24/7 (all days) |
| Settlement | Real-time |
| Minimum | ₹2 lakhs |
| Maximum | No limit |
| Charges | Nil (since July 2019) |
| Speed | Instant |

**IMPS (Immediate Payment Service):**
| Feature | Details |
|---------|---------|
| Timing | 24/7/365 |
| Settlement | Instant |
| Minimum | ₹1 |
| Maximum | ₹5 lakhs |
| Charges | ₹2.50 - ₹25 |
| Speed | Instant |

**UPI (Unified Payments Interface):**
| Feature | Details |
|---------|---------|
| Timing | 24/7/365 |
| Settlement | Instant |
| Minimum | ₹1 |
| Maximum | ₹1 lakh (₹5L for some) |
| Charges | Nil |
| Speed | Instant |

**Comparison Table:**
| Feature | NEFT | RTGS | IMPS | UPI |
|---------|------|------|------|-----|
| Speed | 30min-2hr | Instant | Instant | Instant |
| Min | ₹1 | ₹2L | ₹1 | ₹1 |
| Max | Unlimited | Unlimited | ₹5L | ₹1L |
| Charges | Free | Free | Paid | Free |
| 24x7 | Yes | Yes | Yes | Yes |

**Which to Use:**
| Scenario | Best Option |
|----------|-------------|
| Large amount (>₹2L) | RTGS |
| Regular transfers | NEFT |
| Urgent small amount | IMPS/UPI |
| Merchant payment | UPI |
| Salary transfer | NEFT |
| EMI payment | NEFT/IMPS |
| P2P transfers | UPI |

**Required Details for Transfer:**
\`\`\`
1. Beneficiary Name
2. Bank Account Number
3. IFSC Code
4. Bank Name & Branch
5. Transfer Amount
\`\`\`

**How to Find IFSC:**
- Printed on cheque book
- On bank passbook
- Bank website
- RBI website search`,
    order: 2,
    tags: ['neft', 'rtgs', 'imps', 'upi', 'fund-transfer', 'online-banking'],
    helpfulCount: 5678,
    viewCount: 89012,
    isPopular: true,
    relatedFaqIds: ['faq-bb-001', 'faq-bb-003', 'faq-db-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bb-003',
    categoryId: 'cat-banking-basics',
    question: 'What is IFSC code and how to find it?',
    answer: `IFSC (Indian Financial System Code) is a unique 11-character alphanumeric code for identifying bank branches:

**IFSC Code Structure:**
\`\`\`
HDFC0001234
│  │    │
│  │    └── Branch Code (Last 6 digits)
│  └─────── Zero (5th character - reserved)
└────────── Bank Code (First 4 letters)

Example: SBIN0001234
SBIN = State Bank of India
0    = Reserved character
001234 = Branch identifier
\`\`\`

**Why IFSC is Important:**
- Required for NEFT/RTGS/IMPS transfers
- Identifies exact bank branch
- Ensures accurate fund routing
- Mandatory for online transactions

**How to Find IFSC Code:**

**1. Cheque Book:**
- Printed at bottom of cheque leaf
- Usually next to MICR code

**2. Passbook:**
- On first page with account details
- Sometimes on each page footer

**3. Bank Website:**
- Login to net banking
- Account details section
- Branch locator tool

**4. RBI Website:**
- Visit rbi.org.in
- IFSC/MICR search tool
- Search by bank and branch

**5. Third-Party Sites:**
- ifsccode.com
- bankifsccode.com
- Google search "IFSC [bank name] [branch]"

**IFSC vs MICR:**
| Feature | IFSC | MICR |
|---------|------|------|
| Length | 11 characters | 9 digits |
| Format | Alphanumeric | Numeric only |
| Used For | Electronic transfers | Cheque processing |
| Location | Top of cheque | Bottom of cheque |

**Common Bank IFSC Prefixes:**
| Bank | IFSC Prefix |
|------|-------------|
| State Bank of India | SBIN |
| HDFC Bank | HDFC |
| ICICI Bank | ICIC |
| Axis Bank | UTIB |
| Bank of Baroda | BARB |
| Punjab National Bank | PUNB |
| Kotak Mahindra | KKBK |
| Yes Bank | YESB |
| IDBI Bank | IBKL |
| Canara Bank | CNRB |

**What If Wrong IFSC Used:**
- Transfer will fail
- Amount returned (may take 1-7 days)
- No charges for failed transfer
- Re-initiate with correct IFSC`,
    order: 3,
    tags: ['ifsc', 'bank-code', 'fund-transfer', 'micr', 'branch-code'],
    helpfulCount: 4321,
    viewCount: 56780,
    isPopular: true,
    relatedFaqIds: ['faq-bb-002', 'faq-bb-004', 'faq-db-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-bb-004',
    categoryId: 'cat-banking-basics',
    question: 'What is Repo Rate and how does it affect loan interest rates?',
    answer: `Repo Rate is the rate at which RBI lends money to commercial banks. It directly impacts your loan interest rates:

**Understanding Repo Rate:**
\`\`\`
Reserve Bank of India (RBI)
        │
        │ Lends at Repo Rate
        ↓
Commercial Banks (SBI, HDFC, etc.)
        │
        │ Add their margin
        ↓
Your Loan Interest Rate
\`\`\`

**Current Key Rates (2024):**
| Rate | Current Level | Impact |
|------|---------------|--------|
| Repo Rate | 6.50% | Base for lending |
| Reverse Repo | 3.35% | Banks deposit excess |
| CRR | 4.50% | Cash reserve |
| SLR | 18% | Liquid assets |
| Bank Rate | 6.75% | Long-term lending |

**How Repo Rate Affects Loans:**
| Repo Rate Change | Effect on Loans |
|------------------|-----------------|
| Rate Increases | EMIs increase, loans costlier |
| Rate Decreases | EMIs decrease, loans cheaper |
| Rate Unchanged | Stability in EMIs |

**Loan Interest Rate Linkages:**
| Benchmark | Description |
|-----------|-------------|
| **EBLR** | External Benchmark Linked Rate (Repo + spread) |
| **MCLR** | Marginal Cost of Funds Lending Rate |
| **Base Rate** | Old system, being phased out |
| **BPLR** | Very old, discontinued |

**EBLR Calculation:**
\`\`\`
Your Interest Rate = Repo Rate + Bank Spread + Risk Premium

Example:
Repo Rate: 6.50%
Bank Spread: 2.25%
Risk Premium: 0.25%
Your Rate: 9.00%
\`\`\`

**Impact on Different Loans:**
| Loan Type | Rate Linkage | Transmission |
|-----------|--------------|--------------|
| Home Loan | EBLR (mostly) | Quick |
| Personal Loan | MCLR/Fixed | Slow |
| Car Loan | Fixed/MCLR | Medium |
| Business Loan | MCLR/EBLR | Quick |

**RBI Rate Decision Factors:**
1. **Inflation** - High inflation → Higher repo
2. **GDP Growth** - Low growth → Lower repo
3. **Global rates** - Fed rates influence
4. **Rupee value** - Weak rupee → Higher repo
5. **Liquidity** - Too much money → Higher repo

**EMI Impact Example:**
\`\`\`
Home Loan: ₹50 lakhs, 20 years

At 8.5%: EMI = ₹43,391
At 9.0%: EMI = ₹44,986 (+₹1,595/month)
At 9.5%: EMI = ₹46,607 (+₹3,216/month)
\`\`\`

**Tips for Borrowers:**
- Choose EBLR-linked loans for faster rate cuts
- Lock in fixed rates when repo is low
- Monitor RBI announcements (bi-monthly)
- Consider refinancing when rates drop`,
    order: 4,
    tags: ['repo-rate', 'rbi', 'interest-rate', 'eblr', 'mclr', 'monetary-policy'],
    helpfulCount: 3876,
    viewCount: 52340,
    isPopular: true,
    relatedFaqIds: ['faq-bb-002', 'faq-ir-001', 'faq-hl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // CREDIT SCORE FAQs
  // ============================================================================
  {
    id: 'faq-cs-003',
    categoryId: 'cat-credit-score',
    question: 'How to check CIBIL score for free and understand the report?',
    answer: `You can check your CIBIL score for free and understanding the report helps improve it:

**Free CIBIL Score Check Methods:**
| Method | Frequency | Details |
|--------|-----------|---------|
| CIBIL Official | Once/year free | Full report |
| OneScore App | Monthly | Score + report |
| Paytm | Monthly | Score only |
| Paisabazaar | Monthly | Score + report |
| BankBazaar | Monthly | Score + basic |
| Bank Apps | Varies | If offered |

**Step-by-Step CIBIL Check:**
\`\`\`
1. Visit mycibil.com
       ↓
2. Click "Get Free CIBIL Score"
       ↓
3. Enter PAN & personal details
       ↓
4. Verify with OTP
       ↓
5. Complete authentication
       ↓
6. View score & report
\`\`\`

**Understanding CIBIL Report Sections:**

**1. Personal Information:**
- Name, DOB, PAN
- Address history
- Contact details
- Employment info

**2. Account Information:**
| Detail | Meaning |
|--------|---------|
| Account Type | Loan/Card type |
| Ownership | Single/Joint/Guarantor |
| Date Opened | Account start date |
| Date Reported | Last update |
| Sanctioned Amount | Approved limit |
| Current Balance | Outstanding |
| Amount Overdue | If any default |
| DPD | Days Past Due |

**3. Days Past Due (DPD) Codes:**
| Code | Meaning |
|------|---------|
| STD | Standard (no dues) |
| 000 | Paid on time |
| XXX | No payment due |
| 030 | 30 days late |
| 060 | 60 days late |
| 090+ | 90+ days (serious) |

**4. Enquiry Section:**
- Lists all loan applications
- Hard enquiries impact score
- Recent enquiries show desperation

**Red Flags to Look For:**
- Multiple 90+ DPD entries
- Written-off accounts
- Settled accounts
- Too many enquiries
- Unknown accounts (fraud?)

**CIBIL Score Ranges:**
| Range | Rating | Loan Approval |
|-------|--------|---------------|
| 750-900 | Excellent | Easy, best rates |
| 700-749 | Good | Likely approval |
| 650-699 | Fair | May get approved |
| 550-649 | Poor | Difficult |
| Below 550 | Bad | Very unlikely |

**Disputing Errors:**
1. Identify incorrect information
2. File dispute on CIBIL website
3. Provide supporting documents
4. CIBIL investigates (30 days)
5. Correction made if valid`,
    order: 3,
    tags: ['cibil-check', 'free-cibil', 'credit-report', 'dpd', 'cibil-score'],
    helpfulCount: 5678,
    viewCount: 78900,
    isPopular: true,
    relatedFaqIds: ['faq-cs-001', 'faq-cs-002', 'faq-cs-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cs-004',
    categoryId: 'cat-credit-score',
    question: 'What factors affect CIBIL score and how to improve it quickly?',
    answer: `Multiple factors affect your CIBIL score. Understanding them helps improve it faster:

**CIBIL Score Factors & Weightage:**
| Factor | Weightage | Impact |
|--------|-----------|--------|
| Payment History | 35% | Highest |
| Credit Utilization | 30% | Very High |
| Credit Age | 15% | Moderate |
| Credit Mix | 10% | Low |
| New Credit | 10% | Low |

**1. Payment History (35%):**
\`\`\`
On-time payments → Score increases
Late payments → Score decreases

Impact of Late Payment:
30 days late: -50 to -80 points
60 days late: -80 to -120 points
90 days late: -120 to -150 points
Written-off: -150 to -200 points
\`\`\`

**2. Credit Utilization (30%):**
\`\`\`
Ideal Utilization: Below 30%

Credit Limit: ₹1,00,000
Ideal Usage: ₹30,000 or less

High utilization (>80%): -50 to -100 points
\`\`\`

**3. Credit Age (15%):**
| Age of Oldest Account | Impact |
|----------------------|--------|
| 10+ years | Excellent |
| 5-10 years | Good |
| 2-5 years | Average |
| Less than 2 years | Poor |

**4. Credit Mix (10%):**
\`\`\`
Good Mix: Secured + Unsecured

Examples of Secured: Home Loan, Car Loan, Gold Loan
Examples of Unsecured: Personal Loan, Credit Card

Having only credit cards = Poor mix
\`\`\`

**5. New Credit Enquiries (10%):**
| Enquiries in 6 months | Impact |
|----------------------|--------|
| 0-2 | No impact |
| 3-5 | -10 to -30 points |
| 6+ | -30 to -50 points |

**Quick Improvement Strategies:**

**Immediate (1-2 months):**
| Action | Impact | Time |
|--------|--------|------|
| Pay overdue immediately | +20-50 | 30 days |
| Reduce CC utilization | +10-30 | 30 days |
| Get errors corrected | +20-100 | 30-45 days |

**Short-term (3-6 months):**
| Action | Impact | Time |
|--------|--------|------|
| Maintain 100% on-time | +30-50 | 3 months |
| Keep utilization <30% | +20-40 | 3 months |
| Become authorized user | +10-30 | 3 months |

**Long-term (6-12 months):**
| Action | Impact | Time |
|--------|--------|------|
| Build payment streak | +50-100 | 6-12 months |
| Increase credit age | +20-50 | 12+ months |
| Diversify credit mix | +20-30 | 6-12 months |

**What NOT to Do:**
✗ Close old credit cards
✗ Apply for multiple loans
✗ Max out credit limits
✗ Skip EMI even once
✗ Be guarantor for risky borrowers

**CIBIL Score Building Timeline:**
\`\`\`
Month 1-3: Clear dues, fix errors
Month 3-6: Build on-time history
Month 6-12: Score stabilizes, improves
Year 2+: Excellent score possible
\`\`\``,
    order: 4,
    tags: ['improve-cibil', 'credit-factors', 'payment-history', 'credit-utilization'],
    helpfulCount: 6789,
    viewCount: 89012,
    isPopular: true,
    relatedFaqIds: ['faq-cs-001', 'faq-cs-002', 'faq-cs-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // DOCUMENTATION FAQs
  // ============================================================================
  {
    id: 'faq-doc-001',
    categoryId: 'cat-documentation',
    question: 'What is KYC and why is it mandatory for loans?',
    answer: `KYC (Know Your Customer) is a regulatory requirement for financial institutions to verify customer identity:

**What is KYC:**
- Process to verify identity of customers
- Mandated by RBI for all financial services
- Prevents money laundering & fraud
- Required for loans, bank accounts, insurance

**KYC Components:**
| Component | Purpose |
|-----------|---------|
| Identity Proof | Verify who you are |
| Address Proof | Confirm residence |
| Photo | Visual identification |
| Signature | Verification sample |

**Acceptable KYC Documents:**

**Identity Proof (Any One):**
| Document | Details |
|----------|---------|
| PAN Card | Mandatory for loans |
| Aadhaar Card | Most preferred |
| Passport | Valid passport |
| Voter ID | Electoral card |
| Driving License | Valid DL |

**Address Proof (Any One):**
| Document | Validity |
|----------|----------|
| Aadhaar | Current address |
| Passport | Current address |
| Utility Bill | Last 3 months |
| Bank Statement | Last 3 months |
| Rental Agreement | Registered preferred |

**Types of KYC:**

**1. In-Person Verification (IPV):**
\`\`\`
Physical visit by bank representative
         ↓
Original documents verified
         ↓
Photo and signature captured
         ↓
Form signed in presence
\`\`\`

**2. Video KYC (V-KYC):**
\`\`\`
Video call scheduled
         ↓
Show original documents
         ↓
OTP verification
         ↓
Live photo captured
         ↓
KYC completed online
\`\`\`

**3. Aadhaar-based eKYC:**
\`\`\`
Enter Aadhaar number
         ↓
OTP sent to linked mobile
         ↓
Details fetched from UIDAI
         ↓
Digital signature
\`\`\`

**4. CKYC (Central KYC):**
- One-time KYC registration
- 14-digit KYC Identifier (KIN)
- Shared across financial institutions
- No repeat documentation

**Why KYC is Important:**
| For Customer | For Lender |
|--------------|------------|
| Secure transactions | Verify identity |
| Fraud protection | Regulatory compliance |
| Access to services | Risk assessment |
| Legal protection | Prevent money laundering |

**KYC Rejection Reasons:**
- Blurred/unclear documents
- Expired documents
- Name mismatch
- Address not matching
- Fake documents detected`,
    order: 1,
    tags: ['kyc', 'documentation', 'identity-proof', 'address-proof', 'video-kyc'],
    helpfulCount: 4567,
    viewCount: 67890,
    isPopular: true,
    relatedFaqIds: ['faq-doc-002', 'faq-doc-003', 'faq-pl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-doc-002',
    categoryId: 'cat-documentation',
    question: 'What income documents are required for loan application?',
    answer: `Income documentation requirements vary based on employment type:

**For Salaried Employees:**

**Basic Documents:**
| Document | Requirement | Purpose |
|----------|-------------|---------|
| Salary Slips | Last 3-6 months | Current income proof |
| Bank Statement | Last 6-12 months | Salary credit verification |
| Form 16 | Last 2 years | IT declaration |
| Appointment Letter | Current job | Employment verification |

**Additional Documents:**
| Document | When Required |
|----------|---------------|
| Bonus/Incentive Letter | If part of income |
| Increment Letter | Recent salary increase |
| Employment Certificate | Some lenders |
| Offer Letter | Recently joined |

**For Self-Employed Professionals:**

**Basic Documents:**
| Document | Requirement | Purpose |
|----------|-------------|---------|
| ITR | Last 3 years | Income declaration |
| Bank Statement | Last 12-24 months | Cash flow analysis |
| Professional Registration | Current | Practice proof |
| Office Proof | Current | Business existence |

**Profession-Specific:**
| Profession | Additional Document |
|------------|---------------------|
| Doctor | Medical registration |
| CA/CS | ICAI/ICSI membership |
| Lawyer | Bar Council certificate |
| Architect | COA registration |

**For Self-Employed Business:**

**Basic Documents:**
| Document | Requirement |
|----------|-------------|
| ITR with Computation | Last 3 years |
| Balance Sheet | Last 3 years (audited) |
| P&L Statement | Last 3 years |
| Bank Statement | Last 12-24 months |
| GST Returns | Last 12-24 months |

**Business Proof:**
| Document | Purpose |
|----------|---------|
| GST Registration | Business legitimacy |
| Shop Act License | Retail businesses |
| MSME Registration | Small businesses |
| Partnership Deed | Partnership firms |
| MOA/AOA | Companies |
| Trade License | Manufacturing |

**Income Calculation Methods:**

**Salaried:**
\`\`\`
Gross Salary (per bank statement)
- Income Tax
- PF Deduction
= Net Monthly Income

Eligible Loan = Net Income × 60 × FOIR Factor
\`\`\`

**Self-Employed:**
\`\`\`
ITR Method:
Average of 3 years' income

Cash Profit Method:
Net Profit + Depreciation + Director Salary

Banking Method:
Average monthly bank credits
\`\`\`

**Common Document Issues:**
| Issue | Solution |
|-------|----------|
| Cash salary | Get salary account |
| ITR not filed | File before applying |
| Business loss shown | Wait for profitable year |
| Multiple employments | Combine income proof |`,
    order: 2,
    tags: ['income-proof', 'salary-slip', 'itr', 'bank-statement', 'form-16'],
    helpfulCount: 5432,
    viewCount: 72340,
    isPopular: true,
    relatedFaqIds: ['faq-doc-001', 'faq-doc-003', 'faq-pl-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // INSURANCE FAQs
  // ============================================================================
  {
    id: 'faq-ins-001',
    categoryId: 'cat-insurance',
    question: 'What is loan protection insurance and is it mandatory?',
    answer: `Loan Protection Insurance covers loan repayment in case of unforeseen events:

**What is Loan Protection Insurance:**
- Insurance that pays off loan if borrower dies/disabled
- Premium can be single or regular
- Coverage equals outstanding loan amount
- Also called Credit Life Insurance

**Types of Loan Insurance:**

**1. Credit Life Insurance:**
| Feature | Details |
|---------|---------|
| Coverage | Death of borrower |
| Payout | Outstanding loan amount |
| Beneficiary | Lender (loan cleared) |
| Premium | 0.3% - 0.8% of loan |

**2. Loan Cover Term Insurance:**
| Feature | Details |
|---------|---------|
| Coverage | Death + Critical illness |
| Payout | To family (not lender) |
| Flexibility | Family can use funds |
| Premium | Based on age/term |

**3. EMI Protection:**
| Feature | Details |
|---------|---------|
| Coverage | Job loss, disability |
| Payout | EMIs for fixed period |
| Duration | Usually 3-6 EMIs |
| Premium | Higher than credit life |

**Is It Mandatory?**
\`\`\`
LEGALLY: Not mandatory
         ↓
RBI Guidelines: Cannot be forced
         ↓
PRACTICALLY: Strongly recommended
         ↓
Some Lenders: Required for approval
\`\`\`

**RBI Guidelines:**
- Insurance cannot be mandatory
- Premium cannot be bundled in loan
- Customer must have choice
- Separate consent required

**When Insurance is Required:**
| Loan Type | Insurance Need |
|-----------|----------------|
| Home Loan | Strongly recommended |
| Personal Loan | Optional |
| Business Loan | Often required |
| Gold Loan | Usually not needed |
| Education Loan | Recommended |

**Cost of Loan Insurance:**
| Loan Amount | Insurance Type | Approx Premium |
|-------------|----------------|----------------|
| ₹50 lakhs | Credit Life | ₹15,000-40,000 |
| ₹50 lakhs | Term Insurance | ₹5,000-10,000/year |
| ₹10 lakhs | Credit Life | ₹3,000-8,000 |

**Benefits of Loan Insurance:**
| Benefit | Description |
|---------|-------------|
| Family Protection | Loan burden doesn't pass |
| Peace of Mind | Financial security |
| Lower Rate | Some lenders offer |
| Tax Benefit | Under 80C/80D |

**Alternatives to Bank Insurance:**
1. Existing term insurance (increase cover)
2. Standalone term policy
3. Group insurance through employer
4. Family floater health insurance

**Tips:**
- Compare bank insurance with market rates
- Check if existing policies cover loan
- Opt for term insurance over credit life
- Can decline bank insurance legally`,
    order: 1,
    tags: ['loan-insurance', 'credit-life', 'protection', 'mandatory-insurance'],
    helpfulCount: 3456,
    viewCount: 48900,
    isPopular: true,
    relatedFaqIds: ['faq-ins-002', 'faq-hl-001', 'faq-pl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ins-002',
    categoryId: 'cat-insurance',
    question: 'What property insurance is required for home loan?',
    answer: `Property insurance protects your home against various risks and is required for home loans:

**Types of Property Insurance:**

**1. Fire Insurance:**
| Coverage | Details |
|----------|---------|
| Fire damage | Full structure |
| Lightning | Electrical damage |
| Explosion | Gas/pressure |
| Impact damage | Aircraft/vehicle |

**2. All Risk/Comprehensive:**
| Coverage | Details |
|----------|---------|
| Fire + Natural disasters | Floods, earthquakes |
| Burglary | Theft protection |
| Terrorism | In select policies |
| Accidental damage | Broader coverage |

**3. Home Contents Insurance:**
| Coverage | Details |
|----------|---------|
| Furniture | Fire/theft |
| Electronics | Damage/theft |
| Valuables | Jewelry, art |
| Personal items | Clothes, etc. |

**Home Loan Insurance Requirements:**

**Mandatory Coverage:**
\`\`\`
Building/Structure Insurance
        ↓
Sum Assured = Loan Amount (at minimum)
        ↓
Lender listed as "Loss Payee"
        ↓
Policy term = Loan term
\`\`\`

**Coverage Amount Calculation:**
| Method | Formula |
|--------|---------|
| Reconstruction | ₹/sq.ft × Built-up area |
| Market Value | Property value - Land value |
| Loan Amount | Outstanding principal |

**Insurance Providers:**

**Bank Insurance:**
| Bank | Insurance Partner |
|------|-------------------|
| SBI | SBI General |
| HDFC | HDFC Ergo |
| ICICI | ICICI Lombard |
| Axis | Tata AIG |

**Standalone Insurers:**
- New India Assurance
- ICICI Lombard
- Bajaj Allianz
- HDFC Ergo
- Tata AIG

**Premium Calculation:**
\`\`\`
Basic Premium = Sum Insured × Rate

Rates (approx):
Fire only: 0.05% - 0.10%
Comprehensive: 0.15% - 0.25%
All Risk: 0.25% - 0.40%
\`\`\`

**Example Premium:**
| Property Value | Coverage Type | Annual Premium |
|----------------|---------------|----------------|
| ₹50 lakhs | Fire | ₹2,500 - ₹5,000 |
| ₹50 lakhs | Comprehensive | ₹7,500 - ₹12,500 |
| ₹50 lakhs | All Risk | ₹12,500 - ₹20,000 |

**Claim Process:**
1. Inform insurance company (24-48 hours)
2. File FIR if theft/vandalism
3. Submit claim form with photos
4. Surveyor assesses damage
5. Claim amount determined
6. Payout to lender/you

**Important Considerations:**
- Keep policy active throughout loan
- Update sum insured if property value increases
- Inform lender of any changes
- Keep receipts for contents`,
    order: 2,
    tags: ['property-insurance', 'fire-insurance', 'home-loan-insurance', 'building-insurance'],
    helpfulCount: 2876,
    viewCount: 38900,
    isPopular: true,
    relatedFaqIds: ['faq-ins-001', 'faq-hl-001', 'faq-hl-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // TAXATION FAQs
  // ============================================================================
  {
    id: 'faq-tax-001',
    categoryId: 'cat-taxation',
    question: 'What are tax benefits on home loan under Section 24 and 80C?',
    answer: `Home loans offer significant tax benefits under multiple sections of the Income Tax Act:

**Section 24(b) - Interest Deduction:**
| Scenario | Maximum Deduction |
|----------|-------------------|
| Self-occupied property | ₹2,00,000 per year |
| Let-out property | No limit |
| Under construction | ₹30,000 (pre-construction) |

**Conditions for Section 24:**
\`\`\`
Self-Occupied:
- Loan for purchase/construction
- Construction completed within 5 years
- Possession taken
- Certificate from lender

Let-Out:
- Entire interest deductible
- Net rental income taxed
- No time limit for construction
\`\`\`

**Section 80C - Principal Repayment:**
| Deduction | Limit |
|-----------|-------|
| Home loan principal | Up to ₹1,50,000 |
| Stamp duty & registration | In year of purchase |
| Combined with other 80C | Overall ₹1,50,000 cap |

**Section 80EE - Additional Interest (First-time buyers):**
| Criteria | Limit |
|----------|-------|
| First home purchase | ₹50,000 additional |
| Loan sanctioned: Apr 2016 - Mar 2017 | One-time benefit |
| Loan amount: Up to ₹35 lakhs | Property up to ₹50 lakhs |

**Section 80EEA - Affordable Housing:**
| Criteria | Limit |
|----------|-------|
| Stamp value: Up to ₹45 lakhs | ₹1,50,000 additional |
| First-time buyer | Beyond Section 24 |
| Loan sanctioned: Apr 2019 - Mar 2022 | Extended benefit |

**Total Benefits Example:**
\`\`\`
Home Loan: ₹50 lakhs, 20 years, 8.5%
Annual EMI: ₹5,20,692

Year 1 Breakdown:
Principal: ₹96,000 → Section 80C
Interest: ₹4,24,692 → Section 24 (₹2L max)

Tax Savings (30% bracket):
80C: ₹96,000 × 30% = ₹28,800
Section 24: ₹2,00,000 × 30% = ₹60,000
Total Saving: ₹88,800/year
\`\`\`

**Joint Home Loan Benefits:**
| Aspect | Benefit |
|--------|---------|
| Section 24 | Each co-owner claims ₹2L |
| Section 80C | Each claims ₹1.5L |
| Total possible | ₹7L deduction for couple |

**Conditions for Joint Benefits:**
- Both must be co-owners
- Both must be co-borrowers
- EMI paid from respective accounts
- Claim in proportion to ownership

**Under Construction Property:**
\`\`\`
During Construction:
- No tax benefit

After Possession:
- Pre-EMI interest (5 equal installments)
- Maximum ₹30,000/year for self-occupied
- Full interest for let-out
\`\`\`

**Documents for Tax Claim:**
- Home loan interest certificate
- Property possession letter
- Registration documents
- Payment receipts`,
    order: 1,
    tags: ['home-loan-tax', 'section-24', 'section-80c', 'tax-benefit', 'interest-deduction'],
    helpfulCount: 6789,
    viewCount: 94560,
    isPopular: true,
    relatedFaqIds: ['faq-tax-002', 'faq-hl-001', 'faq-hl-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-tax-002',
    categoryId: 'cat-taxation',
    question: 'Are there tax benefits on Personal Loan, Car Loan, and Education Loan?',
    answer: `Tax benefits vary significantly across different loan types:

**Personal Loan Tax Benefits:**

**Generally NO direct tax benefit, BUT:**
| Purpose | Tax Treatment |
|---------|---------------|
| Home renovation | Interest under Section 24 |
| Business use | Interest as business expense |
| Education | No benefit |
| Medical/Wedding | No benefit |

**Example - Home Renovation:**
\`\`\`
Personal Loan for renovation: ₹5 lakhs
Interest paid: ₹50,000/year
Deduction: Under Section 24 (max ₹30,000)
\`\`\`

**Car Loan Tax Benefits:**

**For Individuals: NO benefit**
| Scenario | Treatment |
|----------|-----------|
| Personal use | No deduction |
| Interest paid | Not deductible |
| Principal paid | Not deductible |

**For Business:**
| Scenario | Treatment |
|----------|-----------|
| Business vehicle | Interest = Business expense |
| Depreciation | 15% p.a. on vehicle |
| Running expenses | Deductible |

**Education Loan Tax Benefits:**

**Section 80E - Interest Deduction:**
| Feature | Details |
|---------|---------|
| Deduction | Interest only (no principal) |
| Limit | No upper limit |
| Duration | 8 years from repayment start |
| Eligible | Higher education in India/abroad |

**Eligibility for 80E:**
\`\`\`
Who can claim:
- Taxpayer for self
- Taxpayer for spouse
- Taxpayer for children
- Taxpayer for legal ward

NOT grandchildren/siblings
\`\`\`

**Eligible Courses:**
- Graduate/Post-graduate
- Professional courses (Engineering, Medical, MBA)
- Vocational courses (approved)
- Study abroad (recognized institution)

**Section 80E Example:**
\`\`\`
Education Loan: ₹10 lakhs
Annual Interest: ₹80,000
Tax Bracket: 30%

Tax Saving: ₹80,000 × 30% = ₹24,000/year
Benefit Duration: 8 years
Total Potential Saving: Up to ₹1,92,000
\`\`\`

**Comparison Table:**
| Loan Type | Interest Benefit | Principal Benefit |
|-----------|------------------|-------------------|
| Home Loan | ₹2L (Sec 24) | ₹1.5L (80C) |
| Education Loan | Unlimited (Sec 80E) | None |
| Personal Loan | Only if for home | None |
| Car Loan (Personal) | None | None |
| Car Loan (Business) | Full deduction | Depreciation |
| Gold Loan | None (personal) | None |
| Business Loan | Full deduction | None |

**Business Loan Tax Treatment:**
\`\`\`
Interest Paid = Business Expense
           ↓
Reduces Taxable Profit
           ↓
Lower Tax Liability
\`\`\`

**Documentation Required:**
| Loan | Documents for Tax |
|------|-------------------|
| Home | Interest certificate, possession |
| Education | Interest certificate, enrollment |
| Business | Loan statement, accounts |`,
    order: 2,
    tags: ['education-loan-tax', 'section-80e', 'car-loan-tax', 'personal-loan-tax'],
    helpfulCount: 4567,
    viewCount: 62340,
    isPopular: true,
    relatedFaqIds: ['faq-tax-001', 'faq-el-001', 'faq-pl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // REGULATORY FAQs
  // ============================================================================
  {
    id: 'faq-reg-001',
    categoryId: 'cat-regulatory',
    question: 'What is the difference between Bank and NBFC for loans?',
    answer: `Understanding the difference helps choose the right lender:

**What is a Bank:**
- Licensed by RBI under Banking Regulation Act
- Can accept deposits (savings/current)
- Issues cheque books
- Part of payment system
- Higher capital requirements

**What is an NBFC:**
- Registered with RBI under RBI Act
- Cannot accept demand deposits
- Focuses on lending activities
- Specialized loan products
- Flexible lending criteria

**Key Differences:**

| Aspect | Bank | NBFC |
|--------|------|------|
| Deposits | Accepts savings/current | Cannot accept demand deposits |
| Interest Rates | Generally lower | Usually higher |
| Processing | More documentation | Faster, flexible |
| Eligibility | Stricter criteria | More lenient |
| Regulation | Stringent | Moderate |
| Reach | Wide branch network | Select locations |
| Digital | Traditional + digital | Often digital-first |

**Interest Rate Comparison:**
| Loan Type | Bank Rate | NBFC Rate |
|-----------|-----------|-----------|
| Home Loan | 8.5% - 10% | 9% - 12% |
| Personal Loan | 10.5% - 16% | 12% - 24% |
| Business Loan | 11% - 15% | 14% - 24% |
| Car Loan | 8% - 12% | 9% - 15% |
| Gold Loan | 9% - 12% | 10% - 24% |

**Processing Speed:**
| Loan Type | Bank | NBFC |
|-----------|------|------|
| Personal Loan | 3-7 days | 1-3 days |
| Home Loan | 7-21 days | 5-15 days |
| Business Loan | 15-30 days | 7-15 days |
| Gold Loan | Same day | Instant |

**When to Choose Bank:**
✓ Lower interest rates important
✓ Long-term loans (home loan)
✓ Already have relationship
✓ Good credit score (750+)
✓ Complete documentation available
✓ Not in hurry

**When to Choose NBFC:**
✓ Need faster processing
✓ Lower credit score (600-700)
✓ Less documentation available
✓ Specialized loan needs
✓ Bank rejected application
✓ Flexible repayment needed

**Types of NBFCs:**
| Type | Focus Area |
|------|------------|
| NBFC-ND-SI | Large, systemically important |
| HFC | Housing Finance (HDFC, LIC HFL) |
| NBFC-MFI | Microfinance |
| NBFC-Factor | Bill discounting |
| Investment NBFC | Securities, investments |

**Major NBFCs in India:**
| NBFC | Specialization |
|------|----------------|
| Bajaj Finance | Consumer, SME loans |
| Tata Capital | All loan types |
| L&T Finance | Infrastructure, retail |
| Mahindra Finance | Vehicle, rural |
| Muthoot/Manappuram | Gold loans |
| HDFC Ltd | Housing (now merged) |
| Poonawalla Fincorp | Personal, business |
| IIFL | Multiple segments |

**Safety Considerations:**
| Factor | Bank | NBFC |
|--------|------|------|
| Deposit Insurance | ₹5 lakh (DICGC) | NA |
| RBI Supervision | Direct | Through regulations |
| Stability | Generally high | Varies |
| Resolution | Government support | Limited support |`,
    order: 1,
    tags: ['bank-vs-nbfc', 'nbfc', 'financial-institution', 'lending-company'],
    helpfulCount: 4321,
    viewCount: 58760,
    isPopular: true,
    relatedFaqIds: ['faq-reg-002', 'faq-bb-001', 'faq-pl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-reg-002',
    categoryId: 'cat-regulatory',
    question: 'What are RBI guidelines for loan recovery and fair practices?',
    answer: `RBI has strict guidelines to protect borrowers from harassment during loan recovery:

**Fair Practices Code (FPC):**
All lenders must follow RBI's Fair Practices Code:

**Loan Sanctioning:**
| Requirement | Details |
|-------------|---------|
| Loan terms in writing | Before disbursement |
| Language | Vernacular if requested |
| All charges disclosed | Processing, prepayment, late |
| Right to decline insurance | Cannot force |
| Acknowledgment | All applications |

**Interest Rate Guidelines:**
\`\`\`
Annualized Rate Disclosure:
- All charges included
- Interest calculation method clear
- Reset period specified
- EBLR linkage transparent
\`\`\`

**Recovery Practices - What Lenders CAN Do:**
| Permitted | Details |
|-----------|---------|
| Call during business hours | 8 AM to 7 PM |
| Send written reminders | Polite language |
| Visit home/office | During reasonable hours |
| Engage recovery agents | Authorized only |
| Legal action | Through proper channel |
| Report to CIBIL | After due process |

**What Lenders CANNOT Do:**
| Prohibited | Penalty |
|------------|---------|
| Calls before 8 AM/after 7 PM | ₹5 lakh fine |
| Threatening/abusive language | License action |
| Public shaming | Heavy penalty |
| Physical harassment | Criminal case |
| Contacting relatives/employer | Strict action |
| Withholding property illegally | Legal violation |
| Unauthorized recovery agents | Heavy fine |

**Recovery Agent Guidelines:**
\`\`\`
Agents Must:
✓ Carry authorization letter
✓ Identify themselves
✓ Follow timing rules
✓ Behave professionally
✓ Issue receipts for collection

Agents Must NOT:
✗ Use physical force
✗ Use abusive language
✗ Damage property
✗ Impersonate officials
✗ Collect unauthorized amounts
\`\`\`

**Borrower Rights:**

**During Recovery:**
| Right | How to Exercise |
|-------|-----------------|
| Know agent identity | Ask for authorization |
| Record harassment | Keep evidence |
| Complain to RBI | Banking Ombudsman |
| Police complaint | If harassment/threat |
| Legal action | Consumer court/civil |

**Grievance Redressal:**
\`\`\`
Step 1: Complain to lender (in writing)
        ↓ (30 days wait)
Step 2: Escalate to higher authority
        ↓ (30 days wait)
Step 3: Banking Ombudsman
        ↓ (if unresolved)
Step 4: RBI complaint
        ↓
Step 5: Consumer court
\`\`\`

**SARFAESI Act Guidelines:**
| Stage | Borrower Rights |
|-------|-----------------|
| Notice | 60 days to respond |
| Possession | Can challenge in DRT |
| Sale | Right to redeem before sale |
| Surplus | Entitled to excess amount |

**Penalties for Violators:**
| Violation | Consequence |
|-----------|-------------|
| Minor breach | Warning, fine |
| Repeated breach | Heavy penalty |
| Serious harassment | License cancellation |
| Physical assault | Criminal prosecution |

**How to File Complaint:**
1. **RBI CMS Portal:** cms.rbi.org.in
2. **Banking Ombudsman:** Respective region
3. **Consumer Helpline:** 1800-11-4000
4. **Police:** For criminal harassment`,
    order: 2,
    tags: ['rbi-guidelines', 'loan-recovery', 'fair-practices', 'borrower-rights', 'harassment'],
    helpfulCount: 5678,
    viewCount: 76540,
    isPopular: true,
    relatedFaqIds: ['faq-reg-001', 'faq-ml-005', 'faq-cg-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // DIGITAL BANKING FAQs
  // ============================================================================
  {
    id: 'faq-db-001',
    categoryId: 'cat-digital-banking',
    question: 'What is UPI and how to use it for loan EMI payments?',
    answer: `UPI (Unified Payments Interface) enables instant bank transfers and can be used for EMI payments:

**What is UPI:**
- Real-time payment system by NPCI
- Links bank account to mobile
- Works 24/7, 365 days
- Zero transaction charges
- Maximum limit: ₹1-5 lakhs

**Setting Up UPI:**
\`\`\`
Step 1: Download UPI app
        (BHIM, GPay, PhonePe, Paytm)
        ↓
Step 2: Link bank account
        (Mobile number must match)
        ↓
Step 3: Create UPI PIN
        (Using debit card)
        ↓
Step 4: Create UPI ID
        (yourname@bankname)
        ↓
Ready to transact!
\`\`\`

**Popular UPI Apps:**
| App | Key Feature |
|-----|-------------|
| Google Pay | Rewards, wide acceptance |
| PhonePe | Multiple use cases |
| Paytm | Wallet + UPI |
| BHIM | Government app |
| Bank Apps | Direct account access |

**UPI for EMI Payment:**

**Method 1: Direct Bank Transfer:**
\`\`\`
1. Get loan account details
2. Add lender as payee
3. Enter amount = EMI
4. Select purpose: Loan EMI
5. Enter UPI PIN
6. Keep screenshot as proof
\`\`\`

**Method 2: UPI AutoPay (NACH):**
| Step | Action |
|------|--------|
| 1 | Set up UPI mandate |
| 2 | Authorize max amount |
| 3 | Set frequency: Monthly |
| 4 | EMI debits automatically |
| 5 | Get notification each month |

**Setting Up UPI AutoPay:**
\`\`\`
1. Receive mandate request from lender
           ↓
2. Open request in UPI app
           ↓
3. Verify details (amount, frequency)
           ↓
4. Enter UPI PIN to authorize
           ↓
5. Mandate active!
\`\`\`

**UPI Transaction Limits:**
| Category | Limit |
|----------|-------|
| Standard transfer | ₹1 lakh |
| Tax payments | ₹5 lakhs |
| Capital market | ₹2 lakhs |
| Insurance premium | ₹5 lakhs |
| EMI via NACH | ₹2 lakhs |

**Benefits of UPI for EMI:**
| Benefit | Details |
|---------|---------|
| Instant confirmation | Real-time update |
| Free of charge | No transaction fee |
| 24/7 availability | Pay anytime |
| Auto-reminders | Before due date |
| Easy tracking | In-app history |

**Troubleshooting:**

**Common Issues:**
| Problem | Solution |
|---------|----------|
| Transaction failed | Check balance, retry |
| Money debited, not credited | Will reverse in 24-48hrs |
| Wrong UPI PIN | Reset through app |
| Mandate declined | Check with bank |
| Amount exceeds limit | Use NEFT/RTGS |

**Security Tips:**
- Never share UPI PIN
- Verify payee before sending
- Don't click unknown links
- Enable app lock
- Check SMS alerts regularly`,
    order: 1,
    tags: ['upi', 'digital-payment', 'emi-payment', 'autopay', 'gpay', 'phonepe'],
    helpfulCount: 5678,
    viewCount: 82340,
    isPopular: true,
    relatedFaqIds: ['faq-db-002', 'faq-db-003', 'faq-cg-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-db-002',
    categoryId: 'cat-digital-banking',
    question: 'What is Video KYC and how does digital loan application work?',
    answer: `Video KYC and digital loans have revolutionized the lending process:

**What is Video KYC (V-KYC):**
- Remote identity verification via video call
- RBI approved since 2020
- Replaces physical verification
- Instant processing possible
- Secure and tamper-proof

**Video KYC Process:**
\`\`\`
Application submitted online
           ↓
V-KYC slot scheduled
           ↓
Video call initiated
           ↓
Show original documents
           ↓
Live photo captured
           ↓
OTP verification
           ↓
GPS location recorded
           ↓
KYC completed!
\`\`\`

**V-KYC Requirements:**
| Requirement | Details |
|-------------|---------|
| Device | Smartphone/laptop with camera |
| Internet | Stable connection |
| Documents | Original Aadhaar, PAN |
| Environment | Well-lit, quiet place |
| Timing | 5-10 minutes |

**Tips for V-KYC:**
✓ Ensure good lighting
✓ Stable internet connection
✓ Keep documents ready
✓ Choose quiet environment
✓ Face camera clearly
✓ Follow agent instructions

**Digital Loan Application Process:**

**Step-by-Step:**
\`\`\`
1. Choose lender/platform
          ↓
2. Fill online application
          ↓
3. Upload documents
          ↓
4. Complete Video KYC
          ↓
5. Bank statement analysis (AA/PDF)
          ↓
6. Credit score pull
          ↓
7. Instant approval/rejection
          ↓
8. e-Agreement signing
          ↓
9. Disbursement to account
\`\`\`

**Digital Loan Platforms:**
| Platform | Loan Types | Speed |
|----------|------------|-------|
| Bank apps | All types | 1-7 days |
| PaySense | Personal | 1-2 days |
| MoneyTap | Personal, LAP | 1-3 days |
| KreditBee | Personal, small | Hours |
| Navi | Personal | Hours |
| Bajaj Finserv | Multiple | 1-2 days |

**Account Aggregator (AA) Framework:**
\`\`\`
What is AA:
- Consent-based data sharing
- Bank statements shared digitally
- Faster verification
- No manual uploads

How it works:
1. Consent requested
2. You approve
3. Data fetched from banks
4. Analysis done instantly
5. Decision in minutes
\`\`\`

**e-Signing Process:**
| Step | Description |
|------|-------------|
| 1 | Loan sanction received |
| 2 | Agreement sent digitally |
| 3 | Review terms online |
| 4 | Sign using Aadhaar OTP |
| 5 | Agreement executed |
| 6 | Disbursement processed |

**Benefits of Digital Loans:**
| Benefit | Traditional | Digital |
|---------|-------------|---------|
| Application time | Hours | Minutes |
| Documents | Physical copies | Upload/fetch |
| Verification | Branch visit | Video KYC |
| Approval time | Days/weeks | Hours/days |
| Agreement | Physical signing | e-Sign |
| Disbursement | Manual | Instant |

**Security Measures:**
- End-to-end encryption
- Aadhaar-based verification
- OTP authentication
- Geo-location tagging
- Liveness detection
- Video recording stored`,
    order: 2,
    tags: ['video-kyc', 'digital-loan', 'online-application', 'e-kyc', 'account-aggregator'],
    helpfulCount: 4567,
    viewCount: 63450,
    isPopular: true,
    relatedFaqIds: ['faq-db-001', 'faq-doc-001', 'faq-cg-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-db-003',
    categoryId: 'cat-digital-banking',
    question: 'How to check loan status and download statements online?',
    answer: `Most lenders offer digital access to loan status and documents:

**Checking Loan Status Online:**

**Through Bank Website:**
\`\`\`
1. Login to net banking
         ↓
2. Go to "Loans" section
         ↓
3. View loan dashboard
         ↓
4. Check status/details
\`\`\`

**Through Mobile App:**
\`\`\`
1. Open bank app
         ↓
2. Login with credentials
         ↓
3. Select "My Loans"
         ↓
4. View all details
\`\`\`

**Loan Dashboard Information:**
| Information | Details |
|-------------|---------|
| Outstanding principal | Current due |
| Interest accrued | Till date |
| EMI amount | Monthly payment |
| Next EMI date | Due date |
| EMIs paid | Repayment history |
| Remaining tenure | Months left |
| Prepayment amount | To close loan |

**Downloading Loan Statements:**

**Types of Statements:**
| Statement | Purpose |
|-----------|---------|
| Loan account statement | Complete history |
| Interest certificate | Tax purpose |
| EMI schedule | Payment plan |
| NOC/Closure letter | Loan completion |
| Sanction letter | Loan terms |

**Download Process:**
\`\`\`
Net Banking/App
        ↓
Loans Section
        ↓
Select loan account
        ↓
Choose statement type
        ↓
Select date range
        ↓
Download PDF
\`\`\`

**Bank-wise Access:**

**SBI:**
| Action | Path |
|--------|------|
| Status | YONO → Loans → View |
| Statement | Loans → Statement → Download |
| Certificate | e-Services → Tax Certificate |

**HDFC Bank:**
| Action | Path |
|--------|------|
| Status | NetBanking → Loan Account |
| Statement | Accounts → Loan Statement |
| Certificate | Requests → Interest Certificate |

**ICICI Bank:**
| Action | Path |
|--------|------|
| Status | iMobile → Loans |
| Statement | Loan Account → Statement |
| Certificate | Service Request → Tax Docs |

**Axis Bank:**
| Action | Path |
|--------|------|
| Status | Mobile Banking → Loans |
| Statement | Downloads → Statements |
| Certificate | E-Documents → Tax Certificate |

**Third-Party Aggregators:**
| Platform | Features |
|----------|----------|
| DigiLocker | Government docs storage |
| Finvu | Multiple bank aggregation |
| OneMoney | Account aggregator |
| Perfios | Statement analysis |

**Interest Certificate for Tax:**
\`\`\`
Certificate Contains:
- Total interest paid in FY
- Principal paid in FY
- Outstanding balance
- Lender details
- Loan account number
- Property details (home loan)
\`\`\`

**Troubleshooting:**
| Issue | Solution |
|-------|----------|
| Can't find loan | Check registered mobile |
| Statement not generating | Try different browser |
| Certificate error | Contact customer care |
| Old statement needed | Request from branch |
| Password forgot | Reset through app/website |

**Offline Alternatives:**
- Visit branch with ID proof
- Call customer care
- Email request to bank
- Written application`,
    order: 3,
    tags: ['loan-status', 'loan-statement', 'interest-certificate', 'online-banking', 'download'],
    helpfulCount: 3456,
    viewCount: 48760,
    isPopular: true,
    relatedFaqIds: ['faq-db-001', 'faq-db-002', 'faq-cg-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // INTEREST RATES FAQs
  // ============================================================================
  {
    id: 'faq-ir-001',
    categoryId: 'cat-interest-rates',
    question: 'What is the difference between flat rate and reducing balance interest?',
    answer: `Understanding interest calculation methods helps compare loan offers:

**Flat Rate Interest:**
\`\`\`
Interest calculated on original principal
throughout the loan tenure

Formula:
Total Interest = Principal × Rate × Years
EMI = (Principal + Total Interest) / Months
\`\`\`

**Reducing Balance Interest:**
\`\`\`
Interest calculated on outstanding principal
(reduces each month as you pay EMI)

Formula:
EMI = P × r × (1+r)^n / [(1+r)^n - 1]
Where: P=Principal, r=monthly rate, n=months
\`\`\`

**Comparison Example:**
\`\`\`
Loan: ₹10,00,000
Tenure: 5 years (60 months)
Rate: 10% (stated rate)

FLAT RATE:
Total Interest = 10,00,000 × 10% × 5 = ₹5,00,000
Total Payment = ₹15,00,000
EMI = ₹25,000
Effective Rate = ~18%

REDUCING BALANCE:
EMI = ₹21,247 (using formula)
Total Payment = ₹12,74,820
Total Interest = ₹2,74,820
Effective Rate = 10%
\`\`\`

**Key Differences:**
| Aspect | Flat Rate | Reducing Balance |
|--------|-----------|------------------|
| Calculation | On original principal | On outstanding |
| EMI | Higher | Lower |
| Total interest | Much higher | Lower |
| Transparency | Can be misleading | True cost |
| Common use | Vehicle loans, personal | Home loans, most banks |

**Effective Interest Rate:**
| Stated Flat Rate | Approx Reducing Rate |
|------------------|----------------------|
| 7% flat | ~13% reducing |
| 8% flat | ~15% reducing |
| 10% flat | ~18% reducing |
| 12% flat | ~22% reducing |

**How to Compare:**
\`\`\`
Always convert to reducing rate
for fair comparison

Conversion: Flat Rate × 1.8 ≈ Reducing Rate
Example: 10% flat ≈ 18% reducing
\`\`\`

**Where Each is Used:**
| Loan Type | Typical Method |
|-----------|----------------|
| Home Loan | Reducing balance |
| Personal Loan | Reducing balance |
| Car Loan (Bank) | Reducing balance |
| Car Loan (Dealer) | Often flat rate |
| Two-wheeler | Often flat rate |
| Gold Loan | Simple interest |
| Business Loan | Reducing balance |

**Red Flags:**
- Low "flat rate" advertised
- Processing fee hidden in rate
- EMI higher than expected
- No amortization provided
- Prepayment heavily penalized

**Tips:**
1. Ask for effective annual rate
2. Get amortization schedule
3. Compare total payout amount
4. Check prepayment terms
5. Read offer document carefully`,
    order: 1,
    tags: ['flat-rate', 'reducing-balance', 'interest-calculation', 'effective-rate'],
    helpfulCount: 4567,
    viewCount: 62340,
    isPopular: true,
    relatedFaqIds: ['faq-ir-002', 'faq-bb-004', 'faq-emi-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ir-002',
    categoryId: 'cat-interest-rates',
    question: 'What is EBLR, MCLR, and Base Rate - Which is better?',
    answer: `Different lending rate benchmarks have evolved over time:

**EBLR (External Benchmark Lending Rate):**
\`\`\`
Most recent system (2019+)
Linked to external benchmarks like:
- RBI Repo Rate (most common)
- 91-day T-Bill rate
- 182-day T-Bill rate
- Financial benchmark by FBIL
\`\`\`

**MCLR (Marginal Cost of Funds Lending Rate):**
\`\`\`
Introduced: April 2016
Based on: Bank's cost of funds
Reset: 6 months to 1 year
Includes: Marginal cost + operating cost + tenure premium
\`\`\`

**Base Rate:**
\`\`\`
Introduced: July 2010
Based on: Average cost of funds
Being phased out
Old loans still on this system
\`\`\`

**BPLR (Benchmark Prime Lending Rate):**
\`\`\`
Old system (pre-2010)
Discontinued
Some very old loans exist
\`\`\`

**Comparison:**
| Feature | EBLR | MCLR | Base Rate |
|---------|------|------|-----------|
| Linked to | External benchmark | Internal cost | Internal cost |
| Transparency | Highest | Medium | Low |
| Reset frequency | Usually quarterly | 6-12 months | Annual |
| Rate transmission | Fastest | Slow | Slowest |
| Benefit to borrower | Quick rate cuts | Delayed benefit | Delayed |

**How Your Rate is Calculated:**

**EBLR System:**
\`\`\`
Your Rate = Repo Rate + Spread + Risk Premium

Example (Home Loan):
Repo Rate: 6.50%
Bank Spread: 2.00%
Risk Premium: 0.25%
Your Rate: 8.75%
\`\`\`

**MCLR System:**
\`\`\`
Your Rate = MCLR + Spread

Example:
1-Year MCLR: 8.10%
Spread: 0.50%
Your Rate: 8.60%
\`\`\`

**Current Rates (2024):**
| Bank | EBLR | 1-Yr MCLR |
|------|------|-----------|
| SBI | 8.75% | 8.55% |
| HDFC | 9.00% | 8.60% |
| ICICI | 8.90% | 8.65% |
| Axis | 9.05% | 8.75% |
| PNB | 8.80% | 8.50% |

**Which is Better:**
| Scenario | Better Option | Reason |
|----------|---------------|--------|
| Rate falling | EBLR | Faster benefit |
| Rate rising | MCLR | Slower increase |
| Long tenure | EBLR | More flexibility |
| Short tenure | Either | Less difference |

**Switching Options:**
\`\`\`
Can you switch?
Old System → New System: Yes (with fees)
New System → Old System: Generally no
Within same system: Usually free

Process:
1. Apply to bank
2. Pay processing fee (0.25-0.50%)
3. New rate from next EMI
\`\`\`

**Rate Reset Impact:**
| Reset | EMI Change | Example (₹50L, 20yr) |
|-------|------------|----------------------|
| 0.25% increase | +₹750/month | ₹43,391 → ₹44,141 |
| 0.50% increase | +₹1,500/month | ₹43,391 → ₹44,891 |
| 0.25% decrease | -₹750/month | ₹43,391 → ₹42,641 |

**Tips:**
1. New loans: Always on EBLR
2. Existing MCLR: Consider switching if rates low
3. Monitor repo rate announcements
4. Check reset dates in agreement
5. Prepay when rates rise`,
    order: 2,
    tags: ['eblr', 'mclr', 'base-rate', 'lending-rate', 'repo-linked'],
    helpfulCount: 3987,
    viewCount: 54320,
    isPopular: true,
    relatedFaqIds: ['faq-ir-001', 'faq-bb-004', 'faq-hl-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // EMI & REPAYMENT FAQs
  // ============================================================================
  {
    id: 'faq-emi-001',
    categoryId: 'cat-emi-calculation',
    question: 'How is EMI calculated and what is amortization schedule?',
    answer: `Understanding EMI calculation helps plan your finances better:

**EMI Formula:**
\`\`\`
EMI = P × r × (1+r)^n / [(1+r)^n - 1]

Where:
P = Principal (loan amount)
r = Monthly interest rate (annual rate/12)
n = Number of months (tenure)
\`\`\`

**Step-by-Step Calculation:**
\`\`\`
Example:
Loan Amount: ₹10,00,000
Interest Rate: 10% per annum
Tenure: 5 years (60 months)

Step 1: Monthly rate = 10%/12 = 0.833% = 0.00833
Step 2: (1+r)^n = (1.00833)^60 = 1.6453
Step 3: EMI = 10,00,000 × 0.00833 × 1.6453
             ─────────────────────────────
                    1.6453 - 1
Step 4: EMI = ₹21,247
\`\`\`

**Online EMI Calculators:**
| Provider | URL |
|----------|-----|
| SBI | sbi.co.in/emi-calculator |
| BankBazaar | bankbazaar.com/emi-calculator |
| ET Money | etmoney.com/tools |
| Groww | groww.in/calculators |

**Amortization Schedule:**
A month-by-month breakdown showing:
- EMI payment
- Interest portion
- Principal portion
- Outstanding balance

**Sample Amortization (First 6 months):**
| Month | EMI | Interest | Principal | Balance |
|-------|-----|----------|-----------|---------|
| 1 | 21,247 | 8,333 | 12,914 | 9,87,086 |
| 2 | 21,247 | 8,226 | 13,021 | 9,74,065 |
| 3 | 21,247 | 8,117 | 13,130 | 9,60,935 |
| 4 | 21,247 | 8,008 | 13,239 | 9,47,696 |
| 5 | 21,247 | 7,897 | 13,350 | 9,34,346 |
| 6 | 21,247 | 7,786 | 13,461 | 9,20,885 |

**Key Observations:**
\`\`\`
Early EMIs: More interest, less principal
Later EMIs: Less interest, more principal

Year 1: 60% interest, 40% principal
Year 3: 45% interest, 55% principal
Year 5: 25% interest, 75% principal
\`\`\`

**EMI Components Over Time:**
\`\`\`
Start of Loan:
[████████░░░░░░] Interest Heavy
[░░░░░░████████] Principal Light

End of Loan:
[░░░░████░░░░░░] Interest Light
[████████░░░░░░] Principal Heavy
\`\`\`

**Factors Affecting EMI:**
| Factor | Impact on EMI |
|--------|---------------|
| Loan amount ↑ | EMI increases |
| Interest rate ↑ | EMI increases |
| Tenure ↑ | EMI decreases |
| Prepayment | EMI same, tenure reduces |

**EMI Variations:**
| EMI Type | Description |
|----------|-------------|
| Standard EMI | Fixed amount monthly |
| Step-up EMI | Increases yearly |
| Step-down EMI | Decreases yearly |
| Bullet payment | Interest only, principal at end |
| Flexi EMI | Variable based on cash flow |

**Total Interest Paid:**
| Loan | Rate | Tenure | Total Interest |
|------|------|--------|----------------|
| ₹10L | 10% | 3 yr | ₹1,61,619 |
| ₹10L | 10% | 5 yr | ₹2,74,820 |
| ₹10L | 10% | 7 yr | ₹3,93,084 |

**Tip:** Shorter tenure = Less total interest`,
    order: 1,
    tags: ['emi-calculation', 'amortization', 'loan-calculator', 'interest-schedule'],
    helpfulCount: 6789,
    viewCount: 92340,
    isPopular: true,
    relatedFaqIds: ['faq-emi-002', 'faq-ir-001', 'faq-cg-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-emi-002',
    categoryId: 'cat-emi-calculation',
    question: 'What are prepayment and foreclosure options and their benefits?',
    answer: `Prepayment helps reduce interest burden and close loans faster:

**Types of Early Payment:**
| Type | Description |
|------|-------------|
| Part Prepayment | Pay extra lump sum |
| Foreclosure | Close entire loan early |
| EMI Increase | Higher EMI, shorter tenure |

**Part Prepayment:**
\`\`\`
Options after prepayment:
1. Reduce EMI, same tenure
2. Same EMI, reduce tenure (better)
3. Combination of both
\`\`\`

**Prepayment Example:**
\`\`\`
Original Loan: ₹50 lakhs, 20 years, 9%
Monthly EMI: ₹44,986
Total Interest: ₹57,96,640

Prepayment of ₹5 lakhs after 3 years:
Option A (Reduce EMI):
New EMI: ₹40,990
Savings: ₹4,000/month

Option B (Reduce Tenure):
EMI Same: ₹44,986
New Tenure: 16 years (from 17)
Interest Saved: ₹8,50,000
\`\`\`

**RBI Guidelines on Prepayment:**
| Loan Type | Prepayment Charges |
|-----------|-------------------|
| Home Loan (Floating) | NIL (RBI mandate) |
| Home Loan (Fixed) | Max 2% |
| Personal Loan | 0-5% of prepaid amount |
| Car Loan (Bank) | 0-4% |
| Business Loan | 2-4% |

**When to Prepay:**

**Good Times:**
- Received bonus/inheritance
- Early in loan tenure
- High interest rate loan
- Have emergency fund intact

**Not Ideal:**
- No emergency savings
- Better investment options
- Last few years of loan
- Large prepayment charges

**Prepayment Strategy:**
\`\`\`
Year 1-5: Maximum benefit from prepayment
Year 5-10: Good benefit
Year 10-15: Moderate benefit
Year 15+: Minimal benefit (mostly principal)
\`\`\`

**Foreclosure Process:**
\`\`\`
1. Request foreclosure amount
         ↓
2. Arrange funds
         ↓
3. Pay via NEFT/demand draft
         ↓
4. Get provisional NOC
         ↓
5. Property documents returned
         ↓
6. CIBIL updated (30-45 days)
\`\`\`

**Foreclosure Charges:**
| Lender Type | Typical Charge |
|-------------|----------------|
| Banks (Floating) | NIL |
| Banks (Fixed) | 2-3% |
| NBFCs (Floating) | 2-4% |
| NBFCs (Fixed) | 3-5% |

**Documents After Closure:**
| Document | Purpose |
|----------|---------|
| NOC | Loan fully paid |
| Original title deeds | Property documents |
| CIBIL closure report | Credit record |
| Mortgage release deed | Charge removal |

**Tax Implications:**
\`\`\`
Home Loan:
- Prepayment from regular income: Tax benefit continues
- Prepayment reduces next year's interest claim

Education Loan:
- Section 80E benefit continues till loan closes
\`\`\`

**Interest Saved Examples:**
| Loan | Prepay | Saved Interest |
|------|--------|----------------|
| ₹30L, 20yr, 9% | ₹3L (Year 2) | ₹5.2L |
| ₹50L, 20yr, 9% | ₹5L (Year 3) | ₹8.5L |
| ₹70L, 25yr, 8.5% | ₹7L (Year 3) | ₹13.2L |`,
    order: 2,
    tags: ['prepayment', 'foreclosure', 'early-closure', 'interest-saving', 'noc'],
    helpfulCount: 5678,
    viewCount: 76540,
    isPopular: true,
    relatedFaqIds: ['faq-emi-001', 'faq-cg-005', 'faq-hl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // CREDIT CARDS FAQs
  // ============================================================================
  {
    id: 'faq-cc-001',
    categoryId: 'cat-credit-cards',
    question: 'How to choose the best credit card in India for my needs?',
    answer: `Choosing the right credit card depends on your spending habits and lifestyle:

**Types of Credit Cards:**
| Type | Best For | Key Features |
|------|----------|--------------|
| **Rewards Cards** | Regular spenders | Earn points on purchases |
| **Cashback Cards** | Daily expenses | Direct cashback on spends |
| **Travel Cards** | Frequent travelers | Air miles, lounge access |
| **Fuel Cards** | Vehicle owners | Fuel surcharge waiver |
| **Shopping Cards** | Online shoppers | Extra discounts |
| **Premium Cards** | High spenders | Exclusive perks |

**Key Factors to Consider:**

**1. Annual/Joining Fee:**
| Category | Fee Range |
|----------|-----------|
| Entry-level | Free - ₹500 |
| Mid-range | ₹500 - ₹2,000 |
| Premium | ₹2,000 - ₹10,000 |
| Super Premium | ₹10,000+ |

**2. Interest Rate (APR):**
\`\`\`
Average Credit Card APR: 36-42% p.a.
Monthly Rate: 3-3.5%

If you pay full bill: 0% interest
If you pay minimum: Full interest charged
\`\`\`

**3. Reward Rate Comparison:**
| Card Type | Reward Rate |
|-----------|-------------|
| Basic Cards | 0.5-1% |
| Premium Cards | 1-2% |
| Co-branded | 2-5% (partner) |
| Super Premium | 2-5% |

**4. Credit Limit Factors:**
- Income level
- Credit score
- Existing credit
- Repayment history
- Employment type

**Best Cards by Category (2024):**

**Rewards:**
- HDFC Regalia
- Axis Atlas
- SBI Elite

**Cashback:**
- Amazon Pay ICICI
- HDFC MoneyBack+
- Axis ACE

**Travel:**
- Axis Atlas
- HDFC Infinia
- Amex Platinum Travel

**No Annual Fee:**
- Amazon Pay ICICI
- IDFC First Select
- SBI SimplyCLICK

**Decision Framework:**
\`\`\`
Analyze spending pattern
        ↓
Calculate potential rewards
        ↓
Compare annual fee vs benefits
        ↓
Check credit limit offered
        ↓
Read terms carefully
        ↓
Apply online for best offers
\`\`\``,
    order: 1,
    tags: ['credit-card', 'best-credit-card', 'rewards', 'cashback', 'travel-card'],
    helpfulCount: 5678,
    viewCount: 89012,
    isPopular: true,
    relatedFaqIds: ['faq-cc-002', 'faq-cc-003', 'faq-cs-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cc-002',
    categoryId: 'cat-credit-cards',
    question: 'What is credit limit and how to increase it?',
    answer: `Credit limit is the maximum amount you can spend on your credit card:

**How Credit Limit is Determined:**
| Factor | Impact |
|--------|--------|
| Income | Higher income = Higher limit |
| Credit Score | 750+ gets better limits |
| Existing Debt | Lower debt = Higher limit |
| Repayment History | Good history = Higher limit |
| Employment Type | Salaried/Govt preferred |
| Relationship with Bank | Existing customers get more |

**Typical Credit Limits:**
| Income Level | Expected Limit |
|--------------|----------------|
| ₹3-5 lakhs p.a. | ₹50,000 - ₹1 lakh |
| ₹5-10 lakhs p.a. | ₹1-3 lakhs |
| ₹10-20 lakhs p.a. | ₹3-5 lakhs |
| ₹20+ lakhs p.a. | ₹5-10+ lakhs |

**How to Request Limit Increase:**

**Online Method:**
\`\`\`
Login to Net Banking/App
        ↓
Go to Credit Card section
        ↓
Select "Request Limit Increase"
        ↓
Upload income documents
        ↓
Wait for approval (3-7 days)
\`\`\`

**Offline Method:**
- Call customer care
- Visit branch with documents
- Submit written request

**Documents for Limit Increase:**
| Salaried | Self-Employed |
|----------|---------------|
| Latest 3 salary slips | Last 2 ITR |
| Form 16 | Bank statements (6 months) |
| Bank statement | Business proof |

**Tips to Get Higher Limit:**
1. **Use card regularly** - Shows activity
2. **Pay bills on time** - Builds trust
3. **Keep utilization low** - Below 30%
4. **Update income** - When salary increases
5. **Build relationship** - Use bank's other products
6. **Wait 6+ months** - Before requesting

**When Banks Auto-Increase:**
- Good repayment record
- Regular card usage
- Income increase detected
- Festival offers

**Credit Limit vs Available Limit:**
\`\`\`
Total Credit Limit: ₹1,00,000
Current Spends: ₹40,000
Available Limit: ₹60,000

Note: Unbilled transactions also counted
\`\`\`

**Temporary Limit Increase:**
- For specific high-value purchase
- Short duration (1-3 months)
- Easy to get for good customers
- Reverts automatically`,
    order: 2,
    tags: ['credit-limit', 'limit-increase', 'credit-card', 'spending-limit'],
    helpfulCount: 4567,
    viewCount: 67890,
    isPopular: true,
    relatedFaqIds: ['faq-cc-001', 'faq-cc-003', 'faq-cs-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cc-003',
    categoryId: 'cat-credit-cards',
    question: 'What are credit card charges and how to avoid them?',
    answer: `Understanding credit card charges helps avoid unnecessary costs:

**Common Credit Card Charges:**

**1. Annual/Renewal Fee:**
| Card Type | Annual Fee |
|-----------|------------|
| Basic | Free - ₹500 |
| Rewards | ₹500 - ₹2,000 |
| Premium | ₹2,000 - ₹10,000 |
| Super Premium | ₹10,000+ |

**Waiver Criteria:**
- Spend ₹X amount annually
- Convert to EMI
- Negotiate with bank

**2. Interest Charges:**
\`\`\`
Average APR: 36-42% p.a.
Monthly: 3-3.5%

Interest Charged On:
- Unpaid balance
- Cash advances (from day 1)
- Converted EMIs
\`\`\`

**3. Late Payment Fee:**
| Outstanding | Late Fee |
|-------------|----------|
| Up to ₹500 | ₹100 |
| ₹500 - ₹5,000 | ₹300 |
| ₹5,000 - ₹20,000 | ₹600 |
| Above ₹20,000 | ₹950 |

**4. Other Charges:**
| Charge Type | Amount |
|-------------|--------|
| Over-limit fee | ₹500 - ₹600 |
| Cash advance | 2.5% (min ₹250) |
| Cash advance interest | 3.5%/month (from day 1) |
| Foreign transaction | 3-3.5% |
| EMI processing | 0.5-2% |
| Card replacement | ₹100 - ₹500 |
| Statement copy | ₹100 |
| Cheque bounce | ₹350 - ₹500 |

**How Interest is Calculated:**
\`\`\`
If you don't pay full amount:

Total Bill: ₹50,000
Minimum Due: ₹2,500
You Pay: ₹2,500

Interest Charged on: ₹50,000 (full amount!)
Rate: 3.5%/month
Interest: ₹1,750

Next Month: ₹50,000 - ₹2,500 + ₹1,750 = ₹49,250 + new purchases
\`\`\`

**Tips to Avoid Charges:**

**1. Avoid Interest:**
- Pay full bill by due date
- Set up auto-pay for total amount
- Track due dates

**2. Avoid Late Fee:**
- Pay minimum if can't pay full
- Set reminders 3 days before
- Use auto-debit

**3. Avoid Cash Advance:**
- Never withdraw cash from credit card
- Use debit card instead
- Interest starts from day 1

**4. Avoid Foreign Transaction Fee:**
- Use travel cards with 0 markup
- Opt for INR billing abroad
- Use forex cards

**5. Get Fee Waiver:**
- Ask for annual fee waiver
- Highlight good usage
- Threaten to close card
- Compare competitor offers`,
    order: 3,
    tags: ['credit-card-charges', 'interest', 'late-fee', 'annual-fee', 'avoid-charges'],
    helpfulCount: 5432,
    viewCount: 78901,
    isPopular: true,
    relatedFaqIds: ['faq-cc-001', 'faq-cc-002', 'faq-cc-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cc-004',
    categoryId: 'cat-credit-cards',
    question: 'How do credit card rewards, points, and cashback work?',
    answer: `Understanding reward programs helps maximize credit card benefits:

**Types of Reward Programs:**

**1. Reward Points:**
| Spend Type | Points Earned |
|------------|---------------|
| Regular spends | 1-2 points/₹100 |
| Partner merchants | 5-10 points/₹100 |
| Bonus categories | 3-5 points/₹100 |

**Point Value:**
\`\`\`
Typical: 1 point = ₹0.25 - ₹1

Example:
10,000 points = ₹2,500 - ₹10,000 value
Varies by redemption option
\`\`\`

**2. Cashback:**
| Category | Cashback Rate |
|----------|---------------|
| All spends | 0.5-1% |
| Partner sites | 1-5% |
| Specific categories | 2-10% |
| Welcome offers | Higher initial |

**Monthly Caps:**
- Most cards have cashback limits
- Typically ₹500-₹2,000/month
- Check terms carefully

**3. Air Miles/Points:**
| Program | Cards |
|---------|-------|
| InterMiles | HDFC, Axis |
| Club Vistara | Axis Vistara |
| Marriott Bonvoy | Amex, HDFC |

**Redemption Options:**

**For Reward Points:**
| Option | Value |
|--------|-------|
| Air miles | Best value usually |
| Product catalog | Medium value |
| Statement credit | Lower value |
| Gift vouchers | Good value |
| Cash | Lowest value |

**Maximizing Rewards Strategy:**
\`\`\`
Step 1: Identify spending categories
           ↓
Step 2: Map to best card for each
           ↓
Step 3: Use multiple cards strategically
           ↓
Step 4: Watch for bonus promotions
           ↓
Step 5: Redeem wisely
\`\`\`

**Best Reward Cards 2024:**
| Card | Best For | Reward Rate |
|------|----------|-------------|
| HDFC Infinia | Travel | 3.3% on travel |
| Axis Atlas | Miles | 5 miles/₹200 |
| Amazon ICICI | Amazon | 5% on Amazon |
| HDFC MoneyBack+ | Cashback | 10X on select |
| SBI Elite | All-round | 2X-5X points |

**Important Terms to Know:**

**Accelerated Rewards:**
- Extra points on specific categories
- Time-limited promotions
- Partner merchant bonuses

**Point Expiry:**
- Some points expire (2-3 years)
- Check card T&C
- Redeem before expiry

**Minimum Redemption:**
- Usually 500-1000 points minimum
- Some cards have no minimum

**Tips for Maximum Rewards:**
1. Use category-specific cards
2. Time purchases with promotions
3. Link to shopping portals
4. Pay utility bills through card
5. Redeem for best value options`,
    order: 4,
    tags: ['rewards', 'points', 'cashback', 'air-miles', 'redemption'],
    helpfulCount: 4321,
    viewCount: 65432,
    isPopular: true,
    relatedFaqIds: ['faq-cc-001', 'faq-cc-003', 'faq-cc-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-cc-005',
    categoryId: 'cat-credit-cards',
    question: 'What is credit card billing cycle, due date, and minimum payment?',
    answer: `Understanding the billing cycle is crucial for managing credit cards effectively:

**Billing Cycle Explained:**
\`\`\`
Billing Cycle: 30 days (typically)

Example:
Cycle Start: 1st of month
Cycle End: 30th of month
Statement Date: 1st (next month)
Due Date: 21st (next month)
Grace Period: 20 days
\`\`\`

**Key Dates:**
| Date | Description |
|------|-------------|
| Statement Date | Bill generated |
| Due Date | Payment deadline |
| Grace Period | Free credit period |
| Billing Cycle | Transaction recording period |

**How Grace Period Works:**
\`\`\`
Purchase: January 5
Statement: February 1
Due Date: February 21

Free Credit Days: 5 Jan to 21 Feb = 47 days!

But if purchased January 28:
Free Credit Days: 28 Jan to 21 Feb = 24 days
\`\`\`

**Minimum Amount Due (MAD):**
\`\`\`
MAD = 5% of Outstanding Balance
     + EMI Due
     + Overlimit Amount
     + Previous MAD Unpaid
     + Interest & Charges

Example:
Balance: ₹50,000
5% of Balance: ₹2,500
MAD: ₹2,500 (minimum to pay)
\`\`\`

**Payment Options:**
| Amount | Result |
|--------|--------|
| Full Statement | No interest |
| Between MAD & Full | Interest on full amount |
| Only MAD | Interest + fees possible |
| Less than MAD | Late fee + credit score impact |

**Interest Calculation Example:**
\`\`\`
Statement: ₹50,000
Payment: ₹25,000 (partial)

Interest charged on: ₹50,000 (not ₹25,000!)
Rate: 3.5%/month
Interest: ₹1,750

Why? Because interest-free period is lost
when full payment not made.
\`\`\`

**Changing Due Date:**
Most banks allow changing due date:
1. Login to net banking
2. Go to credit card settings
3. Request due date change
4. Choose from available options

**Auto-Pay Options:**
| Option | Description |
|--------|-------------|
| Total Amount Due | Best - no interest |
| Minimum Amount Due | Avoids late fee only |
| Fixed Amount | Custom amount |

**Tips for Bill Management:**
1. Set reminder 3 days before due
2. Use auto-pay for full amount
3. Track spending mid-cycle
4. Download statements monthly
5. Review all charges`,
    order: 5,
    tags: ['billing-cycle', 'due-date', 'minimum-payment', 'grace-period', 'statement'],
    helpfulCount: 3987,
    viewCount: 54321,
    isPopular: true,
    relatedFaqIds: ['faq-cc-003', 'faq-cc-001', 'faq-emi-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // SAVINGS & DEPOSITS FAQs
  // ============================================================================
  {
    id: 'faq-sd-001',
    categoryId: 'cat-savings-deposits',
    question: 'What is Fixed Deposit (FD) and how to get best interest rates?',
    answer: `Fixed Deposit is a secure investment option offering guaranteed returns:

**What is Fixed Deposit:**
- Lump sum deposited for fixed tenure
- Higher interest than savings account
- Principal + interest paid at maturity
- Premature withdrawal allowed (with penalty)

**FD Interest Rates (2024):**
| Bank | Regular | Senior Citizen |
|------|---------|----------------|
| SBI | 6.50% - 7.10% | 7.00% - 7.60% |
| HDFC | 6.60% - 7.25% | 7.10% - 7.75% |
| ICICI | 6.50% - 7.10% | 7.00% - 7.60% |
| Axis | 6.50% - 7.15% | 7.00% - 7.65% |
| Yes Bank | 7.00% - 7.50% | 7.50% - 8.00% |
| IDFC First | 6.75% - 7.25% | 7.25% - 7.75% |

**Small Finance Banks (Higher Rates):**
| Bank | Rate |
|------|------|
| AU Small Finance | 7.50% - 8.00% |
| Ujjivan SFB | 7.50% - 8.25% |
| Equitas SFB | 7.50% - 8.00% |

**Types of FD:**
| Type | Features |
|------|----------|
| **Regular FD** | Standard fixed deposit |
| **Tax-Saver FD** | 5-year lock-in, 80C benefit |
| **Flexi FD** | Linked to savings account |
| **Senior Citizen FD** | Extra 0.5% interest |
| **NRI FD** | For non-residents |
| **Corporate FD** | Higher risk, higher returns |

**FD Tenure Options:**
| Tenure | Typical Rate |
|--------|--------------|
| 7-14 days | 4.00% - 5.00% |
| 15-45 days | 4.50% - 5.50% |
| 46-179 days | 5.50% - 6.50% |
| 180-364 days | 6.00% - 7.00% |
| 1-2 years | 6.50% - 7.25% |
| 2-3 years | 6.75% - 7.50% |
| 3-5 years | 6.50% - 7.25% |
| 5-10 years | 6.25% - 7.00% |

**Interest Payout Options:**
\`\`\`
1. Cumulative (Reinvestment)
   - Interest added to principal
   - Paid at maturity
   - Best for wealth creation

2. Non-Cumulative
   - Monthly/quarterly/yearly payout
   - Regular income option
   - Good for retirees
\`\`\`

**FD Calculator Example:**
\`\`\`
Principal: ₹5,00,000
Tenure: 3 years
Rate: 7.25% (compounded quarterly)

Maturity Amount: ₹6,19,838
Interest Earned: ₹1,19,838
\`\`\`

**Tips for Best Rates:**
1. Compare across banks
2. Consider small finance banks
3. Book during special offers
4. Use laddering strategy
5. Check senior citizen benefits`,
    order: 1,
    tags: ['fixed-deposit', 'fd', 'interest-rates', 'investment', 'safe-investment'],
    helpfulCount: 6789,
    viewCount: 98765,
    isPopular: true,
    relatedFaqIds: ['faq-sd-002', 'faq-sd-003', 'faq-bb-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-sd-002',
    categoryId: 'cat-savings-deposits',
    question: 'What is Recurring Deposit (RD) and how does it work?',
    answer: `Recurring Deposit is a systematic savings scheme for regular monthly investments:

**What is Recurring Deposit:**
- Fixed monthly deposit
- Fixed tenure (6 months to 10 years)
- Interest similar to FD
- Discipline in saving

**How RD Works:**
\`\`\`
Monthly Deposit: ₹5,000
Tenure: 2 years (24 months)
Interest Rate: 7%

Month 1: ₹5,000 deposited
Month 2: ₹5,000 + previous balance + interest
...continues...
Maturity: Principal + Compound Interest
\`\`\`

**RD Interest Rates (2024):**
| Bank | General | Senior Citizen |
|------|---------|----------------|
| SBI | 6.50% - 6.75% | 7.00% - 7.25% |
| HDFC | 6.50% - 7.10% | 7.00% - 7.60% |
| ICICI | 6.50% - 7.00% | 7.00% - 7.50% |
| Post Office | 6.70% | Same |
| Kotak | 6.25% - 6.75% | 6.75% - 7.25% |

**RD Features:**
| Feature | Details |
|---------|---------|
| Minimum deposit | ₹100 - ₹1,000 |
| Maximum deposit | No limit |
| Tenure | 6 months to 10 years |
| Interest compounding | Quarterly |
| Premature closure | Allowed (with penalty) |
| Loan against RD | Up to 90% of deposit |

**RD vs FD Comparison:**
| Feature | RD | FD |
|---------|----|----|
| Investment | Monthly | Lump sum |
| Best for | Salaried, no lump sum | Those with surplus |
| Returns | Slightly lower | Higher |
| Flexibility | Fixed monthly | One-time |
| Discipline | Forces saving | No discipline needed |

**RD Calculator Example:**
\`\`\`
Monthly Deposit: ₹10,000
Tenure: 3 years (36 months)
Interest Rate: 7%

Total Deposits: ₹3,60,000
Interest Earned: ₹41,287
Maturity Amount: ₹4,01,287
\`\`\`

**Special RD Types:**
| Type | Feature |
|------|---------|
| **Flexi RD** | Variable monthly amount |
| **Tax-Saving RD** | 5-year, 80C benefit |
| **Kids RD** | For minor accounts |
| **Step-up RD** | Increasing amounts |

**Tips for RD:**
1. Set up auto-debit
2. Choose longer tenure for better rates
3. Don't miss installments (penalty)
4. Use for specific goals
5. Consider inflation impact

**Missed Installment:**
\`\`\`
Penalty: ₹1 per ₹100 per month default

Example:
Monthly deposit: ₹10,000
Missed 2 months
Penalty: ₹10,000 × 1% × 2 = ₹200
\`\`\``,
    order: 2,
    tags: ['recurring-deposit', 'rd', 'monthly-savings', 'systematic-savings'],
    helpfulCount: 4567,
    viewCount: 67890,
    isPopular: true,
    relatedFaqIds: ['faq-sd-001', 'faq-sd-003', 'faq-inv-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-sd-003',
    categoryId: 'cat-savings-deposits',
    question: 'How to choose the best savings account with highest interest rate?',
    answer: `Savings account interest rates vary significantly across banks:

**Savings Account Interest Rates (2024):**
| Bank | Interest Rate |
|------|---------------|
| SBI | 2.70% - 3.00% |
| HDFC | 3.00% - 3.50% |
| ICICI | 3.00% - 3.50% |
| Axis | 3.00% - 3.50% |
| Kotak 811 | 3.50% - 4.00% |
| IDFC First | 4.00% - 7.25% |
| Yes Bank | 4.00% - 5.00% |
| RBL Bank | 4.25% - 5.50% |
| IndusInd | 4.00% - 6.00% |
| AU SFB | 7.00% - 7.25% |

**High-Interest Savings Accounts:**
| Bank | Rate | Min Balance |
|------|------|-------------|
| IDFC First | Up to 7.25% | ₹25,000 AMB |
| AU SFB | Up to 7.25% | ₹2,500 |
| Ujjivan SFB | Up to 7.00% | ₹1,000 |
| DBS digibank | Up to 7.00% | Zero |
| Jana SFB | Up to 7.00% | ₹500 |

**Interest Calculation:**
\`\`\`
Interest calculated on daily balance
Credited monthly/quarterly

Example:
Balance: ₹1,00,000
Rate: 6%
Daily Interest: ₹1,00,000 × 6% ÷ 365 = ₹16.44
Monthly (30 days): ₹493
Yearly: ₹6,000
\`\`\`

**Factors to Consider:**
| Factor | Importance |
|--------|------------|
| Interest rate | High |
| Minimum balance | Very High |
| Charges | High |
| Digital features | Medium |
| ATM network | Medium |
| Branch presence | Low-Medium |

**Minimum Balance Requirements:**
| Bank Type | Min Balance |
|-----------|-------------|
| PSU Banks | ₹500 - ₹3,000 |
| Private Banks | ₹10,000 - ₹25,000 |
| Small Finance | ₹0 - ₹2,500 |
| Payment Banks | Zero |
| Digital Banks | Zero |

**Zero Balance Options:**
- BSBDA (Basic Savings Account)
- Kotak 811
- DBS digibank
- Fi Money
- Jupiter

**Account Selection Framework:**
\`\`\`
Define primary need
        ↓
Check minimum balance requirement
        ↓
Compare interest rates
        ↓
Review charges & fees
        ↓
Check digital features
        ↓
Consider ATM/branch access
        ↓
Open account
\`\`\`

**Tips for Higher Returns:**
1. Use sweep-in facility (FD-linked)
2. Maintain higher balance for better rates
3. Consider small finance banks
4. Open multiple accounts strategically
5. Check AMB calculations`,
    order: 3,
    tags: ['savings-account', 'interest-rate', 'zero-balance', 'best-bank'],
    helpfulCount: 5678,
    viewCount: 87654,
    isPopular: true,
    relatedFaqIds: ['faq-sd-001', 'faq-bb-001', 'faq-db-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // DEBIT CARDS & ATM FAQs
  // ============================================================================
  {
    id: 'faq-dc-001',
    categoryId: 'cat-debit-cards-atm',
    question: 'What are ATM withdrawal limits and transaction charges by bank?',
    answer: `ATM limits and charges vary by bank and card type:

**ATM Withdrawal Limits by Bank:**
| Bank | Daily Limit | Per Transaction |
|------|-------------|-----------------|
| SBI | ₹40,000 - ₹1,00,000 | ₹20,000 |
| HDFC | ₹25,000 - ₹1,00,000 | ₹10,000 |
| ICICI | ₹50,000 - ₹1,50,000 | ₹20,000 |
| Axis | ₹40,000 - ₹1,00,000 | ₹25,000 |
| Kotak | ₹50,000 - ₹1,00,000 | ₹25,000 |
| PNB | ₹25,000 - ₹50,000 | ₹10,000 |
| BOB | ₹40,000 - ₹1,00,000 | ₹20,000 |

**Limits by Card Type:**
| Card Type | Typical Limit |
|-----------|---------------|
| Classic/Basic | ₹25,000 |
| Silver | ₹40,000 |
| Gold | ₹50,000 |
| Platinum | ₹1,00,000 |
| Premium/Signature | ₹1,50,000+ |

**Free ATM Transactions (RBI Rule):**
\`\`\`
Metro Cities (Top 6):
- Own Bank ATM: 3 free/month
- Other Bank ATM: 3 free/month

Non-Metro:
- Own Bank ATM: 5 free/month
- Other Bank ATM: 5 free/month
\`\`\`

**ATM Charges After Free Limit:**
| Transaction Type | Charge (2024) |
|------------------|---------------|
| Own Bank Financial | ₹21-₹23 |
| Own Bank Non-Financial | ₹8.50-₹10 |
| Other Bank Financial | ₹21-₹23 |
| Other Bank Non-Financial | ₹8.50-₹10 |
| Balance Inquiry | ₹5-₹10 |
| Mini Statement | ₹5-₹10 |

**International ATM Limits:**
| Bank | Daily Limit (USD equivalent) |
|------|------------------------------|
| SBI | $500 |
| HDFC | $1,000 |
| ICICI | $1,000 |
| Axis | $500 |

**International Charges:**
\`\`\`
Currency Conversion: 2-3.5%
ATM Fee: ₹150-₹200
Network Fee: 1-2%
Total: 3-5% of amount
\`\`\`

**Types of Debit Cards:**
| Type | Features |
|------|----------|
| RuPay | Domestic only, low charges |
| Visa | International, widely accepted |
| Mastercard | International, widely accepted |
| RuPay Platinum | Enhanced limits, offers |
| Contactless | Tap to pay |

**Increasing ATM Limit:**
\`\`\`
Via Net Banking:
1. Login to internet banking
2. Go to Debit Card section
3. Select "Modify Limits"
4. Increase within allowed range
5. Confirm with OTP

Via ATM:
1. Insert card at bank's ATM
2. Select "Services"
3. Choose "Change Limits"
4. Set new limit
\`\`\`

**Safety Tips:**
- Cover PIN while typing
- Use bank's ATM when possible
- Check for skimming devices
- Set SMS alerts
- Don't share PIN/OTP`,
    order: 1,
    tags: ['atm-limit', 'withdrawal-charges', 'debit-card', 'transaction-limit'],
    helpfulCount: 7890,
    viewCount: 112345,
    isPopular: true,
    relatedFaqIds: ['faq-dc-002', 'faq-bb-002', 'faq-db-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-dc-002',
    categoryId: 'cat-debit-cards-atm',
    question: 'What to do if ATM debits money but cash not dispensed?',
    answer: `Failed ATM transactions where money is debited but cash not received are common. Here's what to do:

**Immediate Steps:**
\`\`\`
1. Don't panic - stay at ATM
          ↓
2. Wait for transaction receipt
          ↓
3. Note ATM ID/Location
          ↓
4. Check SMS for debit alert
          ↓
5. Save all details
\`\`\`

**Information to Note:**
| Detail | Why Needed |
|--------|------------|
| ATM Location/ID | Identify specific ATM |
| Date & Time | Transaction tracking |
| Amount | Claim amount |
| Transaction Reference | For complaint |
| Card last 4 digits | Account identification |

**Complaint Process:**

**Step 1: Contact Bank (Within 24 hours)**
\`\`\`
Call Customer Care
OR
Visit nearest branch
OR
Use mobile app/net banking
\`\`\`

**Step 2: File Formal Complaint**
| Channel | Method |
|---------|--------|
| Phone | Call helpline |
| Branch | Submit written complaint |
| Online | Internet banking complaint |
| App | In-app support |
| Email | Send to nodal officer |

**RBI Auto-Reversal Rule:**
\`\`\`
Mandatory Timeline:
- Failed ATM transactions must be auto-reversed
- Within T+5 days (T = Transaction day)
- If not reversed: Compensation ₹100/day
\`\`\`

**Compensation for Delay:**
| Delay | Compensation |
|-------|--------------|
| Beyond T+5 days | ₹100/day |
| Maximum | No cap |
| Auto-credited | To account |

**Escalation Matrix:**
\`\`\`
Level 1: Branch/Customer Care (Wait 7 days)
           ↓
Level 2: Nodal Officer (Wait 15 days)
           ↓
Level 3: Banking Ombudsman (Final)
\`\`\`

**Documents for Complaint:**
- Transaction receipt (if available)
- SMS/Email alert of debit
- Bank statement showing debit
- Written complaint copy
- ID proof

**Different Scenarios:**

**Scenario 1: Own Bank ATM**
- Easier resolution
- Direct access to CCTV
- Usually resolved in 3-5 days

**Scenario 2: Other Bank ATM**
- Slightly longer process
- Requires inter-bank communication
- 7-10 days typical

**Prevention Tips:**
- Use bank's own ATM
- Avoid peak hours
- Check ATM functionality
- Keep transaction receipts
- Enable SMS alerts`,
    order: 2,
    tags: ['atm-failed', 'cash-not-dispensed', 'atm-complaint', 'money-debited'],
    helpfulCount: 6543,
    viewCount: 98765,
    isPopular: true,
    relatedFaqIds: ['faq-dc-001', 'faq-gr-001', 'faq-bb-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // GOVERNMENT SCHEMES FAQs
  // ============================================================================
  {
    id: 'faq-gs-001',
    categoryId: 'cat-government-schemes',
    question: 'What is Pradhan Mantri Awas Yojana (PMAY) and how to apply?',
    answer: `PMAY provides affordable housing with interest subsidy for home buyers:

**PMAY Components:**
| Component | Target |
|-----------|--------|
| PMAY-Urban | Urban poor & middle class |
| PMAY-Gramin | Rural housing |

**Eligibility Categories (Urban):**
| Category | Annual Income | Carpet Area | Subsidy |
|----------|---------------|-------------|---------|
| EWS | Up to ₹3 lakhs | 30 sq.m. | 6.5% |
| LIG | ₹3-6 lakhs | 60 sq.m. | 6.5% |
| MIG-I | ₹6-12 lakhs | 160 sq.m. | 4% |
| MIG-II | ₹12-18 lakhs | 200 sq.m. | 3% |

**Interest Subsidy Calculation:**
\`\`\`
Category: EWS/LIG
Loan Amount: ₹6 lakhs (eligible portion)
Subsidy Rate: 6.5%
Tenure: 20 years

Subsidy Amount = Present Value of 6.5% on ₹6L for 20 years
               ≈ ₹2.67 lakhs

Effective Interest: 8.5% - 6.5% = ~2% on subsidized portion
\`\`\`

**How to Apply:**

**Online Application:**
\`\`\`
Visit pmaymis.gov.in
        ↓
Click "Citizen Assessment"
        ↓
Select category (Slum/Non-Slum)
        ↓
Enter Aadhaar number
        ↓
Fill application form
        ↓
Upload documents
        ↓
Submit application
\`\`\`

**Through Bank/HFC:**
\`\`\`
Apply for home loan
        ↓
Bank identifies PMAY eligibility
        ↓
CLSS subsidy applied
        ↓
Subsidy credited to loan account
\`\`\`

**Documents Required:**
| Document | Purpose |
|----------|---------|
| Aadhaar Card | Identity, eligibility |
| Income Proof | Category determination |
| Property Documents | Loan processing |
| Bank Statement | Income verification |
| Affidavit | First-time buyer declaration |

**Key Conditions:**
- First-time home buyer
- No previous PMAY benefit
- No pucca house in family
- Women ownership preferred
- Joint ownership with female

**Subsidy Credit Process:**
\`\`\`
Loan sanctioned by bank
        ↓
Bank uploads to PMAY portal
        ↓
NHB/HUDCO validates
        ↓
Subsidy released to bank
        ↓
Credited to borrower's loan
        ↓
EMI reduces automatically
\`\`\`

**Check Application Status:**
- Visit pmaymis.gov.in
- Enter Aadhaar or Application ID
- View current status

**Important Notes:**
- Scheme extended to March 2024
- New scheme PMAY 2.0 announced
- Check latest guidelines
- Verify with lending bank`,
    order: 1,
    tags: ['pmay', 'housing-subsidy', 'affordable-housing', 'clss', 'home-loan-subsidy'],
    helpfulCount: 8765,
    viewCount: 134567,
    isPopular: true,
    relatedFaqIds: ['faq-gs-002', 'faq-hl-001', 'faq-tax-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-gs-002',
    categoryId: 'cat-government-schemes',
    question: 'What is Pradhan Mantri Mudra Yojana (PMMY) for business loans?',
    answer: `PMMY provides collateral-free loans for micro and small businesses:

**Mudra Loan Categories:**
| Category | Loan Amount | For |
|----------|-------------|-----|
| **Shishu** | Up to ₹50,000 | Starting/new business |
| **Kishore** | ₹50,001 - ₹5 lakhs | Growth stage |
| **Tarun** | ₹5,00,001 - ₹10 lakhs | Expansion |
| **Tarun Plus** | ₹10,00,001 - ₹20 lakhs | Further growth |

**Key Features:**
| Feature | Details |
|---------|---------|
| Collateral | Not required |
| Interest Rate | Bank-specific (varies) |
| Processing Fee | Minimal/nil |
| Repayment | Up to 5 years |
| No guarantor | For Shishu loans |

**Eligible Businesses:**
- Manufacturing units
- Trading activities
- Service sector businesses
- Allied agricultural activities
- Artisans and craftsmen
- Food vendors and hawkers

**Who Can Apply:**
\`\`\`
✓ Individuals
✓ Proprietorship firms
✓ Partnership firms
✓ Private limited companies
✓ Public limited companies
✓ Any non-corporate entity
\`\`\`

**Documents Required:**
| Category | Documents |
|----------|-----------|
| **Identity** | Aadhaar, PAN, Voter ID |
| **Address** | Utility bill, rent agreement |
| **Business** | Registration, GST (if applicable) |
| **Financial** | Bank statements, ITR |
| **Others** | Quotations, project report |

**Application Process:**

**Through Bank:**
\`\`\`
Visit any bank branch
        ↓
Request Mudra loan form
        ↓
Submit documents
        ↓
Bank assesses application
        ↓
Sanction & disbursement
\`\`\`

**Online (Udyamimitra):**
\`\`\`
Visit udyamimitra.in
        ↓
Register as borrower
        ↓
Select Mudra loan type
        ↓
Fill application
        ↓
Choose preferred bank
        ↓
Submit & track
\`\`\`

**Interest Rates (Indicative):**
| Bank | Rate |
|------|------|
| PSU Banks | 8-12% |
| Private Banks | 10-18% |
| MFIs | 12-24% |
| NBFCs | 10-20% |

**Mudra Card:**
- Working capital facility
- ATM-cum-debit card
- Withdraw as needed
- Interest on utilized amount

**Scheme Achievements:**
- 56+ crore loans sanctioned
- ₹38+ lakh crore disbursed
- 67% women borrowers
- Employment generation

**Tips for Approval:**
1. Have clear business plan
2. Maintain good credit score
3. Show existing business activity
4. Prepare realistic projections
5. Start with Shishu if new`,
    order: 2,
    tags: ['mudra-loan', 'pmmy', 'business-loan', 'msme', 'collateral-free'],
    helpfulCount: 7654,
    viewCount: 112345,
    isPopular: true,
    relatedFaqIds: ['faq-gs-001', 'faq-bl-001', 'faq-bl-004'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-gs-003',
    categoryId: 'cat-government-schemes',
    question: 'What is Jan Dhan Yojana and its benefits?',
    answer: `Pradhan Mantri Jan Dhan Yojana (PMJDY) is India's largest financial inclusion program:

**What is PMJDY:**
- National Mission for Financial Inclusion
- Launched August 28, 2014
- Provides bank account to every household
- Enables access to banking services

**Key Benefits:**
| Benefit | Details |
|---------|---------|
| Zero balance account | No minimum required |
| RuPay debit card | Free issuance |
| Accident insurance | ₹2 lakhs |
| Life insurance | ₹30,000 (opened before Jan 2015) |
| Overdraft facility | Up to ₹10,000 |
| Direct Benefit Transfer | DBT linkage |

**Account Features:**
\`\`\`
✓ No minimum balance
✓ Free ATM card (RuPay)
✓ No charge for deposits
✓ 4 free withdrawals/month
✓ Mobile banking facility
✓ Interest on balance
\`\`\`

**Overdraft Facility:**
| Criteria | Amount |
|----------|--------|
| Initial (6 months operation) | ₹5,000 |
| After satisfactory conduct | ₹10,000 |
| One per household | To woman of house |

**Insurance Benefits:**

**RuPay Accident Insurance:**
\`\`\`
Coverage: ₹2 lakhs
For: Accidental death/permanent disability
Cards issued after: Aug 28, 2018 = ₹2 lakhs
Cards issued before: Aug 28, 2018 = ₹1 lakh
\`\`\`

**Life Insurance (Initial Phase):**
| Condition | Coverage |
|-----------|----------|
| Account opened: Aug 15 - Jan 26, 2015 | ₹30,000 |
| Account holder: 18-59 years | Eligible |
| No existing life cover | Must certify |

**How to Open:**
\`\`\`
Visit any bank branch
        ↓
Fill simplified application
        ↓
Provide Aadhaar/Voter ID/Driving License
        ↓
Account opened immediately
        ↓
Receive RuPay debit card
\`\`\`

**Achievements (2024):**
| Metric | Number |
|--------|--------|
| Total accounts | 53+ crore |
| Women account holders | 56% |
| Total deposits | ₹2.29+ lakh crore |
| Rural accounts | 67% |

**Linked Schemes:**
- Pradhan Mantri Suraksha Bima Yojana (PMSBY)
- Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)
- Atal Pension Yojana (APY)
- DBT for subsidies (LPG, fertilizer)

**Converting to Regular Account:**
- Maintain good balance
- Regular transactions
- Request upgrade
- Better features/limits`,
    order: 3,
    tags: ['jan-dhan', 'pmjdy', 'financial-inclusion', 'zero-balance', 'rupay'],
    helpfulCount: 5432,
    viewCount: 87654,
    isPopular: true,
    relatedFaqIds: ['faq-gs-001', 'faq-gs-002', 'faq-bb-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // GRIEVANCE REDRESSAL FAQs
  // ============================================================================
  {
    id: 'faq-gr-001',
    categoryId: 'cat-grievance-redressal',
    question: 'How to file complaint with Banking Ombudsman for bank issues?',
    answer: `The RBI Integrated Ombudsman Scheme provides free grievance redressal:

**What is Banking Ombudsman:**
- Senior official appointed by RBI
- Resolves customer complaints
- Free service - no charges
- Covers banks, NBFCs, and digital transactions

**When to Approach:**
\`\`\`
First: Complain to bank
        ↓
Wait: 30 days for response
        ↓
If unsatisfied/no response: Banking Ombudsman
\`\`\`

**Grounds for Complaint:**
| Category | Examples |
|----------|----------|
| Deposits | Non-payment, wrong deduction |
| Loans | Non-sanction, delay, harassment |
| Cards | Unauthorized charges, disputes |
| Remittances | NEFT/RTGS/UPI failures |
| Service | Rude behavior, denial of service |
| Charges | Excessive/wrong fees |
| Digital | App failures, fraud |

**How to File Complaint:**

**Online (Preferred):**
\`\`\`
Visit cms.rbi.org.in
        ↓
Click "File a Complaint"
        ↓
Select complaint type
        ↓
Enter bank details
        ↓
Describe complaint
        ↓
Upload documents
        ↓
Submit
        ↓
Get complaint number
\`\`\`

**Other Methods:**
| Method | Details |
|--------|---------|
| Email | crpc@rbi.org.in |
| Phone | 14448 (toll-free) |
| Post | CPC, 4th Floor, Sector 17, Chandigarh |
| Physical | Visit nearest RBI office |

**Required Information:**
\`\`\`
1. Complainant details
   - Name, address
   - Contact number
   - Email

2. Bank details
   - Bank name
   - Branch
   - Account number

3. Complaint details
   - Nature of complaint
   - Date of transaction
   - Amount involved
   - Previous complaint ref (if any)

4. Documents
   - Bank statement
   - Communication with bank
   - Supporting evidence
\`\`\`

**Timeline:**
| Stage | Duration |
|-------|----------|
| Bank complaint | Wait 30 days |
| File with Ombudsman | Within 1 year |
| Ombudsman response | Usually 30-60 days |
| Appeal if needed | Within 30 days |

**Compensation:**
\`\`\`
Ombudsman can award:
- Actual financial loss
- Compensation for mental agony
- Costs incurred
- Maximum: ₹20 lakhs
\`\`\`

**Appeal Process:**
\`\`\`
If unsatisfied with Ombudsman decision:
        ↓
File appeal to Appellate Authority
        ↓
ED, Consumer Protection Dept, RBI
        ↓
Within 30 days of decision
\`\`\`

**Track Complaint:**
- Login to cms.rbi.org.in
- Enter complaint number
- Check status updates`,
    order: 1,
    tags: ['banking-ombudsman', 'rbi-complaint', 'grievance', 'consumer-protection'],
    helpfulCount: 6789,
    viewCount: 98765,
    isPopular: true,
    relatedFaqIds: ['faq-gr-002', 'faq-reg-002', 'faq-dc-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-gr-002',
    categoryId: 'cat-grievance-redressal',
    question: 'How to complain about loan recovery harassment by banks or agents?',
    answer: `RBI has strict guidelines against harassment during loan recovery:

**Your Rights as Borrower:**
\`\`\`
✓ Respectful treatment
✓ Privacy protection
✓ Reasonable communication hours
✓ Written notice before action
✓ Opportunity to repay
✓ Fair valuation of assets
✓ Grievance redressal
\`\`\`

**What is Harassment:**
| Prohibited | Allowed |
|------------|---------|
| Calls before 8 AM | Calls 8 AM - 7 PM |
| Calls after 7 PM | Written reminders |
| Abusive language | Polite communication |
| Threats/intimidation | Legal notice |
| Public shaming | Private discussion |
| Contacting employer | Contacting borrower |
| Physical violence | Legal proceedings |
| Seizing property without notice | SARFAESI with notice |

**Recovery Agent Rules:**
\`\`\`
Agent Must:
✓ Carry authorization letter
✓ Identify themselves
✓ Follow timing rules
✓ Maintain decorum
✓ Issue receipts

Agent Must NOT:
✗ Enter without permission
✗ Use force
✗ Damage property
✗ Take unauthorized items
✗ Threaten family members
\`\`\`

**How to Complain:**

**Step 1: To Bank (Written)**
\`\`\`
Write to Branch Manager
Copy to Nodal Officer
Include:
- Loan account number
- Date/time of incident
- Agent details
- Description of harassment
- Evidence (recording/photos)
\`\`\`

**Step 2: To RBI (If no response)**
\`\`\`
File at cms.rbi.org.in
OR
Email: crpc@rbi.org.in
OR
Call: 14448
\`\`\`

**Step 3: Police Complaint (If physical threat)**
\`\`\`
File FIR for:
- Criminal intimidation (506 IPC)
- Criminal trespass (441 IPC)
- Assault (352 IPC)
- Defamation (499 IPC)
\`\`\`

**Evidence to Collect:**
| Type | Method |
|------|--------|
| Call recordings | Mobile recorder |
| Messages/WhatsApp | Screenshots |
| Witness | Names, statements |
| Physical evidence | Photos, videos |
| Written threats | Keep originals |

**Legal Remedies:**
| Forum | For |
|-------|-----|
| Police | Criminal harassment |
| Consumer Forum | Deficiency in service |
| Civil Court | Damages, injunction |
| Banking Ombudsman | Banking grievance |
| NCLT | Corporate matters |

**Sample Complaint Format:**
\`\`\`
To: The Branch Manager
    [Bank Name, Branch]

Subject: Complaint regarding harassment
by recovery agents

Loan Account No: [Number]

I wish to bring to your notice that your
recovery agents have been harassing me
by [specific incidents with dates].

This is in violation of RBI Fair Practices
Code. Please take immediate action and
ensure it does not recur.

I request written acknowledgment within
7 days failing which I will escalate to
RBI Banking Ombudsman.

Date:
Signature:
\`\`\``,
    order: 2,
    tags: ['recovery-harassment', 'loan-recovery', 'agent-complaint', 'borrower-rights'],
    helpfulCount: 5678,
    viewCount: 87654,
    isPopular: true,
    relatedFaqIds: ['faq-gr-001', 'faq-reg-002', 'faq-ml-005'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // CHEQUES & CLEARING FAQs
  // ============================================================================
  {
    id: 'faq-chq-001',
    categoryId: 'cat-cheques-clearing',
    question: 'What is cheque bounce and what are its legal consequences?',
    answer: `A bounced cheque can have serious legal and financial consequences:

**What is Cheque Bounce:**
A cheque is said to bounce when the bank refuses to honor it due to various reasons.

**Common Reasons for Bounce:**
| Reason | Code |
|--------|------|
| Insufficient funds | Reason 01 |
| Account closed | Reason 02 |
| Payment stopped | Reason 03 |
| Signature mismatch | Reason 04 |
| Alterations/overwriting | Reason 05 |
| Stale cheque (>3 months) | Reason 06 |
| Post-dated cheque | Reason 07 |
| Amount in words/figures differ | Reason 08 |
| Drawer's death known | Reason 09 |
| Account frozen | Reason 10 |

**Legal Framework:**
\`\`\`
Section 138 - Negotiable Instruments Act
Applicable when:
- Cheque issued for debt/liability
- Presented within validity
- Bounced due to insufficient funds
- Notice given within 30 days
- Payment not made within 15 days
\`\`\`

**Penalties:**
| Consequence | Details |
|-------------|---------|
| Imprisonment | Up to 2 years |
| Fine | Up to twice the cheque amount |
| Both | Court's discretion |
| Interim compensation | 20% of cheque amount |

**Legal Process Timeline:**
\`\`\`
Cheque bounces
        ↓ (Within 30 days)
Send legal notice to drawer
        ↓ (Wait 15 days)
If payment not made
        ↓ (Within 30 days)
File complaint in court
        ↓
Court proceedings
        ↓
Judgment (12-18 months typically)
\`\`\`

**Bank Charges:**
| Bank | Bounce Charges |
|------|----------------|
| SBI | ₹350 - ₹750 |
| HDFC | ₹350 - ₹750 |
| ICICI | ₹350 - ₹750 |
| Axis | ₹350 - ₹750 |

**Impact on CIBIL:**
\`\`\`
Cheque bounce for loan EMI:
- Reported to credit bureaus
- Score drops 50-100 points
- Remains on record for years
\`\`\`

**Defenses Available:**
| Defense | Applicability |
|---------|---------------|
| Cheque not for debt | Valid |
| Already paid by other means | Valid |
| Stolen/lost cheque | Valid |
| Post-dated, presented early | Valid |
| Cheque as security | May be valid |

**Prevention Tips:**
1. Maintain sufficient balance
2. Keep buffer in account
3. Track post-dated cheques
4. Set reminders for clearing
5. Use account alerts

**If You Receive Notice:**
\`\`\`
Don't panic
        ↓
Verify cheque details
        ↓
Consult lawyer if needed
        ↓
Make payment within 15 days
        ↓
Get receipt & acknowledgment
\`\`\``,
    order: 1,
    tags: ['cheque-bounce', 'section-138', 'legal-notice', 'dishonored-cheque'],
    helpfulCount: 7654,
    viewCount: 109876,
    isPopular: true,
    relatedFaqIds: ['faq-chq-002', 'faq-bb-003', 'faq-gr-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-chq-002',
    categoryId: 'cat-cheques-clearing',
    question: 'How does cheque clearing work and what are MICR, CTS codes?',
    answer: `Understanding cheque clearing helps manage payments better:

**What is Cheque Clearing:**
Process by which banks exchange cheques and settle amounts between accounts.

**Clearing Types:**
| Type | Timeline | For |
|------|----------|-----|
| Local Clearing | Same day | Same city |
| Outstation | 2-3 days | Different city |
| Speed Clearing | Same day | Any city |
| CTS (Grid-based) | Same day | CTS grid |

**CTS (Cheque Truncation System):**
\`\`\`
Traditional:
Physical cheque → Collecting bank → Clearing house → Drawee bank

CTS:
Physical cheque → Image capture → Electronic transmission → Drawee bank

Benefits:
- Faster clearing
- No physical movement
- Reduced fraud
- Pan-India clearing
\`\`\`

**MICR Code Explained:**
\`\`\`
MICR = Magnetic Ink Character Recognition

9-digit code:
XXX XXX XXX
│   │   │
│   │   └── Branch code (last 3)
│   └────── Bank code (middle 3)
└────────── City code (first 3)

Example: 400002001
400 = Mumbai
002 = State Bank of India
001 = Fort Branch
\`\`\`

**Where to Find MICR:**
- Bottom of cheque leaf
- 9 digits in magnetic ink
- Different from IFSC

**MICR vs IFSC:**
| Feature | MICR | IFSC |
|---------|------|------|
| Digits | 9 (numeric) | 11 (alphanumeric) |
| Used for | Cheque clearing | Electronic transfer |
| Location | Bottom of cheque | Top of cheque |
| Format | City-Bank-Branch | Bank-0-Branch |

**Cheque Clearing Timeline:**
\`\`\`
Day 0: Deposit cheque before cut-off
Day 0: Image captured, sent to clearing
Day 1: Clearing house processes
Day 1: Funds tentatively credited
Day 2-3: Cheque honored/returned
Day 3: Final credit confirmed
\`\`\`

**CTS Grids in India:**
| Grid | Coverage |
|------|----------|
| Southern | Chennai, Hyderabad, Bangalore |
| Western | Mumbai, Pune, Ahmedabad |
| Northern | Delhi, Chandigarh |
| Eastern | Kolkata |

**Cut-off Times (Typical):**
| Activity | Time |
|----------|------|
| Cheque deposit | 12:00 PM |
| Same-day clearing | Before 12:00 PM |
| Next-day clearing | After 12:00 PM |

**Positive Pay System:**
\`\`\`
For cheques ₹50,000 and above:

Issuer registers cheque details:
- Date
- Payee name
- Amount
- Account number

Bank verifies before clearing
Prevents fraudulent encashment
\`\`\`

**Cheque Validity:**
- Valid for 3 months from date
- After that: Stale cheque
- Request fresh cheque`,
    order: 2,
    tags: ['cheque-clearing', 'micr', 'cts', 'clearing-process', 'positive-pay'],
    helpfulCount: 4567,
    viewCount: 67890,
    isPopular: true,
    relatedFaqIds: ['faq-chq-001', 'faq-bb-002', 'faq-bb-003'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // BANK LOCKERS FAQs
  // ============================================================================
  {
    id: 'faq-lkr-001',
    categoryId: 'cat-bank-lockers',
    question: 'What are the RBI rules for bank lockers and how to get one?',
    answer: `RBI has comprehensive guidelines for safe deposit locker facilities:

**RBI Locker Guidelines (2021):**

**Bank's Liability:**
| Scenario | Compensation |
|----------|--------------|
| Bank negligence (theft/fire/fraud) | 100× annual rent |
| Natural disaster | No compensation |
| Customer negligence | No compensation |

**Locker Agreement Terms:**
\`\`\`
New Rules (Post-2023):
- Standard agreement format
- Clear terms and conditions
- Nomination mandatory awareness
- Rent revision notice period
- Break-open procedures defined
\`\`\`

**Locker Sizes & Rent:**
| Size | Dimensions (approx) | Annual Rent |
|------|---------------------|-------------|
| Small | 3"×5"×20" | ₹1,500 - ₹3,000 |
| Medium | 5"×5"×20" | ₹3,000 - ₹6,000 |
| Large | 5"×10"×20" | ₹6,000 - ₹12,000 |
| Extra Large | 10"×10"×20" | ₹10,000 - ₹20,000 |

**How to Get a Locker:**

**Application Process:**
\`\`\`
Maintain account with bank (6-12 months)
        ↓
Apply for locker (waiting list)
        ↓
Wait for availability
        ↓
Pay security deposit (3 years rent)
        ↓
Sign agreement
        ↓
Set access credentials
        ↓
Receive keys/access
\`\`\`

**Documents Required:**
| Document | Purpose |
|----------|---------|
| KYC documents | Identity verification |
| Photographs | Record maintenance |
| Signature proof | Access authorization |
| Nomination form | Successor access |

**What Can Be Stored:**
\`\`\`
Allowed:
✓ Jewelry and valuables
✓ Important documents
✓ Certificates
✓ Precious metals
✓ Property papers

Not Allowed:
✗ Cash/Currency notes
✗ Arms and ammunition
✗ Explosives
✗ Narcotic substances
✗ Perishable items
✗ Hazardous materials
\`\`\`

**Nomination Facility:**
| Feature | Details |
|---------|---------|
| Nominee | Up to 2 nominees |
| Modification | Anytime during rental |
| Benefits | Easy access after death |
| Form | Form A/B available |

**Access Procedures:**
\`\`\`
1. Visit branch during banking hours
2. Register entry in locker register
3. Bank officer accompanies
4. Both keys needed to open
5. Privacy ensured
6. Register exit time
\`\`\`

**Break-Open Procedure:**
| Condition | Process |
|-----------|---------|
| Non-operation (3 years) | Bank can break open |
| Rent arrears | After notices |
| Notice period | 6 months minimum |
| Witness | Independent witnesses |
| Inventory | Detailed record made |

**Rent Payment:**
- Annual payment preferred
- Auto-debit from account
- Default triggers penalty
- 7 days grace typically`,
    order: 1,
    tags: ['bank-locker', 'safe-deposit', 'rbi-rules', 'locker-rent', 'nomination'],
    helpfulCount: 5678,
    viewCount: 78901,
    isPopular: true,
    relatedFaqIds: ['faq-lkr-002', 'faq-bb-001', 'faq-doc-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // INVESTMENTS & SIP FAQs
  // ============================================================================
  {
    id: 'faq-inv-001',
    categoryId: 'cat-investments',
    question: 'What is SIP (Systematic Investment Plan) and how to start?',
    answer: `SIP is a disciplined way to invest in mutual funds regularly:

**What is SIP:**
- Fixed amount invested regularly
- In mutual fund of choice
- Automatic debit from bank
- Benefits from rupee cost averaging

**How SIP Works:**
\`\`\`
Monthly Investment: ₹10,000
Fund NAV varies each month:

Month 1: NAV ₹100 → Units: 100
Month 2: NAV ₹90  → Units: 111
Month 3: NAV ₹110 → Units: 91
Month 4: NAV ₹95  → Units: 105

Total: ₹40,000 invested
Units: 407
Average NAV: ₹98.28 (better than ₹100)
\`\`\`

**SIP Benefits:**
| Benefit | Explanation |
|---------|-------------|
| Rupee Cost Averaging | Buy more when low, less when high |
| Disciplined Investing | Forced regular saving |
| Power of Compounding | Long-term wealth creation |
| Flexibility | Start/stop anytime |
| Low Entry | Start with ₹100 |

**Types of SIP:**
| Type | Feature |
|------|---------|
| **Regular SIP** | Fixed amount monthly |
| **Flexi SIP** | Variable amount |
| **Step-up SIP** | Increases annually |
| **Trigger SIP** | Based on market conditions |
| **Perpetual SIP** | No end date |

**SIP Returns Examples:**
| Monthly | Duration | @12% Return |
|---------|----------|-------------|
| ₹5,000 | 10 years | ₹11.6 lakhs |
| ₹5,000 | 20 years | ₹49.9 lakhs |
| ₹10,000 | 10 years | ₹23.2 lakhs |
| ₹10,000 | 20 years | ₹99.9 lakhs |

**How to Start SIP:**

**Online Method:**
\`\`\`
1. Complete KYC (Online/Offline)
          ↓
2. Choose mutual fund platform
   (Groww, Zerodha, Paytm, AMC website)
          ↓
3. Select fund category
          ↓
4. Choose specific scheme
          ↓
5. Enter SIP amount & date
          ↓
6. Set up auto-debit mandate
          ↓
7. Confirm & start
\`\`\`

**Best SIP Funds (2024) by Category:**
| Category | Example Funds |
|----------|---------------|
| Large Cap | Mirae Asset Large Cap |
| Flexi Cap | Parag Parikh Flexi Cap |
| Mid Cap | Kotak Emerging Equity |
| Small Cap | Nippon Small Cap |
| Index | UTI Nifty 50 Index |
| ELSS | Mirae Asset Tax Saver |

**SIP vs Lump Sum:**
| Factor | SIP | Lump Sum |
|--------|-----|----------|
| Risk | Lower (averaged) | Higher |
| Timing | Doesn't matter | Critical |
| Discipline | Built-in | Required |
| Returns | Good in volatile market | Good in rising market |

**Tips for SIP:**
1. Start early, stay invested
2. Increase SIP yearly (step-up)
3. Don't stop during market fall
4. Review annually, not monthly
5. Link to financial goals`,
    order: 1,
    tags: ['sip', 'mutual-fund', 'systematic-investment', 'wealth-creation'],
    helpfulCount: 8901,
    viewCount: 134567,
    isPopular: true,
    relatedFaqIds: ['faq-inv-002', 'faq-sd-002', 'faq-tax-002'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-inv-002',
    categoryId: 'cat-investments',
    question: 'What is PPF, NPS, and other government investment schemes?',
    answer: `Government schemes offer safe investments with tax benefits:

**Public Provident Fund (PPF):**
| Feature | Details |
|---------|---------|
| Interest Rate | 7.1% p.a. (2024) |
| Lock-in | 15 years |
| Min Investment | ₹500/year |
| Max Investment | ₹1.5 lakhs/year |
| Tax Benefit | EEE (Exempt-Exempt-Exempt) |

**PPF Benefits:**
\`\`\`
✓ Guaranteed returns
✓ Tax-free interest
✓ Section 80C benefit
✓ Loan facility (Year 3-6)
✓ Partial withdrawal (Year 7)
✓ Extension in 5-year blocks
\`\`\`

**National Pension System (NPS):**
| Feature | Details |
|---------|---------|
| Returns | Market-linked (8-12% historical) |
| Lock-in | Till 60 years |
| Min Investment | ₹1,000/year |
| Tax Benefit | 80C + 80CCD(1B) |
| Additional Deduction | ₹50,000 extra |

**NPS Account Types:**
| Account | Purpose |
|---------|---------|
| Tier 1 | Mandatory pension account |
| Tier 2 | Voluntary savings (liquid) |

**NPS Asset Classes:**
| Class | Investment |
|-------|------------|
| Class E | Equity (up to 75%) |
| Class C | Corporate bonds |
| Class G | Government securities |
| Class A | Alternative investments |

**Sukanya Samriddhi Yojana (SSY):**
| Feature | Details |
|---------|---------|
| For | Girl child (below 10 years) |
| Interest Rate | 8.2% p.a. (2024) |
| Lock-in | Till girl turns 21 |
| Min Investment | ₹250/year |
| Max Investment | ₹1.5 lakhs/year |
| Tax Status | EEE |

**Senior Citizen Savings Scheme (SCSS):**
| Feature | Details |
|---------|---------|
| Eligibility | 60+ years |
| Interest Rate | 8.2% p.a. (2024) |
| Tenure | 5 years (extendable 3 years) |
| Max Investment | ₹30 lakhs |
| Interest Payout | Quarterly |

**Comparison Table:**
| Scheme | Return | Lock-in | Tax |
|--------|--------|---------|-----|
| PPF | 7.1% | 15 yrs | EEE |
| NPS | 8-12% | Till 60 | EET |
| SSY | 8.2% | 21 yrs | EEE |
| SCSS | 8.2% | 5 yrs | Taxable |
| NSC | 7.7% | 5 yrs | EET |
| KVP | 7.5% | 9.7 yrs | Taxable |

**Investment Strategy by Age:**
\`\`\`
20-30 years: More equity (SIP, NPS)
30-40 years: Balanced (PPF + SIP)
40-50 years: Conservative (PPF + Debt)
50-60 years: Safe (SCSS, FD, PPF)
\`\`\`

**Tax Benefits Summary:**
| Scheme | Section | Limit |
|--------|---------|-------|
| PPF | 80C | ₹1.5 lakhs |
| NPS | 80C + 80CCD(1B) | ₹2 lakhs |
| ELSS | 80C | ₹1.5 lakhs |
| SSY | 80C | ₹1.5 lakhs |
| NSC | 80C | ₹1.5 lakhs |`,
    order: 2,
    tags: ['ppf', 'nps', 'sukanya-samriddhi', 'scss', 'government-schemes'],
    helpfulCount: 7654,
    viewCount: 112345,
    isPopular: true,
    relatedFaqIds: ['faq-inv-001', 'faq-tax-001', 'faq-sd-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },

  // ============================================================================
  // AADHAAR & PAN FAQs
  // ============================================================================
  {
    id: 'faq-ap-001',
    categoryId: 'cat-aadhaar-pan',
    question: 'How to link Aadhaar with PAN and bank account?',
    answer: `Linking Aadhaar is mandatory for various financial services:

**Aadhaar-PAN Linking:**

**Why Required:**
- Income Tax filing
- Prevent tax evasion
- Unique identity verification
- PAN becomes inoperative without linking

**Deadline & Penalty:**
| Status | Consequence |
|--------|-------------|
| Not linked | PAN inoperative |
| Late linking | ₹1,000 penalty |
| Deadline | Extended periodically |

**How to Link (Online):**
\`\`\`
Method 1: e-Filing Portal
1. Visit incometax.gov.in
2. Click "Link Aadhaar"
3. Enter PAN and Aadhaar
4. Validate details
5. Pay fee if applicable
6. Submit with OTP

Method 2: SMS
Send SMS to 567678 or 56161:
UIDPAN<12-digit Aadhaar><10-digit PAN>
Example: UIDPAN 123456789012 ABCDE1234F
\`\`\`

**Check Status:**
\`\`\`
Visit: incometax.gov.in
Click: Link Aadhaar Status
Enter: PAN and Aadhaar
View: Linking status
\`\`\`

**Aadhaar-Bank Account Linking:**

**Why Required:**
- DBT (Direct Benefit Transfer)
- Subsidy receipts
- Simplified KYC
- Government scheme benefits

**How to Link:**

**Online:**
\`\`\`
1. Login to Net Banking
2. Go to "Update Aadhaar"
3. Enter Aadhaar number
4. Verify with OTP
5. Confirm linking
\`\`\`

**Via ATM:**
\`\`\`
1. Insert debit card
2. Select "Services"
3. Choose "Aadhaar Registration"
4. Enter Aadhaar number
5. Confirm with PIN
\`\`\`

**At Branch:**
\`\`\`
1. Visit bank branch
2. Fill Aadhaar seeding form
3. Submit Aadhaar copy
4. Get acknowledgment
\`\`\`

**Check Bank-Aadhaar Status:**
\`\`\`
Visit: resident.uidai.gov.in/bank-mapper
OR
Dial: *99*99# (USSD)
Enter: Aadhaar number
View: Linked banks
\`\`\`

**Common Issues & Solutions:**
| Issue | Solution |
|-------|----------|
| Name mismatch | Update in Aadhaar or PAN |
| DOB mismatch | Correct in respective database |
| Mobile not linked | Update mobile in Aadhaar |
| OTP not received | Check registered mobile |

**Aadhaar Update:**
\`\`\`
Online (myaadhaar.uidai.gov.in):
- Address update
- Mobile update
- Email update

At Enrollment Center:
- Name correction
- DOB correction
- Photo/biometric update
\`\`\`

**Documents for Update:**
| Update Type | Supporting Document |
|-------------|---------------------|
| Address | Passport, utility bill, bank statement |
| Name | Passport, PAN, marriage certificate |
| DOB | Passport, birth certificate |`,
    order: 1,
    tags: ['aadhaar-pan-link', 'aadhaar-bank', 'kyc', 'linking', 'pan-inoperative'],
    helpfulCount: 9876,
    viewCount: 156789,
    isPopular: true,
    relatedFaqIds: ['faq-ap-002', 'faq-doc-001', 'faq-bb-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  },
  {
    id: 'faq-ap-002',
    categoryId: 'cat-aadhaar-pan',
    question: 'How to apply for PAN card online and check status?',
    answer: `PAN (Permanent Account Number) is mandatory for financial transactions:

**What is PAN:**
- 10-character alphanumeric identifier
- Issued by Income Tax Department
- Unique to each taxpayer
- Mandatory for ₹50,000+ transactions

**PAN Format Explained:**
\`\`\`
ABCDE1234F
│││││    │
│││││    └── Check digit (letter)
││││└────── Numeric (4 digits)
│││└─────── Surname initial
││└──────── Status (P=Person, C=Company, etc.)
│└───────── Random letters
└────────── Random letter

Status Codes:
P - Individual
C - Company
H - HUF
F - Firm
A - AOP
T - Trust
\`\`\`

**How to Apply (New PAN):**

**Online Application:**
\`\`\`
NSDL Portal (onlineservices.nsdl.com):
1. Select "New PAN - Indian Citizen"
2. Fill Form 49A
3. Upload documents
4. Make payment (₹107)
5. Submit with OTP
6. Get acknowledgment number

UTIITSL Portal (pan.utiitsl.com):
Similar process
Fee: ₹107
\`\`\`

**Documents Required:**
| Category | Documents |
|----------|-----------|
| Identity | Aadhaar, Passport, Voter ID |
| Address | Aadhaar, Utility Bill, Bank Statement |
| DOB | Aadhaar, Birth Certificate, Passport |
| Photo | Recent passport size |
| Signature | On white paper |

**Aadhaar-based PAN (Instant):**
\`\`\`
Visit: incometax.gov.in
Select: Instant PAN
Enter: Aadhaar number
Verify: OTP on Aadhaar mobile
Receive: e-PAN in 10 minutes
Free of cost!
\`\`\`

**Check Application Status:**
\`\`\`
NSDL:
1. Visit tin-nsdl.com
2. Click "PAN Status"
3. Enter acknowledgment number
4. View status

UTIITSL:
1. Visit pan.utiitsl.com
2. Click "PAN Status"
3. Enter acknowledgment/PAN
4. View status
\`\`\`

**PAN Status Types:**
| Status | Meaning |
|--------|---------|
| Under Process | Application received |
| Dispatched | Sent to address |
| Returned | Delivery failed |
| Cancelled | Application rejected |

**Lost PAN - Reprint:**
\`\`\`
If PAN known:
- Apply for reprint only
- Submit ID proof
- Fee: ₹50

If PAN forgotten:
- Visit incometax.gov.in
- Use "Know Your PAN"
- Enter details to retrieve
\`\`\`

**PAN Corrections:**
| Correction Type | Process |
|-----------------|---------|
| Name change | Submit marriage cert/gazette |
| DOB correction | Birth certificate |
| Address update | New address proof |
| Photo/Signature | Fresh documents |

**e-PAN Download:**
\`\`\`
Visit: incometax.gov.in
Login: With credentials
Go to: Profile > PAN
Download: e-PAN (password: DOB DDMMYYYY)
\`\`\``,
    order: 2,
    tags: ['pan-card', 'apply-pan', 'pan-status', 'e-pan', 'pan-correction'],
    helpfulCount: 8765,
    viewCount: 145678,
    isPopular: true,
    relatedFaqIds: ['faq-ap-001', 'faq-doc-001', 'faq-tax-001'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-15'
  }
]

export const getFAQsByCategory = (categoryId: string): KBFAQ[] => {
  return KB_FAQS.filter(faq => faq.categoryId === categoryId)
}

export const getPopularFAQs = (limit: number = 10): KBFAQ[] => {
  return KB_FAQS
    .filter(faq => faq.isPopular)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit)
}

export const searchFAQs = (query: string): KBFAQ[] => {
  const searchTerms = query.toLowerCase().split(' ')
  return KB_FAQS.filter(faq => {
    const searchContent = `${faq.question} ${faq.answer} ${faq.tags.join(' ')}`.toLowerCase()
    return searchTerms.every(term => searchContent.includes(term))
  })
}
