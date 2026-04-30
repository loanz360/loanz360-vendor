import { NextResponse } from 'next/server';

/**
 * Add security headers to API responses
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

/**
 * CORS headers for API routes
 */
export function corsHeaders(origin?: string) {
  const allowedOrigins = [
    'https://employee.loanz360.com',
    'https://partner.loanz360.com', 
    'https://customer.loanz360.com',
    'https://suad.loanz360.com',
    'https://admin.loanz360.com',
    'https://vendor.loanz360.com',
  ];
  
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}
