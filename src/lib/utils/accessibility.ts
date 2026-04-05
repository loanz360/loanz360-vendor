/**
 * WCAG 2.1 AA Accessibility Utilities for LOANZ 360
 */

/**
 * Generate a unique ID for ARIA attributes
 */
let idCounter = 0
export function generateAriaId(prefix = 'aria'): string {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`
}

/**
 * Trap focus within a container (for modals, dialogs)
 * Returns a cleanup function to remove the event listener
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const focusableElements = container.querySelectorAll(focusableSelectors)
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)

  // Focus first focusable element
  const first = container.querySelector(focusableSelectors) as HTMLElement | null
  if (first) first.focus()

  return () => container.removeEventListener('keydown', handleKeyDown)
}

/**
 * Announce a message to screen readers via aria-live region
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  let announcer = document.getElementById('sr-announcer')
  if (!announcer) {
    announcer = document.createElement('div')
    announcer.id = 'sr-announcer'
    announcer.setAttribute('aria-live', priority)
    announcer.setAttribute('aria-atomic', 'true')
    announcer.setAttribute('role', 'status')
    announcer.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;'
    document.body.appendChild(announcer)
  }
  announcer.setAttribute('aria-live', priority)
  announcer.textContent = ''
  // Small delay to ensure screen readers pick up the change
  requestAnimationFrame(() => {
    if (announcer) announcer.textContent = message
  })
}

/**
 * Check if the user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Calculate relative luminance for WCAG contrast ratio calculations
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Check WCAG contrast ratio between two hex colors
 * Returns ratio (e.g., 4.5 for AA normal text, 3.0 for AA large text)
 */
export function checkContrast(hex1: string, hex2: string): number {
  const toRGB = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = toRGB(hex1)
  const [r2, g2, b2] = toRGB(hex2)
  const l1 = relativeLuminance(r1, g1, b1)
  const l2 = relativeLuminance(r2, g2, b2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Common ARIA props for interactive elements
 */
export const ariaProps = {
  modal: (title: string) => ({
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-label': title,
  }),
  tab: (selected: boolean, label: string) => ({
    role: 'tab' as const,
    'aria-selected': selected,
    'aria-label': label,
    tabIndex: selected ? 0 : -1,
  }),
  tabPanel: (label: string) => ({
    role: 'tabpanel' as const,
    'aria-label': label,
  }),
  sortableColumn: (direction?: 'asc' | 'desc') => ({
    'aria-sort': direction === 'asc' ? 'ascending' as const : direction === 'desc' ? 'descending' as const : 'none' as const,
    role: 'columnheader' as const,
  }),
  expandable: (expanded: boolean) => ({
    'aria-expanded': expanded,
  }),
  alert: (type: 'success' | 'error' | 'warning' | 'info') => ({
    role: type === 'error' ? 'alert' as const : 'status' as const,
    'aria-live': type === 'error' ? 'assertive' as const : 'polite' as const,
  }),
}
