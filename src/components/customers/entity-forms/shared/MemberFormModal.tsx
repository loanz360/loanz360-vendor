'use client'

import React, { useState, useEffect } from 'react'
import { X, Upload, User, Phone, Mail, CreditCard, Fingerprint, Briefcase, Percent, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { MemberData } from './MemberCard'

interface MemberFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (member: MemberData) => void
  member: MemberData | null
  memberIndex: number
  entityType: 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'OPC' | 'TRUST' | 'SOCIETY' | 'HUF'
}

// Role options based on entity type
const ROLE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  PARTNERSHIP: [
    { value: 'MANAGING_PARTNER', label: 'Managing Partner' },
    { value: 'PARTNER', label: 'Partner' },
    { value: 'SLEEPING_PARTNER', label: 'Sleeping Partner' }
  ],
  LLP: [
    { value: 'DESIGNATED_PARTNER', label: 'Designated Partner' },
    { value: 'PARTNER', label: 'Partner' }
  ],
  PRIVATE_LIMITED: [
    { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'CEO', label: 'CEO' },
    { value: 'CFO', label: 'CFO' }
  ],
  PUBLIC_LIMITED: [
    { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'CEO', label: 'CEO' },
    { value: 'CFO', label: 'CFO' },
    { value: 'INDEPENDENT_DIRECTOR', label: 'Independent Director' }
  ],
  OPC: [
    { value: 'DIRECTOR', label: 'Director' },
    { value: 'NOMINEE_DIRECTOR', label: 'Nominee Director' }
  ],
  TRUST: [
    { value: 'MANAGING_TRUSTEE', label: 'Managing Trustee' },
    { value: 'TRUSTEE', label: 'Trustee' }
  ],
  SOCIETY: [
    { value: 'PRESIDENT', label: 'President' },
    { value: 'SECRETARY', label: 'Secretary' },
    { value: 'TREASURER', label: 'Treasurer' },
    { value: 'MEMBER', label: 'Member' }
  ],
  HUF: [
    { value: 'KARTA', label: 'Karta' },
    { value: 'COPARCENER', label: 'Coparcener' }
  ]
}

