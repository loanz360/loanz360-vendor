/**
 * Error Code System
 *
 * Sanitized error messages for production
 * SECURITY: Never expose stack traces, database errors, or internal details
 *
 * COMPLIANCE: PCI-DSS 6.5.5, OWASP API Security
 */

export enum ErrorCode {
  // Authentication Errors (1000-1099)
  AUTH_INVALID_CREDENTIALS = 'AUTH_1001',
  AUTH_ACCOUNT_LOCKED = 'AUTH_1002',
  AUTH_ACCOUNT_DISABLED = 'AUTH_1003',
  AUTH_SESSION_EXPIRED = 'AUTH_1004',
  AUTH_INVALID_TOKEN = 'AUTH_1005',
  AUTH_TOKEN_EXPIRED = 'AUTH_1006',
  AUTH_UNAUTHORIZED = 'AUTH_1007',
  AUTH_FORBIDDEN = 'AUTH_1008',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_1009',
  AUTH_2FA_REQUIRED = 'AUTH_1010',
  AUTH_2FA_INVALID = 'AUTH_1011',

  // Registration Errors (1100-1199)
  REG_EMAIL_EXISTS = 'REG_1101',
  REG_INVALID_EMAIL = 'REG_1102',
  REG_WEAK_PASSWORD = 'REG_1103',
  REG_INVALID_PHONE = 'REG_1104',
  REG_INVALID_ROLE = 'REG_1105',
  REG_MISSING_FIELDS = 'REG_1106',

  // Validation Errors (1200-1299)
  VAL_INVALID_INPUT = 'VAL_1201',
  VAL_MISSING_FIELD = 'VAL_1202',
  VAL_INVALID_FORMAT = 'VAL_1203',
  VAL_OUT_OF_RANGE = 'VAL_1204',
  VAL_INVALID_PAN = 'VAL_1205',
  VAL_INVALID_AADHAAR = 'VAL_1206',
  VAL_INVALID_PHONE = 'VAL_1207',

  // Rate Limiting Errors (1300-1399)
  RATE_LIMIT_EXCEEDED = 'RATE_1301',
  RATE_TOO_MANY_ATTEMPTS = 'RATE_1302',
  RATE_IP_BLOCKED = 'RATE_1303',

  // File Upload Errors (1400-1499)
  FILE_TOO_LARGE = 'FILE_1401',
  FILE_INVALID_TYPE = 'FILE_1402',
  FILE_UPLOAD_FAILED = 'FILE_1403',
  FILE_MALICIOUS = 'FILE_1404',
  FILE_INVALID_CONTENT = 'FILE_1405',

  // Database Errors (1500-1599)
  DB_CONNECTION_ERROR = 'DB_1501',
  DB_QUERY_ERROR = 'DB_1502',
  DB_CONSTRAINT_VIOLATION = 'DB_1503',
  DB_RECORD_NOT_FOUND = 'DB_1504',
  DB_DUPLICATE_ENTRY = 'DB_1505',

  // Business Logic Errors (1600-1699)
  BIZ_INSUFFICIENT_FUNDS = 'BIZ_1601',
  BIZ_LOAN_LIMIT_EXCEEDED = 'BIZ_1602',
  BIZ_INVALID_STATUS_TRANSITION = 'BIZ_1603',
  BIZ_DUPLICATE_APPLICATION = 'BIZ_1604',
  BIZ_KYC_INCOMPLETE = 'BIZ_1605',
  BIZ_CREDIT_SCORE_LOW = 'BIZ_1606',

  // Payment Errors (1700-1799)
  PAY_PAYMENT_FAILED = 'PAY_1701',
  PAY_INVALID_AMOUNT = 'PAY_1702',
  PAY_GATEWAY_ERROR = 'PAY_1703',
  PAY_REFUND_FAILED = 'PAY_1704',

  // System Errors (1900-1999)
  SYS_INTERNAL_ERROR = 'SYS_1901',
  SYS_SERVICE_UNAVAILABLE = 'SYS_1902',
  SYS_MAINTENANCE = 'SYS_1903',
  SYS_TIMEOUT = 'SYS_1904',
}

