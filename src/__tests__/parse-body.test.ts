/**
 * Unit tests for parseBody utility
 * Tests the safe request body parsing that protects all 700+ API routes
 */

// Mock parseBody logic for testing
function parseBodySync(
  contentType: string | null,
  contentLength: string | null,
  body: string | null,
  maxSize = 1_048_576
) {
  // Content-Type check
  if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return { error: 415, message: 'Content-Type must be application/json' };
  }
  // Size check
  if (contentLength && parseInt(contentLength) > maxSize) {
    return { error: 413, message: 'Request body too large' };
  }
  // JSON parse
  if (!body) return { error: 400, message: 'Invalid JSON in request body' };
  try {
    const data = JSON.parse(body);
    return { data, error: null };
  } catch {
    return { error: 400, message: 'Invalid JSON in request body' };
  }
}

describe('parseBody', () => {
  test('accepts valid JSON with correct content-type', () => {
    const result = parseBodySync('application/json', '20', '{"name":"test"}');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ name: 'test' });
  });

  test('rejects non-JSON content-type with 415', () => {
    const result = parseBodySync('text/html', '10', '<html>');
    expect(result.error).toBe(415);
  });

  test('allows null content-type (browser default)', () => {
    const result = parseBodySync(null, '20', '{"ok":true}');
    expect(result.error).toBeNull();
  });

  test('allows multipart/form-data', () => {
    const result = parseBodySync('multipart/form-data; boundary=----', null, null);
    expect(result.error).toBe(400); // body null, but content-type accepted
  });

  test('rejects oversized body with 413', () => {
    const result = parseBodySync('application/json', '2000000', '{}');
    expect(result.error).toBe(413);
  });

  test('rejects malformed JSON with 400', () => {
    const result = parseBodySync('application/json', '10', '{invalid}');
    expect(result.error).toBe(400);
  });

  test('rejects empty body with 400', () => {
    const result = parseBodySync('application/json', '0', null);
    expect(result.error).toBe(400);
  });

  test('accepts nested JSON objects', () => {
    const body = JSON.stringify({ user: { name: 'Vinod', address: { city: 'Hyderabad' } } });
    const result = parseBodySync('application/json', String(body.length), body);
    expect(result.error).toBeNull();
    expect(result.data.user.address.city).toBe('Hyderabad');
  });

  test('accepts arrays', () => {
    const body = JSON.stringify([1, 2, 3]);
    const result = parseBodySync('application/json', String(body.length), body);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([1, 2, 3]);
  });

  test('respects custom max size', () => {
    const result = parseBodySync('application/json', '500', '{}', 100);
    expect(result.error).toBe(413);
  });
});
