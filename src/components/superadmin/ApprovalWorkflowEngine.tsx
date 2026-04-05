'use client'

/**
 * E30: Configurable Multi-Level Approval Workflow Engine
 * Allows SuperAdmin to define approval chains for different operations
 */

import { useState } from 'react'
import { Plus, Trash2, GripVertical, CheckCircle, Clock, Users, Shield, ArrowRight } from 'lucide-react'

interface ApprovalStep {
  id: string
  name: string
  approverRole: string
  approverCount: number
  autoApproveAfterHours?: number
  escalateAfterHours?: number
  escalateTo?: string
}

interface WorkflowConfig {
  id: string
  name: string
  description: string
  triggerType: string
  steps: ApprovalStep[]
  isActive: boolean
}

const DEFAULT_WORKFLOWS: WorkflowConfig[] = [
  {
    id: 'payout_approval',
    name: 'Payout Approval',
    description: 'Multi-level approval for partner payouts',
    triggerType: 'PAYOUT_CREATED',
    steps: [
      { id: '1', name: 'Finance Review', approverRole: 'FINANCE_MANAGER', approverCount: 1, escalateAfterHours: 24, escalateTo: 'SUPER_ADMIN' },
      { id: '2', name: 'Super Admin Approval', approverRole: 'SUPER_ADMIN', approverCount: 1 },
    ],
    isActive: true,
  },
  {
    id: 'partner_onboarding',
    name: 'Partner Onboarding',
    description: 'Approval workflow for new partner registrations',
    triggerType: 'PARTNER_REGISTERED',
    steps: [
      { id: '1', name: 'Document Verification', approverRole: 'HR', approverCount: 1, escalateAfterHours: 48 },
      { id: '2', name: 'Manager Approval', approverRole: 'ADMIN', approverCount: 1 },
    ],
    isActive: true,
  },
  {
    id: 'loan_sanctioning',
    name: 'Loan Sanctioning',
    description: 'Approval for loan sanction decisions',
    triggerType: 'LOAN_READY_FOR_SANCTION',
    steps: [
      { id: '1', name: 'Credit Analysis', approverRole: 'CREDIT_MANAGER', approverCount: 1, autoApproveAfterHours: 72 },
      { id: '2', name: 'Risk Assessment', approverRole: 'RISK_OFFICER', approverCount: 1 },
      { id: '3', name: 'Final Approval', approverRole: 'SUPER_ADMIN', approverCount: 1 },
    ],
    isActive: false,
  },
]

export function ApprovalWorkflowEngine() {
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>(DEFAULT_WORKFLOWS)
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null)

  const toggleWorkflow = (id: string) => {
    setWorkflows(prev =>
      prev.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w)
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white font-poppins">Approval Workflows</h3>
          <p className="text-sm text-gray-400 mt-1">Configure multi-level approval chains for business operations</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      <div className="space-y-4">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Workflow Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${workflow.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                <div>
                  <h4 className="text-sm font-medium text-white">{workflow.name}</h4>
                  <p className="text-xs text-gray-500">{workflow.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">{workflow.triggerType}</span>
                <button
                  onClick={() => toggleWorkflow(workflow.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    workflow.isActive ? 'bg-orange-600' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    workflow.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Approval Steps */}
            <div className="p-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                {workflow.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 shrink-0">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 min-w-[180px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400">
                          {i + 1}
                        </div>
                        <p className="text-sm font-medium text-white">{step.name}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Shield className="w-3 h-3" />
                          {step.approverRole.replace(/_/g, ' ')}
                        </div>
                        {step.escalateAfterHours && (
                          <div className="flex items-center gap-1 text-xs text-yellow-400">
                            <Clock className="w-3 h-3" />
                            Escalate after {step.escalateAfterHours}h
                          </div>
                        )}
                        {step.autoApproveAfterHours && (
                          <div className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Auto-approve after {step.autoApproveAfterHours}h
                          </div>
                        )}
                      </div>
                    </div>
                    {i < workflow.steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
