'use client'

import { useState, useCallback, useRef, useEffect, DragEvent } from 'react'

export interface DragDropItem {
  id: string
  type: 'file' | 'folder'
  name: string
  data?: unknown}

export interface DropTarget {
  id: string
  type: 'folder' | 'workspace' | 'trash'
  name: string
}

interface UseWorkDriveDragDropOptions {
  onDrop?: (items: DragDropItem[], target: DropTarget) => void
  onFileDrop?: (files: FileList, target?: DropTarget) => void
  onDragStart?: (items: DragDropItem[]) => void
  onDragEnd?: () => void
  enabled?: boolean
  acceptFiles?: boolean
}

export function useWorkDriveDragDrop({
  onDrop,
  onFileDrop,
  onDragStart,
  onDragEnd,
  enabled = true,
  acceptFiles = true,
}: UseWorkDriveDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dragItems, setDragItems] = useState<DragDropItem[]>([])
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const dragCounter = useRef(0)

  // Handle file drop from OS
  const handleExternalDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()

      if (!enabled || !acceptFiles) return

      const files = event.dataTransfer.files
      if (files.length > 0) {
        onFileDrop?.(files, dropTarget || undefined)
      }

      setIsDraggingOver(false)
      setDropTarget(null)
      dragCounter.current = 0
    },
    [enabled, acceptFiles, onFileDrop, dropTarget]
  )

  // Handle internal item drop
  const handleInternalDrop = useCallback(
    (event: DragEvent<HTMLElement>, target: DropTarget) => {
      event.preventDefault()
      event.stopPropagation()

      if (!enabled) return

      try {
        const data = event.dataTransfer.getData('application/workdrive')
        if (data) {
          const items: DragDropItem[] = JSON.parse(data)
          onDrop?.(items, target)
        }
      } catch (error) {
        console.error('Failed to parse drag data:', error)
      }

      setIsDragging(false)
      setIsDraggingOver(false)
      setDropTarget(null)
      setDragItems([])
      dragCounter.current = 0
    },
    [enabled, onDrop]
  )

  // Start dragging items
  const startDrag = useCallback(
    (event: DragEvent<HTMLElement>, items: DragDropItem[]) => {
      if (!enabled) return

      event.dataTransfer.setData('application/workdrive', JSON.stringify(items))
      event.dataTransfer.effectAllowed = 'move'

      setDragItems(items)
      setIsDragging(true)
      onDragStart?.(items)

      // Create custom drag image
      const dragImage = document.createElement('div')
      dragImage.className =
        'fixed -top-96 left-0 bg-background border rounded-lg shadow-lg px-3 py-2 text-sm'
      dragImage.innerHTML = `
        <div class="flex items-center gap-2">
          <span>${items.length} item${items.length > 1 ? 's' : ''}</span>
        </div>
      `
      document.body.appendChild(dragImage)
      event.dataTransfer.setDragImage(dragImage, 0, 0)

      // Clean up drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage)
      }, 0)
    },
    [enabled, onDragStart]
  )

  // Handle drag over
  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()

      if (!enabled) return

      // Check if it's a file drop from OS
      const hasFiles = Array.from(event.dataTransfer.types).includes('Files')
      const hasInternal = Array.from(event.dataTransfer.types).includes(
        'application/workdrive'
      )

      if (hasFiles || hasInternal) {
        event.dataTransfer.dropEffect = 'move'
      }
    },
    [enabled]
  )

  // Handle drag enter
  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>, target?: DropTarget) => {
      event.preventDefault()
      event.stopPropagation()

      if (!enabled) return

      dragCounter.current++
      setIsDraggingOver(true)

      if (target) {
        setDropTarget(target)
      }
    },
    [enabled]
  )

  // Handle drag leave
  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()

      if (!enabled) return

      dragCounter.current--
      if (dragCounter.current === 0) {
        setIsDraggingOver(false)
        setDropTarget(null)
      }
    },
    [enabled]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!enabled) return

    setIsDragging(false)
    setIsDraggingOver(false)
    setDropTarget(null)
    setDragItems([])
    dragCounter.current = 0
    onDragEnd?.()
  }, [enabled, onDragEnd])

  // Create props for drag source
  const getDragSourceProps = useCallback(
    (items: DragDropItem[]) => ({
      draggable: enabled,
      onDragStart: (e: DragEvent<HTMLElement>) => startDrag(e, items),
      onDragEnd: handleDragEnd,
    }),
    [enabled, startDrag, handleDragEnd]
  )

  // Create props for drop target
  const getDropTargetProps = useCallback(
    (target: DropTarget) => ({
      onDragOver: handleDragOver,
      onDragEnter: (e: DragEvent<HTMLElement>) => handleDragEnter(e, target),
      onDragLeave: handleDragLeave,
      onDrop: (e: DragEvent<HTMLElement>) => handleInternalDrop(e, target),
    }),
    [handleDragOver, handleDragEnter, handleDragLeave, handleInternalDrop]
  )

  // Create props for file drop zone
  const getFileDropZoneProps = useCallback(
    () => ({
      onDragOver: handleDragOver,
      onDragEnter: (e: DragEvent<HTMLElement>) => handleDragEnter(e),
      onDragLeave: handleDragLeave,
      onDrop: handleExternalDrop,
    }),
    [handleDragOver, handleDragEnter, handleDragLeave, handleExternalDrop]
  )

  return {
    isDragging,
    isDraggingOver,
    dragItems,
    dropTarget,
    startDrag,
    getDragSourceProps,
    getDropTargetProps,
    getFileDropZoneProps,
    handleDragEnd,
  }
}

// Hook for global file drop zone (for uploading files from desktop)
export function useGlobalFileDrop(
  onFileDrop: (files: FileList) => void,
  enabled = true
) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const handleDragEnter = (e: globalThis.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter.current++
        setIsDraggingOver(true)
      }
    }

    const handleDragLeave = (e: globalThis.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      dragCounter.current--
      if (dragCounter.current === 0) {
        setIsDraggingOver(false)
      }
    }

    const handleDragOver = (e: globalThis.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: globalThis.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setIsDraggingOver(false)
      dragCounter.current = 0

      if (e.dataTransfer?.files.length) {
        onFileDrop(e.dataTransfer.files)
      }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [enabled, onFileDrop])

  return { isDraggingOver }
}

export default useWorkDriveDragDrop
