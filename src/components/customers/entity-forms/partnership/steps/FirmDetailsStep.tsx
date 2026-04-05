'use client'

import React from 'react'
import { Building2, FileText, IndianRupee, Calendar } from 'lucide-react'
import {
  PartnershipData,
  PartnershipStepProps
} from '../../types/partnership'
import {
  NATURE_OF_BUSINESS_OPTIONS,
  BUSINESS_CATEGORY_OPTIONS,
  GST_STATUS_OPTIONS,
  ANNUAL_TURNOVER_OPTIONS
} from '../../types'

export default function FirmDetailsStep({ data, errors, onUpdate }: PartnershipStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Partnership Firm Details</h2>
        <p className="text-gray-400">Enter the basic information about your partnership firm</p>
      </div>

      {/* Basic Information */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>
            <p className="text-sm text-gray-500">Firm identity details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Firm Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Firm Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.firm_name}
              onChange={(e) => onUpdate({ firm_name: e.target.value })}
              placeholder="Enter firm name as per registration"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.firm_name ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.firm_name && (
              <p className="mt-1 text-sm text-red-400">{errors.firm_name}</p>
            )}
          </div>

          {/* Trading Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Trading Name
            </label>
            <input
              type="text"
              value={data.trading_name}
              onChange={(e) => onUpdate({ trading_name: e.target.value })}
              placeholder="If different from firm name"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>

          {/* Nature of Business */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nature of Business <span className="text-red-400">*</span>
            </label>
            <select
              value={data.nature_of_business}
              onChange={(e) => onUpdate({ nature_of_business: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.nature_of_business ? 'border-red-500' : 'border-gray-700'
              }`}
            >
              <option value="">Select nature of business</option>
              {NATURE_OF_BUSINESS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.nature_of_business && (
              <p className="mt-1 text-sm text-red-400">{errors.nature_of_business}</p>
            )}
          </div>

          {/* Business Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Business Category <span className="text-red-400">*</span>
            </label>
            <select
              value={data.business_category}
              onChange={(e) => onUpdate({ business_category: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.business_category ? 'border-red-500' : 'border-gray-700'
              }`}
            >
              <option value="">Select business category</option>
              {BUSINESS_CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.business_category && (
              <p className="mt-1 text-sm text-red-400">{errors.business_category}</p>
            )}
          </div>
        </div>
      </div>

      {/* Registration Details */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Registration Details</h3>
            <p className="text-sm text-gray-500">Legal registration information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date of Formation */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date of Formation <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={data.date_of_formation}
                onChange={(e) => onUpdate({ date_of_formation: e.target.value })}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                  errors.date_of_formation ? 'border-red-500' : 'border-gray-700'
                }`}
              />
            </div>
            {errors.date_of_formation && (
              <p className="mt-1 text-sm text-red-400">{errors.date_of_formation}</p>
            )}
          </div>

          {/* Partnership Deed Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Partnership Deed Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.partnership_deed_number}
              onChange={(e) => onUpdate({ partnership_deed_number: e.target.value })}
              placeholder="Enter deed registration number"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.partnership_deed_number ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.partnership_deed_number && (
              <p className="mt-1 text-sm text-red-400">{errors.partnership_deed_number}</p>
            )}
          </div>

          {/* Registrar of Firms */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Registrar of Firms
            </label>
            <input
              type="text"
              value={data.registrar_of_firms}
              onChange={(e) => onUpdate({ registrar_of_firms: e.target.value })}
              placeholder="Registering authority name"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>

          {/* Firm PAN */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Firm PAN Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.firm_pan}
              onChange={(e) => onUpdate({ firm_pan: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${
                errors.firm_pan ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.firm_pan && (
              <p className="mt-1 text-sm text-red-400">{errors.firm_pan}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tax & Financial Details */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <IndianRupee className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Tax & Financial Details</h3>
            <p className="text-sm text-gray-500">GST and turnover information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Annual Turnover */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Annual Turnover
            </label>
            <select
              value={data.annual_turnover}
              onChange={(e) => onUpdate({ annual_turnover: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="">Select turnover range</option>
              {ANNUAL_TURNOVER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* GST Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              GST Registration Status <span className="text-red-400">*</span>
            </label>
            <select
              value={data.gst_registration_status}
              onChange={(e) => onUpdate({ gst_registration_status: e.target.value as PartnershipData['gst_registration_status'] })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                errors.gst_registration_status ? 'border-red-500' : 'border-gray-700'
              }`}
            >
              <option value="">Select GST status</option>
              {GST_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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
              <input
                type="text"
                value={data.gstin}
                onChange={(e) => onUpdate({ gstin: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${
                  errors.gstin ? 'border-red-500' : 'border-gray-700'
                }`}
              />
              {errors.gstin && (
                <p className="mt-1 text-sm text-red-400">{errors.gstin}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
