/**
 * Intrusion Detection System (IDS)
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Real-time threat detection and prevention
 *
 * Features:
 * - Pattern-based attack detection
 * - Behavioral anomaly detection
 * - Automated threat response
 * - Attack signature matching
 * - Rate-based detection
 * - Geographic anomaly detection
 */

import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase/server'

// Attack severity levels
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical'

// Attack types
export type AttackType =
  | 'sql_injection'
  | 'xss'
  | 'path_traversal'
  | 'command_injection'
  | 'ldap_injection'
  | 'xml_injection'
  | 'nosql_injection'
  | 'ssrf'
  | 'file_inclusion'
  | 'brute_force'
  | 'credential_stuffing'
  | 'enumeration'
  | 'dos'
  | 'scanner'
  | 'bot'
  | 'unknown'

// Threat detection result
export interface ThreatDetectionResult {
  detected: boolean
  attackType?: AttackType
  severity?: ThreatSeverity
  confidence: number // 0-100
  details?: string
  signature?: string
  recommendation?: string
  shouldBlock: boolean
}

// Attack signature
interface AttackSignature {
  id: string
  pattern: RegExp
  attackType: AttackType
  severity: ThreatSeverity
  description: string
}

// Behavioral profile
interface BehavioralProfile {
  avgRequestsPerMinute: number
  typicalEndpoints: Set<string>
  typicalMethods: Set<string>
  typicalHours: Set<number>
  typicalCountries: Set<string>
  lastSeen: Date
}

// =====================================================
// ATTACK SIGNATURES DATABASE
// =====================================================

