'use client'

import React from 'react'
import { Home, FileText, Calendar } from 'lucide-react'
import { HUFStepProps, HUF_BUSINESS_OPTIONS, ANNUAL_INCOME_RANGE_OPTIONS } from '../../types/huf'
import { GST_STATUS_OPTIONS } from '../../types'

export default function HUFDetailsStep({ data, errors, onUpdate }: HUFStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">HUF Details</h2>
        <p className="text-gray-400">Enter the basic information about your Hindu Undivided Family</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Home className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Basic Information</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">HUF Name <span className="text-red-400">*</span></label>
            <input type="text" value={data.huf_name} onChange={(e) => onUpdate({ huf_name: e.target.value })} placeholder="e.g., Sharma (HUF)"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.huf_name ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.huf_name && <p className="mt-1 text-sm text-red-400">{errors.huf_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date of Creation</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="date" value={data.date_of_creation} onChange={(e) => onUpdate({ date_of_creation: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nature of Business/Income</label>
            <select value={data.nature_of_huf_business} onChange={(e) => onUpdate({ nature_of_huf_business: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select type</option>
              {HUF_BUSINESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Annual Income Range</label>
            <select value={data.annual_income_range} onChange={(e) => onUpdate({ annual_income_range: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select range</option>
              {ANNUAL_INCOME_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Tax Details</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">HUF PAN <span className="text-red-400">*</span></label>
            <input type="text" value={data.huf_pan} onChange={(e) => onUpdate({ huf_pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234H" maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.huf_pan ? 'border-red-500' : 'border-gray-700'}`} />
            <p className="mt-1 text-xs text-gray-500">HUF PAN typically ends with 'H'</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">GST Status</label>
            <select value={data.gst_registration_status} onChange={(e) => onUpdate({ gst_registration_status: e.target.value as typeof data.gst_registration_status })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select status</option>
              {GST_STATUS_OPTIONS.filter(o => o.value !== 'COMPOSITION').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {data.gst_registration_status === 'REGISTERED' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">GSTIN <span className="text-red-400">*</span></label>
              <input type="text" value={data.gstin} onChange={(e) => onUpdate({ gstin: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" maxLength={15}
                className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.gstin ? 'border-red-500' : 'border-gray-700'}`} />
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <p className="text-orange-400 text-sm">Note: A Hindu Undivided Family (HUF) is a separate tax entity under Indian tax law. It consists of all persons lineally descended from a common ancestor, including their wives and unmarried daughters.</p>
      </div>
    </div>
  )
}
