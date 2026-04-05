'use client'

import { toast } from 'sonner'

import { InlineLoading } from '@/components/ui/loading-spinner'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, Lock, AlertTriangle, Briefcase, Building2, Check, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface CategoryNode {
  id: string
  level: number
  category_key: string
  category_name: string
  category_description: string | null
  icon_name: string | null
  color_code: string | null
  parent_id: string | null
  employment_type: string | null
  children: CategoryNode[]
}

interface SubCategorySelectionPopupProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selection: {
    employment_type: string
    primary_category: string
    sub_category: string
    specific_profile: string
    primary_name: string
    sub_name: string
    specific_name: string
  }) => void
  initialEmploymentType?: string
  isLocked?: boolean
  currentSelection?: {
    primary_category: string
    sub_category: string
    specific_profile: string
  }
}

type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'OTHER'

export default function SubCategorySelectionPopup({
  isOpen,
  onClose,
  onConfirm,
  initialEmploymentType,
  isLocked = false,
  currentSelection
}: SubCategorySelectionPopupProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [employmentType, setEmploymentType] = useState<EmploymentType | null>(
    (initialEmploymentType as EmploymentType) || null
  )
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Selections
  const [selectedPrimary, setSelectedPrimary] = useState<CategoryNode | null>(null)
  const [selectedSub, setSelectedSub] = useState<CategoryNode | null>(null)
  const [selectedSpecific, setSelectedSpecific] = useState<CategoryNode | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Fetch categories when employment type changes
  useEffect(() => {
    if (employmentType && isOpen) {
      fetchCategories()
    }
  }, [employmentType, isOpen])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/categories?employment_type=${employmentType}`)
      const data = await response.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmploymentSelect = (type: EmploymentType) => {
    setEmploymentType(type)
    setSelectedPrimary(null)
    setSelectedSub(null)
    setSelectedSpecific(null)
    setStep(2)
  }

  const handlePrimarySelect = (category: CategoryNode) => {
    setSelectedPrimary(category)
    setSelectedSub(null)
    setSelectedSpecific(null)
    if (category.children.length > 0) {
      setStep(3)
    }
  }

  const handleSubSelect = (category: CategoryNode) => {
    setSelectedSub(category)
    setSelectedSpecific(null)
    if (category.children.length > 0) {
      setStep(4)
    }
  }

  const handleSpecificSelect = (category: CategoryNode) => {
    setSelectedSpecific(category)
    setShowConfirmation(true)
  }

  const handleConfirm = async () => {
    if (!employmentType || !selectedPrimary || !selectedSub || !selectedSpecific) return

    setSaving(true)
    try {
      const response = await fetch('/api/customers/profile/sub-category', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employment_type: employmentType,
          primary_category: selectedPrimary.category_key,
          sub_category: selectedSub.category_key,
          specific_profile: selectedSpecific.category_key
        })
      })

      const data = await response.json()
      if (data.success) {
        onConfirm({
          employment_type: employmentType,
          primary_category: selectedPrimary.category_key,
          sub_category: selectedSub.category_key,
          specific_profile: selectedSpecific.category_key,
          primary_name: selectedPrimary.category_name,
          sub_name: selectedSub.category_name,
          specific_name: selectedSpecific.category_name
        })
        // Show success screen instead of closing
        setShowConfirmation(false)
        setShowSuccess(true)
      } else {
        toast.error(data.error || 'Failed to save selection')
      }
    } catch (error) {
      console.error('Failed to save selection:', error)
      toast.error('Failed to save selection')
    } finally {
      setSaving(false)
    }
  }

  const handleGoToDashboard = () => {
    onClose()
    router.push('/customers')
  }

  const resetSelection = () => {
    setStep(1)
    setEmploymentType(null)
    setSelectedPrimary(null)
    setSelectedSub(null)
    setSelectedSpecific(null)
    setShowConfirmation(false)
  }

  if (!isOpen) return null

  // If locked, show locked view
  if (isLocked && currentSelection) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-semibold font-poppins">Profile Category</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Lock className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-amber-300 font-medium">Category Locked</p>
                <p className="text-amber-200/70 text-sm">
                  Your profile category has been set and cannot be changed.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Primary Category</p>
              <p className="text-white font-medium">{currentSelection.primary_category}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Sub-Category</p>
              <p className="text-white font-medium">{currentSelection.sub_category}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Specific Profile</p>
              <p className="text-white font-medium">{currentSelection.specific_profile}</p>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full mt-6 bg-gray-700 hover:bg-gray-600"
          >
            Close
          </Button>
        </div>
      </div>
    )
  }

  // Success screen
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 p-8 w-full max-w-md mx-4 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>

          <h3 className="text-2xl font-bold font-poppins text-white mb-2">
            Profile Created Successfully!
          </h3>
          <p className="text-gray-400 mb-6">
            Your profile has been set up and you're ready to explore loan options tailored for you.
          </p>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-gray-400 text-xs mb-2">Your Profile</p>
            <div className="space-y-1">
              <p className="text-white text-sm">
                <span className="text-gray-400">Type:</span> {employmentType}
              </p>
              <p className="text-white text-sm">
                <span className="text-gray-400">Category:</span> {selectedPrimary?.category_name}
              </p>
              <p className="text-white text-sm">
                <span className="text-gray-400">Profile:</span> {selectedSpecific?.category_name}
              </p>
            </div>
          </div>

          <Button
            onClick={handleGoToDashboard}
            className="w-full bg-[#FF6700] hover:bg-[#ff8533] text-white font-medium py-3"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  // Confirmation dialog
  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-semibold font-poppins">Confirm Selection</h3>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-amber-300 font-medium">Important Notice</p>
                <p className="text-amber-200/70 text-sm">
                  Once confirmed, this selection <strong>cannot be changed</strong>. Please review your selection carefully.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Employment Type</p>
              <p className="text-white font-medium">{employmentType}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Primary Category</p>
              <p className="text-white font-medium">{selectedPrimary?.category_name}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Sub-Category</p>
              <p className="text-white font-medium">{selectedSub?.category_name}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Specific Profile</p>
              <p className="text-white font-medium">{selectedSpecific?.category_name}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setShowConfirmation(false)}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={saving}
            >
              Go Back
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-[#FF6700] hover:bg-[#ff8533]"
              disabled={saving}
            >
              {saving ? 'Confirming...' : 'Confirm & Lock'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold font-poppins">Select Your Profile Category</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {['Employment Type', 'Primary Category', 'Sub-Category', 'Specific Profile'].map((label, idx) => (
            <div key={idx} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step > idx + 1 ? 'bg-green-500' : step === idx + 1 ? 'bg-[#FF6700]' : 'bg-gray-700'
              }`}>
                {step > idx + 1 ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-white text-sm">{idx + 1}</span>
                )}
              </div>
              {idx < 3 && (
                <div className={`w-12 md:w-20 h-1 ${step > idx + 1 ? 'bg-green-500' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Employment Type */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-gray-400 mb-4">Select your employment type to see relevant categories:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleEmploymentSelect('SALARIED')}
                className="p-6 rounded-xl border border-gray-700/50 hover:border-blue-500 hover:bg-blue-500/10 transition-all text-center group"
              >
                <div className="w-12 h-12 mx-auto mb-3 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:bg-blue-500/30">
                  <Briefcase className="w-6 h-6 text-blue-400" />
                </div>
                <h4 className="font-medium text-white">Salaried</h4>
                <p className="text-gray-400 text-sm mt-1">Employee working for a company</p>
              </button>

              <button
                onClick={() => handleEmploymentSelect('SELF_EMPLOYED')}
                className="p-6 rounded-xl border border-gray-700/50 hover:border-purple-500 hover:bg-purple-500/10 transition-all text-center group"
              >
                <div className="w-12 h-12 mx-auto mb-3 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/30">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <h4 className="font-medium text-white">Self-Employed</h4>
                <p className="text-gray-400 text-sm mt-1">Business owner or professional</p>
              </button>

              <button
                onClick={() => handleEmploymentSelect('OTHER')}
                className="p-6 rounded-xl border border-gray-700/50 hover:border-green-500 hover:bg-green-500/10 transition-all text-center group"
              >
                <div className="w-12 h-12 mx-auto mb-3 bg-green-500/20 rounded-full flex items-center justify-center group-hover:bg-green-500/30">
                  <Briefcase className="w-6 h-6 text-green-400" />
                </div>
                <h4 className="font-medium text-white">Other</h4>
                <p className="text-gray-400 text-sm mt-1">Pensioner, Rental Income, etc.</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Primary Category */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400">Select your primary category:</p>
                <p className="text-sm text-gray-500">Employment: {employmentType}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSelection}
                className="border-gray-700 text-gray-300"
              >
                Start Over
              </Button>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <InlineLoading size="sm" />
                <p className="text-gray-400 mt-2">Loading categories...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.filter(c => c.level === 1).map(category => (
                  <button
                    key={category.id}
                    onClick={() => handlePrimarySelect(category)}
                    className={`p-4 rounded-lg border text-left transition-all flex items-center justify-between ${
                      selectedPrimary?.id === category.id
                        ? 'border-[#FF6700] bg-[#FF6700]/10'
                        : 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/30'
                    }`}
                  >
                    <div>
                      <h4 className="font-medium text-white">{category.category_name}</h4>
                      {category.category_description && (
                        <p className="text-gray-400 text-sm mt-1">{category.category_description}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Sub-Category */}
        {step === 3 && selectedPrimary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400">Select sub-category:</p>
                <p className="text-sm text-[#FF6700]">{selectedPrimary.category_name}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="border-gray-700 text-gray-300"
              >
                Back
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedPrimary.children.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleSubSelect(category)}
                  className={`p-4 rounded-lg border text-left transition-all flex items-center justify-between ${
                    selectedSub?.id === category.id
                      ? 'border-[#FF6700] bg-[#FF6700]/10'
                      : 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/30'
                  }`}
                >
                  <div>
                    <h4 className="font-medium text-white">{category.category_name}</h4>
                    {category.category_description && (
                      <p className="text-gray-400 text-sm mt-1">{category.category_description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Specific Profile */}
        {step === 4 && selectedSub && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400">Select your specific profile:</p>
                <p className="text-sm text-[#FF6700]">
                  {selectedPrimary?.category_name} → {selectedSub.category_name}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(3)}
                className="border-gray-700 text-gray-300"
              >
                Back
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
              {selectedSub.children.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleSpecificSelect(category)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedSpecific?.id === category.id
                      ? 'border-[#FF6700] bg-[#FF6700]/10'
                      : 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/30'
                  }`}
                >
                  <h4 className="font-medium text-white">{category.category_name}</h4>
                  {category.category_description && (
                    <p className="text-gray-400 text-sm mt-1">{category.category_description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
