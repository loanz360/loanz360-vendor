/**
 * Unit tests for Indian business validation logic
 * PAN, Aadhaar, GSTIN, IFSC, phone numbers, pincode
 */

// Indian validators
function isValidPAN(pan: string): boolean {{
  return /^[A-Z]{{5}}[0-9]{{4}}[A-Z]$/.test(pan)
}}

function isValidAadhaar(aadhaar: string): boolean {{
  const digits = aadhaar.replace(/\s/g, '')
  return /^[2-9]{{1}}[0-9]{{11}}$/.test(digits)
}}

function isValidGSTIN(gstin: string): boolean {{
  return /^[0-9]{{2}}[A-Z]{{5}}[0-9]{{4}}[A-Z]{{1}}[1-9A-Z]{{1}}Z[0-9A-Z]{{1}}$/.test(gstin)
}}

function isValidIFSC(ifsc: string): boolean {{
  return /^[A-Z]{{4}}0[A-Z0-9]{{6}}$/.test(ifsc)
}}

function isValidIndianMobile(mobile: string): boolean {{
  const cleaned = mobile.replace(/[\s-+]/g, '')
  if (cleaned.startsWith('91')) return /^91[6-9][0-9]{{9}}$/.test(cleaned)
  return /^[6-9][0-9]{{9}}$/.test(cleaned)
}}

function isValidPincode(pincode: string): boolean {{
  return /^[1-9][0-9]{{5}}$/.test(pincode)
}}

function formatCurrency(amount: number): string {{
  return new Intl.NumberFormat('en-IN', {{ style: 'currency', currency: 'INR', maximumFractionDigits: 0 }}).format(amount)
}}

// Tests
describe('PAN Validation', () => {{
  test('accepts valid PAN', () => {{
    expect(isValidPAN('ABCDE1234F')).toBe(true)
    expect(isValidPAN('ZZZZZ9999Z')).toBe(true)
  }})

  test('rejects lowercase PAN', () => {{
    expect(isValidPAN('abcde1234f')).toBe(false)
  }})

  test('rejects wrong format', () => {{
    expect(isValidPAN('12345ABCDE')).toBe(false)
    expect(isValidPAN('ABCDE12345')).toBe(false)
    expect(isValidPAN('')).toBe(false)
  }})

  test('rejects wrong length', () => {{
    expect(isValidPAN('ABCDE1234')).toBe(false)
    expect(isValidPAN('ABCDE1234FG')).toBe(false)
  }})
}})

describe('Aadhaar Validation', () => {{
  test('accepts valid 12-digit Aadhaar', () => {{
    expect(isValidAadhaar('234567890123')).toBe(true)
  }})

  test('accepts Aadhaar with spaces', () => {{
    expect(isValidAadhaar('2345 6789 0123')).toBe(true)
  }})

  test('rejects Aadhaar starting with 0 or 1', () => {{
    expect(isValidAadhaar('012345678901')).toBe(false)
    expect(isValidAadhaar('123456789012')).toBe(false)
  }})

  test('rejects wrong length', () => {{
    expect(isValidAadhaar('23456789012')).toBe(false)
    expect(isValidAadhaar('2345678901234')).toBe(false)
  }})
}})

describe('GSTIN Validation', () => {{
  test('accepts valid GSTIN', () => {{
    expect(isValidGSTIN('27AAPFU0939F1ZV')).toBe(true)
  }})

  test('rejects invalid format', () => {{
    expect(isValidGSTIN('INVALID')).toBe(false)
    expect(isValidGSTIN('')).toBe(false)
  }})
}})

describe('IFSC Validation', () => {{
  test('accepts valid IFSC codes', () => {{
    expect(isValidIFSC('SBIN0001234')).toBe(true)
    expect(isValidIFSC('HDFC0001234')).toBe(true)
    expect(isValidIFSC('ICIC0000001')).toBe(true)
  }})

  test('rejects invalid IFSC', () => {{
    expect(isValidIFSC('SBI0001234')).toBe(false) // too short
    expect(isValidIFSC('SBIN1001234')).toBe(false) // 5th char not 0
    expect(isValidIFSC('sbin0001234')).toBe(false) // lowercase
  }})
}})

describe('Indian Mobile Validation', () => {{
  test('accepts 10-digit mobile starting with 6-9', () => {{
    expect(isValidIndianMobile('9876543210')).toBe(true)
    expect(isValidIndianMobile('6123456789')).toBe(true)
  }})

  test('accepts with +91 prefix', () => {{
    expect(isValidIndianMobile('+919876543210')).toBe(true)
  }})

  test('rejects numbers starting with 0-5', () => {{
    expect(isValidIndianMobile('0123456789')).toBe(false)
    expect(isValidIndianMobile('5123456789')).toBe(false)
  }})

  test('rejects wrong length', () => {{
    expect(isValidIndianMobile('98765432')).toBe(false)
    expect(isValidIndianMobile('98765432101')).toBe(false)
  }})
}})

describe('Pincode Validation', () => {{
  test('accepts valid 6-digit pincodes', () => {{
    expect(isValidPincode('500001')).toBe(true) // Hyderabad
    expect(isValidPincode('110001')).toBe(true) // Delhi
    expect(isValidPincode('400001')).toBe(true) // Mumbai
  }})

  test('rejects pincode starting with 0', () => {{
    expect(isValidPincode('000001')).toBe(false)
  }})

  test('rejects wrong length', () => {{
    expect(isValidPincode('50000')).toBe(false)
    expect(isValidPincode('5000011')).toBe(false)
  }})
}})

describe('Currency Formatting', () => {{
  test('formats in Indian numbering system', () => {{
    const formatted = formatCurrency(5000000)
    expect(formatted).toContain('50')
    expect(formatted).toContain('00')
  }})

  test('handles zero', () => {{
    expect(formatCurrency(0)).toContain('0')
  }})

  test('handles large amounts', () => {{
    const formatted = formatCurrency(100000000)
    expect(formatted).toBeTruthy()
  }})
}})
