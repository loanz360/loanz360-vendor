/**
 * API Error Handling Library
 * Enterprise-grade error handling with specific error types and user-friendly messages
 */

export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Authorization Errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not Found Errors (404)
  NOT_FOUND = 'NOT_FOUND',
  ADMIN_NOT_FOUND = 'ADMIN_NOT_FOUND',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',

  // Conflict Errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Business Logic Errors (422)
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  INVALID_STATE = 'INVALID_STATE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ApiError {
  code: ErrorCode
  message: string
  details?: string | Record<string, unknown>
  statusCode: number
  timestamp: string
  path?: string
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: string | Record<string, unknown>
  public readonly timestamp: string
  public readonly path?: string

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: string | Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  public toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      path: this.path,
    }
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: string | Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access', details?: string | Record<string, unknown>) {
    super(ErrorCode.UNAUTHORIZED, message, 401, details)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', details?: string | Record<string, unknown>) {
    super(ErrorCode.FORBIDDEN, message, 403, details)
    this.name = 'ForbiddenError'
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: string | Record<string, unknown>) {
    super(ErrorCode.NOT_FOUND, message, 404, details)
    this.name = 'NotFoundError'
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: string | Record<string, unknown>) {
    super(ErrorCode.CONFLICT, message, 409, details)
    this.name = 'ConflictError'
  }
}

/**
 * Business Logic Error (422)
 */
export class BusinessLogicError extends AppError {
  constructor(message: string = 'Business logic error', details?: string | Record<string, unknown>) {
    super(ErrorCode.BUSINESS_LOGIC_ERROR, message, 422, details)
    this.name = 'BusinessLogicError'
  }
}

/**
 * Database Error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: string | Record<string, unknown>) {
    super(ErrorCode.DATABASE_ERROR, message, 500, details)
    this.name = 'DatabaseError'
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: string | Record<string, unknown>) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429, details)
    this.name = 'RateLimitError'
  }
}

/**
 * User-friendly error messages mapping
 */
export const USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'The information you provided is invalid.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',
  [ErrorCode.INVALID_FORMAT]: 'The format of your input is incorrect.',

  [ErrorCode.UNAUTHORIZED]: 'Please log in to continue.',
  [ErrorCode.INVALID_TOKEN]: 'Your session is invalid. Please log in again.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',

  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You lack the necessary permissions.',

  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.ADMIN_NOT_FOUND]: 'Admin not found.',
  [ErrorCode.MODULE_NOT_FOUND]: 'Module not found.',

  [ErrorCode.CONFLICT]: 'This resource already exists.',
  [ErrorCode.DUPLICATE_EMAIL]: 'This email is already in use.',
  [ErrorCode.ALREADY_EXISTS]: 'This resource already exists.',

  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Something went wrong. Please try again later.',
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred. Please try again.',
  [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',

  [ErrorCode.BUSINESS_LOGIC_ERROR]: 'This operation cannot be completed.',
  [ErrorCode.INVALID_STATE]: 'Invalid state for this operation.',
  [ErrorCode.OPERATION_NOT_ALLOWED]: 'This operation is not allowed.',

  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait and try again.',
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(code: ErrorCode): string {
  return USER_FRIENDLY_MESSAGES[code] || 'An unexpected error occurred.'
}

/**
 * Check if error is operational (expected errors vs programming errors)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return true
  }
  return false
}

/**
 * Parse Supabase error to AppError
 */
export function parseSupabaseError(error: unknown): AppError {
  // Supabase PostgresError codes
  if (error.code === '23505') {
    // Unique violation
    return new ConflictError('Resource already exists', {
      constraint: error.constraint,
      detail: error.detail,
    })
  }

  if (error.code === '23503') {
    // Foreign key violation
    return new BusinessLogicError('Referenced resource does not exist', {
      constraint: error.constraint,
      detail: error.detail,
    })
  }

  if (error.code === '23502') {
    // Not null violation
    return new ValidationError('Required field is missing', {
      column: error.column,
      detail: error.detail,
    })
  }

  if (error.code === '23514') {
    // Check violation
    return new ValidationError('Value does not meet constraints', {
      constraint: error.constraint,
      detail: error.detail,
    })
  }

  if (error.code === 'PGRST116') {
    // Row not found
    return new NotFoundError('Resource not found')
  }

  // Default to database error
  return new DatabaseError('Database operation failed', {
    code: error.code,
    message: error.message,
  })
}

/**
 * Handle API errors and return formatted response
 */
export function handleApiError(error: unknown, requestPath?: string): {
  response: ApiError
  statusCode: number
} {
  // If it's already an AppError
  if (error instanceof AppError) {
    const apiError = error.toJSON()
    if (requestPath) {
      apiError.path = requestPath
    }
    return {
      response: apiError,
      statusCode: error.statusCode,
    }
  }

  // If it's a standard Error
  if (error instanceof Error) {
    const appError = new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
      500,
      process.env.NODE_ENV === 'development' ? error.message : undefined
    )

    const apiError = appError.toJSON()
    if (requestPath) {
      apiError.path = requestPath
    }

    return {
      response: apiError,
      statusCode: 500,
    }
  }

  // Unknown error type
  const appError = new AppError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'An unknown error occurred',
    500
  )

  const apiError = appError.toJSON()
  if (requestPath) {
    apiError.path = requestPath
  }

  return {
    response: apiError,
    statusCode: 500,
  }
}

/**
 * Retry configuration for network operations
 */
export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error
  let delay = config.initialDelay

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on operational errors (business logic, validation, etc.)
      if (error instanceof AppError && error.statusCode < 500) {
        throw error
      }

      // Last attempt - throw error
      if (attempt === config.maxRetries) {
        break
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
    }
  }

  throw lastError!
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new AppError(ErrorCode.NETWORK_ERROR, errorMessage, 408))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout])
}
