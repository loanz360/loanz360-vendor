/**
 * PostgREST / Supabase search input sanitizer.
 *
 * When building `.or()` filter strings like:
 *   `column.ilike.%${search}%`
 * special PostgREST characters in the user input can break parsing
 * or manipulate the filter logic (SQL/filter injection).
 *
 * This utility escapes dangerous characters while preserving search intent.
 */

// Characters with special meaning in PostgREST filter syntax
const POSTGREST_SPECIAL = /[,.()"\\]/g

/**
 * Sanitize a search string for safe use in Supabase `.or()` / `.filter()` strings.
 * Removes characters that have structural meaning in PostgREST filter syntax.
 *
 * @example
 *   const safe = sanitizeSearch(userInput)
 *   query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
 */
export function sanitizeSearch(input: string): string {
  if (!input) return ''

  return input
    .trim()
    .replace(POSTGREST_SPECIAL, '') // Remove structural chars
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .substring(0, 100)             // Limit length to prevent abuse
}

/**
 * Sanitize and validate a mobile number search.
 * Only allows digits, +, spaces, and hyphens.
 */
export function sanitizeMobileSearch(input: string): string {
  if (!input) return ''
  return input.replace(/[^\d+\-\s]/g, '').substring(0, 15)
}

/**
 * Build a safe Supabase `.or()` filter string for multi-column ILIKE search.
 *
 * @param search - Raw user search input (will be sanitized)
 * @param columns - Column names to search across
 * @returns Sanitized `.or()` filter string, or empty string if search is empty
 *
 * @example
 *   const filter = buildSearchFilter(search, ['full_name', 'mobile_number', 'email'])
 *   if (filter) query = query.or(filter)
 */
export function buildSearchFilter(search: string, columns: string[]): string {
  const safe = sanitizeSearch(search)
  if (!safe) return ''

  return columns
    .map(col => `${col}.ilike.%${safe}%`)
    .join(',')
}
