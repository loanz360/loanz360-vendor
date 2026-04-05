'use client'

import React from 'react'
import {
  User, MapPin, FileCheck, GraduationCap, Briefcase
} from 'lucide-react'
import { EMPLOYMENT_FIELDS, CATEGORY_TO_EMPLOYMENT_KEY } from '@/lib/constants/employment-fields'
import type { EmploymentField } from '@/lib/constants/employment-fields'

interface AddressData {
  address_line1?: string
  address_line2?: string
  landmark?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
  country?: string
  residence_type?: string
  residence_since?: string
}

export interface IndividualEditData {
  // Section 1: Personal Details
  full_name?: string
  date_of_birth?: string
  gender?: string
  marital_status?: string
  father_name?: string
  mother_name?: string
  spouse_name?: string
  email?: string
  phone?: string
  alternate_phone?: string

  // Section 2: Address
  current_address?: AddressData
  permanent_address?: AddressData | null
  permanent_same_as_current?: boolean

  // Section 3: Identity Documents
  pan_number?: string
  aadhaar_number?: string
  pan_verified?: boolean
  aadhaar_verified?: boolean

  // Section 4: Education
  highest_qualification?: string
  qualification_stream?: string
  institution_name?: string
  year_of_passing?: number

  // Section 5: Category-specific income data
  income_profile_data?: Record<string, unknown>
  income_category_key?: string
}

interface IndividualSectionEditorProps {
  section: number
  data: IndividualEditData
  onUpdate: (updates: Partial<IndividualEditData>) => void
}

// ── Reusable Field Components ─────────────────────

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
        <SelectField
          label="Residence Type"
          value={addr.residence_type}
          onChange={(v) => update('residence_type', v)}
          options={[
            { value: 'OWNED', label: 'Owned' },
            { value: 'RENTED', label: 'Rented' },
            { value: 'FAMILY', label: 'Family / Parents' },
            { value: 'COMPANY_PROVIDED', label: 'Company Provided' },
            { value: 'PG_HOSTEL', label: 'PG / Hostel' },
          ]}
        />
      </div>
    </div>
  )
}

// ── Section 1: Personal Details ───────────────────

