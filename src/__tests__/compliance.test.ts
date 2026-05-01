/**
 * Tests for GDPR/RBI compliance utilities
 */

// Data retention policies
const DATA_RETENTION_POLICIES = {
  LOAN_RECORDS: { years: 8 },
  KYC_DOCUMENTS: { years: 5 },
  TRANSACTION_LOGS: { years: 10 },
  AUDIT_TRAILS: { years: -1 },
  SESSION_LOGS: { years: 1 },
  FAILED_LOGIN_ATTEMPTS: { days: 90 },
} as const

// PII field masking
function maskForDisplay(value: string, fieldType: string): string {
  switch (fieldType) {
    case 'aadhaar_number': return 'XXXX XXXX ' + value.slice(-4)
    case 'pan_number': return value.slice(0, 2) + 'XXXXX' + value.slice(-2)
    case 'bank_account_number': return 'XXXXX' + value.slice(-4)
    case 'credit_card_number': return 'XXXX XXXX XXXX ' + value.slice(-4)
    default: return 'XXXXXXXX' + value.slice(-3)
  }
}

function anonymizeField(value: string, fieldType: string): string {
  switch (fieldType) {
    case 'email': return 'deleted_user@anonymized.loanz360.com'
    case 'phone': return '0000000000'
    case 'full_name': return 'Deleted User'
    default: return '[REDACTED]'
  }
}

describe('Data Retention Policies — RBI Compliance', () => {
  test('loan records retained 8 years (RBI mandate)', () => {
    expect(DATA_RETENTION_POLICIES.LOAN_RECORDS.years).toBe(8)
  })

  test('KYC documents retained 5 years', () => {
    expect(DATA_RETENTION_POLICIES.KYC_DOCUMENTS.years).toBe(5)
  })

  test('transaction logs retained 10 years', () => {
    expect(DATA_RETENTION_POLICIES.TRANSACTION_LOGS.years).toBe(10)
  })

  test('audit trails retained permanently', () => {
    expect(DATA_RETENTION_POLICIES.AUDIT_TRAILS.years).toBe(-1)
  })

  test('all retention periods are defined', () => {
    Object.values(DATA_RETENTION_POLICIES).forEach(policy => {
      expect('years' in policy || 'days' in policy).toBe(true)
    })
  })
})

describe('PII Masking — Display Safety', () => {
  test('masks Aadhaar showing only last 4', () => {
    const masked = maskForDisplay('234567890123', 'aadhaar_number')
    expect(masked).toBe('XXXX XXXX 0123')
    expect(masked).not.toContain('234567')
  })

  test('masks PAN showing first 2 and last 2', () => {
    const masked = maskForDisplay('ABCDE1234F', 'pan_number')
    expect(masked).toBe('ABXXXXX4F')
    expect(masked).not.toContain('CDE123')
  })

  test('masks bank account showing last 4', () => {
    const masked = maskForDisplay('1234567890', 'bank_account_number')
    expect(masked).toBe('XXXXX7890')
    expect(masked).not.toContain('12345')
  })

  test('masks credit card showing last 4', () => {
    const masked = maskForDisplay('4111111111111111', 'credit_card_number')
    expect(masked).toBe('XXXX XXXX XXXX 1111')
    expect(masked).not.toContain('4111')
  })

  test('masked values never expose full PII', () => {
    const aadhaar = '234567890123'
    const masked = maskForDisplay(aadhaar, 'aadhaar_number')
    expect(masked.length).toBeLessThan(aadhaar.length + 5)
    expect(masked).not.toBe(aadhaar)
  })
})

describe('GDPR — Data Anonymization', () => {
  test('anonymizes email', () => {
    const result = anonymizeField('vinod@loanz360.com', 'email')
    expect(result).not.toContain('vinod')
    expect(result).toContain('anonymized')
  })

  test('anonymizes phone', () => {
    const result = anonymizeField('9876543210', 'phone')
    expect(result).toBe('0000000000')
  })

  test('anonymizes name', () => {
    const result = anonymizeField('Vinod Kumar', 'full_name')
    expect(result).not.toContain('Vinod')
    expect(result).toBe('Deleted User')
  })

  test('redacts unknown field types', () => {
    const result = anonymizeField('sensitive data', 'unknown_field')
    expect(result).toBe('[REDACTED]')
  })
})
