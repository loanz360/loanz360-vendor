'use client'

import React, { useState, useEffect } from 'react'
import { Users, Grid3x3, List, Info } from 'lucide-react'
import MemberCard, { MemberData } from '../../shared/MemberCard'
import MemberFormModal from '../../shared/MemberFormModal'

interface MembersStepEnhancedProps {
  data: unknown; errors: Record<string, string>
  onUpdate: (updates: unknown) => void
}

export default function MembersStepEnhanced({ data, errors, onUpdate }: MembersStepEnhancedProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null)
  const [numMembers, setNumMembers] = useState(data.governing_body?.length || 7)
  const [members, setMembers] = useState<(MemberData | null)[]>([])

  // Initialize members array based on governing_body
  useEffect(() => {
    const initialMembers = Array.from({ length: numMembers }, (_, i) => {
      const existingMember = data.governing_body?.[i]
      if (existingMember && existingMember.full_name) {
        return {
          id: existingMember.id || `member-${i}`,
          full_name: existingMember.full_name,
          mobile: existingMember.mobile || '',
          email: existingMember.email || '',
          pan_number: existingMember.pan_number || '',
          aadhaar_number: existingMember.aadhaar_number,
          role: existingMember.designation || 'MEMBER',
          designation: existingMember.designation,
          capital_contribution_percent: 0,
          profit_sharing_percent: 0,
          photo_url: '',
          is_signatory: ['PRESIDENT', 'SECRETARY', 'TREASURER'].includes(existingMember.designation),
          can_apply_loan: existingMember.designation === 'PRESIDENT',
          is_filled: true
        } as MemberData
      }
      return null
    })
    setMembers(initialMembers)
  }, [numMembers, data.governing_body])

  const handleNumMembersChange = (num: number) => {
    const clampedNum = Math.min(Math.max(num, 7), 50) // Min 7, Max 50
    setNumMembers(clampedNum)

    // Adjust members array
    const newMembers = [...members]
    if (clampedNum > members.length) {
      while (newMembers.length < clampedNum) {
        newMembers.push(null)
      }
    } else if (clampedNum < members.length) {
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
    const governing_body = data.governing_body || []
    const newGoverningBody = [...governing_body]
    if (newGoverningBody[index]) {
      newGoverningBody.splice(index, 1)
    }
    onUpdate({ governing_body: newGoverningBody })
  }

  const handleSaveMember = (member: MemberData) => {
    if (editingMemberIndex === null) return

    const newMembers = [...members]
    newMembers[editingMemberIndex] = member
    setMembers(newMembers)

    // Convert to society format and update parent
    const governing_body = data.governing_body || []
    const newGoverningBody = [...governing_body]
    newGoverningBody[editingMemberIndex] = {
      id: member.id,
      full_name: member.full_name,
      mobile: member.mobile,
      email: member.email,
      pan_number: member.pan_number,
      aadhaar_number: member.aadhaar_number,
      designation: member.role,
      date_of_birth: '',
      gender: '',
      father_name: ''
    }
    onUpdate({ governing_body: newGoverningBody })
  }

  // Calculate stats
  const filledMembers = members.filter(m => m?.is_filled) as MemberData[]
  const hasPresident = filledMembers.some(m => m.role === 'PRESIDENT')
  const hasSecretary = filledMembers.some(m => m.role === 'SECRETARY')
  const hasTreasurer = filledMembers.some(m => m.role === 'TREASURER')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Governing Body Members</h2>
        <p className="text-gray-400">
          Add all governing body members of this society
        </p>
      </div>

      {/* Number of Members Input */}
      <div className="max-w-md mx-auto p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          How many governing body members? <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNumMembersChange(numMembers - 1)}
            disabled={numMembers <= 7}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="7"
            max="50"
            value={numMembers}
            onChange={(e) => handleNumMembersChange(parseInt(e.target.value) || 7)}
            className="flex-1 text-center px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <button
            onClick={() => handleNumMembersChange(numMembers + 1)}
            disabled={numMembers >= 50}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Minimum: 7 members, Maximum: 50 members
        </p>
      </div>

      {/* Summary Stats */}
      <div className="max-w-md mx-auto">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">Members Added</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {filledMembers.length} / {numMembers}
          </p>
          <p className="text-xs text-gray-500">
            {numMembers - filledMembers.length} remaining
          </p>
        </div>
      </div>

      {/* Validation Warnings */}
      {filledMembers.length > 0 && (!hasPresident || !hasSecretary || !hasTreasurer) && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">Required office bearers missing</p>
              <ul className="text-sm text-gray-300 mt-1 space-y-1">
                {!hasPresident && <li>• President is required</li>}
                {!hasSecretary && <li>• Secretary is required</li>}
                {!hasTreasurer && <li>• Treasurer is required</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Click on cards to add/edit member details
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
            onDelete={filledMembers.length > 7 ? () => handleDeleteMember(index) : undefined}
            entityType="SOCIETY"
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
              When you submit this entity, we'll automatically create customer profiles for all governing body members
              and send them login credentials via SMS & Email. This allows each member to independently
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
        entityType="SOCIETY"
      />
    </div>
  )
}
