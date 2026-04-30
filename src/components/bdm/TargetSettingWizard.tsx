'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft, Check, Users, Target, Calendar, Send } from 'lucide-react'

interface TargetSettingWizardProps {
  onComplete?: () => void
  onCancel?: () => void
}

type WizardStep = 'select-bdes' | 'choose-template' | 'set-values' | 'review'

export function TargetSettingWizard({ onComplete, onCancel }: TargetSettingWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('select-bdes')
  const [selectedBdeIds, setSelectedBdeIds] = useState<string[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [targetValues, setTargetValues] = useState({
    leads_target: 100,
    conversions_target: 10,
    revenue_target: 500000,
    calls_target: 200,
    meetings_target: 15,
  })
  const [targetMonth, setTargetMonth] = useState(new Date().toISOString().slice(0, 7))

  // Fetch BDEs under this BDM
  const { data: bdesData, isLoading: loadingBdes } = useQuery({
    queryKey: ['team-bdes'],
    queryFn: async () => {
      const res = await fetch('/api/bdm/team-pipeline/bde-performance')
      if (!res.ok) throw new Error('Failed to fetch BDEs')
      return res.json()
    },
  })

  // Fetch templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['target-templates'],
    queryFn: async () => {
      const res = await fetch('/api/bdm/team-targets/templates?isActive=true')
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json()
    },
  })

  // Mutation to set targets in bulk
  const setTargetsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/bdm/team-targets/targets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bdeUserIds: selectedBdeIds,
          templateId: selectedTemplateId,
          month: targetMonth,
          ...targetValues,
        }),
      })
      if (!res.ok) throw new Error('Failed to set targets')
      return res.json()
    },
    onSuccess: () => {
      onComplete?.()
    },
  })

  const bdes = bdesData?.data?.bdes || []
  const templates = templatesData?.data?.templates || []
  const selectedTemplate = templates.find((t: unknown) => t.id === selectedTemplateId)

  const steps = [
    { id: 'select-bdes', label: 'Select BDEs', icon: Users },
    { id: 'choose-template', label: 'Choose Template', icon: Target },
    { id: 'set-values', label: 'Set Values', icon: Calendar },
    { id: 'review', label: 'Review & Publish', icon: Check },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const canGoNext = () => {
    if (currentStep === 'select-bdes') return selectedBdeIds.length > 0
    if (currentStep === 'choose-template') return selectedTemplateId !== null
    if (currentStep === 'set-values') return true
    return false
  }

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id as WizardStep)
    }
  }

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id as WizardStep)
    }
  }

  const handlePublish = () => {
    setTargetsMutation.mutate()
  }

  const toggleBde = (bdeId: string) => {
    setSelectedBdeIds(prev =>
      prev.includes(bdeId) ? prev.filter(id => id !== bdeId) : [...prev, bdeId]
    )
  }

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find((t: unknown) => t.id === templateId)
    if (template) {
      setTargetValues({
        leads_target: template.leads_target || 100,
        conversions_target: template.conversions_target || 10,
        revenue_target: template.revenue_target || 500000,
        calls_target: template.calls_target || 200,
        meetings_target: template.meetings_target || 15,
      })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 min-h-[400px]">
        {/* Step 1: Select BDEs */}
        {currentStep === 'select-bdes' && (
          <div>
            <h3 className="text-xl font-bold mb-4">Select Team Members</h3>
            <p className="text-gray-600 mb-6">Choose the BDEs you want to set targets for</p>
            {loadingBdes ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {bdes.map((bde: unknown) => (
                  <div
                    key={bde.id}
                    onClick={() => toggleBde(bde.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedBdeIds.includes(bde.id)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedBdeIds.includes(bde.id)}
                          onChange={() => {}}
                          className="w-4 h-4"
                        />
                        <div>
                          <p className="font-medium">{bde.full_name}</p>
                          <p className="text-sm text-gray-600">{bde.email}</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        MTD: {bde.mtd_conversions || 0} conversions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4">
              {selectedBdeIds.length} BDE{selectedBdeIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Step 2: Choose Template */}
        {currentStep === 'choose-template' && (
          <div>
            <h3 className="text-xl font-bold mb-4">Choose a Template</h3>
            <p className="text-gray-600 mb-6">Select a pre-configured template or start from scratch</p>
            {loadingTemplates ? (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {templates.map((template: unknown) => (
                  <div
                    key={template.id}
                    onClick={() => selectTemplate(template.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplateId === template.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h4 className="font-semibold mb-2">{template.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Leads:</span>
                        <span className="font-medium">{template.leads_target}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Conversions:</span>
                        <span className="font-medium">{template.conversions_target}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Revenue:</span>
                        <span className="font-medium">₹{(template.revenue_target / 100000).toFixed(1)}L</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Set Values */}
        {currentStep === 'set-values' && (
          <div>
            <h3 className="text-xl font-bold mb-4">Set Target Values</h3>
            <p className="text-gray-600 mb-6">Customize the targets for this month</p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Month</label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leads Target</label>
                <input
                  type="number"
                  value={targetValues.leads_target}
                  onChange={(e) => setTargetValues({ ...targetValues, leads_target: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conversions Target</label>
                <input
                  type="number"
                  value={targetValues.conversions_target}
                  onChange={(e) => setTargetValues({ ...targetValues, conversions_target: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Target (₹)</label>
                <input
                  type="number"
                  value={targetValues.revenue_target}
                  onChange={(e) => setTargetValues({ ...targetValues, revenue_target: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calls Target</label>
                <input
                  type="number"
                  value={targetValues.calls_target}
                  onChange={(e) => setTargetValues({ ...targetValues, calls_target: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meetings Target</label>
                <input
                  type="number"
                  value={targetValues.meetings_target}
                  onChange={(e) => setTargetValues({ ...targetValues, meetings_target: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 'review' && (
          <div>
            <h3 className="text-xl font-bold mb-4">Review & Publish</h3>
            <p className="text-gray-600 mb-6">Review the targets before publishing</p>
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Selected BDEs ({selectedBdeIds.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedBdeIds.map(id => {
                    const bde = bdes.find((b: unknown) => b.id === id)
                    return (
                      <span key={id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {bde?.full_name || 'BDE'}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Template</h4>
                <p className="text-gray-700">{selectedTemplate?.name || 'Custom'}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Target Values</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Month:</span>
                    <p className="font-medium">{new Date(targetMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Leads:</span>
                    <p className="font-medium">{targetValues.leads_target}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Conversions:</span>
                    <p className="font-medium">{targetValues.conversions_target}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Revenue:</span>
                    <p className="font-medium">₹{(targetValues.revenue_target / 100000).toFixed(1)}L</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Calls:</span>
                    <p className="font-medium">{targetValues.calls_target}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Meetings:</span>
                    <p className="font-medium">{targetValues.meetings_target}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Navigation */}
      <div className="border-t p-6 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          {currentStepIndex > 0 && (
            <button
              onClick={handlePrevious}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
          )}
          {currentStep !== 'review' ? (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={setTargetsMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {setTargetsMutation.isPending ? 'Publishing...' : 'Publish Targets'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
