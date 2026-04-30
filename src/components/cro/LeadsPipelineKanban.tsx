'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import {
  Phone,
  MessageSquare,
  Clock,
  IndianRupee,
  GripVertical,
  User,
  Inbox,
  Eye,
} from 'lucide-react'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  STATUS_COLORS,
  formatWhatsAppLink,
  formatTelLink,
} from '@/lib/constants/sales-pipeline'

// ============================================================================
// Types
// ============================================================================

interface LeadsPipelineKanbanProps {
  leads: unknown[]
  onStageChange: (leadId: string, newStage: string) => Promise<void>
  onLeadClick: (leadId: string) => void
  isLoading?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '---'
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length < 4) return cleaned
  return '\u2022\u2022\u2022\u2022\u2022\u2022' + cleaned.slice(-4)
}

function formatINR(amount: number | null | undefined): string {
  if (amount == null) return 'N/A'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  const created = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

function getLeadScoreColor(score: number | null | undefined): string {
  if (score == null) return 'bg-gray-500'
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function getColumnAccentColor(stage: string): string {
  const colors = STATUS_COLORS[stage]
  return colors?.dot || 'bg-gray-400'
}

// ============================================================================
// Skeleton loader for columns
// ============================================================================

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {LEAD_STAGES.map((stage) => (
        <div
          key={stage}
          className="flex-shrink-0 w-[300px] md:w-[280px] lg:w-[300px] bg-[#1a1a2e] rounded-xl border border-white/10"
        >
          <div className="p-4 border-b border-white/10">
            <div className="h-5 w-24 bg-white/10 rounded animate-pulse" />
            <div className="flex gap-2 mt-2">
              <div className="h-4 w-12 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 rounded-lg p-4 space-y-3 animate-pulse">
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-1/2 bg-white/10 rounded" />
                <div className="h-3 w-2/3 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Lead Card
// ============================================================================

interface LeadCardProps {
  lead: unknown; onLeadClick: (id: string) => void
  onDragStart: (e: React.DragEvent, leadId: string, stage: string) => void
  onDragEnd: (e: React.DragEvent) => void
  isDragging: boolean
}

function LeadCard({ lead, onLeadClick, onDragStart, onDragEnd, isDragging }: LeadCardProps) {
  const days = daysSince(lead.created_at)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id, lead.stage)}
      onDragEnd={onDragEnd}
      className={`
        group relative bg-[#16213e] border border-white/10 rounded-lg p-4
        cursor-grab active:cursor-grabbing
        hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5
        transition-all duration-200 select-none
        ${isDragging ? 'opacity-50 scale-95 ring-2 ring-orange-500/50' : ''}
      `}
    >
      {/* Drag handle */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity">
        <GripVertical className="w-4 h-4 text-gray-500" />
      </div>

      {/* Customer name */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-orange-400" />
        </div>
        <h4 className="font-semibold text-sm text-white truncate font-poppins">
          {lead.customer_name}
        </h4>
      </div>

      {/* Phone (masked) */}
      <p className="text-xs text-gray-400 mb-2 font-mono">
        {maskPhone(lead.phone)}
      </p>

      {/* Loan type & amount */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 truncate max-w-[120px]">
          {lead.loan_type || 'N/A'}
        </span>
        <span className="text-xs font-semibold text-white flex items-center gap-0.5">
          <IndianRupee className="w-3 h-3 text-orange-400" />
          {lead.loan_amount ? formatINR(lead.loan_amount).replace('\u20B9', '').trim() : 'N/A'}
        </span>
      </div>

      {/* Lead score + days */}
      <div className="flex items-center justify-between mb-3">
        {/* Lead score indicator */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${getLeadScoreColor(lead.lead_score)}`} />
          <span className="text-[11px] text-gray-400">
            Score: {lead.lead_score ?? 'N/A'}
          </span>
        </div>

        {/* Days since creation */}
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{days}d ago</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = formatTelLink(lead.phone)
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs font-medium transition-colors"
          title="Call"
        >
          <Phone className="w-3 h-3" />
          <span>Call</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.open(formatWhatsAppLink(lead.phone), '_blank')
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium transition-colors"
          title="WhatsApp"
        >
          <MessageSquare className="w-3 h-3" />
          <span>WhatsApp</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onLeadClick(lead.id)
          }}
          className="flex items-center justify-center p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="View Details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Kanban Column
// ============================================================================

interface KanbanColumnProps {
  stage: string
  leads: unknown[]
  totalValue: number
  onLeadClick: (id: string) => void
  onDragStart: (e: React.DragEvent, leadId: string, stage: string) => void
  onDragEnd: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, targetStage: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  isDragTarget: boolean
  draggingId: string | null
}

function KanbanColumn({
  stage,
  leads,
  totalValue,
  onLeadClick,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  onDragLeave,
  isDragTarget,
  draggingId,
}: KanbanColumnProps) {
  const accentDot = getColumnAccentColor(stage)

  return (
    <div
      className={`
        flex-shrink-0 w-[300px] md:w-[280px] lg:w-[300px]
        bg-[#1a1a2e] rounded-xl border transition-all duration-200
        ${isDragTarget
          ? 'border-orange-500/50 ring-2 ring-orange-500/50 bg-orange-500/5'
          : 'border-white/10'
        }
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage)}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-2.5 h-2.5 rounded-full ${accentDot}`} />
          <h3 className="text-sm font-semibold text-white font-poppins">
            {LEAD_STAGE_LABELS[stage] || stage}
          </h3>
          <span className="ml-auto text-xs font-medium text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 pl-[18px]">
          {formatINR(totalValue)} total value
        </p>
      </div>

      {/* Cards container - scrollable */}
      <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
        {leads.length === 0 ? (
          <div className={`
            flex flex-col items-center justify-center py-12 text-center
            ${isDragTarget ? 'opacity-100' : 'opacity-60'}
          `}>
            <Inbox className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">No leads in this stage</p>
            <p className="text-[10px] text-gray-600 mt-1">Drag leads here to update</p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onLeadClick={onLeadClick}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggingId === lead.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Kanban Component
// ============================================================================

export default function LeadsPipelineKanban({
  leads,
  onStageChange,
  onLeadClick,
  isLoading = false,
}: LeadsPipelineKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingFromStage, setDraggingFromStage] = useState<string | null>(null)
  const [dragTargetStage, setDragTargetStage] = useState<string | null>(null)
  const [optimisticLeads, setOptimisticLeads] = useState<Map<string, string>>(new Map())

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    for (const stage of LEAD_STAGES) {
      grouped[stage] = []
    }
    for (const lead of leads) {
      // Use optimistic stage if available
      const effectiveStage = optimisticLeads.get(lead.id) || lead.stage
      if (grouped[effectiveStage]) {
        grouped[effectiveStage].push({ ...lead, stage: effectiveStage })
      } else {
        // Fallback: put in 'new' if stage is unknown
        grouped['new'].push(lead)
      }
    }
    return grouped
  }, [leads, optimisticLeads])

  // Total value per stage
  const stageValues = useMemo(() => {
    const values: Record<string, number> = {}
    for (const stage of LEAD_STAGES) {
      values[stage] = (leadsByStage[stage] || []).reduce(
        (sum: number, lead: unknown) => sum + (lead.loan_amount || 0),
        0
      )
    }
    return values
  }, [leadsByStage])

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, leadId: string, stage: string) => {
    setDraggingId(leadId)
    setDraggingFromStage(stage)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', leadId)
    // Set a small drag image offset for better UX
    if (e.dataTransfer.setDragImage) {
      const target = e.currentTarget as HTMLElement
      e.dataTransfer.setDragImage(target, 20, 20)
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDraggingFromStage(null)
    setDragTargetStage(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Determine target stage from the column element
    const column = (e.currentTarget as HTMLElement)
    const stage = column.getAttribute('data-stage')
    if (stage) {
      setDragTargetStage(stage)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if actually leaving the column (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragTargetStage(null)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    setDragTargetStage(null)

    const leadId = e.dataTransfer.getData('text/plain')
    if (!leadId || !draggingFromStage || draggingFromStage === targetStage) {
      setDraggingId(null)
      setDraggingFromStage(null)
      return
    }

    // Optimistic update
    setOptimisticLeads((prev) => {
      const next = new Map(prev)
      next.set(leadId, targetStage)
      return next
    })

    setDraggingId(null)
    setDraggingFromStage(null)

    try {
      await onStageChange(leadId, targetStage)
      // On success, clear the optimistic override (actual data will reflect the change)
      setOptimisticLeads((prev) => {
        const next = new Map(prev)
        next.delete(leadId)
        return next
      })
    } catch {
      // Revert optimistic update on failure
      setOptimisticLeads((prev) => {
        const next = new Map(prev)
        next.delete(leadId)
        return next
      })
    }
  }, [draggingFromStage, onStageChange])

  if (isLoading) {
    return <KanbanSkeleton />
  }

  return (
    <div className="relative">
      {/* Scrollable Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none">
        {LEAD_STAGES.map((stage) => (
          <div key={stage} data-stage={stage} className="snap-start">
            <KanbanColumn
              stage={stage}
              leads={leadsByStage[stage] || []}
              totalValue={stageValues[stage] || 0}
              onLeadClick={onLeadClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragTargetStage(stage)
              }}
              onDragLeave={(e) => {
                const relatedTarget = e.relatedTarget as HTMLElement | null
                if (!e.currentTarget.contains(relatedTarget)) {
                  setDragTargetStage(null)
                }
              }}
              isDragTarget={dragTargetStage === stage && draggingFromStage !== stage}
              draggingId={draggingId}
            />
          </div>
        ))}
      </div>

      {/* Scroll hint for mobile */}
      <div className="md:hidden absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
