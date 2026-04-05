'use client'

import React from 'react'
import { User, Calendar, Users, Heart, Mail, Phone } from 'lucide-react'
import type { CustomerProfileData } from '../CustomerProfileWizard'

interface PersonalDetailsStepProps {
  data: CustomerProfileData
  errors: Record<string, string>
  onUpdate: (updates: Partial<CustomerProfileData>) => void
}

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' }
]

const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' }
]

export default function PersonalDetailsStep({ data, errors, onUpdate }: PersonalDetailsStepProps) {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-purple-400" />
          Personal Details
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Please provide your basic information as per your official documents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Full Name (as per PAN) <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={data.full_name || ''}
              onChange={(e) => onUpdate({ full_name: e.target.value })}
              placeholder="Enter your full name"
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.full_name
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            />
          </div>
          {errors.full_name && <p className="mt-1 text-sm text-red-400">{errors.full_name}</p>}
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Date of Birth <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={data.date_of_birth || ''}
              onChange={(e) => onUpdate({ date_of_birth: e.target.value })}
              max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 transition-colors ${
                errors.date_of_birth
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            />
          </div>
          {errors.date_of_birth && <p className="mt-1 text-sm text-red-400">{errors.date_of_birth}</p>}
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Gender <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="flex gap-3">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate({ gender: option.value })}
                className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                  data.gender === option.value
                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {errors.gender && <p className="mt-1 text-sm text-red-400">{errors.gender}</p>}
        </div>

        {/* Father's Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Father's Name <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={data.father_name || ''}
              onChange={(e) => onUpdate({ father_name: e.target.value })}
              placeholder="Enter father's name"
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.father_name
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            />
          </div>
          {errors.father_name && <p className="mt-1 text-sm text-red-400">{errors.father_name}</p>}
        </div>

        {/* Mother's Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mother's Name <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={data.mother_name || ''}
              onChange={(e) => onUpdate({ mother_name: e.target.value })}
              placeholder="Enter mother's name"
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {/* Marital Status */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Marital Status <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Heart className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={data.marital_status || ''}
              onChange={(e) => onUpdate({ marital_status: e.target.value })}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors ${
                errors.marital_status
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            >
              <option value="">Select marital status</option>
              {MARITAL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.marital_status && <p className="mt-1 text-sm text-red-400">{errors.marital_status}</p>}
        </div>

        {/* Divider */}
        <div className="md:col-span-2 border-t border-gray-800 my-2"></div>

        {/* Contact Details Header */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-purple-400" />
            Contact Details
          </h3>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email Address <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              value={data.email || ''}
              onChange={(e) => onUpdate({ email: e.target.value })}
              placeholder="Enter your email"
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            />
          </div>
          {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
        </div>

        {/* Primary Mobile */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Primary Mobile <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="tel"
              value={data.mobile_primary || ''}
              onChange={(e) => onUpdate({ mobile_primary: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="Enter 10-digit mobile number"
              maxLength={10}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.mobile_primary
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-purple-500/50 focus:border-purple-500'
              }`}
            />
          </div>
          {errors.mobile_primary && <p className="mt-1 text-sm text-red-400">{errors.mobile_primary}</p>}
        </div>

        {/* Secondary Mobile */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Secondary Mobile <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="tel"
              value={data.mobile_secondary || ''}
              onChange={(e) => onUpdate({ mobile_secondary: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="Enter alternate mobile number"
              maxLength={10}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
