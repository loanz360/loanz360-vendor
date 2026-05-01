import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/health
 * 
 * Health check endpoint for monitoring and load balancers.
 * Returns service status, version, uptime, and environment info.
 */
export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  
  const health = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime ? Math.floor(process.uptime()) : undefined,
    checks: {
      api: 'ok',
      memory: getMemoryUsage(),
    },
  }

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'x-request-id': requestId,
      'Cache-Control': 'no-store',
    },
  })
}

function getMemoryUsage(): string {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    return `${mb}MB heap used`
  }
  return 'unknown'
}
