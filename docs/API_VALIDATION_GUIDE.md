# LOANZ 360 — API Validation Guide

## Overview

Every API route in this codebase uses `parseBody()` for safe request body parsing. 
This guide explains how to add per-route Zod schemas for full input validation.

## Quick Start

### Before (unsafe):
```typescript
const body = await request.json(); // crashes on bad JSON
```

### After (safe, no schema):
```typescript
import { parseBody } from '@/lib/utils/parse-body';
const { data: body, error: _valErr } = await parseBody(request);
if (_valErr) return _valErr;
```

### With Zod schema (fully validated):
```typescript
import { parseBody } from '@/lib/utils/parse-body';
import { createLeadSchema } from '@/lib/validations';

const { data, error } = await parseBody(request, createLeadSchema);
if (error) return error; // Returns 422 with field-level errors
// data is fully typed as z.infer<typeof createLeadSchema>
```

## Available Schemas

### Auth (`src/lib/validations/auth.ts`)
- `loginSchema` — email + password (min 8 chars)
- `registerSchema` — email, password, full_name, phone, role
- `forgotPasswordSchema` — email
- `resetPasswordSchema` — password + token
- `changePasswordSchema` — currentPassword + newPassword

### Leads (`src/lib/validations/leads.ts`)
- `createLeadSchema` — full_name, phone (Indian), loan_type, loan_amount
- `updateLeadSchema` — partial create + status, assigned_to
- `assignLeadSchema` — lead_ids[], assigned_to

### Loans (`src/lib/validations/loans.ts`)
- `loanApplicationSchema` — loan_type, amount, tenure, applicant details
- `emiCalculatorSchema` — principal, rate, tenure

### Profile (`src/lib/validations/profile.ts`)
- `updateProfileSchema` — name, phone, email, address, designation
- `uploadDocumentSchema` — document_type, document_name

### Attendance (`src/lib/validations/attendance.ts`)
- `clockInSchema` — latitude, longitude, location_name
- `leaveRequestSchema` — leave_type, dates, reason
- `regularizationSchema` — date, times, reason

### Notifications (`src/lib/validations/notifications.ts`)
- `sendNotificationSchema` — title, message, type, priority, recipients
- `markReadSchema` — notification_ids[]

### Commission (`src/lib/validations/commission.ts`)
- `createCommissionSchema` — loan_id, partner_id, amount, type
- `approvePayoutSchema` — payout_ids[], approved_by

### Common Validators (`src/lib/validations/common.ts`)
- `indianPhoneSchema` — +91/91 prefix, 6-9 start, 10 digits
- `panSchema` — ABCDE1234F format
- `pincodeSchema` — 6-digit
- `ifscSchema` — SBIN0001234 format
- `gstSchema` — GSTIN format
- `bankAccountSchema` — 9-18 digits
- `amountSchema` — positive, max ₹100Cr
- `emailSchema` — valid email, max 255 chars
- `paginationSchema` — page, limit, sort, order
- `uuidParam` — UUID format

## TypeScript Types (`src/types/`)
- `UserProfile`, `Lead`, `LoanApplication`, `Commission`
- `Attendance`, `LeaveRequest`, `Notification`, `SupportTicket`
- `ApiResponse<T>`, `PaginatedResponse<T>`, `DashboardStats`, `EMIResult`

## Testing
```bash
npx jest src/__tests__/
```
Tests cover: EMI calculations, validation schemas, parseBody, safe-error, Indian validators
