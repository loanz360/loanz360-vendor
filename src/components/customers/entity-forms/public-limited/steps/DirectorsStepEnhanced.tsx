'use client'

import React, { useState, useEffect } from 'react'
import { Users, Grid3x3, List, Info } from 'lucide-react'
import MemberCard, { MemberData } from '../../shared/MemberCard'
import MemberFormModal from '../../shared/MemberFormModal'
import { PublicLimitedStepProps } from '../../types/public-limited'

export default function DirectorsStepEnhanced({ data, errors, onUpdate }: PublicLimitedStepProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null)
  const [numDirectors, setNumDirectors] = useState(data.num_directors || 3)
  const [members, setMembers] = useState<(MemberData | null)[]>([])

  // Initialize members array based on num_directors
  useEffect(() => {
    const initialMembers = Array.from({ length: numDirectors }, (_, i) => {
      // Check if we have existing director data
      const existingDirector = data.directors?.[i]
      if (existingDirector && existingDirector.full_name) {
        return {
          id: existingDirector.id || `director-${i}`,
          full_name: existingDirector.full_name,
          mobile: existingDirector.mobile || '',
          email: existingDirector.email || '',
          pan_number: existingDirector.pan_number || '',
          aadhaar_number: existingDirector.aadhaar_number,
          role: existingDirector.director_type || '',
          designation: existingDirector.din,
          capital_contribution_percent: existingDirector.shareholding_percentage,
          profit_sharing_percent: existingDirector.shareholding_percentage,
          photo_url: '',
          is_signatory: existingDirector.is_authorized_signatory || false,
          can_apply_loan: false,
          is_filled: true
        } as MemberData
      }
      return null
    })
    setMembers(initialMembers)
  }, [numDirectors, data.directors])

  const handleNumDirectorsChange = (num: number) => {
    const clampedNum = Math.min(Math.max(num, 3), 15) // Min 3, Max 15 for public companies
    setNumDirectors(clampedNum)
    onUpdate({ num_directors: clampedNum })

    // Adjust members array
    const newMembers = [...members]
    if (clampedNum > members.length) {
      // Add new empty slots
      while (newMembers.length < clampedNum) {
        newMembers.push(null)
      }
    } else if (clampedNum < members.length) {
      // Remove excess members
      newMembers.splice(clampedNum)
    }
    setMembers(newMembers)
  }

  const handleAddMember = (index: number) => {
    setEditingMemberIndex(index)
    setIsModalOpen(true)
  }

  const handleEditMember = (index: number) => {
    setEditingMemberIndex(index)
    setIsModalOpen(true)
  }

  const handleDeleteMember = (index: number) => {
    const newMembers = [...members]
    newMembers[index] = null
    setMembers(newMembers)

    // Update parent form data
    const directors = data.directors || []
    const newDirectors = [...directors]
    if (newDirectors[index]) {
      newDirectors[index] = {
        id: ``,
        full_name: '',
        mobile: '',
        email: '',
        pan_number: '',
        din: '',
        director_type: '',
        shareholding_percentage: 0
      }
    }
    onUpdate({ directors: newDirectors })
  }

  const handleSaveMember = (member: MemberData) => {
    if (editingMemberIndex === null) return

    const newMembers = [...members]
    newMembers[editingMemberIndex] = member
    setMembers(newMembers)

    // Convert to director format and update parent
    const directors = data.directors || []
    const newDirectors = [...directors]
    newDirectors[editingMemberIndex] = {
      id: member.id,
      full_name: member.full_name,
      mobile: member.mobile,
      email: member.email,
      pan_number: member.pan_number,
      aadhaar_number: member.aadhaar_number,
      director_type: member.role,
      din: member.designation || '',
      shareholding_percentage: member.capital_contribution_percent || 0,
      date_of_birth: '',
      gender: '',
      is_authorized_signatory: member.is_signatory || false
    }
    onUpdate({ directors: newDirectors })
  }

  // Calculate totals
  const filledMembers = members.filter(m => m?.is_filled) as MemberData[]
  const totalShares = filledMembers.reduce((sum, m) => sum + (m.capital_contribution_percent || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Directors</h2>
        <p className="text-gray-400">
          Add all directors of the public limited company (minimum 3, maximum 15)
        </p>
      </div>

      {/* Number of Directors Input */}
      <div className="max-w-md mx-auto p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          How many directors in this company? <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNumDirectorsChange(numDirectors - 1)}
            disabled={numDirectors <= 3}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="3"
            max="15"
            value={numDirectors}
            onChange={(e) => handleNumDirectorsChange(parseInt(e.target.value) || 3)}
            className="flex-1 text-center px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <button
            onClick={() => handleNumDirectorsChange(numDirectors + 1)}
            disabled={numDirectors >= 15}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Minimum: 3 directors, Maximum: 15 directors
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">Directors Added</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {filledMembers.length} / {numDirectors}
          </p>
          <p className="text-xs text-gray-500">
            {numDirectors - filledMembers.length} remaining
          </p>
        </div>

        <div className={`border rounded-xl p-4 ${
          totalShares === 100 ? 'bg-green-500/10 border-green-500/30' :
          totalShares > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Total Shareholding</span>
          </div>
          <p className={`text-2xl font-bold ${
            totalShares === 100 ? 'text-green-400' :
            totalShares > 100 ? 'text-red-400' : 'text-white'
          }`}>
            {totalShares.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500">From directors only</p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Click on cards to add/edit director details
        </p>
        <div className="flex gap-2 p-1 bg-gray-800 rounded-lg border border-gray-700">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded transition-colors ${
              viewMode === 'grid'
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-orange-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Member Cards */}
      <div className={
        viewMode === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'space-y-3'
      }>
        {members.map((member, index) => (
          <MemberCard
            key={index}
            member={member}
            index={index}
            viewMode={viewMode}
            onAdd={() => handleAddMember(index)}
            onEdit={() => handleEditMember(index)}
            onDelete={filledMembers.length > 3 ? () => handleDeleteMember(index) : undefined}
            entityType="PUBLIC_LIMITED"
          />
        ))}
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-1">Auto-Create Member Profiles</p>
            <p>
              When you submit this entity, we'll automatically create customer profiles for all directors
              and send them login credentials via SMS & Email. This allows each director to independently
              access the LOANZ 360 platform.
            </p>
          </div>
        </div>
      </div>

      {/* Member Form Modal */}
      <MemberFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingMemberIndex(null)
        }}
        onSave={handleSaveMember}
        member={editingMemberIndex !== null ? members[editingMemberIndex] : null}
        memberIndex={editingMemberIndex ?? 0}
        entityType="PUBLIC_LIMITED"
      />
    </div>
  )
}