export default function MemberFormModal({
  isOpen,
  onClose,
  onSave,
  member,
  memberIndex,
  entityType
}: MemberFormModalProps) {
  const [formData, setFormData] = useState<Partial<MemberData>>({
    id: '',
    full_name: '',
    mobile: '',
    email: '',
    pan_number: '',
    aadhaar_number: '',
    role: '',
    designation: '',
    capital_contribution_percent: 0,
    profit_sharing_percent: 0,
    photo_url: '',
    is_signatory: false,
    can_apply_loan: false,
    can_edit_profile: false,
    can_view_financials: false,
    can_add_members: false,
    is_admin: false,
    is_filled: false
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)

  // Initialize form data when member changes
  useEffect(() => {
    if (member) {
      setFormData(member)
    } else {
      setFormData({
        id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        full_name: '',
        mobile: '',
        email: '',
        pan_number: '',
        aadhaar_number: '',
        role: '',
        designation: '',
        capital_contribution_percent: 0,
        profit_sharing_percent: 0,
        photo_url: '',
        is_signatory: false,
        can_apply_loan: false,
        can_edit_profile: false,
        can_view_financials: false,
        can_add_members: false,
        is_admin: false,
        is_filled: false
      })
    }
    setErrors({})
  }, [member, isOpen])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.full_name?.trim()) {
      newErrors.full_name = 'Name is required'
    }
    if (!formData.mobile?.trim()) {
      newErrors.mobile = 'Mobile number is required'
    } else if (!/^[0-9]{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Invalid mobile number (10 digits)'
    }
    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!formData.pan_number?.trim()) {
      newErrors.pan_number = 'PAN number is required'
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number)) {
      newErrors.pan_number = 'Invalid PAN format (e.g., ABCDE1234F)'
    }
    if (!formData.role) {
      newErrors.role = 'Role is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }

    onSave({
      ...formData,
      is_filled: true
    } as MemberData)
    onClose()
  }

  const handlePhotoUpload = async (file: File) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB')
      return
    }

    setUploading(true)
    try {
      // TODO: Implement actual S3 upload
      // For now, create a local object URL
      const photoUrl = URL.createObjectURL(file)
      setFormData(prev => ({ ...prev, photo_url: photoUrl }))
      toast.success('Photo uploaded successfully')
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const roleOptions = ROLE_OPTIONS[entityType] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">
              {member ? 'Edit Member' : `Add Member #${memberIndex + 1}`}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Enter member details to create their profile
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Photo Upload */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center relative overflow-hidden">
                {formData.photo_url ? (
                  <img
                    src={formData.photo_url}
                    alt="Member photo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handlePhotoUpload(file)
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="text-sm">Upload Photo</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Optional • JPG, PNG (max 2MB)</p>
              </div>
            </div>

            {/* Personal Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter full name as per PAN"
                    className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                      errors.full_name
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                    }`}
                  />
                </div>
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-400">{errors.full_name}</p>
                )}
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mobile Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                      errors.mobile
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                    }`}
                  />
                </div>
                {errors.mobile && (
                  <p className="mt-1 text-sm text-red-400">{errors.mobile}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                      errors.email
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                )}
              </div>

              {/* PAN */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PAN Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.pan_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors font-mono ${
                      errors.pan_number
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                    }`}
                  />
                </div>
                {errors.pan_number && (
                  <p className="mt-1 text-sm text-red-400">{errors.pan_number}</p>
                )}
              </div>

              {/* Aadhaar (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aadhaar Number <span className="text-gray-500">(Optional)</span>
                </label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.aadhaar_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                    placeholder="12-digit Aadhaar"
                    maxLength={12}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Role & Designation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors ${
                      errors.role
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                    }`}
                  >
                    <option value="">Select role</option>
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.role && (
                  <p className="mt-1 text-sm text-red-400">{errors.role}</p>
                )}
              </div>

              {/* Designation (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Designation <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                  placeholder="e.g., Senior Partner"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Financial Details (if applicable) */}
            {(entityType === 'PARTNERSHIP' || entityType === 'LLP') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Capital Contribution % <span className="text-gray-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.capital_contribution_percent}
                      onChange={(e) => setFormData(prev => ({ ...prev, capital_contribution_percent: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Profit Sharing % <span className="text-gray-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.profit_sharing_percent}
                      onChange={(e) => setFormData(prev => ({ ...prev, profit_sharing_percent: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Permissions */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Permissions <span className="text-gray-500">(Optional)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="is_signatory"
                    checked={formData.is_signatory}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_signatory: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <label htmlFor="is_signatory" className="text-gray-300 cursor-pointer flex-1">
                    <span className="block text-sm">Authorized Signatory</span>
                    <span className="block text-xs text-gray-500">Can sign documents on behalf of entity</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_apply_loan"
                    checked={formData.can_apply_loan}
                    onChange={(e) => setFormData(prev => ({ ...prev, can_apply_loan: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <label htmlFor="can_apply_loan" className="text-gray-300 cursor-pointer flex-1">
                    <span className="block text-sm">Can Apply for Loans</span>
                    <span className="block text-xs text-gray-500">Submit loan applications for the entity</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_edit_profile"
                    checked={formData.can_edit_profile}
                    onChange={(e) => setFormData(prev => ({ ...prev, can_edit_profile: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <label htmlFor="can_edit_profile" className="text-gray-300 cursor-pointer flex-1">
                    <span className="block text-sm">Can Edit Profile</span>
                    <span className="block text-xs text-gray-500">Manage and update entity profile details</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_view_financials"
                    checked={formData.can_view_financials}
                    onChange={(e) => setFormData(prev => ({ ...prev, can_view_financials: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <label htmlFor="can_view_financials" className="text-gray-300 cursor-pointer flex-1">
                    <span className="block text-sm">Can View Financials</span>
                    <span className="block text-xs text-gray-500">Access financial statements and records</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="can_add_members"
                    checked={formData.can_add_members}
                    onChange={(e) => setFormData(prev => ({ ...prev, can_add_members: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <label htmlFor="can_add_members" className="text-gray-300 cursor-pointer flex-1">
                    <span className="block text-sm">Can Add Members</span>
                    <span className="block text-xs text-gray-500">Invite and add new members to entity</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                  <input
                    type="checkbox"
                    id="is_admin"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_admin: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <label htmlFor="is_admin" className="text-gray-300 cursor-pointer flex-1">
                    <span className="block text-sm font-medium text-orange-400">Entity Admin</span>
                    <span className="block text-xs text-gray-500">Full control over entity settings</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
          >
            {member ? 'Update Member' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}
