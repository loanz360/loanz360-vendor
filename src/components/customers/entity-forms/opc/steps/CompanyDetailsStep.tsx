'use client'

import React from 'react'
import { Building, FileText, Calendar } from 'lucide-react'
import { OPCStepProps } from '../../types/opc'
import { NATURE_OF_BUSINESS_OPTIONS, GST_STATUS_OPTIONS, ANNUAL_TURNOVER_OPTIONS, ROC_OFFICES, BUSINESS_CATEGORY_OPTIONS } from '../../types'

export default function CompanyDetailsStep({ data, errors, onUpdate }: OPCStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Company Details</h2>
        <p className="text-gray-400">Enter the basic information about your One Person Company</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Building className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Basic Information</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Company Name <span className="text-red-400">*</span></label>
            <input type="text" value={data.company_name} onChange={(e) => onUpdate({ company_name: e.target.value })} placeholder="As per MCA"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.company_name ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.company_name && <p className="mt-1 text-sm text-red-400">{errors.company_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">CIN <span className="text-red-400">*</span></label>
            <input type="text" value={data.cin} onChange={(e) => onUpdate({ cin: e.target.value.toUpperCase() })} placeholder="Corporate Identity Number"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.cin ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.cin && <p className="mt-1 text-sm text-red-400">{errors.cin}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date of Incorporation <span className="text-red-400">*</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="date" value={data.date_of_incorporation} onChange={(e) => onUpdate({ date_of_incorporation: e.target.value })}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.date_of_incorporation ? 'border-red-500' : 'border-gray-700'}`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">ROC Office <span className="text-red-400">*</span></label>
            <select value={data.roc_office} onChange={(e) => onUpdate({ roc_office: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.roc_office ? 'border-red-500' : 'border-gray-700'}`}>
              <option value="">Select ROC office</option>
              {ROC_OFFICES.map(roc => <option key={roc} value={roc}>{roc}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nature of Business</label>
            <select value={data.nature_of_business} onChange={(e) => onUpdate({ nature_of_business: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select business type</option>
              {NATURE_OF_BUSINESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Business Category</label>
            <select value={data.business_category} onChange={(e) => onUpdate({ business_category: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select category</option>
              {BUSINESS_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Registration & Financial Details</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Company PAN <span className="text-red-400">*</span></label>
            <input type="text" value={data.company_pan} onChange={(e) => onUpdate({ company_pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.company_pan ? 'border-red-500' : 'border-gray-700'}`} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Annual Turnover</label>
            <select value={data.annual_turnover} onChange={(e) => onUpdate({ annual_turnover: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select turnover range</option>
              {ANNUAL_TURNOVER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Authorized Capital (Rs.)</label>
            <input type="number" value={data.authorized_capital || ''} onChange={(e) => onUpdate({ authorized_capital: parseInt(e.target.value) || null })} placeholder="Enter amount"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Paid-up Capital (Rs.)</label>
            <input type="number" value={data.paid_up_capital || ''} onChange={(e) => onUpdate({ paid_up_capital: parseInt(e.target.value) || null })} placeholder="Enter amount"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">GST Status</label>
            <select value={data.gst_registration_status} onChange={(e) => onUpdate({ gst_registration_status: e.target.value as typeof data.gst_registration_status })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select status</option>
              {GST_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        <p className="text-orange-400 text-sm">Note: OPC (One Person Company) can have only one director who is also the sole shareholder. A nominee director must be appointed as per Section 2(62) of Companies Act.</p>
      </div>
    </div>
  )
}
