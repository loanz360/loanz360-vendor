
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCreditMetadata, getCreditBureauLoans, getFetchHistory } from '@/lib/credit-bureau/credit-bureau-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/credit-advisor
 *
 * Returns personalized credit improvement recommendations based on the customer's
 * credit profile, score factors, and bureau data. Generates an actionable improvement
 * plan with priority-ordered steps, a score simulation baseline, a monthly timeline,
 * and frequently asked questions.
 */

// Factor weights (industry standard CIBIL model)
const FACTOR_WEIGHTS = {
  payment_history: 35,
  credit_utilization: 30,
  credit_age: 15,
  credit_mix: 10,
  recent_enquiries: 10,
}

interface ActionItem {
  id: string
  category: string
  category_weight: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  description: string
  estimated_impact_min: number
  estimated_impact_max: number
  timeframe: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
}

function getScoreRating(score: number | null): string {
  if (!score) return 'NO_HISTORY'
  if (score >= 750) return 'EXCELLENT'
  if (score >= 700) return 'GOOD'
  if (score >= 650) return 'FAIR'
  if (score >= 550) return 'POOR'
  return 'VERY_POOR'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch credit data in parallel
    const [metadata, loans, fetchHistory] = await Promise.all([
      getCreditMetadata(user.id),
      getCreditBureauLoans(user.id),
      getFetchHistory(user.id, 12),
    ])

    // Compute metrics
    const activeLoans = loans.filter((l) => l.account_status === 'ACTIVE')
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.current_balance || 0), 0)
    const totalSanctioned = loans.reduce((sum, l) => sum + (l.sanctioned_amount || 0), 0)
    const creditUtilization = totalSanctioned > 0
      ? Math.round((totalOutstanding / totalSanctioned) * 100)
      : 0

    // Payment history analysis
    let totalPayments = 0
    let onTimePayments = 0
    loans.forEach((loan) => {
      const history = Array.isArray(loan.payment_history) ? loan.payment_history : []
      totalPayments += history.length
      onTimePayments += history.filter((p: { dpd?: number }) => (p.dpd || 0) === 0).length
    })
    const onTimePaymentPct = totalPayments > 0
      ? Math.round((onTimePayments / totalPayments) * 100)
      : 100

    // Credit age
    const oldestLoan = loans.reduce((oldest, loan) => {
      if (!loan.disbursement_date) return oldest
      if (!oldest) return loan
      return new Date(loan.disbursement_date) < new Date(oldest.disbursement_date)
        ? loan : oldest
    }, null as (typeof loans)[0] | null)

    let creditAgeYears = 0
    if (oldestLoan?.disbursement_date) {
      creditAgeYears = (Date.now() - new Date(oldestLoan.disbursement_date).getTime())
        / (365 * 24 * 60 * 60 * 1000)
    }

    // Credit mix
    const loanTypes = new Set(loans.map((l) => l.loan_type))
    const hasSecuredLoan = loans.some((l) =>
      ['HOME', 'VEHICLE', 'GOLD', 'LAP'].some((t) => l.loan_type?.includes(t))
    )
    const hasUnsecuredLoan = loans.some((l) =>
      ['PERSONAL', 'CREDIT_CARD', 'CONSUMER'].some((t) => l.loan_type?.includes(t))
    )

    // Recent enquiries (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const recentLoanCount = loans.filter((l) => {
      if (!l.disbursement_date) return false
      return new Date(l.disbursement_date) > sixMonthsAgo
    }).length

    // Factor scores
    const paymentHistoryScore = onTimePaymentPct
    const utilizationScore = creditUtilization <= 10 ? 100
      : creditUtilization <= 30 ? 85
      : creditUtilization <= 50 ? 65
      : creditUtilization <= 70 ? 45
      : 25
    const creditAgeScore = creditAgeYears >= 10 ? 100
      : creditAgeYears >= 7 ? 90
      : creditAgeYears >= 5 ? 75
      : creditAgeYears >= 3 ? 60
      : creditAgeYears >= 1 ? 40
      : 20
    const creditMixScore = (hasSecuredLoan && hasUnsecuredLoan && loanTypes.size >= 3) ? 100
      : (hasSecuredLoan || hasUnsecuredLoan) && loanTypes.size >= 2 ? 75
      : loanTypes.size >= 1 ? 50
      : 25
    const enquiryScore = recentLoanCount === 0 ? 100
      : recentLoanCount === 1 ? 85
      : recentLoanCount === 2 ? 70
      : recentLoanCount <= 4 ? 50
      : 30

    const currentScore = metadata.credit_score || 700

    // -----------------------------------------------------------------------
    // Generate personalized improvement actions based on weak areas
    // -----------------------------------------------------------------------
    const actions: ActionItem[] = []

    // Payment History actions (35% weight)
    const overdueLoans = activeLoans.filter((l) => (l.dpd_days || 0) > 0)
    if (overdueLoans.length > 0) {
      actions.push({
        id: 'ph-clear-overdue',
        category: 'Payment History',
        category_weight: FACTOR_WEIGHTS.payment_history,
        priority: 'HIGH',
        title: 'Clear All Overdue Payments Immediately',
        description: `You have ${overdueLoans.length} account(s) with overdue payments. Clearing these is the single most impactful action you can take. Each day past due hurts your score further. Contact your lenders to settle outstanding amounts and request a payment plan if needed.`,
        estimated_impact_min: 25,
        estimated_impact_max: 50,
        timeframe: 'Immediately',
        difficulty: 'MEDIUM',
        status: 'NOT_STARTED',
      })
    }

    if (paymentHistoryScore < 95) {
      actions.push({
        id: 'ph-autopay',
        category: 'Payment History',
        category_weight: FACTOR_WEIGHTS.payment_history,
        priority: overdueLoans.length > 0 ? 'HIGH' : 'MEDIUM',
        title: 'Set Up Auto-Pay for All EMIs',
        description: 'Automate your loan and credit card payments through NACH/auto-debit mandates. This eliminates the risk of missed payments due to forgetfulness. Ensure sufficient balance in your payment account at least 2 days before each due date.',
        estimated_impact_min: 15,
        estimated_impact_max: 30,
        timeframe: '1-2 months',
        difficulty: 'EASY',
        status: 'NOT_STARTED',
      })
    }

    // Credit Utilization actions (30% weight)
    if (creditUtilization > 30) {
      actions.push({
        id: 'cu-reduce-balance',
        category: 'Credit Utilization',
        category_weight: FACTOR_WEIGHTS.credit_utilization,
        priority: creditUtilization > 50 ? 'HIGH' : 'MEDIUM',
        title: `Reduce Credit Card Usage Below 30% (Currently ${creditUtilization}%)`,
        description: `Your credit utilization is ${creditUtilization}%, which is ${creditUtilization > 50 ? 'significantly' : 'moderately'} above the ideal 30% threshold. Pay down your highest-balance cards first. Consider making multiple smaller payments throughout the month instead of one large payment at the due date.`,
        estimated_impact_min: creditUtilization > 50 ? 25 : 15,
        estimated_impact_max: creditUtilization > 50 ? 45 : 25,
        timeframe: '1-2 months',
        difficulty: 'MEDIUM',
        status: 'NOT_STARTED',
      })
    }

    if (creditUtilization > 50) {
      actions.push({
        id: 'cu-limit-increase',
        category: 'Credit Utilization',
        category_weight: FACTOR_WEIGHTS.credit_utilization,
        priority: 'MEDIUM',
        title: 'Request a Credit Limit Increase',
        description: 'If you have a good payment history with your card issuer (6+ months of on-time payments), request a credit limit increase. A higher limit automatically lowers your utilization ratio without requiring you to spend less. Do not increase spending after the limit increase.',
        estimated_impact_min: 10,
        estimated_impact_max: 20,
        timeframe: '1-3 months',
        difficulty: 'EASY',
        status: 'NOT_STARTED',
      })
    }

    // Credit Age actions (15% weight)
    if (creditAgeScore < 75) {
      actions.push({
        id: 'ca-keep-old-accounts',
        category: 'Credit Age',
        category_weight: FACTOR_WEIGHTS.credit_age,
        priority: 'LOW',
        title: "Don't Close Your Oldest Credit Cards",
        description: 'Your oldest credit accounts are the foundation of your credit age. Even if you no longer use a credit card, keep it open with occasional small purchases. Closing old accounts shrinks your credit history length, which can lower your score.',
        estimated_impact_min: 5,
        estimated_impact_max: 15,
        timeframe: 'Ongoing',
        difficulty: 'EASY',
        status: 'NOT_STARTED',
      })
    }

    actions.push({
      id: 'ca-active-oldest',
      category: 'Credit Age',
      category_weight: FACTOR_WEIGHTS.credit_age,
      priority: 'LOW',
      title: 'Keep Your Oldest Account Active',
      description: `Your credit history spans ${creditAgeYears.toFixed(1)} years. Make at least one small transaction on your oldest credit card every 3-6 months to prevent the issuer from closing it due to inactivity. Set a recurring reminder to use it for a small subscription.`,
      estimated_impact_min: 3,
      estimated_impact_max: 10,
      timeframe: 'Ongoing',
      difficulty: 'EASY',
      status: 'NOT_STARTED',
    })

    // Credit Mix actions (10% weight)
    if (creditMixScore < 75) {
      if (!hasSecuredLoan) {
        actions.push({
          id: 'cm-secured-loan',
          category: 'Credit Mix',
          category_weight: FACTOR_WEIGHTS.credit_mix,
          priority: 'LOW',
          title: 'Diversify with a Secured Loan',
          description: 'Your credit portfolio lacks a secured loan (e.g., home loan, vehicle loan, gold loan). A secured loan demonstrates your ability to manage different types of credit. Consider a gold loan or secured personal loan if you need credit, as they typically have lower interest rates.',
          estimated_impact_min: 5,
          estimated_impact_max: 15,
          timeframe: '3-6 months',
          difficulty: 'MEDIUM',
          status: 'NOT_STARTED',
        })
      }

      if (!hasUnsecuredLoan && loanTypes.size < 2) {
        actions.push({
          id: 'cm-personal-loan',
          category: 'Credit Mix',
          category_weight: FACTOR_WEIGHTS.credit_mix,
          priority: 'LOW',
          title: 'Consider a Small Personal Loan',
          description: 'Adding an unsecured loan (like a small personal loan or credit card) to your portfolio can improve your credit mix. Only take a loan you genuinely need and can comfortably repay. A small, short-tenure personal loan is a good way to build credit diversity.',
          estimated_impact_min: 5,
          estimated_impact_max: 10,
          timeframe: '3-6 months',
          difficulty: 'MEDIUM',
          status: 'NOT_STARTED',
        })
      }
    }

    // Recent Enquiries actions (10% weight)
    if (recentLoanCount > 2) {
      actions.push({
        id: 're-avoid-applications',
        category: 'Recent Enquiries',
        category_weight: FACTOR_WEIGHTS.recent_enquiries,
        priority: 'MEDIUM',
        title: 'Avoid Multiple Loan Applications',
        description: `You have ${recentLoanCount} credit applications in the last 6 months. Each hard enquiry can reduce your score by 5-10 points. Wait at least 3-6 months before applying for new credit. Use pre-qualification tools (soft checks) that don't affect your score.`,
        estimated_impact_min: 10,
        estimated_impact_max: 20,
        timeframe: '3-6 months',
        difficulty: 'EASY',
        status: 'NOT_STARTED',
      })
    }

    if (recentLoanCount >= 1) {
      actions.push({
        id: 're-space-applications',
        category: 'Recent Enquiries',
        category_weight: FACTOR_WEIGHTS.recent_enquiries,
        priority: recentLoanCount > 3 ? 'MEDIUM' : 'LOW',
        title: 'Space Out Credit Applications',
        description: 'When you need credit, research and compare offers before applying. Submit applications to your top 1-2 choices only. Multiple applications within a short window signal financial distress to bureaus. Use Loanz360 to pre-check eligibility without impacting your score.',
        estimated_impact_min: 5,
        estimated_impact_max: 15,
        timeframe: '3-6 months',
        difficulty: 'EASY',
        status: 'NOT_STARTED',
      })
    }

    // Ensure we always have at least a basic action for good profiles
    if (actions.length === 0) {
      actions.push({
        id: 'maintain-good-habits',
        category: 'Payment History',
        category_weight: FACTOR_WEIGHTS.payment_history,
        priority: 'LOW',
        title: 'Maintain Your Excellent Credit Habits',
        description: 'Your credit profile is in great shape! Continue paying all bills on time, keep your credit utilization low, and avoid unnecessary credit applications. Monitor your score regularly to catch any issues early.',
        estimated_impact_min: 0,
        estimated_impact_max: 5,
        timeframe: 'Ongoing',
        difficulty: 'EASY',
        status: 'NOT_STARTED',
      })
    }

    // Sort actions by priority (HIGH first, then MEDIUM, then LOW)
    const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    // -----------------------------------------------------------------------
    // Calculate potential score and improvement timeline
    // -----------------------------------------------------------------------
    const potentialImprovement = actions.reduce(
      (sum, a) => sum + Math.round((a.estimated_impact_min + a.estimated_impact_max) / 2),
      0
    )
    const potentialScore = Math.min(900, currentScore + potentialImprovement)

    // Determine improvement months based on score gap
    const scoreGap = potentialScore - currentScore
    const improvementMonths = scoreGap > 60 ? 12
      : scoreGap > 30 ? 6
      : scoreGap > 10 ? 3
      : 1

    // -----------------------------------------------------------------------
    // Build monthly timeline
    // -----------------------------------------------------------------------
    const quickWinScore = Math.min(900, currentScore + Math.round(potentialImprovement * 0.45))
    const midTermScore = Math.min(900, currentScore + Math.round(potentialImprovement * 0.75))

    const timeline = [
      {
        period: 'Month 1-3',
        label: 'Quick Wins — Payment & Utilization',
        actions: [
          'Clear all overdue payments and set up auto-pay',
          'Pay credit card balances down below 30% utilization',
          'Request credit limit increases on well-maintained cards',
          'Set up payment reminders 5 days before each due date',
        ],
        expected_score: quickWinScore,
      },
      {
        period: 'Month 3-6',
        label: 'Build History — Consistent Payments',
        actions: [
          'Maintain 100% on-time payment record for 3+ months',
          'Keep credit utilization consistently under 30%',
          'Avoid applying for new credit during this period',
          'Monitor your score monthly to track improvement',
        ],
        expected_score: midTermScore,
      },
      {
        period: 'Month 6-12',
        label: 'Long-term Growth — Credit Mix & Age',
        actions: [
          'Consider adding a secured loan if your mix is limited',
          'Keep all old credit accounts active with small transactions',
          'Space out any necessary credit applications by 3+ months',
          'Continue all positive habits built in earlier months',
        ],
        expected_score: potentialScore,
      },
    ]

    // -----------------------------------------------------------------------
    // Static FAQ content (localized for Indian credit system)
    // -----------------------------------------------------------------------
    const faqs = [
      {
        question: 'How is my credit score calculated?',
        answer: 'Your CIBIL/credit score (ranging from 300-900) is calculated using five key factors: Payment History (35%) — your track record of paying EMIs and bills on time; Credit Utilization (30%) — the percentage of available credit you are using; Credit Age (15%) — the length of your credit history; Credit Mix (10%) — the variety of credit types you hold (home loan, credit card, personal loan, etc.); and Recent Enquiries (10%) — the number of recent credit applications. Each factor is weighted and combined to produce your final score.',
      },
      {
        question: 'What is a good credit score for a home loan?',
        answer: 'For a home loan in India, most banks and HFCs (Housing Finance Companies) prefer a CIBIL score of 750 or above. With a score of 750+, you are likely to get the best interest rates and faster approval. Scores between 700-749 may still qualify but at slightly higher interest rates. Below 700, you may face difficulty getting approval, or may be offered significantly higher rates. Some NBFCs consider scores as low as 650 for home loans with additional documentation requirements.',
      },
      {
        question: 'How long does it take to improve my score?',
        answer: 'Credit score improvement timelines vary depending on your starting point and the actions you take. Quick wins like reducing credit utilization can reflect in 30-45 days (one reporting cycle). Payment history improvements typically take 3-6 months of consistent on-time payments to show significant results. Recovering from defaults or settlements can take 12-24 months. The most important factor is consistency — even a series of small positive actions compounded over 6-12 months can result in a 50-100 point improvement.',
      },
      {
        question: 'Does checking my score lower it?',
        answer: 'No. When you check your own credit score (called a "soft enquiry" or "self-check"), it does NOT affect your score. You can check it as often as you like through Loanz360 or directly through CIBIL/Experian/Equifax portals. However, when a bank or lender checks your score during a loan application (called a "hard enquiry"), it may temporarily reduce your score by 5-10 points. Multiple hard enquiries in a short period can have a compounding negative effect.',
      },
    ]

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: {
        current_score: currentScore,
        score_rating: getScoreRating(currentScore),
        potential_score: potentialScore,
        potential_improvement: potentialImprovement,
        improvement_months: improvementMonths,
        actions,
        timeline,
        faqs,
        credit_utilization: creditUtilization,
        on_time_payment_pct: onTimePaymentPct,
        recent_enquiries: recentLoanCount,
        last_updated: metadata.credit_score_updated_at,
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-advisor', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
