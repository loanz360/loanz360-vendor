'use client'

import React from 'react'
import {
  Briefcase,
  MapPin,
  Globe,
  Linkedin,
  Target,
  TrendingUp,
  Users,
  FileText,
} from 'lucide-react'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import FormField, { MultiSelectField } from '@/components/partners/shared/FormField'
import type {
  BPProfessionalProfile,
  BPProfessionalProfileForm,
} from '@/types/bp-profile'
import {
  LOAN_PRODUCT_LABELS,
  INDUSTRY_SPECIALIZATION_LABELS,
  SOURCING_CHANNEL_LABELS,
  LEAD_VOLUME_LABELS,
  BP_CONSTANTS,
} from '@/types/bp-profile'

interface ProfessionalSourcingSectionProps {
  data: BPProfessionalProfile | null
  formData: BPProfessionalProfileForm
  onChange: (field: keyof BPProfessionalProfileForm, value: string | string[]) => void
  isEditing: boolean
  indianStates?: Array<{ state_name: string; state_code: string }>
}

const loanProductOptions = Object.entries(LOAN_PRODUCT_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const industryOptions = Object.entries(INDUSTRY_SPECIALIZATION_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const sourcingChannelOptions = Object.entries(SOURCING_CHANNEL_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const leadVolumeOptions = Object.entries(LEAD_VOLUME_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export default function ProfessionalSourcingSection({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  data,
  formData,
  onChange,
  isEditing,
  indianStates = [],
}: ProfessionalSourcingSectionProps) {
  const stateOptions = indianStates.map((state) => ({
    value: state.state_name,
    label: state.state_name,
  }))

  return (
    <CollapsibleSection
      title="Professional & Sourcing Profile"
      icon={Briefcase}
    >
      <div className="space-y-6 mt-4">
        {/* Experience & Lead Volume */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            label="Years of Experience"
            icon={TrendingUp}
            value={formData.years_of_experience}
            onChange={(v) => onChange('years_of_experience', v)}
            isEditing={isEditing}
            type="number"
            placeholder="e.g., 5"
            min={0}
            max={50}
            suffix="years"
            required
          />

          <FormField
            label="Average Monthly Leads"
            icon={Target}
            value={formData.average_monthly_leads}
            onChange={(v) => onChange('average_monthly_leads', v)}
            isEditing={isEditing}
            type="select"
            options={leadVolumeOptions}
            required
          />
        </div>

        {/* Primary Loan Products */}
        <div className="border-t border-gray-700/50 pt-6">
          <MultiSelectField
            label="Primary Loan Products"
            icon={FileText}
            value={formData.primary_loan_products}
            onChange={(v) => onChange('primary_loan_products', v)}
            isEditing={isEditing}
            options={loanProductOptions}
            required
            hint="Select the loan products you primarily source"
            maxSelections={5}
          />
        </div>

        {/* Secondary Loan Products */}
        <div>
          <MultiSelectField
            label="Secondary Loan Products"
            icon={FileText}
            value={formData.secondary_loan_products}
            onChange={(v) => onChange('secondary_loan_products', v)}
            isEditing={isEditing}
            options={loanProductOptions}
            hint="Select additional loan products you also handle"
            maxSelections={5}
          />
        </div>

        {/* Industry Specialization */}
        <div className="border-t border-gray-700/50 pt-6">
          <MultiSelectField
            label="Industry Specialization"
            icon={Users}
            value={formData.industry_specializations}
            onChange={(v) => onChange('industry_specializations', v)}
            isEditing={isEditing}
            options={industryOptions}
            required
            hint="Select the industries/customer segments you specialize in"
            maxSelections={5}
          />
        </div>

        {/* Sourcing Channels */}
        <div>
          <MultiSelectField
            label="Sourcing Channels"
            icon={Target}
            value={formData.sourcing_channels}
            onChange={(v) => onChange('sourcing_channels', v)}
            isEditing={isEditing}
            options={sourcingChannelOptions}
            required
            hint="How do you source your leads?"
          />
        </div>

        {/* Operating Locations */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" />
            Operating Locations
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MultiSelectField
              label="Operating States"
              icon={MapPin}
              value={formData.operating_states}
              onChange={(v) => onChange('operating_states', v)}
              isEditing={isEditing}
              options={stateOptions}
              required
              hint="Select states where you operate"
            />

            <div className="space-y-2">
              <label className="text-gray-400 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Operating Cities
              </label>
              {!isEditing ? (
                <p className="text-white">
                  {formData.operating_cities.length > 0
                    ? formData.operating_cities.join(', ')
                    : 'Not specified'}
                </p>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Enter cities separated by commas"
                    value={formData.operating_cities.join(', ')}
                    onChange={(e) => {
                      const cities = e.target.value
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean)
                      onChange('operating_cities', cities)
                    }}
                    className="w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-gray-500 text-xs">
                    e.g., Mumbai, Delhi, Bangalore
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Online Presence */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-orange-400" />
            Online Presence
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Website URL"
              icon={Globe}
              value={formData.website_url}
              onChange={(v) => onChange('website_url', v)}
              isEditing={isEditing}
              placeholder="https://www.yourwebsite.com"
              hint="Optional - your business website"
            />

            <FormField
              label="LinkedIn Profile"
              icon={Linkedin}
              value={formData.linkedin_url}
              onChange={(v) => onChange('linkedin_url', v)}
              isEditing={isEditing}
              placeholder="https://linkedin.com/in/yourprofile"
              hint="Optional - your LinkedIn profile URL"
            />
          </div>
        </div>

        {/* Bio / Description */}
        <div className="border-t border-gray-700/50 pt-6">
          <FormField
            label="Professional Bio / Description"
            icon={FileText}
            value={formData.bio_description}
            onChange={(v) => onChange('bio_description', v)}
            isEditing={isEditing}
            type="textarea"
            placeholder="Tell us about your experience, expertise, and what makes you a great partner..."
            rows={4}
            maxLength={BP_CONSTANTS.BIO_MAX_LENGTH}
            hint={`Describe your professional background (${formData.bio_description?.length || 0}/${BP_CONSTANTS.BIO_MAX_LENGTH} characters)`}
          />
        </div>
      </div>
    </CollapsibleSection>
  )
}
