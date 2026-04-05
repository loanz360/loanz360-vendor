# Universal Loan Application Form Module (ULAFM)

## Overview

The Universal Loan Application Form Module is a reusable, configurable loan application system designed to work across all user roles (employees, partners, business associates, customers, etc.) within the Loanz360 platform.

## Features

- **Role-Agnostic Design**: Works for any user type without modification
- **Full Attribution Tracking**: Every application is traceable to its source
- **Secure Referral Links**: Tamper-proof tokens with optional expiry
- **Mobile-First UI**: Responsive, fintech-grade design
- **Extensible Architecture**: Easy to add fields, steps, or features
- **Real-time Validation**: Zod-powered form validation

## Architecture

```
src/
├── components/ulafm/
│   ├── UniversalLoanApplicationForm.tsx  # Main form component
│   ├── ShareLoanFormButton.tsx           # Share button component
│   ├── ShareLoanFormModal.tsx            # Share modal with QR/links
│   └── index.ts                          # Barrel exports
├── app/
│   ├── loan-application/                 # Public form page
│   │   ├── page.tsx
│   │   └── page-client.tsx
│   ├── admin/ulafm/                      # Admin dashboard
│   │   ├── page.tsx
│   │   └── page-client.tsx
│   └── api/ulafm/
│       ├── submit/route.ts               # Form submission API
│       ├── generate-token/route.ts       # Token generation API
│       └── validate-token/route.ts       # Token validation API
├── lib/validations/
│   └── ulafm-schemas.ts                  # Zod validation schemas
└── types/
    └── ulafm.ts                          # TypeScript types
```

## Usage

### 1. Embedding the Form

```tsx
import { UniversalLoanApplicationForm } from '@/components/ulafm'

function MyPage() {
  return (
    <UniversalLoanApplicationForm
      token="optional-referral-token"
      onSuccess={(application) => console.log('Submitted:', application)}
      onError={(error) => console.error('Error:', error)}
      showHeader={true}
      showBenefits={true}
    />
  )
}
```

### 2. Share Button Integration

```tsx
import { ShareLoanFormButton } from '@/components/ulafm'

function PartnerDashboard() {
  return (
    <ShareLoanFormButton
      sender_type="PARTNER"
      sender_subrole="BP"
      campaign_id="diwali-2025"
      source="WHATSAPP"
      onShareSuccess={(data) => console.log('Link:', data.short_url)}
    />
  )
}
```

### 3. Public URL Structure

```
Base URL:     /loan-application
With Token:   /loan-application?ref={token}
Short URL:    /a/{shortCode}
```

## Form Fields (Phase 1)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| customer_full_name | text | Yes | 2-100 chars, letters only |
| customer_mobile | tel | Yes | 10 digits, starts with 6-9 |
| customer_email | email | No | Valid email format |
| loan_type | select | Yes | From predefined list |
| loan_amount | number | No | Min ₹10,000, Max ₹10 Cr |
| loan_purpose | textarea | No | Max 500 chars |
| terms_accepted | checkbox | Yes | Must be true |

## Loan Types Available

- Personal Loan
- Business Loan
- Mortgage Loan
- Home Loan
- New Car Loan
- Used Car Purchase Loan
- Refinance
- Balance Transfer
- Top-up on Existing Vehicle Loan
- Working Capital
- OD (Overdraft)
- CC (Cash Credit)

## API Endpoints

### POST /api/ulafm/submit
Submit a loan application.

**Request:**
```json
{
  "customer_full_name": "John Doe",
  "customer_mobile": "9876543210",
  "customer_email": "john@example.com",
  "loan_type": "PERSONAL_LOAN",
  "loan_amount": 500000,
  "loan_purpose": "Home renovation",
  "terms_accepted": true,
  "token": "optional-referral-token"
}
```

**Response:**
```json
{
  "success": true,
  "application_id": "ULAF-2025-ABC123",
  "message": "Application submitted successfully"
}
```

### POST /api/ulafm/generate-token
Generate a shareable referral link (requires authentication).

**Request:**
```json
{
  "sender_type": "EMPLOYEE",
  "sender_subrole": "BDE",
  "campaign_id": "q4-2025",
  "source": "WHATSAPP",
  "expires_in_days": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "full_url": "https://app.loanz360.com/loan-application?ref=...",
    "short_url": "https://app.loanz360.com/a/AbCdEfGh",
    "short_code": "AbCdEfGh",
    "qr_code_data_url": "data:image/svg+xml;base64,..."
  }
}
```

### GET /api/ulafm/validate-token
Validate a referral token (public endpoint).

**Response:**
```json
{
  "is_valid": true,
  "sender_type": "EMPLOYEE",
  "sender_name": "Demo User",
  "campaign_id": "q4-2025"
}
```

## Security Features

1. **Rate Limiting**: 5 submissions per IP per hour
2. **Input Validation**: Zod schemas with sanitization
3. **Token Security**: Random 32-char tokens, optional expiry
4. **XSS Prevention**: Input sanitization
5. **CORS Headers**: Configured for security

## Future Enhancements (Phase 2+)

- OTP verification for mobile
- Multi-step form wizard
- Document upload integration
- KYC fields (PAN, Aadhaar)
- Conditional fields based on loan type
- Real-time eligibility check
- Lead assignment automation

## Database Schema (To Be Implemented)

The database schema will be designed after form fields are finalized. Key tables:

- `ulaf_referral_tokens` - Stores referral links
- `ulaf_applications` - Main application data
- `ulaf_application_sources` - Attribution tracking
- `ulaf_status_history` - Audit trail
- `ulaf_form_configs` - Dynamic form configuration

## Contributing

When modifying this module:

1. Update types in `src/types/ulafm.ts`
2. Update validation in `src/lib/validations/ulafm-schemas.ts`
3. Update components as needed
4. Update this README

## Version History

- **v1.0.0** (2025-12-16): Initial release with Phase 1 fields
