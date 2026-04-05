'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  User,
  FileCheck,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Save
} from 'lucide-react'
import { toast } from 'sonner'
import BusinessDetailsStep from './steps/BusinessDetailsStep'
import OwnerAddressStep from './steps/OwnerAddressStep'
import DocumentsKYCStep from './steps/DocumentsKYCStep'
import ReviewSubmitStep from './steps/ReviewSubmitStep'
import {
  SoleProprietorshipData,
  initialSoleProprietorshipData
} from './types'

export interface SoleProprietorshipWizardProps {
  onComplete: () => void
  onBack?: () => void
  initialData?: Partial<SoleProprietorshipData>
  entityId?: string
  incomeProfileId?: string
  entityTypeId?: string
}

// Step configuration
const STEPS = [
  { id: 1, title: 'Business Details', icon: Building2, description: 'Entity information' },
  { id: 2, title: 'Owner & Address', icon: User, description: 'Proprietor details' },
  { id: 3, title: 'Documents', icon: FileCheck, description: 'KYC documents' },
  { id: 4, title: 'Review', icon: CheckCircle, description: 'Submit profile' }
]

export default function SoleProprietorshipWizard({
  onComplete,
  onBack,
  initialData,
  entityId,
  incomeProfileId,
  entityTypeId
}: SoleProprietorshipWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<SoleProprietorshipData>({
    ...initialSoleProprietorshipData,
    ...initialData
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch existing entity data if entityId is provided
  useEffect(() => {
    if (entityId) {
      fetchEntityData()
    }
  }, [entityId])

  const fetchEntityData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/entities/${entityId}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.entity) {
        setFormData(prev => ({
          ...prev,
          ...data.entity
        }))
      }
    } catch (err) {
      console.error('Error fetching entity:', err)
    } finally {
      setLoading(false)
    }
  }

  // Update form data
  const updateFormData = useCallback((updates: Partial<SoleProprietorshipData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    // Clear errors for updated fields
    const clearedErrors = { ...errors }
    Object.keys(updates).forEach(key => {
      delete clearedErrors[key]
    })
    setErrors(clearedErrors)
  }, [errors])

  // Validate step
  // TODO: Re-enable validation after dev is complete
  const validateStep = (_step: number): boolean => {
    return true // Temporarily bypass all validation during development
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1: // Business Details
        if (!formData.business_name?.trim()) {
          newErrors.business_name = 'Business name is required'
        }
        if (!formData.nature_of_business) {
          newErrors.nature_of_business = 'Nature of business is required'
        }
        if (!formData.business_category) {
          newErrors.business_category = 'Business category is required'
        }
        if (!formData.year_of_establishment) {
          newErrors.year_of_establishment = 'Year of establishment is required'
        }
        if (!formData.gst_registration_status) {
          newErrors.gst_registration_status = 'GST status is required'
        }
        if (formData.gst_registration_status === 'REGISTERED' && !formData.gstin?.trim()) {
          newErrors.gstin = 'GSTIN is required for registered businesses'
        }
        if (formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin)) {
          newErrors.gstin = 'Invalid GSTIN format'
        }
        break

      case 2: // Owner & Address
        if (!formData.proprietor_name?.trim()) {
          newErrors.proprietor_name = 'Proprietor name is required'
        }
        if (!formData.proprietor_dob) {
          newErrors.proprietor_dob = 'Date of birth is required'
        }
        if (!formData.proprietor_gender) {
          newErrors.proprietor_gender = 'Gender is required'
        }
        if (!formData.proprietor_father_name?.trim()) {
          newErrors.proprietor_father_name = "Father's name is required"
        }
        if (!formData.proprietor_pan?.trim()) {
          newErrors.proprietor_pan = 'PAN number is required'
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.proprietor_pan)) {
          newErrors.proprietor_pan = 'Invalid PAN format'
        }
        if (!formData.proprietor_aadhaar?.trim()) {
          newErrors.proprietor_aadhaar = 'Aadhaar number is required'
        } else if (!/^[0-9]{12}$/.test(formData.proprietor_aadhaar.replace(/\s/g, ''))) {
          newErrors.proprietor_aadhaar = 'Invalid Aadhaar format (12 digits)'
        }
        if (!formData.proprietor_mobile?.trim()) {
          newErrors.proprietor_mobile = 'Mobile number is required'
        } else if (!/^[0-9]{10}$/.test(formData.proprietor_mobile)) {
          newErrors.proprietor_mobile = 'Invalid mobile number (10 digits)'
        }
        if (!formData.proprietor_email?.trim()) {
          newErrors.proprietor_email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.proprietor_email)) {
          newErrors.proprietor_email = 'Invalid email format'
        }

        // Residential address
        if (!formData.residential_address_line1?.trim()) {
          newErrors.residential_address_line1 = 'Address line 1 is required'
        }
        if (!formData.residential_city?.trim()) {
          newErrors.residential_city = 'City is required'
        }
        if (!formData.residential_state) {
          newErrors.residential_state = 'State is required'
        }
        if (!formData.residential_pincode?.trim()) {
          newErrors.residential_pincode = 'Pincode is required'
        } else if (!/^[0-9]{6}$/.test(formData.residential_pincode)) {
          newErrors.residential_pincode = 'Invalid pincode (6 digits)'
        }

        // Business address
        if (!formData.business_address_line1?.trim()) {
          newErrors.business_address_line1 = 'Business address is required'
        }
        if (!formData.business_city?.trim()) {
          newErrors.business_city = 'Business city is required'
        }
        if (!formData.business_state) {
          newErrors.business_state = 'Business state is required'
        }
        if (!formData.business_pincode?.trim()) {
          newErrors.business_pincode = 'Business pincode is required'
        } else if (!/^[0-9]{6}$/.test(formData.business_pincode)) {
          newErrors.business_pincode = 'Invalid pincode (6 digits)'
        }
        break

      case 3: // Documents
        if (!formData.pan_document_url) {
          newErrors.pan_document_url = 'PAN card is required'
        }
        if (!formData.aadhaar_front_url) {
          newErrors.aadhaar_front_url = 'Aadhaar front is required'
        }
        if (!formData.aadhaar_back_url) {
          newErrors.aadhaar_back_url = 'Aadhaar back is required'
        }
        if (!formData.passport_photo_url) {
          newErrors.passport_photo_url = 'Passport photo is required'
        }
        if (!formData.bank_statement_url) {
          newErrors.bank_statement_url = 'Bank statement is required'
        }
        if (!formData.business_address_proof_document_url) {
          newErrors.business_address_proof_document_url = 'Business address proof is required'
        }
        break

      case 4: // Review - no validation
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save draft
  const saveDraft = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/customers/entities', {
        method: entityId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entityId,
          entity_type: 'SOLE_PROPRIETORSHIP',
          income_profile_id: incomeProfileId,
          ...formData,
          verification_status: 'DRAFT'
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Draft saved successfully')
      } else {
        toast.error(data.error || 'Failed to save draft')
      }
    } catch (err) {
      console.error('Error saving draft:', err)
      toast.error('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  // Navigate to next step
  const goNext = async () => {
    if (!validateStep(currentStep)) {
      toast.error('Please fill in all required fields')
      return
    }

    if (currentStep < 4) {
      await saveDraft()
      setCurrentStep(prev => prev + 1)
    }
  }

  // Navigate to previous step
  const goPrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  // Go to specific step
  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step)
    }
  }

  // Submit form
  const handleSubmit = async () => {
    if (!validateStep(4)) return

    try {
      setSaving(true)
      const response = await fetch('/api/customers/entities', {
        method: entityId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entityId,
          entity_type: 'SOLE_PROPRIETORSHIP',
          income_profile_id: incomeProfileId,
          ...formData,
          profile_completed: true,
          verification_status: 'PENDING'
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Sole Proprietorship profile submitted successfully!')
        onComplete()
      } else {
        toast.error(data.error || 'Failed to submit profile')
      }
    } catch (err) {
      console.error('Error submitting:', err)
      toast.error('Failed to submit profile')
    } finally {
      setSaving(false)
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <BusinessDetailsStep
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 2:
        return (
          <OwnerAddressStep
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 3:
        return (
          <DocumentsKYCStep
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 4:
        return (
          <ReviewSubmitStep
            data={formData}
            onEdit={goToStep}
          />
        )
      default:
        return null
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
                {/* Step */}
                <button
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white ring-4 ring-orange-500/30'
                        : isCompleted
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-400'
                    } ${isClickable ? 'group-hover:ring-2 group-hover:ring-orange-500/50' : ''}`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                  <span className="text-xs text-gray-500 hidden sm:block">{step.description}</span>
                </button>

                {/* Connector */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 sm:mx-4">
                    <div
                      className={`h-full transition-all ${
                        currentStep > step.id ? 'bg-orange-500' : 'bg-gray-700'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 sm:p-8">
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

        {/* Error Summary */}
        {Object.keys(errors).length > 0 && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium mb-1">Please fix the following errors:</p>
                <ul className="text-sm text-red-300 space-y-1">
                  {Object.values(errors).slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {Object.values(errors).length > 5 && (
                    <li>...and {Object.values(errors).length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {currentStep === 1 && onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Entity Selection
              </button>
            )}
            {currentStep > 1 && (
              <button
                onClick={goPrevious}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            <button
              onClick={saveDraft}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </button>
          </div>

          {currentStep < 4 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Submit Profile
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
