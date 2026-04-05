'use client'

import React from 'react'
import { Check, X, Clock, ArrowRight, User } from 'lucide-react'

interface ApprovalStep {
  step_number: number
  approver_role: string
  approver_name?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'WAITING'
  action_date?: string
  remarks?: string
}

interface ApprovalChainProps {
  steps: ApprovalStep[]
  currentStep: number
  title?: string
  compact?: boolean
}

const statusConfig = {
  APPROVED: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', label: 'Approved' },
  REJECTED: { icon: X, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', label: 'Rejected' },
  PENDING: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', label: 'Pending' },
  SKIPPED: { icon: ArrowRight, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30', label: 'Skipped' },
  WAITING: { icon: Clock, color: 'text-gray-500', bg: 'bg-white/5', border: 'border-white/10', label: 'Waiting' },
}

export default function ApprovalChainViewer({ steps, currentStep, title, compact = false }: ApprovalChainProps) {
  if (steps.length === 0) return null

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const config = statusConfig[step.status]
          const Icon = config.icon
          return (
            <React.Fragment key={step.step_number}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.bg} ${config.border} border`} title={`${step.approver_role}: ${config.label}`}>
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-4 h-0.5 ${step.status === 'APPROVED' ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-white">{title}</h4>}
      <div className="relative">
        {steps.map((step, idx) => {
          const config = statusConfig[step.status]
          const Icon = config.icon
          const isActive = step.step_number === currentStep
          return (
            <div key={step.step_number} className="flex gap-3">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  isActive ? 'border-[#FF6700] bg-[#FF6700]/20' : `${config.border} ${config.bg}`
                } transition-all`}>
                  {isActive ? (
                    <div className="w-2 h-2 rounded-full bg-[#FF6700] animate-pulse" />
                  ) : (
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-0.5 h-12 ${step.status === 'APPROVED' ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-6 ${idx === steps.length - 1 ? 'pb-0' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isActive ? 'text-[#FF6700]' : 'text-white'}`}>
                    Step {step.step_number}: {step.approver_role}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                {step.approver_name && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <User className="w-3 h-3" />
                    {step.approver_name}
                  </div>
                )}
                {step.action_date && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(step.action_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {step.remarks && (
                  <p className="text-xs text-gray-400 mt-1 italic">&quot;{step.remarks}&quot;</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { ApprovalStep, ApprovalChainProps }
