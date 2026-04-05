'use client'

import React from 'react'
import {
  CheckCircle,
  Building2,
  MapPin,
  FileCheck,
  Edit,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Mail,
  Phone,
  Calendar,
  Home,
  FileText,
  IndianRupee,
  Globe,
  Hash,
  TrendingUp,
  Users,
  BookOpen,
  Landmark,
  Fingerprint
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/cn'

interface AddressData {
  address_line1?: string
  address_line2?: string
  landmark?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
  country?: string
  premises_type?: string
  premises_since?: string
}

interface ProfileDocument {
  id: string
  document_type: string
  document_name: string
  file_url: string
  file_size?: number
  uploaded_at: string
  verification_status?: string
}

interface EntityProfileData {
  legal_name?: string
  trading_name?: string
  description?: string
  entity_type?: string
  entity_type_name?: string
  entity_type_description?: string
  date_of_establishment?: string
  incorporation_date?: string
  industry_category?: string
  business_nature?: string
  msme_category?: string
  // Contact
  email?: string
  phone?: string
  alternate_phone?: string
  website?: string
  // Registrations
  pan_number?: string
  gst_number?: string
  gst_status?: string
  cin?: string
  llpin?: string
  registration_number?: string
  registration_authority?: string
  tan_number?: string
  udyam_registration_number?: string
  shop_establishment_number?: string
  // Addresses
  registered_address?: AddressData
  business_address_same_as_registered?: boolean
  business_address?: AddressData | null
  // Financial
  turnover_current_year?: number
  turnover_previous_year?: number
  profit_current_year?: number
  profit_previous_year?: number
  total_assets?: number
  total_liabilities?: number
  net_worth?: number
  // Operations
  number_of_employees?: number
  number_of_branches?: number
  major_customers?: string
  major_suppliers?: string
  // Entity-type specific
  entity_type_data?: Record<string, unknown>
  // Verification
  pan_verified?: boolean
  gst_verified?: boolean
  cin_verified?: boolean
  logo_url?: string
  documents?: ProfileDocument[]
}

interface EntityReviewStepProps {
  data: EntityProfileData
  onEdit: (section: number) => void
}

export default function EntityReviewStep({ data, onEdit }: EntityReviewStepProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatAddress = (addr?: AddressData) => {
    if (!addr) return '-'
    const parts = [addr.address_line1, addr.address_line2, addr.landmark, addr.city, addr.district, addr.state, addr.pincode].filter(Boolean)
    return parts.join(', ') || '-'
  }

  const formatLabel = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/\b(url|urls)\b/gi, '')
      .trim()
  }

  // Completeness checks
  const isBusinessComplete = !!(data.legal_name && data.entity_type && (data.date_of_establishment || data.incorporation_date))
  const isContactComplete = !!(data.email && data.phone)
  const isRegistrationComplete = !!(data.pan_number && (data.gst_number || data.cin || data.llpin || data.registration_number))
  const isAddressComplete = !!(data.registered_address?.address_line1 && data.registered_address?.city && data.registered_address?.state && data.registered_address?.pincode)
  const hasFinancial = !!(data.turnover_current_year != null || data.net_worth != null || data.total_assets != null)
  const hasOperations = !!(data.major_customers || data.major_suppliers || data.number_of_employees || data.number_of_branches)
  const hasEntityTypeData = !!(data.entity_type_data && Object.keys(data.entity_type_data).length > 0)

  // Extract directors/partners from entity_type_data
  const etd = data.entity_type_data || {}
  const directors = etd.directors as Array<Record<string, unknown>> | undefined
  const partners = etd.partners as Array<Record<string, unknown>> | undefined
  const projects = etd.ongoing_projects as Array<Record<string, unknown>> | undefined

  return (
    <div className="space-y-6">
      {/* Section 1: Business Information */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            <h3 className="font-medium text-white">Business Information</h3>
            {isBusinessComplete ? (
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
            <p className="text-gray-500 text-xs mb-1">Legal Name</p>
            <p className="text-white">{data.legal_name || '-'}</p>
          </div>
          {data.trading_name && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Trading Name</p>
              <p className="text-white">{data.trading_name}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 text-xs mb-1">Entity Type</p>
            <p className="text-white">{data.entity_type_name || data.entity_type || '-'}</p>
          </div>
          {data.industry_category && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Industry</p>
              <p className="text-white">{data.industry_category}</p>
            </div>
          )}
          {data.business_nature && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Business Nature</p>
              <p className="text-white">{data.business_nature}</p>
            </div>
          )}
          {data.msme_category && (
            <div>
              <p className="text-gray-500 text-xs mb-1">MSME Category</p>
              <p className="text-white">{data.msme_category}</p>
            </div>
          )}
          {data.date_of_establishment && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Date of Establishment</p>
              <p className="text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                {formatDate(data.date_of_establishment)}
              </p>
            </div>
          )}
          {data.incorporation_date && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Date of Incorporation</p>
              <p className="text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                {formatDate(data.incorporation_date)}
              </p>
            </div>
          )}
          {data.description && (
            <div className="sm:col-span-2">
              <p className="text-gray-500 text-xs mb-1">Description</p>
              <p className="text-white text-sm">{data.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Contact Details */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-400" />
            <h3 className="font-medium text-white">Contact Details</h3>
            {isContactComplete ? (
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

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              {data.email || '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Phone</p>
            <p className="text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500" />
              {data.phone || '-'}
              {data.alternate_phone && (
                <span className="text-gray-500 text-sm"> / {data.alternate_phone}</span>
              )}
            </p>
          </div>
          {data.website && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Website</p>
              <p className="text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                {data.website}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Registration Details */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-green-400" />
            <h3 className="font-medium text-white">Registration & KYC</h3>
            {isRegistrationComplete ? (
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

        <div className="p-4 space-y-4">
          {/* PAN & GST Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-purple-400" />
                  <p className="text-gray-400 text-sm">GSTIN</p>
                </div>
                {data.gst_verified ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                ) : data.gst_number ? (
                  <span className="flex items-center gap-1 text-yellow-400 text-xs">
                    <AlertCircle className="w-3 h-3" /> Not Verified
                  </span>
                ) : null}
              </div>
              <p className="text-white font-mono">{data.gst_number || '-'}</p>
              {data.gst_status && (
                <p className="text-gray-400 text-xs mt-1">Status: {data.gst_status}</p>
              )}
            </div>
          </div>

          {/* Other registrations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.cin && (
              <div>
                <p className="text-gray-500 text-xs mb-1">CIN</p>
                <p className="text-white font-mono flex items-center gap-2">
                  {data.cin}
                  {data.cin_verified && (
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <ShieldCheck className="w-3 h-3" />
                    </span>
                  )}
                </p>
              </div>
            )}
            {data.llpin && (
              <div>
                <p className="text-gray-500 text-xs mb-1">LLPIN</p>
                <p className="text-white font-mono">{data.llpin}</p>
              </div>
            )}
            {data.registration_number && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Registration Number</p>
                <p className="text-white font-mono">{data.registration_number}</p>
              </div>
            )}
            {data.registration_authority && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Registered With</p>
                <p className="text-white">{data.registration_authority}</p>
              </div>
            )}
            {data.tan_number && (
              <div>
                <p className="text-gray-500 text-xs mb-1">TAN</p>
                <p className="text-white font-mono">{data.tan_number}</p>
              </div>
            )}
            {data.udyam_registration_number && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Udyam Registration</p>
                <p className="text-white font-mono">{data.udyam_registration_number}</p>
              </div>
            )}
            {data.shop_establishment_number && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Shop & Establishment</p>
                <p className="text-white font-mono">{data.shop_establishment_number}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Address Details */}
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
            onClick={() => onEdit(4)}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-blue-400" />
              <p className="text-gray-400 text-sm font-medium">Registered Address</p>
            </div>
            <p className="text-white text-sm pl-6">{formatAddress(data.registered_address)}</p>
            {data.registered_address?.premises_type && (
              <p className="text-gray-500 text-xs pl-6 mt-1">Premises: {data.registered_address.premises_type.replace(/_/g, ' ')}</p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-green-400" />
              <p className="text-gray-400 text-sm font-medium">Business / Operating Address</p>
              {data.business_address_same_as_registered && (
                <span className="text-blue-400 text-xs">(Same as registered)</span>
              )}
            </div>
            {data.business_address_same_as_registered ? (
              <p className="text-gray-400 text-sm pl-6 italic">Same as registered address</p>
            ) : (
              <>
                <p className="text-white text-sm pl-6">{formatAddress(data.business_address)}</p>
                {data.business_address?.premises_type && (
                  <p className="text-gray-500 text-xs pl-6 mt-1">Premises: {data.business_address.premises_type.replace(/_/g, ' ')}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section 5: Financial Information (if available) */}
      {hasFinancial && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <h3 className="font-medium text-white">Financial Information</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                <CheckCircle className="w-3 h-3" /> Complete
              </span>
            </div>
            <button
              onClick={() => onEdit(5)}
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.turnover_current_year != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Current Year Turnover</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.turnover_current_year)}
                </p>
              </div>
            )}
            {data.turnover_previous_year != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Previous Year Turnover</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.turnover_previous_year)}
                </p>
              </div>
            )}
            {data.profit_current_year != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Current Year Profit</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.profit_current_year)}
                </p>
              </div>
            )}
            {data.profit_previous_year != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Previous Year Profit</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.profit_previous_year)}
                </p>
              </div>
            )}
            {data.total_assets != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Total Assets</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.total_assets)}
                </p>
              </div>
            )}
            {data.total_liabilities != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Total Liabilities</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.total_liabilities)}
                </p>
              </div>
            )}
            {data.net_worth != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Net Worth</p>
                <p className="text-white flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-500" />
                  {formatCurrency(data.net_worth)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 6: Operations (if available) */}
      {hasOperations && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="font-medium text-white">Operations</h3>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                <CheckCircle className="w-3 h-3" /> Complete
              </span>
            </div>
            <button
              onClick={() => onEdit(6)}
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.number_of_employees != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Number of Employees</p>
                <p className="text-white">{data.number_of_employees}</p>
              </div>
            )}
            {data.number_of_branches != null && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Number of Branches</p>
                <p className="text-white">{data.number_of_branches}</p>
              </div>
            )}
            {data.major_customers && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Major Customers</p>
                <p className="text-white">{data.major_customers}</p>
              </div>
            )}
            {data.major_suppliers && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Major Suppliers</p>
                <p className="text-white">{data.major_suppliers}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 7: Entity-Type Specific Data (Directors, Partners, etc.) */}
      {hasEntityTypeData && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <h3 className="font-medium text-white">Additional Details</h3>
            </div>
            <button
              onClick={() => onEdit(7)}
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Simple fields from entity_type_data */}
            {(() => {
              const skipKeys = new Set(['directors', 'partners', 'ongoing_projects', 'members'])
              const simpleFields = Object.entries(etd).filter(
                ([key, val]) => !skipKeys.has(key) && val != null && val !== '' && typeof val !== 'object' && !Array.isArray(val)
              )
              if (simpleFields.length === 0) return null
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {simpleFields.map(([key, val]) => (
                    <div key={key}>
                      <p className="text-gray-500 text-xs mb-1">{formatLabel(key)}</p>
                      <p className="text-white">
                        {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Directors / Shareholders */}
            {directors && directors.length > 0 && (
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Directors & Shareholders</p>
                <div className="space-y-3">
                  {directors.map((member, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{String(member.name)}</p>
                        <p className="text-sm text-gray-400">
                          {member.designation ? String(member.designation) : 'Director'}
                        </p>
                        {member.din && (
                          <p className="text-xs text-gray-500 mt-1">DIN: {String(member.din)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {member.shareholding_percentage && (
                          <p className="text-orange-400 font-medium">{String(member.shareholding_percentage)}%</p>
                        )}
                        {member.capital_contribution && (
                          <p className="text-sm text-gray-400">{formatCurrency(Number(member.capital_contribution))}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partners */}
            {partners && partners.length > 0 && (
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Partners</p>
                <div className="space-y-3">
                  {partners.map((member, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{String(member.name)}</p>
                        <p className="text-sm text-gray-400">
                          {member.is_managing_partner ? 'Managing Partner' : 'Partner'}
                        </p>
                        {member.dpin && (
                          <p className="text-xs text-gray-500 mt-1">DPIN: {String(member.dpin)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {member.profit_share_percentage && (
                          <p className="text-orange-400 font-medium">{String(member.profit_share_percentage)}%</p>
                        )}
                        {member.capital_contribution && (
                          <p className="text-sm text-gray-400">{formatCurrency(Number(member.capital_contribution))}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ongoing Projects */}
            {projects && projects.length > 0 && (
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Ongoing Projects</p>
                <div className="space-y-3">
                  {projects.map((project, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <p className="text-white font-medium">{String(project.name)}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                        {project.location && <span>{String(project.location)}</span>}
                        {project.units && <span>{String(project.units)} units</span>}
                        {project.completion_date && (
                          <span>
                            Completion: {new Date(String(project.completion_date)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 8: Documents */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-400" />
            <h3 className="font-medium text-white">Documents</h3>
            {data.documents && data.documents.length > 0 ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                {data.documents.length} uploaded
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">
                <AlertCircle className="w-3 h-3" /> None
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          {data.documents && data.documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.documents.map((doc) => (
                <div key={doc.id} className="p-3 bg-gray-800 rounded-lg flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{doc.document_name || doc.document_type}</p>
                    <p className="text-gray-500 text-xs">
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-IN') : ''}
                      {doc.verification_status && (
                        <span className={`ml-2 ${doc.verification_status === 'VERIFIED' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {doc.verification_status}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No documents uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
