'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  MapPin,
  FileCheck,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Save
} from 'lucide-react'
import { toast } from 'sonner'
import PersonalDetailsStep from './steps/PersonalDetailsStep'
import AddressStep from './steps/AddressStep'
import KYCDocumentsStep from './steps/KYCDocumentsStep'
import ReviewStep from './steps/ReviewStep'

// Types for profile data
export interface CustomerProfileData {
  // Personal Details
  full_name: string
  date_of_birth: string
  gender: string
  father_name: string
  mother_name: string
  marital_status: string

  // Contact
  email: string
  mobile_primary: string
  mobile_secondary: string

  // Current Address
  current_address_line1: string
  current_address_line2: string
  current_city: string
  current_state: string
  current_pincode: string
  current_address_proof_type: string
  current_address_proof_url: string

  // Permanent Address
  permanent_same_as_current: boolean
  permanent_address_line1: string
  permanent_address_line2: string
  permanent_city: string
  permanent_state: string
  permanent_pincode: string
  permanent_address_proof_type: string
  permanent_address_proof_url: string

  // KYC Documents
  pan_number: string
  pan_verified: boolean
  pan_document_url: string
  pan_holder_name: string
  aadhaar_number: string
  aadhaar_verified: boolean
  aadhaar_document_url: string
  aadhaar_holder_name: string

  // Profile Photo
  profile_photo_url: string

  // Status
  kyc_status: string
  profile_completed: boolean
}

export interface CustomerProfileWizardProps {
  onComplete: () => void
  initialData?: Partial<CustomerProfileData>
}

// Step configuration
const STEPS = [
  { id: 1, title: 'Personal Details', icon: User, description: 'Basic information' },
  { id: 2, title: 'Address', icon: MapPin, description: 'Current & permanent address' },
  { id: 3, title: 'KYC Documents', icon: FileCheck, description: 'PAN & Aadhaar verification' },
  { id: 4, title: 'Review', icon: CheckCircle, description: 'Confirm your details' }
]

export const initialProfileData: CustomerProfileData = {
  full_name: '',
  date_of_birth: '',
  gender: '',
  father_name: '',
  mother_name: '',
  marital_status: '',
  email: '',
  mobile_primary: '',
  mobile_secondary: '',
  current_address_line1: '',
  current_address_line2: '',
  current_city: '',
  current_state: '',
  current_pincode: '',
  current_address_proof_type: '',
  current_address_proof_url: '',
  permanent_same_as_current: false,
  permanent_address_line1: '',
  permanent_address_line2: '',
  permanent_city: '',
  permanent_state: '',
  permanent_pincode: '',
  permanent_address_proof_type: '',
  permanent_address_proof_url: '',
  pan_number: '',
  pan_verified: false,
  pan_document_url: '',
  pan_holder_name: '',
  aadhaar_number: '',
  aadhaar_verified: false,
  aadhaar_document_url: '',
  aadhaar_holder_name: '',
  profile_photo_url: '',
  kyc_status: 'NOT_STARTED',
  profile_completed: false
}

