'use client'

import React from 'react'
import {
  CheckCircle,
  User,
  MapPin,
  FileCheck,
  Camera,
  Edit,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Fingerprint,
  Mail,
  Phone,
  Calendar,
  Home
} from 'lucide-react'
import type { CustomerProfileData } from '../CustomerProfileWizard'

interface ReviewStepProps {
  data: CustomerProfileData
  onEdit: (step: number) => void
  hideProfileHeader?: boolean
}

export default function ReviewStep({ data, onEdit, hideProfileHeader }: ReviewStepProps) {
  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Mask Aadhaar for display
  const maskAadhaar = (aadhaar: string) => {
    if (!aadhaar) return '-'
    const clean = aadhaar.replace(/\s/g, '')
    return `XXXX XXXX ${clean.slice(-4)}`
  }

  // Get gender display
  const getGenderDisplay = (gender: string) => {
    const map: Record<string, string> = {
      'MALE': 'Male',
      'FEMALE': 'Female',
      'OTHER': 'Other'
    }
    return map[gender] || gender || '-'
  }

  // Get marital status display
  const getMaritalStatusDisplay = (status: string) => {
    const map: Record<string, string> = {
      'SINGLE': 'Single',
      'MARRIED': 'Married',
      'DIVORCED': 'Divorced',
      'WIDOWED': 'Widowed'
    }
    return map[status] || status || '-'
  }

  // Format address
  const formatAddress = (
    line1: string,
    line2: string,
    city: string,
    state: string,
    pincode: string
  ) => {
    const parts = [line1, line2, city, state, pincode].filter(Boolean)
    return parts.join(', ') || '-'
  }

  // Check if all required fields are filled
  const isPersonalComplete = !!(
    data.full_name &&
    data.date_of_birth &&
    data.gender &&
    data.father_name &&
    data.marital_status &&
    data.email &&
    data.mobile_primary
  )

  const isAddressComplete = !!(
    data.current_address_line1 &&
    data.current_city &&
    data.current_state &&
    data.current_pincode &&
    data.current_address_proof_type &&
    data.current_address_proof_url &&
    (data.permanent_same_as_current || (
      data.permanent_address_line1 &&
      data.permanent_city &&
      data.permanent_state &&
      data.permanent_pincode &&
      data.permanent_address_proof_type &&
      data.permanent_address_proof_url
    ))
  )

  const isKYCComplete = !!(
    data.pan_number &&
    data.aadhaar_number
  )

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          Review Your Profile
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Please review all the information before completing your profile.
        </p>
      </div>

      {/* Profile Photo */}
      {!hideProfileHeader && (
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden">
            {data.profile_photo_url ? (
              <img
                src={data.profile_photo_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera className="w-8 h-8 text-gray-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{data.full_name || 'Your Name'}</h3>
            <p className="text-gray-400 text-sm">{data.email}</p>
            {!data.profile_photo_url && (
              <p className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No photo uploaded (optional)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Personal Details Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" />
            <h3 className="font-medium text-white">Personal Details</h3>
            {isPersonalComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                <CheckCircle className="w-3 h-3" /> Complete
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">
                <AlertCircle className="w-3 h-3" /> Incomplete
              </span>
            )}
          </div>
          <button
            onClick={() => onEdit(1)}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Full Name</p>
            <p className="text-white">{data.full_name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Date of Birth</p>
            <p className="text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              {formatDate(data.date_of_birth)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Gender</p>
            <p className="text-white">{getGenderDisplay(data.gender)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Marital Status</p>
            <p className="text-white">{getMaritalStatusDisplay(data.marital_status)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Father's Name</p>
            <p className="text-white">{data.father_name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Mother's Name</p>
            <p className="text-white">{data.mother_name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              {data.email || '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Mobile</p>
            <p className="text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500" />
              {data.mobile_primary || '-'}
              {data.mobile_secondary && (
                <span className="text-gray-500 text-sm"> / {data.mobile_secondary}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h3 className="font-medium text-white">Address Details</h3>
            {isAddressComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                <CheckCircle className="w-3 h-3" /> Complete
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">
                <AlertCircle className="w-3 h-3" /> Incomplete
              </span>
            )}
          </div>
          <button
            onClick={() => onEdit(2)}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-blue-400" />
              <p className="text-gray-400 text-sm font-medium">Current Address</p>
              {data.current_address_proof_url && (
                <span className="text-green-400 text-xs">Proof uploaded</span>
              )}
            </div>
            <p className="text-white text-sm pl-6">
              {formatAddress(
                data.current_address_line1,
                data.current_address_line2,
                data.current_city,
                data.current_state,
                data.current_pincode
              )}
            </p>
          </div>

          {/* Permanent Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-green-400" />
              <p className="text-gray-400 text-sm font-medium">Permanent Address</p>
              {data.permanent_same_as_current && (
                <span className="text-blue-400 text-xs">(Same as current)</span>
              )}
              {!data.permanent_same_as_current && data.permanent_address_proof_url && (
                <span className="text-green-400 text-xs">Proof uploaded</span>
              )}
            </div>
            {data.permanent_same_as_current ? (
              <p className="text-gray-400 text-sm pl-6 italic">Same as current address</p>
            ) : (
              <p className="text-white text-sm pl-6">
                {formatAddress(
                  data.permanent_address_line1,
                  data.permanent_address_line2,
                  data.permanent_city,
                  data.permanent_state,
                  data.permanent_pincode
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KYC Documents Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-green-400" />
            <h3 className="font-medium text-white">KYC Documents</h3>
            {isKYCComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                <CheckCircle className="w-3 h-3" /> Complete
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">
                <AlertCircle className="w-3 h-3" /> Incomplete
              </span>
            )}
          </div>
          <button
            onClick={() => onEdit(3)}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* PAN */}
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <p className="text-gray-400 text-sm">PAN Card</p>
              </div>
              {data.pan_verified ? (
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              ) : data.pan_number ? (
                <span className="flex items-center gap-1 text-yellow-400 text-xs">
                  <AlertCircle className="w-3 h-3" /> Not Verified
                </span>
              ) : null}
            </div>
            <p className="text-white font-mono">{data.pan_number || '-'}</p>
            {data.pan_holder_name && (
              <p className="text-gray-400 text-xs mt-1">Name: {data.pan_holder_name}</p>
            )}
          </div>

          {/* Aadhaar */}
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-purple-400" />
                <p className="text-gray-400 text-sm">Aadhaar Card</p>
              </div>
              {data.aadhaar_verified ? (
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              ) : data.aadhaar_number ? (
                <span className="flex items-center gap-1 text-yellow-400 text-xs">
                  <AlertCircle className="w-3 h-3" /> Not Verified
                </span>
              ) : null}
            </div>
            <p className="text-white font-mono">{maskAadhaar(data.aadhaar_number)}</p>
            {data.aadhaar_holder_name && (
              <p className="text-gray-400 text-xs mt-1">Name: {data.aadhaar_holder_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Completion Checklist */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <h4 className="font-medium text-white mb-3">Profile Completion Checklist</h4>
        <div className="space-y-2">
          {[
            { label: 'Personal Details', complete: isPersonalComplete },
            { label: 'Current Address with Proof', complete: !!data.current_address_proof_url },
            { label: 'Permanent Address with Proof', complete: data.permanent_same_as_current || !!data.permanent_address_proof_url },
            { label: 'PAN Number', complete: !!data.pan_number },
            { label: 'Aadhaar Number', complete: !!data.aadhaar_number },
            { label: 'Profile Photo', complete: !!data.profile_photo_url, optional: true }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.complete ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <div className={`w-4 h-4 rounded-full border-2 ${item.optional ? 'border-gray-600' : 'border-yellow-500'}`} />
              )}
              <span className={`text-sm ${item.complete ? 'text-gray-300' : item.optional ? 'text-gray-500' : 'text-yellow-400'}`}>
                {item.label}
                {item.optional && <span className="text-gray-600 text-xs ml-1">(optional)</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation */}
      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-400 font-medium">Ready to Complete</p>
            <p className="text-green-300 text-sm mt-1">
              By clicking "Complete Profile", you confirm that all the information provided is accurate and you agree to our terms and conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
