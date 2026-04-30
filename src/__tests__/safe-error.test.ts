/**
 * Unit tests for safe error handling utility
 */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

function isError(value: unknown): value is Error {
  return value instanceof Error;
}

describe('getErrorMessage', () => {
  test('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error');
  });

  test('returns string errors directly', () => {
    expect(getErrorMessage('something failed')).toBe('something failed');
  });

  test('returns default for null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });

  test('returns default for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });

  test('returns default for numbers', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
  });

  test('returns default for objects', () => {
    expect(getErrorMessage({ code: 500 })).toBe('An unexpected error occurred');
  });

  test('handles TypeError', () => {
    expect(getErrorMessage(new TypeError('null ref'))).toBe('null ref');
  });

  test('handles RangeError', () => {
    expect(getErrorMessage(new RangeError('out of bounds'))).toBe('out of bounds');
  });
});

describe('isError', () => {
  test('returns true for Error', () => {
    expect(isError(new Error('test'))).toBe(true);
  });

  test('returns true for TypeError', () => {
    expect(isError(new TypeError('test'))).toBe(true);
  });

  test('returns false for string', () => {
    expect(isError('error')).toBe(false);
  });

  test('returns false for null', () => {
    expect(isError(null)).toBe(false);
  });

  test('returns false for plain object', () => {
    expect(isError({ message: 'fake' })).toBe(false);
  });
});
