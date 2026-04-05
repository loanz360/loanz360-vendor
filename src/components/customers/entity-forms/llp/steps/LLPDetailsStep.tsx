'use client'

import React from 'react'
import { Scale, FileText, IndianRupee, Calendar, Building2 } from 'lucide-react'
import { LLPData, LLPStepProps } from '../../types/llp'
import { NATURE_OF_BUSINESS_OPTIONS, BUSINESS_CATEGORY_OPTIONS, GST_STATUS_OPTIONS, ANNUAL_TURNOVER_OPTIONS, ROC_OFFICES } from '../../types'

export default function LLPDetailsStep({ data, errors, onUpdate }: LLPStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">LLP Details</h2>
        <p className="text-gray-400">Enter the basic information about your Limited Liability Partnership</p>
      </div>

      {/* Basic Information */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>
            <p className="text-sm text-gray-500">LLP identity details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              LLP Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.llp_name}
              onChange={(e) => onUpdate({ llp_name: e.target.value })}
              placeholder="Enter LLP name as per MCA"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.llp_name ? 'border-red-500' : 'border-gray-700'}`}
            />
            {errors.llp_name && <p className="mt-1 text-sm text-red-400">{errors.llp_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              LLPIN <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.llpin}
              onChange={(e) => onUpdate({ llpin: e.target.value.toUpperCase() })}
              placeholder="AAA-0000"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.llpin ? 'border-red-500' : 'border-gray-700'}`}
            />
            {errors.llpin && <p className="mt-1 text-sm text-red-400">{errors.llpin}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date of Incorporation <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={data.date_of_incorporation}
                onChange={(e) => onUpdate({ date_of_incorporation: e.target.value })}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.date_of_incorporation ? 'border-red-500' : 'border-gray-700'}`}
              />
            </div>
            {errors.date_of_incorporation && <p className="mt-1 text-sm text-red-400">{errors.date_of_incorporation}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              ROC Office <span className="text-red-400">*</span>
            </label>
            <select
              value={data.roc_office}
              onChange={(e) => onUpdate({ roc_office: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.roc_office ? 'border-red-500' : 'border-gray-700'}`}
            >
              <option value="">Select ROC office</option>
              {ROC_OFFICES.map(roc => <option key={roc} value={roc}>{roc}</option>)}
            </select>
            {errors.roc_office && <p className="mt-1 text-sm text-red-400">{errors.roc_office}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nature of Business</label>
            <select
              value={data.nature_of_business}
              onChange={(e) => onUpdate({ nature_of_business: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="">Select nature of business</option>
              {NATURE_OF_BUSINESS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Business Category</label>
            <select
              value={data.business_category}
              onChange={(e) => onUpdate({ business_category: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="">Select business category</option>
              {BUSINESS_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
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
            <h3 className="text-lg font-semibold text-white">Registration & Tax Details</h3>
            <p className="text-sm text-gray-500">Legal and tax information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              LLP PAN Number <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.llp_pan}
              onChange={(e) => onUpdate({ llp_pan: e.target.value.toUpperCase() })}
              placeholder="ABCDE1234F"
              maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.llp_pan ? 'border-red-500' : 'border-gray-700'}`}
            />
            {errors.llp_pan && <p className="mt-1 text-sm text-red-400">{errors.llp_pan}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">CIN (if converted)</label>
            <input
              type="text"
              value={data.cin}
              onChange={(e) => onUpdate({ cin: e.target.value.toUpperCase() })}
              placeholder="Corporate Identity Number"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Authorized Capital (₹)</label>
            <input
              type="number"
              value={data.authorized_capital || ''}
              onChange={(e) => onUpdate({ authorized_capital: parseInt(e.target.value) || null })}
              placeholder="Enter amount"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Paid-up Capital (₹)</label>
            <input
              type="number"
              value={data.paid_up_capital || ''}
              onChange={(e) => onUpdate({ paid_up_capital: parseInt(e.target.value) || null })}
              placeholder="Enter amount"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Annual Turnover</label>
            <select
              value={data.annual_turnover}
              onChange={(e) => onUpdate({ annual_turnover: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="">Select turnover range</option>
              {ANNUAL_TURNOVER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">GST Registration Status</label>
            <select
              value={data.gst_registration_status}
              onChange={(e) => onUpdate({ gst_registration_status: e.target.value as LLPData['gst_registration_status'] })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="">Select GST status</option>
              {GST_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

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
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.gstin ? 'border-red-500' : 'border-gray-700'}`}
              />
              {errors.gstin && <p className="mt-1 text-sm text-red-400">{errors.gstin}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
