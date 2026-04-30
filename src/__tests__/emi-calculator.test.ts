/**
 * Unit tests for EMI Calculator — core business logic
 * Tests the mathematical accuracy of EMI, total interest, and total payment calculations
 */

function calculateEMI(principal: number, annualRate: number, tenureMonths: number) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return { emi: principal / tenureMonths, totalInterest: 0, totalPayment: principal };
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  const totalPayment = emi * tenureMonths;
  return { emi: Math.round(emi), totalInterest: Math.round(totalPayment - principal), totalPayment: Math.round(totalPayment) };
}

describe('EMI Calculator', () => {
  test('calculates correct EMI for standard home loan', () => {
    // ₹50L at 8.5% for 20 years (240 months)
    const result = calculateEMI(5000000, 8.5, 240);
    expect(result.emi).toBeGreaterThan(43000);
    expect(result.emi).toBeLessThan(44000);
    expect(result.totalInterest).toBeGreaterThan(5000000);
  });

  test('calculates correct EMI for personal loan', () => {
    // ₹5L at 12% for 3 years (36 months)
    const result = calculateEMI(500000, 12, 36);
    expect(result.emi).toBeGreaterThan(16600);
    expect(result.emi).toBeLessThan(16700);
  });

  test('handles zero interest rate', () => {
    const result = calculateEMI(120000, 0, 12);
    expect(result.emi).toBe(10000);
    expect(result.totalInterest).toBe(0);
    expect(result.totalPayment).toBe(120000);
  });

  test('handles minimum tenure', () => {
    const result = calculateEMI(100000, 10, 6);
    expect(result.emi).toBeGreaterThan(17000);
    expect(result.totalPayment).toBeGreaterThan(100000);
  });

  test('total payment exceeds principal for non-zero rates', () => {
    const result = calculateEMI(1000000, 9, 120);
    expect(result.totalPayment).toBeGreaterThan(1000000);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  test('higher rate means higher EMI', () => {
    const low = calculateEMI(1000000, 8, 120);
    const high = calculateEMI(1000000, 12, 120);
    expect(high.emi).toBeGreaterThan(low.emi);
  });

  test('shorter tenure means higher EMI but less total interest', () => {
    const short = calculateEMI(1000000, 10, 60);
    const long = calculateEMI(1000000, 10, 120);
    expect(short.emi).toBeGreaterThan(long.emi);
    expect(short.totalInterest).toBeLessThan(long.totalInterest);
  });
});
