'use client'

import React from 'react'
import { Users, Plus, Trash2, User, Phone, Mail, Shield } from 'lucide-react'
import { TrustStepProps, TrusteeData, TRUSTEE_TYPE_OPTIONS, createEmptyTrustee } from '../../types/trust'
import { GENDER_OPTIONS } from '../../types'

export default function TrusteesStep({ data, errors, onUpdate }: TrustStepProps) {
  const trustees = data.trustees || []

  const addTrustee = () => {
    if (trustees.length >= 10) return
    onUpdate({ trustees: [...trustees, createEmptyTrustee()] })
  }

  const removeTrustee = (index: number) => {
    if (trustees.length <= 1) return
    onUpdate({ trustees: trustees.filter((_, i) => i !== index) })
  }

  const updateTrustee = (index: number, updates: Partial<TrusteeData>) => {
    const newTrustees = [...trustees]
    newTrustees[index] = { ...newTrustees[index], ...updates }
    onUpdate({ trustees: newTrustees })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Trustees</h2>
          <p className="text-gray-400">Add all trustees of the trust (Min: 1)</p>
        </div>
        <button onClick={addTrustee} disabled={trustees.length >= 10}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white rounded-lg">
          <Plus className="w-4 h-4" /> Add Trustee
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Total Trustees</span></div>
          <p className="text-2xl font-bold text-white">{trustees.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Managing Trustees</span></div>
          <p className="text-2xl font-bold text-white">{trustees.filter(t => t.trustee_type === 'MANAGING_TRUSTEE').length}</p>
        </div>
      </div>

      {(errors.trustees || errors.managing_trustee) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{errors.trustees || errors.managing_trustee}</p>
        </div>
      )}

      <div className="space-y-6">
        {trustees.map((trustee, index) => (
          <div key={trustee.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trustee.trustee_type === 'MANAGING_TRUSTEE' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Trustee {index + 1}
                    {trustee.trustee_type === 'MANAGING_TRUSTEE' && <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Managing</span>}
                  </h4>
                  <p className="text-sm text-gray-500">{trustee.full_name || 'Enter details'}</p>
                </div>
              </div>
              {trustees.length > 1 && <button onClick={() => removeTrustee(index)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-5 h-5" /></button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Trustee Type</label>
                <select value={trustee.trustee_type} onChange={(e) => updateTrustee(index, { trustee_type: e.target.value as TrusteeData['trustee_type'] })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select type</option>
                  {TRUSTEE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name <span className="text-red-400">*</span></label>
                <input type="text" value={trustee.full_name} onChange={(e) => updateTrustee(index, { full_name: e.target.value })} placeholder="As per PAN"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`trustee_${index}_name`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
                <input type="date" value={trustee.date_of_birth} onChange={(e) => updateTrustee(index, { date_of_birth: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
                <select value={trustee.gender} onChange={(e) => updateTrustee(index, { gender: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PAN Number <span className="text-red-400">*</span></label>
                <input type="text" value={trustee.pan_number} onChange={(e) => updateTrustee(index, { pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`trustee_${index}_pan`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aadhaar Number</label>
                <input type="text" value={trustee.aadhaar_number} onChange={(e) => updateTrustee(index, { aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mobile</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" value={trustee.mobile} onChange={(e) => updateTrustee(index, { mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" value={trustee.email} onChange={(e) => updateTrustee(index, { email: e.target.value })} placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Occupation</label>
                <input type="text" value={trustee.occupation} onChange={(e) => updateTrustee(index, { occupation: e.target.value })} placeholder="Profession"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Appointment</label>
                <input type="date" value={trustee.date_of_appointment} onChange={(e) => updateTrustee(index, { date_of_appointment: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={trustee.is_authorized_signatory} onChange={(e) => updateTrustee(index, { is_authorized_signatory: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50" />
                  <span className="text-sm text-gray-300">Authorized Signatory</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {trustees.length < 10 && (
        <button onClick={addTrustee} className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Add Another Trustee
        </button>
      )}
    </div>
  )
}
