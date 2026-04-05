'use client'

import React from 'react'
import {
  Building2, Phone, Hash, MapPin, TrendingUp, Users
} from 'lucide-react'

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

export interface EntityEditData {
  // Section 1: Business Info
  legal_name?: string
  trading_name?: string
  description?: string
  entity_type?: string
  entity_type_name?: string
  date_of_establishment?: string
  incorporation_date?: string
  industry_category?: string
  business_nature?: string
  msme_category?: string
  // Section 2: Contact
  email?: string
  phone?: string
  alternate_phone?: string
  website?: string
  // Section 3: Registration
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
  // Section 4: Address
  registered_address?: AddressData
  business_address_same_as_registered?: boolean
  business_address?: AddressData | null
  // Section 5: Financial
  turnover_current_year?: number
  turnover_previous_year?: number
  profit_current_year?: number
  profit_previous_year?: number
  total_assets?: number
  total_liabilities?: number
  net_worth?: number
  // Section 6: Operations
  number_of_employees?: number
  number_of_branches?: number
  major_customers?: string
  major_suppliers?: string
}

interface EntitySectionEditorProps {
  section: number
  data: EntityEditData
  onUpdate: (updates: Partial<EntityEditData>) => void
}

// Reusable input component
function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  className,
}: {
  label: string
  value: string | number | undefined
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-gray-400 text-xs mb-1.5">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-600"
      />
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-gray-400 text-xs mb-1.5">{label}</label>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors resize-none placeholder:text-gray-600"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1.5">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-colors"
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function AddressEditor({
  label,
  address,
  onChange,
}: {
  label: string
  address: AddressData | undefined | null
  onChange: (addr: AddressData) => void
}) {
  const addr = address || {}
  const update = (key: keyof AddressData, value: string) => {
    onChange({ ...addr, [key]: value })
  }

  return (
    <div className="space-y-3">
      <p className="text-gray-300 text-sm font-medium">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Address Line 1"
          value={addr.address_line1}
          onChange={(v) => update('address_line1', v)}
          placeholder="Building/House No., Street"
        />
        <Field
          label="Address Line 2"
          value={addr.address_line2}
          onChange={(v) => update('address_line2', v)}
          placeholder="Area/Locality"
        />
        <Field
          label="Landmark"
          value={addr.landmark}
          onChange={(v) => update('landmark', v)}
          placeholder="Nearby landmark"
        />
        <Field
          label="City"
          value={addr.city}
          onChange={(v) => update('city', v)}
          placeholder="City"
        />
        <Field
          label="District"
          value={addr.district}
          onChange={(v) => update('district', v)}
          placeholder="District"
        />
        <Field
          label="State"
          value={addr.state}
          onChange={(v) => update('state', v)}
          placeholder="State"
        />
        <Field
          label="Pincode"
          value={addr.pincode}
          onChange={(v) => update('pincode', v)}
          placeholder="6-digit pincode"
        />
        <Field
          label="Country"
          value={addr.country || 'India'}
          onChange={(v) => update('country', v)}
        />
      </div>
    </div>
  )
}

// Section 1: Business Information
function BusinessInfoEditor({ data, onUpdate }: { data: EntityEditData; onUpdate: (u: Partial<EntityEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-5 h-5 text-purple-400" />
        <h3 className="font-medium text-white">Business Information</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Legal Name *"
          value={data.legal_name}
          onChange={(v) => onUpdate({ legal_name: v })}
          placeholder="Full legal name of the entity"
        />
        <Field
          label="Trading Name"
          value={data.trading_name}
          onChange={(v) => onUpdate({ trading_name: v })}
          placeholder="Trading / brand name"
        />
        <Field
          label="Entity Type"
          value={data.entity_type_name || data.entity_type || ''}
          onChange={() => {}}
          disabled
        />
        <Field
          label="Industry Category"
          value={data.industry_category}
          onChange={(v) => onUpdate({ industry_category: v })}
          placeholder="e.g., Information Technology"
        />
        <Field
          label="Business Nature"
          value={data.business_nature}
          onChange={(v) => onUpdate({ business_nature: v })}
          placeholder="e.g., Software Development"
        />
        <SelectField
          label="MSME Category"
          value={data.msme_category}
          onChange={(v) => onUpdate({ msme_category: v })}
          options={[
            { value: 'MICRO', label: 'Micro' },
            { value: 'SMALL', label: 'Small' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'LARGE', label: 'Large' },
          ]}
          placeholder="Select MSME category"
        />
        <Field
          label="Date of Establishment"
          value={data.date_of_establishment}
          onChange={(v) => onUpdate({ date_of_establishment: v })}
          type="date"
        />
        <Field
          label="Date of Incorporation"
          value={data.incorporation_date}
          onChange={(v) => onUpdate({ incorporation_date: v })}
          type="date"
        />
        <TextArea
          label="Description"
          value={data.description}
          onChange={(v) => onUpdate({ description: v })}
          placeholder="Brief description of the business"
        />
      </div>
    </div>
  )
}

// Section 2: Contact Details
function ContactEditor({ data, onUpdate }: { data: EntityEditData; onUpdate: (u: Partial<EntityEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Phone className="w-5 h-5 text-blue-400" />
        <h3 className="font-medium text-white">Contact Details</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Email *"
          value={data.email}
          onChange={(v) => onUpdate({ email: v })}
          type="email"
          placeholder="official@company.com"
        />
        <Field
          label="Phone *"
          value={data.phone}
          onChange={(v) => onUpdate({ phone: v })}
          placeholder="080-12345678"
        />
        <Field
          label="Alternate Phone"
          value={data.alternate_phone}
          onChange={(v) => onUpdate({ alternate_phone: v })}
          placeholder="Alternate phone number"
        />
        <Field
          label="Website"
          value={data.website}
          onChange={(v) => onUpdate({ website: v })}
          placeholder="www.company.com"
        />
      </div>
    </div>
  )
}

// Section 3: Registration & KYC
function RegistrationEditor({ data, onUpdate }: { data: EntityEditData; onUpdate: (u: Partial<EntityEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="w-5 h-5 text-green-400" />
        <h3 className="font-medium text-white">Registration & KYC</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="PAN Number *"
          value={data.pan_number}
          onChange={(v) => onUpdate({ pan_number: v.toUpperCase() })}
          placeholder="AAAPL1234C"
        />
        <Field
          label="GSTIN"
          value={data.gst_number}
          onChange={(v) => onUpdate({ gst_number: v.toUpperCase() })}
          placeholder="29AAAPL1234C1Z5"
        />
        <SelectField
          label="GST Status"
          value={data.gst_status}
          onChange={(v) => onUpdate({ gst_status: v })}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'CANCELLED', label: 'Cancelled' },
            { value: 'SUSPENDED', label: 'Suspended' },
          ]}
          placeholder="Select GST status"
        />
        <Field
          label="CIN"
          value={data.cin}
          onChange={(v) => onUpdate({ cin: v.toUpperCase() })}
          placeholder="Company Identification Number"
        />
        <Field
          label="LLPIN"
          value={data.llpin}
          onChange={(v) => onUpdate({ llpin: v.toUpperCase() })}
          placeholder="LLP Identification Number"
        />
        <Field
          label="Registration Number"
          value={data.registration_number}
          onChange={(v) => onUpdate({ registration_number: v })}
          placeholder="Firm/Trust registration number"
        />
        <Field
          label="Registration Authority"
          value={data.registration_authority}
          onChange={(v) => onUpdate({ registration_authority: v })}
          placeholder="Registering authority"
        />
        <Field
          label="TAN Number"
          value={data.tan_number}
          onChange={(v) => onUpdate({ tan_number: v.toUpperCase() })}
          placeholder="Tax Deduction Account Number"
        />
        <Field
          label="Udyam Registration"
          value={data.udyam_registration_number}
          onChange={(v) => onUpdate({ udyam_registration_number: v.toUpperCase() })}
          placeholder="UDYAM-XX-XX-XXXXXXX"
        />
        <Field
          label="Shop & Establishment No."
          value={data.shop_establishment_number}
          onChange={(v) => onUpdate({ shop_establishment_number: v })}
          placeholder="Shop establishment number"
        />
      </div>
    </div>
  )
}

// Section 4: Address Details
function AddressDetailsEditor({ data, onUpdate }: { data: EntityEditData; onUpdate: (u: Partial<EntityEditData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-5 h-5 text-blue-400" />
        <h3 className="font-medium text-white">Address Details</h3>
      </div>

      <AddressEditor
        label="Registered Address"
        address={data.registered_address}
        onChange={(addr) => onUpdate({ registered_address: addr })}
      />

      <div className="flex items-center gap-3 py-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.business_address_same_as_registered ?? true}
            onChange={(e) => onUpdate({ business_address_same_as_registered: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
          />
          <span className="text-gray-300 text-sm">Business address same as registered address</span>
        </label>
      </div>

      {!data.business_address_same_as_registered && (
        <AddressEditor
          label="Business / Operating Address"
          address={data.business_address}
          onChange={(addr) => onUpdate({ business_address: addr })}
        />
      )}
    </div>
  )
}

// Section 5: Financial Information
function FinancialEditor({ data, onUpdate }: { data: EntityEditData; onUpdate: (u: Partial<EntityEditData>) => void }) {
  const handleNumber = (key: keyof EntityEditData, value: string) => {
    const num = value === '' ? undefined : parseFloat(value)
    onUpdate({ [key]: num } as Partial<EntityEditData>)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-cyan-400" />
        <h3 className="font-medium text-white">Financial Information</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Current Year Turnover (INR)"
          value={data.turnover_current_year}
          onChange={(v) => handleNumber('turnover_current_year', v)}
          type="number"
          placeholder="Annual turnover"
        />
        <Field
          label="Previous Year Turnover (INR)"
          value={data.turnover_previous_year}
          onChange={(v) => handleNumber('turnover_previous_year', v)}
          type="number"
          placeholder="Last year turnover"
        />
        <Field
          label="Current Year Profit (INR)"
          value={data.profit_current_year}
          onChange={(v) => handleNumber('profit_current_year', v)}
          type="number"
          placeholder="Annual profit"
        />
        <Field
          label="Previous Year Profit (INR)"
          value={data.profit_previous_year}
          onChange={(v) => handleNumber('profit_previous_year', v)}
          type="number"
          placeholder="Last year profit"
        />
        <Field
          label="Total Assets (INR)"
          value={data.total_assets}
          onChange={(v) => handleNumber('total_assets', v)}
          type="number"
          placeholder="Total assets"
        />
        <Field
          label="Total Liabilities (INR)"
          value={data.total_liabilities}
          onChange={(v) => handleNumber('total_liabilities', v)}
          type="number"
          placeholder="Total liabilities"
        />
        <Field
          label="Net Worth (INR)"
          value={data.net_worth}
          onChange={(v) => handleNumber('net_worth', v)}
          type="number"
          placeholder="Net worth"
        />
      </div>
    </div>
  )
}

// Section 6: Operations
function OperationsEditor({ data, onUpdate }: { data: EntityEditData; onUpdate: (u: Partial<EntityEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-amber-400" />
        <h3 className="font-medium text-white">Operations</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Number of Employees"
          value={data.number_of_employees}
          onChange={(v) => onUpdate({ number_of_employees: v === '' ? undefined : parseInt(v) })}
          type="number"
          placeholder="Total employee count"
        />
        <Field
          label="Number of Branches"
          value={data.number_of_branches}
          onChange={(v) => onUpdate({ number_of_branches: v === '' ? undefined : parseInt(v) })}
          type="number"
          placeholder="Number of branches/offices"
        />
        <TextArea
          label="Major Customers"
          value={data.major_customers}
          onChange={(v) => onUpdate({ major_customers: v })}
          placeholder="List major customers (comma separated)"
          rows={2}
        />
        <TextArea
          label="Major Suppliers"
          value={data.major_suppliers}
          onChange={(v) => onUpdate({ major_suppliers: v })}
          placeholder="List major suppliers (comma separated)"
          rows={2}
        />
      </div>
    </div>
  )
}

export default function EntitySectionEditor({ section, data, onUpdate }: EntitySectionEditorProps) {
  switch (section) {
    case 1:
      return <BusinessInfoEditor data={data} onUpdate={onUpdate} />
    case 2:
      return <ContactEditor data={data} onUpdate={onUpdate} />
    case 3:
      return <RegistrationEditor data={data} onUpdate={onUpdate} />
    case 4:
      return <AddressDetailsEditor data={data} onUpdate={onUpdate} />
    case 5:
      return <FinancialEditor data={data} onUpdate={onUpdate} />
    case 6:
      return <OperationsEditor data={data} onUpdate={onUpdate} />
    default:
      return (
        <div className="text-gray-400 text-center py-8">
          This section cannot be edited inline. Use the entity profile wizard for advanced changes.
        </div>
      )
  }
}
