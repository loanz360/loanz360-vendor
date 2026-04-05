'use client'

import { useState, useCallback } from 'react'
import { GripVertical, Phone, MessageSquare, Clock, IndianRupee } from 'lucide-react'
import { formatINR, formatTimeAgo } from '@/lib/utils/cro-helpers'
import { LEAD_STAGE_LABELS, formatWhatsAppLink } from '@/lib/constants/sales-pipeline'

interface KanbanLead {
  id: string
  customer_name: string
  phone: string
  loan_type?: string
  loan_amount?: number
  lead_score?: number
  stage: string
  status: string
  created_at: string
  updated_at?: string
}

interface KanbanPipelineProps {
  leads: KanbanLead[]
  onStageChange: (leadId: string, newStage: string, oldStage: string) => Promise<void>
  onLeadClick: (leadId: string) => void
}

const STAGES = ['new', 'contacted', 'qualified', 'docs_pending', 'ready_to_convert'] as const

const STAGE_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#06b6d4',
  qualified: '#8b5cf6',
  docs_pending: '#f59e0b',
  ready_to_convert: '#22c55e',
}

export default function KanbanPipeline({ leads, onStageChange, onLeadClick }: KanbanPipelineProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [updatingLead, setUpdatingLead] = useState<string | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', leadId)
    // Add drag styling
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedLead(null)
    setDragOverStage(null)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stage)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    setDragOverStage(null)
    const leadId = e.dataTransfer.getData('text/plain')
    if (!leadId) return

    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    setUpdatingLead(leadId)
    try {
      await onStageChange(leadId, newStage, lead.stage)
    } catch {
      // Error handling is done by parent
    } finally {
      setUpdatingLead(null)
    }
  }, [leads, onStageChange])

  // Group leads by stage
  const groupedLeads: Record<string, KanbanLead[]> = {}
  for (const stage of STAGES) {
    groupedLeads[stage] = leads.filter(l => l.stage === stage)
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[1000px]">
        {STAGES.map(stage => (
          <div
            key={stage}
            className={`flex-1 min-w-[220px] bg-[#111] rounded-xl border transition-colors ${
              dragOverStage === stage
                ? 'border-orange-500 bg-orange-500/5'
                : 'border-gray-800'
            }`}
            onDragOver={(e) => handleDragOver(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: STAGE_COLORS[stage] }}
                />
                <h3 className="text-sm font-semibold text-white">
                  {LEAD_STAGE_LABELS[stage] || stage}
                </h3>
              </div>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {groupedLeads[stage].length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {groupedLeads[stage].length === 0 && (
                <div className="text-center py-8 text-gray-600 text-xs">
                  {dragOverStage === stage ? 'Drop here' : 'No leads'}
                </div>
              )}
              {groupedLeads[stage].map(lead => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onLeadClick(lead.id)}
                  className={`relative bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-all group ${
                    updatingLead === lead.id ? 'opacity-50 pointer-events-none' : ''
                  } ${draggedLead === lead.id ? 'ring-2 ring-orange-500' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="h-3 w-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-sm font-medium text-white truncate max-w-[140px]">
                        {lead.customer_name}
                      </span>
                    </div>
                    {lead.lead_score != null && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        lead.lead_score >= 70 ? 'bg-green-500/20 text-green-400' :
                        lead.lead_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {lead.lead_score}
                      </span>
                    )}
                  </div>

                  {lead.loan_type && (
                    <p className="text-xs text-gray-400 mb-1">{lead.loan_type}</p>
                  )}

                  {lead.loan_amount != null && lead.loan_amount > 0 && (
                    <p className="text-xs text-orange-400 font-medium flex items-center gap-1 mb-2">
                      <IndianRupee className="h-3 w-3" />
                      {formatINR(lead.loan_amount)}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTimeAgo(lead.updated_at || lead.created_at)}
                    </span>
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        aria-label="Call lead"
                      >
                        <Phone className="h-3 w-3 text-gray-400" />
                      </a>
                      <a
                        href={formatWhatsAppLink(lead.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1 rounded hover:bg-green-500/20 transition-colors"
                        aria-label="WhatsApp lead"
                      >
                        <MessageSquare className="h-3 w-3 text-green-400" />
                      </a>
                    </div>
                  </div>

                  {updatingLead === lead.id && (
                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
