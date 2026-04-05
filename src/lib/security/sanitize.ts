/**
 * HTML Sanitization for Email Templates
 *
 * Provides secure HTML sanitization for email templates with:
 * - XSS prevention
 * - Safe HTML tag/attribute allowlists
 * - Isomorphic support (works on both server and client)
 * - Email-specific sanitization rules
 *
 * Uses isomorphic-dompurify for cross-environment compatibility
 */

import DOMPurify from 'isomorphic-dompurify'

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Configuration for email template sanitization
 */
export interface EmailSanitizeConfig {
  /** Allow inline styles (default: true for email compatibility) */
  allowStyles?: boolean
  /** Allow images (default: true) */
  allowImages?: boolean
  /** Allow links (default: true) */
  allowLinks?: boolean
  /** Allow tables (default: true for email layouts) */
  allowTables?: boolean
  /** Custom allowed tags to add */
  additionalTags?: string[]
  /** Custom allowed attributes to add */
  additionalAttributes?: string[]
  /** Maximum content length (default: 500000) */
  maxLength?: number
  /** Strip all HTML and return plain text */
  stripAll?: boolean
}

/**
 * Result of sanitization with metadata
 */
export interface SanitizeResult {
  /** Sanitized content */
  content: string
  /** Whether any content was removed */
  wasModified: boolean
  /** Original content length */
  originalLength: number
  /** Sanitized content length */
  sanitizedLength: number
  /** Tags that were removed (if any) */
  removedTags?: string[]
}

/**
 * XSS detection result
 */
export interface XSSDetectionResult {
  /** Whether XSS was detected */
  detected: boolean
  /** Types of XSS patterns found */
  patterns: string[]
  /** Risk level */
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'
  /** Detailed findings */
  details: string[]
}

// =====================================================
// ALLOWLISTS FOR EMAIL TEMPLATES
// =====================================================

/**
 * Safe HTML tags for email templates
 * These are widely supported by email clients
 */
export const EMAIL_SAFE_TAGS = [
  // Document structure
  'html',
  'head',
  'body',
  'title',
  'meta',

  // Text formatting
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'sub',
  'sup',
  'small',
  'big',
  'mark',

  // Headings
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',

  // Lists
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',

  // Tables (essential for email layouts)
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',

  // Links and images
  'a',
  'img',

  // Containers
  'div',
  'span',
  'center',
  'blockquote',
  'pre',
  'code',

  // Semantic elements (limited email support but safe)
  'article',
  'section',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'figure',
  'figcaption',
  'address',
] as const

/**
 * Safe HTML attributes for email templates
 */
export const EMAIL_SAFE_ATTRIBUTES = [
  // Global attributes
  'id',
  'class',
  'style',
  'title',
  'lang',
  'dir',

  // Link attributes
  'href',
  'target',
  'rel',

  // Image attributes
  'src',
  'alt',
  'width',
  'height',

  // Table attributes
  'border',
  'cellpadding',
  'cellspacing',
  'colspan',
  'rowspan',
  'align',
  'valign',
  'bgcolor',

  // Misc attributes
  'role',
  'aria-label',
  'aria-hidden',
  'name',
  'charset',
  'content',
  'http-equiv',
  'viewport',
] as const

/**
 * Restricted tags - commonly used in XSS attacks
 */
export const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'frame',
  'frameset',
  'applet',
  'link',
  'base',
  'svg',
  'math',
  'audio',
  'video',
  'source',
  'track',
  'canvas',
  'noscript',
  'template',
  'slot',
  'portal',
] as const

/**
 * Forbidden attributes - commonly used in XSS attacks
 */
