'use client'

import React from 'react'
import { Heart, FileText, Calendar } from 'lucide-react'
import { TrustStepProps, TRUST_TYPE_OPTIONS } from '../../types/trust'
import { GST_STATUS_OPTIONS } from '../../types'

export default function TrustDetailsStep({ data, errors, onUpdate }: TrustStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Trust Details</h2>
        <p className="text-gray-400">Enter the basic information about your Trust</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Basic Information</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Trust Name <span className="text-red-400">*</span></label>
            <input type="text" value={data.trust_name} onChange={(e) => onUpdate({ trust_name: e.target.value })} placeholder="Full trust name"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.trust_name ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.trust_name && <p className="mt-1 text-sm text-red-400">{errors.trust_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Trust Type <span className="text-red-400">*</span></label>
            <select value={data.trust_type} onChange={(e) => onUpdate({ trust_type: e.target.value as typeof data.trust_type })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.trust_type ? 'border-red-500' : 'border-gray-700'}`}>
              <option value="">Select trust type</option>
              {TRUST_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.trust_type && <p className="mt-1 text-sm text-red-400">{errors.trust_type}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date of Creation <span className="text-red-400">*</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="date" value={data.date_of_creation} onChange={(e) => onUpdate({ date_of_creation: e.target.value })}
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.date_of_creation ? 'border-red-500' : 'border-gray-700'}`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Trust Deed Number</label>
            <input type="text" value={data.trust_deed_number} onChange={(e) => onUpdate({ trust_deed_number: e.target.value })} placeholder="Deed registration number"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Registration Number</label>
            <input type="text" value={data.registration_number} onChange={(e) => onUpdate({ registration_number: e.target.value })} placeholder="Trust registration number"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Registering Authority</label>
            <input type="text" value={data.registering_authority} onChange={(e) => onUpdate({ registering_authority: e.target.value })} placeholder="Authority name"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Purpose of Trust</label>
            <textarea value={data.purpose_of_trust} onChange={(e) => onUpdate({ purpose_of_trust: e.target.value })} placeholder="Describe the main objectives of the trust"
              rows={3} className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Tax & Compliance Details</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Trust PAN <span className="text-red-400">*</span></label>
            <input type="text" value={data.trust_pan} onChange={(e) => onUpdate({ trust_pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 uppercase ${errors.trust_pan ? 'border-red-500' : 'border-gray-700'}`} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">12A Registration Number</label>
            <input type="text" value={data.registration_12a} onChange={(e) => onUpdate({ registration_12a: e.target.value })} placeholder="Section 12A registration"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">80G Registration Number</label>
            <input type="text" value={data.registration_80g} onChange={(e) => onUpdate({ registration_80g: e.target.value })} placeholder="Section 80G registration"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">FCRA Registration</label>
            <input type="text" value={data.fcra_registration} onChange={(e) => onUpdate({ fcra_registration: e.target.value })} placeholder="If applicable"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
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
    </div>
  )
}
