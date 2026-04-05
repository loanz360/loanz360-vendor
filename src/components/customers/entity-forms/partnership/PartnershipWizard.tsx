'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Building2,
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
import FirmDetailsStep from './steps/FirmDetailsStep'
import PartnersStepEnhanced from './steps/PartnersStepEnhanced'
import ProfileSpecificBusinessStep from '../steps/ProfileSpecificBusinessStep'
import AddressStep from './steps/AddressStep'
import DocumentsStep from './steps/DocumentsStep'
import ReviewStep from './steps/ReviewStep'
import {
  PartnershipData,
  initialPartnershipData,
  createEmptyPartner
} from '../types/partnership'

export interface PartnershipWizardProps {
  onComplete: () => void
  onBack?: () => void
  initialData?: Partial<PartnershipData>
  entityId?: string
  incomeProfileId?: string
  entityTypeId?: string
}

// Step configuration
const STEPS = [
  { id: 1, title: 'Firm Details', icon: Building2, description: 'Partnership firm info' },
  { id: 2, title: 'Partners', icon: Users, description: 'Partner details' },
  { id: 3, title: 'Business Fields', icon: Building2, description: 'Profile-specific details' },
  { id: 4, title: 'Address', icon: MapPin, description: 'Office addresses' },
  { id: 5, title: 'Documents', icon: FileCheck, description: 'KYC documents' },
  { id: 6, title: 'Review', icon: CheckCircle, description: 'Submit profile' }
]