export const FORBIDDEN_ATTRIBUTES = [
  'onabort',
  'onblur',
  'onchange',
  'onclick',
  'ondblclick',
  'onerror',
  'onfocus',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onmousedown',
  'onmousemove',
  'onmouseout',
  'onmouseover',
  'onmouseup',
  'onreset',
  'onresize',
  'onscroll',
  'onselect',
  'onsubmit',
  'onunload',
  'onbeforeunload',
  'oncontextmenu',
  'ondrag',
  'ondragend',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondragstart',
  'ondrop',
  'oninput',
  'oninvalid',
  'onmouseenter',
  'onmouseleave',
  'onmousewheel',
  'onwheel',
  'onpaste',
  'oncopy',
  'oncut',
  'ontouchstart',
  'ontouchmove',
  'ontouchend',
  'ontouchcancel',
  'onpointerdown',
  'onpointerup',
  'onpointermove',
  'onpointerenter',
  'onpointerleave',
  'onpointercancel',
  'onanimationstart',
  'onanimationend',
  'onanimationiteration',
  'ontransitionend',
] as const

// =====================================================
// XSS DETECTION PATTERNS
// =====================================================

/**
 * XSS attack patterns for detection
 */
const XSS_PATTERNS = [
  // Script injection
  { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, name: 'script_tag', risk: 'critical' },
  { pattern: /javascript\s*:/gi, name: 'javascript_protocol', risk: 'critical' },
  { pattern: /vbscript\s*:/gi, name: 'vbscript_protocol', risk: 'critical' },
  { pattern: /data\s*:\s*text\/html/gi, name: 'data_uri_html', risk: 'critical' },

  // Event handlers
  { pattern: /on\w+\s*=/gi, name: 'event_handler', risk: 'high' },

  // Expression injection
  { pattern: /expression\s*\(/gi, name: 'css_expression', risk: 'high' },
  { pattern: /eval\s*\(/gi, name: 'eval_function', risk: 'critical' },
  { pattern: /new\s+Function\s*\(/gi, name: 'function_constructor', risk: 'critical' },

  // SVG/MathML
  { pattern: /<svg\b/gi, name: 'svg_tag', risk: 'medium' },
  { pattern: /<math\b/gi, name: 'math_tag', risk: 'medium' },

  // Iframe/Object/Embed
  { pattern: /<iframe\b/gi, name: 'iframe_tag', risk: 'high' },
  { pattern: /<object\b/gi, name: 'object_tag', risk: 'high' },
  { pattern: /<embed\b/gi, name: 'embed_tag', risk: 'high' },

  // Form elements that could be used for phishing
  { pattern: /<form\b/gi, name: 'form_tag', risk: 'medium' },
  { pattern: /<input\b/gi, name: 'input_tag', risk: 'low' },

  // Base tag (can redirect all URLs)
  { pattern: /<base\b/gi, name: 'base_tag', risk: 'high' },

  // Meta refresh
  { pattern: /http-equiv\s*=\s*["']?\s*refresh/gi, name: 'meta_refresh', risk: 'medium' },

  // Import/include
  { pattern: /@import\s/gi, name: 'css_import', risk: 'medium' },

  // URL manipulation
  { pattern: /url\s*\(\s*["']?\s*javascript:/gi, name: 'url_javascript', risk: 'critical' },

  // HTML entities that could decode to dangerous content
  { pattern: /&#x?[0-9a-fA-F]+;/gi, name: 'html_entities', risk: 'low' },
] as const

// =====================================================
// CORE SANITIZATION FUNCTIONS
// =====================================================

/**
 * Sanitize HTML content for email templates
 *
 * @param html - The HTML content to sanitize
 * @param config - Optional configuration for sanitization
 * @returns Sanitized HTML string
 *
 * @example
 * ```ts
 * const clean = sanitizeEmailHtml('<p onclick="alert(1)">Hello</p>')
 * // Returns: '<p>Hello</p>'
 * ```
 */
export function sanitizeEmailHtml(
  html: string,
  config: EmailSanitizeConfig = {}
): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  const {
    allowStyles = true,
    allowImages = true,
    allowLinks = true,
    allowTables = true,
    additionalTags = [],
    additionalAttributes = [],
    maxLength = 500000,
    stripAll = false,
  } = config

  // Enforce maximum length to prevent DoS
  const truncatedHtml = html.length > maxLength ? html.slice(0, maxLength) : html

  // If strip all HTML is requested
  if (stripAll) {
    return DOMPurify.sanitize(truncatedHtml, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    })
  }

  // Build allowed tags list
  let allowedTags: string[] = [...EMAIL_SAFE_TAGS]

  if (!allowTables) {
    const tableTags = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col']
    allowedTags = allowedTags.filter((tag) => !tableTags.includes(tag))
  }

  if (!allowImages) {
    allowedTags = allowedTags.filter((tag) => tag !== 'img')
  }

  if (!allowLinks) {
    allowedTags = allowedTags.filter((tag) => tag !== 'a')
  }

  // Add custom tags
  allowedTags = [...new Set([...allowedTags, ...additionalTags])]

  // Build allowed attributes list
  let allowedAttributes: string[] = [...EMAIL_SAFE_ATTRIBUTES]

  if (!allowStyles) {
    allowedAttributes = allowedAttributes.filter((attr) => attr !== 'style')
  }

  if (!allowImages) {
    allowedAttributes = allowedAttributes.filter((attr) => !['src', 'alt'].includes(attr))
  }

  if (!allowLinks) {
    allowedAttributes = allowedAttributes.filter((attr) => !['href', 'target', 'rel'].includes(attr))
  }

  // Add custom attributes
  allowedAttributes = [...new Set([...allowedAttributes, ...additionalAttributes])]

  // Configure DOMPurify
  const purifyConfig: DOMPurify.Config = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [...FORBIDDEN_TAGS],
    FORBID_ATTR: [...FORBIDDEN_ATTRIBUTES],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    FORCE_BODY: false,
    SANITIZE_DOM: true,
    WHOLE_DOCUMENT: false,
    // Allow safe URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  }

  return DOMPurify.sanitize(truncatedHtml, purifyConfig)
}

/**
 * Sanitize HTML with detailed result
 *
 * @param html - The HTML content to sanitize
 * @param config - Optional configuration
 * @returns Detailed sanitization result
 *
 * @example
 * ```ts
 * const result = sanitizeEmailHtmlWithResult('<script>alert(1)</script><p>Hello</p>')
 * console.log(result.wasModified) // true
 * console.log(result.content) // '<p>Hello</p>'
 * ```
 */
export function sanitizeEmailHtmlWithResult(
  html: string,
  config: EmailSanitizeConfig = {}
): SanitizeResult {
  const originalLength = html?.length || 0
  const sanitized = sanitizeEmailHtml(html, config)

  // Detect removed tags by comparing original with sanitized
  const removedTags: string[] = []
  const originalTags = html?.match(/<[a-zA-Z][a-zA-Z0-9]*\b/g) || []
  const sanitizedTags = sanitized.match(/<[a-zA-Z][a-zA-Z0-9]*\b/g) || []

  const originalTagSet = new Set(originalTags.map((t) => t.toLowerCase()))
  const sanitizedTagSet = new Set(sanitizedTags.map((t) => t.toLowerCase()))

  originalTagSet.forEach((tag) => {
    if (!sanitizedTagSet.has(tag)) {
      removedTags.push(tag.replace('<', ''))
    }
  })

  return {
    content: sanitized,
    wasModified: sanitized !== html,
    originalLength,
    sanitizedLength: sanitized.length,
    removedTags: removedTags.length > 0 ? [...new Set(removedTags)] : undefined,
  }
}

/**
 * Sanitize plain text (strip all HTML)
 *
 * @param text - Text that may contain HTML
 * @returns Plain text with all HTML removed
 */
export function sanitizeToPlainText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // Use DOMPurify to strip all tags
  const stripped = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })

  // Decode HTML entities
  return decodeHtmlEntities(stripped).trim()
}

/**
 * Sanitize URL for safe use in email templates
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if unsafe
 */
export function sanitizeEmailUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim()

  // Check for dangerous protocols
  const lowercased = trimmed.toLowerCase()
  const dangerousProtocols = [
    'javascript:',
    'vbscript:',
    'data:text/html',
    'data:application',
    'file:',
  ]

  for (const protocol of dangerousProtocols) {
    if (lowercased.startsWith(protocol) || lowercased.includes(protocol)) {
      return ''
    }
  }

  // Validate URL format
  try {
    const urlObj = new URL(trimmed)
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']

    if (!allowedProtocols.includes(urlObj.protocol)) {
      return ''
    }

    return urlObj.toString()
  } catch {
    // If not a valid absolute URL, check if it's a valid relative URL
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
      // Sanitize path to prevent injection
      return trimmed.replace(/[<>"'`]/g, '')
    }
    return ''
  }
}

/**
 * Sanitize image source URL
 *
 * @param src - Image source URL
 * @returns Sanitized URL or empty string if unsafe
 */
export function sanitizeImageSrc(src: string): string {
  if (!src || typeof src !== 'string') {
    return ''
  }

  const trimmed = src.trim()
  const lowercased = trimmed.toLowerCase()

  // Block all data: URIs except safe images
  if (lowercased.startsWith('data:')) {
    // Only allow specific image data URIs
    const safeDataPatterns = [
      /^data:image\/(png|jpg|jpeg|gif|webp);base64,/i,
    ]

    if (!safeDataPatterns.some((pattern) => pattern.test(trimmed))) {
      return ''
    }

    // Limit data URI length to prevent DoS
    if (trimmed.length > 100000) {
      return ''
    }

    return trimmed
  }

  // Use standard URL sanitization for non-data URIs
  return sanitizeEmailUrl(trimmed)
}

// =====================================================
// XSS DETECTION UTILITIES
// =====================================================

/**
 * Detect potential XSS attacks in content
 *
 * @param content - Content to analyze
 * @returns XSS detection result
 *
 * @example
 * ```ts
 * const result = detectXSS('<img src=x onerror=alert(1)>')
 * if (result.detected) {
 *   console.log(`XSS detected: ${result.patterns.join(', ')}`)
 * }
 * ```
 */
export function detectXSS(content: string): XSSDetectionResult {
  if (!content || typeof content !== 'string') {
    return {
      detected: false,
      patterns: [],
      riskLevel: 'none',
      details: [],
    }
  }

  const patterns: string[] = []
  const details: string[] = []
  let maxRisk: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none'

  const riskLevels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 }

  for (const { pattern, name, risk } of XSS_PATTERNS) {
    if (pattern.test(content)) {
      patterns.push(name)
      details.push(`Found ${name} pattern (risk: ${risk})`)

      if (riskLevels[risk as keyof typeof riskLevels] > riskLevels[maxRisk]) {
        maxRisk = risk as typeof maxRisk
      }
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0
  }

  return {
    detected: patterns.length > 0,
    patterns,
    riskLevel: maxRisk,
    details,
  }
}

/**
 * Check if content is safe (no XSS detected)
 *
 * @param content - Content to check
 * @param maxRiskLevel - Maximum acceptable risk level (default: 'none')
 * @returns True if content is considered safe
 */
export function isContentSafe(
  content: string,
  maxRiskLevel: 'none' | 'low' | 'medium' | 'high' = 'none'
): boolean {
  const result = detectXSS(content)
  const riskLevels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 }

  return riskLevels[result.riskLevel] <= riskLevels[maxRiskLevel]
}

// =====================================================
// EMAIL-SPECIFIC SANITIZATION
// =====================================================

/**
 * Sanitize email subject line
 *
 * @param subject - Email subject
 * @returns Sanitized subject
 */
export function sanitizeEmailSubject(subject: string): string {
  if (!subject || typeof subject !== 'string') {
    return ''
  }

  // Strip all HTML
  let sanitized = sanitizeToPlainText(subject)

  // Remove newlines (prevent header injection)
  sanitized = sanitized.replace(/[\r\n]/g, ' ')

  // Limit length
  if (sanitized.length > 998) {
    sanitized = sanitized.slice(0, 995) + '...'
  }

  return sanitized.trim()
}

/**
 * Sanitize email body for template rendering
 *
 * @param body - Email body content (may contain HTML)
 * @param allowHtml - Whether to allow HTML (default: true)
 * @returns Sanitized email body
 */
export function sanitizeEmailBody(body: string, allowHtml: boolean = true): string {
  if (!body || typeof body !== 'string') {
    return ''
  }

  if (!allowHtml) {
    return sanitizeToPlainText(body)
  }

  return sanitizeEmailHtml(body, {
    allowStyles: true,
    allowImages: true,
    allowLinks: true,
    allowTables: true,
  })
}

/**
 * Sanitize user-provided data for email template interpolation
 *
 * @param data - Key-value pairs to sanitize
 * @returns Sanitized data object
 *
 * @example
 * ```ts
 * const userData = {
 *   name: '<script>alert(1)</script>John',
 *   message: 'Hello <b>World</b>',
 * }
 * const safe = sanitizeTemplateData(userData)
 * // { name: 'John', message: 'Hello <b>World</b>' }
 * ```
 */
export function sanitizeTemplateData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Sanitize strings - allow basic formatting but block scripts
      sanitized[key] = sanitizeEmailHtml(value, {
        allowStyles: false,
        allowImages: false,
        allowLinks: false,
        allowTables: false,
      })
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeEmailHtml(item, { allowStyles: false, allowImages: false, allowLinks: false, allowTables: false })
          : item
      )
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeTemplateData(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Escape HTML entities for safe text display
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
    '/': '&#47;',
  }

  return text.replace(/[&<>"'`/]/g, (char) => htmlEntities[char] || char)
}

/**
 * Decode HTML entities
 *
 * @param text - Text with HTML entities
 * @returns Decoded text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#96;': '`',
    '&#47;': '/',
    '&nbsp;': ' ',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
  }

  // Replace named entities
  let decoded = text.replace(
    /&(?:amp|lt|gt|quot|#39|#x27|#96|#47|nbsp|copy|reg|trade);/gi,
    (match) => entities[match.toLowerCase()] || match
  )

  // Replace numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_match, code) =>
    String.fromCharCode(parseInt(code, 10))
  )

  // Replace hex entities
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/gi, (_match, code) =>
    String.fromCharCode(parseInt(code, 16))
  )

  return decoded
}

// =====================================================
// CSS SANITIZATION FOR INLINE STYLES
// =====================================================

/**
 * Safe CSS properties for email inline styles
 */
export const SAFE_CSS_PROPERTIES = [
  // Text
  'color',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-indent',
  'text-transform',
  'white-space',
  'word-spacing',
  'word-wrap',
  'word-break',

  // Box model
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'width',
  'height',
  'max-width',
  'max-height',
  'min-width',
  'min-height',

  // Background
  'background',
  'background-color',
  'background-image',
  'background-repeat',
  'background-position',
  'background-size',

  // Border
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-style',
  'border-width',
  'border-radius',
  'border-collapse',
  'border-spacing',

  // Display & Layout
  'display',
  'visibility',
  'overflow',
  'float',
  'clear',
  'vertical-align',

  // Table
  'table-layout',
  'empty-cells',
  'caption-side',

  // List
  'list-style',
  'list-style-type',
  'list-style-position',
] as const

/**
 * Sanitize inline CSS style string
 *
 * @param style - CSS style string
 * @returns Sanitized style string
 */
export function sanitizeInlineStyle(style: string): string {
  if (!style || typeof style !== 'string') {
    return ''
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /expression\s*\(/gi,
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /behavior\s*:/gi,
    /-moz-binding/gi,
    /url\s*\(\s*["']?\s*(?:javascript|vbscript|data(?!:image))/gi,
    /@import/gi,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(style)) {
      return ''
    }
  }

  // Parse and filter CSS properties
  const declarations = style.split(';').filter(Boolean)
  const safeDeclarations: string[] = []

  for (const declaration of declarations) {
    const [property, ...valueParts] = declaration.split(':')
    if (!property || valueParts.length === 0) continue

    const prop = property.trim().toLowerCase()
    const value = valueParts.join(':').trim()

    // Only allow safe properties
    if (SAFE_CSS_PROPERTIES.includes(prop as (typeof SAFE_CSS_PROPERTIES)[number])) {
      // Additional value validation for url() references
      if (value.toLowerCase().includes('url(')) {
        // Only allow safe image URLs in backgrounds
        if (prop.startsWith('background')) {
          const urlMatch = value.match(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/i)
          if (urlMatch) {
            const url = urlMatch[1]
            const sanitizedUrl = sanitizeImageSrc(url)
            if (sanitizedUrl) {
              safeDeclarations.push(`${prop}: url('${sanitizedUrl}')`)
            }
          }
        }
        continue
      }

      safeDeclarations.push(`${prop}: ${value}`)
    }
  }

  return safeDeclarations.join('; ')
}

// =====================================================
// PRESET CONFIGURATIONS
// =====================================================

/**
 * Preset: Strict sanitization (minimal HTML)
 */
export const SANITIZE_PRESET_STRICT: EmailSanitizeConfig = {
  allowStyles: false,
  allowImages: false,
  allowLinks: false,
  allowTables: false,
}

/**
 * Preset: Standard email sanitization
 */
export const SANITIZE_PRESET_STANDARD: EmailSanitizeConfig = {
  allowStyles: true,
  allowImages: true,
  allowLinks: true,
  allowTables: true,
}

/**
 * Preset: Rich content (all safe features enabled)
 */
export const SANITIZE_PRESET_RICH: EmailSanitizeConfig = {
  allowStyles: true,
  allowImages: true,
  allowLinks: true,
  allowTables: true,
  additionalTags: ['figure', 'figcaption', 'picture'],
  additionalAttributes: ['loading', 'decoding'],
}

/**
 * Preset: Plain text only
 */
export const SANITIZE_PRESET_PLAIN_TEXT: EmailSanitizeConfig = {
  stripAll: true,
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

/**
 * Validate and sanitize email template before sending
 *
 * @param template - HTML template string
 * @returns Validation result with sanitized content
 */
export function validateEmailTemplate(template: string): {
  isValid: boolean
  sanitized: string
  warnings: string[]
  errors: string[]
} {
  const warnings: string[] = []
  const errors: string[] = []

  if (!template || typeof template !== 'string') {
    errors.push('Template is required and must be a string')
    return { isValid: false, sanitized: '', warnings, errors }
  }

  // Check for XSS
  const xssResult = detectXSS(template)
  if (xssResult.detected) {
    if (xssResult.riskLevel === 'critical' || xssResult.riskLevel === 'high') {
      errors.push(`Dangerous content detected: ${xssResult.patterns.join(', ')}`)
    } else {
      warnings.push(`Potentially unsafe content found: ${xssResult.patterns.join(', ')}`)
    }
  }

  // Sanitize
  const result = sanitizeEmailHtmlWithResult(template)

  if (result.wasModified) {
    warnings.push('Template was modified during sanitization')
    if (result.removedTags && result.removedTags.length > 0) {
      warnings.push(`Removed tags: ${result.removedTags.join(', ')}`)
    }
  }

  // Check for common issues
  if (!template.includes('<!DOCTYPE') && !template.includes('<html')) {
    warnings.push('Template missing DOCTYPE or html tag - may render inconsistently')
  }

  if (template.includes('position:fixed') || template.includes('position:absolute')) {
    warnings.push('Fixed/absolute positioning may not work in email clients')
  }

  return {
    isValid: errors.length === 0,
    sanitized: result.content,
    warnings,
    errors,
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default {
  // Core functions
  sanitizeEmailHtml,
  sanitizeEmailHtmlWithResult,
  sanitizeToPlainText,
  sanitizeEmailUrl,
  sanitizeImageSrc,

  // XSS detection
  detectXSS,
  isContentSafe,

  // Email-specific
  sanitizeEmailSubject,
  sanitizeEmailBody,
  sanitizeTemplateData,

  // HTML utilities
  escapeHtml,
  decodeHtmlEntities,

  // CSS sanitization
  sanitizeInlineStyle,

  // Validation
  validateEmailTemplate,

  // Allowlists
  EMAIL_SAFE_TAGS,
  EMAIL_SAFE_ATTRIBUTES,
  FORBIDDEN_TAGS,
  FORBIDDEN_ATTRIBUTES,
  SAFE_CSS_PROPERTIES,

  // Presets
  SANITIZE_PRESET_STRICT,
  SANITIZE_PRESET_STANDARD,
  SANITIZE_PRESET_RICH,
  SANITIZE_PRESET_PLAIN_TEXT,
}
