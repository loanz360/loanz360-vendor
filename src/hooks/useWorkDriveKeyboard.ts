'use client'

import { useEffect, useCallback, useState } from 'react'

export type KeyboardAction =
  | 'upload'
  | 'newFolder'
  | 'delete'
  | 'rename'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'selectAll'
  | 'deselectAll'
  | 'search'
  | 'refresh'
  | 'download'
  | 'share'
  | 'properties'
  | 'navigateUp'
  | 'navigateBack'
  | 'navigateForward'
  | 'escape'
  | 'enter'
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'toggleSelection'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: KeyboardAction
  description: string
}

const defaultShortcuts: KeyboardShortcut[] = [
  { key: 'u', ctrl: true, action: 'upload', description: 'Upload files' },
  { key: 'n', ctrl: true, shift: true, action: 'newFolder', description: 'New folder' },
  { key: 'Delete', action: 'delete', description: 'Delete selected' },
  { key: 'Backspace', action: 'delete', description: 'Delete selected' },
  { key: 'F2', action: 'rename', description: 'Rename selected' },
  { key: 'c', ctrl: true, action: 'copy', description: 'Copy' },
  { key: 'x', ctrl: true, action: 'cut', description: 'Cut' },
  { key: 'v', ctrl: true, action: 'paste', description: 'Paste' },
  { key: 'a', ctrl: true, action: 'selectAll', description: 'Select all' },
  { key: 'Escape', action: 'escape', description: 'Deselect / Cancel' },
  { key: 'f', ctrl: true, action: 'search', description: 'Search' },
  { key: '/', action: 'search', description: 'Search' },
  { key: 'r', ctrl: true, action: 'refresh', description: 'Refresh' },
  { key: 'F5', action: 'refresh', description: 'Refresh' },
  { key: 'd', ctrl: true, action: 'download', description: 'Download' },
  { key: 's', ctrl: true, shift: true, action: 'share', description: 'Share' },
  { key: 'i', ctrl: true, action: 'properties', description: 'Properties' },
  { key: 'Backspace', alt: true, action: 'navigateUp', description: 'Go to parent folder' },
  { key: 'ArrowLeft', alt: true, action: 'navigateBack', description: 'Go back' },
  { key: 'ArrowRight', alt: true, action: 'navigateForward', description: 'Go forward' },
  { key: 'Enter', action: 'enter', description: 'Open / Select' },
  { key: 'ArrowUp', action: 'moveUp', description: 'Move up' },
  { key: 'ArrowDown', action: 'moveDown', description: 'Move down' },
  { key: 'ArrowLeft', action: 'moveLeft', description: 'Move left' },
  { key: 'ArrowRight', action: 'moveRight', description: 'Move right' },
  { key: ' ', action: 'toggleSelection', description: 'Toggle selection' },
]

interface UseWorkDriveKeyboardOptions {
  onAction: (action: KeyboardAction) => void
  enabled?: boolean
  customShortcuts?: KeyboardShortcut[]
}

export function useWorkDriveKeyboard({
  onAction,
  enabled = true,
  customShortcuts,
}: UseWorkDriveKeyboardOptions) {
  const [shortcuts] = useState<KeyboardShortcut[]>(
    customShortcuts || defaultShortcuts
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Ignore if typing in an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') return
      }

      // Find matching shortcut
      const matchedShortcut = shortcuts.find((shortcut) => {
        if (shortcut.key.toLowerCase() !== event.key.toLowerCase()) return false
        if (!!shortcut.ctrl !== (event.ctrlKey || event.metaKey)) return false
        if (!!shortcut.shift !== event.shiftKey) return false
        if (!!shortcut.alt !== event.altKey) return false
        return true
      })

      if (matchedShortcut) {
        // Prevent default browser behavior for our shortcuts
        if (
          matchedShortcut.ctrl ||
          matchedShortcut.alt ||
          ['F2', 'F5', 'Delete', 'Backspace'].includes(matchedShortcut.key)
        ) {
          event.preventDefault()
        }

        onAction(matchedShortcut.action)
      }
    },
    [enabled, shortcuts, onAction]
  )

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])

  return {
    shortcuts,
  }
}

// Hook to show keyboard shortcuts help
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Listen for ? key to show help
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if (event.key === '?' && event.shiftKey) {
        event.preventDefault()
        toggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  return {
    isOpen,
    toggle,
    open,
    close,
    shortcuts: defaultShortcuts,
  }
}

export default useWorkDriveKeyboard
