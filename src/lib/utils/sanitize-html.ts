/**
 * HTML Sanitization Utility
 *
 * Uses DOMPurify to sanitize HTML content before rendering
 * Prevents XSS attacks by removing malicious scripts and unsafe attributes
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML content with strict security settings
 *
 * @param html - Raw HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(
  html: string,
  options?: {
    allowedTags?: string[]
    allowedAttributes?: Record<string, string[]>
  }
): string {
  if (!html) return ''

  // Default configuration - allows common formatting but blocks scripts
  const config: DOMPurify.Config = {
    // Allowed tags for rich text content
    ALLOWED_TAGS: options?.allowedTags || [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'blockquote',
      'code',
      'pre',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span'
    ],

    // Allowed attributes
    ALLOWED_ATTR: options?.allowedAttributes
      ? Object.keys(options.allowedAttributes)
      : [
          'href',
          'title',
          'target',
          'rel',
          'src',
          'alt',
          'class',
          'id',
          'style'
        ],

    // Remove any unsafe URLs (javascript:, data:, etc.)
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

    // Keep relative URLs safe
    KEEP_CONTENT: true,

    // Return clean HTML string
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,

    // Security settings
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_DATA_ATTR: false,

    // Add target="_blank" and rel="noopener noreferrer" to all links
    ADD_ATTR: ['target', 'rel']
  }

  // Sanitize the HTML
  let sanitized = DOMPurify.sanitize(html, config)

  // Additional security: Ensure all external links have rel="noopener noreferrer"
  sanitized = sanitized.replace(
    /<a\s+([^>]*href=["']https?:\/\/[^"']*["'][^>]*)>/gi,
    (match, attrs) => {
      if (!attrs.includes('rel=')) {
        return `<a ${attrs} rel="noopener noreferrer" target="_blank">`
      }
      return match
    }
  )

  return sanitized
}

/**
 * Sanitize plain text by escaping HTML entities
 * Use this for user-generated content that should be displayed as plain text
 *
 * @param text - Plain text string
 * @returns Escaped text safe for HTML rendering
 */
export function escapeHtml(text: string): string {
  if (!text) return ''

  const div = typeof document !== 'undefined' ? document.createElement('div') : null
  if (div) {
    div.textContent = text
    return div.innerHTML
  }

  // Fallback for server-side
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Strip all HTML tags from a string
 * Useful for creating plain text summaries
 *
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtmlTags(html: string): string {
  if (!html) return ''

  // Use DOMPurify to remove all tags
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true
  })

  return cleaned.trim()
}

/**
 * Truncate HTML content to a specific length while preserving valid HTML
 *
 * @param html - HTML string to truncate
 * @param maxLength - Maximum character length
 * @param suffix - Suffix to add when truncated (default: '...')
 * @returns Truncated HTML string
 */
export function truncateHtml(html: string, maxLength: number, suffix = '...'): string {
  if (!html) return ''

  const plainText = stripHtmlTags(html)
  if (plainText.length <= maxLength) {
    return sanitizeHtml(html)
  }

  // Find a safe truncation point in the plain text
  const truncated = plainText.substring(0, maxLength).trim()
  return escapeHtml(truncated + suffix)
}

/**
 * Validate if HTML contains potentially dangerous content
 * Returns true if safe, false if potentially dangerous
 *
 * @param html - HTML string to validate
 * @returns Boolean indicating if HTML is safe
 */
export function isHtmlSafe(html: string): boolean {
  if (!html) return true

  const dangerous = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick, onload
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /data:text\/html/i
  ]

  return !dangerous.some((pattern) => pattern.test(html))
}
