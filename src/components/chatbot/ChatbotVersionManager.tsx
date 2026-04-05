'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  GitBranch,
  GitCommit,
  Clock,
  User,
  CheckCircle2,
  FileEdit,
  Archive,
  Trash2,
  RotateCcw,
  Upload,
  Plus,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  AlertTriangle,
  Eye,
  Hash,
  Minus,
  PlusCircle,
  CircleDot,
  Layers,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatbotVersion {
  id: string
  version_number: number
  chatbot_id: string
  description: string
  author_name: string
  status: 'draft' | 'published' | 'archived'
  is_active: boolean
  node_count: number
  created_at: string
  flow_data?: any
}

export interface ChatbotVersionManagerProps {
  chatbotId: string
  chatbotName: string
  versions: ChatbotVersion[]
  currentVersion?: ChatbotVersion
  onPublish?: (versionId: string) => Promise<void>
  onRollback?: (versionId: string) => Promise<void>
  onCreateVersion?: (description: string) => Promise<void>
  onDeleteVersion?: (versionId: string) => Promise<void>
  onCompare?: (v1Id: string, v2Id: string) => void
  loading?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function statusConfig(s: ChatbotVersion['status']) {
  switch (s) {
    case 'published':
      return { label: 'Published', bg: 'bg-emerald-900/40', text: 'text-emerald-400', border: 'border-emerald-700/50' }
    case 'draft':
      return { label: 'Draft', bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-700/50' }
    case 'archived':
      return { label: 'Archived', bg: 'bg-zinc-800/60', text: 'text-zinc-500', border: 'border-zinc-700/50' }
  }
}

function computeDiff(flowA: any, flowB: any) {
  const nodesA: Record<string, any> = {}
  const nodesB: Record<string, any> = {}

  const arrA = Array.isArray(flowA?.nodes) ? flowA.nodes : []
  const arrB = Array.isArray(flowB?.nodes) ? flowB.nodes : []

  arrA.forEach((n: any) => { nodesA[n.id ?? n.name ?? JSON.stringify(n)] = n })
  arrB.forEach((n: any) => { nodesB[n.id ?? n.name ?? JSON.stringify(n)] = n })

  const allKeys = new Set([...Object.keys(nodesA), ...Object.keys(nodesB)])
  const added: any[] = []
  const removed: any[] = []
  const modified: Array<{ key: string; before: any; after: any }> = []

  allKeys.forEach((k) => {
    if (!nodesA[k]) {
      added.push({ key: k, ...nodesB[k] })
    } else if (!nodesB[k]) {
      removed.push({ key: k, ...nodesA[k] })
    } else if (JSON.stringify(nodesA[k]) !== JSON.stringify(nodesB[k])) {
      modified.push({ key: k, before: nodesA[k], after: nodesB[k] })
    }
  })

  return { added, removed, modified }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChatbotVersion['status'] }) {
  const cfg = statusConfig(status)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {status === 'published' && <CheckCircle2 size={11} />}
      {status === 'draft' && <FileEdit size={11} />}
      {status === 'archived' && <Archive size={11} />}
      {cfg.label}
    </span>
  )
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF6700]/15 text-[#FF6700] border border-[#FF6700]/30">
      <CircleDot size={11} />
      Active
    </span>
  )
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor = 'bg-[#FF6700]',
  onConfirm,
  onCancel,
  loading,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[#FF6700]/10">
            <AlertTriangle size={20} className="text-[#FF6700]" />
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-zinc-400 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-lg ${confirmColor} text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Diff View ──────────────────────────────────────────────────────────────

function DiffView({
  versionA,
  versionB,
  onClose,
}: {
  versionA: ChatbotVersion
  versionB: ChatbotVersion
  onClose: () => void
}) {
  const diff = useMemo(
    () => computeDiff(versionA.flow_data, versionB.flow_data),
    [versionA.flow_data, versionB.flow_data]
  )

  return (
    <div className="border border-zinc-700 rounded-xl bg-zinc-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-800/60 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <ArrowLeftRight size={16} className="text-[#FF6700]" />
          <span className="text-sm font-medium text-white">
            Comparing v{versionA.version_number} &rarr; v{versionB.version_number}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 px-5 py-3 border-b border-zinc-800">
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <PlusCircle size={13} /> {diff.added.length} added
        </span>
        <span className="flex items-center gap-1.5 text-xs text-red-400">
          <Minus size={13} /> {diff.removed.length} removed
        </span>
        <span className="flex items-center gap-1.5 text-xs text-yellow-400">
          <FileEdit size={13} /> {diff.modified.length} modified
        </span>
      </div>

      {/* Side-by-side */}
      <div className="grid grid-cols-2 divide-x divide-zinc-800">
        {/* Left: Version A */}
        <div>
          <div className="px-4 py-2 bg-zinc-800/40 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">v{versionA.version_number} &mdash; {versionA.description}</span>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {diff.removed.map((node, i) => (
              <div key={`rem-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/40">
                <Minus size={13} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-300 truncate">{node.key}</span>
              </div>
            ))}
            {diff.modified.map((node, i) => (
              <div key={`mod-a-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-950/30 border border-yellow-900/40">
                <FileEdit size={13} className="text-yellow-400 shrink-0" />
                <span className="text-xs text-yellow-300 truncate">{node.key}</span>
              </div>
            ))}
            {diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No differences found</p>
            )}
          </div>
        </div>

        {/* Right: Version B */}
        <div>
          <div className="px-4 py-2 bg-zinc-800/40 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">v{versionB.version_number} &mdash; {versionB.description}</span>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
            {diff.added.map((node, i) => (
              <div key={`add-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-900/40">
                <PlusCircle size={13} className="text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-300 truncate">{node.key}</span>
              </div>
            ))}
            {diff.modified.map((node, i) => (
              <div key={`mod-b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-950/30 border border-yellow-900/40">
                <FileEdit size={13} className="text-yellow-400 shrink-0" />
                <span className="text-xs text-yellow-300 truncate">{node.key}</span>
              </div>
            ))}
            {diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No differences found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ChatbotVersionManager({
  chatbotId,
  chatbotName,
  versions,
  currentVersion,
  onPublish,
  onRollback,
  onCreateVersion,
  onDeleteVersion,
  onCompare,
  loading = false,
}: ChatbotVersionManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Compare state
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState<string[]>([])
  const [showDiff, setShowDiff] = useState(false)

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: 'publish' | 'rollback' | 'delete'
    versionId: string
    versionNumber: number
  } | null>(null)

  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version_number - a.version_number),
    [versions]
  )

  const handleCreate = useCallback(async () => {
    if (!onCreateVersion || !newDescription.trim()) return
    setCreating(true)
    try {
      await onCreateVersion(newDescription.trim())
      setNewDescription('')
      setShowCreateModal(false)
    } finally {
      setCreating(false)
    }
  }, [onCreateVersion, newDescription])

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return
    setActionLoading(confirmAction.versionId)
    try {
      if (confirmAction.type === 'publish' && onPublish) {
        await onPublish(confirmAction.versionId)
      } else if (confirmAction.type === 'rollback' && onRollback) {
        await onRollback(confirmAction.versionId)
      } else if (confirmAction.type === 'delete' && onDeleteVersion) {
        await onDeleteVersion(confirmAction.versionId)
      }
    } finally {
      setActionLoading(null)
      setConfirmAction(null)
    }
  }, [confirmAction, onPublish, onRollback, onDeleteVersion])

  const toggleCompareSelect = (id: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const startCompare = () => {
    if (compareSelection.length === 2) {
      if (onCompare) onCompare(compareSelection[0], compareSelection[1])
      setShowDiff(true)
    }
  }

  const diffVersionA = versions.find((v) => v.id === compareSelection[0])
  const diffVersionB = versions.find((v) => v.id === compareSelection[1])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#FF6700]/10 border border-[#FF6700]/20">
            <GitBranch size={20} className="text-[#FF6700]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{chatbotName}</h2>
            <p className="text-xs text-zinc-500">
              {versions.length} version{versions.length !== 1 ? 's' : ''}
              {currentVersion && (
                <span> &middot; Current: v{currentVersion.version_number}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCompareMode(!compareMode)
              setCompareSelection([])
              setShowDiff(false)
            }}
            className={`px-3 py-2 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
              compareMode
                ? 'bg-[#FF6700]/10 border-[#FF6700]/30 text-[#FF6700]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <ArrowLeftRight size={14} />
            {compareMode ? 'Exit Compare' : 'Compare'}
          </button>

          {onCreateVersion && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 text-xs rounded-lg bg-[#FF6700] text-white hover:bg-[#FF6700]/90 transition-colors flex items-center gap-1.5 font-medium"
            >
              <Plus size={14} />
              New Version
            </button>
          )}
        </div>
      </div>

      {/* Compare bar */}
      {compareMode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/60 border border-zinc-700">
          <ArrowLeftRight size={14} className="text-[#FF6700] shrink-0" />
          <p className="text-xs text-zinc-400 flex-1">
            {compareSelection.length === 0 && 'Select two versions to compare'}
            {compareSelection.length === 1 && 'Select one more version to compare'}
            {compareSelection.length === 2 && 'Ready to compare'}
          </p>
          {compareSelection.length === 2 && (
            <button
              onClick={startCompare}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#FF6700] text-white hover:bg-[#FF6700]/90 transition-colors font-medium"
            >
              Compare
            </button>
          )}
        </div>
      )}

      {/* Diff View */}
      {showDiff && diffVersionA && diffVersionB && (
        <DiffView
          versionA={diffVersionA}
          versionB={diffVersionB}
          onClose={() => {
            setShowDiff(false)
            setCompareSelection([])
          }}
        />
      )}

      {/* Version list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[#FF6700]" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-zinc-800/50 mb-4">
            <Layers size={32} className="text-zinc-600" />
          </div>
          <h3 className="text-sm font-medium text-zinc-400 mb-1">No versions yet</h3>
          <p className="text-xs text-zinc-600">Create your first version to start tracking changes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((v) => {
            const isExpanded = expandedId === v.id
            const isCompareSelected = compareSelection.includes(v.id)

            return (
              <div
                key={v.id}
                className={`rounded-xl border transition-all ${
                  v.is_active
                    ? 'border-[#FF6700]/30 bg-[#FF6700]/[0.03]'
                    : isCompareSelected
                    ? 'border-[#FF6700]/40 bg-[#FF6700]/[0.05]'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => {
                    if (compareMode) {
                      toggleCompareSelect(v.id)
                    } else {
                      setExpandedId(isExpanded ? null : v.id)
                    }
                  }}
                >
                  {/* Compare checkbox */}
                  {compareMode && (
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isCompareSelected
                          ? 'bg-[#FF6700] border-[#FF6700]'
                          : 'border-zinc-600 hover:border-zinc-500'
                      }`}
                    >
                      {isCompareSelected && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                  )}

                  {/* Timeline dot */}
                  {!compareMode && (
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          v.is_active
                            ? 'border-[#FF6700] bg-[#FF6700]'
                            : v.status === 'published'
                            ? 'border-emerald-500 bg-emerald-500/30'
                            : 'border-zinc-600 bg-zinc-800'
                        }`}
                      />
                    </div>
                  )}

                  {/* Version info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">v{v.version_number}</span>
                      <StatusBadge status={v.status} />
                      {v.is_active && <ActiveBadge />}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{v.description}</p>
                  </div>

                  {/* Meta */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      {v.node_count} nodes
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {v.author_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(v.created_at)}
                    </span>
                  </div>

                  {/* Expand arrow */}
                  {!compareMode && (
                    <div className="shrink-0 text-zinc-500">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </div>

                {/* Expanded section */}
                {isExpanded && !compareMode && (
                  <div className="px-4 pb-4 pt-1 border-t border-zinc-800 space-y-3">
                    {/* Mobile meta */}
                    <div className="flex sm:hidden items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Hash size={12} />
                        {v.node_count} nodes
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {v.author_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(v.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {v.status === 'draft' && onPublish && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmAction({ type: 'publish', versionId: v.id, versionNumber: v.version_number })
                          }}
                          disabled={actionLoading === v.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Upload size={13} />
                          Publish
                        </button>
                      )}

                      {!v.is_active && v.status !== 'archived' && onRollback && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmAction({ type: 'rollback', versionId: v.id, versionNumber: v.version_number })
                          }}
                          disabled={actionLoading === v.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800/50 hover:bg-blue-900/50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCcw size={13} />
                          Rollback
                        </button>
                      )}

                      {v.status === 'draft' && onDeleteVersion && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmAction({ type: 'delete', versionId: v.id, versionNumber: v.version_number })
                          }}
                          disabled={actionLoading === v.id}
                          className="px-3 py-1.5 text-xs rounded-lg bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      )}

                      {actionLoading === v.id && (
                        <Loader2 size={14} className="animate-spin text-[#FF6700]" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Version Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-[#FF6700]/10">
                <GitCommit size={20} className="text-[#FF6700]" />
              </div>
              <h3 className="text-lg font-semibold text-white">Create New Version</h3>
            </div>

            <label className="block mb-2 text-xs font-medium text-zinc-400">
              Version description
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe the changes in this version..."
              rows={3}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-600 px-3 py-2.5 focus:outline-none focus:border-[#FF6700]/50 focus:ring-1 focus:ring-[#FF6700]/30 resize-none"
              autoFocus
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewDescription('')
                }}
                disabled={creating}
                className="px-4 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newDescription.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-[#FF6700] text-white hover:bg-[#FF6700]/90 transition-opacity disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === 'publish'
              ? 'Publish Version'
              : confirmAction.type === 'rollback'
              ? 'Rollback Version'
              : 'Delete Version'
          }
          message={
            confirmAction.type === 'publish'
              ? `This will make v${confirmAction.versionNumber} the live version. The current published version will be archived.`
              : confirmAction.type === 'rollback'
              ? `This will restore v${confirmAction.versionNumber} as the active chatbot flow. A new version will be created from the current state.`
              : `This will permanently delete the draft v${confirmAction.versionNumber}. This action cannot be undone.`
          }
          confirmLabel={
            confirmAction.type === 'publish'
              ? 'Publish'
              : confirmAction.type === 'rollback'
              ? 'Rollback'
              : 'Delete'
          }
          confirmColor={
            confirmAction.type === 'delete' ? 'bg-red-600' : 'bg-[#FF6700]'
          }
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
          loading={actionLoading !== null}
        />
      )}
    </div>
  )
}
