'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Building2,
  Users,
  FileCheck,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Save,
  MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import LLPDetailsStep from './steps/LLPDetailsStep'
import PartnersStepEnhanced from './steps/PartnersStepEnhanced'
import AddressStep from './steps/AddressStep'
import DocumentsStep from './steps/DocumentsStep'
import ReviewStep from './steps/ReviewStep'
import { LLPData, initialLLPData, createEmptyLLPPartner } from '../types/llp'

export interface LLPWizardProps {
  onComplete: () => void
  onBack?: () => void
  initialData?: Partial<LLPData>
  entityId?: string
  incomeProfileId?: string
  entityTypeId?: string
}

const STEPS = [
  { id: 1, title: 'LLP Details', icon: Scale, description: 'LLP information' },
  { id: 2, title: 'Partners', icon: Users, description: 'Partner details' },
  { id: 3, title: 'Address', icon: MapPin, description: 'Registered office' },
  { id: 4, title: 'Documents', icon: FileCheck, description: 'KYC documents' },
  { id: 5, title: 'Review', icon: CheckCircle, description: 'Submit profile' }
]

export default function LLPWizard({
  onComplete,
  onBack,
  initialData,
  entityId,
  incomeProfileId,
  entityTypeId
}: LLPWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<LLPData>(() => {
    try {
      const initial = initialLLPData()
      return {
        ...initial,
        ...initialData,
        partners: initialData?.partners ?? initial?.partners ?? [createEmptyLLPPartner(), createEmptyLLPPartner()]
      }
    } catch (error) {
      console.error('Error initializing LLP data:', error)
      return {
        ...initialData,
        partners: initialData?.partners ?? [createEmptyLLPPartner(), createEmptyLLPPartner()]
      } as LLPData
    }
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (entityId) {
      fetchEntityData()
    }
  }, [entityId])

  const fetchEntityData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/entities/${entityId}`, { credentials: 'include' })
      const data = await response.json()
      if (data.success && data.entity) {
        setFormData(prev => ({ ...prev, ...data.entity }))
      }
    } catch (err) {
      console.error('Error fetching entity:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = useCallback((updates: Partial<LLPData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    const clearedErrors = { ...errors }
    Object.keys(updates).forEach(key => delete clearedErrors[key])
    setErrors(clearedErrors)
  }, [errors])

  // TODO: Re-enable validation after dev is complete
  const validateStep = (_step: number): boolean => {
    return true // Temporarily bypass all validation during development
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1:
        if (!formData.llp_name?.trim()) newErrors.llp_name = 'LLP name is required'
        if (!formData.llpin?.trim()) newErrors.llpin = 'LLPIN is required'
        if (!formData.date_of_incorporation) newErrors.date_of_incorporation = 'Date of incorporation is required'
        if (!formData.llp_pan?.trim()) newErrors.llp_pan = 'LLP PAN is required'
        else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.llp_pan)) newErrors.llp_pan = 'Invalid PAN format'
        if (!formData.roc_office) newErrors.roc_office = 'ROC office is required'
        if (formData.gst_registration_status === 'REGISTERED' && !formData.gstin?.trim()) {
          newErrors.gstin = 'GSTIN is required'
        }
        break

      case 2:
        const designatedPartners = formData.partners.filter(p => p.partner_type === 'DESIGNATED_PARTNER')
        if (designatedPartners.length < 2) {
          newErrors.partners = 'Minimum 2 Designated Partners are required'
        }
        formData.partners.forEach((partner, index) => {
          if (!partner.full_name?.trim()) newErrors[`partner_${index}_name`] = `Partner ${index + 1}: Name is required`
          if (!partner.pan_number?.trim()) newErrors[`partner_${index}_pan`] = `Partner ${index + 1}: PAN is required`
          if (partner.partner_type === 'DESIGNATED_PARTNER' && !partner.dpin_din?.trim()) {
            newErrors[`partner_${index}_dpin`] = `Partner ${index + 1}: DPIN/DIN is required`
          }
        })
        break

      case 3:
        if (!formData.registered_address_line1?.trim()) newErrors.registered_address_line1 = 'Address is required'
        if (!formData.registered_city?.trim()) newErrors.registered_city = 'City is required'
        if (!formData.registered_state) newErrors.registered_state = 'State is required'
        if (!formData.registered_pincode?.trim()) newErrors.registered_pincode = 'Pincode is required'
        break

      case 4:
        if (!formData.llp_agreement_url) newErrors.llp_agreement_url = 'LLP Agreement is required'
        if (!formData.certificate_of_incorporation_url) newErrors.certificate_of_incorporation_url = 'COI is required'
        if (!formData.llp_pan_url) newErrors.llp_pan_url = 'LLP PAN card is required'
        if (!formData.bank_statement_url) newErrors.bank_statement_url = 'Bank statement is required'
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const saveDraft = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/customers/entities', {
        method: entityId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entityId,
          entity_type: 'LLP',
          income_profile_id: incomeProfileId,
          ...formData,
          verification_status: 'DRAFT'
        })
      })
      const data = await response.json()
      if (data.success) toast.success('Draft saved successfully')
      else toast.error(data.error || 'Failed to save draft')
    } catch (err) {
      toast.error('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const goNext = async () => {
    if (!validateStep(currentStep)) {
      toast.error('Please fill in all required fields')
      return
    }
    if (currentStep < 5) {
      await saveDraft()
      setCurrentStep(prev => prev + 1)
    }
  }

  const goPrevious = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1)
  }

  const goToStep = (step: number) => {
    if (step < currentStep) setCurrentStep(step)
  }

  const handleSubmit = async () => {
    if (!validateStep(5)) return
    try {
      setSaving(true)
      const response = await fetch('/api/customers/entities', {
        method: entityId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entityId,
          entity_type: 'LLP',
          income_profile_id: incomeProfileId,
          ...formData,
          profile_completed: true,
          verification_status: 'PENDING'
        })
      })
      const data = await response.json()
      if (data.success) {
        const newEntityId = data.data?.entity?.id

        // Auto-create member profiles for all partners
        if (newEntityId && formData.partners && formData.partners.length > 0) {
          toast.success('LLP created! Creating member profiles...')

          let successCount = 0
          for (const partner of formData.partners) {
            if (partner.full_name && partner.mobile && partner.email && partner.pan_number) {
              try {
                const memberResponse = await fetch('/api/customers/entity-members/create-profile', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    entity_id: newEntityId,
                    member_id: partner.id || `partner-${Date.now()}`,
                    member_data: {
                      name: partner.full_name,
                      mobile: partner.mobile,
                      email: partner.email,
                      pan: partner.pan_number,
                      aadhaar: partner.aadhaar_number,
                      role: partner.partner_type,
                      designation: partner.dpin_din,
                      shareholding_percentage: partner.profit_sharing_percent,
                      is_signatory: partner.is_authorized_signatory || partner.partner_type === 'DESIGNATED_PARTNER',
                      can_apply_loan: true
                    },
                    send_credentials: true
                  })
                })

                const memberData = await memberResponse.json()
                if (memberData.success) successCount++
              } catch (memberErr) {
                console.error('Error creating member profile:', memberErr)
              }
            }
          }

          if (successCount > 0) {
            toast.success(`✓ LLP submitted! ${successCount} member profile(s) created with login credentials sent.`)
          }
        } else {
          toast.success('LLP profile submitted successfully!')
        }

        onComplete()
      } else {
        toast.error(data.error || 'Failed to submit profile')
      }
    } catch (err) {
      toast.error('Failed to submit profile')
    } finally {
      setSaving(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return <LLPDetailsStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 2: return <PartnersStepEnhanced data={formData} errors={errors} onUpdate={updateFormData} />
      case 3: return <AddressStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 4: return <DocumentsStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 5: return <ReviewStep data={formData} onEdit={goToStep} />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading entity data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id
            const isClickable = step.id < currentStep

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isActive ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' :
                    isCompleted ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                  } ${isClickable ? 'group-hover:ring-2 group-hover:ring-orange-500/50' : ''}`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" /> : <Icon className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium text-center ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                  <span className="text-xs text-gray-500 hidden md:block">{step.description}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 sm:mx-2">
                    <div className={`h-full transition-all ${currentStep > step.id ? 'bg-orange-500' : 'bg-gray-700'}`} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 sm:p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {Object.keys(errors).length > 0 && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium mb-1">Please fix the following errors:</p>
                <ul className="text-sm text-red-300 space-y-1">
                  {Object.values(errors).slice(0, 5).map((error, i) => <li key={i}>{error}</li>)}
                  {Object.values(errors).length > 5 && <li>...and {Object.values(errors).length - 5} more</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {currentStep === 1 && onBack && (
              <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {currentStep > 1 && (
              <button onClick={goPrevious} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
            )}
            <button onClick={saveDraft} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
            </button>
          </div>

          {currentStep < 5 ? (
            <button onClick={goNext} disabled={saving} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Submit Profile</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
