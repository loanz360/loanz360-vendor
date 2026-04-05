'use client'

import React from 'react'
import { User, Phone, Mail, Crown } from 'lucide-react'
import { HUFStepProps, KartaData } from '../../types/huf'
import { GENDER_OPTIONS } from '../../types'

export default function KartaStep({ data, errors, onUpdate }: HUFStepProps) {
  const updateKarta = (updates: Partial<KartaData>) => {
    onUpdate({ karta: { ...data.karta, ...updates } })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Karta Details</h2>
        <p className="text-gray-400">Enter details of the Karta (Head) of the HUF</p>
      </div>

      <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <div className="flex items-center gap-3">
          <Crown className="w-5 h-5 text-orange-400" />
          <p className="text-orange-400 text-sm">The Karta is the senior-most male member who manages the HUF and has the authority to enter into contracts on behalf of the HUF.</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h4 className="font-semibold text-white">Karta (Head of HUF)</h4>
            <p className="text-sm text-gray-500">{data.karta.full_name || 'Enter details below'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name <span className="text-red-400">*</span></label>
            <input type="text" value={data.karta.full_name} onChange={(e) => updateKarta({ full_name: e.target.value })} placeholder="As per PAN"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.karta_name ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.karta_name && <p className="mt-1 text-sm text-red-400">{errors.karta_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
            <input type="date" value={data.karta.date_of_birth} onChange={(e) => updateKarta({ date_of_birth: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
            <select value={data.karta.gender} onChange={(e) => updateKarta({ gender: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">PAN Number <span className="text-red-400">*</span></label>
            <input type="text" value={data.karta.pan_number} onChange={(e) => updateKarta({ pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.karta_pan ? 'border-red-500' : 'border-gray-700'}`} />
            {errors.karta_pan && <p className="mt-1 text-sm text-red-400">{errors.karta_pan}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Aadhaar Number</label>
            <input type="text" value={data.karta.aadhaar_number} onChange={(e) => updateKarta({ aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mobile <span className="text-red-400">*</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="tel" value={data.karta.mobile} onChange={(e) => updateKarta({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile"
                className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors.karta_mobile ? 'border-red-500' : 'border-gray-700'}`} />
            </div>
            {errors.karta_mobile && <p className="mt-1 text-sm text-red-400">{errors.karta_mobile}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input type="email" value={data.karta.email} onChange={(e) => updateKarta({ email: e.target.value })} placeholder="email@example.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
