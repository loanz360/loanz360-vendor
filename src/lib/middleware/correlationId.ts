import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generate or forward X-Request-ID for distributed tracing.
 * Every API response includes the correlation ID so clients
 * and logs can be matched across services.
 */
export function attachCorrelationId(request: NextRequest): string {
  return request.headers.get('x-request-id') || uuidv4()
}

export function withCorrelationHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-response-time', new Date().toISOString())
  return response
}