function PersonalDetailsEditor({ data, onUpdate }: { data: IndividualEditData; onUpdate: (u: Partial<IndividualEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-5 h-5 text-purple-400" />
        <h3 className="font-medium text-white">Personal Details</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Full Name *"
          value={data.full_name}
          onChange={(v) => onUpdate({ full_name: v })}
          placeholder="Full legal name"
        />
        <Field
          label="Date of Birth *"
          value={data.date_of_birth}
          onChange={(v) => onUpdate({ date_of_birth: v })}
          type="date"
        />
        <SelectField
          label="Gender *"
          value={data.gender}
          onChange={(v) => onUpdate({ gender: v })}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />
        <SelectField
          label="Marital Status *"
          value={data.marital_status}
          onChange={(v) => onUpdate({ marital_status: v })}
          options={[
            { value: 'SINGLE', label: 'Single' },
            { value: 'MARRIED', label: 'Married' },
            { value: 'DIVORCED', label: 'Divorced' },
            { value: 'WIDOWED', label: 'Widowed' },
          ]}
        />
        <Field
          label="Father's Name *"
          value={data.father_name}
          onChange={(v) => onUpdate({ father_name: v })}
          placeholder="Father's full name"
        />
        <Field
          label="Mother's Name"
          value={data.mother_name}
          onChange={(v) => onUpdate({ mother_name: v })}
          placeholder="Mother's full name"
        />
        {data.marital_status === 'MARRIED' && (
          <Field
            label="Spouse Name"
            value={data.spouse_name}
            onChange={(v) => onUpdate({ spouse_name: v })}
            placeholder="Spouse's full name"
          />
        )}
        <Field
          label="Email *"
          value={data.email}
          onChange={(v) => onUpdate({ email: v })}
          type="email"
          placeholder="email@example.com"
        />
        <Field
          label="Phone *"
          value={data.phone}
          onChange={(v) => onUpdate({ phone: v })}
          placeholder="10-digit mobile number"
        />
        <Field
          label="Alternate Phone"
          value={data.alternate_phone}
          onChange={(v) => onUpdate({ alternate_phone: v })}
          placeholder="Alternate mobile number"
        />
      </div>
    </div>
  )
}

// ── Section 2: Address Details ────────────────────

function AddressDetailsEditor({ data, onUpdate }: { data: IndividualEditData; onUpdate: (u: Partial<IndividualEditData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-5 h-5 text-blue-400" />
        <h3 className="font-medium text-white">Address Details</h3>
      </div>

      <AddressEditor
        label="Current Address"
        address={data.current_address}
        onChange={(addr) => onUpdate({ current_address: addr })}
      />

      <div className="flex items-center gap-3 py-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.permanent_same_as_current ?? false}
            onChange={(e) => onUpdate({ permanent_same_as_current: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
          />
          <span className="text-gray-300 text-sm">Permanent address same as current address</span>
        </label>
      </div>

      {!data.permanent_same_as_current && (
        <AddressEditor
          label="Permanent Address"
          address={data.permanent_address}
          onChange={(addr) => onUpdate({ permanent_address: addr })}
        />
      )}
    </div>
  )
}

// ── Section 3: Identity Documents ─────────────────

function IdentityEditor({ data, onUpdate }: { data: IndividualEditData; onUpdate: (u: Partial<IndividualEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileCheck className="w-5 h-5 text-green-400" />
        <h3 className="font-medium text-white">Identity Documents</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Field
            label="PAN Number *"
            value={data.pan_number}
            onChange={(v) => onUpdate({ pan_number: v.toUpperCase() })}
            placeholder="AAAPL1234C"
            disabled={data.pan_verified}
          />
          {data.pan_verified && (
            <p className="text-green-400 text-xs mt-1">Verified — cannot be changed</p>
          )}
        </div>
        <div>
          <Field
            label="Aadhaar Number *"
            value={data.aadhaar_number}
            onChange={(v) => onUpdate({ aadhaar_number: v })}
            placeholder="1234 5678 9012"
            disabled={data.aadhaar_verified}
          />
          {data.aadhaar_verified && (
            <p className="text-green-400 text-xs mt-1">Verified — cannot be changed</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section 4: Education ──────────────────────────

function EducationEditor({ data, onUpdate }: { data: IndividualEditData; onUpdate: (u: Partial<IndividualEditData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <GraduationCap className="w-5 h-5 text-amber-400" />
        <h3 className="font-medium text-white">Education</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Highest Qualification"
          value={data.highest_qualification}
          onChange={(v) => onUpdate({ highest_qualification: v })}
          options={[
            { value: 'BELOW_10TH', label: 'Below 10th' },
            { value: '10TH_PASS', label: '10th Pass' },
            { value: '12TH_PASS', label: '12th Pass' },
            { value: 'DIPLOMA', label: 'Diploma' },
            { value: 'GRADUATE', label: 'Graduate' },
            { value: 'POST_GRADUATE', label: 'Post Graduate' },
            { value: 'PROFESSIONAL', label: 'Professional Degree' },
            { value: 'PHD', label: 'Ph.D / Doctoral' },
          ]}
        />
        <Field
          label="Stream / Specialization"
          value={data.qualification_stream}
          onChange={(v) => onUpdate({ qualification_stream: v })}
          placeholder="e.g., Commerce, Engineering, Arts"
        />
        <Field
          label="Institution"
          value={data.institution_name}
          onChange={(v) => onUpdate({ institution_name: v })}
          placeholder="College / University name"
        />
        <Field
          label="Year of Passing"
          value={data.year_of_passing}
          onChange={(v) => onUpdate({ year_of_passing: v === '' ? undefined : parseInt(v) })}
          type="number"
          placeholder="e.g., 2020"
        />
      </div>
    </div>
  )
}

// ── Section 5: Category-Specific Income ───────────

function renderDynamicField(
  field: EmploymentField,
  value: unknown,
  onChange: (key: string, value: unknown) => void
) {
  const strVal = value != null ? String(value) : ''

  switch (field.type) {
    case 'select':
      return (
        <SelectField
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}`}
          value={strVal}
          onChange={(v) => onChange(field.key, v)}
          options={field.options || []}
          placeholder={field.placeholder}
        />
      )
    case 'textarea':
      return (
        <TextArea
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}`}
          value={strVal}
          onChange={(v) => onChange(field.key, v)}
          placeholder={field.placeholder}
        />
      )
    case 'currency':
    case 'number':
      return (
        <Field
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}${field.type === 'currency' ? ' (INR)' : ''}`}
          value={value != null ? Number(value) : ''}
          onChange={(v) => onChange(field.key, v === '' ? null : parseFloat(v))}
          type="number"
          placeholder={field.placeholder}
        />
      )
    case 'date':
      return (
        <Field
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}`}
          value={strVal}
          onChange={(v) => onChange(field.key, v)}
          type="date"
        />
      )
    case 'email':
      return (
        <Field
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}`}
          value={strVal}
          onChange={(v) => onChange(field.key, v)}
          type="email"
          placeholder={field.placeholder}
        />
      )
    default:
      return (
        <Field
          key={field.key}
          label={`${field.label}${field.required ? ' *' : ''}`}
          value={strVal}
          onChange={(v) => onChange(field.key, v)}
          placeholder={field.placeholder}
        />
      )
  }
}

function IncomeProfileEditor({ data, onUpdate }: { data: IndividualEditData; onUpdate: (u: Partial<IndividualEditData>) => void }) {
  const ipd = data.income_profile_data || {}
  const categoryKey = data.income_category_key ||
    (ipd.income_profile_key as string) || (ipd.income_category_key as string) || ''

  // Resolve to employment fields key
  const employmentKey = CATEGORY_TO_EMPLOYMENT_KEY[categoryKey] || categoryKey
  const categoryFields = EMPLOYMENT_FIELDS[employmentKey]

  const handleFieldChange = (key: string, value: unknown) => {
    onUpdate({
      income_profile_data: {
        ...ipd,
        [key]: value
      }
    })
  }

  if (!categoryFields) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="w-5 h-5 text-cyan-400" />
          <h3 className="font-medium text-white">Income Details</h3>
        </div>
        <p className="text-gray-400 text-sm">
          No specific fields defined for this category ({categoryKey || 'unknown'}).
          Use the general fields below to add income details.
        </p>
        {/* Fallback: render existing ipd keys as editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(ipd).filter(([k]) =>
            !['income_profile_id', 'income_profile_key', 'income_profile_name', 'income_category_key', 'income_category_id', 'created_at', 'updated_at'].includes(k) &&
            !k.endsWith('_url') && !k.endsWith('_urls')
          ).map(([key, val]) => (
            <Field
              key={key}
              label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              value={val != null ? String(val) : ''}
              onChange={(v) => handleFieldChange(key, v)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Briefcase className="w-5 h-5 text-cyan-400" />
        <h3 className="font-medium text-white">{categoryFields.categoryName} Details</h3>
      </div>
      {categoryFields.fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categoryFields.fields.map((field) =>
            renderDynamicField(field, ipd[field.key], handleFieldChange)
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────

export default function IndividualSectionEditor({ section, data, onUpdate }: IndividualSectionEditorProps) {
  switch (section) {
    case 1:
      return <PersonalDetailsEditor data={data} onUpdate={onUpdate} />
    case 2:
      return <AddressDetailsEditor data={data} onUpdate={onUpdate} />
    case 3:
      return <IdentityEditor data={data} onUpdate={onUpdate} />
    case 4:
      return <EducationEditor data={data} onUpdate={onUpdate} />
    case 5:
      return <IncomeProfileEditor data={data} onUpdate={onUpdate} />
    default:
      return (
        <div className="text-gray-400 text-center py-8">
          This section cannot be edited inline. Use the profile wizard for advanced changes.
        </div>
      )
  }
}
