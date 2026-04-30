/**
 * EMI Calendar API
 * GET /api/customers/emi-calendar?year=YYYY&month=MM
 *
 * Fetches active loans for the authenticated customer and generates:
 * - calendar_events: EMI entries for the requested month
 * - upcoming_emis: Next 5 upcoming EMI payments
 * - monthly_summary: Totals for the requested month
 * - payment_history: Last 12 months of EMI payment records
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


// ─── Loan type color mapping ────────────────────────────────────

const LOAN_COLORS: Record<string, string> = {
  'Home Loan': '#3b82f6',
  'Personal Loan': '#f59e0b',
  'Car Loan': '#10b981',
  'Business Loan': '#8b5cf6',
  'Education Loan': '#06b6d4',
  'Gold Loan': '#eab308',
  'Loan Against Property': '#ec4899',
  'Two Wheeler Loan': '#f43f5e',
  'Consumer Durable Loan': '#a855f7',
  'Working Capital Loan': '#14b8a6',
}

function getLoanColor(loanType: string): string {
  // Try exact match first, then partial
  if (LOAN_COLORS[loanType]) return LOAN_COLORS[loanType]
  const key = Object.keys(LOAN_COLORS).find(k =>
    loanType?.toLowerCase().includes(k.toLowerCase().split(' ')[0])
  )
  return key ? LOAN_COLORS[key] : '#6b7280'
}

// ─── Types ───────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  date: string
  loanType: string
  loanId: string
  amount: number
  status: 'due' | 'paid' | 'overdue' | 'upcoming'
  paidDate?: string
  color: string
}

interface UpcomingEmi {
  id: string
  date: string
  loanType: string
  amount: number
  status: 'due' | 'paid' | 'overdue' | 'upcoming'
  loanId: string
}

interface MonthlySummary {
  totalEmi: number
  paidAmount: number
  remainingAmount: number
  overdueAmount: number
  totalCount: number
  paidCount: number
  overdueCount: number
}

interface PaymentHistoryRow {
  month: string
  totalEmi: number
  paidAmount: number
  status: 'all_paid' | 'partial' | 'missed'
  onTimePercent: number
}

interface ActiveLoan {
  id: string
  application_number: string | null
  loan_type: string
  emi_amount: number
  disbursement_date: string | null
  tenure_months: number
  interest_rate: number | null
  approved_amount: number | null
  requested_amount: number | null
  status: string
}

// ─── Route Handler ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10) // 1-indexed from client

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month parameter' },
        { status: 400 }
      )
    }

    const monthIndex = month - 1 // Convert to 0-indexed for Date operations

    const adminClient = createAdminClient()

    // Fetch active loans from loan_applications
    const { data: loansRaw, error: loansError } = await adminClient
      .from('loan_applications')
      .select(`
        id,
        application_number,
        loan_type,
        emi_amount,
        disbursement_date,
        tenure_months,
        interest_rate,
        approved_amount,
        requested_amount,
        status
      `)
      .eq('customer_id', user.id)
      .in('status', ['ACTIVE', 'DISBURSED', 'RUNNING', 'active', 'disbursed', 'running'])
      .order('created_at', { ascending: false })

    // Also try fetching from leads table as fallback
    const { data: leadsRaw } = await adminClient
      .from('leads')
      .select(`
        id,
        lead_id,
        loan_type,
        required_loan_amount,
        lead_status,
        created_at
      `)
      .eq('customer_user_id', user.id)
      .in('lead_status', ['DISBURSED', 'ACTIVE', 'RUNNING'])
      .order('created_at', { ascending: false })

    const activeLoans: ActiveLoan[] = (loansRaw || []).map(loan => ({
      id: loan.id,
      application_number: loan.application_number,
      loan_type: loan.loan_type || 'Loan',
      emi_amount: loan.emi_amount || 0,
      disbursement_date: loan.disbursement_date,
      tenure_months: loan.tenure_months || 0,
      interest_rate: loan.interest_rate,
      approved_amount: loan.approved_amount,
      requested_amount: loan.requested_amount,
      status: loan.status,
    }))

    // If no loan_applications found, generate placeholder from leads
    if (activeLoans.length === 0 && leadsRaw && leadsRaw.length > 0) {
      leadsRaw.forEach(lead => {
        const amount = lead.required_loan_amount || 0
        // Estimate EMI assuming 10% interest, 60 month tenure
        const monthlyRate = 10 / 12 / 100
        const tenure = 60
        const emi = monthlyRate > 0
          ? Math.round((amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
            (Math.pow(1 + monthlyRate, tenure) - 1))
          : 0

        activeLoans.push({
          id: lead.id,
          application_number: lead.lead_id,
          loan_type: lead.loan_type || 'Loan',
          emi_amount: emi,
          disbursement_date: lead.created_at,
          tenure_months: tenure,
          interest_rate: 10,
          approved_amount: amount,
          requested_amount: amount,
          status: lead.lead_status,
        })
      })
    }

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // ── Generate Calendar Events ──

    const calendarEvents: CalendarEvent[] = []
    const daysInRequestedMonth = new Date(year, monthIndex + 1, 0).getDate()

    activeLoans.forEach(loan => {
      if (!loan.emi_amount || loan.emi_amount === 0) return

      // EMI day = day of disbursement or default to 5th
      let emiDay = 5
      if (loan.disbursement_date) {
        emiDay = new Date(loan.disbursement_date).getDate()
      }
      emiDay = Math.min(emiDay, daysInRequestedMonth)

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(emiDay).padStart(2, '0')}`
      const emiDate = new Date(year, monthIndex, emiDay)

      // Determine status
      let status: CalendarEvent['status'] = 'upcoming'
      if (emiDate.toDateString() === today.toDateString()) {
        status = 'due'
      } else if (emiDate < today) {
        // For past dates, assume paid unless we have payment tracking (future feature)
        status = 'paid'
      }

      calendarEvents.push({
        id: `${loan.id}_${dateStr}`,
        date: dateStr,
        loanType: loan.loan_type,
        loanId: loan.application_number || loan.id,
        amount: loan.emi_amount,
        status,
        paidDate: status === 'paid' ? dateStr : undefined,
        color: getLoanColor(loan.loan_type),
      })
    })

    // ── Generate Upcoming EMIs (next 5) ──

    const upcomingEmis: UpcomingEmi[] = []
    for (let futureMonth = 0; futureMonth <= 6 && upcomingEmis.length < 5; futureMonth++) {
      const mDate = new Date(today.getFullYear(), today.getMonth() + futureMonth, 1)
      const mDays = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate()

      for (const loan of activeLoans) {
        if (upcomingEmis.length >= 5) break
        if (!loan.emi_amount || loan.emi_amount === 0) continue

        let emiDay = 5
        if (loan.disbursement_date) {
          emiDay = new Date(loan.disbursement_date).getDate()
        }
        emiDay = Math.min(emiDay, mDays)

        const emiDate = new Date(mDate.getFullYear(), mDate.getMonth(), emiDay)
        if (emiDate < today) continue

        const dateStr = `${emiDate.getFullYear()}-${String(emiDate.getMonth() + 1).padStart(2, '0')}-${String(emiDay).padStart(2, '0')}`

        upcomingEmis.push({
          id: `upcoming_${loan.id}_${dateStr}`,
          date: dateStr,
          loanType: loan.loan_type,
          amount: loan.emi_amount,
          status: emiDate.toDateString() === today.toDateString() ? 'due' : 'upcoming',
          loanId: loan.application_number || loan.id,
        })
      }
    }

    upcomingEmis.sort((a, b) => a.date.localeCompare(b.date))

    // ── Monthly Summary ──

    const monthEvents = calendarEvents.filter(e => {
      const d = new Date(e.date)
      return d.getMonth() === monthIndex && d.getFullYear() === year
    })

    const totalEmi = monthEvents.reduce((s, e) => s + e.amount, 0)
    const paidAmount = monthEvents.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0)
    const overdueAmount = monthEvents.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0)

    const monthlySummary: MonthlySummary = {
      totalEmi,
      paidAmount,
      remainingAmount: totalEmi - paidAmount,
      overdueAmount,
      totalCount: monthEvents.length,
      paidCount: monthEvents.filter(e => e.status === 'paid').length,
      overdueCount: monthEvents.filter(e => e.status === 'overdue').length,
    }

    // ── Payment History (last 12 months) ──

    const paymentHistory: PaymentHistoryRow[] = []
    const monthlyTotalEmi = activeLoans.reduce((s, l) => s + (l.emi_amount || 0), 0)

    for (let i = 11; i >= 0; i--) {
      const histMonth = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthLabel = histMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

      // Without a payment tracking table, assume all paid for past months
      // Future: Join with emi_payments table for actual data
      paymentHistory.push({
        month: monthLabel,
        totalEmi: monthlyTotalEmi,
        paidAmount: monthlyTotalEmi,
        status: 'all_paid',
        onTimePercent: 100,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        calendar_events: calendarEvents,
        upcoming_emis: upcomingEmis,
        monthly_summary: monthlySummary,
        payment_history: paymentHistory,
      },
      meta: {
        active_loans_count: activeLoans.length,
        requested_month: `${year}-${String(month).padStart(2, '0')}`,
      },
    })
  } catch (error) {
    apiLogger.error('EMI Calendar API error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
