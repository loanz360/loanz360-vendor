export * from './auth';
export * from './common';
export * from './leads';
export * from './loans';
export * from './profile';
export * from './attendance';
export * from './notifications';
export * from './commission';

import { z, ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        data: null,
        error: NextResponse.json(
          { error: 'Validation failed', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) },
          { status: 422 }
        ),
      };
    }
    return { data: result.data, error: null };
  } catch {
    return { data: null, error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) };
  }
}

export function validateParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    return { data: null, error: NextResponse.json({ error: 'Invalid parameters', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, { status: 422 }) };
  }
  return { data: result.data, error: null };
}