const ATTACK_SIGNATURES: AttackSignature[] = [
  // SQL Injection
  {
    id: 'SQL001',
    pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|WHERE|SET)\b)/i,
    attackType: 'sql_injection',
    severity: 'critical',
    description: 'SQL keyword combination detected',
  },
  {
    id: 'SQL002',
    pattern: /['"];\s*(DROP|DELETE|UPDATE|INSERT|SELECT)/i,
    attackType: 'sql_injection',
    severity: 'critical',
    description: 'SQL injection with quote termination',
  },
  {
    id: 'SQL003',
    pattern: /\b(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
    attackType: 'sql_injection',
    severity: 'high',
    description: 'Boolean-based SQL injection',
  },
  {
    id: 'SQL004',
    pattern: /\bunion\s+(all\s+)?select\b/i,
    attackType: 'sql_injection',
    severity: 'critical',
    description: 'UNION-based SQL injection',
  },
  {
    id: 'SQL005',
    pattern: /\b(sleep|benchmark|waitfor|pg_sleep)\s*\(/i,
    attackType: 'sql_injection',
    severity: 'high',
    description: 'Time-based blind SQL injection',
  },
  {
    id: 'SQL006',
    pattern: /\b(INTO\s+OUTFILE|INTO\s+DUMPFILE|LOAD_FILE)\b/i,
    attackType: 'sql_injection',
    severity: 'critical',
    description: 'SQL file operation injection',
  },

  // XSS Attacks
  {
    id: 'XSS001',
    pattern: /<script[^>]*>[\s\S]*?<\/script>/i,
    attackType: 'xss',
    severity: 'high',
    description: 'Script tag injection',
  },
  {
    id: 'XSS002',
    pattern: /\bon\w+\s*=\s*["']?[^"']+["']?/i,
    attackType: 'xss',
    severity: 'high',
    description: 'Event handler injection',
  },
  {
    id: 'XSS003',
    pattern: /javascript\s*:/i,
    attackType: 'xss',
    severity: 'high',
    description: 'JavaScript protocol injection',
  },
  {
    id: 'XSS004',
    pattern: /\beval\s*\(/i,
    attackType: 'xss',
    severity: 'critical',
    description: 'Eval function injection',
  },
  {
    id: 'XSS005',
    pattern: /<img[^>]+onerror\s*=/i,
    attackType: 'xss',
    severity: 'high',
    description: 'Image onerror XSS',
  },
  {
    id: 'XSS006',
    pattern: /\bdocument\.(cookie|location|write)/i,
    attackType: 'xss',
    severity: 'high',
    description: 'Document object manipulation',
  },

  // Path Traversal
  {
    id: 'PTR001',
    pattern: /\.\.[\/\\]/,
    attackType: 'path_traversal',
    severity: 'high',
    description: 'Directory traversal attempt',
  },
  {
    id: 'PTR002',
    pattern: /%2e%2e[%2f%5c]/i,
    attackType: 'path_traversal',
    severity: 'high',
    description: 'URL-encoded directory traversal',
  },
  {
    id: 'PTR003',
    pattern: /\/(etc\/passwd|etc\/shadow|windows\/system32)/i,
    attackType: 'path_traversal',
    severity: 'critical',
    description: 'System file access attempt',
  },

  // Command Injection
  {
    id: 'CMD001',
    pattern: /[;&|`$]\s*(cat|ls|dir|whoami|id|pwd|echo|wget|curl|nc|bash|sh|cmd)/i,
    attackType: 'command_injection',
    severity: 'critical',
    description: 'Command injection attempt',
  },
  {
    id: 'CMD002',
    pattern: /\$\([^)]+\)|\$\{[^}]+\}/,
    attackType: 'command_injection',
    severity: 'high',
    description: 'Shell command substitution',
  },

  // LDAP Injection
  {
    id: 'LDAP001',
    pattern: /[()&|!*\\]/,
    attackType: 'ldap_injection',
    severity: 'medium',
    description: 'LDAP special characters',
  },

  // XML/XXE Injection
  {
    id: 'XML001',
    pattern: /<!ENTITY[^>]+SYSTEM/i,
    attackType: 'xml_injection',
    severity: 'critical',
    description: 'XXE external entity injection',
  },
  {
    id: 'XML002',
    pattern: /<!DOCTYPE[^>]+\[/i,
    attackType: 'xml_injection',
    severity: 'high',
    description: 'DOCTYPE with internal subset',
  },

  // NoSQL Injection
  {
    id: 'NOSQL001',
    pattern: /\$(?:where|gt|lt|ne|eq|regex|or|and|not|nor|exists|type)/i,
    attackType: 'nosql_injection',
    severity: 'high',
    description: 'MongoDB operator injection',
  },

  // SSRF
  {
    id: 'SSRF001',
    pattern: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1|169\.254\.\d+\.\d+)/i,
    attackType: 'ssrf',
    severity: 'high',
    description: 'SSRF to localhost/internal IP',
  },
  {
    id: 'SSRF002',
    pattern: /(?:file|gopher|dict|php|data|glob|expect|phar):\/\//i,
    attackType: 'ssrf',
    severity: 'critical',
    description: 'SSRF with dangerous protocol',
  },

  // File Inclusion
  {
    id: 'FI001',
    pattern: /(?:include|require|include_once|require_once)\s*\(/i,
    attackType: 'file_inclusion',
    severity: 'critical',
    description: 'PHP file inclusion attempt',
  },

  // Scanner/Bot Detection
  {
    id: 'SCAN001',
    pattern: /(?:sqlmap|nikto|nmap|nessus|acunetix|burp|zap|dirbuster|gobuster)/i,
    attackType: 'scanner',
    severity: 'medium',
    description: 'Security scanner detected',
  },
]

// =====================================================
// SUSPICIOUS USER AGENTS
// =====================================================

const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /nessus/i,
  /acunetix/i,
  /burpsuite/i,
  /zaproxy/i,
  /dirbuster/i,
  /gobuster/i,
  /masscan/i,
  /wpscan/i,
  /joomscan/i,
  /python-requests/i,
  /python-urllib/i,
  /libwww-perl/i,
  /curl\/\d/i,
  /wget\/\d/i,
  /scrapy/i,
  /phantomjs/i,
  /headlesschrome/i,
]

// =====================================================
// INTRUSION DETECTION SERVICE
// =====================================================

export class IntrusionDetectionSystem {
  private behavioralProfiles: Map<string, BehavioralProfile> = new Map()
  private recentRequests: Map<string, number[]> = new Map()
  private blockedIPs: Set<string> = new Set()

  /**
   * Analyze request for threats
   */
  async analyzeRequest(request: NextRequest): Promise<ThreatDetectionResult> {
    const results: ThreatDetectionResult[] = []

    // Get request data
    const ip = this.getClientIP(request)
    const url = request.nextUrl.toString()
    const path = request.nextUrl.pathname
    const query = request.nextUrl.search
    const userAgent = request.headers.get('user-agent') || ''
    const method = request.method

    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      return {
        detected: true,
        attackType: 'unknown',
        severity: 'critical',
        confidence: 100,
        details: 'IP address is blocked',
        shouldBlock: true,
      }
    }

    // 1. Signature-based detection
    const signatureResult = this.detectBySignature(url + query)
    if (signatureResult.detected) {
      results.push(signatureResult)
    }

    // 2. User agent analysis
    const uaResult = this.analyzeUserAgent(userAgent)
    if (uaResult.detected) {
      results.push(uaResult)
    }

    // 3. Rate-based detection
    const rateResult = this.checkRateAnomaly(ip)
    if (rateResult.detected) {
      results.push(rateResult)
    }

    // 4. Behavioral analysis
    const behaviorResult = await this.analyzeBehavior(ip, path, method, request)
    if (behaviorResult.detected) {
      results.push(behaviorResult)
    }

    // 5. Request body analysis (for POST/PUT)
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.clone().text()
        const bodyResult = this.detectBySignature(body)
        if (bodyResult.detected) {
          results.push(bodyResult)
        }
      } catch {
        // Body not available or already consumed
      }
    }

    // 6. Header analysis
    const headerResult = this.analyzeHeaders(request)
    if (headerResult.detected) {
      results.push(headerResult)
    }

    // Return highest severity threat
    if (results.length > 0) {
      const sorted = results.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return (severityOrder[a.severity!] || 4) - (severityOrder[b.severity!] || 4)
      })

      const highest = sorted[0]

      // Log threat
      await this.logThreat(ip, highest, request)

      // Auto-block for critical threats
      if (highest.severity === 'critical') {
        this.blockedIPs.add(ip)
      }

      return highest
    }

    return {
      detected: false,
      confidence: 0,
      shouldBlock: false,
    }
  }

  /**
   * Signature-based detection
   */
  private detectBySignature(input: string): ThreatDetectionResult {
    for (const signature of ATTACK_SIGNATURES) {
      if (signature.pattern.test(input)) {
        return {
          detected: true,
          attackType: signature.attackType,
          severity: signature.severity,
          confidence: 90,
          details: signature.description,
          signature: signature.id,
          recommendation: `Block request and investigate. Signature: ${signature.id}`,
          shouldBlock: signature.severity === 'critical' || signature.severity === 'high',
        }
      }
    }

    return { detected: false, confidence: 0, shouldBlock: false }
  }

  /**
   * User agent analysis
   */
  private analyzeUserAgent(userAgent: string): ThreatDetectionResult {
    // Check for empty/missing user agent
    if (!userAgent || userAgent.length < 10) {
      return {
        detected: true,
        attackType: 'bot',
        severity: 'low',
        confidence: 60,
        details: 'Missing or suspicious user agent',
        shouldBlock: false,
      }
    }

    // Check against suspicious patterns
    for (const pattern of SUSPICIOUS_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        return {
          detected: true,
          attackType: 'scanner',
          severity: 'medium',
          confidence: 85,
          details: 'Known security scanner or bot detected',
          recommendation: 'Consider blocking automated scanning tools',
          shouldBlock: false,
        }
      }
    }

    return { detected: false, confidence: 0, shouldBlock: false }
  }

  /**
   * Rate-based anomaly detection
   */
  private checkRateAnomaly(ip: string): ThreatDetectionResult {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const threshold = 100 // requests per minute

    // Get recent requests for this IP
    const requests = this.recentRequests.get(ip) || []

    // Filter to current window
    const recentRequests = requests.filter(t => now - t < windowMs)

    // Add current request
    recentRequests.push(now)
    this.recentRequests.set(ip, recentRequests)

    // Check for rate anomaly
    if (recentRequests.length > threshold) {
      return {
        detected: true,
        attackType: 'dos',
        severity: 'high',
        confidence: 80,
        details: `Rate limit exceeded: ${recentRequests.length} requests/minute`,
        recommendation: 'Implement rate limiting and consider temporary block',
        shouldBlock: true,
      }
    }

    // Check for burst (many requests in short time)
    const burstWindow = 5000 // 5 seconds
    const burstThreshold = 20
    const burstRequests = recentRequests.filter(t => now - t < burstWindow)

    if (burstRequests.length > burstThreshold) {
      return {
        detected: true,
        attackType: 'dos',
        severity: 'medium',
        confidence: 70,
        details: `Burst detected: ${burstRequests.length} requests in 5 seconds`,
        shouldBlock: false,
      }
    }

    return { detected: false, confidence: 0, shouldBlock: false }
  }

  /**
   * Behavioral analysis
   */
  private async analyzeBehavior(
    ip: string,
    path: string,
    method: string,
    request: NextRequest
  ): Promise<ThreatDetectionResult> {
    const profile = this.behavioralProfiles.get(ip)
    const currentHour = new Date().getHours()
    const country = request.headers.get('cf-ipcountry') || 'unknown'

    if (!profile) {
      // Create new profile
      this.behavioralProfiles.set(ip, {
        avgRequestsPerMinute: 1,
        typicalEndpoints: new Set([path]),
        typicalMethods: new Set([method]),
        typicalHours: new Set([currentHour]),
        typicalCountries: new Set([country]),
        lastSeen: new Date(),
      })
      return { detected: false, confidence: 0, shouldBlock: false }
    }

    // Update profile
    profile.typicalEndpoints.add(path)
    profile.typicalMethods.add(method)
    profile.typicalHours.add(currentHour)
    profile.lastSeen = new Date()

    // Check for geographic anomaly
    if (profile.typicalCountries.size > 0 && !profile.typicalCountries.has(country)) {
      return {
        detected: true,
        attackType: 'credential_stuffing',
        severity: 'medium',
        confidence: 65,
        details: `Geographic anomaly: request from ${country}, typical: ${Array.from(profile.typicalCountries).join(', ')}`,
        shouldBlock: false,
      }
    }

    return { detected: false, confidence: 0, shouldBlock: false }
  }

  /**
   * Header analysis
   */
  private analyzeHeaders(request: NextRequest): ThreatDetectionResult {
    const headers = request.headers

    // Check for header injection
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-original-url',
      'x-rewrite-url',
    ]

    for (const header of suspiciousHeaders) {
      const value = headers.get(header)
      if (value && (value.includes('<') || value.includes('>'))) {
        return {
          detected: true,
          attackType: 'xss',
          severity: 'high',
          confidence: 85,
          details: `Suspicious content in ${header} header`,
          shouldBlock: true,
        }
      }
    }

    // Check for Host header attacks
    const host = headers.get('host')
    if (host && /[<>"']/.test(host)) {
      return {
        detected: true,
        attackType: 'xss',
        severity: 'high',
        confidence: 90,
        details: 'Host header injection attempt',
        shouldBlock: true,
      }
    }

    return { detected: false, confidence: 0, shouldBlock: false }
  }

  /**
   * Log threat to database
   */
  private async logThreat(
    ip: string,
    threat: ThreatDetectionResult,
    request: NextRequest
  ): Promise<void> {
    try {
      const supabase = createSupabaseAdmin()

      await supabase.from('security_threats').insert({
        ip_address: ip,
        attack_type: threat.attackType,
        severity: threat.severity,
        confidence: threat.confidence,
        details: threat.details,
        signature: threat.signature,
        user_agent: request.headers.get('user-agent'),
        path: request.nextUrl.pathname,
        method: request.method,
        blocked: threat.shouldBlock,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[IDS] Failed to log threat:', error)
    }
  }

  /**
   * Get client IP
   */
  private getClientIP(request: NextRequest): string {
    return (
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.ip ||
      'unknown'
    )
  }

  /**
   * Manually block an IP
   */
  blockIP(ip: string): void {
    this.blockedIPs.add(ip)
  }

  /**
   * Unblock an IP
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip)
  }

  /**
   * Get blocked IPs
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs)
  }

  /**
   * Clear old data (call periodically)
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes

    // Clean recent requests
    for (const [ip, requests] of this.recentRequests) {
      const recent = requests.filter(t => now - t < maxAge)
      if (recent.length === 0) {
        this.recentRequests.delete(ip)
      } else {
        this.recentRequests.set(ip, recent)
      }
    }

    // Clean old behavioral profiles
    const profileMaxAge = 24 * 60 * 60 * 1000 // 24 hours
    for (const [ip, profile] of this.behavioralProfiles) {
      if (now - profile.lastSeen.getTime() > profileMaxAge) {
        this.behavioralProfiles.delete(ip)
      }
    }
  }
}

// Singleton instance
let idsInstance: IntrusionDetectionSystem | null = null

export function getIDS(): IntrusionDetectionSystem {
  if (!idsInstance) {
    idsInstance = new IntrusionDetectionSystem()
  }
  return idsInstance
}

/**
 * IDS Middleware helper
 */
export async function idsMiddleware(request: NextRequest): Promise<ThreatDetectionResult> {
  return getIDS().analyzeRequest(request)
}
