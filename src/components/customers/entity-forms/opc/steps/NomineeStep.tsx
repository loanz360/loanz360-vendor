'use client'

import React from 'react'
import { UserPlus, AlertCircle } from 'lucide-react'
import { OPCStepProps, NomineeData, NOMINEE_RELATIONSHIP_OPTIONS } from '../../types/opc'

export default function NomineeStep({ data, errors, onUpdate }: OPCStepProps) {
  const updateNominee = (updates: Partial<NomineeData>) => {
    onUpdate({ nominee: { ...data.nominee, ...updates } })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Nominee Director</h2>
        <p className="text-gray-400">Enter details of the nominee who will become director in case of death/incapacity of sole member</p>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Nominee Requirement</p>
            <p className="text-yellow-300 text-sm">As per Companies Act, every OPC must have a nominee who shall become the member of the company in the event of death or incapacity of the sole member.</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h4 className="font-semibold text-white">Nominee Details</h4>
            <p className="text-sm text-gray-500">{data.nominee.nominee_name || 'Enter nominee information'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nominee Name <span className="text-red-400">*</span></label>
            <input type="text" value={data.nominee.nominee_name} onChange={(e) => updateNominee({ nominee_name: e.target.value })} placeholder="Full name as per PAN"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.nominee_name ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.nominee_name && <p className="mt-1 text-sm text-red-400">{errors.nominee_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Relationship with Member <span className="text-red-400">*</span></label>
            <select value={data.nominee.relationship} onChange={(e) => updateNominee({ relationship: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.nominee_relationship ? 'border-red-500' : 'border-gray-700'}`}>
              <option value="">Select relationship</option>
              {NOMINEE_RELATIONSHIP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.nominee_relationship && <p className="mt-1 text-sm text-red-400">{errors.nominee_relationship}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nominee PAN <span className="text-red-400">*</span></label>
            <input type="text" value={data.nominee.nominee_pan} onChange={(e) => updateNominee({ nominee_pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.nominee_pan ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.nominee_pan && <p className="mt-1 text-sm text-red-400">{errors.nominee_pan}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nominee Aadhaar</label>
            <input type="text" value={data.nominee.nominee_aadhaar} onChange={(e) => updateNominee({ nominee_aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-400">
            <strong className="text-gray-300">Note:</strong> The nominee must give their consent in Form INC-3 which should be filed with the ROC at the time of incorporation.
          </p>
        </div>
      </div>
    </div>
  )
}
