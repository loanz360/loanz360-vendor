'use client'

import React from 'react'
import { Users, Plus, Trash2, User, Phone, Mail, Shield } from 'lucide-react'
import { PublicLimitedStepProps, PublicDirectorData, PUBLIC_DIRECTOR_TYPE_OPTIONS, createEmptyPublicDirector } from '../../types/public-limited'
import { GENDER_OPTIONS } from '../../types'

export default function DirectorsStep({ data, errors, onUpdate }: PublicLimitedStepProps) {
  const directors = data.directors || []

  const addDirector = () => {
    if (directors.length >= 15) return
    onUpdate({ directors: [...directors, createEmptyPublicDirector()] })
  }

  const removeDirector = (index: number) => {
    if (directors.length <= 3) return
    onUpdate({ directors: directors.filter((_, i) => i !== index) })
  }

  const updateDirector = (index: number, updates: Partial<PublicDirectorData>) => {
    const newDirectors = [...directors]
    newDirectors[index] = { ...newDirectors[index], ...updates }
    onUpdate({ directors: newDirectors })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Directors</h2>
          <p className="text-gray-400">Add all directors (Min: 3, Max: 15 for Public Limited)</p>
        </div>
        <button onClick={addDirector} disabled={directors.length >= 15}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white rounded-lg">
          <Plus className="w-4 h-4" /> Add Director
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Total Directors</span></div>
          <p className="text-2xl font-bold text-white">{directors.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Independent Directors</span></div>
          <p className="text-2xl font-bold text-white">{directors.filter(d => d.director_type === 'INDEPENDENT_DIRECTOR').length}</p>
        </div>
      </div>

      {errors.directors && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"><p className="text-sm text-red-400">{errors.directors}</p></div>}

      <div className="space-y-6">
        {directors.map((director, index) => (
          <div key={director.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${director.director_type === 'MANAGING_DIRECTOR' ? 'bg-orange-500/20 text-orange-400' : director.director_type === 'INDEPENDENT_DIRECTOR' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Director {index + 1}
                    {director.director_type === 'MANAGING_DIRECTOR' && <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">MD</span>}
                    {director.director_type === 'INDEPENDENT_DIRECTOR' && <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">ID</span>}
                  </h4>
                  <p className="text-sm text-gray-500">{director.full_name || 'Enter details'}</p>
                </div>
              </div>
              {directors.length > 3 && <button onClick={() => removeDirector(index)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-5 h-5" /></button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Director Type</label>
                <select value={director.director_type} onChange={(e) => updateDirector(index, { director_type: e.target.value as PublicDirectorData['director_type'] })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select type</option>
                  {PUBLIC_DIRECTOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">DIN <span className="text-red-400">*</span></label>
                <input type="text" value={director.din} onChange={(e) => updateDirector(index, { din: e.target.value })} placeholder="Director Identification Number"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`director_${index}_din`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name <span className="text-red-400">*</span></label>
                <input type="text" value={director.full_name} onChange={(e) => updateDirector(index, { full_name: e.target.value })} placeholder="As per PAN"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`director_${index}_name`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
                <input type="date" value={director.date_of_birth} onChange={(e) => updateDirector(index, { date_of_birth: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
                <select value={director.gender} onChange={(e) => updateDirector(index, { gender: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PAN Number <span className="text-red-400">*</span></label>
                <input type="text" value={director.pan_number} onChange={(e) => updateDirector(index, { pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`director_${index}_pan`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aadhaar Number</label>
                <input type="text" value={director.aadhaar_number} onChange={(e) => updateDirector(index, { aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mobile</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" value={director.mobile} onChange={(e) => updateDirector(index, { mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" value={director.email} onChange={(e) => updateDirector(index, { email: e.target.value })} placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Appointment</label>
                <input type="date" value={director.date_of_appointment} onChange={(e) => updateDirector(index, { date_of_appointment: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={director.has_digital_signature} onChange={(e) => updateDirector(index, { has_digital_signature: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50" />
                  <span className="text-sm text-gray-300">Has DSC</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={director.is_authorized_signatory} onChange={(e) => updateDirector(index, { is_authorized_signatory: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50" />
                  <span className="text-sm text-gray-300">Signatory</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {directors.length < 15 && (
        <button onClick={addDirector} className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Add Another Director
        </button>
      )}
    </div>
  )
}
