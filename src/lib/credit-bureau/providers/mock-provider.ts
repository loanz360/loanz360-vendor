/**
 * Mock Credit Bureau Provider
 * Returns sample credit data for testing until real APIs are configured
 */

import type {
  ICreditBureauProvider,
  CreditReport,
  CreditBureauProviderConfig,
  CreditBureauLoanRaw,
  PaymentHistoryEntry,
  CreditEnquiry
} from '../types';

// Generate payment history for last 24 months
function generatePaymentHistory(
  isGoodPayer: boolean,
  startDate: Date
): PaymentHistoryEntry[] {
  const history: PaymentHistoryEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Skip future months or months before loan started
    if (date > now || date < startDate) {
      history.push({ month, year, status: 'NOT_DUE', dpd: 0 });
      continue;
    }

    // Determine payment status
    let status: PaymentHistoryEntry['status'];
    let dpd = 0;

    if (isGoodPayer) {
      // Good payer: 95% on-time, 5% late
      const random = Math.random();
      if (random < 0.95) {
        status = 'ON_TIME';
      } else {
        status = 'LATE';
        dpd = Math.floor(Math.random() * 30) + 1;
      }
    } else {
      // Bad payer: 60% on-time, 25% late, 15% missed
      const random = Math.random();
      if (random < 0.60) {
        status = 'ON_TIME';
      } else if (random < 0.85) {
        status = 'LATE';
        dpd = Math.floor(Math.random() * 60) + 1;
      } else {
        status = 'MISSED';
        dpd = Math.floor(Math.random() * 90) + 30;
      }
    }

    history.push({ month, year, status, dpd });
  }

  return history.reverse(); // Oldest first
}

// Generate mock loans based on PAN
function generateMockLoans(pan: string): CreditBureauLoanRaw[] {
  // Use PAN to seed random generation (consistent data for same PAN)
  const seed = pan.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (n: number) => ((seed * n) % 100) / 100;

  const loans: CreditBureauLoanRaw[] = [];
  const isGoodPayer = random(1) > 0.3; // 70% chance of being good payer

  // Home Loan (60% chance)
  if (random(2) > 0.4) {
    const amount = 3000000 + Math.floor(random(3) * 5000000); // 30L to 80L
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - Math.floor(random(4) * 8) - 1);

    loans.push({
      bureau_account_id: `HL${pan.substring(0, 5)}${Date.now().toString().slice(-6)}`,
      lender_name: ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'LIC Housing'][Math.floor(random(5) * 5)],
      loan_type: 'HOME',
      account_number: `XXXXX${Math.floor(random(6) * 9000 + 1000)}`,
      sanctioned_amount: amount,
      current_balance: Math.floor(amount * (0.4 + random(7) * 0.5)),
      emi_amount: Math.floor(amount * 0.008),
      tenure_months: 240,
      interest_rate: 8.5 + random(8) * 2,
      disbursement_date: startDate.toISOString().split('T')[0],
      last_payment_date: new Date().toISOString().split('T')[0],
      account_status: 'ACTIVE',
      overdue_amount: isGoodPayer ? 0 : Math.floor(random(9) * 50000),
      dpd_days: isGoodPayer ? 0 : Math.floor(random(10) * 30),
      payment_history: generatePaymentHistory(isGoodPayer, startDate)
    });
  }

  // Personal Loan (40% chance)
  if (random(11) > 0.6) {
    const amount = 200000 + Math.floor(random(12) * 800000); // 2L to 10L
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - Math.floor(random(13) * 3));

    loans.push({
      bureau_account_id: `PL${pan.substring(0, 5)}${Date.now().toString().slice(-6)}`,
      lender_name: ['Bajaj Finance', 'HDFC Bank', 'ICICI Bank', 'Kotak Bank', 'Tata Capital'][Math.floor(random(14) * 5)],
      loan_type: 'PERSONAL',
      account_number: `XXXXX${Math.floor(random(15) * 9000 + 1000)}`,
      sanctioned_amount: amount,
      current_balance: Math.floor(amount * (0.2 + random(16) * 0.6)),
      emi_amount: Math.floor(amount * 0.025),
      tenure_months: 48,
      interest_rate: 12 + random(17) * 6,
      disbursement_date: startDate.toISOString().split('T')[0],
      last_payment_date: new Date().toISOString().split('T')[0],
      account_status: 'ACTIVE',
      overdue_amount: isGoodPayer ? 0 : Math.floor(random(18) * 20000),
      dpd_days: isGoodPayer ? 0 : Math.floor(random(19) * 15),
      payment_history: generatePaymentHistory(isGoodPayer, startDate)
    });
  }

  // Credit Card (80% chance)
  if (random(20) > 0.2) {
    const limit = 100000 + Math.floor(random(21) * 400000); // 1L to 5L
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - Math.floor(random(22) * 5) - 1);

    loans.push({
      bureau_account_id: `CC${pan.substring(0, 5)}${Date.now().toString().slice(-6)}`,
      lender_name: ['HDFC Bank', 'SBI Card', 'ICICI Bank', 'Axis Bank', 'Citibank'][Math.floor(random(23) * 5)],
      loan_type: 'CREDIT_CARD',
      account_number: `XXXX-XXXX-XXXX-${Math.floor(random(24) * 9000 + 1000)}`,
      sanctioned_amount: limit,
      current_balance: Math.floor(limit * random(25) * 0.8),
      emi_amount: 0, // Credit cards don't have fixed EMI
      tenure_months: 0,
      interest_rate: 36 + random(26) * 6,
      disbursement_date: startDate.toISOString().split('T')[0],
      last_payment_date: new Date().toISOString().split('T')[0],
      account_status: 'ACTIVE',
      overdue_amount: isGoodPayer ? 0 : Math.floor(random(27) * 30000),
      dpd_days: isGoodPayer ? 0 : Math.floor(random(28) * 20),
      payment_history: generatePaymentHistory(isGoodPayer, startDate)
    });
  }

  // Auto Loan (30% chance)
  if (random(29) > 0.7) {
    const amount = 500000 + Math.floor(random(30) * 1500000); // 5L to 20L
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - Math.floor(random(31) * 4));

    loans.push({
      bureau_account_id: `AL${pan.substring(0, 5)}${Date.now().toString().slice(-6)}`,
      lender_name: ['HDFC Bank', 'ICICI Bank', 'Maruti Finance', 'Mahindra Finance', 'Cholamandalam'][Math.floor(random(32) * 5)],
      loan_type: 'AUTO',
      account_number: `XXXXX${Math.floor(random(33) * 9000 + 1000)}`,
      sanctioned_amount: amount,
      current_balance: Math.floor(amount * (0.3 + random(34) * 0.5)),
      emi_amount: Math.floor(amount * 0.018),
      tenure_months: 60,
      interest_rate: 9 + random(35) * 4,
      disbursement_date: startDate.toISOString().split('T')[0],
      last_payment_date: new Date().toISOString().split('T')[0],
      account_status: 'ACTIVE',
      overdue_amount: isGoodPayer ? 0 : Math.floor(random(36) * 25000),
      dpd_days: isGoodPayer ? 0 : Math.floor(random(37) * 10),
      payment_history: generatePaymentHistory(isGoodPayer, startDate)
    });
  }

  // Closed loan (50% chance)
  if (random(38) > 0.5) {
    const amount = 300000 + Math.floor(random(39) * 700000);
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 5);
    const closureDate = new Date();
    closureDate.setFullYear(closureDate.getFullYear() - 1);

    loans.push({
      bureau_account_id: `CL${pan.substring(0, 5)}${Date.now().toString().slice(-6)}`,
      lender_name: ['HDFC Bank', 'SBI', 'Bajaj Finance', 'Tata Capital'][Math.floor(random(40) * 4)],
      loan_type: 'PERSONAL',
      account_number: `XXXXX${Math.floor(random(41) * 9000 + 1000)}`,
      sanctioned_amount: amount,
      current_balance: 0,
      emi_amount: Math.floor(amount * 0.025),
      tenure_months: 36,
      interest_rate: 14 + random(42) * 4,
      disbursement_date: startDate.toISOString().split('T')[0],
      last_payment_date: closureDate.toISOString().split('T')[0],
      closure_date: closureDate.toISOString().split('T')[0],
      account_status: 'CLOSED',
      overdue_amount: 0,
      dpd_days: 0,
      payment_history: generatePaymentHistory(true, startDate)
    });
  }

  return loans;
}

