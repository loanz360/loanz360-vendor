/**
 * Sales Playbook - DSE-specific knowledge content
 * Objection handling, pitch scripts, competitive intelligence
 */

export interface PlaybookItem {
  id: string
  title: string
  category: 'objection_handling' | 'pitch_script' | 'competitive_intel' | 'best_practices' | 'success_stories'
  content: string
  tags: string[]
  loanTypes: string[]
}

export const SALES_PLAYBOOK: PlaybookItem[] = [
  // Objection Handling
  {
    id: 'obj-1',
    title: 'Customer says: "Interest rate is too high"',
    category: 'objection_handling',
    content: `**Response Framework:**

1. **Acknowledge:** "I understand rate matters. Let me show you the complete picture."

2. **Compare:** "At X% rate, your EMI is ₹Y. But let me compare across banks — we work with 15+ banks, and I can find the best rate for your credit profile."

3. **Reframe:** "Focus on total cost, not just rate. Bank A at 8.5% with 1% processing fee costs more than Bank B at 8.75% with zero processing fee over 20 years."

4. **Action:** Use the Multi-Bank Comparison tool to show side-by-side costs.

**Key Data Points:**
- RBI repo rate: 6.50% (as of Feb 2026)
- Average home loan rate: 8.5-9.5%
- Best rates available for 750+ CIBIL: 8.25-8.50%
- Rate difference of 0.25% on ₹50L/20Y = ₹2.8L total savings`,
    tags: ['rate', 'interest', 'cost', 'comparison'],
    loanTypes: ['home_loan', 'personal_loan', 'car_loan', 'loan_against_property'],
  },
  {
    id: 'obj-2',
    title: 'Customer says: "I\'ll check with other banks directly"',
    category: 'objection_handling',
    content: `**Response Framework:**

1. **Validate:** "Absolutely, comparing is smart. That's exactly what we do for you."

2. **Value Proposition:**
   - "We compare 15+ banks in one click — saves you 2-3 weeks of running around"
   - "We know each bank's internal criteria — saving you from unnecessary rejections"
   - "Multiple applications hurt your CIBIL score. We submit only where approval is likely."

3. **Proof:** "Last month, we helped 47 customers get better rates than walk-in offers. Want me to show you?"

4. **Risk Highlight:** "Each bank inquiry drops CIBIL by 5-10 points. Our pre-screening doesn't."

**Closing:** "Let me run a comparison right now — takes 2 minutes. If any bank offers better terms directly, I'll tell you."`,
    tags: ['competition', 'bank', 'direct', 'comparison'],
    loanTypes: ['home_loan', 'personal_loan', 'car_loan', 'business_loan'],
  },
  {
    id: 'obj-3',
    title: 'Customer says: "I want to wait for rates to drop"',
    category: 'objection_handling',
    content: `**Response Framework:**

1. **Data-Driven:** "Let me show you rate history. In the last 5 years, rates have moved only 1-1.5% total. Waiting 6 months historically saves about ₹500-800/month on a ₹50L loan."

2. **Opportunity Cost:** "While waiting, you're paying rent of ₹X/month. 6 months of rent = ₹Y lost. EMI builds equity, rent doesn't."

3. **Flexibility:** "You can always refinance if rates drop. Lock in today at current rates, and if they drop by 0.5% or more, we'll help you do a balance transfer."

4. **Market Reality:** "RBI has kept repo rate steady for the last 8 months. Next rate cut is uncertain. Meanwhile, property prices rose 8-12% in your area last year."

**Key Stat:** Property price increase of 10% on ₹80L property = ₹8L. Rate drop of 0.5% saves ₹3.5L. Net loss by waiting = ₹4.5L.`,
    tags: ['wait', 'timing', 'rate drop', 'market'],
    loanTypes: ['home_loan', 'loan_against_property'],
  },
  {
    id: 'obj-4',
    title: 'Customer says: "Processing fees are too high"',
    category: 'objection_handling',
    content: `**Response Framework:**

1. **Perspective:** "Processing fee is a one-time cost. On a ₹50L loan, 1% = ₹50,000. That's 0.1% of total repayment over 20 years."

2. **Negotiate:** "Many banks waive or reduce processing fees for good profiles. Let me check which banks have zero-fee offers running right now."

3. **Compare Total Cost:** "Bank A charges 0.5% processing fee but 0.25% higher rate. Bank B has 1% fee but lower rate. Over 20 years, Bank B actually saves ₹2.5L despite higher upfront fee."

4. **Current Offers:** "We often have exclusive offers with reduced or waived processing fees. Let me check what's active."

Use the Offers page to find current zero/low processing fee offers.`,
    tags: ['fees', 'processing', 'cost', 'charges'],
    loanTypes: ['home_loan', 'personal_loan', 'car_loan'],
  },
  {
    id: 'obj-5',
    title: 'Customer says: "My CIBIL score is low"',
    category: 'objection_handling',
    content: `**Response Framework:**

1. **Empathize:** "A low score doesn't mean no loan. It means we need to find the right bank and product."

2. **Options by Score Range:**
   - **600-650:** NBFCs like Bajaj, Tata Capital often approve. Rate premium: 1-2%
   - **650-700:** Most banks consider. Focus on SBI, PNB (more flexible)
   - **700+:** Standard eligibility at competitive rates

3. **Score Improvement Plan:**
   - Pay all EMIs and credit card bills on time for 3 months (+30-50 points)
   - Reduce credit utilization below 30% (+20-30 points)
   - Don't close old credit cards (length of history matters)
   - Check for errors in CIBIL report (dispute process takes 30 days)

4. **Immediate Options:**
   - Secured loans (Gold, LAP) have lower CIBIL requirements
   - Joint application with co-applicant who has good score
   - Higher down payment reduces lender risk

**Timeline:** "Give me 90 days, and I can help improve your score by 50-80 points. Meanwhile, let me check which lenders would approve today."`,
    tags: ['cibil', 'credit score', 'low score', 'eligibility'],
    loanTypes: ['home_loan', 'personal_loan', 'car_loan', 'business_loan'],
  },

  // Pitch Scripts
  {
    id: 'pitch-1',
    title: 'Home Loan Pitch: First-time Buyer',
    category: 'pitch_script',
    content: `**Opening:**
"Congratulations on deciding to buy your first home! This is one of the biggest financial decisions you'll make. Let me make sure you get the best deal possible."

**Discovery Questions:**
1. "What's your budget range for the property?"
2. "Have you identified a property, or still searching?"
3. "Are you salaried or self-employed?"
4. "What's your approximate monthly income?"
5. "Do you have any existing loans or EMIs?"

**Value Presentation:**
"Here's what makes us different:
- I'll compare 15+ banks to find YOUR best rate
- Pre-approval in 48 hours so you can negotiate with builders
- Tax savings: Up to ₹5L per year under Section 80C + 24(b)
- I handle all paperwork — you focus on choosing your dream home"

**EMI Demonstration:**
"Let me show you exactly what this looks like..." [Open EMI Calculator]

**Closing:**
"Shall I run a quick eligibility check? It takes 2 minutes and doesn't affect your CIBIL score."`,
    tags: ['home loan', 'first time', 'buyer', 'pitch'],
    loanTypes: ['home_loan'],
  },
  {
    id: 'pitch-2',
    title: 'Business Loan Pitch: MSME Owner',
    category: 'pitch_script',
    content: `**Opening:**
"Growing a business needs the right financial partner. Tell me about your business and what you're looking to fund."

**Discovery Questions:**
1. "What type of business do you run? How long?"
2. "What's the loan purpose — working capital, expansion, equipment?"
3. "What's your annual turnover?"
4. "Do you have GST registration?"
5. "Any existing business loans?"

**Value Presentation:**
"For MSME businesses like yours:
- Government MUDRA/CGTMSE schemes reduce interest by 1-2%
- Collateral-free loans up to ₹2 Cr under CGTMSE
- Quick disbursement: 3-5 working days with us
- We know which bank is best for your business type"

**Key Benefits to Highlight:**
- No collateral needed up to ₹2 Cr (CGTMSE)
- Interest subsidy under PMMY for loans up to ₹10L
- Tax-deductible interest payments

**Closing:**
"Let me check your eligibility across our partner banks. With your ₹X turnover and Y years vintage, I'm confident we can get competitive terms."`,
    tags: ['business', 'msme', 'working capital', 'expansion'],
    loanTypes: ['business_loan'],
  },

  // Best Practices
  {
    id: 'bp-1',
    title: 'Follow-up Best Practices for DSEs',
    category: 'best_practices',
    content: `**The 3-7-15-30 Follow-up Rule:**

**Day 1-3: Hot Phase**
- Send EMI calculation via WhatsApp within 1 hour of meeting
- Follow up call next day: "Did you review the calculation?"
- Share relevant offers matching their loan type

**Day 7: Warm Phase**
- Share new bank offer or rate update
- "A new offer just came in that could save you ₹X on your home loan"

**Day 15: Re-engage Phase**
- Share a success story: "A customer with similar profile just got approved at X%"
- Ask: "Has anything changed in your plans?"

**Day 30: Long-term Nurture**
- Monthly rate update: "Rates have moved this month..."
- Festive season offers
- Market insights relevant to their loan type

**Key Metrics to Track:**
- Response rate by channel (WhatsApp: ~45%, Call: ~65%, SMS: ~15%)
- Best follow-up times: 10-11 AM and 6-7 PM
- Average deal closure: 15-25 days from first contact
- Optimal touches before conversion: 4-6`,
    tags: ['follow up', 'sales', 'communication', 'timing'],
    loanTypes: ['home_loan', 'personal_loan', 'car_loan', 'business_loan'],
  },
  {
    id: 'bp-2',
    title: 'Pre-qualification Checklist Before Submitting Application',
    category: 'best_practices',
    content: `**Before submitting ANY loan application, verify:**

**1. Credit Score Check (Ask customer or use soft pull)**
- 750+: Proceed confidently to top banks
- 700-749: Good, target mid-range banks
- 650-699: Select NBFCs or secured loans
- Below 650: Consider score improvement first

**2. Income Verification**
- Salaried: 3 months salary slips + 6 months bank statement
- Self-employed: 3 years ITR + 12 months bank statement
- Calculate FOIR: (All EMIs including new) / Gross Income < 50%

**3. Property Verification (Home Loans)**
- Builder approval status from bank
- Clear title verification
- RERA registration check

**4. Document Readiness**
- All documents available before submission
- Use Document Checklist tool to verify

**5. Bank Selection**
- Use Multi-Bank Comparison to pick top 2-3 banks
- Submit to highest-approval-probability bank FIRST
- Wait for rejection before submitting to next (protects CIBIL)

**Common Rejection Reasons to Pre-check:**
- Insufficient income for requested amount
- Too many recent credit inquiries
- Existing loan defaults or late payments
- Employer not on approved list
- Age limit exceeded for requested tenure`,
    tags: ['pre-qualification', 'application', 'checklist', 'rejection'],
    loanTypes: ['home_loan', 'personal_loan', 'car_loan', 'business_loan', 'education_loan'],
  },

  // Success Stories
  {
    id: 'ss-1',
    title: 'Success: 680 CIBIL Score Customer Gets Home Loan',
    category: 'success_stories',
    content: `**Customer Profile:**
- Credit Score: 680 (Fair)
- Income: ₹65,000/month (Salaried)
- Loan Required: ₹40L Home Loan
- Challenge: Rejected by 2 banks before approaching us

**Our Approach:**
1. Analyzed rejection reasons: Low score + high existing EMI (₹15,000 car loan)
2. Recommended closing car loan (only 4 EMIs left = ₹60,000) before applying
3. Selected SBI (more flexible with 680+ scores)
4. Applied with spouse as co-applicant (score: 750)

**Result:**
- Approved at 9.15% for 25 years
- EMI: ₹34,672/month
- Total savings vs rejected banks' counter-offers: ₹3.2L over loan tenure
- Customer referred 3 more leads

**Key Takeaway:** Don't give up on low-score customers. Strategic bank selection and application timing make all the difference.`,
    tags: ['success', 'low score', 'home loan', 'strategy'],
    loanTypes: ['home_loan'],
  },
  {
    id: 'ss-2',
    title: 'Success: MSME Owner Gets ₹50L Business Loan Collateral-Free',
    category: 'success_stories',
    content: `**Customer Profile:**
- Business: Manufacturing unit, 5 years vintage
- Annual Turnover: ₹2.5 Cr
- GST Registered: Yes
- Challenge: Needed ₹50L without pledging property

**Our Approach:**
1. Identified CGTMSE guarantee scheme eligibility
2. Prepared comprehensive business plan with projections
3. Selected Axis Bank (strong MSME focus)
4. Highlighted consistent GST filings and growing turnover

**Result:**
- ₹50L sanctioned under CGTMSE (zero collateral)
- Rate: 12.5% (vs 16% initially quoted)
- Disbursed in 5 working days
- DSE Commission: ₹50,000

**Key Takeaway:** Government guarantee schemes are underutilized. Know CGTMSE limits: up to ₹2 Cr for manufacturing, ₹1 Cr for services.`,
    tags: ['success', 'business', 'msme', 'collateral free', 'cgtmse'],
    loanTypes: ['business_loan'],
  },
]

export function getPlaybookByCategory(category: PlaybookItem['category']): PlaybookItem[] {
  return SALES_PLAYBOOK.filter(item => item.category === category)
}

export function getPlaybookByLoanType(loanType: string): PlaybookItem[] {
  return SALES_PLAYBOOK.filter(item => item.loanTypes.includes(loanType))
}

export function searchPlaybook(query: string): PlaybookItem[] {
  const q = query.toLowerCase()
  return SALES_PLAYBOOK.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.content.toLowerCase().includes(q) ||
    item.tags.some(tag => tag.toLowerCase().includes(q))
  )
}
