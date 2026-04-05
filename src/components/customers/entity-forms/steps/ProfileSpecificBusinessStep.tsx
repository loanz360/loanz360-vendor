'use client'

import React, { useState, useEffect } from 'react'
import { Briefcase, Loader2, AlertCircle } from 'lucide-react'
import DynamicField, { ProfileField } from '../shared/DynamicField'

interface ProfileSection {
  section_name: string
  section_icon: string
  section_order: number
  fields: ProfileField[]
}

interface ProfileSpecificBusinessStepProps {
  incomeProfileId: string
  data: Record<string, string | number>
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase,
  // Add more icons as needed based on section_icon values in database
}

export default function ProfileSpecificBusinessStep({
  incomeProfileId,
  data,
  onChange,
  errors
}: ProfileSpecificBusinessStepProps) {
  const [sections, setSections] = useState<ProfileSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!incomeProfileId) {
      setLoading(false)
      return
    }

    fetchProfileFields()
  }, [incomeProfileId])

  const fetchProfileFields = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/customers/profile-fields-v2?profile_id=${incomeProfileId}`,
        {
          credentials: 'include'
        }
      )

      // If API doesn't exist yet (404), show no fields required
      if (response.status === 404) {
        setSections([])
        return
      }

      const result = await response.json()

      if (result.success) {
        // Group fields by section
        const groupedSections: Record<string, ProfileSection> = {}

        result.data.fields.forEach((field: ProfileField & { section_name: string; section_icon: string; section_order: number }) => {
          const sectionKey = field.section_name

          if (!groupedSections[sectionKey]) {
            groupedSections[sectionKey] = {
              section_name: field.section_name,
              section_icon: field.section_icon || 'Briefcase',
              section_order: field.section_order || 1,
              fields: []
            }
          }

          groupedSections[sectionKey].fields.push(field)
        })

        // Convert to array and sort by section_order
        const sectionsArray = Object.values(groupedSections).sort(
          (a, b) => a.section_order - b.section_order
        )

        setSections(sectionsArray)
      } else {
        setError(result.message || 'Failed to load profile fields')
      }
    } catch (err) {
      console.error('Error fetching profile fields:', err)
      // Don't block the user - show empty state if API is unavailable
      setSections([])
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading profile-specific fields...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-400 mb-1">Error Loading Fields</h4>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // No fields state
  if (sections.length === 0) {
    return (
      <div className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-300 mb-1">No Additional Fields Required</h4>
            <p className="text-sm text-gray-300">
              This profile doesn't require any additional business-specific information.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">
          Profile-Specific Business Details
        </h2>
        <p className="text-gray-400">
          Additional information specific to your business type
        </p>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-1">LEAN Data Collection</p>
            <p>
              We only collect essential business information needed for loan assessment.
              These fields are specific to your business category and help banks evaluate
              your loan application more accurately.
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Sections */}
      {sections.map((section, sectionIndex) => {
        const SectionIcon = iconMap[section.section_icon] || Briefcase

        return (
          <div
            key={sectionIndex}
            className="p-6 sm:p-8 bg-[#111827] rounded-2xl border border-gray-800"
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <SectionIcon className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {section.section_name}
                </h3>
              </div>
            </div>

            {/* Dynamic Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.fields.map((field) => (
                <div
                  key={field.field_key}
                  className={field.grid_columns === 1 ? 'md:col-span-2' : ''}
                >
                  <DynamicField
                    field={field}
                    value={data[field.field_key]}
                    onChange={(value) => onChange(field.field_key, value)}
                    error={errors[field.field_key]}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Help Text */}
      <div className="p-4 bg-gray-800/30 rounded-xl border border-gray-700">
        <p className="text-sm text-gray-400 text-center">
          💡 <strong className="text-white">Tip:</strong> All fields marked with{' '}
          <span className="text-red-500">*</span> are required for completing this step.
          Your data is encrypted and secured.
        </p>
      </div>
    </div>
  )
}