// Generate mock enquiries
function generateMockEnquiries(pan: string): CreditEnquiry[] {
  const seed = pan.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (n: number) => ((seed * n) % 100) / 100;

  const enquiries: CreditEnquiry[] = [];
  const count = Math.floor(random(100) * 4) + 1; // 1-4 enquiries

  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - Math.floor(random(101 + i) * 12));

    enquiries.push({
      enquiry_date: date.toISOString().split('T')[0],
      enquirer_name: ['HDFC Bank', 'ICICI Bank', 'Bajaj Finance', 'SBI', 'Axis Bank'][Math.floor(random(102 + i) * 5)],
      enquiry_purpose: ['Home Loan', 'Personal Loan', 'Credit Card', 'Auto Loan'][Math.floor(random(103 + i) * 4)],
      amount_requested: Math.floor(random(104 + i) * 5000000) + 100000
    });
  }

  return enquiries;
}

// Calculate credit score based on loans
function calculateMockCreditScore(pan: string, loans: CreditBureauLoanRaw[]): number {
  const seed = pan.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseScore = 650 + Math.floor((seed % 200)); // 650-850 base

  let score = baseScore;

  // Adjust based on payment history
  for (const loan of loans) {
    if (loan.payment_history) {
      const onTimePayments = loan.payment_history.filter(p => p.status === 'ON_TIME').length;
      const latePayments = loan.payment_history.filter(p => p.status === 'LATE').length;
      const missedPayments = loan.payment_history.filter(p => p.status === 'MISSED').length;

      score += onTimePayments * 2;
      score -= latePayments * 5;
      score -= missedPayments * 15;
    }

    // Adjust for overdue
    if (loan.overdue_amount && loan.overdue_amount > 0) {
      score -= 20;
    }
    if (loan.dpd_days && loan.dpd_days > 30) {
      score -= 30;
    }
  }

  // Clamp to valid range
  return Math.max(300, Math.min(900, score));
}

export class MockCreditBureauProvider implements ICreditBureauProvider {
  name: 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF' = 'CIBIL';

  constructor(bureauName?: 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF') {
    if (bureauName) {
      this.name = bureauName;
    }
  }

  async fetchCreditReport(
    pan: string,
    config: CreditBureauProviderConfig
  ): Promise<CreditReport> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Validate PAN format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan)) {
      throw new Error('Invalid PAN format');
    }

    // Generate mock data
    const loans = generateMockLoans(pan);
    const enquiries = generateMockEnquiries(pan);
    const creditScore = calculateMockCreditScore(pan, loans);

    return {
      credit_score: creditScore,
      score_date: new Date().toISOString(),
      loans,
      enquiries,
      raw_response: {
        provider: this.name,
        is_mock: true,
        generated_at: new Date().toISOString(),
        pan_masked: `${pan.substring(0, 2)}XXXXX${pan.substring(7)}`
      }
    };
  }
}

// Export singleton instance
export const mockProvider = new MockCreditBureauProvider();
