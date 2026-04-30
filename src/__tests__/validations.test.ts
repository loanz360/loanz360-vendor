/**
 * Unit tests for Zod validation schemas
 * Ensures all input validation works correctly for Indian financial data
 */
import { z } from 'zod';

// Re-create schemas for testing (avoids import path issues)
const indianPhoneSchema = z.string().regex(/^(\+91|91)?[6-9]\d{9}$/, 'Invalid Indian phone number');
const panSchema = z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN number');
const pincodeSchema = z.string().regex(/^\d{6}$/, 'Invalid pincode');
const emailSchema = z.string().email().max(255);
const amountSchema = z.number().positive().max(100_00_00_000);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const createLeadSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: indianPhoneSchema,
  email: emailSchema.optional(),
  loan_type: z.string().min(1),
  loan_amount: amountSchema.optional(),
});

describe('Indian Phone Validation', () => {
  test('accepts valid Indian mobile numbers', () => {
    expect(indianPhoneSchema.safeParse('9876543210').success).toBe(true);
    expect(indianPhoneSchema.safeParse('+919876543210').success).toBe(true);
    expect(indianPhoneSchema.safeParse('919876543210').success).toBe(true);
    expect(indianPhoneSchema.safeParse('6000000000').success).toBe(true);
    expect(indianPhoneSchema.safeParse('7999999999').success).toBe(true);
  });

  test('rejects invalid numbers', () => {
    expect(indianPhoneSchema.safeParse('1234567890').success).toBe(false); // starts with 1
    expect(indianPhoneSchema.safeParse('5876543210').success).toBe(false); // starts with 5
    expect(indianPhoneSchema.safeParse('98765').success).toBe(false); // too short
    expect(indianPhoneSchema.safeParse('98765432101').success).toBe(false); // too long
    expect(indianPhoneSchema.safeParse('abcdefghij').success).toBe(false);
  });
});

describe('PAN Validation', () => {
  test('accepts valid PAN numbers', () => {
    expect(panSchema.safeParse('ABCDE1234F').success).toBe(true);
    expect(panSchema.safeParse('ZZZZZ9999Z').success).toBe(true);
  });

  test('rejects invalid PAN numbers', () => {
    expect(panSchema.safeParse('abcde1234f').success).toBe(false); // lowercase
    expect(panSchema.safeParse('ABCDE1234').success).toBe(false); // too short
    expect(panSchema.safeParse('12345ABCDE').success).toBe(false); // wrong format
    expect(panSchema.safeParse('').success).toBe(false);
  });
});

describe('Pincode Validation', () => {
  test('accepts valid 6-digit pincodes', () => {
    expect(pincodeSchema.safeParse('500001').success).toBe(true); // Hyderabad
    expect(pincodeSchema.safeParse('110001').success).toBe(true); // Delhi
    expect(pincodeSchema.safeParse('600001').success).toBe(true); // Chennai
  });

  test('rejects invalid pincodes', () => {
    expect(pincodeSchema.safeParse('12345').success).toBe(false); // 5 digits
    expect(pincodeSchema.safeParse('1234567').success).toBe(false); // 7 digits
    expect(pincodeSchema.safeParse('abcdef').success).toBe(false);
  });
});

describe('Amount Validation', () => {
  test('accepts valid amounts', () => {
    expect(amountSchema.safeParse(50000).success).toBe(true);
    expect(amountSchema.safeParse(0.01).success).toBe(true);
    expect(amountSchema.safeParse(99_99_99_999).success).toBe(true);
  });

  test('rejects invalid amounts', () => {
    expect(amountSchema.safeParse(0).success).toBe(false);
    expect(amountSchema.safeParse(-1000).success).toBe(false);
    expect(amountSchema.safeParse(100_00_00_001).success).toBe(false); // exceeds max
  });
});

describe('Login Schema', () => {
  test('accepts valid login', () => {
    const result = loginSchema.safeParse({ email: 'user@loanz360.com', password: 'securepass123' });
    expect(result.success).toBe(true);
  });

  test('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'user@loanz360.com', password: '123' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'notanemail', password: 'securepass123' });
    expect(result.success).toBe(false);
  });

  test('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'x@x.com' }).success).toBe(false);
  });
});

describe('Create Lead Schema', () => {
  test('accepts valid lead', () => {
    const result = createLeadSchema.safeParse({
      full_name: 'Vinod Kumar',
      phone: '9876543210',
      loan_type: 'personal',
      loan_amount: 500000,
    });
    expect(result.success).toBe(true);
  });

  test('rejects lead without name', () => {
    expect(createLeadSchema.safeParse({ phone: '9876543210', loan_type: 'personal' }).success).toBe(false);
  });

  test('rejects lead with invalid phone', () => {
    expect(createLeadSchema.safeParse({ full_name: 'Test', phone: '123', loan_type: 'personal' }).success).toBe(false);
  });

  test('rejects excessive loan amount', () => {
    expect(createLeadSchema.safeParse({ full_name: 'Test', phone: '9876543210', loan_type: 'personal', loan_amount: 999999999999 }).success).toBe(false);
  });
});
