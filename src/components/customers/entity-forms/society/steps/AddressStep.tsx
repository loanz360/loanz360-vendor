'use client'

import React from 'react'
import { Building2 } from 'lucide-react'
import { SocietyStepProps } from '../../types/society'
import { INDIAN_STATES } from '../../types'

export default function AddressStep({ data, errors, onUpdate }: SocietyStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Registered Office Address</h2>
        <p className="text-gray-400">Enter the registered office address of the society</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-400" />
          </div>
          <div><h3 className="text-lg font-semibold text-white">Registered Office</h3></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Address Line 1 <span className="text-red-400">*</span></label>
            <input type="text" value={data.registered_address_line1} onChange={(e) => onUpdate({ registered_address_line1: e.target.value })} placeholder="Building/Flat No., Street Name"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.registered_address_line1 ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.registered_address_line1 && <p className="mt-1 text-sm text-red-400">{errors.registered_address_line1}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Address Line 2</label>
            <input type="text" value={data.registered_address_line2} onChange={(e) => onUpdate({ registered_address_line2: e.target.value })} placeholder="Area, Landmark"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Pincode <span className="text-red-400">*</span></label>
            <input type="text" value={data.registered_pincode} onChange={(e) => onUpdate({ registered_pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6-digit" maxLength={6}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.registered_pincode ? 'border-red-500' : 'border-gray-700'}`} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">City <span className="text-red-400">*</span></label>
            <input type="text" value={data.registered_city} onChange={(e) => onUpdate({ registered_city: e.target.value })} placeholder="City name"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.registered_city ? 'border-red-500' : 'border-gray-700'}`} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">State <span className="text-red-400">*</span></label>
            <select value={data.registered_state} onChange={(e) => onUpdate({ registered_state: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.registered_state ? 'border-red-500' : 'border-gray-700'}`}>
              <option value="">Select state</option>
              {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
