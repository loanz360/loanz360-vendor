/**
 * Credit Bureau Integration Service
 * Connects to CIBIL, Experian, CRIF, Equifax via ULI Hub
 *
 * Data flow:
 *   Customer requests score → API route → this service
 *   → ULI Hub (when ready) OR direct bureau API → score + report
 *   → Store in credit_bureau_fetch_log → return to customer
 *
 * TODO: When ULI Hub is active, route through:
 *   POST /api/superadmin/uli-hub/sandbox (test)
 *   POST /api/superadmin/uli-hub/services (production)
 */

export type CreditBureau = 'CIBIL' | 'EXPERIAN' | 'CRIF' | 'EQUIFAX'

export interface CreditScore {
  bureau: CreditBureau
  score: number
  scoreRange: { min: number; max: number }
  grade: string
  reportDate: string
  factors: CreditFactor[]
  accounts: CreditAccount[]
  enquiries: CreditEnquiry[]
}

export interface CreditFactor {
  name: string
  impact: 'positive' | 'negative' | 'neutral'
  description: string
  weight: number
}

export interface CreditAccount {
  lender: string
  accountType: string
  status: 'Active' | 'Closed' | 'Written Off' | 'Settled'
  balance: number
  creditLimit: number
  openedDate: string
  paymentHistory: string[] // '000' pattern: 0=on time, 1=30 days, etc.
}

export interface CreditEnquiry {
  lender: string
  date: string
  purpose: string
  type: 'Hard' | 'Soft'
}

interface FetchResult {
  success: boolean
  data?: CreditScore
  error?: string
  cached?: boolean
}

/**
 * Fetch credit score from bureau
 * Currently returns computed/estimated score from available data
 * TODO: Connect to ULI Hub or direct bureau API
 */
export async function fetchCreditScore(
  userId: string,
  bureau: CreditBureau = 'CIBIL'
): Promise<FetchResult> {
  // TODO: Replace with actual bureau API call via ULI Hub
  // const uliResponse = await fetch(`${ULI_BASE_URL}/credit-bureau/${bureau.toLowerCase()}/score`, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${ULI_JWT}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ user_id: userId }),
  // })

  return {
    success: false,
    error: 'Credit bureau integration pending. Score will be available once ULI Hub is configured.',
  }
}

/**
 * Fetch full credit report from bureau
 */
export async function fetchCreditReport(
  userId: string,
  bureau: CreditBureau = 'CIBIL'
): Promise<FetchResult> {
  return {
    success: false,
    error: 'Credit report integration pending. Connect via ULI Hub for live reports.',
  }
}

/**
 * Get credit score grade from numeric score
 */
export function getScoreGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 800) return { grade: 'A+', label: 'Excellent', color: '#10b981' }
  if (score >= 750) return { grade: 'A', label: 'Very Good', color: '#22c55e' }
  if (score >= 700) return { grade: 'B+', label: 'Good', color: '#84cc16' }
  if (score >= 650) return { grade: 'B', label: 'Fair', color: '#eab308' }
  if (score >= 600) return { grade: 'C', label: 'Below Average', color: '#f97316' }
  if (score >= 500) return { grade: 'D', label: 'Poor', color: '#ef4444' }
  return { grade: 'E', label: 'Very Poor', color: '#dc2626' }
}
