/**
 * Accessibility utilities for Offers module
 * WCAG 2.1 AA Compliance
 */

// ARIA live region announcer for screen readers
let announcer: HTMLElement | null = null

export function createAnnouncer(): HTMLElement | null {
  if (typeof document === 'undefined') return null

  if (!announcer) {
    announcer = document.createElement('div')
    announcer.id = 'offers-announcer'
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    announcer.setAttribute('role', 'status')
    announcer.className = 'sr-only' // Visually hidden but accessible
    announcer.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `
    document.body.appendChild(announcer)
  }
  return announcer
}

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return

  const announcerEl = createAnnouncer()
  if (!announcerEl) return
  announcerEl.setAttribute('aria-live', priority)

  // Clear and set message to trigger announcement
  announcerEl.textContent = ''
  requestAnimationFrame(() => {
    announcerEl.textContent = message
  })
}

// Focus management utilities
export function focusFirstInteractive(container: HTMLElement | null): void {
  if (!container) return

  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )

  if (focusableElements.length > 0) {
    focusableElements[0].focus()
  }
}

export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)

  return () => {
    container.removeEventListener('keydown', handleKeyDown)
  }
}

// Keyboard navigation helpers
export function handleListKeyboard(
  event: KeyboardEvent,
  currentIndex: number,
  itemCount: number,
  onSelect: (index: number) => void
): number | null {
  const { key } = event

  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      event.preventDefault()
      const nextIndex = (currentIndex + 1) % itemCount
      onSelect(nextIndex)
      return nextIndex

    case 'ArrowUp':
    case 'ArrowLeft':
      event.preventDefault()
      const prevIndex = (currentIndex - 1 + itemCount) % itemCount
      onSelect(prevIndex)
      return prevIndex

    case 'Home':
      event.preventDefault()
      onSelect(0)
      return 0

    case 'End':
      event.preventDefault()
      const lastIndex = itemCount - 1
      onSelect(lastIndex)
      return lastIndex

    case 'Enter':
    case ' ':
      event.preventDefault()
      onSelect(currentIndex)
      return currentIndex

    default:
      return null
  }
}

// Skip link helper
export function createSkipLink(targetId: string, text: string): HTMLAnchorElement | null {
  if (typeof document === 'undefined') return null

  const skipLink = document.createElement('a')
  skipLink.href = `#${targetId}`
  skipLink.className = 'skip-link'
  skipLink.textContent = text
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #f97316;
    color: white;
    padding: 8px 16px;
    z-index: 100;
    transition: top 0.2s;
  `

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0'
  })

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px'
  })

  return skipLink
}

// Color contrast helpers (for dynamic theming)
export function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]
    const [r, g, b] = rgb.map((c) => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background)

  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7
  }
  // AA level
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

// ARIA label generators
export function generateOfferAriaLabel(offer: {
  offer_title: string
  rolled_out_by: string
  status: string
  end_date: string
}): string {
  const endDate = new Date(offer.end_date).toLocaleDateString()
  return `${offer.offer_title} from ${offer.rolled_out_by}. Status: ${offer.status}. Valid until ${endDate}`
}

export function generateFilterAriaLabel(
  filterType: string,
  selectedValue: string | null,
  totalOptions: number
): string {
  if (selectedValue) {
    return `${filterType} filter. Currently selected: ${selectedValue}. ${totalOptions} options available.`
  }
  return `${filterType} filter. No selection. ${totalOptions} options available.`
}

export function generatePaginationAriaLabel(
  currentPage: number,
  totalPages: number,
  itemsPerPage: number,
  totalItems: number
): string {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)
  return `Page ${currentPage} of ${totalPages}. Showing items ${startItem} to ${endItem} of ${totalItems}.`
}

// Focus visible polyfill helper
export function addFocusVisiblePolyfill(): void {
  if (typeof document === 'undefined') return

  document.addEventListener('keydown', () => {
    document.body.classList.add('keyboard-navigation')
  })

  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-navigation')
  })
}

// Reduce motion preference helper
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Screen reader only CSS class helper
export const srOnlyStyles = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: '0'
}

// Component-specific accessibility hooks
export function useOfferCardA11y(offerId: string) {
  return {
    role: 'article' as const,
    'aria-labelledby': `offer-title-${offerId}`,
    'aria-describedby': `offer-desc-${offerId}`,
    tabIndex: 0
  }
}

export function useOfferModalA11y(offerId: string, isOpen: boolean) {
  return {
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': `modal-title-${offerId}`,
    'aria-describedby': `modal-desc-${offerId}`,
    'aria-hidden': !isOpen
  }
}

// Error message helper
export function createErrorMessage(fieldId: string, message: string) {
  return {
    id: `${fieldId}-error`,
    role: 'alert' as const,
    'aria-live': 'assertive' as const,
    message
  }
}

// Loading state helper
export function createLoadingState(isLoading: boolean, loadingText: string = 'Loading...') {
  return {
    'aria-busy': isLoading,
    'aria-live': 'polite' as const,
    ...(isLoading && { 'aria-label': loadingText })
  }
}

export default {
  announce,
  focusFirstInteractive,
  trapFocus,
  handleListKeyboard,
  createSkipLink,
  getContrastRatio,
  meetsContrastRequirement,
  generateOfferAriaLabel,
  generateFilterAriaLabel,
  generatePaginationAriaLabel,
  addFocusVisiblePolyfill,
  prefersReducedMotion,
  srOnlyStyles,
  useOfferCardA11y,
  useOfferModalA11y,
  createErrorMessage,
  createLoadingState
}
