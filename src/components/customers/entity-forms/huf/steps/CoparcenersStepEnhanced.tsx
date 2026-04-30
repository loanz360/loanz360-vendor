'use client'

import React, { useState, useEffect } from 'react'
import { Users, Grid3x3, List, Info } from 'lucide-react'
import MemberCard, { MemberData } from '../../shared/MemberCard'
import MemberFormModal from '../../shared/MemberFormModal'

interface CoparcenersStepEnhancedProps {
  data: unknown  errors: Record<string, string>
  onUpdate: (updates: unknown) => void
}

export default function CoparcenersStepEnhanced({ data, errors, onUpdate }: CoparcenersStepEnhancedProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null)
  const [numCoparceners, setNumCoparceners] = useState(data.coparceners?.length || 1)
  const [members, setMembers] = useState<(MemberData | null)[]>([])

  // Initialize members array based on coparceners
  useEffect(() => {
    const initialMembers = Array.from({ length: numCoparceners }, (_, i) => {
      const existingCoparcener = data.coparceners?.[i]
      if (existingCoparcener && existingCoparcener.full_name) {
        return {
          id: existingCoparcener.id || `coparcener-${i}`,
          full_name: existingCoparcener.full_name,
          mobile: existingCoparcener.mobile || '',
          email: existingCoparcener.email || '',
          pan_number: existingCoparcener.pan_number || '',
          aadhaar_number: existingCoparcener.aadhaar_number,
          role: 'COPARCENER',
          designation: existingCoparcener.relationship_to_karta,
          capital_contribution_percent: 0,
          profit_sharing_percent: 0,
          photo_url: '',
          is_signatory: false,
          can_apply_loan: true,
          is_filled: true
        } as MemberData
      }
      return null
    })
    setMembers(initialMembers)
  }, [numCoparceners, data.coparceners])

  const handleNumCoparcenersChange = (num: number) => {
    const clampedNum = Math.min(Math.max(num, 1), 50) // Min 1, Max 50
    setNumCoparceners(clampedNum)

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
    const coparceners = data.coparceners || []
    const newCoparceners = [...coparceners]
    if (newCoparceners[index]) {
      newCoparceners.splice(index, 1)
    }
    onUpdate({ coparceners: newCoparceners })
  }

  const handleSaveMember = (member: MemberData) => {
    if (editingMemberIndex === null) return

    const newMembers = [...members]
    newMembers[editingMemberIndex] = member
    setMembers(newMembers)

    // Convert to HUF format and update parent
    const coparceners = data.coparceners || []
    const newCoparceners = [...coparceners]
    newCoparceners[editingMemberIndex] = {
      id: member.id,
      full_name: member.full_name,
      mobile: member.mobile,
      email: member.email,
      pan_number: member.pan_number,
      aadhaar_number: member.aadhaar_number,
      relationship_to_karta: member.designation || 'Son',
      date_of_birth: '',
      gender: '',
      father_name: ''
    }
    onUpdate({ coparceners: newCoparceners })
  }

  // Calculate stats
  const filledMembers = members.filter(m => m?.is_filled) as MemberData[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Coparceners</h2>
        <p className="text-gray-400">
          Add family members who are coparceners in this HUF (Optional)
        </p>
      </div>

      {/* Number of Coparceners Input */}
      <div className="max-w-md mx-auto p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          How many coparceners in this HUF? <span className="text-gray-500">(Optional)</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNumCoparcenersChange(numCoparceners - 1)}
            disabled={numCoparceners <= 1}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max="50"
            value={numCoparceners}
            onChange={(e) => handleNumCoparcenersChange(parseInt(e.target.value) || 1)}
            className="flex-1 text-center px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <button
            onClick={() => handleNumCoparcenersChange(numCoparceners + 1)}
            disabled={numCoparceners >= 50}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Minimum: 1 coparcener, Maximum: 50 coparceners
        </p>
      </div>

      {/* Summary Stats */}
      <div className="max-w-md mx-auto">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">Coparceners Added</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {filledMembers.length} / {numCoparceners}
          </p>
          <p className="text-xs text-gray-500">
            {numCoparceners - filledMembers.length} remaining
          </p>
        </div>
      </div>

      {/* Info Note */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-1">Coparceners in HUF</p>
            <p>
              Coparceners are family members who have rights in the ancestral property.
              Typically includes sons, grandsons, and in some cases daughters and wives.
              The Karta manages the HUF on behalf of all coparceners.
            </p>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Click on cards to add/edit coparcener details
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
            onDelete={() => handleDeleteMember(index)}
            entityType="HUF"
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
              When you submit this entity, we'll automatically create customer profiles for all coparceners
              and send them login credentials via SMS & Email. This allows each coparcener to independently
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
        entityType="HUF"
      />
    </div>
  )
}
