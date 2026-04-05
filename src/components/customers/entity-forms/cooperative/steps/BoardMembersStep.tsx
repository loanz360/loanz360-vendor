'use client'

import React from 'react'
import { Users, Plus, Trash2, User } from 'lucide-react'
import {
  CooperativeStepProps,
  BoardMemberData,
  BOARD_DESIGNATION_OPTIONS,
  createEmptyBoardMember
} from '../../types/cooperative'
import { GENDER_OPTIONS } from '../../types'

export default function BoardMembersStep({ data, errors, onUpdate }: CooperativeStepProps) {
  const board_members = data.board_members || []

  const addBoardMember = () => {
    onUpdate({
      board_members: [...board_members, createEmptyBoardMember()]
    })
  }

  const removeBoardMember = (id: string) => {
    if (board_members.length <= 3) return
    onUpdate({
      board_members: board_members.filter(m => m.id !== id)
    })
  }

  const updateBoardMember = (id: string, updates: Partial<BoardMemberData>) => {
    onUpdate({
      board_members: board_members.map(m =>
        m.id === id ? { ...m, ...updates } : m
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
            <h2 className="text-xl font-bold text-white">Board Members</h2>
            <p className="text-gray-400 text-sm">Details of Managing Committee / Board of Directors</p>
          </div>
        </div>
        <button
          onClick={addBoardMember}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {errors.board_members && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{errors.board_members}</p>
        </div>
      )}

      <div className="space-y-6">
        {board_members.map((member, index) => (
          <div key={member.id} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">
                    {member.designation
                      ? BOARD_DESIGNATION_OPTIONS.find(d => d.value === member.designation)?.label
                      : `Board Member ${index + 1}`}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {member.full_name || 'Enter member details'}
                  </p>
                </div>
              </div>
              {board_members.length > 3 && (
                <button
                  onClick={() => removeBoardMember(member.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Designation <span className="text-red-400">*</span>
                </label>
                <select
                  value={member.designation}
                  onChange={(e) => updateBoardMember(member.id, { designation: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  <option value="">Select designation</option>
                  {BOARD_DESIGNATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={member.full_name}
                  onChange={(e) => updateBoardMember(member.id, { full_name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={member.date_of_birth}
                  onChange={(e) => updateBoardMember(member.id, { date_of_birth: e.target.value })}
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
                  onChange={(e) => updateBoardMember(member.id, { gender: e.target.value })}
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
                  PAN Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={member.pan_number}
                  onChange={(e) => updateBoardMember(member.id, { pan_number: e.target.value.toUpperCase() })}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                    errors[`board_${index}_pan`] ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
                {errors[`board_${index}_pan`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`board_${index}_pan`]}</p>
                )}
              </div>

              {/* Aadhaar Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aadhaar Number
                </label>
                <input
                  type="text"
                  value={member.aadhaar_number}
                  onChange={(e) => updateBoardMember(member.id, { aadhaar_number: e.target.value.replace(/\D/g, '') })}
                  maxLength={12}
                  placeholder="XXXX XXXX XXXX"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={member.mobile}
                  onChange={(e) => updateBoardMember(member.id, { mobile: e.target.value.replace(/\D/g, '') })}
                  maxLength={10}
                  placeholder="Enter 10-digit mobile"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={member.email}
                  onChange={(e) => updateBoardMember(member.id, { email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Member ID */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Member ID
                </label>
                <input
                  type="text"
                  value={member.member_id}
                  onChange={(e) => updateBoardMember(member.id, { member_id: e.target.value })}
                  placeholder="Society member ID"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Shares Held */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Shares Held
                </label>
                <input
                  type="number"
                  value={member.shares_held || ''}
                  onChange={(e) => updateBoardMember(member.id, { shares_held: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Number of shares"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Date of Election */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Election
                </label>
                <input
                  type="date"
                  value={member.date_of_election}
                  onChange={(e) => updateBoardMember(member.id, { date_of_election: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Term End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Term End Date
                </label>
                <input
                  type="date"
                  value={member.term_end_date}
                  onChange={(e) => updateBoardMember(member.id, { term_end_date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Is Authorized Signatory */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={member.is_authorized_signatory}
                    onChange={(e) => updateBoardMember(member.id, { is_authorized_signatory: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/50"
                  />
                  <span className="text-gray-300">This member is an authorized signatory for the society</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <p className="text-orange-300 text-sm">
          At minimum, Chairman, Secretary, and Treasurer details are required. You can add additional board members as needed.
        </p>
      </div>
    </div>
  )
}
