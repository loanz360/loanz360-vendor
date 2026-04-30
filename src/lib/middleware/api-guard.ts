import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Guard — validates auth + optional role check
 * Use at the top of any API route handler
 */
export async function requireAuth(allowedRoles?: string[]) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { 
      user: null, 
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) 
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, sub_role')
      .eq('id', user.id)
      .single();
    
    if (!profile || !allowedRoles.includes(profile.role)) {
      return {
        user: null,
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      };
    }
  }

  return { user, error: null };
}

/**
 * Simple in-memory rate limiter for API routes
 * In production, replace with Redis-based rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Create rate-limited error response with proper headers
 */
export function rateLimitResponse(retryAfterSeconds: number = 60) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { 
      status: 429, 
      headers: { 'Retry-After': retryAfterSeconds.toString() }
    }
  );
}
