'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building, Users, FileCheck, CheckCircle, ChevronRight, ChevronLeft, Loader2, AlertCircle, Save, MapPin, PieChart } from 'lucide-react'
import { toast } from 'sonner'
import CompanyDetailsStep from './steps/CompanyDetailsStep'
import DirectorsStepEnhanced from './steps/DirectorsStepEnhanced'
import ShareholdersStep from './steps/ShareholdersStep'
import AddressStep from './steps/AddressStep'
import DocumentsStep from './steps/DocumentsStep'
import ReviewStep from './steps/ReviewStep'
import { PrivateLimitedData, initialPrivateLimitedData, createEmptyDirector, createEmptyShareholder } from '../types/private-limited'

export interface PrivateLimitedWizardProps {
  onComplete: () => void
  onBack?: () => void
  initialData?: Partial<PrivateLimitedData>
  entityId?: string
  incomeProfileId?: string
  entityTypeId?: string
}

const STEPS = [
  { id: 1, title: 'Company Details', icon: Building, description: 'Company information' },
  { id: 2, title: 'Directors', icon: Users, description: 'Director details' },
  { id: 3, title: 'Shareholders', icon: PieChart, description: 'Shareholding pattern' },
  { id: 4, title: 'Address', icon: MapPin, description: 'Registered office' },
  { id: 5, title: 'Documents', icon: FileCheck, description: 'KYC documents' },
  { id: 6, title: 'Review', icon: CheckCircle, description: 'Submit profile' }
]

