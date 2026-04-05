'use client'

import { useState, useCallback, useRef } from 'react'

interface UndoState {
  message: string
  undoFn: () => Promise<void>
  timeoutId: NodeJS.Timeout | null
}

const UNDO_TIMEOUT_MS = 5000 // 5 seconds to undo

/**
 * Hook for undoable destructive actions.
 * Shows a toast with an "Undo" button for 5 seconds.
 * After timeout, the action is finalized (API call made).
 *
 * Usage:
 *   const { executeWithUndo, undoState, dismiss } = useUndoAction()
 *
 *   const handleDelete = (id: string) => {
 *     executeWithUndo({
 *       message: `Employee deleted`,
 *       optimisticAction: () => setEmployees(prev => prev.filter(e => e.id !== id)),
 *       undoAction: async () => setEmployees(prev => [...prev, deletedEmployee]),
 *       finalAction: async () => {
 *         await fetch(`/api/hr/employees/${id}`, { method: 'DELETE' })
 *       },
 *     })
 *   }
 */
export function useUndoAction() {
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null)

  const dismiss = useCallback(() => {
    if (undoState?.timeoutId) {
      clearTimeout(undoState.timeoutId)
    }
    setUndoState(null)
  }, [undoState])

  const executeWithUndo = useCallback(({
    message,
    optimisticAction,
    undoAction,
    finalAction,
  }: {
    message: string
    optimisticAction: () => void
    undoAction: () => Promise<void>
    finalAction: () => Promise<void>
  }) => {
    // Clear any existing undo state
    if (undoState?.timeoutId) {
      clearTimeout(undoState.timeoutId)
      // Execute the previous pending action immediately
      pendingActionRef.current?.()
    }

    // Apply optimistic update
    optimisticAction()

    // Store final action
    pendingActionRef.current = finalAction

    // Set timeout to finalize
    const timeoutId = setTimeout(async () => {
      try {
        await finalAction()
      } catch {
        // If final action fails, undo
        await undoAction()
      }
      pendingActionRef.current = null
      setUndoState(null)
    }, UNDO_TIMEOUT_MS)

    setUndoState({
      message,
      undoFn: async () => {
        clearTimeout(timeoutId)
        await undoAction()
        pendingActionRef.current = null
        setUndoState(null)
      },
      timeoutId,
    })
  }, [undoState])

  return { executeWithUndo, undoState, dismiss }
}