export default function CustomerProfileWizard({ onComplete, initialData }: CustomerProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [profileData, setProfileData] = useState<CustomerProfileData>({
    ...initialProfileData,
    ...initialData
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch existing profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/customers/customer-profile', {
          credentials: 'include'
        })
        const data = await response.json()

        if (data.success && data.profile) {
          setProfileData(prev => ({
            ...prev,
            ...data.profile,
            // Ensure email and mobile from auth if not in profile
            email: data.profile.email || data.auth_email || prev.email,
            mobile_primary: data.profile.mobile_primary || data.auth_phone || prev.mobile_primary,
            full_name: data.profile.full_name || data.auth_name || prev.full_name
          }))
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // Update profile data
  const updateProfileData = useCallback((updates: Partial<CustomerProfileData>) => {
    setProfileData(prev => ({ ...prev, ...updates }))
    // Clear errors for updated fields
    const clearedErrors = { ...errors }
    Object.keys(updates).forEach(key => {
      delete clearedErrors[key]
    })
    setErrors(clearedErrors)
  }, [errors])

  // Validate step - All fields are optional for dev/testing
  // TODO: Re-enable validation for production
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1: // Personal Details - All optional for dev
        // if (!profileData.full_name?.trim()) newErrors.full_name = 'Full name is required'
        // if (!profileData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required'
        // if (!profileData.gender) newErrors.gender = 'Gender is required'
        // if (!profileData.father_name?.trim()) newErrors.father_name = "Father's name is required"
        // if (!profileData.marital_status) newErrors.marital_status = 'Marital status is required'
        // if (!profileData.email?.trim()) newErrors.email = 'Email is required'
        // if (!profileData.mobile_primary?.trim()) newErrors.mobile_primary = 'Mobile number is required'
        break

      case 2: // Address - All optional for dev
        // if (!profileData.current_address_line1?.trim()) newErrors.current_address_line1 = 'Address line 1 is required'
        // if (!profileData.current_city?.trim()) newErrors.current_city = 'City is required'
        // if (!profileData.current_state?.trim()) newErrors.current_state = 'State is required'
        // if (!profileData.current_pincode?.trim()) newErrors.current_pincode = 'Pincode is required'
        // if (!profileData.current_address_proof_type) newErrors.current_address_proof_type = 'Address proof type is required'
        // if (!profileData.current_address_proof_url) newErrors.current_address_proof_url = 'Please upload address proof'

        // if (!profileData.permanent_same_as_current) {
        //   if (!profileData.permanent_address_line1?.trim()) newErrors.permanent_address_line1 = 'Address line 1 is required'
        //   if (!profileData.permanent_city?.trim()) newErrors.permanent_city = 'City is required'
        //   if (!profileData.permanent_state?.trim()) newErrors.permanent_state = 'State is required'
        //   if (!profileData.permanent_pincode?.trim()) newErrors.permanent_pincode = 'Pincode is required'
        //   if (!profileData.permanent_address_proof_type) newErrors.permanent_address_proof_type = 'Address proof type is required'
        //   if (!profileData.permanent_address_proof_url) newErrors.permanent_address_proof_url = 'Please upload address proof'
        // }
        break

      case 3: // KYC Documents - All optional for dev
        // Only validate format if value is provided
        if (profileData.pan_number?.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(profileData.pan_number.toUpperCase())) {
          newErrors.pan_number = 'Invalid PAN format'
        }
        if (profileData.aadhaar_number?.trim() && !/^[0-9]{12}$/.test(profileData.aadhaar_number.replace(/\s/g, ''))) {
          newErrors.aadhaar_number = 'Invalid Aadhaar format (12 digits)'
        }
        break

      case 4: // Review - no validation, just confirmation
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save draft
  const saveDraft = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/customers/customer-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileData,
          kyc_status: 'IN_PROGRESS'
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
      // Save progress before moving to next step
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

  // Go to specific step (only if already completed)
  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step)
    }
  }

  // Complete profile
  const completeProfile = async () => {
    if (!validateStep(4)) return

    try {
      setSaving(true)
      const response = await fetch('/api/customers/customer-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profileData,
          kyc_status: 'VERIFIED',
          profile_completed: true,
          mark_complete: true
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Profile completed successfully!')
        onComplete()
      } else {
        toast.error(data.error || 'Failed to complete profile')
      }
    } catch (err) {
      console.error('Error completing profile:', err)
      toast.error('Failed to complete profile')
    } finally {
      setSaving(false)
    }
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalDetailsStep
            data={profileData}
            errors={errors}
            onUpdate={updateProfileData}
          />
        )
      case 2:
        return (
          <AddressStep
            data={profileData}
            errors={errors}
            onUpdate={updateProfileData}
          />
        )
      case 3:
        return (
          <KYCDocumentsStep
            data={profileData}
            errors={errors}
            onUpdate={updateProfileData}
          />
        )
      case 4:
        return (
          <ReviewStep
            data={profileData}
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
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your profile...</p>
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
                        ? 'bg-purple-500 text-white ring-4 ring-purple-500/30'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-800 text-gray-400'
                    } ${isClickable ? 'group-hover:ring-2 group-hover:ring-purple-500/50' : ''}`}
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
                        currentStep > step.id ? 'bg-green-500' : 'bg-gray-700'
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
                  {Object.values(errors).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium"
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
              onClick={completeProfile}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Profile
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
