# Content-Type Validation Applied to All API Routes

## Summary

Content-Type validation has been added to protect against:
- CSRF attacks
- Content smuggling
- XSS through JSON endpoints
- Request header manipulation

## Routes Updated

### ✅ Already Updated:
1. `/api/superadmin/auth` - Super admin login

### 📋 To Update (Remaining 11 routes):
1. `/api/auth/login` - Regular user login
2. `/api/auth/register` - User registration
3. `/api/auth/forgot-password` - Password reset request
4. `/api/auth/reset-password` - Password reset confirmation
5. `/api/superadmin/2fa/setup` - 2FA setup
6. `/api/superadmin/2fa/verify` - 2FA verification
7. `/api/superadmin/2fa/enable` - 2FA enable
8. `/api/superadmin/2fa/disable` - 2FA disable
9. `/api/superadmin/2fa/regenerate-backup-codes` - Regenerate backup codes
10. `/api/csrf-token` - CSRF token retrieval (GET only, no validation needed)
11. `/api/errors` - Error logging

## Implementation Pattern

For each POST/PUT/PATCH/DELETE route handler, add at the beginning:

```typescript
// 1. Import the validators
import { validateJsonContentType, createContentTypeErrorResponse } from '@/lib/middleware/content-type-validator'

// 2. Add validation at the start of POST handler
export async function POST(request: NextRequest) {
  // SECURITY: Validate Content-Type header
  const contentTypeValidation = validateJsonContentType(request)
  if (!contentTypeValidation.valid) {
    return createContentTypeErrorResponse(
      contentTypeValidation.error || 'Invalid Content-Type',
      contentTypeValidation.status
    )
  }

  // ... rest of handler
}
```

## Benefits

- **CSRF Protection**: Forces specific content types, preventing simple form-based CSRF
- **Content Smuggling Prevention**: Rejects unexpected content types
- **XSS Mitigation**: Prevents JSON-based XSS attacks
- **Security Headers**: Adds `X-Content-Type-Options: nosniff` to error responses

## Status

**Progress**: 1/12 routes updated (8.3%)
**Target**: 100% coverage on all POST/PUT/PATCH/DELETE endpoints
