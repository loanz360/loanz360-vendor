'use client'

import React from 'react'
import {
  Building2,
  Briefcase,
  Calendar,
  Layers,
  IndianRupee,
  Users,
  FileText,
  Award,
  Shield,
  FileCheck
} from 'lucide-react'
import type { SoleProprietorshipStepProps } from '../types'
import {
  NATURE_OF_BUSINESS_OPTIONS,
  BUSINESS_CATEGORY_OPTIONS,
  GST_STATUS_OPTIONS
} from '../types'

export default function BusinessDetailsStep({
  data,
  errors,
  onUpdate
}: SoleProprietorshipStepProps) {
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 100 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Business Entity Details</h2>
            <p className="text-sm text-gray-400">
              Provide your sole proprietorship business information
            </p>
          </div>
        </div>
      </div>

      {/* Basic Business Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business/Trade Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Business / Trade Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={data.business_name || ''}
              onChange={(e) => onUpdate({ business_name: e.target.value })}
              placeholder="Enter your business name"
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.business_name
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            />
          </div>
          {errors.business_name && (
            <p className="mt-1 text-sm text-red-400">{errors.business_name}</p>
          )}
        </div>

        {/* Trading Name (if different) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trading Name <span className="text-gray-500">(if different from business name)</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={data.trading_name || ''}
              onChange={(e) => onUpdate({ trading_name: e.target.value })}
              placeholder="Enter trading name (optional)"
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Nature of Business */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nature of Business <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={data.nature_of_business || ''}
              onChange={(e) => onUpdate({ nature_of_business: e.target.value })}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors ${
                errors.nature_of_business
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            >
              <option value="">Select nature of business</option>
              {NATURE_OF_BUSINESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.nature_of_business && (
            <p className="mt-1 text-sm text-red-400">{errors.nature_of_business}</p>
          )}
        </div>

        {/* Business Category */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Business Category <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={data.business_category || ''}
              onChange={(e) => onUpdate({ business_category: e.target.value })}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors ${
                errors.business_category
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            >
              <option value="">Select business category</option>
              {BUSINESS_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {errors.business_category && (
            <p className="mt-1 text-sm text-red-400">{errors.business_category}</p>
          )}
        </div>

        {/* Year of Establishment */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Year of Establishment <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <select
              value={data.year_of_establishment || ''}
              onChange={(e) => onUpdate({ year_of_establishment: parseInt(e.target.value) || null })}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white appearance-none focus:outline-none focus:ring-2 transition-colors ${
                errors.year_of_establishment
                  ? 'border-red-500 focus:ring-red-500/50'
                  : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
              }`}
            >
              <option value="">Select year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {errors.year_of_establishment && (
            <p className="mt-1 text-sm text-red-400">{errors.year_of_establishment}</p>
          )}
        </div>

        {/* Annual Turnover */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Annual Turnover (Approx) <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="number"
              value={data.annual_turnover || ''}
              onChange={(e) => onUpdate({ annual_turnover: parseFloat(e.target.value) || null })}
              placeholder="Enter annual turnover"
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        {/* Number of Employees */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of Employees <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="number"
              value={data.number_of_employees || ''}
              onChange={(e) => onUpdate({ number_of_employees: parseInt(e.target.value) || null })}
              placeholder="Enter number of employees"
              min="0"
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800 my-6"></div>

      {/* Registration & Tax Details Section */}
      <div className="p-5 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-medium text-white">Registration & Tax Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GST Registration Status */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              GST Registration Status <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {GST_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdate({ gst_registration_status: option.value as unknown })}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-lg border transition-all ${
                    data.gst_registration_status === option.value
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {errors.gst_registration_status && (
              <p className="mt-1 text-sm text-red-400">{errors.gst_registration_status}</p>
            )}
          </div>

          {/* GSTIN (conditional) */}
          {data.gst_registration_status === 'REGISTERED' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                GSTIN <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={data.gstin || ''}
                  onChange={(e) => onUpdate({ gstin: e.target.value.toUpperCase() })}
                  placeholder="Enter 15-digit GSTIN"
                  maxLength={15}
                  className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors font-mono ${
                    errors.gstin
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-gray-700 focus:ring-orange-500/50 focus:border-orange-500'
                  }`}
                />
              </div>
              {errors.gstin && (
                <p className="mt-1 text-sm text-red-400">{errors.gstin}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Format: 22AAAAA0000A1Z5
              </p>
            </div>
          )}

          {/* Shop & Establishment License */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Shop & Establishment License No. <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="relative">
              <FileCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.shop_establishment_license || ''}
                onChange={(e) => onUpdate({ shop_establishment_license: e.target.value })}
                placeholder="Enter license number"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
              />
            </div>
          </div>

          {/* UDYAM Registration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              UDYAM Registration No. <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="relative">
              <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.udyam_registration || ''}
                onChange={(e) => onUpdate({ udyam_registration: e.target.value.toUpperCase() })}
                placeholder="UDYAM-XX-00-0000000"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Trade License */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Trade License No. <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.trade_license || ''}
                onChange={(e) => onUpdate({ trade_license: e.target.value })}
                placeholder="Enter trade license number"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
              />
            </div>
          </div>

          {/* FSSAI License (if food business) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              FSSAI License No. <span className="text-gray-500">(if applicable)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={data.fssai_license || ''}
                onChange={(e) => onUpdate({ fssai_license: e.target.value })}
                placeholder="Enter FSSAI license number"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-400 font-medium text-sm">Document Requirements</p>
            <p className="text-orange-300 text-xs mt-1">
              Please keep your GST certificate, Shop License, and other registration documents ready.
              You will need to upload them in the Documents step.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
