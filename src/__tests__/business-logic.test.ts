/**
 * Unit tests for LOANZ 360 business logic
 * EMI calculations, commission tiers, lead scoring, SLA checks
 */

// ============================================================
// EMI Calculator
// ============================================================

function calculateEMI(principal: number, annualRate: number, tenureMonths: number) {{
  const monthlyRate = annualRate / 12 / 100
  if (monthlyRate === 0) return {{ emi: principal / tenureMonths, totalInterest: 0, totalPayment: principal }}
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  const totalPayment = emi * tenureMonths
  return {{ emi: Math.round(emi), totalInterest: Math.round(totalPayment - principal), totalPayment: Math.round(totalPayment) }}
}}

// ============================================================
// Commission Calculator
// ============================================================

interface CommissionTier {{
  minAmount: number
  maxAmount: number
  rate: number // percentage
}}

const COMMISSION_TIERS: CommissionTier[] = [
  {{ minAmount: 0, maxAmount: 1000000, rate: 0.5 }},
  {{ minAmount: 1000001, maxAmount: 5000000, rate: 0.75 }},
  {{ minAmount: 5000001, maxAmount: 10000000, rate: 1.0 }},
  {{ minAmount: 10000001, maxAmount: Infinity, rate: 1.25 }},
]

function calculateCommission(loanAmount: number, tiers: CommissionTier[]): number {{
  for (const tier of tiers) {{
    if (loanAmount >= tier.minAmount && loanAmount <= tier.maxAmount) {{
      return Math.round(loanAmount * tier.rate / 100)
    }}
  }}
  return 0
}}

// ============================================================
// Lead Scoring
// ============================================================

interface LeadData {{
  hasEmail: boolean
  hasPAN: boolean
  loanAmount: number
  employmentType: string
  creditScore?: number
}}

function calculateLeadScore(lead: LeadData): number {{
  let score = 0
  if (lead.hasEmail) score += 10
  if (lead.hasPAN) score += 15
  if (lead.loanAmount > 1000000) score += 20
  if (lead.loanAmount > 5000000) score += 10
  if (lead.employmentType === 'SALARIED') score += 15
  if (lead.employmentType === 'SELF_EMPLOYED_PROFESSIONAL') score += 10
  if (lead.creditScore && lead.creditScore >= 750) score += 20
  if (lead.creditScore && lead.creditScore >= 650 && lead.creditScore < 750) score += 10
  return Math.min(score, 100)
}}

// ============================================================
// SLA Checker
// ============================================================

function checkSLA(createdAt: Date, resolvedAt: Date | null, slaHours: number): {{
  breached: boolean
  hoursElapsed: number
  hoursRemaining: number
}} {{
  const now = resolvedAt || new Date()
  const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
  return {{
    breached: hoursElapsed > slaHours,
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    hoursRemaining: Math.max(0, Math.round((slaHours - hoursElapsed) * 10) / 10),
  }}
}}

// ============================================================
// Tests
// ============================================================

describe('EMI Calculator — edge cases', () => {{
  test('large home loan at 8.5%', () => {{
    const r = calculateEMI(10000000, 8.5, 240) // ₹1 crore, 20 years
    expect(r.emi).toBeGreaterThan(86000)
    expect(r.emi).toBeLessThan(88000)
    expect(r.totalInterest).toBeGreaterThan(10000000)
  }})

  test('small personal loan', () => {{
    const r = calculateEMI(100000, 15, 12)
    expect(r.emi).toBeGreaterThan(9000)
    expect(r.totalPayment).toBeGreaterThan(100000)
  }})

  test('zero interest loan', () => {{
    const r = calculateEMI(240000, 0, 24)
    expect(r.emi).toBe(10000)
    expect(r.totalInterest).toBe(0)
  }})

  test('very high interest rate', () => {{
    const r = calculateEMI(500000, 24, 36)
    expect(r.emi).toBeGreaterThan(19000)
  }})

  test('single month tenure', () => {{
    const r = calculateEMI(100000, 12, 1)
    expect(r.emi).toBeGreaterThan(100000)
    expect(r.totalInterest).toBeGreaterThan(0)
  }})
}})

describe('Commission Calculator', () => {{
  test('small loan gets 0.5% commission', () => {{
    expect(calculateCommission(500000, COMMISSION_TIERS)).toBe(2500)
  }})

  test('medium loan gets 0.75%', () => {{
    expect(calculateCommission(3000000, COMMISSION_TIERS)).toBe(22500)
  }})

  test('large loan gets 1.0%', () => {{
    expect(calculateCommission(8000000, COMMISSION_TIERS)).toBe(80000)
  }})

  test('very large loan gets 1.25%', () => {{
    expect(calculateCommission(20000000, COMMISSION_TIERS)).toBe(250000)
  }})

  test('boundary: exactly 1M', () => {{
    expect(calculateCommission(1000000, COMMISSION_TIERS)).toBe(5000)
  }})

  test('boundary: 1M + 1', () => {{
    expect(calculateCommission(1000001, COMMISSION_TIERS)).toBe(7500)
  }})
}})

describe('Lead Scoring', () => {{
  test('high-quality salaried lead', () => {{
    const score = calculateLeadScore({{
      hasEmail: true, hasPAN: true, loanAmount: 7500000,
      employmentType: 'SALARIED', creditScore: 780,
    }})
    expect(score).toBeGreaterThanOrEqual(80)
  }})

  test('minimal lead data', () => {{
    const score = calculateLeadScore({{
      hasEmail: false, hasPAN: false, loanAmount: 500000,
      employmentType: 'OTHER',
    }})
    expect(score).toBeLessThan(20)
  }})

  test('score capped at 100', () => {{
    const score = calculateLeadScore({{
      hasEmail: true, hasPAN: true, loanAmount: 10000000,
      employmentType: 'SALARIED', creditScore: 800,
    }})
    expect(score).toBeLessThanOrEqual(100)
  }})

  test('credit score tiers', () => {{
    const highCredit = calculateLeadScore({{
      hasEmail: false, hasPAN: false, loanAmount: 0,
      employmentType: 'OTHER', creditScore: 750,
    }})
    const medCredit = calculateLeadScore({{
      hasEmail: false, hasPAN: false, loanAmount: 0,
      employmentType: 'OTHER', creditScore: 700,
    }})
    expect(highCredit).toBeGreaterThan(medCredit)
  }})
}})

describe('SLA Checker', () => {{
  test('not breached within window', () => {{
    const created = new Date()
    created.setHours(created.getHours() - 2)
    const result = checkSLA(created, null, 24)
    expect(result.breached).toBe(false)
    expect(result.hoursRemaining).toBeGreaterThan(0)
  }})

  test('breached after deadline', () => {{
    const created = new Date()
    created.setHours(created.getHours() - 25)
    const result = checkSLA(created, null, 24)
    expect(result.breached).toBe(true)
    expect(result.hoursRemaining).toBe(0)
  }})

  test('resolved before SLA', () => {{
    const created = new Date('2025-01-01T10:00:00')
    const resolved = new Date('2025-01-01T15:00:00')
    const result = checkSLA(created, resolved, 24)
    expect(result.breached).toBe(false)
    expect(result.hoursElapsed).toBeCloseTo(5, 0)
  }})

  test('resolved after SLA', () => {{
    const created = new Date('2025-01-01T10:00:00')
    const resolved = new Date('2025-01-03T10:00:00')
    const result = checkSLA(created, resolved, 24)
    expect(result.breached).toBe(true)
    expect(result.hoursElapsed).toBeCloseTo(48, 0)
  }})
}})
