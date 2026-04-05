/**
 * API Version Information Endpoint
 *
 * Returns API version information and available features
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  API_VERSIONS,
  CURRENT_VERSION,
  MINIMUM_VERSION,
  getVersionDocumentation,
  extractApiVersion,
  addVersionHeaders,
} from '@/lib/api/versioning'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestedVersion = extractApiVersion(request)

  const response = NextResponse.json({
    success: true,
    data: {
      current_version: CURRENT_VERSION,
      minimum_version: MINIMUM_VERSION,
      available_versions: API_VERSIONS,
      version_details: API_VERSIONS.map(getVersionDocumentation),
      requested_version: requestedVersion,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  })

  return addVersionHeaders(response, requestedVersion || CURRENT_VERSION)
}
