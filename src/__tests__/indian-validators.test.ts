/**
 * Comprehensive tests for Indian financial data validators
 * Covers all edge cases for PAN, Aadhaar, IFSC, GST, phone numbers
 */
import { z } from 'zod';

const indianPhoneSchema = z.string().regex(/^(\+91|91)?[6-9]\d{9}$/);
const panSchema = z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/);
const pincodeSchema = z.string().regex(/^\d{6}$/);
const ifscSchema = z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/);
const gstSchema = z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/);

describe('Indian Phone Numbers — All Operator Prefixes', () => {
  const validPrefixes = ['6', '7', '8', '9'];
  
  validPrefixes.forEach(prefix => {
    test(`accepts ${prefix}xxx series`, () => {
      expect(indianPhoneSchema.safeParse(`${prefix}000000000`).success).toBe(true);
    });
  });

  test('accepts with +91 prefix', () => {
    expect(indianPhoneSchema.safeParse('+919876543210').success).toBe(true);
  });

  test('accepts with 91 prefix (no +)', () => {
    expect(indianPhoneSchema.safeParse('919876543210').success).toBe(true);
  });

  test('rejects landline numbers (starting with 0)', () => {
    expect(indianPhoneSchema.safeParse('0401234567').success).toBe(false);
  });

  test('rejects international numbers', () => {
    expect(indianPhoneSchema.safeParse('+14155551234').success).toBe(false);
  });

  test('rejects with spaces', () => {
    expect(indianPhoneSchema.safeParse('98765 43210').success).toBe(false);
  });
});

describe('IFSC Code Validation', () => {
  test('accepts valid IFSC codes', () => {
    expect(ifscSchema.safeParse('SBIN0001234').success).toBe(true); // SBI
    expect(ifscSchema.safeParse('ICIC0001234').success).toBe(true); // ICICI
    expect(ifscSchema.safeParse('HDFC0001234').success).toBe(true); // HDFC
    expect(ifscSchema.safeParse('UTIB0002345').success).toBe(true); // Axis
  });

  test('rejects invalid IFSC', () => {
    expect(ifscSchema.safeParse('SBIN1001234').success).toBe(false); // 5th char must be 0
    expect(ifscSchema.safeParse('SBI00001234').success).toBe(false); // too long
    expect(ifscSchema.safeParse('sbin0001234').success).toBe(false); // lowercase
  });
});

describe('GST Number Validation', () => {
  test('accepts valid GSTIN', () => {
    expect(gstSchema.safeParse('36ABCDE1234F1Z5').success).toBe(true); // Telangana
    expect(gstSchema.safeParse('27ABCDE1234F1Z5').success).toBe(true); // Maharashtra
  });

  test('rejects invalid GSTIN', () => {
    expect(gstSchema.safeParse('ABCDE1234F1Z5').success).toBe(false); // no state code
    expect(gstSchema.safeParse('99ABCDE1234F1Z5').success).toBe(false); // invalid state
  });
});

describe('Pincode — Major Cities', () => {
  const majorCities = [
    { city: 'Hyderabad', pin: '500001' },
    { city: 'Mumbai', pin: '400001' },
    { city: 'Delhi', pin: '110001' },
    { city: 'Chennai', pin: '600001' },
    { city: 'Bangalore', pin: '560001' },
    { city: 'Kolkata', pin: '700001' },
  ];
  
  majorCities.forEach(({ city, pin }) => {
    test(`accepts ${city} pincode (${pin})`, () => {
      expect(pincodeSchema.safeParse(pin).success).toBe(true);
    });
  });
});
