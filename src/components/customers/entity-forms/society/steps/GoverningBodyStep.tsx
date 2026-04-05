'use client'

import React from 'react'
import { Users, Plus, Trash2, User, Phone, Mail, Shield } from 'lucide-react'
import { SocietyStepProps, GoverningBodyMemberData, GB_DESIGNATION_OPTIONS, createEmptyGBMember } from '../../types/society'
import { GENDER_OPTIONS } from '../../types'

export default function GoverningBodyStep({ data, errors, onUpdate }: SocietyStepProps) {
  const governing_body = data.governing_body || []

  const addMember = () => {
    if (governing_body.length >= 15) return
    onUpdate({ governing_body: [...governing_body, createEmptyGBMember()] })
  }

  const removeMember = (index: number) => {
    if (governing_body.length <= 3) return
    onUpdate({ governing_body: governing_body.filter((_, i) => i !== index) })
  }

  const updateMember = (index: number, updates: Partial<GoverningBodyMemberData>) => {
    const newMembers = [...governing_body]
    newMembers[index] = { ...newMembers[index], ...updates }
    onUpdate({ governing_body: newMembers })
  }

  const getDesignationColor = (designation: string) => {
    switch (designation) {
      case 'PRESIDENT': return 'bg-orange-500/20 text-orange-400'
      case 'SECRETARY': return 'bg-orange-500/20 text-orange-400'
      case 'TREASURER': return 'bg-orange-500/20 text-orange-400'
      default: return 'bg-gray-700 text-gray-400'
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Governing Body</h2>
          <p className="text-gray-400">Add office bearers (President, Secretary, Treasurer required)</p>
        </div>
        <button onClick={addMember} disabled={governing_body.length >= 15}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white rounded-lg">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Total Members</span></div>
          <p className="text-2xl font-bold text-white">{governing_body.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-orange-400" /><span className="text-sm text-gray-400">Key Positions</span></div>
          <p className="text-2xl font-bold text-white">
            {['PRESIDENT', 'SECRETARY', 'TREASURER'].filter(d => governing_body.some(m => m.designation === d)).length}/3
          </p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><span className="text-sm text-gray-400">Signatories</span></div>
          <p className="text-2xl font-bold text-white">{governing_body.filter(m => m.is_authorized_signatory).length}</p>
        </div>
      </div>

      {(errors.governing_body || errors.president || errors.secretary || errors.treasurer) && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{errors.governing_body || errors.president || errors.secretary || errors.treasurer}</p>
        </div>
      )}

      <div className="space-y-6">
        {governing_body.map((member, index) => (
          <div key={member.id} className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getDesignationColor(member.designation)}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Member {index + 1}
                    {member.designation && <span className={`ml-2 text-xs px-2 py-0.5 rounded ${getDesignationColor(member.designation)}`}>{GB_DESIGNATION_OPTIONS.find(o => o.value === member.designation)?.label}</span>}
                  </h4>
                  <p className="text-sm text-gray-500">{member.full_name || 'Enter details'}</p>
                </div>
              </div>
              {governing_body.length > 3 && <button onClick={() => removeMember(index)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-5 h-5" /></button>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Designation</label>
                <select value={member.designation} onChange={(e) => updateMember(index, { designation: e.target.value as GoverningBodyMemberData['designation'] })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select designation</option>
                  {GB_DESIGNATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name <span className="text-red-400">*</span></label>
                <input type="text" value={member.full_name} onChange={(e) => updateMember(index, { full_name: e.target.value })} placeholder="As per PAN"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`member_${index}_name`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
                <input type="date" value={member.date_of_birth} onChange={(e) => updateMember(index, { date_of_birth: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
                <select value={member.gender} onChange={(e) => updateMember(index, { gender: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PAN Number <span className="text-red-400">*</span></label>
                <input type="text" value={member.pan_number} onChange={(e) => updateMember(index, { pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10}
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${errors[`member_${index}_pan`] ? 'border-red-500' : 'border-gray-700'}`} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aadhaar Number</label>
                <input type="text" value={member.aadhaar_number} onChange={(e) => updateMember(index, { aadhaar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mobile</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" value={member.mobile} onChange={(e) => updateMember(index, { mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" value={member.email} onChange={(e) => updateMember(index, { email: e.target.value })} placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Occupation</label>
                <input type="text" value={member.occupation} onChange={(e) => updateMember(index, { occupation: e.target.value })} placeholder="Profession"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Appointment</label>
                <input type="date" value={member.date_of_appointment} onChange={(e) => updateMember(index, { date_of_appointment: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Term End Date</label>
                <input type="date" value={member.term_end_date} onChange={(e) => updateMember(index, { term_end_date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={member.is_authorized_signatory} onChange={(e) => updateMember(index, { is_authorized_signatory: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50" />
                  <span className="text-sm text-gray-300">Authorized Signatory</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {governing_body.length < 15 && (
        <button onClick={addMember} className="w-full py-4 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl text-gray-400 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" /> Add Another Member
        </button>
      )}
    </div>
  )
}
