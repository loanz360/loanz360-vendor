/**
 * API Versioning Middleware
 *
 * Enterprise API versioning support
 * Features:
 * - URL-based versioning (recommended)
 * - Header-based versioning (X-API-Version)
 * - Version deprecation warnings
 * - Backward compatibility
 */

import { NextRequest, NextResponse } from 'next/server'

// Supported API versions
export const API_VERSIONS = ['v1', 'v2'] as const
export type ApiVersion = (typeof API_VERSIONS)[number]

// Current and minimum supported versions
export const CURRENT_VERSION: ApiVersion = 'v1'
export const MINIMUM_VERSION: ApiVersion = 'v1'

// Deprecated versions with sunset dates
export const DEPRECATED_VERSIONS: Record<string, string> = {
  // 'v1': '2025-12-31', // Example: v1 deprecated, sunset on Dec 31, 2025
}

// Version-specific features
export const VERSION_FEATURES: Record<ApiVersion, string[]> = {
  v1: [
    'leads-crud',
    'contacts-crud',
    'deals-crud',
    'search',
    'webhooks',
    'export',
    'realtime',
  ],
  v2: [
    'leads-crud',
    'contacts-crud',
    'deals-crud',
    'search',
    'webhooks',
    'export',
    'realtime',
    'graphql', // Future feature
    'batch-operations-v2',
    'advanced-analytics',
  ],
}

// Extract version from request
export function extractApiVersion(request: NextRequest): ApiVersion | null {
  // First check URL path
  const pathname = request.nextUrl.pathname
  const versionMatch = pathname.match(/\/api\/ai-crm\/(v\d+)\//)

  if (versionMatch) {
    const version = versionMatch[1] as ApiVersion
    if (API_VERSIONS.includes(version)) {
      return version
    }
  }

  // Fallback to header
  const headerVersion = request.headers.get('X-API-Version')
  if (headerVersion && API_VERSIONS.includes(headerVersion as ApiVersion)) {
    return headerVersion as ApiVersion
  }

  // Default to current version for backward compatibility
  return CURRENT_VERSION
}

// Check if version is supported
export function isVersionSupported(version: ApiVersion): boolean {
  return API_VERSIONS.includes(version)
}

// Check if version is deprecated
export function isVersionDeprecated(version: ApiVersion): boolean {
  return version in DEPRECATED_VERSIONS
}

// Get deprecation info
export function getDeprecationInfo(version: ApiVersion): {
  isDeprecated: boolean
  sunsetDate?: string
  message?: string
} {
  if (!isVersionDeprecated(version)) {
    return { isDeprecated: false }
  }

  const sunsetDate = DEPRECATED_VERSIONS[version]
  return {
    isDeprecated: true,
    sunsetDate,
    message: `API version ${version} is deprecated and will be sunset on ${sunsetDate}. Please migrate to ${CURRENT_VERSION}.`,
  }
}

// Check if feature is available in version
export function isFeatureAvailable(version: ApiVersion, feature: string): boolean {
  return VERSION_FEATURES[version]?.includes(feature) || false
}

// Version middleware response
export interface VersionedResponse {
  version: ApiVersion
  isDeprecated: boolean
  sunsetDate?: string
  headers: Record<string, string>
}

// Add version headers to response
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion
): NextResponse {
  response.headers.set('X-API-Version', version)
  response.headers.set('X-API-Current-Version', CURRENT_VERSION)

  const deprecationInfo = getDeprecationInfo(version)
  if (deprecationInfo.isDeprecated) {
    response.headers.set('Deprecation', deprecationInfo.sunsetDate || 'true')
    response.headers.set('Sunset', deprecationInfo.sunsetDate || '')
    response.headers.set(
      'X-Deprecation-Notice',
      deprecationInfo.message || `API version ${version} is deprecated`
    )
  }

  return response
}

// Versioned API handler wrapper
export function withApiVersion<T>(
  handler: (request: NextRequest, version: ApiVersion) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const version = extractApiVersion(request)

    if (!version || !isVersionSupported(version)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_VERSION',
            message: `API version not supported. Supported versions: ${API_VERSIONS.join(', ')}`,
          },
        } as unknown as T,
        { status: 400 }
      )
    }

    const response = await handler(request, version)
    return addVersionHeaders(response, version)
  }
}

// Version comparison utilities
export function compareVersions(a: ApiVersion, b: ApiVersion): number {
  const numA = parseInt(a.replace('v', ''))
  const numB = parseInt(b.replace('v', ''))
  return numA - numB
}

export function isVersionGreaterOrEqual(
  version: ApiVersion,
  target: ApiVersion
): boolean {
  return compareVersions(version, target) >= 0
}

// Generate API documentation for version
export function getVersionDocumentation(version: ApiVersion): {
  version: ApiVersion
  features: string[]
  isDeprecated: boolean
  deprecationInfo?: {
    sunsetDate: string
    message: string
  }
  endpoints: string[]
} {
  const features = VERSION_FEATURES[version] || []
  const deprecationInfo = getDeprecationInfo(version)

  return {
    version,
    features,
    isDeprecated: deprecationInfo.isDeprecated,
    ...(deprecationInfo.isDeprecated && {
      deprecationInfo: {
        sunsetDate: deprecationInfo.sunsetDate!,
        message: deprecationInfo.message!,
      },
    }),
    endpoints: [
      '/api/ai-crm/cro/leads',
      '/api/ai-crm/cro/leads/[id]',
      '/api/ai-crm/cro/leads/bulk',
      '/api/ai-crm/cro/leads/export',
      '/api/ai-crm/cro/contacts',
      '/api/ai-crm/cro/deals',
      '/api/ai-crm/cro/search',
      '/api/ai-crm/cro/webhooks',
      '/api/ai-crm/cro/events',
    ],
  }
}

export default {
  versions: API_VERSIONS,
  current: CURRENT_VERSION,
  minimum: MINIMUM_VERSION,
  extract: extractApiVersion,
  isSupported: isVersionSupported,
  isDeprecated: isVersionDeprecated,
  getDeprecation: getDeprecationInfo,
  isFeatureAvailable,
  addHeaders: addVersionHeaders,
  withVersion: withApiVersion,
  compare: compareVersions,
  getDocs: getVersionDocumentation,
}
