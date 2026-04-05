'use client'

import React, { useState, useEffect } from 'react'
import { Users, Plus, Grid3x3, List, Percent, Info } from 'lucide-react'
import MemberCard, { MemberData } from '../../shared/MemberCard'
import MemberFormModal from '../../shared/MemberFormModal'
import { PartnershipStepProps } from '../../types/partnership'

export default function PartnersStepEnhanced({ data, errors, onUpdate }: PartnershipStepProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null)
  const [numPartners, setNumPartners] = useState(data.num_partners || 2)
  const [members, setMembers] = useState<(MemberData | null)[]>([])

  // Initialize members array based on num_partners
  useEffect(() => {
    const initialMembers = Array.from({ length: numPartners }, (_, i) => {
      // Check if we have existing partner data
      const existingPartner = data.partners?.[i]
      if (existingPartner && existingPartner.full_name) {
        return {
          id: existingPartner.id || `partner-${i}`,
          full_name: existingPartner.full_name,
          mobile: existingPartner.mobile || '',
          email: existingPartner.email || '',
          pan_number: existingPartner.pan_number || '',
          aadhaar_number: existingPartner.aadhaar_number,
          role: existingPartner.partner_type || '',
          designation: existingPartner.designation,
          capital_contribution_percent: existingPartner.capital_contribution_percent,
          profit_sharing_percent: existingPartner.profit_sharing_percent,
          photo_url: '',
          is_signatory: false,
          can_apply_loan: false,
          is_filled: true
        } as MemberData
      }
      return null
    })
    setMembers(initialMembers)
  }, [numPartners, data.partners])

  const handleNumPartnersChange = (num: number) => {
    const clampedNum = Math.min(Math.max(num, 2), 50) // Min 2, Max 50
    setNumPartners(clampedNum)
    onUpdate({ num_partners: clampedNum })

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
    const partners = data.partners || []
    const newPartners = [...partners]
    if (newPartners[index]) {
      newPartners[index] = {
        id: ``,
        full_name: '',
        mobile: '',
        email: '',
        pan_number: '',
        partner_type: '',
        capital_contribution_percent: 0,
        profit_sharing_percent: 0
      }
    }
    onUpdate({ partners: newPartners })
  }

  const handleSaveMember = (member: MemberData) => {
    if (editingMemberIndex === null) return

    const newMembers = [...members]
    newMembers[editingMemberIndex] = member
    setMembers(newMembers)

    // Convert to partnership format and update parent
    const partners = data.partners || []
    const newPartners = [...partners]
    newPartners[editingMemberIndex] = {
      id: member.id,
      full_name: member.full_name,
      mobile: member.mobile,
      email: member.email,
      pan_number: member.pan_number,
      aadhaar_number: member.aadhaar_number,
      partner_type: member.role,
      designation: member.designation,
      capital_contribution_percent: member.capital_contribution_percent || 0,
      profit_sharing_percent: member.profit_sharing_percent || 0,
      date_of_birth: '',
      gender: '',
      father_name: ''
    }
    onUpdate({ partners: newPartners })
  }

  // Calculate totals
  const filledMembers = members.filter(m => m?.is_filled) as MemberData[]
  const totalCapital = filledMembers.reduce((sum, m) => sum + (m.capital_contribution_percent || 0), 0)
  const totalProfit = filledMembers.reduce((sum, m) => sum + (m.profit_sharing_percent || 0), 0)
  const hasManagingPartner = filledMembers.some(m => m.role === 'MANAGING_PARTNER')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Partners</h2>
        <p className="text-gray-400">
          Add all partners who will be part of this partnership firm
        </p>
      </div>

      {/* Number of Partners Input */}
      <div className="max-w-md mx-auto p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          How many partners in this firm? <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNumPartnersChange(numPartners - 1)}
            disabled={numPartners <= 2}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min="2"
            max="50"
            value={numPartners}
            onChange={(e) => handleNumPartnersChange(parseInt(e.target.value) || 2)}
            className="flex-1 text-center px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
          <button
            onClick={() => handleNumPartnersChange(numPartners + 1)}
            disabled={numPartners >= 50}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            +
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Minimum: 2 partners, Maximum: 50 partners
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400">Partners Added</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {filledMembers.length} / {numPartners}
          </p>
          <p className="text-xs text-gray-500">
            {numPartners - filledMembers.length} remaining
          </p>
        </div>

        <div className={`border rounded-xl p-4 ${
          totalCapital === 100 ? 'bg-green-500/10 border-green-500/30' :
          totalCapital > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Capital</span>
          </div>
          <p className={`text-2xl font-bold ${
            totalCapital === 100 ? 'text-green-400' :
            totalCapital > 100 ? 'text-red-400' : 'text-white'
          }`}>
            {totalCapital.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500">Target: 100%</p>
        </div>

        <div className={`border rounded-xl p-4 ${
          totalProfit === 100 ? 'bg-green-500/10 border-green-500/30' :
          totalProfit > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Profit</span>
          </div>
          <p className={`text-2xl font-bold ${
            totalProfit === 100 ? 'text-green-400' :
            totalProfit > 100 ? 'text-red-400' : 'text-white'
          }`}>
            {totalProfit.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500">Target: 100%</p>
        </div>
      </div>

      {/* Validation Warnings */}
      {!hasManagingPartner && filledMembers.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">At least one Managing Partner required</p>
              <p className="text-sm text-gray-300 mt-1">
                Please designate at least one partner as Managing Partner
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Click on cards to add/edit partner details
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
            entityType="PARTNERSHIP"
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
              When you submit this entity, we'll automatically create customer profiles for all partners
              and send them login credentials via SMS & Email. This allows each partner to independently
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
        entityType="PARTNERSHIP"
      />
    </div>
  )
}
