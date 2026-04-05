'use client'

import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { Upload, X, FileText, Image, FileSpreadsheet, File, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DragDropUploadZoneProps {
  /** Called with validated files after drop or selection */
  onFilesDropped: (files: File[]) => void
  /** Maximum file size in bytes. Defaults to 15 MB */
  maxFileSize?: number
  /** Allowed MIME types (e.g. ["application/pdf", "image/png"]). Empty = all allowed */
  allowedTypes?: string[]
  /** Disables the zone */
  disabled?: boolean
  /** Additional CSS classes for the root element */
  className?: string
  /** Label text shown in the drop zone */
  label?: string
  /** Whether multiple files are allowed. Defaults to true */
  multiple?: boolean
}

interface PreviewFile {
  id: string
  file: File
  previewUrl?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SIZE = 15 * 1024 * 1024 // 15 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(file: File) {
  const mime = file.type
  if (mime.startsWith('image/')) return Image
  if (mime === 'application/pdf' || mime.includes('pdf')) return FileText
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls')
  )
    return FileSpreadsheet
  return File
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DragDropUploadZone({
  onFilesDropped,
  maxFileSize = DEFAULT_MAX_SIZE,
  allowedTypes = [],
  disabled = false,
  className,
  label = 'Drag & drop files here, or click to browse',
  multiple = true,
}: DragDropUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [previews, setPreviews] = useState<PreviewFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // ---- Validation ----

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const valid: File[] = []

      for (const file of files) {
        // Size check
        if (file.size > maxFileSize) {
          toast.error(`"${file.name}" exceeds the ${formatSize(maxFileSize)} size limit.`)
          continue
        }

        // Type check
        if (allowedTypes.length > 0) {
          const isAllowed =
            allowedTypes.some((t) => file.type === t) ||
            allowedTypes.some((t) => {
              // Support wildcard like "image/*"
              if (t.endsWith('/*')) {
                return file.type.startsWith(t.replace('/*', '/'))
              }
              // Support extension strings like ".pdf"
              if (t.startsWith('.')) {
                return file.name.toLowerCase().endsWith(t.toLowerCase())
              }
              return false
            })

          if (!isAllowed) {
            toast.error(`"${file.name}" has an unsupported file type.`)
            continue
          }
        }

        valid.push(file)
      }

      return valid
    },
    [maxFileSize, allowedTypes],
  )

  // ---- Preview management ----

  const addPreviews = useCallback((files: File[]) => {
    const newPreviews: PreviewFile[] = files.map((file) => {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      let previewUrl: string | undefined
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file)
      }
      return { id, file, previewUrl }
    })

    setPreviews((prev) => [...prev, ...newPreviews])
  }, [])

  const removePreview = useCallback(
    (id: string) => {
      setPreviews((prev) => {
        const item = prev.find((p) => p.id === id)
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
        return prev.filter((p) => p.id !== id)
      })
    },
    [],
  )

  // ---- Drop handlers ----

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      dragCounterRef.current += 1
      if (dragCounterRef.current === 1) {
        setIsDragOver(true)
      }
    },
    [disabled],
  )

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragOver(false)
      }
    },
    [],
  )

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
    },
    [],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragOver(false)

      if (disabled) return

      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length === 0) return

      const filesToProcess = multiple ? droppedFiles : [droppedFiles[0]]
      const validated = validateFiles(filesToProcess)

      if (validated.length > 0) {
        addPreviews(validated)
        onFilesDropped(validated)
      }
    },
    [disabled, multiple, validateFiles, addPreviews, onFilesDropped],
  )

  // ---- Click / keyboard handlers ----

  const handleClick = useCallback(() => {
    if (disabled) return
    fileInputRef.current?.click()
  }, [disabled])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        fileInputRef.current?.click()
      }
    },
    [disabled],
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      const fileArray = Array.from(files)
      const validated = validateFiles(fileArray)

      if (validated.length > 0) {
        addPreviews(validated)
        onFilesDropped(validated)
      }

      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [validateFiles, addPreviews, onFilesDropped],
  )

  // ---- Compute accept string for the <input> ----
  const acceptString = allowedTypes.length > 0 ? allowedTypes.join(',') : undefined

  return (
    <div className={cn('space-y-3', className)}>
      {/* ---- Drop zone ---- */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
          disabled
            ? 'border-gray-700 bg-gray-900/50 text-gray-600 cursor-not-allowed'
            : isDragOver
              ? 'border-orange-500 bg-orange-500/10 text-orange-400 scale-[1.01]'
              : 'border-white/10 bg-gray-900 text-gray-400 hover:border-white/20 hover:bg-gray-900/80',
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={acceptString}
          onChange={handleFileInputChange}
          tabIndex={-1}
          aria-hidden="true"
        />

        {/* Drag overlay */}
        {isDragOver && !disabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-orange-500/10 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-orange-400 animate-bounce" />
              <span className="text-sm font-medium text-orange-400">Drop files here</span>
            </div>
          </div>
        )}

        {/* Default content */}
        <div
          className={cn(
            'flex flex-col items-center gap-2 transition-opacity',
            isDragOver && 'opacity-0',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 border border-white/10">
            <Upload className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-center">{label}</p>
          <p className="text-xs text-gray-500 text-center">
            Max size: {formatSize(maxFileSize)}
            {allowedTypes.length > 0 && (
              <>
                {' '}
                &middot; Accepted:{' '}
                {allowedTypes
                  .map((t) => (t.startsWith('.') ? t : t.split('/')[1] ?? t))
                  .join(', ')}
              </>
            )}
          </p>
        </div>
      </div>

      {/* ---- File previews ---- */}
      {previews.length > 0 && (
        <div className="space-y-2" role="list" aria-label="Uploaded file previews">
          {previews.map((pf) => {
            const Icon = getFileIcon(pf.file)
            return (
              <div
                key={pf.id}
                role="listitem"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-gray-800/60 px-3 py-2"
              >
                {pf.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pf.previewUrl}
                    alt={pf.file.name}
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-700">
                    <Icon className="h-5 w-5 text-gray-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{pf.file.name}</p>
                  <p className="text-[11px] text-gray-500">{formatSize(pf.file.size)}</p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePreview(pf.id)
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={`Remove ${pf.file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
