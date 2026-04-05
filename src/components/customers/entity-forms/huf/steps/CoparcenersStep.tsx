'use client'

import React from 'react'
import { Users, Plus, Trash2, User } from 'lucide-react'
import {
  HUFStepProps,
  CoparcenerData,
  RELATIONSHIP_TO_KARTA_OPTIONS,
  createEmptyCoparcener
} from '../../types/huf'
import { GENDER_OPTIONS } from '../../types'

export default function CoparcenersStep({ data, errors, onUpdate }: HUFStepProps) {
  const coparceners = data.coparceners || []

  const addCoparcener = () => {
    onUpdate({
      coparceners: [...coparceners, createEmptyCoparcener()]
    })
  }

  const removeCoparcener = (id: string) => {
    if (coparceners.length <= 1) return
    onUpdate({
      coparceners: coparceners.filter(c => c.id !== id)
    })
  }

  const updateCoparcener = (id: string, updates: Partial<CoparcenerData>) => {
    onUpdate({
      coparceners: coparceners.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Coparceners</h2>
            <p className="text-gray-400 text-sm">Family members of the HUF</p>
          </div>
        </div>
        <button
          onClick={addCoparcener}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      <div className="space-y-6">
        {coparceners.map((member, index) => (
          <div key={member.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">
                    Coparcener {index + 1}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {member.full_name || 'Enter member details'}
                  </p>
                </div>
              </div>
              {coparceners.length > 1 && (
                <button
                  onClick={() => removeCoparcener(member.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={member.full_name}
                  onChange={(e) => updateCoparcener(member.id, { full_name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Relationship to Karta */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Relationship to Karta
                </label>
                <select
                  value={member.relationship_to_karta}
                  onChange={(e) => updateCoparcener(member.id, { relationship_to_karta: e.target.value })}
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                    errors[`coparcener_${index}_relationship`] ? 'border-red-500' : 'border-gray-700'
                  }`}
                >
                  <option value="">Select relationship</option>
                  {RELATIONSHIP_TO_KARTA_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors[`coparcener_${index}_relationship`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`coparcener_${index}_relationship`]}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={member.date_of_birth}
                  onChange={(e) => updateCoparcener(member.id, { date_of_birth: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gender
                </label>
                <select
                  value={member.gender}
                  onChange={(e) => updateCoparcener(member.id, { gender: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* PAN Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  PAN Number
                </label>
                <input
                  type="text"
                  value={member.pan_number}
                  onChange={(e) => updateCoparcener(member.id, { pan_number: e.target.value.toUpperCase() })}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Aadhaar Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  value={member.aadhaar_number}
                  onChange={(e) => updateCoparcener(member.id, { aadhaar_number: e.target.value.replace(/\D/g, '') })}
                  maxLength={12}
                  placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <p className="text-orange-300 text-sm">
          Add all family members who are part of the HUF. Include sons, daughters, wife, and other coparceners.
        </p>
      </div>
    </div>
  )
}
