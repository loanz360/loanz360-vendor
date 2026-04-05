'use client'

import React, { useState } from 'react'
import {
  CheckCircle,
  Building2,
  User,
  MapPin,
  FileCheck,
  Edit,
  AlertCircle,
  Calendar,
  Phone,
  Mail,
  CreditCard,
  Fingerprint,
  Home,
  FileText,
  ShieldCheck
} from 'lucide-react'
import type { SoleProprietorshipData } from '../types'
import {
  NATURE_OF_BUSINESS_OPTIONS,
  BUSINESS_CATEGORY_OPTIONS,
  GST_STATUS_OPTIONS,
  GENDER_OPTIONS
} from '../types'
import { formatCurrency } from '@/lib/utils/cn'

interface ReviewSubmitStepProps {
  data: SoleProprietorshipData
  onEdit: (step: number) => void
}

export default function ReviewSubmitStep({ data, onEdit }: ReviewSubmitStepProps) {
  const [declarationAccepted, setDeclarationAccepted] = useState(false)

  // Helper functions
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const maskAadhaar = (aadhaar: string) => {
    if (!aadhaar) return '-'
    const clean = aadhaar.replace(/\s/g, '')
    return `XXXX XXXX ${clean.slice(-4)}`
  }

  const getOptionLabel = (options: { value: string; label: string }[], value: string) => {
    return options.find(o => o.value === value)?.label || value || '-'
  }

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

  // Check completion status
  const isBusinessComplete = !!(
    data.business_name &&
    data.nature_of_business &&
    data.business_category &&
    data.year_of_establishment &&
    data.gst_registration_status
  )

  const isOwnerComplete = !!(
    data.proprietor_name &&
    data.proprietor_dob &&
    data.proprietor_gender &&
    data.proprietor_father_name &&
    data.proprietor_pan &&
    data.proprietor_aadhaar &&
    data.proprietor_mobile &&
    data.proprietor_email
  )

  const isAddressComplete = !!(
    data.residential_address_line1 &&
    data.residential_city &&
    data.residential_state &&
    data.residential_pincode &&
    data.business_address_line1 &&
    data.business_city &&
    data.business_state &&
    data.business_pincode
  )

  const isDocumentsComplete = !!(
    data.pan_document_url &&
    data.aadhaar_front_url &&
    data.aadhaar_back_url &&
    data.passport_photo_url &&
    data.bank_statement_url &&
    data.business_address_proof_document_url
  )

  // Count uploaded documents
  const documentKeys = [
    'pan_document_url', 'aadhaar_front_url', 'aadhaar_back_url',
    'passport_photo_url', 'bank_statement_url', 'itr_documents_url',
    'gst_certificate_url', 'shop_license_document_url', 'udyam_certificate_url',
    'business_address_proof_document_url'
  ]
  const uploadedDocsCount = documentKeys.filter(k => !!data[k as keyof SoleProprietorshipData]).length

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Review & Submit</h2>
            <p className="text-sm text-gray-400">
              Please review all the information before submitting
            </p>
          </div>
        </div>
      </div>

      {/* Business Details Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-400" />
            <h3 className="font-medium text-white">Business Details</h3>
            {isBusinessComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded">
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
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Business Name</p>
            <p className="text-white">{data.business_name || '-'}</p>
          </div>
          {data.trading_name && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Trading Name</p>
              <p className="text-white">{data.trading_name}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 text-xs mb-1">Nature of Business</p>
            <p className="text-white">{getOptionLabel(NATURE_OF_BUSINESS_OPTIONS, data.nature_of_business)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Business Category</p>
            <p className="text-white">{getOptionLabel(BUSINESS_CATEGORY_OPTIONS, data.business_category)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Year of Establishment</p>
            <p className="text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              {data.year_of_establishment || '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Annual Turnover</p>
            <p className="text-white">{formatCurrency(data.annual_turnover)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">GST Status</p>
            <p className="text-white">{getOptionLabel(GST_STATUS_OPTIONS, data.gst_registration_status)}</p>
          </div>
          {data.gstin && (
            <div>
              <p className="text-gray-500 text-xs mb-1">GSTIN</p>
              <p className="text-white font-mono">{data.gstin}</p>
            </div>
          )}
          {data.udyam_registration && (
            <div>
              <p className="text-gray-500 text-xs mb-1">UDYAM Registration</p>
              <p className="text-white font-mono">{data.udyam_registration}</p>
            </div>
          )}
        </div>
      </div>

      {/* Proprietor Details Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-orange-400" />
            <h3 className="font-medium text-white">Proprietor Details</h3>
            {isOwnerComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded">
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
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Full Name</p>
            <p className="text-white">{data.proprietor_name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Date of Birth</p>
            <p className="text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              {formatDate(data.proprietor_dob)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Gender</p>
            <p className="text-white">{getOptionLabel(GENDER_OPTIONS, data.proprietor_gender)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Father's Name</p>
            <p className="text-white">{data.proprietor_father_name || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">PAN Number</p>
            <p className="text-white font-mono flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-500" />
              {data.proprietor_pan || '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Aadhaar Number</p>
            <p className="text-white font-mono flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-gray-500" />
              {maskAadhaar(data.proprietor_aadhaar)}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Mobile</p>
            <p className="text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500" />
              {data.proprietor_mobile || '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              {data.proprietor_email || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-400" />
            <h3 className="font-medium text-white">Address Details</h3>
            {isAddressComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded">
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
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Residential Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-orange-400" />
              <p className="text-gray-400 text-sm font-medium">Residential Address</p>
              {data.residential_address_proof_url && (
                <span className="text-orange-400 text-xs">Proof uploaded</span>
              )}
            </div>
            <p className="text-white text-sm pl-6">
              {formatAddress(
                data.residential_address_line1,
                data.residential_address_line2,
                data.residential_city,
                data.residential_state,
                data.residential_pincode
              )}
            </p>
          </div>

          {/* Permanent Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-orange-400" />
              <p className="text-gray-400 text-sm font-medium">Permanent Address</p>
              {data.permanent_same_as_residential && (
                <span className="text-orange-400 text-xs">(Same as residential)</span>
              )}
            </div>
            {data.permanent_same_as_residential ? (
              <p className="text-gray-400 text-sm pl-6 italic">Same as residential address</p>
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

          {/* Business Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-orange-400" />
              <p className="text-gray-400 text-sm font-medium">Business Address</p>
              {data.business_address_proof_url && (
                <span className="text-orange-400 text-xs">Proof uploaded</span>
              )}
            </div>
            <p className="text-white text-sm pl-6">
              {formatAddress(
                data.business_address_line1,
                data.business_address_line2,
                data.business_city,
                data.business_state,
                data.business_pincode
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-orange-400" />
            <h3 className="font-medium text-white">Documents</h3>
            {isDocumentsComplete ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded">
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
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm">Documents Uploaded</span>
            <span className="text-white font-medium">{uploadedDocsCount}/10</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { key: 'pan_document_url', label: 'PAN Card', icon: CreditCard },
              { key: 'aadhaar_front_url', label: 'Aadhaar Front', icon: Fingerprint },
              { key: 'aadhaar_back_url', label: 'Aadhaar Back', icon: Fingerprint },
              { key: 'passport_photo_url', label: 'Photo', icon: User },
              { key: 'bank_statement_url', label: 'Bank Statement', icon: FileText },
              { key: 'itr_documents_url', label: 'ITR', icon: FileText },
              { key: 'gst_certificate_url', label: 'GST Cert', icon: Building2 },
              { key: 'shop_license_document_url', label: 'Shop License', icon: FileCheck },
              { key: 'udyam_certificate_url', label: 'UDYAM', icon: FileCheck },
              { key: 'business_address_proof_document_url', label: 'Address Proof', icon: MapPin }
            ].map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  data[key as keyof SoleProprietorshipData]
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                {data[key as keyof SoleProprietorshipData] ? (
                  <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                ) : (
                  <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                )}
                <span className={`text-xs ${
                  data[key as keyof SoleProprietorshipData] ? 'text-orange-400' : 'text-gray-500'
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Declaration Checkbox */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={declarationAccepted}
            onChange={(e) => setDeclarationAccepted(e.target.checked)}
            className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50 mt-0.5"
          />
          <div>
            <span className="text-gray-300 text-sm">
              I hereby declare that all the information provided above is true and accurate to the best of my knowledge.
              I understand that any false information may result in rejection of my application.
            </span>
            <p className="text-gray-500 text-xs mt-2">
              By submitting, you agree to our Terms & Conditions and Privacy Policy.
            </p>
          </div>
        </label>
      </div>

      {/* Ready to Submit */}
      {declarationAccepted && isBusinessComplete && isOwnerComplete && isAddressComplete && isDocumentsComplete ? (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-400 font-medium">Ready to Submit</p>
              <p className="text-orange-300 text-sm mt-1">
                All required information has been provided. Click "Submit" to complete your Sole Proprietorship profile.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">Action Required</p>
              <p className="text-yellow-300 text-sm mt-1">
                {!declarationAccepted
                  ? 'Please accept the declaration to proceed.'
                  : 'Please complete all required sections before submitting.'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
