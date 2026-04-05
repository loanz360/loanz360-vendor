'use client'

import React from 'react'
import { User, Phone, Mail, MapPin, Shield } from 'lucide-react'
import { OPCStepProps, OPCDirectorData } from '../../types/opc'
import { GENDER_OPTIONS, INDIAN_STATES } from '../../types'

export default function DirectorStep({ data, errors, onUpdate }: OPCStepProps) {
  const updateDirector = (updates: Partial<OPCDirectorData>) => {
    onUpdate({ director: { ...data.director, ...updates } })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Sole Director Details</h2>
        <p className="text-gray-400">Enter details of the sole director and shareholder of OPC</p>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-orange-400" />
          <p className="text-orange-400 text-sm">The sole director is also the sole shareholder in an OPC</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h4 className="font-semibold text-white">Director & Shareholder</h4>
            <p className="text-sm text-gray-500">{data.director.full_name || 'Enter details below'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">DIN <span className="text-red-400">*</span></label>
            <input type="text" value={data.director.din} onChange={(e) => updateDirector({ din: e.target.value })} placeholder="Director Identification Number"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.director_din ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.director_din && <p className="mt-1 text-sm text-red-400">{errors.director_din}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name <span className="text-red-400">*</span></label>
            <input type="text" value={data.director.full_name} onChange={(e) => updateDirector({ full_name: e.target.value })} placeholder="As per PAN"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.director_name ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.director_name && <p className="mt-1 text-sm text-red-400">{errors.director_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
            <input type="date" value={data.director.date_of_birth} onChange={(e) => updateDirector({ date_of_birth: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
            <select value={data.director.gender} onChange={(e) => updateDirector({ gender: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">PAN Number <span className="text-red-400">*</span></label>
            <input type="text" value={data.director.pan_number} onChange={(e) => updateDirector({ pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.director_pan ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.director_pan && <p className="mt-1 text-sm text-red-400">{errors.director_pan}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Aadhaar Number</label>
            <input type="text" value={data.director.aadhaar_number} onChange={(e) => updateDirector({ aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mobile <span className="text-red-400">*</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="tel" value={data.director.mobile} onChange={(e) => updateDirector({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile"
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.director_mobile ? 'border-red-500' : 'border-gray-700'}`} />
            </div>
            {errors.director_mobile && <p className="mt-1 text-sm text-red-400">{errors.director_mobile}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email <span className="text-red-400">*</span></label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="email" value={data.director.email} onChange={(e) => updateDirector({ email: e.target.value })} placeholder="email@example.com"
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.director_email ? 'border-red-500' : 'border-gray-700'}`} />
            </div>
            {errors.director_email && <p className="mt-1 text-sm text-red-400">{errors.director_email}</p>}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5 text-orange-400" />
            <h4 className="font-semibold text-white">Residential Address</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Address Line 1</label>
              <input type="text" value={data.director.residential_address_line1} onChange={(e) => updateDirector({ residential_address_line1: e.target.value })} placeholder="Flat/Building, Street"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Address Line 2</label>
              <input type="text" value={data.director.residential_address_line2} onChange={(e) => updateDirector({ residential_address_line2: e.target.value })} placeholder="Area, Landmark"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
              <input type="text" value={data.director.residential_city} onChange={(e) => updateDirector({ residential_city: e.target.value })} placeholder="City"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
              <select value={data.director.residential_state} onChange={(e) => updateDirector({ residential_state: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                <option value="">Select state</option>
                {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Pincode</label>
              <input type="text" value={data.director.residential_pincode} onChange={(e) => updateDirector({ residential_pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="6-digit" maxLength={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
