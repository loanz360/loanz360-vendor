'use client'

import React, { useState, useEffect } from 'react'
import { Users, Grid3x3, List, Info } from 'lucide-react'
import MemberCard, { MemberData } from '../../shared/MemberCard'
import MemberFormModal from '../../shared/MemberFormModal'

interface TrusteesStepEnhancedProps {
  data: any
  errors: Record<string, string>
  onUpdate: (updates: any) => void
}

export default function TrusteesStepEnhanced({ data, errors, onUpdate }: TrusteesStepEnhancedProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null)
  const [numTrustees, setNumTrustees] = useState(data.trustees?.length || 2)
  const [members, setMembers] = useState<(MemberData | null)[]>([])

  // Initialize members array based on trustees
  useEffect(() => {
    const initialMembers = Array.from({ length: numTrustees }, (_, i) => {
      const existingTrustee = data.trustees?.[i]
      if (existingTrustee && existingTrustee.full_name) {
        return {
          id: existingTrustee.id || `trustee-${i}`,
          full_name: existingTrustee.full_name,
          mobile: existingTrustee.mobile || '',
          email: existingTrustee.email || '',
          pan_number: existingTrustee.pan_number || '',
          aadhaar_number: existingTrustee.aadhaar_number,
          role: existingTrustee.trustee_type || 'TRUSTEE',
          designation: existingTrustee.designation,
          capital_contribution_percent: 0,
          profit_sharing_percent: 0,
          photo_url: '',
          is_signatory: existingTrustee.trustee_type === 'MANAGING_TRUSTEE',
          can_apply_loan: existingTrustee.trustee_type === 'MANAGING_TRUSTEE',
          is_filled: true
        } as MemberData
      }
      return null
    })
    setMembers(initialMembers)
  }, [numTrustees, data.trustees])

  const handleNumTrusteesChange = (num: number) => {
    const clampedNum = Math.min(Math.max(num, 2), 15) // Min 2, Max 15
    setNumTrustees(clampedNum)

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
    const trustees = data.trustees || []
    const newTrustees = [...trustees]
    if (newTrustees[index]) {
      newTrustees.splice(index, 1)
    }
    onUpdate({ trustees: newTrustees })
  }

  const handleSaveMember = (member: MemberData) => {
    if (editingMemberIndex === null) return

    const newMembers = [...members]
    newMembers[editingMemberIndex] = member
    setMembers(newMembers)

    // Convert to trust format and update parent
    const trustees = data.trustees || []
    const newTrustees = [...trustees]
    newTrustees[editingMemberIndex] = {
      id: member.id,
      full_name: member.full_name,
      mobile: member.mobile,
      email: member.email,
      pan_number: member.pan_number,
      aadhaar_number: member.aadhaar_number,
      trustee_type: member.role,
      designation: member.designation,
      date_of_birth: '',
      gender: '',
      father_name: ''
    }
    onUpdate({ trustees: newTrustees })
  }

  // Calculate stats
  const filledMembers = members.filter(m => m?.is_filled) as MemberData[]
  const hasManagingTrustee = filledMembers.some(m => m.role === 'MANAGING_TRUSTEE')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Trustees</h2>
        <p className="text-gray-400">
          Add all trustees who will manage this trust
        </p>
      </div>

      {/* Number of Trustees Input */}
      <div className="max-w-md mx-auto p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          How many trustees in this trust? <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNumTrusteesChange(numTrustees - 1)}
            disabled={numTrustees <= 2}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="2"
            max="15"
            value={numTrustees}
            onChange={(e) => handleNumTrusteesChange(parseInt(e.target.value) || 2)}
            className="flex-1 text-center px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <button
            onClick={() => handleNumTrusteesChange(numTrustees + 1)}
            disabled={numTrustees >= 15}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Minimum: 2 trustees, Maximum: 15 trustees
        </p>
      </div>

      {/* Summary Stats */}
      <div className="max-w-md mx-auto">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">Trustees Added</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {filledMembers.length} / {numTrustees}
          </p>
          <p className="text-xs text-gray-500">
            {numTrustees - filledMembers.length} remaining
          </p>
        </div>
      </div>

      {/* Validation Warnings */}
      {!hasManagingTrustee && filledMembers.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">At least one Managing Trustee required</p>
              <p className="text-sm text-gray-300 mt-1">
                Please designate at least one trustee as Managing Trustee
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Click on cards to add/edit trustee details
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
            onDelete={filledMembers.length > 2 ? () => handleDeleteMember(index) : undefined}
            entityType="TRUST"
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
              When you submit this entity, we'll automatically create customer profiles for all trustees
              and send them login credentials via SMS & Email. This allows each trustee to independently
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
        entityType="TRUST"
      />
    </div>
  )
}