export default function PartnershipWizard({
  onComplete,
  onBack,
  initialData,
  entityId,
  incomeProfileId,
  entityTypeId
}: PartnershipWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<PartnershipData>(() => {
    try {
      const initial = initialPartnershipData()
      return {
        ...initial,
        ...initialData,
        // Ensure partners array is always defined
        partners: initialData?.partners ?? initial?.partners ?? [createEmptyPartner(), createEmptyPartner()]
      }
    } catch (error) {
      console.error('Error initializing partnership data:', error)
      // Return minimal safe default
      return {
        ...initialData,
        partners: initialData?.partners ?? [createEmptyPartner(), createEmptyPartner()]
      } as PartnershipData
    }
  })
  const [profileFieldsData, setProfileFieldsData] = useState<Record<string, string | number>>({})
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
  const updateFormData = useCallback((updates: Partial<PartnershipData>) => {
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
      case 1: // Firm Details
        if (!formData.firm_name?.trim()) {
          newErrors.firm_name = 'Firm name is required'
        }
        if (!formData.nature_of_business) {
          newErrors.nature_of_business = 'Nature of business is required'
        }
        if (!formData.date_of_formation) {
          newErrors.date_of_formation = 'Date of formation is required'
        }
        if (!formData.partnership_deed_number?.trim()) {
          newErrors.partnership_deed_number = 'Partnership deed number is required'
        }
        if (!formData.firm_pan?.trim()) {
          newErrors.firm_pan = 'Firm PAN is required'
        } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.firm_pan)) {
          newErrors.firm_pan = 'Invalid PAN format'
        }
        if (!formData.gst_registration_status) {
          newErrors.gst_registration_status = 'GST status is required'
        }
        if (formData.gst_registration_status === 'REGISTERED' && !formData.gstin?.trim()) {
          newErrors.gstin = 'GSTIN is required for registered firms'
        }
        break

      case 2: // Partners
        if (formData.partners.length < 2) {
          newErrors.partners = 'Minimum 2 partners are required'
        }
        let totalCapital = 0
        let totalProfit = 0
        let hasManagingPartner = false
        formData.partners.forEach((partner, index) => {
          if (!partner.full_name?.trim()) {
            newErrors[`partner_${index}_name`] = `Partner ${index + 1}: Name is required`
          }
          if (!partner.pan_number?.trim()) {
            newErrors[`partner_${index}_pan`] = `Partner ${index + 1}: PAN is required`
          }
          if (!partner.partner_type) {
            newErrors[`partner_${index}_type`] = `Partner ${index + 1}: Type is required`
          }
          if (partner.partner_type === 'MANAGING_PARTNER') {
            hasManagingPartner = true
          }
          totalCapital += partner.capital_contribution_percent || 0
          totalProfit += partner.profit_sharing_percent || 0
        })
        if (!hasManagingPartner) {
          newErrors.managing_partner = 'At least one Managing Partner is required'
        }
        if (totalCapital > 0 && Math.abs(totalCapital - 100) > 0.01) {
          newErrors.capital_total = 'Capital contributions must total 100%'
        }
        if (totalProfit > 0 && Math.abs(totalProfit - 100) > 0.01) {
          newErrors.profit_total = 'Profit sharing must total 100%'
        }
        break

      case 3: // Profile-Specific Business Fields
        // Validation will be handled by ProfileSpecificBusinessStep component
        // based on field-level requirements from database
        break

      case 4: // Address
        if (!formData.registered_address_line1?.trim()) {
          newErrors.registered_address_line1 = 'Registered address is required'
        }
        if (!formData.registered_city?.trim()) {
          newErrors.registered_city = 'City is required'
        }
        if (!formData.registered_state) {
          newErrors.registered_state = 'State is required'
        }
        if (!formData.registered_pincode?.trim()) {
          newErrors.registered_pincode = 'Pincode is required'
        }
        break

      case 5: // Documents
        if (!formData.partnership_deed_url) {
          newErrors.partnership_deed_url = 'Partnership deed is required'
        }
        if (!formData.firm_pan_url) {
          newErrors.firm_pan_url = 'Firm PAN card is required'
        }
        if (!formData.bank_statement_url) {
          newErrors.bank_statement_url = 'Bank statement is required'
        }
        break

      case 6: // Review
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save draft
  const saveDraft = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/customers/entity-profiles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type_id: entityTypeId,
          income_profile_id: incomeProfileId,
          profile_data: {
            ...formData,
            profile_fields_data: profileFieldsData // Include profile-specific fields
          },
          is_draft: true
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

    if (currentStep < 6) {
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
    if (!validateStep(6)) return

    try {
      setSaving(true)
      const response = await fetch('/api/customers/entity-profiles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type_id: entityTypeId,
          income_profile_id: incomeProfileId,
          profile_data: {
            ...formData,
            profile_fields_data: profileFieldsData // Include profile-specific fields
          },
          is_draft: false
        })
      })

      const data = await response.json()
      if (data.success) {
        // Auto-create customer profiles for all partners
        const newEntityId = data.data?.entity?.id
        if (newEntityId && formData.partners && formData.partners.length > 0) {
          toast.success('Partnership created! Creating member profiles...')

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
                      designation: partner.designation,
                      shareholding_percentage: partner.capital_contribution_percent,
                      is_signatory: partner.partner_type === 'MANAGING_PARTNER',
                      can_apply_loan: true
                    },
                    send_credentials: true
                  })
                })

                const memberData = await memberResponse.json()
                if (memberData.success) {
                  successCount++
                }
              } catch (memberErr) {
                console.error('Error creating member profile:', memberErr)
              }
            }
          }

          if (successCount > 0) {
            toast.success(`✓ Partnership submitted! ${successCount} member profile(s) created with login credentials sent.`)
          } else {
            toast.success('Partnership profile submitted successfully!')
          }
        } else {
          toast.success('Partnership profile submitted successfully!')
        }

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

  // Update profile-specific field
  const updateProfileField = (key: string, value: string) => {
    setProfileFieldsData(prev => ({ ...prev, [key]: value }))
    // Clear error for this field
    if (errors[key]) {
      const newErrors = { ...errors }
      delete newErrors[key]
      setErrors(newErrors)
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <FirmDetailsStep
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 2:
        return (
          <PartnersStepEnhanced
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 3:
        return (
          <ProfileSpecificBusinessStep
            incomeProfileId={incomeProfileId || ''}
            data={profileFieldsData}
            onChange={updateProfileField}
            errors={errors}
          />
        )
      case 4:
        return (
          <AddressStep
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 5:
        return (
          <DocumentsStep
            data={formData}
            errors={errors}
            onUpdate={updateFormData}
          />
        )
      case 6:
        return (
          <ReviewStep
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
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white ring-4 ring-orange-500/30'
                        : isCompleted
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-400'
                    } ${isClickable ? 'group-hover:ring-2 group-hover:ring-orange-500/50' : ''}`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium text-center ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                  <span className="text-xs text-gray-500 hidden md:block">{step.description}</span>
                </button>

                {/* Connector */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 sm:mx-2">
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
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {currentStep === 1 && onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
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

          {currentStep < 6 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
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
