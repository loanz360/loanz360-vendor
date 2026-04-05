'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2, X, ChevronRight, ChevronLeft, Plus, Loader2,
  AlertCircle, CheckCircle, Info, FileText, Users
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'
import { toast } from 'sonner'

interface EntityType {
  id: string
  code: string
  name: string
  short_name: string | null
  description: string | null
  category: string
  governing_act: string | null
  registration_authority: string | null
  pan_prefix: string | null
  min_members: number
  max_members: number | null
  requires_registration: boolean
  requires_din: boolean
  requires_llpin: boolean
  available_roles: Array<{
    code: string
    name: string
    can_apply_loan?: boolean
    can_view_financials?: boolean
    can_manage_members?: boolean
    can_sign_documents?: boolean
  }>
  required_documents: string[]
  icon: string | null
  color: string | null
}

interface CategoryInfo {
  key: string
  label: string
}

interface AddEntityModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (entity: unknown) => void
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
]

type Step = 'select-type' | 'entity-details' | 'your-role' | 'review'

export default function AddEntityModal({
  isOpen,
  onClose,
  onSuccess
}: AddEntityModalProps) {
  const [step, setStep] = useState<Step>('select-type')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [groupedTypes, setGroupedTypes] = useState<Record<string, EntityType[]>>({})

  // Selection state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<EntityType | null>(null)

  // Form data
  const [formData, setFormData] = useState({
    legal_name: '',
    trading_name: '',
    registration_number: '',
    date_of_incorporation: '',
    pan_number: '',
    tan_number: '',
    gstin: '',
    cin_llpin: '',
    business_address_line1: '',
    business_address_line2: '',
    business_address_city: '',
    business_address_state: '',
    business_address_pincode: '',
    business_email: '',
    business_phone: '',
    website: ''
  })

  // Role data
  const [selectedRole, setSelectedRole] = useState<{ code: string; name: string } | null>(null)
  const [ownershipPercentage, setOwnershipPercentage] = useState<string>('')

  // Fetch entity types
  const fetchEntityTypes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/customers/entity-types', {
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setEntityTypes(data.entityTypes || [])
        setCategories(data.categories || [])
        setGroupedTypes(data.groupedByCategory || {})
      } else {
        setError(data.error || 'Failed to load entity types')
      }
    } catch (err) {
      clientLogger.error('Error fetching entity types', { error: err })
      setError('Failed to load entity types')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchEntityTypes()
      // Reset state
      setStep('select-type')
      setSelectedCategory(null)
      setSelectedType(null)
      setSelectedRole(null)
      setOwnershipPercentage('')
      setFormData({
        legal_name: '',
        trading_name: '',
        registration_number: '',
        date_of_incorporation: '',
        pan_number: '',
        tan_number: '',
        gstin: '',
        cin_llpin: '',
        business_address_line1: '',
        business_address_line2: '',
        business_address_city: '',
        business_address_state: '',
        business_address_pincode: '',
        business_email: '',
        business_phone: '',
        website: ''
      })
    }
  }, [isOpen, fetchEntityTypes])

  const handleSubmit = async () => {
    if (!selectedType || !selectedRole) {
      setError('Please select entity type and your role')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/customers/individual/entities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type_id: selectedType.id,
          ...formData,
          creator_role_code: selectedRole.code,
          creator_role_name: selectedRole.name,
          ownership_percentage: ownershipPercentage ? parseFloat(ownershipPercentage) : null
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Entity created successfully')
        onSuccess?.(data.entity)
        onClose()
      } else {
        setError(data.error || 'Failed to create entity')
      }
    } catch (err) {
      clientLogger.error('Error creating entity', { error: err })
      setError('Failed to create entity')
    } finally {
      setSaving(false)
    }
  }

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      INDIVIDUAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
      PARTNERSHIP: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30',
      CORPORATE: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30',
      TRUST_NGO: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
      COOPERATIVE: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30',
      JOINT_VENTURE: 'bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30',
    }
    return colorMap[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const canProceed = () => {
    switch (step) {
      case 'select-type':
        return !!selectedType
      case 'entity-details':
        return !!formData.legal_name.trim()
      case 'your-role':
        return !!selectedRole
      case 'review':
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    switch (step) {
      case 'select-type':
        setStep('entity-details')
        break
      case 'entity-details':
        setStep('your-role')
        break
      case 'your-role':
        setStep('review')
        break
      case 'review':
        handleSubmit()
        break
    }
  }

  const goBack = () => {
    switch (step) {
      case 'entity-details':
        setStep('select-type')
        break
      case 'your-role':
        setStep('entity-details')
        break
      case 'review':
        setStep('your-role')
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Add New Entity</h2>
              <p className="text-sm text-gray-400">
                {step === 'select-type' && 'Select entity type'}
                {step === 'entity-details' && 'Enter entity details'}
                {step === 'your-role' && 'Select your role'}
                {step === 'review' && 'Review and create'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {['select-type', 'entity-details', 'your-role', 'review'].map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    step === s
                      ? 'bg-orange-500 text-white'
                      : ['select-type', 'entity-details', 'your-role', 'review'].indexOf(step) > i
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {['select-type', 'entity-details', 'your-role', 'review'].indexOf(step) > i ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 ${['select-type', 'entity-details', 'your-role', 'review'].indexOf(step) > i ? 'bg-green-500/50' : 'bg-gray-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}

          {/* Step 1: Select Entity Type */}
          {!loading && step === 'select-type' && (
            <div className="space-y-4">
              {/* Category Selection */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    !selectedCategory
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                      selectedCategory === cat.key
                        ? getCategoryColor(cat.key)
                        : 'bg-gray-800 text-gray-400 border-transparent hover:bg-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Entity Types Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(selectedCategory
                  ? groupedTypes[selectedCategory] || []
                  : entityTypes
                ).map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedType?.id === type.id
                        ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-white">{type.name}</h4>
                      {type.short_name && (
                        <span className="text-xs text-gray-500">{type.short_name}</span>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-xs text-gray-400 mb-2 line-clamp-2">{type.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <span className={`px-2 py-0.5 text-xs rounded border ${getCategoryColor(type.category)}`}>
                        {type.category.replace(/_/g, ' ')}
                      </span>
                      {type.requires_registration && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                          Registration Req.
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Type Info */}
              {selectedType && (
                <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-white font-medium mb-1">{selectedType.name}</p>
                      {selectedType.governing_act && (
                        <p className="text-gray-400">Governed by: {selectedType.governing_act}</p>
                      )}
                      {selectedType.registration_authority && (
                        <p className="text-gray-400">Registered with: {selectedType.registration_authority}</p>
                      )}
                      <p className="text-gray-400 mt-1">
                        Members: {selectedType.min_members}
                        {selectedType.max_members ? ` - ${selectedType.max_members}` : '+'}
                      </p>
                      {selectedType.required_documents && selectedType.required_documents.length > 0 && (
                        <div className="mt-2">
                          <p className="text-gray-500 text-xs mb-1">Required Documents:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedType.required_documents.slice(0, 5).map(doc => (
                              <span key={doc} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                                {doc}
                              </span>
                            ))}
                            {selectedType.required_documents.length > 5 && (
                              <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                                +{selectedType.required_documents.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Entity Details */}
          {!loading && step === 'entity-details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Legal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.legal_name}
                    onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                    placeholder="Enter registered legal name"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trading Name
                  </label>
                  <input
                    type="text"
                    value={formData.trading_name}
                    onChange={(e) => setFormData({ ...formData, trading_name: e.target.value })}
                    placeholder="Brand/Trading name (if different)"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="CIN / LLPIN / Firm No."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={formData.pan_number}
                    onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                    placeholder="Entity PAN"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="GST Number"
                    maxLength={15}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date of Incorporation
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_incorporation}
                    onChange={(e) => setFormData({ ...formData, date_of_incorporation: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={formData.business_email}
                    onChange={(e) => setFormData({ ...formData, business_email: e.target.value })}
                    placeholder="email@company.com"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <hr className="border-gray-800" />

              <h4 className="text-white font-medium">Business Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={formData.business_address_line1}
                    onChange={(e) => setFormData({ ...formData, business_address_line1: e.target.value })}
                    placeholder="Building, Street"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.business_address_city}
                    onChange={(e) => setFormData({ ...formData, business_address_city: e.target.value })}
                    placeholder="City"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    State
                  </label>
                  <select
                    value={formData.business_address_state}
                    onChange={(e) => setFormData({ ...formData, business_address_state: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    value={formData.business_address_pincode}
                    onChange={(e) => setFormData({ ...formData, business_address_pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.business_phone}
                    onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
                    placeholder="Phone number"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Your Role */}
          {!loading && step === 'your-role' && selectedType && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Select your role in {formData.legal_name || 'this entity'}:
              </p>

              <div className="grid grid-cols-1 gap-3">
                {(selectedType.available_roles || []).map(role => (
                  <button
                    key={role.code}
                    onClick={() => setSelectedRole(role)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedRole?.code === role.code
                        ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <h4 className="font-medium text-white mb-1">{role.name}</h4>
                    <div className="flex flex-wrap gap-1">
                      {role.can_apply_loan && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                          Can Apply Loan
                        </span>
                      )}
                      {role.can_view_financials && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                          View Financials
                        </span>
                      )}
                      {role.can_manage_members && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                          Manage Members
                        </span>
                      )}
                      {role.can_sign_documents && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                          Sign Documents
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selectedRole && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ownership Percentage (Optional)
                  </label>
                  <input
                    type="number"
                    value={ownershipPercentage}
                    onChange={(e) => setOwnershipPercentage(e.target.value)}
                    placeholder="e.g., 51"
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {!loading && step === 'review' && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-white font-medium mb-3">Entity Details</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-white">{selectedType?.name}</dd>
                  <dt className="text-gray-500">Legal Name</dt>
                  <dd className="text-white">{formData.legal_name}</dd>
                  {formData.trading_name && (
                    <>
                      <dt className="text-gray-500">Trading Name</dt>
                      <dd className="text-white">{formData.trading_name}</dd>
                    </>
                  )}
                  {formData.pan_number && (
                    <>
                      <dt className="text-gray-500">PAN</dt>
                      <dd className="text-white">{formData.pan_number}</dd>
                    </>
                  )}
                  {formData.gstin && (
                    <>
                      <dt className="text-gray-500">GSTIN</dt>
                      <dd className="text-white">{formData.gstin}</dd>
                    </>
                  )}
                  {formData.business_address_city && (
                    <>
                      <dt className="text-gray-500">Location</dt>
                      <dd className="text-white">{formData.business_address_city}, {formData.business_address_state}</dd>
                    </>
                  )}
                </dl>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-white font-medium mb-3">Your Role</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Role</dt>
                  <dd className="text-white">{selectedRole?.name}</dd>
                  {ownershipPercentage && (
                    <>
                      <dt className="text-gray-500">Ownership</dt>
                      <dd className="text-white">{ownershipPercentage}%</dd>
                    </>
                  )}
                </dl>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-300">
                    By creating this entity, you confirm that you are authorized to represent it
                    and that the information provided is accurate.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={step === 'select-type' ? onClose : goBack}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            {step === 'select-type' ? 'Cancel' : (
              <span className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </span>
            )}
          </button>

          <button
            onClick={goNext}
            disabled={!canProceed() || saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : step === 'review' ? (
              <Plus className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {step === 'review' ? 'Create Entity' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