export interface AppError {
  code: ErrorCode
  message: string
  userMessage: string
  httpStatus: number
  details?: Record<string, unknown>
  timestamp?: string
  requestId?: string
}

/**
 * Error messages mapping
 * userMessage: Safe to show to end users
 * message: Internal message for logging
 */
export const ERROR_MESSAGES: Record<
  ErrorCode,
  {
    message: string
    userMessage: string
    httpStatus: number
  }
> = {
  // Authentication Errors
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: {
    message: 'Invalid credentials provided',
    userMessage: 'Invalid email or password. Please try again.',
    httpStatus: 401,
  },
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: {
    message: 'Account is locked due to multiple failed attempts',
    userMessage:
      'Your account has been temporarily locked due to multiple failed login attempts. Please try again in 30 minutes or contact support.',
    httpStatus: 423,
  },
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: {
    message: 'Account is disabled',
    userMessage: 'Your account has been disabled. Please contact support for assistance.',
    httpStatus: 403,
  },
  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    message: 'Session has expired',
    userMessage: 'Your session has expired. Please log in again.',
    httpStatus: 401,
  },
  [ErrorCode.AUTH_INVALID_TOKEN]: {
    message: 'Invalid authentication token',
    userMessage: 'Authentication failed. Please log in again.',
    httpStatus: 401,
  },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    message: 'Authentication token has expired',
    userMessage: 'Your session has expired. Please log in again.',
    httpStatus: 401,
  },
  [ErrorCode.AUTH_UNAUTHORIZED]: {
    message: 'Unauthorized access attempt',
    userMessage: 'You are not authorized to access this resource.',
    httpStatus: 401,
  },
  [ErrorCode.AUTH_FORBIDDEN]: {
    message: 'Access forbidden for this role',
    userMessage: 'You do not have permission to perform this action.',
    httpStatus: 403,
  },
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: {
    message: 'Email address not verified',
    userMessage: 'Please verify your email address before logging in. Check your inbox for the verification link.',
    httpStatus: 403,
  },
  [ErrorCode.AUTH_2FA_REQUIRED]: {
    message: '2FA verification required',
    userMessage: 'Two-factor authentication is required. Please enter your verification code.',
    httpStatus: 403,
  },
  [ErrorCode.AUTH_2FA_INVALID]: {
    message: 'Invalid 2FA code',
    userMessage: 'Invalid verification code. Please try again.',
    httpStatus: 401,
  },

  // Registration Errors
  [ErrorCode.REG_EMAIL_EXISTS]: {
    message: 'Email already registered',
    userMessage: 'This email address is already registered. Please use a different email or try logging in.',
    httpStatus: 409,
  },
  [ErrorCode.REG_INVALID_EMAIL]: {
    message: 'Invalid email format',
    userMessage: 'Please enter a valid email address.',
    httpStatus: 400,
  },
  [ErrorCode.REG_WEAK_PASSWORD]: {
    message: 'Password does not meet security requirements',
    userMessage:
      'Password must be at least 12 characters and include uppercase, lowercase, number, and special character.',
    httpStatus: 400,
  },
  [ErrorCode.REG_INVALID_PHONE]: {
    message: 'Invalid phone number format',
    userMessage: 'Please enter a valid 10-digit mobile number.',
    httpStatus: 400,
  },
  [ErrorCode.REG_INVALID_ROLE]: {
    message: 'Invalid user role specified',
    userMessage: 'Invalid account type selected. Please choose a valid option.',
    httpStatus: 400,
  },
  [ErrorCode.REG_MISSING_FIELDS]: {
    message: 'Required fields missing',
    userMessage: 'Please fill in all required fields.',
    httpStatus: 400,
  },

  // Validation Errors
  [ErrorCode.VAL_INVALID_INPUT]: {
    message: 'Invalid input data',
    userMessage: 'The information provided is invalid. Please check and try again.',
    httpStatus: 400,
  },
  [ErrorCode.VAL_MISSING_FIELD]: {
    message: 'Required field missing',
    userMessage: 'Please provide all required information.',
    httpStatus: 400,
  },
  [ErrorCode.VAL_INVALID_FORMAT]: {
    message: 'Invalid data format',
    userMessage: 'The format of the provided information is incorrect. Please check and try again.',
    httpStatus: 400,
  },
  [ErrorCode.VAL_OUT_OF_RANGE]: {
    message: 'Value out of acceptable range',
    userMessage: 'The value provided is outside the acceptable range.',
    httpStatus: 400,
  },
  [ErrorCode.VAL_INVALID_PAN]: {
    message: 'Invalid PAN format',
    userMessage: 'Please enter a valid PAN number (e.g., ABCDE1234F).',
    httpStatus: 400,
  },
  [ErrorCode.VAL_INVALID_AADHAAR]: {
    message: 'Invalid Aadhaar format',
    userMessage: 'Please enter a valid 12-digit Aadhaar number.',
    httpStatus: 400,
  },
  [ErrorCode.VAL_INVALID_PHONE]: {
    message: 'Invalid phone number',
    userMessage: 'Please enter a valid 10-digit mobile number.',
    httpStatus: 400,
  },

  // Rate Limiting Errors
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    message: 'Rate limit exceeded',
    userMessage: 'Too many requests. Please try again later.',
    httpStatus: 429,
  },
  [ErrorCode.RATE_TOO_MANY_ATTEMPTS]: {
    message: 'Too many failed attempts',
    userMessage: 'Too many failed attempts. Please try again in 15 minutes.',
    httpStatus: 429,
  },
  [ErrorCode.RATE_IP_BLOCKED]: {
    message: 'IP address blocked',
    userMessage: 'Your access has been temporarily blocked. Please contact support if this continues.',
    httpStatus: 403,
  },

  // File Upload Errors
  [ErrorCode.FILE_TOO_LARGE]: {
    message: 'File size exceeds limit',
    userMessage: 'File size exceeds the maximum limit of 10MB. Please upload a smaller file.',
    httpStatus: 413,
  },
  [ErrorCode.FILE_INVALID_TYPE]: {
    message: 'Invalid file type',
    userMessage: 'Invalid file type. Please upload a PDF, JPEG, PNG, or Excel file.',
    httpStatus: 400,
  },
  [ErrorCode.FILE_UPLOAD_FAILED]: {
    message: 'File upload failed',
    userMessage: 'Failed to upload file. Please try again.',
    httpStatus: 500,
  },
  [ErrorCode.FILE_MALICIOUS]: {
    message: 'Potentially malicious file detected',
    userMessage: 'The uploaded file appears to be invalid or corrupted. Please try a different file.',
    httpStatus: 400,
  },
  [ErrorCode.FILE_INVALID_CONTENT]: {
    message: 'Invalid file content',
    userMessage: 'The file content is invalid or corrupted. Please upload a valid file.',
    httpStatus: 400,
  },

  // Database Errors
  [ErrorCode.DB_CONNECTION_ERROR]: {
    message: 'Database connection failed',
    userMessage: 'Unable to process your request at this time. Please try again later.',
    httpStatus: 503,
  },
  [ErrorCode.DB_QUERY_ERROR]: {
    message: 'Database query error',
    userMessage: 'An error occurred while processing your request. Please try again.',
    httpStatus: 500,
  },
  [ErrorCode.DB_CONSTRAINT_VIOLATION]: {
    message: 'Database constraint violation',
    userMessage: 'The operation cannot be completed due to data validation rules.',
    httpStatus: 400,
  },
  [ErrorCode.DB_RECORD_NOT_FOUND]: {
    message: 'Record not found',
    userMessage: 'The requested information could not be found.',
    httpStatus: 404,
  },
  [ErrorCode.DB_DUPLICATE_ENTRY]: {
    message: 'Duplicate entry detected',
    userMessage: 'This entry already exists in the system.',
    httpStatus: 409,
  },

  // Business Logic Errors
  [ErrorCode.BIZ_INSUFFICIENT_FUNDS]: {
    message: 'Insufficient funds',
    userMessage: 'Insufficient funds to complete this transaction.',
    httpStatus: 400,
  },
  [ErrorCode.BIZ_LOAN_LIMIT_EXCEEDED]: {
    message: 'Loan limit exceeded',
    userMessage: 'The requested loan amount exceeds your eligible limit.',
    httpStatus: 400,
  },
  [ErrorCode.BIZ_INVALID_STATUS_TRANSITION]: {
    message: 'Invalid status transition',
    userMessage: 'This action cannot be performed in the current state.',
    httpStatus: 400,
  },
  [ErrorCode.BIZ_DUPLICATE_APPLICATION]: {
    message: 'Duplicate loan application',
    userMessage: 'You already have an active loan application. Please wait for it to be processed.',
    httpStatus: 409,
  },
  [ErrorCode.BIZ_KYC_INCOMPLETE]: {
    message: 'KYC verification incomplete',
    userMessage: 'Please complete your KYC verification before proceeding.',
    httpStatus: 403,
  },
  [ErrorCode.BIZ_CREDIT_SCORE_LOW]: {
    message: 'Credit score below minimum requirement',
    userMessage: 'Your credit score does not meet the minimum requirement for this loan product.',
    httpStatus: 400,
  },

  // Payment Errors
  [ErrorCode.PAY_PAYMENT_FAILED]: {
    message: 'Payment processing failed',
    userMessage: 'Payment failed. Please try again or use a different payment method.',
    httpStatus: 400,
  },
  [ErrorCode.PAY_INVALID_AMOUNT]: {
    message: 'Invalid payment amount',
    userMessage: 'Invalid payment amount. Please check and try again.',
    httpStatus: 400,
  },
  [ErrorCode.PAY_GATEWAY_ERROR]: {
    message: 'Payment gateway error',
    userMessage: 'Payment service is temporarily unavailable. Please try again later.',
    httpStatus: 503,
  },
  [ErrorCode.PAY_REFUND_FAILED]: {
    message: 'Refund processing failed',
    userMessage: 'Refund could not be processed at this time. Please contact support.',
    httpStatus: 500,
  },

  // System Errors
  [ErrorCode.SYS_INTERNAL_ERROR]: {
    message: 'Internal server error',
    userMessage: 'An unexpected error occurred. Our team has been notified. Please try again later.',
    httpStatus: 500,
  },
  [ErrorCode.SYS_SERVICE_UNAVAILABLE]: {
    message: 'Service temporarily unavailable',
    userMessage: 'Service is temporarily unavailable. Please try again in a few minutes.',
    httpStatus: 503,
  },
  [ErrorCode.SYS_MAINTENANCE]: {
    message: 'System under maintenance',
    userMessage: 'The system is currently under maintenance. Please check back soon.',
    httpStatus: 503,
  },
  [ErrorCode.SYS_TIMEOUT]: {
    message: 'Request timeout',
    userMessage: 'The request took too long to process. Please try again.',
    httpStatus: 504,
  },
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  const errorConfig = ERROR_MESSAGES[code]

  return {
    code,
    message: errorConfig.message,
    userMessage: errorConfig.userMessage,
    httpStatus: errorConfig.httpStatus,
    details,
    timestamp: new Date().toISOString(),
    requestId,
  }
}

/**
 * Sanitize error for production
 * Never expose internal error details to users
 */
export function sanitizeError(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.SYS_INTERNAL_ERROR,
  requestId?: string
): AppError {
  // If already an AppError, return it
  if (error && typeof error === 'object' && 'code' in error && 'userMessage' in error) {
    return error as AppError
  }

  // Map common errors
  if (error instanceof Error) {
    // PostgreSQL constraint violations
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      return createErrorResponse(ErrorCode.DB_DUPLICATE_ENTRY, undefined, requestId)
    }

    // PostgreSQL foreign key violations
    if (error.message.includes('foreign key') || error.message.includes('violates')) {
      return createErrorResponse(ErrorCode.DB_CONSTRAINT_VIOLATION, undefined, requestId)
    }

    // Network/connection errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      return createErrorResponse(ErrorCode.DB_CONNECTION_ERROR, undefined, requestId)
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return createErrorResponse(ErrorCode.SYS_TIMEOUT, undefined, requestId)
    }
  }

  // Default to internal error (never expose raw error to user)
  return createErrorResponse(defaultCode, undefined, requestId)
}
