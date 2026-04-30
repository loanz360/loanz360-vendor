import { NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';

/**
 * Safely parse request body with optional Zod validation
 * Replaces raw `await request.json()` across all API routes
 * 
 * Usage:
 *   const { data, error } = await parseBody(request, mySchema);
 *   if (error) return error;
 *   // data is fully typed and validated
 * 
 * Without schema (basic JSON safety only):
 *   const { data, error } = await parseBody(request);
 *   if (error) return error;
 */
export async function parseBody<T = Record<string, unknown>>(
  request: Request,
  schema?: ZodSchema<T>,
  options?: { maxSize?: number }
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  const maxSize = options?.maxSize ?? 1_048_576; // 1MB default

  // Check content-type
  const contentType = request.headers.get('content-type');
  if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    return {
      data: null,
      error: NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 }),
    };
  }

  // Check body size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    return {
      data: null,
      error: NextResponse.json({ error: 'Request body too large' }, { status: 413 }),
    };
  }

  // Parse JSON safely
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }),
    };
  }

  // Validate against schema if provided
  if (schema) {
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        data: null,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            details: result.error.issues.map(i => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 422 }
        ),
      };
    }
    return { data: result.data, error: null };
  }

  return { data: body as T, error: null };
}

/**
 * Quick body extraction with no validation — use as drop-in replacement
 * for `await request.json()` to get safe JSON parsing
 */
export async function safeJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
