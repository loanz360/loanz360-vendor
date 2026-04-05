'use client'

import React, { useState, useEffect } from 'react'
import { User, Info } from 'lucide-react'
import MemberCard, { MemberData } from '../../shared/MemberCard'
import MemberFormModal from '../../shared/MemberFormModal'

interface DirectorStepEnhancedProps {
  data: any
  errors: Record<string, string>
  onUpdate: (updates: any) => void
}

export default function DirectorStepEnhanced({ data, errors, onUpdate }: DirectorStepEnhancedProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [member, setMember] = useState<MemberData | null>(null)

  // Initialize member from existing director data
  useEffect(() => {
    if (data.director && data.director.full_name) {
      setMember({
        id: data.director.id || 'director-1',
        full_name: data.director.full_name,
        mobile: data.director.mobile || '',
        email: data.director.email || '',
        pan_number: data.director.pan_number || '',
        aadhaar_number: data.director.aadhaar_number,
        role: 'DIRECTOR',
        designation: 'Director',
        capital_contribution_percent: 100,
        profit_sharing_percent: 100,
        photo_url: '',
        is_signatory: true,
        can_apply_loan: true,
        is_filled: true
      })
    } else {
      setMember(null)
    }
  }, [data.director])

  const handleSaveMember = (memberData: MemberData) => {
    setMember(memberData)

    // Update parent form data
    onUpdate({
      director: {
        id: memberData.id,
        full_name: memberData.full_name,
        mobile: memberData.mobile,
        email: memberData.email,
        pan_number: memberData.pan_number,
        aadhaar_number: memberData.aadhaar_number,
        din: '',
        date_of_birth: '',
        gender: '',
        father_name: '',
        designation: memberData.designation || 'Director'
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Add Director</h2>
        <p className="text-gray-400">
          Add the sole director details for this One Person Company
        </p>
      </div>

      {/* Info Box */}
      <div className="max-w-md mx-auto p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium mb-1">One Director Required</p>
            <p className="text-sm text-gray-400">
              OPC structure allows only one director who holds 100% control
            </p>
          </div>
        </div>
      </div>

      {/* Director Card */}
      <div className="max-w-md mx-auto">
        <MemberCard
          member={member}
          index={0}
          viewMode="list"
          onAdd={() => setIsModalOpen(true)}
          onEdit={() => setIsModalOpen(true)}
          entityType="OPC"
        />
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-medium text-white mb-1">Auto-Create Director Profile</p>
            <p>
              When you submit this entity, we'll automatically create a customer profile for the director
              and send login credentials via SMS & Email. This allows the director to independently
              access the LOANZ 360 platform.
            </p>
          </div>
        </div>
      </div>

      {/* Member Form Modal */}
      <MemberFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMember}
        member={member}
        memberIndex={0}
        entityType="OPC"
      />
    </div>
  )
}