export default function PrivateLimitedWizard({ onComplete, onBack, initialData, entityId, incomeProfileId, entityTypeId }: PrivateLimitedWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<PrivateLimitedData>(() => {
    try {
      const initial = initialPrivateLimitedData()
      return {
        ...initial,
        ...initialData,
        directors: initialData?.directors ?? initial?.directors ?? [createEmptyDirector(), createEmptyDirector()],
        shareholders: initialData?.shareholders ?? initial?.shareholders ?? [createEmptyShareholder(), createEmptyShareholder()]
      }
    } catch (error) {
      console.error('Error initializing Private Limited data:', error)
      return {
        ...initialData,
        directors: initialData?.directors ?? [createEmptyDirector(), createEmptyDirector()],
        shareholders: initialData?.shareholders ?? [createEmptyShareholder(), createEmptyShareholder()]
      } as PrivateLimitedData
    }
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (entityId) fetchEntityData()
  }, [entityId])

  const fetchEntityData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/entities/${entityId}`, { credentials: 'include' })
      const data = await response.json()
      if (data.success && data.entity) setFormData(prev => ({ ...prev, ...data.entity }))
    } catch (err) {
      console.error('Error fetching entity:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = useCallback((updates: Partial<PrivateLimitedData>) => {
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
        if (!formData.company_name?.trim()) newErrors.company_name = 'Company name is required'
        if (!formData.cin?.trim()) newErrors.cin = 'CIN is required'
        if (!formData.date_of_incorporation) newErrors.date_of_incorporation = 'Date is required'
        if (!formData.company_pan?.trim()) newErrors.company_pan = 'Company PAN is required'
        if (!formData.roc_office) newErrors.roc_office = 'ROC office is required'
        break
      case 2:
        if (formData.directors.length < 2) newErrors.directors = 'Minimum 2 directors required'
        formData.directors.forEach((d, i) => {
          if (!d.full_name?.trim()) newErrors[`director_${i}_name`] = `Director ${i + 1}: Name required`
          if (!d.din?.trim()) newErrors[`director_${i}_din`] = `Director ${i + 1}: DIN required`
          if (!d.pan_number?.trim()) newErrors[`director_${i}_pan`] = `Director ${i + 1}: PAN required`
        })
        break
      case 3:
        if (formData.shareholders.length < 2) newErrors.shareholders = 'Minimum 2 shareholders required'
        break
      case 4:
        if (!formData.registered_address_line1?.trim()) newErrors.registered_address_line1 = 'Address required'
        if (!formData.registered_city?.trim()) newErrors.registered_city = 'City required'
        if (!formData.registered_state) newErrors.registered_state = 'State required'
        if (!formData.registered_pincode?.trim()) newErrors.registered_pincode = 'Pincode required'
        break
      case 5:
        if (!formData.certificate_of_incorporation_url) newErrors.certificate_of_incorporation_url = 'COI required'
        if (!formData.moa_url) newErrors.moa_url = 'MOA required'
        if (!formData.aoa_url) newErrors.aoa_url = 'AOA required'
        if (!formData.company_pan_url) newErrors.company_pan_url = 'Company PAN required'
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
        body: JSON.stringify({ id: entityId, entity_type: 'PRIVATE_LIMITED', income_profile_id: incomeProfileId, ...formData, verification_status: 'DRAFT' })
      })
      const data = await response.json()
      if (data.success) toast.success('Draft saved')
      else toast.error(data.error || 'Failed to save')
    } catch { toast.error('Failed to save draft') }
    finally { setSaving(false) }
  }

  const goNext = async () => {
    if (!validateStep(currentStep)) { toast.error('Please fill required fields'); return }
    if (currentStep < 6) { await saveDraft(); setCurrentStep(prev => prev + 1) }
  }

  const goPrevious = () => { if (currentStep > 1) setCurrentStep(prev => prev - 1) }
  const goToStep = (step: number) => { if (step < currentStep) setCurrentStep(step) }

  const handleSubmit = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/customers/entities', {
        method: entityId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entityId, entity_type: 'PRIVATE_LIMITED', income_profile_id: incomeProfileId, ...formData, profile_completed: true, verification_status: 'PENDING' })
      })
      const data = await response.json()
      if (data.success) {
        const newEntityId = data.data?.entity?.id

        // Auto-create member profiles for all directors
        if (newEntityId && formData.directors && formData.directors.length > 0) {
          toast.success('Company created! Creating member profiles...')

          let successCount = 0
          for (const director of formData.directors) {
            if (director.full_name && director.mobile && director.email && director.pan_number) {
              try {
                const memberResponse = await fetch('/api/customers/entity-members/create-profile', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    entity_id: newEntityId,
                    member_id: director.id || `director-${Date.now()}`,
                    member_data: {
                      name: director.full_name,
                      mobile: director.mobile,
                      email: director.email,
                      pan: director.pan_number,
                      aadhaar: director.aadhaar_number,
                      role: director.director_type,
                      designation: director.din,
                      shareholding_percentage: director.shareholding_percentage,
                      is_signatory: director.is_authorized_signatory || director.director_type === 'MANAGING_DIRECTOR',
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
            toast.success(`✓ Company submitted! ${successCount} member profile(s) created with login credentials sent.`)
          }
        } else {
          toast.success('Profile submitted!')
        }

        onComplete()
      } else {
        toast.error(data.error || 'Failed to submit')
      }
    } catch {
      toast.error('Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return <CompanyDetailsStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 2: return <DirectorsStepEnhanced data={formData} errors={errors} onUpdate={updateFormData} />
      case 3: return <ShareholdersStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 4: return <AddressStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 5: return <DocumentsStep data={formData} errors={errors} onUpdate={updateFormData} />
      case 6: return <ReviewStep data={formData} onEdit={goToStep} />
      default: return null
    }
  }

  if (loading) return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id
            const isClickable = step.id < currentStep
            return (
              <React.Fragment key={step.id}>
                <button onClick={() => isClickable && goToStep(step.id)} disabled={!isClickable}
                  className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isActive ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' : isCompleted ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                  } ${isClickable ? 'group-hover:ring-2 group-hover:ring-orange-500/50' : ''}`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" /> : <Icon className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium text-center ${isActive ? 'text-white' : 'text-gray-400'}`}>{step.title}</span>
                </button>
                {index < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-1 sm:mx-2"><div className={`h-full transition-all ${currentStep > step.id ? 'bg-orange-500' : 'bg-gray-700'}`} /></div>}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4 sm:p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {Object.keys(errors).length > 0 && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium mb-1">Please fix errors:</p>
                <ul className="text-sm text-red-300 space-y-1">
                  {Object.values(errors).slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {Object.values(errors).length > 5 && <li>...and {Object.values(errors).length - 5} more</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {currentStep === 1 && onBack && <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-4 h-4" /> Back</button>}
            {currentStep > 1 && <button onClick={goPrevious} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-4 h-4" /> Previous</button>}
            <button onClick={saveDraft} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
            </button>
          </div>
          {currentStep < 6 ? (
            <button onClick={goNext} disabled={saving} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Submit Profile</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
