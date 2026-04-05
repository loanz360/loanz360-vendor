'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  History,
  Download,
  RotateCcw,
  Clock,
  FileText,
  User,
  HardDrive,
  X,
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface FileVersion {
  id: string
  version_number: number
  file_size_bytes: number
  uploaded_by: string
  uploaded_by_name: string
  created_at: string
  change_note: string | null
}

interface FileVersionHistoryProps {
  fileId: string
  fileName: string
  /** New prop name */
  isOpen?: boolean
  /** New prop name */
  onClose?: () => void
  /** Legacy prop name (backward compat with superadmin workdrive) */
  open?: boolean
  /** Legacy prop name (backward compat with superadmin workdrive) */
  onOpenChange?: (open: boolean) => void
  /** Optional callback when a version is restored */
  onVersionRestored?: (newFileId: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

export function FileVersionHistory({
  fileId,
  fileName,
  isOpen,
  onClose,
  open,
  onOpenChange,
  onVersionRestored,
}: FileVersionHistoryProps) {
  // Backward compatibility: support both open/onOpenChange and isOpen/onClose
  const panelOpen = isOpen ?? open ?? false
  const handleClose = () => {
    onClose?.()
    onOpenChange?.(false)
  }
  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState(1)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState<string[]>([])

  const getAuthToken = async (): Promise<string> => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Session expired')
    }
    return session.access_token
  }

