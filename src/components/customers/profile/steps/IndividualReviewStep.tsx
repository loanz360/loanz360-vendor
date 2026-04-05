'use client'

import React from 'react'
import {
  CheckCircle,
  User,
  MapPin,
  FileCheck,
  Edit,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Fingerprint,
  Mail,
  Phone,
  Calendar,
  Home,
  Briefcase,
  GraduationCap,
  FileText,
  IndianRupee,
  Stethoscope,
  Wheat,
  Building,
  Banknote,
  ScrollText,
  Globe,
  Heart,
  Zap,
  Factory,
  Store,
  Wrench,
  Rocket,
  Landmark,
  ShoppingCart,
  Palette,
  UserCheck,
  Library,
  Award,
  Shield
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
  residence_type?: string
  residence_since?: string
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

interface IndividualProfileData {
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
  pan_number?: string
  aadhaar_number?: string
  pan_verified?: boolean
  aadhaar_verified?: boolean
  bank_verified?: boolean
  income_category_name?: string
  profile_type_name?: string
  current_address?: AddressData
  permanent_address?: AddressData | null
  permanent_same_as_current?: boolean
  highest_qualification?: string
  qualification_stream?: string
  institution_name?: string
  year_of_passing?: number
  employer_name?: string
  designation?: string
  employment_type?: string
  monthly_income?: number
  net_monthly_income?: number
  work_experience_years?: number
  income_profile_data?: Record<string, unknown>
  profile_photo_url?: string
  documents?: ProfileDocument[]
}

interface IndividualReviewStepProps {
  data: IndividualProfileData
  onEdit: (section: number) => void
}

// ── Helpers ──────────────────────────────────────────

function fmt(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function cur(amount?: number | string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (n == null || isNaN(n)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function label(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/\b(url|urls|id)\b/gi, match => match.toUpperCase())
    .trim()
}

function maskAadhaar(aadhaar?: string) {
  if (!aadhaar) return '-'
  const clean = aadhaar.replace(/\s/g, '')
  return `XXXX XXXX ${clean.slice(-4)}`
}

function genderDisplay(g?: string) {
  return { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' }[g || ''] || g || '-'
}

function maritalDisplay(s?: string) {
  return { SINGLE: 'Single', MARRIED: 'Married', DIVORCED: 'Divorced', WIDOWED: 'Widowed' }[s || ''] || s || '-'
}

function addressStr(addr?: AddressData) {
  if (!addr) return '-'
  return [addr.address_line1, addr.address_line2, addr.landmark, addr.city, addr.district, addr.state, addr.pincode].filter(Boolean).join(', ') || '-'
}

// Check if a value looks like a currency amount based on key name
function isCurrencyKey(key: string) {
  return /salary|income|turnover|profit|receipts|expenses|worth|pension|rent|contribution|capital|amount|limit|outstanding|assets|liabilities|deduction|hra|allowance|pay|bonus/i.test(key)
}

// Check if a value looks like a date
function isDateKey(key: string) {
  return /date|since|expiry|retirement|joining|passing/i.test(key) && !/update/i.test(key)
}

// Keys to skip (document URLs, internal IDs, metadata)
const SKIP_KEYS = new Set([
  'salary_slips_urls', 'form_16_url', 'bank_statements_urls', 'employment_letter_url',
  'professional_certificate_url', 'registration_certificate_url', 'itr_url', 'gst_certificate_url',
  'land_documents_url', 'lease_deed_url', 'kcc_passbook_url', 'pension_certificate_url',
  'ppo_url', 'property_documents_url', 'rent_agreement_url', 'practice_license_url',
  'income_profile_id', 'income_category_id', 'income_category_key',
  'created_at', 'updated_at'
])

// ── Section Component ────────────────────────────────

function Section({
  icon: Icon,
  iconColor,
  title,
  badge,
  editSection,
  onEdit,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  badge?: 'complete' | 'incomplete' | string
  editSection?: number
  onEdit?: (s: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <h3 className="font-medium text-white">{title}</h3>
          {badge === 'complete' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
              <CheckCircle className="w-3 h-3" /> Complete
            </span>
          )}
          {badge === 'incomplete' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded">
              <AlertCircle className="w-3 h-3" /> Incomplete
            </span>
          )}
          {badge && badge !== 'complete' && badge !== 'incomplete' && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
              {badge}
            </span>
          )}
        </div>
        {editSection != null && onEdit && (
          <button
            onClick={() => onEdit(editSection)}
            className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Field rendering helpers ──────────────────────────

function Field({ lbl, val }: { lbl: string; val: string | number | undefined | null }) {
  if (val == null || val === '') return null
  return (
    <div>
      <p className="text-gray-500 text-xs mb-1">{lbl}</p>
      <p className="text-white">{String(val)}</p>
    </div>
  )
}

function CurrencyField({ lbl, val }: { lbl: string; val: number | string | undefined | null }) {
  if (val == null || val === '') return null
  return (
    <div>
      <p className="text-gray-500 text-xs mb-1">{lbl}</p>
      <p className="text-white flex items-center gap-2">
        <IndianRupee className="w-4 h-4 text-gray-500" />
        {cur(typeof val === 'string' ? parseFloat(val) : val)}
      </p>
    </div>
  )
}

function DateField({ lbl, val }: { lbl: string; val: string | undefined | null }) {
  if (!val) return null
  return (
    <div>
      <p className="text-gray-500 text-xs mb-1">{lbl}</p>
      <p className="text-white flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" />
        {fmt(val)}
      </p>
    </div>
  )
}

// Smart field renderer — detects type from key name
function SmartField({ k, v }: { k: string; v: unknown }) {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return <Field lbl={label(k)} val={v ? 'Yes' : 'No'} />
  if (typeof v === 'number') return isCurrencyKey(k) ? <CurrencyField lbl={label(k)} val={v} /> : <Field lbl={label(k)} val={String(v)} />
  if (typeof v === 'string') {
    if (isCurrencyKey(k) && !isNaN(parseFloat(v))) return <CurrencyField lbl={label(k)} val={v} />
    if (isDateKey(k)) return <DateField lbl={label(k)} val={v} />
    return <Field lbl={label(k)} val={v} />
  }
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return <Field lbl={label(k)} val={v.join(', ')} />
  return null
}

// ── Main Component ───────────────────────────────────

export default function IndividualReviewStep({ data, onEdit }: IndividualReviewStepProps) {
  const ipd = data.income_profile_data || {}
  const s = (key: string) => ipd[key] != null ? String(ipd[key]) : undefined
  const n = (key: string) => ipd[key] != null ? Number(ipd[key]) : undefined

  // Completeness checks
  const isPersonalComplete = !!(data.full_name && data.date_of_birth && data.gender && data.email && data.phone)
  const isAddressComplete = !!(data.current_address?.address_line1 && data.current_address?.city && data.current_address?.state && data.current_address?.pincode)
  const isKYCComplete = !!(data.pan_number && data.aadhaar_number)

  // Category detection from income_profile_data keys
  const profileKey = s('income_profile_key') || s('income_category_key') || ''
  const isSalaried = /SALARIED|GOVT|PSU|BANK|PRIVATE|MNC|SME|IT_TECH|DEFENCE|PARAMILITARY|CONTRACT|PROBATION/i.test(profileKey) ||
    !!(ipd.company_name || ipd.gross_monthly_salary || ipd.employee_id)
  const isProfessional = /PROFESSIONAL|SEP|DOCTOR|DENTIST|CA_CS_CMA|ARCHITECT|LAWYER|ENGINEER|PHARMACIST/i.test(profileKey) ||
    !!(ipd.registration_number || ipd.years_of_practice || ipd.practice_name)
  const isAgriculture = /AGRI/i.test(profileKey) ||
    !!(ipd.total_land_holding_acres || ipd.primary_crop || ipd.farming_type)
  const isPensioner = /PENSION/i.test(profileKey) ||
    !!(ipd.ppo_number || ipd.monthly_pension || ipd.pension_type)
  const isRental = /RENTAL/i.test(profileKey) ||
    !!(ipd.total_properties || ipd.total_monthly_rent || ipd.property_details)

  // New specific categories (before generic business catch-all)
  const isNRI = /^NRI/i.test(profileKey) || !!(ipd.country_of_residence || ipd.nri_type || ipd.nre_nro_account)
  const isStudent = /STUDENT/i.test(profileKey) || !!(ipd.course_name || ipd.course_type || ipd.institution_name && ipd.course_fee_annual)
  const isRetired = /^RETIRED/i.test(profileKey) || !!(ipd.retirement_date && !ipd.pension_type && !ipd.ppo_number)
  const isWomen = /WOMEN/i.test(profileKey) || !!(ipd.women_category || ipd.shg_name)
  const isGigEconomy = /GIG|FREELANCER/i.test(profileKey) || !!(ipd.gig_type || ipd.platform_name)
  const isManufacturer = /^MANUFACTURER/i.test(profileKey) || !!(ipd.factory_address || ipd.manufacturing_scale || ipd.annual_production_value)
  const isTrader = /^TRADER/i.test(profileKey) || !!(ipd.trade_type || ipd.fssai_number || ipd.drug_license)
  const isService = /^SERVICE/i.test(profileKey) && !isProfessional || !!(ipd.service_type && ipd.annual_revenue)
  const isStartup = /STARTUP/i.test(profileKey) || !!(ipd.dpiit_number || ipd.startup_name || ipd.funding_stage)
  const isRealEstate = /REAL.?ESTATE/i.test(profileKey) || !!(ipd.rera_number || ipd.projects_completed != null && ipd.current_projects != null)
  const isMicroEnterprise = /MICRO/i.test(profileKey) || !!(ipd.svanidhi_id || ipd.daily_income)
  const isArtisan = /ARTISAN/i.test(profileKey) || !!(ipd.artisan_card_number || ipd.craft_type)
  const isAgent = /^AGENT/i.test(profileKey) || !!(ipd.agency_type || ipd.principal_companies)
  const isInstitutional = /INST/i.test(profileKey) || !!(ipd.institution_type && ipd.number_of_beneficiaries != null)
  const isSpecial = /SPECIAL/i.test(profileKey) || !!(ipd.special_category || ipd.certificate_number)
  const isIndividualBasic = /^INDIVIDUAL$/i.test(profileKey) || !!(ipd.source_of_funds && !isSalaried && !isProfessional)

  // Generic business catch-all — only if no specific category matched
  const specificCategories = isSalaried || isProfessional || isAgriculture || isPensioner || isRental ||
    isNRI || isStudent || isRetired || isWomen || isGigEconomy || isManufacturer || isTrader || isService ||
    isStartup || isRealEstate || isMicroEnterprise || isArtisan || isAgent || isInstitutional || isSpecial || isIndividualBasic
  const isBusiness = !specificCategories && (
    /BUSINESS|MSME/i.test(profileKey) ||
    !!(ipd.business_nature || ipd.gross_annual_turnover || ipd.years_in_business)
  )

  const hasEmployment = specificCategories || isBusiness ||
    !!(data.employer_name || data.designation || data.monthly_income || Object.keys(ipd).length > 0)
  const hasEducation = !!(data.highest_qualification)

  // Track which ipd keys we've rendered explicitly
  const renderedKeys = new Set<string>([
    'income_profile_id', 'income_profile_key', 'income_profile_name', 'income_category_key', 'income_category_id'
  ])
  const mark = (...keys: string[]) => keys.forEach(k => renderedKeys.add(k))

  return (
    <div className="space-y-6">
      {/* ── 1. Personal Details ── */}
      <Section icon={User} iconColor="text-purple-400" title="Personal Details"
        badge={isPersonalComplete ? 'complete' : 'incomplete'} editSection={1} onEdit={onEdit}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field lbl="Full Name" val={data.full_name || '-'} />
          <DateField lbl="Date of Birth" val={data.date_of_birth} />
          <Field lbl="Gender" val={genderDisplay(data.gender)} />
          <Field lbl="Marital Status" val={maritalDisplay(data.marital_status)} />
          <Field lbl="Father's Name" val={data.father_name || '-'} />
          <Field lbl="Mother's Name" val={data.mother_name || '-'} />
          {data.spouse_name && <Field lbl="Spouse Name" val={data.spouse_name} />}
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
              {data.alternate_phone && <span className="text-gray-500 text-sm"> / {data.alternate_phone}</span>}
            </p>
          </div>
          {data.income_category_name && <Field lbl="Income Category" val={data.income_category_name} />}
          {data.profile_type_name && <Field lbl="Profile Type" val={data.profile_type_name} />}
          {s('income_profile_name') && s('income_profile_name') !== data.profile_type_name && (
            <Field lbl="Sub-Profile" val={s('income_profile_name')} />
          )}
        </div>
      </Section>

      {/* ── 2. Address Details ── */}
      <Section icon={MapPin} iconColor="text-blue-400" title="Address Details"
        badge={isAddressComplete ? 'complete' : 'incomplete'} editSection={2} onEdit={onEdit}>
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-blue-400" />
              <p className="text-gray-400 text-sm font-medium">Current Address</p>
            </div>
            <p className="text-white text-sm pl-6">{addressStr(data.current_address)}</p>
            {data.current_address?.residence_type && (
              <p className="text-gray-500 text-xs pl-6 mt-1">
                Residence: {data.current_address.residence_type.replace(/_/g, ' ')}
                {data.current_address.residence_since && ` since ${fmt(data.current_address.residence_since)}`}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-green-400" />
              <p className="text-gray-400 text-sm font-medium">Permanent Address</p>
              {data.permanent_same_as_current && <span className="text-blue-400 text-xs">(Same as current)</span>}
            </div>
            {data.permanent_same_as_current ? (
              <p className="text-gray-400 text-sm pl-6 italic">Same as current address</p>
            ) : (
              <p className="text-white text-sm pl-6">{addressStr(data.permanent_address)}</p>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3. Identity Documents ── */}
      <Section icon={FileCheck} iconColor="text-green-400" title="Identity Documents"
        badge={isKYCComplete ? 'complete' : 'incomplete'} editSection={3} onEdit={onEdit}>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <p className="text-gray-400 text-sm">PAN Card</p>
              </div>
              {data.pan_verified ? (
                <span className="flex items-center gap-1 text-green-400 text-xs"><ShieldCheck className="w-3 h-3" /> Verified</span>
              ) : data.pan_number ? (
                <span className="flex items-center gap-1 text-yellow-400 text-xs"><AlertCircle className="w-3 h-3" /> Not Verified</span>
              ) : null}
            </div>
            <p className="text-white font-mono">{data.pan_number || '-'}</p>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-purple-400" />
                <p className="text-gray-400 text-sm">Aadhaar Card</p>
              </div>
              {data.aadhaar_verified ? (
                <span className="flex items-center gap-1 text-green-400 text-xs"><ShieldCheck className="w-3 h-3" /> Verified</span>
              ) : data.aadhaar_number ? (
                <span className="flex items-center gap-1 text-yellow-400 text-xs"><AlertCircle className="w-3 h-3" /> Not Verified</span>
              ) : null}
            </div>
            <p className="text-white font-mono">{maskAadhaar(data.aadhaar_number)}</p>
          </div>
        </div>
      </Section>

      {/* ── 4. Education ── */}
      {hasEducation && (
        <Section icon={GraduationCap} iconColor="text-amber-400" title="Education"
          badge="complete" editSection={4} onEdit={onEdit}>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field lbl="Highest Qualification" val={data.highest_qualification?.replace(/_/g, ' ')} />
            {data.qualification_stream && <Field lbl="Stream" val={data.qualification_stream} />}
            {data.institution_name && <Field lbl="Institution" val={data.institution_name} />}
            {data.year_of_passing && <Field lbl="Year of Passing" val={data.year_of_passing} />}
          </div>
        </Section>
      )}

      {/* ── 5. SALARIED — Employment & Salary ── */}
      {isSalaried && (() => {
        mark('company_name', 'designation', 'department', 'employee_id', 'employment_type',
          'date_of_joining', 'years_in_current_company', 'total_experience', 'total_experience_years',
          'gross_monthly_salary', 'net_monthly_salary', 'basic_salary', 'hra', 'special_allowance',
          'variable_pay_annual', 'bonus_annual', 'pf_deduction', 'professional_tax', 'tds_deduction',
          'has_form_16', 'has_professional_tax', 'has_pf', 'has_esi',
          'office_address_line1', 'office_address_line_1', 'office_address_line2', 'office_address_line_2',
          'office_city', 'office_state', 'office_pincode', 'office_phone', 'hr_contact',
          'accommodation_type', 'employer_type', 'employer_category',
          'experience_current_company')
        return (
          <Section icon={Briefcase} iconColor="text-cyan-400" title="Employment & Salary"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field lbl="Employer / Company" val={data.employer_name || s('company_name')} />
              <Field lbl="Designation" val={data.designation || s('designation')} />
              {s('department') && <Field lbl="Department" val={s('department')} />}
              {s('employee_id') && <Field lbl="Employee ID" val={s('employee_id')} />}
              <Field lbl="Employment Type" val={data.employment_type || s('employment_type')} />
              {s('employer_type') && <Field lbl="Employer Type" val={s('employer_type')} />}
              {s('employer_category') && <Field lbl="Employer Category" val={s('employer_category')} />}
              <DateField lbl="Date of Joining" val={s('date_of_joining')} />
              {(data.work_experience_years != null || n('total_experience') != null || n('total_experience_years') != null) && (
                <Field lbl="Total Experience" val={`${data.work_experience_years ?? n('total_experience') ?? n('total_experience_years')} years`} />
              )}
              {(n('years_in_current_company') != null || n('experience_current_company') != null) && (
                <Field lbl="Years in Current Company" val={`${n('years_in_current_company') ?? n('experience_current_company')} years`} />
              )}
            </div>

            {/* Salary breakdown */}
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CurrencyField lbl="Gross Monthly Salary" val={data.monthly_income ?? n('gross_monthly_salary')} />
              <CurrencyField lbl="Net Monthly Salary" val={data.net_monthly_income ?? n('net_monthly_salary')} />
              {n('basic_salary') != null && <CurrencyField lbl="Basic Salary" val={n('basic_salary')} />}
              {n('hra') != null && <CurrencyField lbl="HRA" val={n('hra')} />}
              {n('special_allowance') != null && <CurrencyField lbl="Special Allowance" val={n('special_allowance')} />}
              {n('variable_pay_annual') != null && <CurrencyField lbl="Variable Pay (Annual)" val={n('variable_pay_annual')} />}
              {n('bonus_annual') != null && <CurrencyField lbl="Bonus (Annual)" val={n('bonus_annual')} />}
              {n('pf_deduction') != null && <CurrencyField lbl="PF Deduction" val={n('pf_deduction')} />}
              {n('professional_tax') != null && <CurrencyField lbl="Professional Tax" val={n('professional_tax')} />}
              {n('tds_deduction') != null && <CurrencyField lbl="TDS Deduction" val={n('tds_deduction')} />}
              {s('accommodation_type') && <Field lbl="Accommodation Type" val={s('accommodation_type')?.replace(/_/g, ' ')} />}
            </div>

            {/* Office Address */}
            {(ipd.office_address_line1 || ipd.office_address_line_1) && (
              <div className="p-4 pt-0">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-cyan-400" />
                  <p className="text-gray-400 text-sm font-medium">Office Address</p>
                </div>
                <p className="text-white text-sm pl-6">
                  {[ipd.office_address_line1 || ipd.office_address_line_1, ipd.office_address_line2 || ipd.office_address_line_2, ipd.office_city, ipd.office_state, ipd.office_pincode].filter(Boolean).join(', ')}
                </p>
                {s('office_phone') && <p className="text-gray-500 text-xs pl-6 mt-1">Phone: {s('office_phone')}</p>}
                {s('hr_contact') && <p className="text-gray-500 text-xs pl-6 mt-1">HR Contact: {s('hr_contact')}</p>}
              </div>
            )}

            {/* Deductions badges */}
            {(ipd.has_form_16 || ipd.has_professional_tax || ipd.has_pf || ipd.has_esi) && (
              <div className="p-4 pt-0">
                <p className="text-gray-400 text-sm font-medium mb-2">Deductions & Compliance</p>
                <div className="flex flex-wrap gap-2">
                  {ipd.has_form_16 && <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Form 16</span>}
                  {ipd.has_professional_tax && <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Professional Tax</span>}
                  {ipd.has_pf && <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> PF</span>}
                  {ipd.has_esi && <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> ESI</span>}
                </div>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5b. PROFESSIONAL — Registration & Practice ── */}
      {isProfessional && (() => {
        mark('profession_type', 'professional_qualification', 'registration_number',
          'registration_authority', 'registration_date', 'registration_expiry',
          'years_of_practice', 'specialization',
          'practice_name', 'practice_type', 'practice_address', 'practice_city',
          'practice_state', 'practice_pincode', 'premises_type', 'number_of_employees',
          'gross_annual_receipts', 'professional_expenses', 'net_annual_income')
        return (
          <Section icon={Stethoscope} iconColor="text-cyan-400" title="Professional Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('profession_type') && <Field lbl="Profession" val={s('profession_type')?.replace(/_/g, ' ')} />}
              {s('professional_qualification') && <Field lbl="Qualification" val={s('professional_qualification')} />}
              {s('specialization') && <Field lbl="Specialization" val={s('specialization')} />}
              {s('registration_number') && <Field lbl="Registration Number" val={s('registration_number')} />}
              {s('registration_authority') && <Field lbl="Registered With" val={s('registration_authority')} />}
              <DateField lbl="Registration Date" val={s('registration_date')} />
              <DateField lbl="Registration Expiry" val={s('registration_expiry')} />
              {(data.work_experience_years != null || n('years_of_practice') != null) && (
                <Field lbl="Years of Practice" val={`${data.work_experience_years ?? n('years_of_practice')} years`} />
              )}
            </div>

            {/* Practice Info */}
            {(s('practice_name') || s('practice_type') || s('practice_address')) && (
              <div className="p-4 pt-0">
                <p className="text-gray-400 text-sm font-medium mb-2">Practice Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {s('practice_name') && <Field lbl="Practice Name" val={s('practice_name')} />}
                  {s('practice_type') && <Field lbl="Practice Type" val={s('practice_type')?.replace(/_/g, ' ')} />}
                  {s('premises_type') && <Field lbl="Premises" val={s('premises_type')?.replace(/_/g, ' ')} />}
                  {n('number_of_employees') != null && <Field lbl="Employees" val={n('number_of_employees')} />}
                </div>
                {s('practice_address') && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Home className="w-4 h-4 text-cyan-400" />
                      <p className="text-gray-400 text-sm font-medium">Practice Address</p>
                    </div>
                    <p className="text-white text-sm pl-6">
                      {[s('practice_address'), s('practice_city'), s('practice_state'), s('practice_pincode')].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Income */}
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CurrencyField lbl="Gross Annual Receipts" val={n('gross_annual_receipts')} />
              <CurrencyField lbl="Professional Expenses" val={n('professional_expenses')} />
              <CurrencyField lbl="Net Annual Income" val={data.monthly_income ? data.monthly_income * 12 : n('net_annual_income')} />
            </div>
          </Section>
        )
      })()}

      {/* ── 5c. AGRICULTURE — Farm Details ── */}
      {isAgriculture && (() => {
        mark('total_land_holding_acres', 'cultivable_land_acres', 'irrigated_land_acres',
          'rain_fed_land_acres', 'land_ownership_type', 'farming_type',
          'primary_crop', 'secondary_crops', 'irrigation_source', 'farm_mechanization',
          'annual_crop_income', 'annual_dairy_income', 'annual_other_agri_income',
          'kcc_limit', 'kcc_outstanding', 'kcc_bank')
        return (
          <Section icon={Wheat} iconColor="text-green-400" title="Agriculture Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {n('total_land_holding_acres') != null && <Field lbl="Total Land Holding" val={`${n('total_land_holding_acres')} acres`} />}
              {n('cultivable_land_acres') != null && <Field lbl="Cultivable Land" val={`${n('cultivable_land_acres')} acres`} />}
              {n('irrigated_land_acres') != null && <Field lbl="Irrigated Land" val={`${n('irrigated_land_acres')} acres`} />}
              {n('rain_fed_land_acres') != null && <Field lbl="Rain-fed Land" val={`${n('rain_fed_land_acres')} acres`} />}
              {s('land_ownership_type') && <Field lbl="Land Ownership" val={s('land_ownership_type')?.replace(/_/g, ' ')} />}
              {s('farming_type') && <Field lbl="Farming Type" val={s('farming_type')?.replace(/_/g, ' ')} />}
              {s('primary_crop') && <Field lbl="Primary Crop" val={s('primary_crop')} />}
              {ipd.secondary_crops && Array.isArray(ipd.secondary_crops) && <Field lbl="Secondary Crops" val={(ipd.secondary_crops as string[]).join(', ')} />}
              {s('irrigation_source') && <Field lbl="Irrigation Source" val={s('irrigation_source')?.replace(/_/g, ' ')} />}
              {ipd.farm_mechanization != null && <Field lbl="Farm Mechanization" val={ipd.farm_mechanization ? 'Yes' : 'No'} />}
            </div>

            {/* Agriculture Income */}
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CurrencyField lbl="Annual Crop Income" val={n('annual_crop_income')} />
              <CurrencyField lbl="Annual Dairy Income" val={n('annual_dairy_income')} />
              <CurrencyField lbl="Other Agri Income" val={n('annual_other_agri_income')} />
            </div>

            {/* KCC Details */}
            {(s('kcc_bank') || n('kcc_limit') != null) && (
              <div className="p-4 pt-0">
                <p className="text-gray-400 text-sm font-medium mb-2">Kisan Credit Card (KCC)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {s('kcc_bank') && <Field lbl="KCC Bank" val={s('kcc_bank')} />}
                  <CurrencyField lbl="KCC Limit" val={n('kcc_limit')} />
                  <CurrencyField lbl="KCC Outstanding" val={n('kcc_outstanding')} />
                </div>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5d. PENSIONER — Pension Details ── */}
      {isPensioner && (() => {
        mark('pension_type', 'ppo_number', 'last_employer', 'last_designation',
          'retirement_date', 'monthly_pension', 'pension_bank', 'pension_account')
        return (
          <Section icon={Banknote} iconColor="text-amber-400" title="Pension Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('pension_type') && <Field lbl="Pension Type" val={s('pension_type')?.replace(/_/g, ' ')} />}
              {s('ppo_number') && <Field lbl="PPO Number" val={s('ppo_number')} />}
              {s('last_employer') && <Field lbl="Last Employer" val={s('last_employer')} />}
              {s('last_designation') && <Field lbl="Last Designation" val={s('last_designation')} />}
              <DateField lbl="Retirement Date" val={s('retirement_date')} />
              <CurrencyField lbl="Monthly Pension" val={data.monthly_income ?? n('monthly_pension')} />
              {s('pension_bank') && <Field lbl="Pension Bank" val={s('pension_bank')} />}
              {s('pension_account') && <Field lbl="Pension Account" val={s('pension_account')} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5e. RENTAL — Property Income ── */}
      {isRental && (() => {
        mark('total_properties', 'total_monthly_rent', 'total_monthly_rental_income', 'property_details')
        const properties = ipd.property_details as Array<Record<string, unknown>> | undefined
        return (
          <Section icon={Building} iconColor="text-indigo-400" title="Rental Income Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {n('total_properties') != null && <Field lbl="Total Properties" val={n('total_properties')} />}
              <CurrencyField lbl="Total Monthly Rent" val={n('total_monthly_rent') ?? n('total_monthly_rental_income')} />
            </div>
            {properties && properties.length > 0 && (
              <div className="p-4 pt-0 space-y-3">
                <p className="text-gray-400 text-sm font-medium">Properties</p>
                {properties.map((prop, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-medium">{String(prop.type || `Property ${idx + 1}`).replace(/_/g, ' ')}</p>
                      {prop.monthly_rent != null && <p className="text-orange-400 font-medium">{cur(Number(prop.monthly_rent))}/mo</p>}
                    </div>
                    {prop.address && <p className="text-gray-400 text-sm">{String(prop.address)}</p>}
                    {prop.tenant_since && <p className="text-gray-500 text-xs mt-1">Tenant since {fmt(String(prop.tenant_since))}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5f. NRI — Non-Resident Details ── */}
      {isNRI && (() => {
        mark('nri_type', 'country_of_residence', 'city_abroad', 'employer_abroad',
          'designation_abroad', 'visa_type', 'monthly_income_foreign', 'income_currency',
          'nre_nro_account', 'years_abroad', 'passport_number', 'indian_address')
        return (
          <Section icon={Globe} iconColor="text-blue-400" title="NRI Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('nri_type') && <Field lbl="NRI Category" val={s('nri_type')?.replace(/_/g, ' ')} />}
              {s('country_of_residence') && <Field lbl="Country of Residence" val={s('country_of_residence')} />}
              {s('city_abroad') && <Field lbl="City" val={s('city_abroad')} />}
              {s('employer_abroad') && <Field lbl="Employer Abroad" val={s('employer_abroad')} />}
              {s('designation_abroad') && <Field lbl="Designation" val={s('designation_abroad')} />}
              {s('visa_type') && <Field lbl="Visa Type" val={s('visa_type')?.replace(/_/g, ' ')} />}
              {n('monthly_income_foreign') != null && <Field lbl="Monthly Income (Foreign)" val={`${n('monthly_income_foreign')} ${s('income_currency') || ''}`} />}
              {s('nre_nro_account') && <Field lbl="NRE/NRO Account" val={s('nre_nro_account')} />}
              {n('years_abroad') != null && <Field lbl="Years Abroad" val={`${n('years_abroad')} years`} />}
              {s('passport_number') && <Field lbl="Passport Number" val={s('passport_number')} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5g. STUDENT — Education Loan Details ── */}
      {isStudent && (() => {
        mark('course_name', 'institution_name', 'course_type', 'study_country',
          'admission_year', 'expected_completion', 'course_fee_annual', 'scholarship_amount',
          'co_applicant_name', 'co_applicant_relation', 'co_applicant_income')
        return (
          <Section icon={GraduationCap} iconColor="text-indigo-400" title="Education / Student Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('course_name') && <Field lbl="Course" val={s('course_name')} />}
              {s('institution_name') && <Field lbl="Institution" val={s('institution_name')} />}
              {s('course_type') && <Field lbl="Course Type" val={s('course_type')?.replace(/_/g, ' ')} />}
              {s('study_country') && <Field lbl="Country of Study" val={s('study_country')} />}
              {n('admission_year') != null && <Field lbl="Admission Year" val={n('admission_year')} />}
              {n('expected_completion') != null && <Field lbl="Expected Completion" val={n('expected_completion')} />}
              <CurrencyField lbl="Annual Course Fee" val={n('course_fee_annual')} />
              <CurrencyField lbl="Scholarship" val={n('scholarship_amount')} />
            </div>
            {(s('co_applicant_name')) && (
              <div className="p-4 pt-0">
                <p className="text-gray-400 text-sm font-medium mb-2">Co-Applicant Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field lbl="Co-Applicant Name" val={s('co_applicant_name')} />
                  {s('co_applicant_relation') && <Field lbl="Relationship" val={s('co_applicant_relation')?.replace(/_/g, ' ')} />}
                  <CurrencyField lbl="Co-Applicant Income" val={n('co_applicant_income')} />
                </div>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5h. RETIRED — Retirement Details ── */}
      {isRetired && (() => {
        mark('last_employer', 'last_designation', 'retirement_date', 'retirement_type',
          'gratuity_received', 'pf_balance', 'monthly_investment_income', 'has_medical_insurance')
        return (
          <Section icon={Shield} iconColor="text-amber-400" title="Retirement Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('last_employer') && <Field lbl="Last Employer" val={s('last_employer')} />}
              {s('last_designation') && <Field lbl="Last Designation" val={s('last_designation')} />}
              <DateField lbl="Retirement Date" val={s('retirement_date')} />
              {s('retirement_type') && <Field lbl="Retirement Type" val={s('retirement_type')?.replace(/_/g, ' ')} />}
              <CurrencyField lbl="Gratuity Received" val={n('gratuity_received')} />
              <CurrencyField lbl="PF Balance" val={n('pf_balance')} />
              <CurrencyField lbl="Monthly Investment Income" val={n('monthly_investment_income')} />
              {s('has_medical_insurance') && <Field lbl="Medical Insurance" val={s('has_medical_insurance') === 'YES' ? 'Yes' : 'No'} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5i. WOMEN — Women Profile Details ── */}
      {isWomen && (() => {
        mark('women_category', 'shg_name', 'shg_registration', 'annual_income',
          'scheme_applied', 'number_of_dependents', 'business_description')
        return (
          <Section icon={Heart} iconColor="text-pink-400" title="Women Profile Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('women_category') && <Field lbl="Category" val={s('women_category')?.replace(/_/g, ' ')} />}
              {s('shg_name') && <Field lbl="SHG Name" val={s('shg_name')} />}
              {s('shg_registration') && <Field lbl="SHG Registration" val={s('shg_registration')} />}
              <CurrencyField lbl="Annual Income" val={n('annual_income')} />
              {s('scheme_applied') && <Field lbl="Government Scheme" val={s('scheme_applied')?.replace(/_/g, ' ')} />}
              {n('number_of_dependents') != null && <Field lbl="Dependents" val={n('number_of_dependents')} />}
            </div>
            {s('business_description') && (
              <div className="p-4 pt-0">
                <p className="text-gray-500 text-xs mb-1">Business / Activity Description</p>
                <p className="text-white text-sm">{s('business_description')}</p>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5j. GIG ECONOMY — Freelance & Gig Details ── */}
      {isGigEconomy && (() => {
        mark('gig_type', 'platform_name', 'primary_skill', 'monthly_earnings',
          'years_in_gig', 'client_count', 'has_gst', 'portfolio_url')
        return (
          <Section icon={Zap} iconColor="text-yellow-400" title="Gig / Freelance Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('gig_type') && <Field lbl="Gig Type" val={s('gig_type')?.replace(/_/g, ' ')} />}
              {s('platform_name') && <Field lbl="Platform(s)" val={s('platform_name')} />}
              {s('primary_skill') && <Field lbl="Primary Skill" val={s('primary_skill')} />}
              <CurrencyField lbl="Monthly Earnings" val={n('monthly_earnings')} />
              {n('years_in_gig') != null && <Field lbl="Years in Gig Work" val={`${n('years_in_gig')} years`} />}
              {n('client_count') != null && <Field lbl="Active Clients/Orders" val={n('client_count')} />}
              {s('has_gst') && <Field lbl="GST Registered" val={s('has_gst') === 'YES' ? 'Yes' : 'No'} />}
              {s('portfolio_url') && <Field lbl="Portfolio URL" val={s('portfolio_url')} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5k. MANUFACTURER — Manufacturing Details ── */}
      {isManufacturer && (() => {
        mark('product_type', 'manufacturing_scale', 'factory_address', 'annual_production_value',
          'number_of_workers', 'udyam_number', 'pollution_clearance', 'gst_number')
        return (
          <Section icon={Factory} iconColor="text-orange-400" title="Manufacturing Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('product_type') && <Field lbl="Product Type" val={s('product_type')} />}
              {s('manufacturing_scale') && <Field lbl="Scale" val={s('manufacturing_scale')?.replace(/_/g, ' ')} />}
              <CurrencyField lbl="Annual Production Value" val={n('annual_production_value')} />
              {n('number_of_workers') != null && <Field lbl="Workers" val={n('number_of_workers')} />}
              {s('udyam_number') && <Field lbl="Udyam Number" val={s('udyam_number')} />}
              {s('gst_number') && <Field lbl="GSTIN" val={s('gst_number')} />}
              {s('pollution_clearance') && <Field lbl="Pollution Clearance" val={s('pollution_clearance')?.replace(/_/g, ' ')} />}
            </div>
            {s('factory_address') && (
              <div className="p-4 pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-4 h-4 text-orange-400" />
                  <p className="text-gray-400 text-sm font-medium">Factory Address</p>
                </div>
                <p className="text-white text-sm pl-6">{s('factory_address')}</p>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5l. TRADER — Trading Details ── */}
      {isTrader && (() => {
        mark('trade_type', 'shop_address', 'annual_turnover', 'gst_number',
          'fssai_number', 'drug_license', 'years_in_business', 'monthly_income')
        return (
          <Section icon={Store} iconColor="text-emerald-400" title="Trading Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('trade_type') && <Field lbl="Trade Type" val={s('trade_type')?.replace(/_/g, ' ')} />}
              <CurrencyField lbl="Annual Turnover" val={n('annual_turnover')} />
              <CurrencyField lbl="Monthly Net Income" val={n('monthly_income')} />
              {s('gst_number') && <Field lbl="GSTIN" val={s('gst_number')} />}
              {s('fssai_number') && <Field lbl="FSSAI License" val={s('fssai_number')} />}
              {s('drug_license') && <Field lbl="Drug License" val={s('drug_license')} />}
              {n('years_in_business') != null && <Field lbl="Years in Business" val={`${n('years_in_business')} years`} />}
            </div>
            {s('shop_address') && (
              <div className="p-4 pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-4 h-4 text-emerald-400" />
                  <p className="text-gray-400 text-sm font-medium">Shop Address</p>
                </div>
                <p className="text-white text-sm pl-6">{s('shop_address')}</p>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5m. SERVICE — Service Business ── */}
      {isService && (() => {
        mark('service_type', 'service_address', 'annual_revenue', 'number_of_employees',
          'gst_number', 'professional_license', 'years_in_business')
        return (
          <Section icon={Wrench} iconColor="text-cyan-400" title="Service Business Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('service_type') && <Field lbl="Service Type" val={s('service_type')} />}
              <CurrencyField lbl="Annual Revenue" val={n('annual_revenue')} />
              {n('number_of_employees') != null && <Field lbl="Employees" val={n('number_of_employees')} />}
              {s('gst_number') && <Field lbl="GSTIN" val={s('gst_number')} />}
              {s('professional_license') && <Field lbl="License" val={s('professional_license')} />}
              {n('years_in_business') != null && <Field lbl="Years in Business" val={`${n('years_in_business')} years`} />}
            </div>
            {s('service_address') && (
              <div className="p-4 pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-4 h-4 text-cyan-400" />
                  <p className="text-gray-400 text-sm font-medium">Office Address</p>
                </div>
                <p className="text-white text-sm pl-6">{s('service_address')}</p>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5n. STARTUP — Startup Details ── */}
      {isStartup && (() => {
        mark('startup_name', 'dpiit_number', 'sector', 'funding_stage',
          'annual_revenue', 'burn_rate', 'team_size', 'incorporation_date')
        return (
          <Section icon={Rocket} iconColor="text-violet-400" title="Startup Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('startup_name') && <Field lbl="Startup Name" val={s('startup_name')} />}
              {s('dpiit_number') && <Field lbl="DPIIT Number" val={s('dpiit_number')} />}
              {s('sector') && <Field lbl="Sector" val={s('sector')} />}
              {s('funding_stage') && <Field lbl="Funding Stage" val={s('funding_stage')?.replace(/_/g, ' ')} />}
              <CurrencyField lbl="Annual Revenue" val={n('annual_revenue')} />
              <CurrencyField lbl="Monthly Burn Rate" val={n('burn_rate')} />
              {n('team_size') != null && <Field lbl="Team Size" val={n('team_size')} />}
              <DateField lbl="Date of Incorporation" val={s('incorporation_date')} />
            </div>
          </Section>
        )
      })()}

      {/* ── 5o. REAL ESTATE — Real Estate Business ── */}
      {isRealEstate && (() => {
        mark('business_type', 'rera_number', 'projects_completed', 'current_projects',
          'annual_turnover', 'years_in_business')
        return (
          <Section icon={Landmark} iconColor="text-teal-400" title="Real Estate Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('business_type') && <Field lbl="Business Type" val={s('business_type')?.replace(/_/g, ' ')} />}
              {s('rera_number') && <Field lbl="RERA Number" val={s('rera_number')} />}
              {n('projects_completed') != null && <Field lbl="Projects Completed" val={n('projects_completed')} />}
              {n('current_projects') != null && <Field lbl="Active Projects" val={n('current_projects')} />}
              <CurrencyField lbl="Annual Turnover" val={n('annual_turnover')} />
              {n('years_in_business') != null && <Field lbl="Years in Real Estate" val={`${n('years_in_business')} years`} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5p. MICRO ENTERPRISE — Micro Business ── */}
      {isMicroEnterprise && (() => {
        mark('business_type', 'daily_income', 'location_type', 'svanidhi_id',
          'udyam_number', 'years_in_business', 'monthly_expenses')
        return (
          <Section icon={ShoppingCart} iconColor="text-lime-400" title="Micro Enterprise Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('business_type') && <Field lbl="Business Type" val={s('business_type')} />}
              <CurrencyField lbl="Average Daily Income" val={n('daily_income')} />
              {s('location_type') && <Field lbl="Location Type" val={s('location_type')?.replace(/_/g, ' ')} />}
              {s('svanidhi_id') && <Field lbl="PM SVANidhi ID" val={s('svanidhi_id')} />}
              {s('udyam_number') && <Field lbl="Udyam Number" val={s('udyam_number')} />}
              {n('years_in_business') != null && <Field lbl="Years in Business" val={`${n('years_in_business')} years`} />}
              <CurrencyField lbl="Monthly Expenses" val={n('monthly_expenses')} />
            </div>
          </Section>
        )
      })()}

      {/* ── 5q. ARTISAN — Artisan / Craft Details ── */}
      {isArtisan && (() => {
        mark('craft_type', 'artisan_card_number', 'raw_material', 'monthly_production_value',
          'market_type', 'cooperative_member', 'years_of_experience')
        return (
          <Section icon={Palette} iconColor="text-rose-400" title="Artisan / Craft Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('craft_type') && <Field lbl="Craft Type" val={s('craft_type')} />}
              {s('artisan_card_number') && <Field lbl="Artisan Card" val={s('artisan_card_number')} />}
              {s('raw_material') && <Field lbl="Raw Material" val={s('raw_material')} />}
              <CurrencyField lbl="Monthly Production Value" val={n('monthly_production_value')} />
              {s('market_type') && <Field lbl="Market" val={s('market_type')?.replace(/_/g, ' ')} />}
              {s('cooperative_member') && <Field lbl="Cooperative Member" val={s('cooperative_member') === 'YES' ? 'Yes' : 'No'} />}
              {n('years_of_experience') != null && <Field lbl="Experience" val={`${n('years_of_experience')} years`} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5r. AGENT — Agent / DSA Details ── */}
      {isAgent && (() => {
        mark('agency_type', 'license_number', 'issuing_authority', 'principal_companies',
          'monthly_commission', 'years_as_agent', 'gst_number')
        return (
          <Section icon={UserCheck} iconColor="text-sky-400" title="Agent / DSA Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('agency_type') && <Field lbl="Agency Type" val={s('agency_type')?.replace(/_/g, ' ')} />}
              {s('license_number') && <Field lbl="License Number" val={s('license_number')} />}
              {s('issuing_authority') && <Field lbl="Issuing Authority" val={s('issuing_authority')} />}
              {s('principal_companies') && <Field lbl="Principal Companies" val={s('principal_companies')} />}
              <CurrencyField lbl="Monthly Commission" val={n('monthly_commission')} />
              {n('years_as_agent') != null && <Field lbl="Years as Agent" val={`${n('years_as_agent')} years`} />}
              {s('gst_number') && <Field lbl="GSTIN" val={s('gst_number')} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5s. INSTITUTIONAL — Institution Details ── */}
      {isInstitutional && (() => {
        mark('institution_type', 'registration_number', 'registration_authority',
          'annual_budget', 'number_of_beneficiaries', 'funding_sources')
        return (
          <Section icon={Library} iconColor="text-purple-400" title="Institution Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('institution_type') && <Field lbl="Institution Type" val={s('institution_type')?.replace(/_/g, ' ')} />}
              {s('registration_number') && <Field lbl="Registration Number" val={s('registration_number')} />}
              {s('registration_authority') && <Field lbl="Registration Authority" val={s('registration_authority')} />}
              <CurrencyField lbl="Annual Budget" val={n('annual_budget')} />
              {n('number_of_beneficiaries') != null && <Field lbl="Beneficiaries" val={n('number_of_beneficiaries')} />}
            </div>
            {s('funding_sources') && (
              <div className="p-4 pt-0">
                <p className="text-gray-500 text-xs mb-1">Funding Sources</p>
                <p className="text-white text-sm">{s('funding_sources')}</p>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5t. SPECIAL — Special Category Details ── */}
      {isSpecial && (() => {
        mark('special_category', 'certificate_number', 'issuing_authority',
          'monthly_income_source', 'income_amount', 'government_scheme')
        return (
          <Section icon={Award} iconColor="text-amber-400" title="Special Category Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('special_category') && <Field lbl="Category" val={s('special_category')?.replace(/_/g, ' ')} />}
              {s('certificate_number') && <Field lbl="Certificate Number" val={s('certificate_number')} />}
              {s('issuing_authority') && <Field lbl="Issuing Authority" val={s('issuing_authority')} />}
              {s('monthly_income_source') && <Field lbl="Income Source" val={s('monthly_income_source')} />}
              <CurrencyField lbl="Monthly Income" val={n('income_amount')} />
              {s('government_scheme') && <Field lbl="Government Scheme" val={s('government_scheme')} />}
            </div>
          </Section>
        )
      })()}

      {/* ── 5u. INDIVIDUAL (Basic) — Guardian & Funds ── */}
      {isIndividualBasic && (() => {
        mark('source_of_funds', 'guardian_name', 'guardian_relationship',
          'dependents_count', 'monthly_expenses')
        return (
          <Section icon={User} iconColor="text-gray-400" title="Basic Profile Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s('source_of_funds') && <Field lbl="Source of Funds" val={s('source_of_funds')?.replace(/_/g, ' ')} />}
              {s('guardian_name') && <Field lbl="Guardian Name" val={s('guardian_name')} />}
              {s('guardian_relationship') && <Field lbl="Relationship" val={s('guardian_relationship')?.replace(/_/g, ' ')} />}
              {n('dependents_count') != null && <Field lbl="Dependents" val={n('dependents_count')} />}
              <CurrencyField lbl="Monthly Expenses" val={n('monthly_expenses')} />
            </div>
          </Section>
        )
      })()}

      {/* ── 5v. BUSINESS (Generic fallback — only if no specific category matched) ── */}
      {isBusiness && (() => {
        mark('business_nature', 'years_in_business', 'gross_annual_turnover',
          'net_annual_profit', 'gst_number', 'average_monthly_income',
          'business_name', 'business_type', 'business_category',
          'business_address', 'business_city', 'business_state', 'business_pincode',
          'premises_type', 'number_of_employees', 'annual_turnover')
        return (
          <Section icon={Briefcase} iconColor="text-cyan-400" title="Business & Income Details"
            badge="complete" editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(data.employer_name || s('business_name')) && <Field lbl="Business Name" val={data.employer_name || s('business_name')} />}
              {s('business_nature') && <Field lbl="Nature of Business" val={s('business_nature')} />}
              {s('business_type') && <Field lbl="Business Type" val={s('business_type')?.replace(/_/g, ' ')} />}
              {s('business_category') && <Field lbl="Business Category" val={s('business_category')} />}
              {(data.work_experience_years != null || n('years_in_business') != null) && (
                <Field lbl="Years in Business" val={`${data.work_experience_years ?? n('years_in_business')} years`} />
              )}
              {s('premises_type') && <Field lbl="Premises" val={s('premises_type')?.replace(/_/g, ' ')} />}
              {n('number_of_employees') != null && <Field lbl="Employees" val={n('number_of_employees')} />}
              {s('gst_number') && <Field lbl="GSTIN" val={s('gst_number')} />}
              <CurrencyField lbl="Annual Turnover" val={n('gross_annual_turnover') ?? n('annual_turnover')} />
              <CurrencyField lbl="Annual Profit" val={n('net_annual_profit')} />
              <CurrencyField lbl="Monthly Income" val={data.monthly_income ?? n('average_monthly_income')} />
            </div>
            {(s('business_address') || s('business_city')) && (
              <div className="p-4 pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-4 h-4 text-cyan-400" />
                  <p className="text-gray-400 text-sm font-medium">Business Address</p>
                </div>
                <p className="text-white text-sm pl-6">
                  {[s('business_address'), s('business_city'), s('business_state'), s('business_pincode')].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </Section>
        )
      })()}

      {/* ── 5w. Generic Income (fallback for other/uncategorized) ── */}
      {hasEmployment && !specificCategories && !isBusiness && (
        <Section icon={Briefcase} iconColor="text-cyan-400" title="Income Details"
          badge="complete" editSection={5} onEdit={onEdit}>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(data.employer_name) && <Field lbl="Employer / Source" val={data.employer_name} />}
            {data.designation && <Field lbl="Designation" val={data.designation} />}
            {data.employment_type && <Field lbl="Type" val={data.employment_type} />}
            {data.work_experience_years != null && <Field lbl="Experience" val={`${data.work_experience_years} years`} />}
            <CurrencyField lbl="Monthly Income" val={data.monthly_income} />
            <CurrencyField lbl="Net Monthly Income" val={data.net_monthly_income} />
          </div>
        </Section>
      )}

      {/* ── 6. Remaining income_profile_data fields (catch-all) ── */}
      {data.income_profile_data && (() => {
        const extraFields = Object.entries(data.income_profile_data).filter(
          ([key, val]) => !renderedKeys.has(key) && !SKIP_KEYS.has(key) && val != null && val !== '' &&
            !(typeof val === 'object' && !Array.isArray(val)) &&
            !(Array.isArray(val) && val.length > 0 && typeof val[0] === 'object')
        )
        if (extraFields.length === 0) return null
        return (
          <Section icon={ScrollText} iconColor="text-purple-400" title="Additional Profile Details"
            editSection={5} onEdit={onEdit}>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {extraFields.map(([k, v]) => <SmartField key={k} k={k} v={v} />)}
            </div>
          </Section>
        )
      })()}

      {/* ── 7. Documents ── */}
      <Section icon={FileText} iconColor="text-green-400" title="Documents"
        badge={data.documents && data.documents.length > 0 ? `${data.documents.length} uploaded` : 'incomplete'}>
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
      </Section>
    </div>
  )
}
