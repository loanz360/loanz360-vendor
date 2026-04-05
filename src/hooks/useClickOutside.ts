import { useEffect, useRef, type RefObject } from 'react'

/**
 * Hook that detects clicks outside of a referenced element
 * Useful for closing dropdowns, modals, and popover menus
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  callback: () => void,
  enabled = true
): RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (!enabled) return

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [callback, enabled])

  return ref
}