  const fetchVersions = useCallback(async () => {
    if (!fileId) return
    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()

      const response = await fetch(`/api/workdrive/files/${fileId}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to fetch versions' }))
        throw new Error(data.error || 'Failed to fetch versions')
      }

      const result = await response.json()
      if (result.success) {
        setVersions(result.data.versions || [])
        setCurrentVersion(result.data.current_version || 1)
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Error fetching versions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load version history')
    } finally {
      setLoading(false)
    }
  }, [fileId])

  useEffect(() => {
    if (panelOpen && fileId) {
      fetchVersions()
      setCompareMode(false)
      setCompareSelection([])
    }
  }, [panelOpen, fileId, fetchVersions])

  const handleDownload = async (version: FileVersion) => {
    try {
      const token = await getAuthToken()
      const response = await fetch(`/api/workdrive/files/${version.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Download failed')

      const data = await response.json()
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Failed to download this version')
    }
  }

  const handleRestore = async (version: FileVersion) => {
    if (version.version_number === currentVersion) return
    setRestoring(version.id)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/workdrive/versions', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          versionId: version.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Restore failed' }))
        throw new Error(data.error || 'Failed to restore version')
      }

      const result = await response.json()
      toast.success(`Restored to version ${version.version_number}`)
      await fetchVersions()

      // Notify parent of restoration
      if (onVersionRestored && result.newFile?.id) {
        onVersionRestored(result.newFile.id)
      }
    } catch (err) {
      console.error('Restore error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to restore version')
    } finally {
      setRestoring(null)
    }
  }

  const toggleCompareSelection = (versionId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId)
      }
      if (prev.length >= 2) {
        return [prev[1], versionId]
      }
      return [...prev, versionId]
    })
  }

  const getCompareInfo = () => {
    if (compareSelection.length !== 2) return null
    const v1 = versions.find((v) => v.id === compareSelection[0])
    const v2 = versions.find((v) => v.id === compareSelection[1])
    if (!v1 || !v2) return null

    const sizeDiff = v2.file_size_bytes - v1.file_size_bytes
    const sizeDiffStr = sizeDiff > 0
      ? `+${formatFileSize(sizeDiff)}`
      : sizeDiff < 0
        ? `-${formatFileSize(Math.abs(sizeDiff))}`
        : 'No change'

    return {
      v1,
      v2,
      sizeDiff,
      sizeDiffStr,
    }
  }

  if (!panelOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
      onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="File version history"
    >
      {/* Slide-in panel */}
      <div
        className="h-full w-full max-w-lg bg-gray-950/95 border-l border-white/10 backdrop-blur-xl shadow-2xl flex flex-col transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <History className="w-4.5 h-4.5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">Version History</h2>
              <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {fileName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCompareMode(!compareMode)
                setCompareSelection([])
              }}
              className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                compareMode
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                  : 'bg-gray-800/50 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
              title="Compare versions"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 inline mr-1" />
              Compare
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-md bg-gray-800/50 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              aria-label="Close version history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compare result banner */}
        {compareMode && compareSelection.length === 2 && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
            {(() => {
              const info = getCompareInfo()
              if (!info) return null
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-orange-400 font-medium">Comparison</span>
                    <button
                      onClick={() => setCompareSelection([])}
                      className="text-gray-500 hover:text-gray-300 text-[10px]"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">v{info.v1.version_number}</span>
                    <ChevronRight className="w-3 h-3 text-gray-600" />
                    <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">v{info.v2.version_number}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500">Size v{info.v1.version_number}:</span>
                      <span className="ml-1 text-gray-300">{formatFileSize(info.v1.file_size_bytes)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Size v{info.v2.version_number}:</span>
                      <span className="ml-1 text-gray-300">{formatFileSize(info.v2.file_size_bytes)}</span>
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Difference:</span>
                    <span className={`ml-1 font-medium ${
                      info.sizeDiff > 0 ? 'text-green-400' : info.sizeDiff < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {info.sizeDiffStr}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400/50 hover:text-red-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Version list with timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-3" />
              <p className="text-xs">Loading version history...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <History className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm">No version history</p>
              <p className="text-xs text-gray-600 mt-1">Upload new versions to create history</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline connector line */}
              <div className="absolute left-[17px] top-6 bottom-6 w-px bg-gradient-to-b from-orange-500/40 via-white/10 to-transparent" />

              <div className="space-y-1">
                {versions.map((version, index) => {
                  const isCurrent = version.version_number === currentVersion
                  const isSelected = compareSelection.includes(version.id)

                  return (
                    <div key={version.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-3 flex items-center justify-center">
                        <div
                          className={`w-[35px] h-[35px] rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                            isCurrent
                              ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-lg shadow-orange-500/20'
                              : isSelected
                                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                : 'bg-gray-800 border-white/10 text-gray-500'
                          }`}
                        >
                          v{version.version_number}
                        </div>
                      </div>

                      {/* Version card */}
                      <div
                        className={`group rounded-lg border p-3 transition-all cursor-default ${
                          isCurrent
                            ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/30'
                            : isSelected
                              ? 'bg-blue-500/5 border-blue-500/20'
                              : 'bg-gray-900/50 border-white/5 hover:border-white/10 hover:bg-gray-900/80'
                        }`}
                        onClick={() => compareMode && toggleCompareSelection(version.id)}
                      >
                        {/* Top row: badge + time */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Current
                              </span>
                            )}
                            {version.change_note && (
                              <span className="text-[11px] text-gray-500 italic truncate max-w-[180px]">
                                {version.change_note}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getRelativeTime(version.created_at)}
                          </span>
                        </div>

                        {/* Info row */}
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {version.uploaded_by_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(version.file_size_bytes)}
                          </span>
                          <span className="text-gray-700 text-[10px]" title={formatDate(version.created_at)}>
                            {formatDate(version.created_at)}
                          </span>
                        </div>

                        {/* Actions row */}
                        {!compareMode && (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownload(version)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 border border-white/5 hover:border-white/10 transition-all"
                              title="Download this version"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                            {!isCurrent && (
                              <button
                                onClick={() => handleRestore(version)}
                                disabled={restoring === version.id}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-orange-400 hover:text-orange-300 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/20 transition-all disabled:opacity-50"
                                title="Restore this version as current"
                              >
                                {restoring === version.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                Restore
                              </button>
                            )}
                          </div>
                        )}

                        {/* Compare mode checkbox */}
                        {compareMode && (
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                  : 'border-white/10'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                            <span>
                              {isSelected ? 'Selected for comparison' : 'Click to select for comparison'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] text-gray-600">
            <span>{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
            <button
              onClick={fetchVersions}
              className="text-gray-500 hover:text-orange-400 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileVersionHistory
