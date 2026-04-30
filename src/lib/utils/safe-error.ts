/**
 * Safely extract error message from unknown catch values
 * Use this in catch blocks instead of (error as Error).message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

/**
 * Type guard for Error instances
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
