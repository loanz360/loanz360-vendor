# Credit Appraisal Engine (CAE) Module

A comprehensive credit appraisal system for loan processing with multi-provider credit bureau integration, identity verification, income verification, document OCR, and configurable business rules.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Core Services](#core-services)
- [Credit Bureau Adapters](#credit-bureau-adapters)
- [Verification Adapters](#verification-adapters)
- [Validation Engine](#validation-engine)
- [Rules Engine](#rules-engine)
- [OCR Service](#ocr-service)
- [Security](#security)
- [API Routes](#api-routes)
- [Database Schema](#database-schema)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The CAE module provides end-to-end credit appraisal functionality:

- **Multi-provider Credit Bureau Integration**: CIBIL, Experian, Equifax
- **Identity Verification**: DigiLocker, Aadhar e-KYC
- **Income Verification**: GST, ITR
- **Document OCR**: AWS Textract, Google Doc AI, Azure Form Recognizer
- **Business Rules Engine**: Configurable eligibility, risk, pricing, and compliance rules
- **Data Validation**: Field-level validation with sanitization
- **Security**: AES-256-GCM encryption, data masking, audit logging

---

## Architecture

```
src/lib/cae/
├── index.ts                    # Main exports
├── types.ts                    # Type definitions
├── cae-service.ts              # Main orchestration service
├── cam-service.ts              # Credit Appraisal Memo generation
├── validation-engine.ts        # Data validation
├── rules-engine.ts             # Business rules evaluation
├── ocr-service.ts              # Document OCR processing
├── security.ts                 # Encryption & security utilities
├── document-intelligence.ts    # Document analysis
├── provider-adapter.ts         # Provider factory
└── adapters/
    ├── index.ts                # Adapter exports
    ├── base-adapter.ts         # Base adapter class
    ├── mock-adapter.ts         # Mock adapter for testing
    ├── cibil-adapter.ts        # TransUnion CIBIL
    ├── experian-adapter.ts     # Experian India
    ├── equifax-adapter.ts      # Equifax India
    ├── digilocker-adapter.ts   # DigiLocker verification
    └── gst-itr-adapter.ts      # GST/ITR verification
```

---

## Installation

The module is part of the main application. No separate installation required.

### Environment Variables

Add the following to your `.env.local`:

```env
# Credit Appraisal Engine (CAE) Configuration
# CRITICAL: Required for encrypting CAE API keys and sensitive credit data
# PRODUCTION: Use AWS KMS, Azure Key Vault, or HashiCorp Vault
CAE_ENCRYPTION_KEY=<your-32-byte-base64-key>
```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Configuration

### Provider Configuration

Providers can be configured in the database (`cae_providers` table) or programmatically:

```typescript
import { CAEService } from '@/lib/cae'

const caeService = new CAEService()

// Register custom provider
caeService.registerAdapter(new CIBILAdapter({
  id: 'cibil-production',
  name: 'CIBIL Production',
  provider_type: 'CIBIL',
  is_active: true,
  priority: 1,
  timeout_ms: 30000,
  retry_count: 3,
  config: {
    member_id: process.env.CIBIL_MEMBER_ID,
    password: process.env.CIBIL_PASSWORD,
    environment: 'production',
  },
}))
```

### Available Providers

| Provider | Type | Status | Environment |
|----------|------|--------|-------------|
| Mock | MOCK | Active | sandbox |
| TransUnion CIBIL | CIBIL | Active | sandbox/production |
| Experian India | EXPERIAN | Active | sandbox/production |
| Equifax India | EQUIFAX | Active | sandbox/production |
| DigiLocker | DIGILOCKER | Active | sandbox/production |
| GST/ITR | GST_ITR | Active | sandbox/production |

---

## Core Services

### CAEService

Main orchestration service for credit appraisals.

```typescript
import { caeService } from '@/lib/cae'

// Process appraisal for a lead
const result = await caeService.processAppraisal(leadId, 'CIBIL', {
  skipValidation: false,
  userId: currentUser.id,
})

if (result.success) {
  console.log('Appraisal ID:', result.appraisalId)
} else {
  console.error('Error:', result.error)
  console.error('Validation errors:', result.validationErrors)
}

// Get appraisal status
const status = await caeService.getAppraisalStatus(appraisalId)

// Get appraisal by lead
const appraisal = await caeService.getAppraisalByLeadId(leadId)

// Retry failed appraisal
const retryResult = await caeService.retryAppraisal(appraisalId)

// Get available providers
const providers = caeService.getAvailableProviders()
// ['MOCK', 'CIBIL', 'EXPERIAN', 'EQUIFAX']
```

### CAM Service

Generates Credit Appraisal Memos (CAM).

```typescript
import { createCAMService } from '@/lib/cae'

const camService = createCAMService(supabase)

// Generate CAM for a lead
const cam = await camService.generateCAM(leadId, {
  includeRawData: false,
  format: 'detailed',
})

// CAM structure
interface CreditAppraisalMemo {
  cam_id: string
  lead_id: string
  generated_at: string

  customer_profile: {...}
  loan_details: {...}
  credit_analysis: {...}
  income_analysis: {...}
  risk_assessment: {...}
  eligibility_analysis: {...}
  document_verification: {...}
  recommendation: {...}

  flags: CAEFlag[]
  alerts: CAEAlert[]
}
```

---

## Credit Bureau Adapters

### CIBIL Adapter

```typescript
import { CIBILAdapter } from '@/lib/cae/adapters'

const adapter = new CIBILAdapter({
  id: 'cibil-prod',
  name: 'CIBIL',
  provider_type: 'CIBIL',
  is_active: true,
  priority: 1,
  timeout_ms: 30000,
  retry_count: 2,
  config: {
    member_id: 'YOUR_MEMBER_ID',
    password: 'YOUR_PASSWORD',
    product_type: 'CIR',
    environment: 'production', // or 'sandbox'
  },
})

const response = await adapter.processAppraisal(request)
```

### Experian Adapter

```typescript
import { ExperianAdapter } from '@/lib/cae/adapters'

const adapter = new ExperianAdapter({
  id: 'experian-prod',
  name: 'Experian',
  provider_type: 'EXPERIAN',
  is_active: true,
  priority: 2,
  timeout_ms: 30000,
  retry_count: 2,
  config: {
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    environment: 'production',
  },
})
```

### Equifax Adapter

```typescript
import { EquifaxAdapter } from '@/lib/cae/adapters'

const adapter = new EquifaxAdapter({
  id: 'equifax-prod',
  name: 'Equifax',
  provider_type: 'EQUIFAX',
  is_active: true,
  priority: 3,
  timeout_ms: 30000,
  retry_count: 2,
  config: {
    customer_id: 'YOUR_CUSTOMER_ID',
    api_key: 'YOUR_API_KEY',
    client_id: 'YOUR_CLIENT_ID',
    environment: 'production',
  },
})
```

### Response Structure

All credit bureau adapters return a standardized `CAEResponse`:

```typescript
interface CAEResponse {
  success: boolean
  provider: CAEProviderType
  request_id: string
  timestamp: string
  processing_time_ms: number
  data?: CAEResult
  error?: string
  error_code?: string
}

interface CAEResult {
  credit_score: number
  credit_score_range: { min: number; max: number }
  risk_grade: RiskGrade  // 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  risk_score: number

  eligible_loan_amount: number
  max_loan_amount: number
  recommended_tenure_months: number
  recommended_interest_rate: number

  emi_capacity: number
  foir: number
  ltv?: number
  dti: number

  bureau_data: {
    total_accounts: number
    active_accounts: number
    overdue_accounts: number
    written_off_accounts: number
    enquiries_last_6_months: number
    enquiries_last_12_months: number
    dpd_30_plus_count: number
    dpd_60_plus_count: number
    dpd_90_plus_count: number
    oldest_account_age_months: number
    total_outstanding: number
    total_emis: number
  }

  income_assessment: {
    declared_income: number
    income_source: string
    stability_score: number
    income_documents_required: string[]
  }

  flags: CAEFlag[]
  alerts: CAEAlert[]
  recommendation: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'REFER' | 'DECLINE'
  recommendation_notes: string[]
  conditions?: string[]

  raw_response?: any
}
```

---

## Verification Adapters

### DigiLocker Adapter

```typescript
import { createDigiLockerAdapter } from '@/lib/cae/adapters'

const digilocker = createDigiLockerAdapter({
  client_id: process.env.DIGILOCKER_CLIENT_ID,
  client_secret: process.env.DIGILOCKER_CLIENT_SECRET,
  environment: 'production',
})

// Verify PAN
const panResult = await digilocker.verifyDocument('PAN', {
  pan_number: 'ABCDE1234F',
  full_name: 'John Doe',
  date_of_birth: '1990-01-15',
})

// Verify Aadhar via e-KYC
const ekycResult = await digilocker.initiateEKYC({
  aadhar_number: '123456789012',
  consent: true,
})

// Complete OTP verification
const verifiedResult = await digilocker.completeEKYC(ekycResult.session_id, otp)
```

### GST/ITR Adapter

```typescript
import { createGSTITRAdapter } from '@/lib/cae/adapters'

const gstItr = createGSTITRAdapter({
  api_key: process.env.GST_API_KEY,
  environment: 'production',
})

// Verify GST
const gstResult = await gstItr.verifyGST({
  gstin: '22AAAAA0000A1Z5',
  consent: true,
})

// Verify ITR
const itrResult = await gstItr.verifyITR({
  pan: 'ABCDE1234F',
  assessment_year: '2024-25',
  consent: true,
})

// Get ITR history
const itrHistory = await gstItr.getITRHistory('ABCDE1234F', 3) // last 3 years
```

---

## Validation Engine

Validates and sanitizes CAE request data.

```typescript
import { createValidationEngine } from '@/lib/cae'

const validationEngine = createValidationEngine(supabase)

const result = await validationEngine.validate(request, {
  sanitize: true,
  loanType: 'PERSONAL_LOAN',
  employmentType: 'SALARIED',
})

if (!result.valid) {
  console.error('Validation errors:', result.errors)
  // [{ field: 'customer_pan', message: 'Invalid PAN format', code: 'FMT_PAN' }]
}

// Access sanitized data
const sanitizedRequest = result.sanitizedData
```

### Field Types Supported

| Field Type | Description | Example |
|------------|-------------|---------|
| STRING | General text | Customer name |
| NUMBER | Numeric values | Loan amount |
| DATE | Date values | Date of birth |
| EMAIL | Email addresses | customer@example.com |
| PHONE | Phone numbers | 9876543210 |
| PAN | PAN card number | ABCDE1234F |
| AADHAR | Aadhar number | 1234 5678 9012 |
| GSTIN | GST number | 22AAAAA0000A1Z5 |
| PINCODE | PIN codes | 400001 |
| BOOLEAN | True/false | is_verified |

### Configuring Validation Rules

Rules are stored in `cae_validation_rules` table:

```sql
INSERT INTO cae_validation_rules (
  rule_code, field_name, field_type, validation_type,
  is_required, min_value, max_value, pattern, error_message, priority
) VALUES (
  'CUSTOM_MIN_LOAN', 'loan_amount', 'NUMBER', 'RANGE',
  false, 50000, null, null, 'Minimum loan amount is ₹50,000', 100
);
```

---

## Rules Engine

Evaluates business rules for eligibility, risk, pricing, and compliance.

```typescript
import { createRulesEngine, RULE_TEMPLATES } from '@/lib/cae'

const rulesEngine = createRulesEngine(supabase)

// Evaluate rules
const result = await rulesEngine.evaluateRules({
  request: caeRequest,
  result: bureauResult,
})

console.log('Eligible:', result.eligible)
console.log('Risk score:', result.riskScore)
console.log('Pricing adjustments:', result.pricingAdjustments)
console.log('Triggered rules:', result.triggeredRules)
console.log('Compliance flags:', result.complianceFlags)
```

### Rule Types

| Type | Description |
|------|-------------|
| ELIGIBILITY | Determines if applicant qualifies |
| RISK | Calculates risk factors and adjustments |
| PRICING | Determines interest rate adjustments |
| COMPLIANCE | Checks regulatory requirements |
| SCORING | Calculates custom scores |

### Pre-built Rule Templates

```typescript
import { RULE_TEMPLATES } from '@/lib/cae'

// Available templates:
RULE_TEMPLATES.MIN_CREDIT_SCORE      // Minimum credit score check
RULE_TEMPLATES.MAX_FOIR              // Maximum FOIR limit
RULE_TEMPLATES.MIN_INCOME            // Minimum income requirement
RULE_TEMPLATES.MAX_AGE               // Maximum age limit
RULE_TEMPLATES.NO_WRITTEN_OFF        // No written-off accounts
RULE_TEMPLATES.MAX_ENQUIRIES         // Maximum recent enquiries
RULE_TEMPLATES.MIN_EMPLOYMENT_YEARS  // Minimum employment duration
```

### Adding Custom Rules

Rules can be added to `cae_business_rules` table:

```sql
INSERT INTO cae_business_rules (
  rule_code, rule_name, rule_type, conditions, actions, priority, is_active
) VALUES (
  'HIGH_VALUE_LOAN_CHECK',
  'High Value Loan Additional Verification',
  'COMPLIANCE',
  '[{"field": "loan_amount", "operator": "gt", "value": 5000000}]',
  '{"action": "flag", "message": "High value loan - requires additional verification"}',
  10,
  true
);
```

---

## OCR Service

Processes documents using OCR providers.

```typescript
import { createOCRService } from '@/lib/cae'

const ocrService = createOCRService({
  provider: 'TEXTRACT', // or 'GOOGLE_DOC_AI', 'AZURE_FORM'
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

// Process document
const result = await ocrService.processDocument({
  documentType: 'PAN_CARD',
  file: fileBuffer,
  fileName: 'pan_card.jpg',
  mimeType: 'image/jpeg',
})

console.log('Extracted fields:', result.fields)
// [{ name: 'pan_number', value: 'ABCDE1234F', confidence: 0.98 }]

// Verify document
const verification = await ocrService.verifyDocument(result, {
  expectedPAN: 'ABCDE1234F',
  expectedName: 'John Doe',
})
```

### Supported Document Types

| Category | Document Types |
|----------|---------------|
| IDENTITY | PAN Card, Aadhar Card, Passport, Driving License, Voter ID |
| ADDRESS | Utility Bill, Rent Agreement, Passport, Aadhar |
| INCOME | Salary Slip, Bank Statement, Form 16, ITR |
| BANK_STATEMENT | Bank Statements (PDF/Scanned) |
| PROPERTY | Property Documents, Sale Deed, NOC |
| BUSINESS | GST Certificate, Business Registration, MSME Certificate |
| TAX | ITR, Form 26AS, Tax Challan |

---

## Security

### Encryption

```typescript
import { encrypt, decrypt, hash, generateSecureToken } from '@/lib/cae'

// Encrypt sensitive data
const encrypted = encrypt('sensitive-api-key')
// Returns: 'iv:authTag:encryptedData'

// Decrypt
const decrypted = decrypt(encrypted)

// One-way hash
const hashed = hash('password')

// Generate secure token
const token = generateSecureToken(32) // 64-character hex string
```

### Data Masking

```typescript
import { mask, maskSensitiveData } from '@/lib/cae'

// Individual field masking
mask.pan('ABCDE1234F')      // 'AB****4F'
mask.aadhar('123456789012') // '****-****-9012'
mask.mobile('9876543210')   // '******3210'
mask.email('user@example.com') // 'u***r@example.com'
mask.accountNumber('1234567890') // '******7890'
mask.name('John Doe')       // 'J*** D**'
mask.gstin('22AAAAA0000A1Z5') // '22****Z5'

// Mask entire object
const maskedData = maskSensitiveData({
  customer_name: 'John Doe',
  customer_pan: 'ABCDE1234F',
  customer_mobile: '9876543210',
})
// { customer_name: 'J*** D**', customer_pan: 'AB****4F', customer_mobile: '******3210' }
```

### Secure Key Store

```typescript
import { secureKeyStore } from '@/lib/cae'

// Store encrypted key
const encrypted = secureKeyStore.encryptAndStore('cibil-api-key', 'actual-api-key')

// Retrieve and decrypt
const apiKey = secureKeyStore.retrieveAndDecrypt('cibil-api-key', encrypted)

// Clear from cache
secureKeyStore.clearKey('cibil-api-key')
```

### Rate Limiting

```typescript
import { RateLimiter } from '@/lib/cae'

const limiter = new RateLimiter(100, 60000) // 100 requests per minute

const result = limiter.checkLimit('user-123')
if (!result.allowed) {
  console.log(`Rate limited. Retry in ${result.resetIn}ms`)
}
```

### Audit Logging

```typescript
import { auditLogger } from '@/lib/cae'

auditLogger.log({
  action: 'PROCESS_APPRAISAL',
  resourceType: 'LEAD',
  resourceId: 'lead-123',
  userId: 'user-456',
  status: 'SUCCESS',
  metadata: { provider: 'CIBIL', score: 750 },
})

// Get recent logs
const logs = auditLogger.getRecent(50)
```

---

## API Routes

### Process Appraisal

```http
POST /api/cae/process
Content-Type: application/json

{
  "lead_id": "uuid",
  "provider": "CIBIL",  // optional, defaults to MOCK
  "skip_validation": false
}
```

### Get Appraisal Status

```http
GET /api/cae/status/{appraisal_id}
```

### Retry Failed Appraisal

```http
POST /api/cae/retry
Content-Type: application/json

{
  "appraisal_id": "uuid"
}
```

### Generate CAM

```http
POST /api/cae/cam/generate
Content-Type: application/json

{
  "lead_id": "uuid",
  "format": "detailed"
}
```

### Export CAM

```http
POST /api/cae/cam/export
Content-Type: application/json

{
  "cam_id": "uuid",
  "format": "pdf"  // or 'excel', 'json'
}
```

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `credit_appraisals` | Appraisal records and results |
| `cae_providers` | Provider configurations |
| `cae_business_rules` | Business rule definitions |
| `cae_validation_rules` | Validation rule definitions |
| `cae_api_logs` | API call logs |
| `cae_audit_logs` | Audit trail |
| `cae_provider_health_logs` | Provider health checks |
| `cae_encrypted_keys` | Encrypted API keys |
| `document_processing_logs` | OCR processing logs |

### Migrations

Located in `supabase/migrations/`:

1. `20251219_ba_leads_cae_system.sql` - Base tables
2. `20251228_credit_bureau_loans.sql` - Provider and rules tables
3. `20260102_cae_schema_fixes.sql` - Schema refinements
4. `20260102_credit_appraisal_memos.sql` - CAM tables
5. `20260103_cae_validation_and_ocr.sql` - Validation and OCR tables

---

## Usage Examples

### Complete Appraisal Flow

```typescript
import { caeService, createCAMService } from '@/lib/cae'

async function processLoanApplication(leadId: string) {
  // 1. Process credit appraisal
  const appraisalResult = await caeService.processAppraisal(leadId, 'CIBIL')

  if (!appraisalResult.success) {
    throw new Error(appraisalResult.error)
  }

  // 2. Wait for processing (appraisal runs async)
  let status = await caeService.getAppraisalStatus(appraisalResult.appraisalId!)
  while (status?.status === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000))
    status = await caeService.getAppraisalStatus(appraisalResult.appraisalId!)
  }

  // 3. Generate CAM
  const camService = createCAMService(supabase)
  const cam = await camService.generateCAM(leadId)

  return {
    appraisal: status,
    cam,
  }
}
```

### Multi-Bureau Check

```typescript
async function multiProviderCheck(leadId: string) {
  const providers: CAEProviderType[] = ['CIBIL', 'EXPERIAN', 'EQUIFAX']
  const results = await Promise.all(
    providers.map(p => caeService.processAppraisal(leadId, p))
  )

  return results.filter(r => r.success)
}
```

### Custom Validation

```typescript
import { createValidationEngine } from '@/lib/cae'

const engine = createValidationEngine(supabase)

// Validate with custom rules
const result = await engine.validate(request, {
  sanitize: true,
  customRules: [
    {
      field: 'loan_amount',
      validate: (value) => value >= 100000,
      message: 'Minimum loan amount is ₹1,00,000',
    },
  ],
})
```

---

## Troubleshooting

### Common Issues

**1. Validation Errors**
```typescript
// Check validation errors
const result = await caeService.processAppraisal(leadId)
if (result.validationErrors) {
  console.log('Validation failed:', result.validationErrors)
}
```

**2. Provider Timeout**
```typescript
// Increase timeout for slow providers
const adapter = new CIBILAdapter({
  ...config,
  timeout_ms: 60000, // 60 seconds
})
```

**3. Encryption Key Issues**
```bash
# Ensure CAE_ENCRYPTION_KEY is set
echo $CAE_ENCRYPTION_KEY

# Generate new key if needed
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**4. Health Check**
```typescript
// Check provider health
const adapter = caeService.adapters.get('CIBIL')
const health = await adapter?.healthCheck()
console.log('Provider healthy:', health?.healthy)
```

### Logging

Enable debug logging:
```typescript
// All CAE operations log to console with [CAE], [CIBIL], [EXPERIAN], etc. prefixes
// Audit logs are stored in cae_audit_logs table
```

---

## Support

For issues or questions, refer to the main project documentation or contact the development team.

---

*Last updated: January 2026*
